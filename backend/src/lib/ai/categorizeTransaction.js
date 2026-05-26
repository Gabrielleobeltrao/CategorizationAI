import OpenAI from "openai"
import dotenv from "dotenv"
import { z } from "zod"
import { isLlmSpendLimitError, normalizeLlmError } from "../../utils/llmError.js"

dotenv.config({ quiet: true })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DEFAULT_LLM_BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE || 20)
const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 60_000)
const DEFAULT_LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 4)
const DEFAULT_LLM_BACKOFF_MS = Number(process.env.LLM_BACKOFF_MS || 1200)

// Input shape after the double-entry migration: each candidate is an
// account from `coa_accounts` whose accountType is a P&L bucket. The
// `description` is the user-authored "AI hint" — the most important
// field for the model when deciding where to put a transaction.
const AccountSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().trim().min(1),
  accountType: z.string().trim().min(1),
  description: z.string().optional().nullable(),
})

const TransactionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string().optional().nullable(),
  amount: z.number(),
  memoryHint: z.string().optional().nullable(),
})

const BusinessSchema = z.object({
  name: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  mainActivity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

const CategorizationItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  accountId: z.string(),
  confidence: z.number().min(0).max(1),
  ambiguous: z.boolean(),
})

const CategorizationOutputSchema = z.object({
  results: z.array(CategorizationItemSchema),
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, timeoutMs) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`OpenAI request timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}

function toIdKey(value) {
  return String(value)
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const ACCOUNT_TYPE_HUMAN = {
  income: "Income (revenue earned from main business activity)",
  cost_of_goods_sold: "Cost of Goods Sold (direct cost of products/services sold)",
  operating_expense: "Operating Expense (recurring costs to run the business: rent, marketing, software, utilities…)",
  other_income: "Other Income (non-operating income: interest received, gains, refunds)",
  other_expense: "Other Expense (non-operating expense: interest paid, bank fees, one-off losses)",
  tax_expense: "Tax Expense (income tax, distinct from operating expenses)",
}

function promptAccounts(accounts) {
  return accounts
    .map((account) => {
      const description = String(account.description || "").trim()
      const hint = description ? ` | description: ${description}` : ""
      return `id: ${account.id} | name: ${account.name} | type: ${account.accountType}${hint}`
    })
    .join("\n")
}

function promptTransactions(transactions) {
  return transactions
    .map((transaction) => {
      const memo = transaction.memoryHint ? ` | historical_hint: ${transaction.memoryHint}` : ""
      const direction = Number(transaction.amount) >= 0 ? "money_in" : "money_out"
      return `id: ${transaction.id} | description: ${transaction.description || ""} | amount: ${transaction.amount} (${direction})${memo}`
    })
    .join("\n")
}

function promptBusiness(business) {
  const chunks = []

  if (business?.name) {
    chunks.push(`You are an accountant for ${business.name}.`)
  } else {
    chunks.push("You are an accountant.")
  }
  if (business?.businessType) chunks.push(`Business type: ${business.businessType}.`)
  if (business?.mainActivity) chunks.push(`Main activity: ${business.mainActivity}.`)
  if (business?.description) chunks.push(`Business context: ${business.description}.`)

  chunks.push(
    "Each bank transaction must be assigned to exactly one P&L account from the chart of accounts. Read every account's description carefully — those descriptions are the user's authoritative hint about when an account applies. Match transaction descriptions to account descriptions first; the account type guides direction (money_in → income/other_income; money_out → expense types).",
  )
  return chunks.join(" ")
}

function describeAccountTypesUsed(accounts) {
  const types = new Set(accounts.map((a) => a.accountType))
  return [...types]
    .map((type) => `- ${type}: ${ACCOUNT_TYPE_HUMAN[type] || ""}`)
    .join("\n")
}

async function categorizeBatch({
  accounts,
  transactions,
  business,
  model,
  timeoutMs,
  maxRetries,
  backoffMs,
  batchIndex,
  totalBatches,
}) {
  const allowedAccountIds = accounts.map((account) => String(account.id))
  const allowedAccountIdsWithBlank = [...allowedAccountIds, ""]

  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now()
    try {
      const response = await withTimeout(
        openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: promptBusiness(business),
            },
            {
              role: "user",
              content: `
Account types in this batch:
${describeAccountTypesUsed(accounts)}

Available accounts (read the descriptions carefully — they're the user's instructions for when each account applies):
${promptAccounts(accounts)}

Transactions to categorize:
${promptTransactions(transactions)}

Return ONLY valid JSON in this format:
{
  "results": [
    { "id": "transaction-id", "accountId": "account-id-or-empty", "confidence": 0.0, "ambiguous": false }
  ]
}

Rules:
- accountId must be exactly one of the available account ids.
- if unclear, leave accountId as "".
- confidence must be a number from 0 to 1 reflecting how certain you are.
- if accountId is "" (no account chosen), confidence MUST be ≤ 0.3 — never claim high confidence in a refusal.
- historical_hint is optional compact history from prior client patterns — treat as supporting evidence, not decisive.
- ambiguous must be true when the description could reasonably fit more than one account.
- if ambiguous is true, prefer accountId = "" unless the description is still clearly decisive.
- if confidence is low, prefer accountId = "".
- money_in transactions must use income / other_income accounts. money_out transactions must use cost_of_goods_sold / operating_expense / other_expense / tax_expense accounts. Never mix directions.
- TRANSFERS BETWEEN OWN ACCOUNTS are NOT P&L events. When the description contains TRANSFER, XFER, INTERNAL, "FROM SAVINGS", "TO CHECKING", "BETWEEN", or similar movement between the user's own bank/credit accounts, return accountId = "" with low confidence (≤ 0.2) and ambiguous = true. The worker will handle these separately as balance-sheet transfers.
- every transaction id in this batch should appear once in the output.
              `.trim(),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "categorization",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        id: { type: ["string", "number"] },
                        accountId: { type: "string", enum: allowedAccountIdsWithBlank },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                        ambiguous: { type: "boolean" },
                      },
                      required: ["id", "accountId", "confidence", "ambiguous"],
                    },
                  },
                },
                required: ["results"],
              },
            },
          },
        }),
        timeoutMs,
      )

      const messageContent = response?.choices?.[0]?.message?.content
      const parsed = CategorizationOutputSchema.parse(JSON.parse(messageContent || "{}"))
      const elapsedMs = Date.now() - startedAt

      console.info(
        `[categorizeTransaction] batch=${batchIndex}/${totalBatches} attempt=${attempt} requestId=${
          response?.id || "n/a"
        } tx=${transactions.length} ms=${elapsedMs}`,
      )

      return parsed.results
    } catch (error) {
      lastError = error
      const spendLimitReached = isLlmSpendLimitError(error)
      const shouldRetry = !spendLimitReached && attempt < maxRetries
      console.warn(
        `[categorizeTransaction] batch=${batchIndex}/${totalBatches} attempt=${attempt} failed: ${
          error?.message || error
        }${shouldRetry ? " (retrying)" : ""}`,
      )
      if (!shouldRetry) break
      await sleep(backoffMs * attempt)
    }
  }

  throw normalizeLlmError(lastError)
}

async function categorizeTransaction(accounts, transactions, business, options = {}) {
  const safeAccounts = z.array(AccountSchema).parse(accounts)
  const safeTransactions = z.array(TransactionSchema).parse(transactions)
  const safeBusiness = BusinessSchema.parse(business)

  if (safeTransactions.length === 0) return []

  const txById = new Map(safeTransactions.map((transaction) => [toIdKey(transaction.id), transaction]))

  const model = String(options.model || "gpt-4.1-mini")
  const batchSize = Number(options.batchSize || DEFAULT_LLM_BATCH_SIZE)
  const timeoutMs = Number(options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS)
  const maxRetries = Number(options.maxRetries || DEFAULT_LLM_MAX_RETRIES)
  const backoffMs = Number(options.backoffMs || DEFAULT_LLM_BACKOFF_MS)

  const batches = chunkArray(safeTransactions, batchSize)
  const batchResults = []

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    const results = await categorizeBatch({
      accounts: safeAccounts,
      transactions: batch,
      business: safeBusiness,
      model,
      timeoutMs,
      maxRetries,
      backoffMs,
      batchIndex: index + 1,
      totalBatches: batches.length,
    })
    batchResults.push(...results)
  }

  const allowedAccountIds = new Set(safeAccounts.map((account) => String(account.id)))
  const resultById = new Map()

  for (const item of batchResults) {
    const idKey = toIdKey(item.id)
    if (!txById.has(idKey)) continue
    const normalizedAccountId = allowedAccountIds.has(String(item.accountId))
      ? String(item.accountId)
      : ""
    resultById.set(idKey, {
      id: txById.get(idKey).id,
      accountId: normalizedAccountId || null,
      confidence: Number(item.confidence || 0),
      ambiguous: Boolean(item.ambiguous),
    })
  }

  const finalResults = safeTransactions.map((transaction) => {
    const idKey = toIdKey(transaction.id)
    return (
      resultById.get(idKey) || {
        id: transaction.id,
        accountId: null,
        confidence: 0,
        ambiguous: true,
      }
    )
  })

  return finalResults
}

export default categorizeTransaction
