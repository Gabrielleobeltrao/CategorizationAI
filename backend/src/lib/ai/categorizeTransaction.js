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

const CategorySchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().trim().min(1),
  type: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

const TransactionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string().optional().nullable(),
  amount: z.number(),
})

const BusinessSchema = z.object({
  name: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  mainActivity: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

const CategorizationItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  categoryId: z.string(),
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

function promptCategories(categories) {
  return categories
    .map(
      (category) =>
        `id: ${category.id}, name: ${category.name}, type: ${category.type || ""}, description: ${
          category.description || ""
        }`
    )
    .join("\n")
}

function promptTransactions(transactions) {
  return transactions
    .map(
      (transaction) =>
        `id: ${transaction.id}, description: ${transaction.description || ""}, amount: ${
          transaction.amount
        }`
    )
    .join("\n")
}

function promptBusiness(business) {
  const chunks = []

  if (business?.name) {
    chunks.push(`You are an accountant for ${business.name}.`)
  } else {
    chunks.push("You are an accountant.")
  }

  if (business?.businessType) {
    chunks.push(`Business type: ${business.businessType}.`)
  }

  if (business?.mainActivity) {
    chunks.push(`Main activity: ${business.mainActivity}.`)
  }

  if (business?.description) {
    chunks.push(`Business context: ${business.description}.`)
  }

  chunks.push("Always choose the most appropriate accounting category.")
  return chunks.join(" ")
}

async function categorizeBatch({
  categories,
  transactions,
  business,
  model,
  timeoutMs,
  maxRetries,
  backoffMs,
  batchIndex,
  totalBatches,
}) {
  const allowedCategoryIds = categories.map((category) => String(category.id))
  const allowedCategoryIdsWithBlank = [...allowedCategoryIds, ""]

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
Available categories:
${promptCategories(categories)}

Transaction list:
${promptTransactions(transactions)}

Return ONLY valid JSON in this format:
{
  "results": [
    { "id": "transaction-id", "categoryId": "category-id-or-empty", "confidence": 0.0, "ambiguous": false }
  ]
}

Rules:
- categoryId must be exactly one of the available category ids.
- if unclear, categoryId must be "".
- confidence must be a number from 0 to 1.
- confidence should reflect how certain you are about the chosen category.
- ambiguous must be true when the merchant or description could reasonably fit more than one category.
- if ambiguous is true, prefer categoryId = "" unless the description is still clearly decisive.
- if confidence is low, prefer categoryId = "".
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
                        categoryId: { type: "string", enum: allowedCategoryIdsWithBlank },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                        ambiguous: { type: "boolean" },
                      },
                      required: ["id", "categoryId", "confidence", "ambiguous"],
                    },
                  },
                },
                required: ["results"],
              },
            },
          },
        }),
        timeoutMs
      )

      const messageContent = response?.choices?.[0]?.message?.content
      const parsed = CategorizationOutputSchema.parse(JSON.parse(messageContent || "{}"))
      const elapsedMs = Date.now() - startedAt

      console.info(
        `[categorizeTransaction] batch=${batchIndex}/${totalBatches} attempt=${attempt} requestId=${
          response?.id || "n/a"
        } tx=${transactions.length} ms=${elapsedMs}`
      )

      return parsed.results
    } catch (error) {
      lastError = error
      const shouldRetry = attempt < maxRetries
      console.warn(
        `[categorizeTransaction] batch=${batchIndex}/${totalBatches} attempt=${attempt} failed: ${
          error?.message || error
        }${shouldRetry ? " (retrying)" : ""}`
      )
      if (!shouldRetry) break
      await sleep(backoffMs * attempt)
    }
  }

  throw lastError
}

async function categorizeTransaction(categories, transactions, business, options = {}) {
  const safeCategories = z.array(CategorySchema).parse(categories)
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
      categories: safeCategories,
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

  const allowedCategoryIds = new Set(safeCategories.map((category) => String(category.id)))
  const resultById = new Map()

  for (const item of batchResults) {
    const idKey = toIdKey(item.id)
    if (!txById.has(idKey)) continue
    const normalizedCategoryId = allowedCategoryIds.has(String(item.categoryId))
      ? String(item.categoryId)
      : ""
    resultById.set(idKey, {
      id: txById.get(idKey).id,
      categoryId: normalizedCategoryId || null,
      confidence: Number(item.confidence || 0),
      ambiguous: Boolean(item.ambiguous),
    })
  }

  const finalResults = safeTransactions.map((transaction) => {
    const idKey = toIdKey(transaction.id)
    return (
      resultById.get(idKey) || {
        id: transaction.id,
        categoryId: null,
        confidence: 0,
        ambiguous: true,
      }
    )
  })

  return finalResults
}

export default categorizeTransaction
