import {
  insertTransactionsInBatches,
  updateTransactionById,
  updateTransactionsByIds,
  getTransactionById,
  listTransactionsPaginated,
  summarizeTransactions,
  listTransactionPeriodOptions,
  deleteTransactionById,
  deleteTransactionsByIds,
  listEligibleTransactionsForLlmByIds,
  listEligibleTransactionsForLlmByClientId,
  listEligibleTransactionsForZelleByIds,
  listEligibleTransactionsForZelleByClientId,
  applyLlmCategorizationUpdates,
  applyCategoryUpdates,
} from "../repositories/transactions.repository.js"
import { createCategory, listCategoriesByClientId, listCategoriesByIds } from "../repositories/category.repository.js"
import { getClientById } from "../repositories/clients.repository.js"
import { ObjectId } from "mongodb"
import categorizeTransaction from "../lib/ai/categorizeTransaction.js"
import categorizeZelle from "../lib/ai/categorizeZelle.js"

const LLM_CONFIDENCE_THRESHOLD = 0.8

function normalizeObjectIdString(value) {
  const raw = String(value || "").trim()
  if (!raw || !ObjectId.isValid(raw)) return null
  return new ObjectId(raw).toString()
}

function getDefaultUncategorizedLabelByAmount(amount = 0) {
  const numericAmount = Number(amount || 0)
  return numericAmount >= 0 ? "Uncategorized income" : "Uncategorized expenses"
}

function normalizeDateString(value) {
  const safe = String(value || "").trim()
  if (!safe) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    throw new Error("date must be in YYYY-MM-DD format")
  }
  return safe
}

function normalizeBatchPatch(rawPatch = {}) {
  if (!rawPatch || typeof rawPatch !== "object") {
    throw new Error("patch is required")
  }

  const safePatch = {}

  if (rawPatch.date !== undefined) {
    safePatch.date = normalizeDateString(rawPatch.date)
  }

  if (rawPatch.accountId !== undefined) {
    const accountId = rawPatch.accountId == null ? "" : String(rawPatch.accountId).trim()
    if (accountId !== "" && !ObjectId.isValid(accountId)) {
      throw new Error("accountId is invalid")
    }
    safePatch.accountId = accountId || null
  }

  if (rawPatch.accountName !== undefined) {
    const accountName = rawPatch.accountName == null ? "" : String(rawPatch.accountName).trim()
    safePatch.accountName = accountName || null
  }

  if (rawPatch.categoryId !== undefined) {
    const categoryId = rawPatch.categoryId == null ? "" : String(rawPatch.categoryId).trim()
    if (categoryId !== "" && !ObjectId.isValid(categoryId)) {
      throw new Error("categoryId is invalid")
    }
    safePatch.categoryId = categoryId || null
  }

  if (rawPatch.category !== undefined) {
    const category = rawPatch.category == null ? "" : String(rawPatch.category).trim()
    safePatch.category = category || null
  }

  return safePatch
}

function normalizeNameKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function toDisplayName(value = "") {
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return "Unknown"

  return normalized
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ")
}

function extractZelleCounterpartyName(description = "") {
  const source = String(description || "")
  if (!source) return "Unknown"

  const cleaned = source
    .replace(/[_\-]+/g, " ")
    .replace(/\b(zel|zelle|payment|transfer|online|banking|from|to|memo|ref|reference|id|confirmation|sent|received)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return "Unknown"
  return toDisplayName(cleaned.split(" ").slice(0, 4).join(" "))
}

function isZelleRelatedCategoryName(name = "") {
  const normalized = String(name || "").trim().toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith("sub -")) return true
  if (normalized.startsWith("no service income -")) return true
  if (normalized === "income zelle") return true
  return false
}

export async function createTransactionsBatchService(transactions) {
  if (!Array.isArray(transactions)) {
    throw new Error("transactions must be an array")
  }

  if (transactions.length === 0) {
    throw new Error("transactions cannot be empty")
  }

  const normalizedTransactions = transactions.map((transaction) => {
    const amount = Number(transaction?.amount || 0)
    const hasCategoryId = transaction?.categoryId !== undefined && transaction?.categoryId !== null && transaction?.categoryId !== ""
    const hasCategoryName = Boolean(String(transaction?.category || "").trim())

    if (hasCategoryId || hasCategoryName) {
      return transaction
    }

    return {
      ...transaction,
      categoryId: null,
      category: getDefaultUncategorizedLabelByAmount(amount),
    }
  })

  return insertTransactionsInBatches(normalizedTransactions)
}

export async function updateTransactionByIdService(id, patch) {
  if (!id) throw new Error("id is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const currentTransaction = await getTransactionById(id)
  if (!currentTransaction) throw new Error("transaction not found")

  const safePatch = {}

  if (typeof patch.accountName === "string") {
    const accountName = patch.accountName.trim()
    if (!accountName) throw new Error("accountName cannot be empty")
    safePatch.accountName = accountName
  }
  if (patch.accountId !== undefined) safePatch.accountId = patch.accountId

  if (typeof patch.date === "string") safePatch.date = patch.date
  if (typeof patch.description === "string") safePatch.description = patch.description.trim()
  if (typeof patch.amount === "number") safePatch.amount = patch.amount
  if (patch.categoryId !== undefined) safePatch.categoryId = patch.categoryId
  if (patch.category !== undefined) safePatch.category = patch.category
  if (patch.llmProcessed !== undefined) safePatch.llmProcessed = Boolean(patch.llmProcessed)

  if (patch.llmStatus !== undefined) {
    const llmStatus = String(patch.llmStatus || "").trim().toLowerCase()
    const allowedLlmStatuses = ["not_processed", "suggested", "empty", "error"]
    if (!allowedLlmStatuses.includes(llmStatus)) {
      throw new Error("llmStatus is invalid")
    }
    safePatch.llmStatus = llmStatus
  }

  if (patch.llmProcessedAt !== undefined) {
    if (patch.llmProcessedAt === null || patch.llmProcessedAt === "") {
      safePatch.llmProcessedAt = null
    } else {
      const processedDate = new Date(patch.llmProcessedAt)
      if (Number.isNaN(processedDate.getTime())) throw new Error("llmProcessedAt is invalid")
      safePatch.llmProcessedAt = processedDate
    }
  }

  if (patch.llmCategorySuggestionId !== undefined) {
    safePatch.llmCategorySuggestionId = patch.llmCategorySuggestionId || null
  }

  if (patch.llmCategorySuggestionName !== undefined) {
    safePatch.llmCategorySuggestionName = patch.llmCategorySuggestionName || null
  }

  if (patch.splits !== undefined) {
    if (!Array.isArray(patch.splits)) {
      throw new Error("splits must be an array")
    }

    if (patch.splits.length < 2) {
      throw new Error("splits must have at least 2 items")
    }

    const normalizedSplits = patch.splits.map((split, index) => {
      const amount = Number(split?.amount)
      if (!Number.isFinite(amount)) {
        throw new Error(`splits[${index}].amount must be a number`)
      }

      const categoryId = split?.categoryId ?? null
      if (categoryId !== null && categoryId !== "" && !ObjectId.isValid(String(categoryId))) {
        throw new Error(`splits[${index}].categoryId is invalid`)
      }

      const category = split?.category == null ? null : String(split.category).trim()

      return {
        categoryId: categoryId ? String(categoryId) : null,
        category: category || null,
        amount: Number(amount.toFixed(2)),
      }
    })

    const parentAmount = Number(
      typeof safePatch.amount === "number" ? safePatch.amount : currentTransaction.amount
    )
    const splitTotal = normalizedSplits.reduce((sum, split) => sum + Number(split.amount || 0), 0)

    if (Math.abs(Number(splitTotal.toFixed(2)) - Number(parentAmount.toFixed(2))) > 0.01) {
      throw new Error("sum of split amounts must match transaction amount")
    }

    safePatch.splits = normalizedSplits
    safePatch.isSplit = true
    safePatch.categoryId = null
    safePatch.category = null
  }

  const isCurrentSplit =
    Boolean(currentTransaction?.isSplit) ||
    (Array.isArray(currentTransaction?.splits) && currentTransaction.splits.length > 1)
  const isTryingToChangeParentCategory =
    safePatch.category !== undefined || safePatch.categoryId !== undefined

  if (isCurrentSplit && patch.splits === undefined && isTryingToChangeParentCategory) {
    throw new Error("cannot update parent category for split transaction")
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  return updateTransactionById(id, safePatch)
}

export async function updateTransactionsByIdsService(input = {}) {
  const updates = Array.isArray(input?.updates) ? input.updates : []
  if (updates.length === 0) {
    throw new Error("updates must be a non-empty array")
  }

  const mergedById = new Map()

  updates.forEach((item, index) => {
    const id = String(item?.id || "").trim()
    if (!id || !ObjectId.isValid(id)) {
      throw new Error(`updates[${index}].id is invalid`)
    }

    const safePatch = normalizeBatchPatch(item?.patch || {})
    if (Object.keys(safePatch).length === 0) {
      throw new Error(`updates[${index}].patch has no valid fields`)
    }

    const existing = mergedById.get(id) || {}
    mergedById.set(id, {
      ...existing,
      ...safePatch,
    })
  })

  const normalizedUpdates = Array.from(mergedById.entries()).map(([id, patch]) => ({
    id,
    patch,
  }))

  const result = await updateTransactionsByIds(normalizedUpdates)
  return {
    requestedCount: normalizedUpdates.length,
    matchedCount: Number(result?.matchedCount || 0),
    updatedCount: Number(result?.modifiedCount || 0),
  }
}

export async function listTransactionsPaginatedService(query) {
  const parseCsv = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

  const clientId = query?.clientId
  const page = query?.page
  const limit = query?.limit
  const search = String(query?.search || "").trim().slice(0, 100)
  const accountIds = parseCsv(query?.accountIds)
  const categoryIds = parseCsv(query?.categoryIds)
  const includeUncategorizedIncome = String(query?.includeUncategorizedIncome || "").toLowerCase() === "true"
  const includeUncategorizedExpenses = String(query?.includeUncategorizedExpenses || "").toLowerCase() === "true"
  const splitMode = String(query?.splitMode || "all").trim().toLowerCase()
  const amountSign = String(query?.amountSign || "all").trim().toLowerCase()
  const years = parseCsv(query?.years)
  const months = parseCsv(query?.months)
  const fromDate = String(query?.fromDate || "").trim()
  const toDate = String(query?.toDate || "").trim()
  const minAmountRaw = String(query?.minAmount ?? "").trim()
  const maxAmountRaw = String(query?.maxAmount ?? "").trim()
  const llmProcessed = String(query?.llmProcessed || "all").trim().toLowerCase()
  const minAmount = minAmountRaw === "" ? null : Number(minAmountRaw)
  const maxAmount = maxAmountRaw === "" ? null : Number(maxAmountRaw)

  if (!clientId) throw new Error("clientId is required")
  if (!["all", "split", "regular"].includes(splitMode)) {
    throw new Error("splitMode must be one of: all, split, regular")
  }
  if (!["all", "positive", "negative"].includes(amountSign)) {
    throw new Error("amountSign must be one of: all, positive, negative")
  }
  if (minAmountRaw !== "" && Number.isNaN(minAmount)) throw new Error("minAmount must be a number")
  if (maxAmountRaw !== "" && Number.isNaN(maxAmount)) throw new Error("maxAmount must be a number")
  if (!["all", "processed", "not_processed"].includes(llmProcessed)) {
    throw new Error("llmProcessed must be one of: all, processed, not_processed")
  }

  const result = await listTransactionsPaginated({
    clientId,
    page,
    limit,
    search,
    accountIds,
    categoryIds,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode,
    amountSign,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    llmProcessed,
  })

  const items = Array.isArray(result?.items) ? result.items : []
  const missingCategoryNameIds = [
    ...new Set(
      items
        .filter((item) => {
          const hasCategoryId = Boolean(String(item?.categoryId || "").trim())
          const hasCategoryName = Boolean(String(item?.category || "").trim())
          return hasCategoryId && !hasCategoryName
        })
        .map((item) => normalizeObjectIdString(item.categoryId))
        .filter(Boolean)
    ),
  ]

  const categories = missingCategoryNameIds.length > 0
    ? await listCategoriesByIds(missingCategoryNameIds)
    : []
  const categoryNameById = new Map(
    categories.map((category) => [String(category._id), String(category.name || "")])
  )

  const patchedItems = items.map((item) => {
    const normalizedCategoryId = normalizeObjectIdString(item?.categoryId)
    const currentCategoryName = String(item?.category || "").trim()
    if (!normalizedCategoryId) {
      if (currentCategoryName) return item
      return {
        ...item,
        category: getDefaultUncategorizedLabelByAmount(item?.amount),
      }
    }
    if (currentCategoryName) return item

    const categoryName = categoryNameById.get(normalizedCategoryId)
    if (!categoryName) return item

    return {
      ...item,
      category: categoryName,
    }
  })

  return {
    ...result,
    items: patchedItems,
  }
}

export async function summarizeTransactionsService(query) {
  const parseCsv = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

  const clientId = query?.clientId
  const search = String(query?.search || "").trim().slice(0, 100)
  const accountIds = parseCsv(query?.accountIds)
  const categoryIds = parseCsv(query?.categoryIds)
  const includeUncategorizedIncome = String(query?.includeUncategorizedIncome || "").toLowerCase() === "true"
  const includeUncategorizedExpenses = String(query?.includeUncategorizedExpenses || "").toLowerCase() === "true"
  const splitMode = String(query?.splitMode || "all").trim().toLowerCase()
  const amountSign = String(query?.amountSign || "all").trim().toLowerCase()
  const years = parseCsv(query?.years)
  const months = parseCsv(query?.months)
  const fromDate = String(query?.fromDate || "").trim()
  const toDate = String(query?.toDate || "").trim()
  const minAmountRaw = String(query?.minAmount ?? "").trim()
  const maxAmountRaw = String(query?.maxAmount ?? "").trim()
  const llmProcessed = String(query?.llmProcessed || "all").trim().toLowerCase()
  const minAmount = minAmountRaw === "" ? null : Number(minAmountRaw)
  const maxAmount = maxAmountRaw === "" ? null : Number(maxAmountRaw)

  if (!clientId) throw new Error("clientId is required")
  if (!["all", "split", "regular"].includes(splitMode)) {
    throw new Error("splitMode must be one of: all, split, regular")
  }
  if (!["all", "positive", "negative"].includes(amountSign)) {
    throw new Error("amountSign must be one of: all, positive, negative")
  }
  if (minAmountRaw !== "" && Number.isNaN(minAmount)) throw new Error("minAmount must be a number")
  if (maxAmountRaw !== "" && Number.isNaN(maxAmount)) throw new Error("maxAmount must be a number")
  if (!["all", "processed", "not_processed"].includes(llmProcessed)) {
    throw new Error("llmProcessed must be one of: all, processed, not_processed")
  }

  return summarizeTransactions({
    clientId,
    search,
    accountIds,
    categoryIds,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode,
    amountSign,
    years,
    months,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    llmProcessed,
  })
}

export async function listTransactionPeriodOptionsService(query) {
  const clientId = String(query?.clientId || "").trim()
  if (!clientId) throw new Error("clientId is required")
  return listTransactionPeriodOptions(clientId)
}

export async function deleteTransactionsByIdsService(ids = []) {
  const targetIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : []

  if (targetIds.length === 0) {
    throw new Error("ids must be a non-empty array")
  }

  const result = await deleteTransactionsByIds(targetIds)
  return {
    deletedCount: Number(result?.deletedCount || 0),
  }
}

export async function deleteTransactionByIdService(id) {
  if (!id) throw new Error("id is required")
  return deleteTransactionById(id)
}

export async function categorizeTransactionsWithLlmService(input) {
  const clientId = String(input?.clientId || "").trim()
  const mode = String(input?.mode || "").trim().toLowerCase()
  const transactionIds = Array.isArray(input?.transactionIds)
    ? input.transactionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : []

  if (!clientId) throw new Error("clientId is required")
  if (!ObjectId.isValid(clientId)) throw new Error("clientId is invalid")
  if (!["selected", "all_client"].includes(mode)) {
    throw new Error("mode must be one of: selected, all_client")
  }
  if (mode === "selected") {
    if (transactionIds.length === 0) {
      throw new Error("transactionIds is required for selected mode")
    }
    if (transactionIds.some((id) => !ObjectId.isValid(id))) {
      throw new Error("transactionIds has invalid ObjectId values")
    }
  }

  const [client, categories] = await Promise.all([
    getClientById(clientId),
    listCategoriesByClientId(clientId),
  ])

  if (!client) throw new Error("client not found")
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("No categories available for this client")
  }

  const eligibleTransactions = mode === "selected"
    ? await listEligibleTransactionsForLlmByIds(clientId, transactionIds)
    : await listEligibleTransactionsForLlmByClientId(clientId)

  if (eligibleTransactions.length === 0) {
    return {
      mode,
      requestedCount: mode === "selected" ? transactionIds.length : 0,
      eligibleCount: 0,
      processedCount: 0,
      categorizedCount: 0,
      emptyCount: 0,
    }
  }

  const categoriesForLlm = categories.filter(
    (category) => !isZelleRelatedCategoryName(category?.name)
  )

  if (categoriesForLlm.length === 0) {
    throw new Error("No non-Zelle categories available for LLM")
  }

  const llmResults = await categorizeTransaction(
    categoriesForLlm.map((category) => ({
      id: String(category._id),
      name: category.name,
      type: category.type,
      description: category.description,
    })),
    eligibleTransactions.map((transaction) => ({
      id: String(transaction._id),
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
    })),
    {
      name: client.name || "",
      businessType: client.businessType || "",
      mainActivity: client.mainActivity || "",
      description: client.description || "",
    }
  )

  const categoryById = new Map(
    categories.map((category) => [String(category._id), category.name])
  )
  const now = new Date()

  const updates = llmResults.map((result) => {
    const confidence = Number(result?.confidence || 0)
    const ambiguous = Boolean(result?.ambiguous)
    const meetsConfidenceThreshold = confidence >= LLM_CONFIDENCE_THRESHOLD
    const categoryId = meetsConfidenceThreshold && !ambiguous
      ? normalizeObjectIdString(result?.categoryId)
      : null
    const categoryName = categoryId ? categoryById.get(categoryId) || null : null
    const isCategorized = Boolean(categoryId && categoryName)

    return {
      id: String(result.id),
      categoryId: isCategorized ? categoryId : null,
      category: isCategorized ? categoryName : null,
      llmStatus: isCategorized ? "suggested" : "empty",
      llmProcessedAt: now,
      llmCategorySuggestionId: isCategorized ? categoryId : null,
      llmCategorySuggestionName: isCategorized ? categoryName : null,
      llmConfidence: confidence,
      llmAmbiguous: ambiguous,
    }
  })

  const writeResult = await applyLlmCategorizationUpdates(updates)
  const categorizedCount = updates.filter((item) => item.llmStatus === "suggested").length
  const emptyCount = updates.filter((item) => item.llmStatus === "empty").length

  return {
    mode,
    requestedCount: mode === "selected" ? transactionIds.length : 0,
    eligibleCount: eligibleTransactions.length,
    processedCount: writeResult.modifiedCount,
    categorizedCount,
    emptyCount,
  }
}

export async function categorizeZelleTransactionsService(input) {
  const clientId = String(input?.clientId || "").trim()
  const mode = String(input?.mode || "").trim().toLowerCase()
  const transactionIds = Array.isArray(input?.transactionIds)
    ? input.transactionIds.map((id) => String(id || "").trim()).filter(Boolean)
    : []

  if (!clientId) throw new Error("clientId is required")
  if (!ObjectId.isValid(clientId)) throw new Error("clientId is invalid")
  if (!["selected", "all_client"].includes(mode)) {
    throw new Error("mode must be one of: selected, all_client")
  }
  if (mode === "selected") {
    if (transactionIds.length === 0) throw new Error("transactionIds is required for selected mode")
    if (transactionIds.some((id) => !ObjectId.isValid(id))) {
      throw new Error("transactionIds has invalid ObjectId values")
    }
  }

  const [client, categories] = await Promise.all([
    getClientById(clientId),
    listCategoriesByClientId(clientId),
  ])

  if (!client) throw new Error("client not found")

  const eligibleTransactions = mode === "selected"
    ? await listEligibleTransactionsForZelleByIds(clientId, transactionIds)
    : await listEligibleTransactionsForZelleByClientId(clientId)

  if (eligibleTransactions.length === 0) {
    return {
      mode,
      requestedCount: mode === "selected" ? transactionIds.length : 0,
      eligibleCount: 0,
      processedCount: 0,
      createdCategoriesCount: 0,
      ownerIncomeCount: 0,
      incomeZelleCount: 0,
      subCount: 0,
    }
  }

  const categoryByNameKey = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [
      normalizeNameKey(category.name),
      category,
    ])
  )
  const llmOutput = await categorizeZelle(
    eligibleTransactions.map((transaction) => ({
      id: String(transaction._id),
      description: transaction.description || "",
      amount: Number(transaction.amount || 0),
    })),
    {
      name: client.name || "",
      businessType: client.businessType || "",
      mainActivity: client.mainActivity || "",
      description: client.description || "",
      owners: Array.isArray(client?.owners) ? client.owners : [],
    }
  )

  const llmCategories = Array.isArray(llmOutput?.categories) ? llmOutput.categories : []
  const llmResults = Array.isArray(llmOutput?.results) ? llmOutput.results : []

  const categoriesToEnsure = new Map()
  llmCategories.forEach((item) => {
    const name = String(item?.name || "").trim()
    if (!name) return
    const key = normalizeNameKey(name)
    if (categoryByNameKey.has(key)) return
    categoriesToEnsure.set(key, {
      name,
      type: String(item?.type || "").trim().toLowerCase() === "expense" ? "expense" : "income",
    })
  })

  llmResults.forEach((item) => {
    const name = String(item?.categoryName || "").trim()
    if (!name) return
    const key = normalizeNameKey(name)
    if (!key || categoryByNameKey.has(key) || categoriesToEnsure.has(key)) return
    const normalizedName = name.toLowerCase()
    const inferredType = normalizedName.startsWith("sub -") ? "expense" : "income"
    categoriesToEnsure.set(key, {
      name,
      type: inferredType,
    })
  })

  for (const categoryPayload of categoriesToEnsure.values()) {
    const created = await createCategory({
      clientId,
      name: categoryPayload.name,
      type: categoryPayload.type,
      description: "",
    })
    categoryByNameKey.set(normalizeNameKey(created.name), created)
  }

  const resultByTxId = new Map(
    llmResults.map((item) => [String(item?.id || ""), String(item?.categoryName || "").trim()])
  )

  const classificationRows = eligibleTransactions
    .map((transaction) => {
      const txId = String(transaction._id)
      const categoryName = resultByTxId.get(txId) || ""
      const categoryNameKey = normalizeNameKey(categoryName)
      if (!categoryNameKey) return null
      return {
        id: txId,
        categoryName,
        categoryNameKey,
      }
    })
    .filter(Boolean)

  const now = new Date()

  const updates = classificationRows
    .map((row) => {
      const categoryDoc = categoryByNameKey.get(row.categoryNameKey)
      if (!categoryDoc?._id) return null
      return {
        id: row.id,
        categoryId: String(categoryDoc._id),
        category: categoryDoc.name,
        llmStatus: "suggested",
        llmProcessedAt: now,
        llmCategorySuggestionId: String(categoryDoc._id),
        llmCategorySuggestionName: categoryDoc.name,
      }
    })
    .filter(Boolean)

  const result = await applyLlmCategorizationUpdates(updates)
  const ownerIncomeCount = classificationRows.filter((row) =>
    String(row.categoryName || "").toLowerCase().startsWith("no service income -")
  ).length
  const incomeZelleCount = classificationRows.filter(
    (row) => String(row.categoryName || "").trim().toLowerCase() === "income zelle"
  ).length
  const subCount = classificationRows.filter((row) =>
    String(row.categoryName || "").toLowerCase().startsWith("sub -")
  ).length

  return {
    mode,
    requestedCount: mode === "selected" ? transactionIds.length : 0,
    eligibleCount: eligibleTransactions.length,
    processedCount: result.modifiedCount,
    createdCategoriesCount: categoriesToEnsure.size,
    ownerIncomeCount,
    incomeZelleCount,
    subCount,
  }
}

export async function categorizeAllTransactionsWithLlmService(input) {
  const zelle = await categorizeZelleTransactionsService(input)
  const llm = await categorizeTransactionsWithLlmService(input)

  return {
    mode: llm.mode || zelle.mode || String(input?.mode || "all_client"),
    requestedCount: Number(llm.requestedCount || zelle.requestedCount || 0),
    totalProcessedCount: Number(zelle.processedCount || 0) + Number(llm.processedCount || 0),
    zelle,
    llm,
  }
}
