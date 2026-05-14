import {
  insertTransactionsInBatches,
  updateTransactionById,
  updateTransactionsByIds,
  getTransactionById,
  listTransactionsByIds,
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
} from "../repositories/transactions.repository.js"
import { createCategory, listCategoriesByClientId, listCategoriesByIds } from "../repositories/category.repository.js"
import { getClientById } from "../repositories/clients.repository.js"
import {
  listTransactionMemoriesByKeys,
  bulkUpsertTransactionMemories,
  touchTransactionMemories,
  bulkRejectTransactionMemories,
} from "../repositories/transactionMemory.repository.js"
import { ObjectId } from "mongodb"
import categorizeTransaction from "../lib/ai/categorizeTransaction.js"
import categorizeZelle from "../lib/ai/categorizeZelle.js"
import {
  buildTransactionDerivedFields,
  buildTransactionSearchTerms,
  buildTransactionSearchText,
} from "../utils/transactionSearch.js"

const LLM_CONFIDENCE_THRESHOLD = 0.8
const LLM_MEMORY_CONFIDENCE_THRESHOLD = 0.9
const EXACT_LLM_MEMORY_MIN_OCCURRENCES = 1
const SEMANTIC_MEMORY_AUTO_CONFIDENCE_THRESHOLD = 0.95
const SEMANTIC_MEMORY_AUTO_SUPPORT_THRESHOLD = 5
const SEMANTIC_MEMORY_PROMOTION_CONFIDENCE_THRESHOLD = 0.95
const SEMANTIC_MEMORY_MIN_OCCURRENCES = 5
const LLM_INTRA_JOB_BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE || 20)

function runDetachedTask(task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error("[transactions.service] detached task failed", error)
    })
}

const DESCRIPTION_NOISE_TOKENS = new Set([
  "pos",
  "dbt",
  "debit",
  "credit",
  "card",
  "purchase",
  "auth",
  "ref",
  "trace",
  "visa",
  "mastercard",
  "mc",
  "amex",
  "discover",
  "online",
  "banking",
  "payment",
  "store",
  "transaction",
  "current",
  "services",
  "service",
  "used",
  "period",
  "during",
])

const MERCHANT_NOISE_TOKENS = new Set([
  ...DESCRIPTION_NOISE_TOKENS,
  "the",
  "to",
  "from",
  "for",
  "at",
  "on",
  "of",
  "and",
  "llc",
  "inc",
  "corp",
  "co",
  "company",
  "be",
  "fl",
  "ny",
  "nj",
  "ca",
  "tx",
  "ga",
  "nc",
  "sc",
  "wa",
  "ma",
  "il",
  "or",
  "ct",
  "pa",
  "va",
  "md",
  "oh",
  "mi",
  "in",
  "al",
  "az",
  "de",
  "ut",
  "nm",
  "co",
  "tn",
  "ky",
  "la",
  "ms",
  "mo",
  "wi",
  "mn",
  "ok",
  "ks",
  "ia",
  "id",
  "mt",
  "ne",
  "nv",
  "nh",
  "me",
  "ri",
  "vt",
  "wv",
  "ak",
  "hi",
])

const TWO_WORD_MERCHANT_SUFFIXES = new Set([
  "depot",
  "foods",
  "airlines",
  "america",
  "club",
])

function resolveZelleCategoryType(name = "", llmType = "") {
  const normalizedName = String(name || "").trim().toLowerCase()
  const normalizedType = String(llmType || "").trim().toLowerCase()

  if (normalizedName.startsWith("sub -")) return "cost_of_goods_sold"
  return normalizedType === "expense" ? "operating_expense" : "income"
}

function normalizeObjectIdString(value) {
  const raw = String(value || "").trim()
  if (!raw || !ObjectId.isValid(raw)) return null
  return new ObjectId(raw).toString()
}

function getDefaultUncategorizedLabelByAmount(amount = 0) {
  const numericAmount = Number(amount || 0)
  return numericAmount >= 0 ? "Uncategorized income" : "Uncategorized expenses"
}

function isAssignedCategoryValue(categoryId, categoryName) {
  const safeCategoryId = normalizeObjectIdString(categoryId)
  if (safeCategoryId) return true

  const safeCategoryName = String(categoryName || "").trim().toLowerCase()
  if (!safeCategoryName) return false

  return (
    safeCategoryName !== "uncategorized" &&
    safeCategoryName !== "uncategorized income" &&
    safeCategoryName !== "uncategorized expenses"
  )
}

function areSplitsCategorized(splits = []) {
  if (!Array.isArray(splits) || splits.length < 2) return false
  return splits.every((split) => isAssignedCategoryValue(split?.categoryId, split?.category))
}

function buildCategorizedFields(isCategorized, source, now = new Date()) {
  if (!isCategorized) {
    return {
      categorizedAt: null,
      categorizedSource: null,
    }
  }

  return {
    categorizedAt: now,
    categorizedSource: source,
  }
}

function buildTransactionSearchPatch(transaction = {}) {
  return {
    searchTerms: buildTransactionSearchTerms(transaction),
    searchText: buildTransactionSearchText(transaction),
    ...buildTransactionDerivedFields(transaction),
  }
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

function normalizeDescriptionForLlmGrouping(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !/[0-9]/.test(token))
    .filter((token) => !DESCRIPTION_NOISE_TOKENS.has(token))
    .join(" ")
    .trim()
}

function getTransactionDirectionKey(amount = 0) {
  return Number(amount || 0) >= 0 ? "positive" : "negative"
}

function detectTransactionChannel(description = "") {
  const source = String(description || "").toLowerCase()

  if (/(^|[^a-z])(zel|zelle)([^a-z]|$)/i.test(source)) return "zelle"
  if (/\bach\b/.test(source)) return "ach"
  if (/\b(check|chk)\b/.test(source)) return "check"
  if (/\b(fee|service charge|monthly maintenance|nsf|overdraft)\b/.test(source)) return "fee"
  if (/\b(wire|transfer|trf|xfer)\b/.test(source)) return "transfer"
  if (/\b(pos|dbt|debit|credit|card|visa|mastercard|mc|amex|discover)\b/.test(source)) return "card"

  return "unknown"
}

function normalizeMerchantCandidate(description = "") {
  const normalizedDescription = normalizeDescriptionForLlmGrouping(description)
  if (!normalizedDescription) return null

  const tokens = normalizedDescription
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !MERCHANT_NOISE_TOKENS.has(token))

  if (tokens.length === 0) return null

  if (tokens[0] === "seven" && tokens[1] === "eleven") {
    return "seven eleven"
  }

  if (tokens.length >= 2 && TWO_WORD_MERCHANT_SUFFIXES.has(tokens[1])) {
    return `${tokens[0]} ${tokens[1]}`
  }

  return tokens[0]
}

function buildTransactionIdentity(transaction = {}) {
  const accountId = normalizeObjectIdString(transaction.accountId)
  const direction = getTransactionDirectionKey(transaction.amount)
  const normalizedDescription = normalizeDescriptionForLlmGrouping(transaction.description || "")
  const channel = detectTransactionChannel(transaction.description || "")
  const merchantCandidate = normalizeMerchantCandidate(transaction.description || "")
  const accountKey = accountId || "no_account"
  const descriptionKey = normalizedDescription || `tx_${String(transaction?._id || transaction?.id || "").trim()}`

  return {
    accountId,
    direction,
    channel,
    normalizedDescription,
    merchantCandidate,
    exactFingerprint: `${accountKey}:${direction}:${channel}:${descriptionKey}`,
    semanticFingerprint: merchantCandidate
      ? `${accountKey}:${direction}:${channel}:${merchantCandidate}`
      : null,
  }
}

function groupTransactionsForLlm(transactions = []) {
  const groups = new Map()

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const identity = buildTransactionIdentity(transaction)
    const existing = groups.get(identity.exactFingerprint)

    if (!existing) {
      groups.set(identity.exactFingerprint, {
        exactFingerprint: identity.exactFingerprint,
        semanticFingerprint: identity.semanticFingerprint,
        normalizedDescription: identity.normalizedDescription,
        merchantCandidate: identity.merchantCandidate,
        channel: identity.channel,
        direction: identity.direction,
        accountId: identity.accountId,
        representativeId: String(transaction?._id || transaction?.id || ""),
        representativeDescription: String(transaction?.description || "").trim(),
        representativeAmount: Number(transaction?.amount || 0),
        members: [transaction],
      })
      continue
    }

    existing.members.push(transaction)

    const currentDescription = String(transaction?.description || "").trim()
    if (currentDescription.length > existing.representativeDescription.length) {
      existing.representativeId = String(transaction?._id || transaction?.id || "")
      existing.representativeDescription = currentDescription
      existing.representativeAmount = Number(transaction?.amount || 0)
    }
  }

  return Array.from(groups.values())
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

function hasReusableFingerprint(transaction = {}) {
  return Boolean(buildTransactionIdentity(transaction).normalizedDescription)
}

function normalizeCategoryIdsSeen(existingMemory = {}, categoryId = null) {
  const ids = new Set()

  for (const value of Array.isArray(existingMemory?.categoryIdsSeen) ? existingMemory.categoryIdsSeen : []) {
    const normalized = normalizeObjectIdString(value)
    if (normalized) ids.add(normalized)
  }

  const existingCategoryId = normalizeObjectIdString(existingMemory?.categoryId)
  if (existingCategoryId) ids.add(existingCategoryId)

  const currentCategoryId = normalizeObjectIdString(categoryId)
  if (currentCategoryId) ids.add(currentCategoryId)

  return Array.from(ids)
}

function hasMemoryConflict(existingMemory = {}, categoryId = null) {
  const existingCategoryId = normalizeObjectIdString(existingMemory?.categoryId)
  const currentCategoryId = normalizeObjectIdString(categoryId)

  return Boolean(existingCategoryId && currentCategoryId && existingCategoryId !== currentCategoryId)
}

function resolveMemoryReviewStatus(memoryType, source, supportCount, conflictCount) {
  if (memoryType === "semantic") {
    if (Number(conflictCount || 0) > 0) return "pending"
    if (String(source || "") === "human" && Number(supportCount || 0) < 2) return "pending"
  }

  return "confirmed"
}

function shouldAutoApplySemanticMemory(memory = {}) {
  if (!memory?.categoryId) return false

  const reviewStatus = String(memory?.reviewStatus || "").trim().toLowerCase()
  const conflictCount = Number(memory?.conflictCount || 0)
  const categoryIdsSeen = Array.isArray(memory?.categoryIdsSeen) ? memory.categoryIdsSeen.filter(Boolean) : []

  if (reviewStatus !== "confirmed") return false
  if (conflictCount > 0) return false
  if (categoryIdsSeen.length > 1) return false

  return (
    String(memory?.source || "") === "human" ||
    (
      String(memory?.source || "") === "llm" &&
      Number(memory?.confidence || 0) >= SEMANTIC_MEMORY_AUTO_CONFIDENCE_THRESHOLD &&
      Number(memory?.supportCount || 0) >= SEMANTIC_MEMORY_AUTO_SUPPORT_THRESHOLD
    )
  )
}

function shouldAutoApplyExactMemory(memory = {}) {
  if (!memory?.categoryId) return false
  return String(memory?.reviewStatus || "confirmed").trim().toLowerCase() === "confirmed"
}

function buildSemanticMemoryHint(memory = {}) {
  const categoryName = String(memory?.categoryName || "").trim()
  const merchantCandidate = String(memory?.merchantCandidate || "").trim()
  if (!categoryName) return null
  if (String(memory?.reviewStatus || "").trim().toLowerCase() === "rejected") return null

  const source = String(memory?.source || "").trim() || "history"
  const supportCount = Number(memory?.supportCount || 0)
  const reviewStatus = String(memory?.reviewStatus || "confirmed").trim()
  const conflictCount = Number(memory?.conflictCount || 0)
  const parts = []

  if (merchantCandidate) {
    parts.push(`merchant=${merchantCandidate}`)
  }

  parts.push(`prior=${categoryName}`)
  parts.push(`review=${reviewStatus}`)
  parts.push(`source=${source}`)
  parts.push(`support=${supportCount}`)
  if (conflictCount > 0) {
    parts.push(`conflicts=${conflictCount}`)
  }

  return parts.join(" | ")
}

function buildMemoryEntry(clientId, identity = {}, categoryId, categoryName, source, confidence, supportCount, memoryType, extra = {}) {
  const fingerprint = memoryType === "semantic"
    ? identity.semanticFingerprint
    : identity.exactFingerprint

  if (!fingerprint) return null

  return {
    clientId,
    memoryType,
    fingerprint,
    accountId: identity.accountId,
    direction: identity.direction,
    channel: identity.channel,
    normalizedDescription: identity.normalizedDescription,
    merchantCandidate: identity.merchantCandidate,
    exactFingerprint: identity.exactFingerprint,
    semanticFingerprint: identity.semanticFingerprint,
    categoryId,
    categoryName,
    source,
    confidence,
    supportCount,
    reviewStatus: extra.reviewStatus ?? "confirmed",
    conflictCount: Number(extra.conflictCount || 0),
    categoryIdsSeen: Array.isArray(extra.categoryIdsSeen) ? extra.categoryIdsSeen : [],
    lastConflictAt: extra.lastConflictAt ?? null,
    lastUsedAt: new Date(),
  }
}

function mergeTransactionWithPatch(transaction = {}, patch = {}) {
  const merged = {
    ...transaction,
    ...patch,
  }

  if (patch.accountId !== undefined) {
    merged.accountId = patch.accountId ?? null
  }

  if (patch.accountName !== undefined) {
    merged.accountName = patch.accountName ?? null
  }

  if (patch.categoryId !== undefined) {
    merged.categoryId = patch.categoryId ?? null
  }

  if (patch.category !== undefined) {
    merged.category = patch.category ?? null
  }

  if (patch.splits !== undefined) {
    merged.splits = Array.isArray(patch.splits) ? patch.splits : []
  }

  if (patch.isSplit !== undefined) {
    merged.isSplit = Boolean(patch.isSplit)
  }

  if (patch.llmProcessed !== undefined) {
    merged.llmProcessed = Boolean(patch.llmProcessed)
  }

  if (patch.llmStatus !== undefined) {
    merged.llmStatus = patch.llmStatus ?? null
  }

  if (patch.llmProcessedAt !== undefined) {
    merged.llmProcessedAt = patch.llmProcessedAt ?? null
  }

  if (patch.categorizedSource !== undefined) {
    merged.categorizedSource = patch.categorizedSource ?? null
  }

  return merged
}

function buildCategorizationUpdate(transactionId, categoryId, categoryName, now, extra = {}) {
  const isCategorized = Boolean(categoryId && categoryName)

  return {
    id: String(transactionId),
    categoryId: isCategorized ? categoryId : null,
    category: isCategorized ? categoryName : null,
    llmStatus: isCategorized ? "suggested" : "empty",
    llmProcessedAt: now,
    llmCategorySuggestionId: isCategorized ? categoryId : null,
    llmCategorySuggestionName: isCategorized ? categoryName : null,
    ...buildCategorizedFields(isCategorized, extra.categorizedSource || "ai", now),
    ...extra,
  }
}

function attachSearchAndDerivedFieldsToUpdates(updates = [], transactionsById = new Map()) {
  return (Array.isArray(updates) ? updates : []).map((update) => {
    const currentTransaction = transactionsById.get(String(update?.id || ""))
    if (!currentTransaction) return update

    const mergedTransaction = mergeTransactionWithPatch(currentTransaction, {
      categoryId: update?.categoryId,
      category: update?.category,
      llmProcessed: true,
      llmStatus: update?.llmStatus,
      llmProcessedAt: update?.llmProcessedAt,
      categorizedSource: update?.categorizedSource,
    })

    return {
      ...update,
      ...buildTransactionSearchPatch(mergedTransaction),
    }
  })
}

async function resolveCategoryDocsByIds(categoryIds = []) {
  const normalizedIds = [
    ...new Set(
      (Array.isArray(categoryIds) ? categoryIds : [])
        .map((id) => normalizeObjectIdString(id))
        .filter(Boolean)
    ),
  ]

  if (normalizedIds.length === 0) return new Map()

  const categories = await listCategoriesByIds(normalizedIds)
  return new Map(
    categories.map((category) => [String(category._id), category])
  )
}

async function upsertHumanMemoryEntries(transactions = [], categoryDocsById = new Map()) {
  const transactionsByClientId = new Map()

  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const clientId = String(transaction?.clientId || "").trim()
    const categoryId = normalizeObjectIdString(transaction?.categoryId)
    if (!clientId || !categoryId || !hasReusableFingerprint(transaction)) continue

    const list = transactionsByClientId.get(clientId) || []
    list.push(transaction)
    transactionsByClientId.set(clientId, list)
  }

  for (const [clientId, clientTransactions] of transactionsByClientId.entries()) {
    const exactFingerprints = [
      ...new Set(
        clientTransactions.map((transaction) => buildTransactionIdentity(transaction).exactFingerprint)
      ),
    ]
    const semanticFingerprints = [
      ...new Set(
        clientTransactions
          .map((transaction) => buildTransactionIdentity(transaction).semanticFingerprint)
          .filter(Boolean)
      ),
    ]

    const [existingExactMemories, existingSemanticMemories] = await Promise.all([
      listTransactionMemoriesByKeys(clientId, "exact", exactFingerprints),
      listTransactionMemoriesByKeys(clientId, "semantic", semanticFingerprints),
    ])
    const existingExactByFingerprint = new Map(
      existingExactMemories.map((memory) => [String(memory.fingerprint), memory])
    )
    const existingSemanticByFingerprint = new Map(
      existingSemanticMemories.map((memory) => [String(memory.fingerprint), memory])
    )

    const entries = clientTransactions
      .map((transaction) => {
        const categoryId = normalizeObjectIdString(transaction.categoryId)
        const categoryDoc = categoryDocsById.get(categoryId)
        if (!categoryId || !categoryDoc) return null

        const identity = buildTransactionIdentity(transaction)
        if (!identity.normalizedDescription) return null

        const exactExisting = existingExactByFingerprint.get(identity.exactFingerprint)
        const exactConflict = hasMemoryConflict(exactExisting, categoryId)
        const exactSupportCount = exactExisting?.source === "human" && String(exactExisting?.categoryId || "") === categoryId
          ? Number(exactExisting?.supportCount || 1) + 1
          : 1
        const exactEntry = buildMemoryEntry(
          clientId,
          identity,
          categoryId,
          categoryDoc.name,
          "human",
          1,
          exactSupportCount,
          "exact",
          {
            reviewStatus: resolveMemoryReviewStatus("exact", "human", exactSupportCount, exactConflict ? Number(exactExisting?.conflictCount || 0) + 1 : Number(exactExisting?.conflictCount || 0)),
            conflictCount: exactConflict ? Number(exactExisting?.conflictCount || 0) + 1 : Number(exactExisting?.conflictCount || 0),
            categoryIdsSeen: normalizeCategoryIdsSeen(exactExisting, categoryId),
            lastConflictAt: exactConflict ? new Date() : exactExisting?.lastConflictAt ?? null,
          }
        )

        const semanticExisting = identity.semanticFingerprint
          ? existingSemanticByFingerprint.get(identity.semanticFingerprint)
          : null
        const semanticConflict = hasMemoryConflict(semanticExisting, categoryId)
        const semanticSupportCount = semanticExisting?.source === "human" && String(semanticExisting?.categoryId || "") === categoryId
          ? Number(semanticExisting?.supportCount || 1) + 1
          : 1
        const semanticEntry = identity.semanticFingerprint
          ? buildMemoryEntry(
              clientId,
              identity,
              categoryId,
              categoryDoc.name,
              "human",
              1,
              semanticSupportCount,
              "semantic",
              {
                reviewStatus: resolveMemoryReviewStatus("semantic", "human", semanticSupportCount, semanticConflict ? Number(semanticExisting?.conflictCount || 0) + 1 : Number(semanticExisting?.conflictCount || 0)),
                conflictCount: semanticConflict ? Number(semanticExisting?.conflictCount || 0) + 1 : Number(semanticExisting?.conflictCount || 0),
                categoryIdsSeen: normalizeCategoryIdsSeen(semanticExisting, categoryId),
                lastConflictAt: semanticConflict ? new Date() : semanticExisting?.lastConflictAt ?? null,
              }
            )
          : null

        return [exactEntry, semanticEntry].filter(Boolean)
      })
      .filter(Boolean)
      .flat()

    if (entries.length === 0) continue
    await bulkUpsertTransactionMemories(entries)
  }
}

async function rejectMemoryEntriesForTransactions(transactions = []) {
  const entries = (Array.isArray(transactions) ? transactions : [])
    .flatMap((transaction) => {
      const clientId = String(transaction?.clientId || "").trim()
      if (!clientId || !hasReusableFingerprint(transaction)) return []

      const identity = buildTransactionIdentity(transaction)
      const rejectionEntries = [
        {
          clientId,
          memoryType: "exact",
          fingerprint: identity.exactFingerprint,
        },
      ]

      if (identity.semanticFingerprint) {
        rejectionEntries.push({
          clientId,
          memoryType: "semantic",
          fingerprint: identity.semanticFingerprint,
        })
      }

      return rejectionEntries
    })

  if (entries.length === 0) return
  await bulkRejectTransactionMemories(entries)
}

async function splitGroupsByMemory(clientId, transactionGroups = [], categoryById = new Map()) {
  const reusableGroups = transactionGroups.filter((group) => Boolean(group?.normalizedDescription))
  const exactFingerprints = [
    ...new Set(reusableGroups.map((group) => String(group.exactFingerprint || "").trim()).filter(Boolean)),
  ]
  const semanticFingerprints = [
    ...new Set(
      reusableGroups
        .map((group) => String(group.semanticFingerprint || "").trim())
        .filter(Boolean)
    ),
  ]

  const [exactMemories, semanticMemories] = await Promise.all([
    listTransactionMemoriesByKeys(clientId, "exact", exactFingerprints),
    listTransactionMemoriesByKeys(clientId, "semantic", semanticFingerprints),
  ])
  const exactMemoryByFingerprint = new Map(
    exactMemories.map((memory) => [String(memory.fingerprint), memory])
  )
  const semanticMemoryByFingerprint = new Map(
    semanticMemories.map((memory) => [String(memory.fingerprint), memory])
  )

  const now = new Date()
  const memoryUpdates = []
  const matchedExactFingerprints = []
  const matchedSemanticFingerprints = []
  const remainingGroups = []

  for (const group of transactionGroups) {
    const exactMemory = exactMemoryByFingerprint.get(String(group?.exactFingerprint || ""))
    const exactCategoryId = normalizeObjectIdString(exactMemory?.categoryId)
    const exactCategoryName = exactCategoryId
      ? categoryById.get(exactCategoryId) || String(exactMemory?.categoryName || "").trim() || null
      : null

    if (exactMemory && exactCategoryId && exactCategoryName && shouldAutoApplyExactMemory(exactMemory)) {
      matchedExactFingerprints.push(String(group.exactFingerprint))
      memoryUpdates.push(
        ...group.members.map((transaction) =>
          buildCategorizationUpdate(
            transaction._id,
            exactCategoryId,
            exactCategoryName,
            now,
            {
              categorizedSource: "memory",
              llmConfidence: exactMemory?.confidence ?? null,
              llmAmbiguous: false,
            }
          )
        )
      )
      continue
    }

    const semanticMemory = semanticMemoryByFingerprint.get(String(group?.semanticFingerprint || ""))
    const semanticCategoryId = normalizeObjectIdString(semanticMemory?.categoryId)
    const semanticCategoryName = semanticCategoryId
      ? categoryById.get(semanticCategoryId) || String(semanticMemory?.categoryName || "").trim() || null
      : null

    if (semanticMemory && semanticCategoryId && semanticCategoryName && shouldAutoApplySemanticMemory(semanticMemory)) {
      matchedSemanticFingerprints.push(String(group.semanticFingerprint))
      memoryUpdates.push(
        ...group.members.map((transaction) =>
          buildCategorizationUpdate(
            transaction._id,
            semanticCategoryId,
            semanticCategoryName,
            now,
            {
              categorizedSource: "memory",
              llmConfidence: semanticMemory?.confidence ?? null,
              llmAmbiguous: false,
            }
          )
        )
      )
      continue
    }

    remainingGroups.push({
      ...group,
      memoryHint: buildSemanticMemoryHint(semanticMemory),
    })
  }

  await Promise.all([
    matchedExactFingerprints.length > 0
      ? touchTransactionMemories(clientId, "exact", matchedExactFingerprints)
      : Promise.resolve(),
    matchedSemanticFingerprints.length > 0
      ? touchTransactionMemories(clientId, "semantic", matchedSemanticFingerprints)
      : Promise.resolve(),
  ])

  return {
    exactMemoryByFingerprint,
    semanticMemoryByFingerprint,
    memoryUpdates,
    remainingGroups,
  }
}

function buildLlmMemoryEntries(
  clientId,
  llmResults = [],
  groupByRepresentativeId = new Map(),
  categoryById = new Map(),
  exactMemoryByFingerprint = new Map(),
  semanticMemoryByFingerprint = new Map()
) {
  return llmResults
    .map((result) => {
      const group = groupByRepresentativeId.get(String(result?.id || ""))
      if (!group || !group.normalizedDescription) return null

      const identity = buildTransactionIdentity(group.members[0] || {})
      const categoryId = normalizeObjectIdString(result?.categoryId)
      const categoryName = categoryId ? categoryById.get(categoryId) || null : null
      const confidence = Number(result?.confidence || 0)
      const ambiguous = Boolean(result?.ambiguous)
      const existingExact = exactMemoryByFingerprint.get(String(group.exactFingerprint))
      const existingSemantic = identity.semanticFingerprint
        ? semanticMemoryByFingerprint.get(String(identity.semanticFingerprint))
        : null

      if (!categoryId || !categoryName) return null
      if (confidence < LLM_MEMORY_CONFIDENCE_THRESHOLD || ambiguous) return null
      if (group.members.length < EXACT_LLM_MEMORY_MIN_OCCURRENCES) return null
      if (existingExact?.source === "human") return null
      if (
        existingExact?.source === "llm" &&
        normalizeObjectIdString(existingExact?.categoryId) &&
        String(existingExact.categoryId) !== categoryId
      ) {
        return null
      }

      const exactEntry = buildMemoryEntry(
        clientId,
        identity,
        categoryId,
        categoryName,
        "llm",
        confidence,
        existingExact?.source === "llm" && String(existingExact?.categoryId || "") === categoryId
          ? Math.max(Number(existingExact?.supportCount || 1), group.members.length)
          : group.members.length,
        "exact",
        {
          reviewStatus: resolveMemoryReviewStatus(
            "exact",
            "llm",
            existingExact?.source === "llm" && String(existingExact?.categoryId || "") === categoryId
              ? Math.max(Number(existingExact?.supportCount || 1), group.members.length)
              : group.members.length,
            Number(existingExact?.conflictCount || 0)
          ),
          conflictCount: Number(existingExact?.conflictCount || 0),
          categoryIdsSeen: normalizeCategoryIdsSeen(existingExact, categoryId),
          lastConflictAt: existingExact?.lastConflictAt ?? null,
        }
      )

      const entries = [exactEntry]

      if (
        identity.semanticFingerprint &&
        confidence >= SEMANTIC_MEMORY_PROMOTION_CONFIDENCE_THRESHOLD &&
        group.members.length >= SEMANTIC_MEMORY_MIN_OCCURRENCES &&
        existingSemantic?.source !== "human" &&
        !(
          existingSemantic?.source === "llm" &&
          normalizeObjectIdString(existingSemantic?.categoryId) &&
          String(existingSemantic.categoryId) !== categoryId
        )
      ) {
        entries.push(
          buildMemoryEntry(
            clientId,
            identity,
            categoryId,
            categoryName,
            "llm",
            confidence,
            existingSemantic?.source === "llm" && String(existingSemantic?.categoryId || "") === categoryId
              ? Math.max(Number(existingSemantic?.supportCount || 1), group.members.length)
              : group.members.length,
            "semantic",
            {
              reviewStatus: resolveMemoryReviewStatus(
                "semantic",
                "llm",
                existingSemantic?.source === "llm" && String(existingSemantic?.categoryId || "") === categoryId
                  ? Math.max(Number(existingSemantic?.supportCount || 1), group.members.length)
                  : group.members.length,
                Number(existingSemantic?.conflictCount || 0)
              ),
              conflictCount: Number(existingSemantic?.conflictCount || 0),
              categoryIdsSeen: normalizeCategoryIdsSeen(existingSemantic, categoryId),
              lastConflictAt: existingSemantic?.lastConflictAt ?? null,
            }
          )
        )
      }

      return entries
    })
    .filter(Boolean)
    .flat()
}

function buildZelleMemoryEntries(
  clientId,
  zelleResults = [],
  groupByRepresentativeId = new Map(),
  categoryByNameKey = new Map(),
  exactMemoryByFingerprint = new Map(),
  semanticMemoryByFingerprint = new Map()
) {
  return zelleResults
    .map((result) => {
      const group = groupByRepresentativeId.get(String(result?.id || ""))
      if (!group || !group.normalizedDescription) return null

      const identity = buildTransactionIdentity(group.members[0] || {})
      const categoryNameKey = normalizeNameKey(result?.categoryName)
      const categoryDoc = categoryByNameKey.get(categoryNameKey)
      const categoryId = normalizeObjectIdString(categoryDoc?._id)
      const categoryName = String(categoryDoc?.name || "").trim() || null
      const confidence = Number(result?.confidence || 0)
      const ambiguous = Boolean(result?.ambiguous)
      const existingExact = exactMemoryByFingerprint.get(String(group.exactFingerprint))
      const existingSemantic = identity.semanticFingerprint
        ? semanticMemoryByFingerprint.get(String(identity.semanticFingerprint))
        : null

      if (!categoryId || !categoryName) return null
      if (confidence < LLM_MEMORY_CONFIDENCE_THRESHOLD || ambiguous) return null
      if (group.members.length < EXACT_LLM_MEMORY_MIN_OCCURRENCES) return null
      if (existingExact?.source === "human") return null
      if (
        existingExact?.source === "llm" &&
        normalizeObjectIdString(existingExact?.categoryId) &&
        String(existingExact.categoryId) !== categoryId
      ) {
        return null
      }

      const exactSupportCount =
        existingExact?.source === "llm" && String(existingExact?.categoryId || "") === categoryId
          ? Math.max(Number(existingExact?.supportCount || 1), group.members.length)
          : group.members.length

      const exactEntry = buildMemoryEntry(
        clientId,
        identity,
        categoryId,
        categoryName,
        "llm",
        confidence,
        exactSupportCount,
        "exact",
        {
          reviewStatus: resolveMemoryReviewStatus(
            "exact",
            "llm",
            exactSupportCount,
            Number(existingExact?.conflictCount || 0)
          ),
          conflictCount: Number(existingExact?.conflictCount || 0),
          categoryIdsSeen: normalizeCategoryIdsSeen(existingExact, categoryId),
          lastConflictAt: existingExact?.lastConflictAt ?? null,
        }
      )

      const entries = [exactEntry]

      if (
        identity.semanticFingerprint &&
        confidence >= SEMANTIC_MEMORY_PROMOTION_CONFIDENCE_THRESHOLD &&
        group.members.length >= SEMANTIC_MEMORY_MIN_OCCURRENCES &&
        existingSemantic?.source !== "human" &&
        !(
          existingSemantic?.source === "llm" &&
          normalizeObjectIdString(existingSemantic?.categoryId) &&
          String(existingSemantic.categoryId) !== categoryId
        )
      ) {
        const semanticSupportCount =
          existingSemantic?.source === "llm" && String(existingSemantic?.categoryId || "") === categoryId
            ? Math.max(Number(existingSemantic?.supportCount || 1), group.members.length)
            : group.members.length

        entries.push(
          buildMemoryEntry(
            clientId,
            identity,
            categoryId,
            categoryName,
            "llm",
            confidence,
            semanticSupportCount,
            "semantic",
            {
              reviewStatus: resolveMemoryReviewStatus(
                "semantic",
                "llm",
                semanticSupportCount,
                Number(existingSemantic?.conflictCount || 0)
              ),
              conflictCount: Number(existingSemantic?.conflictCount || 0),
              categoryIdsSeen: normalizeCategoryIdsSeen(existingSemantic, categoryId),
              lastConflictAt: existingSemantic?.lastConflictAt ?? null,
            }
          )
        )
      }

      return entries
    })
    .filter(Boolean)
    .flat()
}

function buildRegularCategorizationUpdatesFromResults(
  llmResults = [],
  groupByRepresentativeId = new Map(),
  categoryById = new Map(),
  now = new Date()
) {
  return llmResults.flatMap((result) => {
    const group = groupByRepresentativeId.get(String(result?.id || ""))
    if (!group) return []

    const confidence = Number(result?.confidence || 0)
    const ambiguous = Boolean(result?.ambiguous)
    const meetsConfidenceThreshold = confidence >= LLM_CONFIDENCE_THRESHOLD
    const categoryId = meetsConfidenceThreshold && !ambiguous
      ? normalizeObjectIdString(result?.categoryId)
      : null
    const categoryName = categoryId ? categoryById.get(categoryId) || null : null

    return group.members.map((transaction) =>
      buildCategorizationUpdate(
        transaction._id,
        categoryId,
        categoryName,
        now,
        {
          llmConfidence: confidence,
          llmAmbiguous: ambiguous,
        }
      )
    )
  })
}

function buildZelleCategorizationUpdatesFromResults(
  llmResults = [],
  groupByRepresentativeId = new Map(),
  categoryByNameKey = new Map(),
  now = new Date()
) {
  return llmResults
    .flatMap((result) => {
      const group = groupByRepresentativeId.get(String(result?.id || ""))
      if (!group) return []

      const categoryNameKey = normalizeNameKey(result?.categoryName)
      const categoryDoc = categoryByNameKey.get(categoryNameKey)
      if (!categoryDoc?._id) return []

      return group.members.map((transaction) =>
        buildCategorizationUpdate(
          transaction._id,
          String(categoryDoc._id),
          categoryDoc.name,
          now,
          {
            llmConfidence: Number(result?.confidence || 0),
            llmAmbiguous: Boolean(result?.ambiguous),
          }
        )
      )
    })
    .filter(Boolean)
}

export async function createTransactionsBatchService(transactions, context = {}) {
  if (!Array.isArray(transactions)) {
    throw new Error("transactions must be an array")
  }

  if (transactions.length === 0) {
    throw new Error("transactions cannot be empty")
  }

  const createdBy = String(context?.actorProfileId || "")

  const normalizedTransactions = transactions.map((transaction) => {
    const amount = Number(transaction?.amount || 0)
    const hasCategoryId = transaction?.categoryId !== undefined && transaction?.categoryId !== null && transaction?.categoryId !== ""
    const hasCategoryName = Boolean(String(transaction?.category || "").trim())
    const isCategorized = isAssignedCategoryValue(transaction?.categoryId, transaction?.category)

    if (hasCategoryId || hasCategoryName) {
      const normalizedTransaction = {
        ...transaction,
        ...buildCategorizedFields(isCategorized, transaction?.categorizedSource || "import"),
      }
      return {
        ...normalizedTransaction,
        ...buildTransactionSearchPatch(normalizedTransaction),
      }
    }

    const normalizedTransaction = {
      ...transaction,
      categoryId: null,
      category: getDefaultUncategorizedLabelByAmount(amount),
      categorizedAt: null,
      categorizedSource: null,
    }
    return {
      ...normalizedTransaction,
      ...buildTransactionSearchPatch(normalizedTransaction),
    }
  })

  return insertTransactionsInBatches(normalizedTransactions, { createdBy })
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
    if (patch.splits == null || (Array.isArray(patch.splits) && patch.splits.length === 0)) {
      if (patch.isSplit !== false) {
        throw new Error("splits must have at least 2 items")
      }

      const parentAmount = Number(
        typeof safePatch.amount === "number" ? safePatch.amount : currentTransaction.amount
      )

      safePatch.splits = []
      safePatch.isSplit = false
      safePatch.categoryId = null
      safePatch.category = getDefaultUncategorizedLabelByAmount(parentAmount)
      Object.assign(safePatch, buildCategorizedFields(false))
    } else {
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
      Object.assign(
        safePatch,
        buildCategorizedFields(areSplitsCategorized(normalizedSplits), "manual")
      )
    }
  }

  const isCurrentSplit =
    Boolean(currentTransaction?.isSplit) ||
    (Array.isArray(currentTransaction?.splits) && currentTransaction.splits.length > 1)
  const isTryingToChangeParentCategory =
    safePatch.category !== undefined || safePatch.categoryId !== undefined

  if (isCurrentSplit && patch.splits === undefined && isTryingToChangeParentCategory) {
    throw new Error("cannot update parent category for split transaction")
  }

  if (patch.splits === undefined && isTryingToChangeParentCategory) {
    const isCategorized = isAssignedCategoryValue(safePatch.categoryId, safePatch.category)
    Object.assign(safePatch, buildCategorizedFields(isCategorized, "manual"))
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("no valid fields to update")
  }

  const mergedTransactionForSearch = mergeTransactionWithPatch(currentTransaction, safePatch)
  Object.assign(safePatch, buildTransactionSearchPatch(mergedTransactionForSearch))

  const updatedTransaction = await updateTransactionById(id, safePatch)

  const isHumanCategoryChange =
    safePatch.categoryId !== undefined &&
    normalizeObjectIdString(safePatch.categoryId)
  const isHumanCategoryRemoval =
    safePatch.categoryId !== undefined &&
    !normalizeObjectIdString(safePatch.categoryId)

  if (isHumanCategoryChange) {
    runDetachedTask(async () => {
      const categoryDocsById = await resolveCategoryDocsByIds([safePatch.categoryId])
      await upsertHumanMemoryEntries([updatedTransaction], categoryDocsById)
    })
  }

  if (isHumanCategoryRemoval) {
    runDetachedTask(() => rejectMemoryEntriesForTransactions([updatedTransaction]))
  }

  return updatedTransaction
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
    const mergedPatch = {
      ...existing,
      ...safePatch,
    }

    if (
      Object.prototype.hasOwnProperty.call(safePatch, "categoryId") ||
      Object.prototype.hasOwnProperty.call(safePatch, "category")
    ) {
      const isCategorized = isAssignedCategoryValue(mergedPatch.categoryId, mergedPatch.category)
      Object.assign(mergedPatch, buildCategorizedFields(isCategorized, "manual"))
    }

    mergedById.set(id, mergedPatch)
  })

  const normalizedUpdates = Array.from(mergedById.entries()).map(([id, patch]) => ({
    id,
    patch,
  }))

  const currentTransactions = await listTransactionsByIds(normalizedUpdates.map((item) => item.id))
  const currentTransactionById = new Map(
    currentTransactions.map((transaction) => [String(transaction._id), transaction])
  )

  normalizedUpdates.forEach((item) => {
    const currentTransaction = currentTransactionById.get(String(item.id))
    if (!currentTransaction) return

    const mergedTransaction = mergeTransactionWithPatch(currentTransaction, item.patch)
    Object.assign(item.patch, buildTransactionSearchPatch(mergedTransaction))
  })

  const result = await updateTransactionsByIds(normalizedUpdates)

  const memoryCategoryIds = [
    ...new Set(
      normalizedUpdates
        .map((item) => item.patch?.categoryId)
        .map((categoryId) => normalizeObjectIdString(categoryId))
        .filter(Boolean)
    ),
  ]

  if (memoryCategoryIds.length > 0) {
    runDetachedTask(async () => {
      const categoryDocsById = await resolveCategoryDocsByIds(memoryCategoryIds)
      const updatedTransactionsForMemory = normalizedUpdates
        .map((item) => {
          const currentTransaction = currentTransactionById.get(String(item.id))
          if (!currentTransaction) return null

          const categoryId = normalizeObjectIdString(item.patch?.categoryId)
          if (!categoryId) return null

          return mergeTransactionWithPatch(currentTransaction, {
            ...item.patch,
            categoryId,
            category: categoryDocsById.get(categoryId)?.name || item.patch?.category || null,
          })
        })
        .filter(Boolean)

      await upsertHumanMemoryEntries(updatedTransactionsForMemory, categoryDocsById)
    })
  }

  const removedCategoryTransactions = normalizedUpdates
    .filter((item) => item.patch?.categoryId === null)
    .map((item) => currentTransactionById.get(String(item.id)))
    .filter(Boolean)

  if (removedCategoryTransactions.length > 0) {
    runDetachedTask(() => rejectMemoryEntriesForTransactions(removedCategoryTransactions))
  }

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
  const paginationMode = String(query?.paginationMode || "page").trim().toLowerCase()
  const cursor = String(query?.cursor || "").trim()
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
  const iconType = String(query?.iconType || "all").trim().toLowerCase()
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
  if (!["all", "ai", "memory", "none"].includes(iconType)) {
    throw new Error("iconType must be one of: all, ai, memory, none")
  }

  const result = await listTransactionsPaginated({
    clientId,
    page,
    limit,
    paginationMode,
    cursor,
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
    iconType,
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
  const iconType = String(query?.iconType || "all").trim().toLowerCase()
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
  if (!["all", "ai", "memory", "none"].includes(iconType)) {
    throw new Error("iconType must be one of: all, ai, memory, none")
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
    iconType,
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

  const transactionGroups = groupTransactionsForLlm(eligibleTransactions)

  const categoryById = new Map(
    categories.map((category) => [String(category._id), category.name])
  )
  const {
    exactMemoryByFingerprint,
    semanticMemoryByFingerprint,
    memoryUpdates,
    remainingGroups,
  } = await splitGroupsByMemory(clientId, transactionGroups, categoryById)
  let currentExactMemoryByFingerprint = exactMemoryByFingerprint
  let currentSemanticMemoryByFingerprint = semanticMemoryByFingerprint
  let pendingGroups = [...remainingGroups]
  const remainingResults = []
  const updates = [...memoryUpdates]

  while (pendingGroups.length > 0) {
    const currentBatchGroups = pendingGroups.slice(0, LLM_INTRA_JOB_BATCH_SIZE)
    const batchResults = await categorizeTransaction(
      categoriesForLlm.map((category) => ({
        id: String(category._id),
        name: category.name,
        type: category.type,
        description: category.description,
      })),
      currentBatchGroups.map((group) => ({
        id: group.representativeId,
        description: group.representativeDescription,
        amount: group.representativeAmount,
        memoryHint: group.memoryHint || null,
      })),
      {
        name: client.name || "",
        businessType: client.businessType || "",
        mainActivity: client.mainActivity || "",
        description: client.description || "",
      },
      {
        batchSize: LLM_INTRA_JOB_BATCH_SIZE,
      }
    )

    remainingResults.push(...batchResults)

    const batchGroupByRepresentativeId = new Map(
      currentBatchGroups.map((group) => [group.representativeId, group])
    )

    updates.push(
      ...buildRegularCategorizationUpdatesFromResults(
        batchResults,
        batchGroupByRepresentativeId,
        categoryById,
        new Date()
      )
    )

    const batchMemoryEntries = buildLlmMemoryEntries(
      clientId,
      batchResults,
      batchGroupByRepresentativeId,
      categoryById,
      currentExactMemoryByFingerprint,
      currentSemanticMemoryByFingerprint
    )

    if (batchMemoryEntries.length > 0) {
      await bulkUpsertTransactionMemories(batchMemoryEntries)
    }

    const remainingAfterBatch = pendingGroups.slice(currentBatchGroups.length)
    if (remainingAfterBatch.length === 0) break

    if (batchMemoryEntries.length > 0) {
      const nextWave = await splitGroupsByMemory(clientId, remainingAfterBatch, categoryById)
      currentExactMemoryByFingerprint = nextWave.exactMemoryByFingerprint
      currentSemanticMemoryByFingerprint = nextWave.semanticMemoryByFingerprint
      updates.push(...nextWave.memoryUpdates)
      pendingGroups = nextWave.remainingGroups
    } else {
      pendingGroups = remainingAfterBatch
    }
  }

  const eligibleTransactionById = new Map(
    eligibleTransactions.map((transaction) => [String(transaction._id), transaction])
  )
  const preparedUpdates = attachSearchAndDerivedFieldsToUpdates(updates, eligibleTransactionById)

  const writeResult = await applyLlmCategorizationUpdates(preparedUpdates)

  const categorizedCount = preparedUpdates.filter((item) => item.llmStatus === "suggested").length
  const emptyCount = preparedUpdates.filter((item) => item.llmStatus === "empty").length

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
  const categoryById = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [String(category._id), category.name])
  )
  const transactionGroups = groupTransactionsForLlm(eligibleTransactions)
  const {
    exactMemoryByFingerprint,
    semanticMemoryByFingerprint,
    memoryUpdates,
    remainingGroups,
  } = await splitGroupsByMemory(
    clientId,
    transactionGroups,
    categoryById
  )
  let currentExactMemoryByFingerprint = exactMemoryByFingerprint
  let currentSemanticMemoryByFingerprint = semanticMemoryByFingerprint
  let pendingGroups = [...remainingGroups]
  const llmResults = []
  const updates = [...memoryUpdates]
  let createdCategoriesCount = 0

  while (pendingGroups.length > 0) {
    const currentBatchGroups = pendingGroups.slice(0, LLM_INTRA_JOB_BATCH_SIZE)
    const llmOutput = await categorizeZelle(
      currentBatchGroups.map((group) => ({
        id: group.representativeId,
        description: group.representativeDescription || "",
        amount: Number(group.representativeAmount || 0),
      })),
      {
        name: client.name || "",
        businessType: client.businessType || "",
        mainActivity: client.mainActivity || "",
        description: client.description || "",
        owners: Array.isArray(client?.owners) ? client.owners : [],
      },
      {
        batchSize: LLM_INTRA_JOB_BATCH_SIZE,
      }
    )

    const batchCategories = Array.isArray(llmOutput?.categories) ? llmOutput.categories : []
    const batchResults = Array.isArray(llmOutput?.results) ? llmOutput.results : []
    llmResults.push(...batchResults)

    const categoriesToEnsure = new Map()
    batchCategories.forEach((item) => {
      const name = String(item?.name || "").trim()
      if (!name) return
      const key = normalizeNameKey(name)
      if (categoryByNameKey.has(key)) return
      categoriesToEnsure.set(key, {
        name,
        type: resolveZelleCategoryType(name, item?.type),
      })
    })

    batchResults.forEach((item) => {
      const name = String(item?.categoryName || "").trim()
      if (!name) return
      const key = normalizeNameKey(name)
      if (!key || categoryByNameKey.has(key) || categoriesToEnsure.has(key)) return
      categoriesToEnsure.set(key, {
        name,
        type: resolveZelleCategoryType(name, ""),
      })
    })

    for (const categoryPayload of categoriesToEnsure.values()) {
      const created = await createCategory({
        clientId,
        name: categoryPayload.name,
        type: categoryPayload.type,
        description: "",
      })
      createdCategoriesCount += 1
      categoryByNameKey.set(normalizeNameKey(created.name), created)
      categoryById.set(String(created._id), created.name)
    }

    const batchGroupByRepresentativeId = new Map(
      currentBatchGroups.map((group) => [group.representativeId, group])
    )

    updates.push(
      ...buildZelleCategorizationUpdatesFromResults(
        batchResults,
        batchGroupByRepresentativeId,
        categoryByNameKey,
        new Date()
      )
    )

    const batchMemoryEntries = buildZelleMemoryEntries(
      clientId,
      batchResults,
      batchGroupByRepresentativeId,
      categoryByNameKey,
      currentExactMemoryByFingerprint,
      currentSemanticMemoryByFingerprint
    )

    if (batchMemoryEntries.length > 0) {
      await bulkUpsertTransactionMemories(batchMemoryEntries)
    }

    const remainingAfterBatch = pendingGroups.slice(currentBatchGroups.length)
    if (remainingAfterBatch.length === 0) break

    if (batchMemoryEntries.length > 0) {
      const nextWave = await splitGroupsByMemory(clientId, remainingAfterBatch, categoryById)
      currentExactMemoryByFingerprint = nextWave.exactMemoryByFingerprint
      currentSemanticMemoryByFingerprint = nextWave.semanticMemoryByFingerprint
      updates.push(...nextWave.memoryUpdates)
      pendingGroups = nextWave.remainingGroups
    } else {
      pendingGroups = remainingAfterBatch
    }
  }

  const eligibleTransactionById = new Map(
    eligibleTransactions.map((transaction) => [String(transaction._id), transaction])
  )
  const preparedUpdates = attachSearchAndDerivedFieldsToUpdates(updates, eligibleTransactionById)

  const result = await applyLlmCategorizationUpdates(preparedUpdates)
  const categorizedNames = preparedUpdates.map((item) => String(item.category || "").trim()).filter(Boolean)
  const ownerIncomeCount = categorizedNames.filter((name) =>
    String(name || "").toLowerCase().startsWith("no service income -")
  ).length
  const incomeZelleCount = categorizedNames.filter(
    (name) => String(name || "").trim().toLowerCase() === "income zelle"
  ).length
  const subCount = categorizedNames.filter((name) =>
    String(name || "").toLowerCase().startsWith("sub -")
  ).length

  return {
    mode,
    requestedCount: mode === "selected" ? transactionIds.length : 0,
    eligibleCount: eligibleTransactions.length,
    processedCount: result.modifiedCount,
    createdCategoriesCount,
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
