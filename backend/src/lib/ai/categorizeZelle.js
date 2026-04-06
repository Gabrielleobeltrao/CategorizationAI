import OpenAI from "openai"
import dotenv from "dotenv"
import { z } from "zod"

dotenv.config({ quiet: true })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DEFAULT_LLM_BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE || 20)
const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 60_000)
const DEFAULT_LLM_MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES || 4)
const DEFAULT_LLM_BACKOFF_MS = Number(process.env.LLM_BACKOFF_MS || 1200)

const ZelleTransactionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string().optional().nullable(),
  amount: z.number(),
})

const BusinessSchema = z.object({
  name: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  mainActivity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  owners: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
      }),
    ])
  ).optional().nullable(),
})

const ZelleCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["income", "expense"]),
})

const ZelleResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
  ambiguous: z.boolean(),
})

const ZelleOutputSchema = z.object({
  categories: z.array(ZelleCategorySchema),
  results: z.array(ZelleResultSchema),
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

function promptBusiness(business) {
  const lines = []

  if (business?.name) lines.push(`Business name: ${business.name}`)
  if (business?.businessType) lines.push(`Business type: ${business.businessType}`)
  if (business?.mainActivity) lines.push(`Main activity: ${business.mainActivity}`)
  if (business?.description) lines.push(`Business context: ${business.description}`)

  const owners = Array.isArray(business?.owners)
    ? business.owners
        .map((owner) => {
          if (typeof owner === "string") return owner.trim()
          if (owner && typeof owner === "object") return String(owner.name || "").trim()
          return ""
        })
        .filter(Boolean)
    : []
  if (owners.length > 0) {
    lines.push(`Business owners: ${owners.join(", ")}`)
  }

  return lines.join("\n")
}

function promptTransactions(transactions) {
  return transactions
    .map(
      (transaction) =>
        `id: ${transaction.id}, description: ${transaction.description || ""}, amount: ${transaction.amount}`
    )
    .join("\n")
}

function getDirectionByAmount(amount = 0) {
  return Number(amount) >= 0 ? "positive" : "negative"
}

function getSystemRulesByDirection(direction = "positive") {
  if (direction === "negative") {
    return `
You are an accountant specialized in bank transaction categorization.
You are classifying NEGATIVE Zelle transactions only.

Rules:
- Output ONLY JSON
- For all transactions in this batch, use expense categories only
- Prefer "Sub - {person or alias}" names
- Never return income categories in this batch
- Keep category names consistent (avoid random suffixes/codes)
- Keep the minimum number of categories needed for this batch
    `.trim()
  }

  return `
You are an accountant specialized in bank transaction categorization.
You are classifying POSITIVE Zelle transactions only.

Rules:
- Output ONLY JSON
- For positive Zelle:
  - if it clearly comes from an owner -> "No service income - {owner}"
  - otherwise -> "Income Zelle"
- Never return "Sub - ..." categories in this batch
- Use income categories only in this batch
- Keep category names consistent (avoid random suffixes/codes)
- Keep the minimum number of categories needed for this batch
  `.trim()
}

function normalizeCategoryForDirection(categoryName = "", direction = "positive") {
  const raw = String(categoryName || "").trim()
  if (!raw) {
    return direction === "negative" ? "Sub - Unknown" : "Income Zelle"
  }

  const lower = raw.toLowerCase()

  if (direction === "negative") {
    if (lower.startsWith("sub -")) return raw
    return `Sub - ${raw.replace(/^income\s*zelle$/i, "Unknown")}`
  }

  if (lower.startsWith("sub -")) return "Income Zelle"
  return raw
}

async function categorizeBatch({
  transactions,
  business,
  direction,
  model,
  timeoutMs,
  maxRetries,
  backoffMs,
  batchIndex,
  totalBatches,
}) {
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
              content: getSystemRulesByDirection(direction),
            },
            {
              role: "user",
              content: `
Business:
${promptBusiness(business)}

Zelle transactions:
${promptTransactions(transactions)}

Return ONLY valid JSON in this format:
{
  "categories": [
    { "name": "Category Name", "type": "income|expense" }
  ],
  "results": [
    { "id": "transaction-id", "categoryName": "Category Name or empty", "confidence": 0.0, "ambiguous": false }
  ]
}

Rules:
- Every transaction id in this batch must appear once in results
- if categoryName is not empty, it must exist in categories
- categories must be unique by name
- Batch direction is "${direction}" and must be respected
- confidence must be a number from 0 to 1
- ambiguous must be true when the description could reasonably fit more than one Zelle category
- if confidence is low, prefer categoryName = ""
              `.trim(),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "zelle_categorization",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string", minLength: 1 },
                        type: { type: "string", enum: ["income", "expense"] },
                      },
                      required: ["name", "type"],
                    },
                  },
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        id: { type: ["string", "number"] },
                        categoryName: { type: "string" },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                        ambiguous: { type: "boolean" },
                      },
                      required: ["id", "categoryName", "confidence", "ambiguous"],
                    },
                  },
                },
                required: ["categories", "results"],
              },
            },
          },
        }),
        timeoutMs
      )

      const parsed = ZelleOutputSchema.parse(JSON.parse(response?.choices?.[0]?.message?.content || "{}"))
      const elapsedMs = Date.now() - startedAt

      console.info(
        `[categorizeZelle] direction=${direction} batch=${batchIndex}/${totalBatches} attempt=${attempt} requestId=${
          response?.id || "n/a"
        } tx=${transactions.length} ms=${elapsedMs}`
      )

      return parsed
    } catch (error) {
      lastError = error
      const shouldRetry = attempt < maxRetries
      console.warn(
        `[categorizeZelle] direction=${direction} batch=${batchIndex}/${totalBatches} attempt=${attempt} failed: ${
          error?.message || error
        }${shouldRetry ? " (retrying)" : ""}`
      )
      if (!shouldRetry) break
      await sleep(backoffMs * attempt)
    }
  }

  throw lastError
}

function mergeBatchOutput({
  output,
  direction,
  txById,
  mergedCategoriesByName,
  mergedResultById,
}) {
  output.categories.forEach((category) => {
    const normalizedCategoryName = normalizeCategoryForDirection(category?.name, direction)
    if (!normalizedCategoryName) return
    if (!mergedCategoriesByName.has(normalizedCategoryName)) {
      mergedCategoriesByName.set(normalizedCategoryName, {
        name: normalizedCategoryName,
        type: direction === "negative" ? "expense" : "income",
      })
    }
  })

  output.results.forEach((item) => {
    const idKey = toIdKey(item.id)
    if (!txById.has(idKey)) return
    const normalizedCategoryName = normalizeCategoryForDirection(item.categoryName, direction)
    if (!normalizedCategoryName) return
    mergedResultById.set(idKey, {
      id: txById.get(idKey).id,
      categoryName: normalizedCategoryName,
      confidence: Number(item?.confidence || 0),
      ambiguous: Boolean(item?.ambiguous),
    })
  })
}

async function categorizeZelle(transactions, business, options = {}) {
  const safeTransactions = z.array(ZelleTransactionSchema).parse(transactions)
  const safeBusiness = BusinessSchema.parse(business)

  if (safeTransactions.length === 0) {
    return { categories: [], results: [] }
  }

  const txById = new Map(safeTransactions.map((transaction) => [toIdKey(transaction.id), transaction]))
  const model = String(options.model || "gpt-4.1-mini")
  const batchSize = Number(options.batchSize || DEFAULT_LLM_BATCH_SIZE)
  const timeoutMs = Number(options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS)
  const maxRetries = Number(options.maxRetries || DEFAULT_LLM_MAX_RETRIES)
  const backoffMs = Number(options.backoffMs || DEFAULT_LLM_BACKOFF_MS)

  const positiveTransactions = safeTransactions.filter(
    (transaction) => getDirectionByAmount(transaction.amount) === "positive"
  )
  const negativeTransactions = safeTransactions.filter(
    (transaction) => getDirectionByAmount(transaction.amount) === "negative"
  )

  const mergedCategoriesByName = new Map()
  const mergedResultById = new Map()

  const runDirectionBatches = async (direction, directionTransactions) => {
    if (directionTransactions.length === 0) return
    const batches = chunkArray(directionTransactions, batchSize)
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index]
      const output = await categorizeBatch({
        transactions: batch,
        business: safeBusiness,
        direction,
        model,
        timeoutMs,
        maxRetries,
        backoffMs,
        batchIndex: index + 1,
        totalBatches: batches.length,
      })
      mergeBatchOutput({
        output,
        direction,
        txById,
        mergedCategoriesByName,
        mergedResultById,
      })
    }
  }

  await runDirectionBatches("positive", positiveTransactions)
  await runDirectionBatches("negative", negativeTransactions)

  const finalResults = safeTransactions.map((transaction) => {
    const idKey = toIdKey(transaction.id)
    return (
      mergedResultById.get(idKey) || {
        id: transaction.id,
        categoryName: transaction.amount >= 0 ? "Income Zelle" : "Sub - Unknown",
        confidence: 0,
        ambiguous: true,
      }
    )
  })

  finalResults.forEach((result) => {
    if (!mergedCategoriesByName.has(result.categoryName)) {
      mergedCategoriesByName.set(result.categoryName, {
        name: result.categoryName,
        type: String(result.categoryName || "").toLowerCase().startsWith("sub -")
          ? "expense"
          : "income",
      })
    }
  })

  return {
    categories: Array.from(mergedCategoriesByName.values()),
    results: finalResults,
  }
}

export default categorizeZelle
