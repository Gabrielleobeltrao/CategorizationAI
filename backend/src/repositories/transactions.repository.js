import { ObjectId } from "mongodb"
import { getDB } from "../db.js"
import {
  buildTransactionDerivedFields,
  buildTransactionSearchQuery,
  buildTransactionSearchTerms,
  buildTransactionSearchText,
} from "../utils/transactionSearch.js"
import { validateTransactionLegs } from "../config/transactionLegs.js"
import { getOrCreateSuspenseAccountId, entryHasClearedLegs } from "./journalEntries.repository.js"

const BATCH_SIZE = 1000
const ATLAS_SEARCH_INDEX_NAME = String(process.env.MONGODB_ATLAS_SEARCH_INDEX_NAME || "transactions_autocomplete").trim()
const ATLAS_SEARCH_ENABLED = String(process.env.MONGODB_ATLAS_SEARCH_ENABLED || "true").trim().toLowerCase() !== "false"
const TRANSACTIONS_SEARCH_ENGINE = String(process.env.TRANSACTIONS_SEARCH_ENGINE || "mongo").trim().toLowerCase()
const ATLAS_SEARCH_QUERY_TIMEOUT_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_QUERY_TIMEOUT_MS || 2000))
const ATLAS_SEARCH_COOLDOWN_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_COOLDOWN_MS || 120000))
const TRANSACTIONS_BACKFILL_BATCH_SIZE = Math.max(100, Number(process.env.TRANSACTIONS_BACKFILL_BATCH_SIZE || 500))
const TRANSACTIONS_QUERY_DEBUG = String(process.env.TRANSACTIONS_QUERY_DEBUG || "false").trim().toLowerCase() === "true"
// Matches transaction descriptions that contain "zel" or "zelle" as a
// standalone token. Used to route those rows through the Zelle-specific
// LLM categorizer instead of the generic one. The constant was dropped
// by the Atlas Search refactor (a818bfc) while still being referenced
// from listEligibleTransactionsFor* — restoring it.
const ZELLE_DESCRIPTION_REGEX = /(^|[^a-z])(zel|zelle)([^a-z]|$)/i

// === Double-entry adapter ===
// Translates journal_entries (canonical storage post-migration) into the
// legacy transaction shape that the old LedgerPage UI expects. Two-leg
// entries become a single transaction with accountId+categoryId+amount;
// 3+ leg entries become a split (one bank-side leg, N category splits).
async function _loadAccountsForLegs(db, entries) {
  const ids = new Set()
  for (const entry of entries) {
    for (const leg of entry.legs || []) ids.add(String(leg.accountId))
  }
  if (ids.size === 0) return new Map()
  const objectIds = [...ids].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  const accounts = await db.collection("coa_accounts").find({ _id: { $in: objectIds } }).toArray()
  return new Map(accounts.map((a) => [String(a._id), a]))
}

function _isBankLikeType(type) {
  return type === "asset_current" || type === "asset_noncurrent" ||
    type === "liability_current" || type === "liability_noncurrent"
}

function _journalEntryToTransaction(entry, accountsById) {
  const legs = entry.legs || []
  // Pick the leg landing on a bank/credit-card style account as the
  // "primary" — that's what the UI shows in the Account column.
  const bankLeg = legs.find((leg) => {
    const acc = accountsById.get(String(leg.accountId))
    return _isBankLikeType(acc?.accountType)
  }) || legs[0]
  const otherLegs = legs.filter((leg) => leg !== bankLeg)
  const bankAccount = accountsById.get(String(bankLeg?.accountId))

  const isSplit = otherLegs.length > 1
  const contraLeg = isSplit ? null : otherLegs[0]
  const contraAccount = contraLeg ? accountsById.get(String(contraLeg.accountId)) : null
  const contraIsSuspense = Boolean(contraAccount?.isSuspense)

  // Bank perspective: +money_in / -money_out.
  const amount = bankLeg
    ? Number(bankLeg.debit || 0) - Number(bankLeg.credit || 0)
    : 0

  const splits = isSplit
    ? otherLegs.map((leg) => {
        const acc = accountsById.get(String(leg.accountId))
        const isSuspense = Boolean(acc?.isSuspense)
        // Flip the sign so splits reflect bank-perspective amount.
        const splitAmount = -(Number(leg.debit || 0) - Number(leg.credit || 0))
        return {
          amount: splitAmount,
          categoryId: isSuspense ? null : String(leg.accountId),
          category: isSuspense ? null : acc?.name || "",
        }
      })
    : []

  return {
    _id: entry._id,
    clientId: entry.clientId,
    accountId: String(bankLeg?.accountId || ""),
    accountName: bankAccount?.name || "",
    date: entry.date,
    description: entry.description || "",
    amount,
    categoryId: !isSplit && contraAccount && !contraIsSuspense ? String(contraLeg.accountId) : null,
    category: !isSplit && contraAccount && !contraIsSuspense ? contraAccount.name : null,
    isSplit,
    hasSplit: isSplit,
    splits,
    llmProcessed: Boolean(entry.llmProcessed),
    llmStatus: entry.llmStatus || "none",
    llmProcessedAt: entry.llmProcessedAt || null,
    llmConfidence: entry.llmConfidence ?? null,
    llmAmbiguous: Boolean(entry.llmAmbiguous),
    llmCategorySuggestionId: entry.llmCategorySuggestionId || null,
    llmCategorySuggestionName: entry.llmCategorySuggestionName || null,
    categorizedAt: entry.categorizedAt || null,
    categorizedSource: entry.categorizedSource || entry.source || "manual",
    searchText: `${entry.description || ""} ${bankAccount?.name || ""}`.toLowerCase(),
    iconType: entry.iconType || "manual",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

// === Inverse adapter: legacy patch → journal_entries legs ===
// The frontend speaks the old shape (accountId+categoryId+amount+splits).
// To persist edits we have to rebuild legs that net to zero. Convention:
//   - Bank leg signed = patch.amount (positive=debit/money-in, negative=credit/money-out)
//   - For a single category: contra leg gets the opposite side for the same |amount|
//   - For splits: each split.amount uses bank-perspective sign, so the contra
//     side flips it (split>0 → credit on category, split<0 → debit on category)
//   - Uncategorized → contra leg points to the per-client suspense account
function _buildLegsFromLegacyShape({ bankAccountId, amount, categoryId, splits, suspenseId, description = "" }) {
  const bankId = String(bankAccountId || "")
  if (!bankId) throw new TypeError("bankAccountId is required")

  const safeSplits = Array.isArray(splits)
    ? splits
        .map((s) => ({
          categoryId: s?.categoryId ? String(s.categoryId) : null,
          amount: Number(s?.amount || 0),
          description: typeof s?.description === "string" ? s.description : "",
        }))
        .filter((s) => Number.isFinite(s.amount) && s.amount !== 0)
    : []

  if (safeSplits.length >= 2) {
    const total = safeSplits.reduce((acc, s) => acc + s.amount, 0)
    const bankDebit = total > 0 ? Math.abs(total) : 0
    const bankCredit = total < 0 ? Math.abs(total) : 0
    const legs = [
      { accountId: bankId, debit: bankDebit, credit: bankCredit, description },
    ]
    for (const split of safeSplits) {
      const contraId = split.categoryId || suspenseId
      if (!contraId) throw new TypeError("split categoryId or suspense fallback required")
      // Flip the sign: bank-perspective +X → credit on contra; -X → debit on contra
      const debit = split.amount < 0 ? Math.abs(split.amount) : 0
      const credit = split.amount > 0 ? Math.abs(split.amount) : 0
      legs.push({ accountId: String(contraId), debit, credit, description: split.description })
    }
    return legs
  }

  // Non-split: 2 legs only
  const signed = Number(amount || 0)
  if (!Number.isFinite(signed) || signed === 0) {
    throw new TypeError("amount must be a non-zero number")
  }
  const magnitude = Math.abs(signed)
  const contraId = categoryId ? String(categoryId) : suspenseId
  if (!contraId) throw new TypeError("categoryId or suspense fallback required")
  const moneyIn = signed > 0
  return [
    {
      accountId: bankId,
      debit: moneyIn ? magnitude : 0,
      credit: moneyIn ? 0 : magnitude,
      description,
    },
    {
      accountId: String(contraId),
      debit: moneyIn ? 0 : magnitude,
      credit: moneyIn ? magnitude : 0,
      description: "",
    },
  ]
}

// Read entry+accounts → return both the legacy view and the parsed pieces
// needed by writers (bank leg, suspense state, etc.).
async function _loadEntryAsLegacy(db, id) {
  if (!ObjectId.isValid(String(id))) return null
  const entry = await db.collection("journal_entries").findOne({ _id: new ObjectId(id) })
  if (!entry) return null
  const accountsById = await _loadAccountsForLegs(db, [entry])
  return { entry, accountsById, legacy: _journalEntryToTransaction(entry, accountsById) }
}

async function _listTransactionsFromJournalEntries({ clientId, page, limit, paginationMode, cursor, search, fromDate, toDate, accountIds, categoryIds, amountSign }) {
  const db = getDB()
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))

  const filter = { clientId: String(clientId) }
  if (fromDate || toDate) {
    filter.date = {}
    if (fromDate) filter.date.$gte = String(fromDate)
    if (toDate) filter.date.$lte = String(toDate)
  }
  const safeSearch = String(search || "").trim()
  if (safeSearch) {
    filter.description = { $regex: escapeRegex(safeSearch), $options: "i" }
  }
  const accountFilterIds = []
  if (Array.isArray(accountIds) && accountIds.length > 0) accountFilterIds.push(...accountIds)
  if (Array.isArray(categoryIds) && categoryIds.length > 0) accountFilterIds.push(...categoryIds)
  if (accountFilterIds.length > 0) {
    filter["legs.accountId"] = { $in: [...new Set(accountFilterIds.map(String))] }
  }

  const safePaginationMode = String(paginationMode || "page").trim().toLowerCase() === "cursor" ? "cursor" : "page"
  const cursorData = safePaginationMode === "cursor" ? decodeTransactionsCursor(cursor) : null
  if (cursorData) {
    filter.$or = [
      { date: { $lt: cursorData.date } },
      { date: cursorData.date, _id: { $lt: new ObjectId(cursorData.id) } },
    ]
  }

  const query = db.collection("journal_entries")
    .find(filter)
    .sort({ date: -1, _id: -1 })
  const skip = safePaginationMode === "cursor" ? 0 : (safePage - 1) * safeLimit
  if (skip > 0) query.skip(skip)
  const rawEntries = await query.limit(safeLimit + 1).toArray()

  const hasMore = rawEntries.length > safeLimit
  const pageEntries = hasMore ? rawEntries.slice(0, safeLimit) : rawEntries
  const accountsById = await _loadAccountsForLegs(db, pageEntries)
  let items = pageEntries.map((entry) => _journalEntryToTransaction(entry, accountsById))

  // Hide the suspense leg in the bank slot — sometimes happens when both
  // legs land on non-bank accounts; the helper just picks legs[0]. The
  // user sees that as an empty bank column, which is OK as a fallback.

  // Amount sign filter applies post-translation since the sign is
  // derived from the bank leg.
  if (amountSign === "in") items = items.filter((t) => Number(t.amount) > 0)
  else if (amountSign === "out") items = items.filter((t) => Number(t.amount) < 0)

  const lastItem = items[items.length - 1]
  return {
    items,
    page: safePage,
    limit: safeLimit,
    hasMore,
    nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
    paginationMode: safePaginationMode,
    totalCount: null,
  }
}
const TRANSACTIONS_QUERY_SLOW_MS = Math.max(0, Number(process.env.TRANSACTIONS_QUERY_SLOW_MS || 750))
let atlasSearchDisabledUntil = 0

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6
}

function roundMs(value) {
  return Math.round(Number(value || 0))
}

function countActiveFilters({
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
} = {}) {
  return [
    Array.isArray(accountIds) && accountIds.length > 0,
    Array.isArray(categoryIds) && categoryIds.length > 0,
    includeUncategorizedIncome,
    includeUncategorizedExpenses,
    splitMode !== "all",
    amountSign !== "all",
    Array.isArray(years) && years.length > 0,
    Array.isArray(months) && months.length > 0,
    Boolean(fromDate),
    Boolean(toDate),
    typeof minAmount === "number",
    typeof maxAmount === "number",
    llmProcessed !== "all",
    iconType !== "all",
  ].filter(Boolean).length
}

function shouldLogTransactionsQuery(totalMs) {
  return TRANSACTIONS_QUERY_DEBUG || (TRANSACTIONS_QUERY_SLOW_MS > 0 && totalMs >= TRANSACTIONS_QUERY_SLOW_MS)
}

function logTransactionsQueryMetric(metric = {}) {
  const totalMs = roundMs(metric.totalMs)
  if (!shouldLogTransactionsQuery(totalMs)) return

  console.info("[transactions.query]", JSON.stringify({
    totalMs,
    path: metric.path || "unknown",
    paginationMode: metric.paginationMode || "unknown",
    page: metric.page,
    limit: metric.limit,
    returnedCount: metric.returnedCount,
    hasMore: metric.hasMore,
    searchLength: metric.searchLength,
    activeFilterCount: metric.activeFilterCount,
    accountFilterCount: metric.accountFilterCount,
    categoryFilterCount: metric.categoryFilterCount,
    yearFilterCount: metric.yearFilterCount,
    monthFilterCount: metric.monthFilterCount,
    hasCursor: metric.hasCursor,
    atlasMs: metric.atlasMs,
    fastMs: metric.fastMs,
    legacyMs: metric.legacyMs,
    legacyAttempted: Boolean(metric.legacyAttempted),
    legacyTimedOut: Boolean(metric.legacyTimedOut),
    atlasAttempted: Boolean(metric.atlasAttempted),
    atlasReturned: Boolean(metric.atlasReturned),
  }))
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildCategoryFilterValues(categoryIds = []) {
  const stringValues = []
  const objectIdValues = []
  const seenStrings = new Set()
  const seenObjectIds = new Set()

  for (const rawValue of Array.isArray(categoryIds) ? categoryIds : []) {
    const safeValue = String(rawValue || "").trim()
    if (!safeValue) continue

    if (!seenStrings.has(safeValue)) {
      seenStrings.add(safeValue)
      stringValues.push(safeValue)
    }

    if (ObjectId.isValid(safeValue) && !seenObjectIds.has(safeValue)) {
      seenObjectIds.add(safeValue)
      objectIdValues.push(new ObjectId(safeValue))
    }
  }

  return {
    stringValues,
    objectIdValues,
  }
}

function buildLegacySearchCondition(regex) {
  return {
    $or: [
      { description: regex },
      { accountName: regex },
      { category: regex },
      { "splits.category": regex },
      { date: regex },
    ],
  }
}

function buildMongoSearchCondition(search = "", mode = "fast") {
  const safeMode = String(mode || "fast").trim().toLowerCase()
  if (safeMode === "none") return null

  const { normalizedSearchText, tokens, hasOnlyIndexableTokens } = buildTransactionSearchQuery(search)
  if (!normalizedSearchText) return null

  if (safeMode === "fast" && hasOnlyIndexableTokens) {
    return { searchTerms: { $all: tokens } }
  }

  const regex = new RegExp(escapeRegex(normalizedSearchText), "i")
  if (safeMode === "legacy") {
    return buildLegacySearchCondition(regex)
  }

  if (safeMode === "full" && hasOnlyIndexableTokens) {
    return {
      $or: [
        { searchTerms: { $all: tokens } },
        { searchText: regex },
        buildLegacySearchCondition(regex),
      ],
    }
  }

  return { searchText: regex }
}

function encodeTransactionsCursor(item = {}) {
  const date = String(item?.date || "").trim()
  const id = String(item?._id || "").trim()
  if (!date || !id) return null

  return Buffer.from(JSON.stringify({ date, id })).toString("base64url")
}

function decodeTransactionsCursor(cursor = "") {
  const safeCursor = String(cursor || "").trim()
  if (!safeCursor) return null

  try {
    const parsed = JSON.parse(Buffer.from(safeCursor, "base64url").toString("utf8"))
    const date = String(parsed?.date || "").trim()
    const id = String(parsed?.id || "").trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    if (!ObjectId.isValid(id)) return null

    return {
      date,
      id,
    }
  } catch {
    return null
  }
}

const TRANSACTION_LIST_PROJECTION = {
  _id: 1,
  accountId: 1,
  accountName: 1,
  date: 1,
  description: 1,
  amount: 1,
  categoryId: 1,
  category: 1,
  isSplit: 1,
  llmProcessed: 1,
  llmStatus: 1,
  llmProcessedAt: 1,
  categorizedSource: 1,
  llmCategorySuggestionId: 1,
  llmCategorySuggestionName: 1,
  searchText: 1,
  splits: 1,
}

const TRANSACTION_SEARCH_STORED_SOURCE_FIELDS = [
  "_id",
  "clientId",
  "accountId",
  "accountName",
  "date",
  "description",
  "amount",
  "categoryId",
  "category",
  "isSplit",
  "llmProcessed",
  "llmStatus",
  "llmProcessedAt",
  "categorizedSource",
  "llmCategorySuggestionId",
  "llmCategorySuggestionName",
  "searchText",
  "splits",
]

const TRANSACTION_DERIVED_FIELD_NAMES = [
  "dateValue",
  "year",
  "month",
  "hasSplit",
  "allCategoryIds",
  "hasUncategorizedIncome",
  "hasUncategorizedExpense",
  "llmProcessedState",
  "iconType",
]

function buildTransactionsSearchIndexDefinition() {
  const searchableStringField = [
    { type: "token" },
    { type: "string" },
    {
      type: "autocomplete",
      tokenization: "edgeGram",
      minGrams: 2,
      maxGrams: 15,
      foldDiacritics: true,
    },
  ]

  return {
    storedSource: {
      include: TRANSACTION_SEARCH_STORED_SOURCE_FIELDS,
    },
    mappings: {
      dynamic: false,
      fields: {
        clientId: { type: "token" },
        accountId: { type: "token" },
        categoryId: { type: "token" },
        allCategoryIds: { type: "token" },
        categorizedSource: { type: "token" },
        iconType: { type: "token" },
        llmStatus: { type: "token" },
        llmProcessedState: { type: "token" },
        date: { type: "token" },
        year: { type: "token" },
        month: { type: "token" },
        dateValue: { type: "date" },
        amount: { type: "number" },
        llmProcessed: { type: "boolean" },
        isSplit: { type: "boolean" },
        hasSplit: { type: "boolean" },
        hasUncategorizedIncome: { type: "boolean" },
        hasUncategorizedExpense: { type: "boolean" },
        description: searchableStringField,
        accountName: searchableStringField,
        category: searchableStringField,
      },
    },
  }
}

function isAtlasSearchUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase()
  const errorCode = Number(error?.code || error?.errorResponse?.code || 0)

  return (
    errorCode === 20 ||
    message.includes("unrecognized pipeline stage name: '$search'") ||
    message.includes("search index commands are only supported with atlas") ||
    message.includes("command not found") ||
    message.includes("mongot") ||
    message.includes("maximum number of fts indexes") ||
    message.includes("maximum number of search indexes") ||
    message.includes("fts indexes has been reached") ||
    message.includes("search index") ||
    message.includes("index not found for search") ||
    message.includes("query requires a search index") ||
    message.includes("returnstoredsource") ||
    message.includes("storedsource")
  )
}

function buildAtlasAutocompleteClause(path, query, boost, fuzzy = null) {
  const autocomplete = {
    path,
    query,
    tokenOrder: "any",
    score: { boost: { value: boost } },
  }

  if (fuzzy) {
    autocomplete.fuzzy = fuzzy
  }

  return { autocomplete }
}

function parseDateAtUtcStart(value = "") {
  const safe = String(value || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null
  const [yearString, monthString, dayString] = safe.split("-")
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function parseDateAtUtcEnd(value = "") {
  const start = parseDateAtUtcStart(value)
  if (!start) return null
  return new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    23,
    59,
    59,
    999
  ))
}

function buildTransactionsAtlasFilterClauses({
  clientId,
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const clauses = [
    {
      equals: {
        path: "clientId",
        value: String(clientId || "").trim(),
      },
    },
  ]

  const safeAccountIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
  if (safeAccountIds.length > 0) {
    clauses.push({
      in: {
        path: "accountId",
        value: safeAccountIds,
      },
    })
  }

  if (splitMode === "split") {
    clauses.push({
      equals: {
        path: "hasSplit",
        value: true,
      },
    })
  } else if (splitMode === "regular") {
    clauses.push({
      equals: {
        path: "hasSplit",
        value: false,
      },
    })
  }

  if (amountSign === "positive") {
    clauses.push({
      range: {
        path: "amount",
        gt: 0,
      },
    })
  } else if (amountSign === "negative") {
    clauses.push({
      range: {
        path: "amount",
        lt: 0,
      },
    })
  }

  if (typeof minAmount === "number" || typeof maxAmount === "number") {
    const range = { path: "amount" }
    if (typeof minAmount === "number") range.gte = minAmount
    if (typeof maxAmount === "number") range.lte = maxAmount
    clauses.push({ range })
  }

  const categoryFilterValues = buildCategoryFilterValues(categoryIds)
  const safeCategoryIds = categoryFilterValues.stringValues
  if (safeCategoryIds.length > 0 || includeUncategorizedIncome || includeUncategorizedExpenses) {
    const should = []

    if (safeCategoryIds.length > 0) {
      should.push({
        in: {
          path: "allCategoryIds",
          value: safeCategoryIds,
        },
      })
    }

    if (includeUncategorizedIncome) {
      should.push({
        equals: {
          path: "hasUncategorizedIncome",
          value: true,
        },
      })
    }

    if (includeUncategorizedExpenses) {
      should.push({
        equals: {
          path: "hasUncategorizedExpense",
          value: true,
        },
      })
    }

    if (should.length > 0) {
      clauses.push({
        compound: {
          should,
          minimumShouldMatch: 1,
        },
      })
    }
  }

  const fromDateValue = parseDateAtUtcStart(fromDate)
  const toDateValue = parseDateAtUtcEnd(toDate)
  if (fromDateValue || toDateValue) {
    const range = { path: "dateValue" }
    if (fromDateValue) range.gte = fromDateValue
    if (toDateValue) range.lte = toDateValue
    clauses.push({ range })
  }

  const safeYears = Array.isArray(years)
    ? years.map((item) => String(item || "").trim()).filter((item) => /^\d{4}$/.test(item))
    : []
  const safeMonths = Array.isArray(months)
    ? months.map((item) => String(item || "").trim()).filter((item) => /^(0[1-9]|1[0-2])$/.test(item))
    : []

  if (safeYears.length > 0 || safeMonths.length > 0) {
    if (safeYears.length > 0 && safeMonths.length > 0) {
      clauses.push({
        compound: {
          should: safeYears.flatMap((year) =>
            safeMonths.map((month) => ({
              compound: {
                filter: [
                  { equals: { path: "year", value: year } },
                  { equals: { path: "month", value: month } },
                ],
              },
            }))
          ),
          minimumShouldMatch: 1,
        },
      })
    } else if (safeYears.length > 0) {
      clauses.push({
        in: {
          path: "year",
          value: safeYears,
        },
      })
    } else if (safeMonths.length > 0) {
      clauses.push({
        in: {
          path: "month",
          value: safeMonths,
        },
      })
    }
  }

  if (llmProcessed === "processed" || llmProcessed === "not_processed") {
    clauses.push({
      equals: {
        path: "llmProcessedState",
        value: llmProcessed,
      },
    })
  }

  if (iconType === "ai" || iconType === "memory" || iconType === "none") {
    clauses.push({
      equals: {
        path: "iconType",
        value: iconType,
      },
    })
  }

  return clauses
}

function buildTransactionsAtlasSearchStage({
  clientId,
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const safeClientId = String(clientId || "").trim()
  const safeSearch = String(search || "").trim()
  if (
    TRANSACTIONS_SEARCH_ENGINE !== "atlas" ||
    !ATLAS_SEARCH_ENABLED ||
    !ATLAS_SEARCH_INDEX_NAME ||
    !safeClientId ||
    !safeSearch
  ) {
    return null
  }

  const should = [
    buildAtlasAutocompleteClause(
      "description",
      safeSearch,
      6,
      safeSearch.length >= 5
        ? {
            maxEdits: 1,
            prefixLength: 2,
            maxExpansions: 64,
          }
        : null
    ),
    buildAtlasAutocompleteClause("accountName", safeSearch, 3),
    buildAtlasAutocompleteClause("category", safeSearch, 2),
    {
      text: {
        path: "description",
        query: safeSearch,
        score: { boost: { value: 4 } },
      },
    },
    {
      text: {
        path: "accountName",
        query: safeSearch,
        score: { boost: { value: 2 } },
      },
    },
    {
      text: {
        path: "category",
        query: safeSearch,
        score: { boost: { value: 1 } },
      },
    },
  ]

  return {
    $search: {
      index: ATLAS_SEARCH_INDEX_NAME,
      returnStoredSource: true,
      compound: {
        filter: buildTransactionsAtlasFilterClauses({
          clientId: safeClientId,
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
        }),
        should,
        minimumShouldMatch: 1,
      },
    },
  }
}

function buildAtlasSearchTimeoutError(timeoutMs) {
  const error = new Error(`Atlas Search timed out after ${timeoutMs}ms`)
  error.code = "ATLAS_SEARCH_TIMEOUT"
  return error
}

async function ensureTransactionsSearchIndex() {
  if (TRANSACTIONS_SEARCH_ENGINE !== "atlas" || !ATLAS_SEARCH_ENABLED || !ATLAS_SEARCH_INDEX_NAME) return

  const db = getDB()
  const collection = db.collection("transactions")
  const definition = buildTransactionsSearchIndexDefinition()

  try {
    const existingIndexes = await collection.listSearchIndexes(ATLAS_SEARCH_INDEX_NAME).toArray()
    if (existingIndexes.length === 0) {
      await collection.createSearchIndex({
        name: ATLAS_SEARCH_INDEX_NAME,
        definition,
      })
      return
    }

    const currentDefinition = existingIndexes[0]?.latestDefinition || existingIndexes[0]?.definition || null
    if (JSON.stringify(currentDefinition) === JSON.stringify(definition)) {
      return
    }

    await collection.updateSearchIndex(ATLAS_SEARCH_INDEX_NAME, definition)
  } catch (error) {
    if (isAtlasSearchUnavailableError(error)) {
      console.warn(`[transactions.repository] Atlas Search unavailable, keeping fallback search path: ${error.message}`)
      return
    }

    throw error
  }
}

async function runTransactionsAtlasSearchAggregate(collection, pipeline = []) {
  if (atlasSearchDisabledUntil > Date.now()) {
    return null
  }

  try {
    if (ATLAS_SEARCH_QUERY_TIMEOUT_MS <= 0) {
      return await collection.aggregate(pipeline).toArray()
    }

    return await Promise.race([
      collection.aggregate(pipeline).toArray(),
      new Promise((_, reject) => {
        setTimeout(() => reject(buildAtlasSearchTimeoutError(ATLAS_SEARCH_QUERY_TIMEOUT_MS)), ATLAS_SEARCH_QUERY_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    if (error?.code === "ATLAS_SEARCH_TIMEOUT" || isAtlasSearchUnavailableError(error)) {
      atlasSearchDisabledUntil = Date.now() + ATLAS_SEARCH_COOLDOWN_MS
      return null
    }

    throw error
  }
}

// cria índice uma vez (chame no startup ou antes do primeiro uso)
export async function ensureTransactionsIndexes() {
  const db = getDB()
  const collection = db.collection("transactions")
  await Promise.all([
    collection.createIndex({ clientId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, date: 1 }),
    collection.createIndex({ clientId: 1, searchTerms: 1 }),
    collection.createIndex({ clientId: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, accountId: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, year: 1, month: 1, searchTerms: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, dateValue: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, year: 1, month: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, accountId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, categoryId: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, allCategoryIds: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, hasSplit: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, llmProcessedState: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, iconType: 1, date: -1, _id: -1 }),
    collection.createIndex({ clientId: 1, createdAt: -1 }),
    collection.createIndex({ clientId: 1, updatedAt: -1 }),
    collection.createIndex({ clientId: 1, llmProcessedAt: -1 }),
    collection.createIndex({ clientId: 1, llmStatus: 1, llmProcessedAt: -1 }),
    collection.createIndex({ clientId: 1, categorizedAt: -1 }),
    collection.createIndex({ accountId: 1 }),
    collection.createIndex({ categoryId: 1 }),
    collection.createIndex({ "splits.categoryId": 1 }),
  ])

  await ensureTransactionsSearchIndex()
}

function buildTransactionsBackfillFilter() {
  return {
    $or: [
      { searchTerms: { $exists: false } },
      { searchText: { $exists: false } },
      ...TRANSACTION_DERIVED_FIELD_NAMES.map((field) => ({ [field]: { $exists: false } })),
    ],
  }
}

export async function backfillTransactionsSearchAndDerivedFields() {
  const db = getDB()
  const collection = db.collection("transactions")

  while (true) {
    const transactions = await collection
      .find(buildTransactionsBackfillFilter())
      .project({
        _id: 1,
        date: 1,
        description: 1,
        accountName: 1,
        amount: 1,
        categoryId: 1,
        category: 1,
        splits: 1,
        isSplit: 1,
        llmProcessed: 1,
        llmStatus: 1,
        llmProcessedAt: 1,
        categorizedSource: 1,
      })
      .limit(TRANSACTIONS_BACKFILL_BATCH_SIZE)
      .toArray()

    if (transactions.length === 0) return

    const operations = transactions.map((transaction) => ({
      updateOne: {
        filter: { _id: transaction._id },
        update: {
          $set: {
            searchTerms: buildTransactionSearchTerms(transaction),
            searchText: buildTransactionSearchText(transaction),
            ...buildTransactionDerivedFields(transaction),
            updatedAt: new Date(),
          },
        },
      },
    }))

    await collection.bulkWrite(operations, { ordered: false })
  }
}

// salva transações em lote (batch)
// Bulk import (CSV / PDF parse / Plaid sync) — each legacy transaction
// becomes one journal_entry with 2 legs (bank + category-or-suspense).
// Splits aren't supported here; importers only ever produce 2-leg rows.
export async function insertTransactionsInBatches(transactions) {
  const db = getDB()
  const collection = db.collection("journal_entries")
  const safeList = Array.isArray(transactions) ? transactions : []
  if (safeList.length === 0) return { insertedCount: 0 }

  const suspenseByClient = new Map()
  async function suspenseFor(clientId) {
    const key = String(clientId)
    if (!suspenseByClient.has(key)) {
      suspenseByClient.set(key, await getOrCreateSuspenseAccountId(key))
    }
    return suspenseByClient.get(key)
  }

  let insertedCount = 0
  for (let i = 0; i < safeList.length; i += BATCH_SIZE) {
    const chunk = safeList.slice(i, i + BATCH_SIZE)
    if (chunk.length === 0) continue

    const docs = []
    for (const t of chunk) {
      if (!t?.clientId || !t?.accountId || !t?.date) continue
      const signed = Number(t.amount || 0)
      if (!Number.isFinite(signed) || signed === 0) continue
      const suspenseId = await suspenseFor(t.clientId)
      let legs
      try {
        legs = _buildLegsFromLegacyShape({
          bankAccountId: t.accountId,
          amount: signed,
          categoryId: t.categoryId || null,
          splits: null,
          suspenseId,
          description: typeof t.description === "string" ? t.description : "",
        })
      } catch {
        continue
      }
      const { legs: normalized, totalDebits, totalCredits } = validateTransactionLegs(legs)
      docs.push({
        clientId: String(t.clientId),
        date: t.date,
        description: typeof t.description === "string" ? t.description.trim() : "",
        legs: normalized,
        totalDebits,
        totalCredits,
        source: t.categorizedSource || "import",
        externalId: t.externalId || null,
        llmProcessed: Boolean(t.llmProcessed),
        llmStatus: t.llmStatus || "not_processed",
        llmProcessedAt: t.llmProcessedAt || null,
        llmConfidence: t.llmConfidence ?? null,
        llmAmbiguous: t.llmAmbiguous ?? null,
        llmCategorySuggestionId: t.llmCategorySuggestionId || null,
        llmCategorySuggestionName: t.llmCategorySuggestionName || null,
        categorizedAt: t.categorizedAt || null,
        categorizedSource: t.categorizedSource || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    if (docs.length === 0) continue
    const result = await collection.insertMany(docs, { ordered: false })
    insertedCount += result.insertedCount || 0
  }

  return { insertedCount }
}

// atualizar 

// Post-migration adapter. Translates a legacy-shape patch into the
// equivalent journal_entries update: legs-affecting fields rebuild the
// legs, the rest is $set'd directly on the entry doc (metadata like
// llmProcessed/categorizedSource lives on the journal entry itself now).
export async function updateTransactionById(id, patch) {
  const db = getDB()
  if (!ObjectId.isValid(String(id))) return null

  const loaded = await _loadEntryAsLegacy(db, id)
  if (!loaded) return null
  const { entry, legacy } = loaded

  const safePatch = patch || {}
  const touchesLegs =
    safePatch.accountId !== undefined ||
    safePatch.amount !== undefined ||
    safePatch.categoryId !== undefined ||
    safePatch.splits !== undefined ||
    safePatch.isSplit !== undefined

  const $set = { updatedAt: new Date() }
  if (typeof safePatch.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(safePatch.date)) {
    $set.date = safePatch.date
  }
  if (typeof safePatch.description === "string") {
    $set.description = safePatch.description.trim()
  }

  // Metadata passthrough — these live on the entry doc post-migration.
  const metadataFields = [
    "llmProcessed",
    "llmStatus",
    "llmProcessedAt",
    "llmConfidence",
    "llmAmbiguous",
    "llmCategorySuggestionId",
    "llmCategorySuggestionName",
    "llmProcessedState",
    "iconType",
    "categorizedAt",
    "categorizedSource",
  ]
  for (const key of metadataFields) {
    if (safePatch[key] !== undefined) $set[key] = safePatch[key]
  }

  if (touchesLegs && (await entryHasClearedLegs(id))) {
    const err = new Error(
      "This transaction belongs to a completed reconciliation. Reopen the reconciliation to edit.",
    )
    err.code = "RECONCILED_TRANSACTION_LOCKED"
    throw err
  }

  if (touchesLegs) {
    const suspenseId = await getOrCreateSuspenseAccountId(String(entry.clientId))
    const nextSplits = safePatch.splits !== undefined ? safePatch.splits : (legacy.splits || [])
    const splitsArray = Array.isArray(nextSplits) ? nextSplits.filter((s) => Number(s?.amount) !== 0) : []
    const useSplits = splitsArray.length >= 2 && safePatch.isSplit !== false

    const newAmount = safePatch.amount !== undefined ? Number(safePatch.amount) : Number(legacy.amount)
    const newCategoryId = safePatch.categoryId !== undefined ? safePatch.categoryId : legacy.categoryId
    const newBankAccountId = safePatch.accountId !== undefined ? safePatch.accountId : legacy.accountId

    const newLegs = _buildLegsFromLegacyShape({
      bankAccountId: newBankAccountId,
      amount: newAmount,
      categoryId: newCategoryId,
      splits: useSplits ? splitsArray : null,
      suspenseId,
      description: typeof $set.description === "string" ? $set.description : (entry.description || ""),
    })
    const { legs, totalDebits, totalCredits } = validateTransactionLegs(newLegs)
    $set.legs = legs
    $set.totalDebits = totalDebits
    $set.totalCredits = totalCredits
  }

  const result = await db.collection("journal_entries").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" },
  )
  const updatedEntry = result?.value ?? result
  if (!updatedEntry || !updatedEntry._id) return null
  const accountsById = await _loadAccountsForLegs(db, [updatedEntry])
  return _journalEntryToTransaction(updatedEntry, accountsById)
}

// Bulk version: same legs-rebuild logic per entry. No bulkWrite because
// each entry needs to load+rebuild legs, but we keep the contract.
export async function updateTransactionsByIds(updates = []) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }
  let matchedCount = 0
  let modifiedCount = 0
  for (const item of updates) {
    if (!item?.id) continue
    const updated = await updateTransactionById(item.id, item.patch || {})
    if (updated) {
      matchedCount += 1
      modifiedCount += 1
    }
  }
  return { matchedCount, modifiedCount }
}

export async function getTransactionById(id) {
  const db = getDB()
  const loaded = await _loadEntryAsLegacy(db, id)
  return loaded?.legacy || null
}

export async function listTransactionsByIds(ids = []) {
  const db = getDB()
  const objectIds = Array.isArray(ids)
    ? ids
        .map((id) => String(id || "").trim())
        .filter((id) => id && ObjectId.isValid(id))
        .map((id) => new ObjectId(id))
    : []
  if (objectIds.length === 0) return []
  const entries = await db.collection("journal_entries").find({ _id: { $in: objectIds } }).toArray()
  const accountsById = await _loadAccountsForLegs(db, entries)
  return entries.map((e) => _journalEntryToTransaction(e, accountsById))
}

export async function deleteTransactionById(id) {
  const db = getDB()
  if (!ObjectId.isValid(String(id))) return { deletedCount: 0 }
  if (await entryHasClearedLegs(id)) {
    const err = new Error(
      "This transaction belongs to a completed reconciliation. Reopen the reconciliation first.",
    )
    err.code = "RECONCILED_TRANSACTION_LOCKED"
    throw err
  }
  return db.collection("journal_entries").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteTransactionsByIds(ids = []) {
  const db = getDB()
  const objectIds = (ids || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && ObjectId.isValid(id))
    .map((id) => new ObjectId(id))
  if (objectIds.length === 0) return { deletedCount: 0 }
  // Block if any of the requested entries is reconciled.
  for (const oid of objectIds) {
    if (await entryHasClearedLegs(String(oid))) {
      const err = new Error(
        "One or more transactions belong to a completed reconciliation. Reopen first.",
      )
      err.code = "RECONCILED_TRANSACTION_LOCKED"
      throw err
    }
  }
  return db.collection("journal_entries").deleteMany({ _id: { $in: objectIds } })
}

export async function deleteTransactionsByClientId(clientId) {
  const db = getDB()
  return db.collection("journal_entries").deleteMany({ clientId: String(clientId) })
}

// "Account in use" = the account appears on a leg of any journal entry.
export async function countTransactionsByAccountId(accountId) {
  const db = getDB()
  const safeId = String(accountId || "").trim()
  if (!safeId) return 0
  return db.collection("journal_entries").countDocuments({ "legs.accountId": safeId })
}

export async function listLinkedAccountIds(accountIds = []) {
  const db = getDB()
  const safeAccountIds = Array.isArray(accountIds)
    ? [...new Set(accountIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : []
  if (safeAccountIds.length === 0) return []
  const docs = await db
    .collection("journal_entries")
    .find(
      { "legs.accountId": { $in: safeAccountIds } },
      { projection: { _id: 0, "legs.accountId": 1 } },
    )
    .toArray()
  const set = new Set()
  for (const doc of docs) {
    for (const leg of doc.legs || []) {
      const id = String(leg.accountId || "")
      if (id && safeAccountIds.includes(id)) set.add(id)
    }
  }
  return [...set]
}

// Categories are accounts in the new schema, so "category in use" is the
// same query as "account in use".
export async function countTransactionsByCategoryId(categoryId) {
  return countTransactionsByAccountId(categoryId)
}

export async function listLinkedCategoryIds(categoryIds = []) {
  return listLinkedAccountIds(categoryIds)
}

// Categories actually used by a client = the set of non-bank-side
// account ids referenced from any of their journal entries' legs.
export async function listUsedCategoryIdsByClientId(clientId) {
  const db = getDB()
  const safeClientId = String(clientId || "").trim()
  if (!safeClientId) return []
  const ids = await db
    .collection("journal_entries")
    .distinct("legs.accountId", { clientId: safeClientId })
  return ids.map((id) => String(id || "").trim()).filter(Boolean)
}

// Eligibility for the LLM = uncategorized (has a suspense leg) AND
// 2-leg (not already split) AND description !~ Zelle.
async function _listLlmEligibleEntries(db, clientId, { transactionIds, zelle } = {}) {
  const safeClientId = String(clientId || "").trim()
  if (!safeClientId) return []
  const suspenseId = await getOrCreateSuspenseAccountId(safeClientId)
  const filter = {
    clientId: safeClientId,
    "legs.accountId": suspenseId,
    "legs.2": { $exists: false }, // exactly 2 legs = not a split
  }
  if (zelle === true) filter.description = ZELLE_DESCRIPTION_REGEX
  else if (zelle === false) filter.description = { $not: ZELLE_DESCRIPTION_REGEX }
  if (Array.isArray(transactionIds) && transactionIds.length > 0) {
    const objectIds = transactionIds
      .map((id) => String(id || "").trim())
      .filter((id) => id && ObjectId.isValid(id))
      .map((id) => new ObjectId(id))
    if (objectIds.length === 0) return []
    filter._id = { $in: objectIds }
  }
  const entries = await db
    .collection("journal_entries")
    .find(filter)
    .sort({ date: -1, _id: -1 })
    .toArray()
  const accountsById = await _loadAccountsForLegs(db, entries)
  return entries.map((e) => _journalEntryToTransaction(e, accountsById))
}

export async function listEligibleTransactionsForLlmByIds(clientId, transactionIds = []) {
  const db = getDB()
  return _listLlmEligibleEntries(db, clientId, { transactionIds, zelle: false })
}

export async function listEligibleTransactionsForLlmByClientId(clientId) {
  const db = getDB()
  return _listLlmEligibleEntries(db, clientId, { zelle: false })
}

export async function listEligibleTransactionsForZelleByIds(clientId, transactionIds = []) {
  const db = getDB()
  return _listLlmEligibleEntries(db, clientId, { transactionIds, zelle: true })
}

export async function listEligibleTransactionsForZelleByClientId(clientId) {
  const db = getDB()
  return _listLlmEligibleEntries(db, clientId, { zelle: true })
}

// Applies LLM-derived categorization to journal_entries: replaces the
// suspense leg with the picked contra account and stamps metadata.
// Each update item has shape { id, categoryId, llmStatus, ... }.
export async function applyLlmCategorizationUpdates(updates = []) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { modifiedCount: 0 }
  }
  let modifiedCount = 0
  for (const item of updates) {
    if (!item?.id) continue
    const patch = {
      categoryId: item.categoryId ?? null,
      llmProcessed: true,
      llmStatus: item.llmStatus,
      llmProcessedAt: item.llmProcessedAt,
      llmConfidence: item.llmConfidence ?? null,
      llmAmbiguous: item.llmAmbiguous ?? null,
      llmCategorySuggestionId: item.llmCategorySuggestionId ?? null,
      llmCategorySuggestionName: item.llmCategorySuggestionName ?? null,
      llmProcessedState: item.llmProcessedState,
      iconType: item.iconType,
      categorizedAt: item.categorizedAt ?? null,
      categorizedSource: item.categorizedSource ?? null,
    }
    const updated = await updateTransactionById(item.id, patch)
    if (updated) modifiedCount += 1
  }
  return { modifiedCount }
}

// Same shape as applyLlmCategorizationUpdates but without LLM metadata
// (manual or Zelle-rule-driven categorization).
export async function applyCategoryUpdates(updates = []) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { modifiedCount: 0 }
  }
  let modifiedCount = 0
  for (const item of updates) {
    if (!item?.id) continue
    const patch = {
      categoryId: item.categoryId ?? null,
      llmProcessedState: item.llmProcessedState,
      iconType: item.iconType,
      categorizedAt: item.categorizedAt ?? null,
      categorizedSource: item.categorizedSource ?? null,
    }
    const updated = await updateTransactionById(item.id, patch)
    if (updated) modifiedCount += 1
  }
  return { modifiedCount }
}

// Operational signals for a (client, year) pair, post-migration adapter.
// Reads journal_entries; "uncategorized" means at least one leg still
// points to the client's suspense account (coa_accounts.isSuspense=true).
export async function getClientYearOperationalSignals(clientId, year) {
  const db = getDB()

  const safeClientId = String(clientId || "").trim()
  const safeYear = String(year || "").trim()
  if (!safeClientId || !/^\d{4}$/.test(safeYear)) {
    return { totalCount: 0, monthsInYear: [], uncategorizedInYear: 0 }
  }

  const suspense = await db
    .collection("coa_accounts")
    .findOne(
      { clientId: safeClientId, isSuspense: true },
      { projection: { _id: 1 } },
    )
  const suspenseId = suspense ? String(suspense._id) : null

  const [result] = await db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId: safeClientId, date: { $regex: /^\d{4}-\d{2}-\d{2}$/ } } },
      {
        $project: {
          year: { $substrBytes: ["$date", 0, 4] },
          month: { $substrBytes: ["$date", 5, 2] },
          legs: 1,
        },
      },
      {
        $facet: {
          total: [{ $count: "n" }],
          months: [
            { $match: { year: safeYear } },
            { $group: { _id: "$month" } },
          ],
          uncategorized: suspenseId
            ? [
                { $match: { year: safeYear, "legs.accountId": suspenseId } },
                { $count: "n" },
              ]
            : [{ $match: { _id: null } }, { $count: "n" }],
        },
      },
    ])
    .toArray()

  const totalCount = Number(result?.total?.[0]?.n || 0)
  const monthsInYear = Array.isArray(result?.months)
    ? result.months.map((item) => String(item?._id || "")).filter(Boolean).sort()
    : []
  const uncategorizedInYear = Number(result?.uncategorized?.[0]?.n || 0)
  return { totalCount, monthsInYear, uncategorizedInYear }
}

export async function listTransactionPeriodOptions(clientId) {
  const db = getDB()
  const collection = db.collection("journal_entries")

  const [result] = await collection
    .aggregate([
      {
        $match: {
          clientId,
          date: { $regex: /^\d{4}-\d{2}-\d{2}$/ },
        },
      },
      {
        $project: {
          year: { $substrBytes: ["$date", 0, 4] },
          month: { $substrBytes: ["$date", 5, 2] },
        },
      },
      {
        $group: {
          _id: null,
          years: { $addToSet: "$year" },
          months: { $addToSet: "$month" },
        },
      },
    ])
    .toArray()

  const years = Array.isArray(result?.years)
    ? [...result.years].sort((a, b) => Number(b) - Number(a))
    : []
  const months = Array.isArray(result?.months)
    ? [...result.months].sort((a, b) => Number(a) - Number(b))
    : []

  return { years, months }
}

function buildTransactionsFilter({
  clientId,
  search = "",
  searchMode = "fast",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const conditions = [{ clientId }]

  const searchCondition = buildMongoSearchCondition(search, searchMode)
  if (searchCondition) {
    conditions.push(searchCondition)
  }

  const safeAccountIds = Array.isArray(accountIds) ? accountIds.filter(Boolean) : []
  if (safeAccountIds.length > 0) {
    conditions.push({ accountId: { $in: safeAccountIds } })
  }

  if (splitMode === "split") {
    conditions.push({
      $or: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
    })
  } else if (splitMode === "regular") {
    conditions.push({
      $nor: [
        { isSplit: true },
        { "splits.1": { $exists: true } },
      ],
    })
  }

  if (amountSign === "positive") {
    conditions.push({ amount: { $gt: 0 } })
  } else if (amountSign === "negative") {
    conditions.push({ amount: { $lt: 0 } })
  }

  const categoryFilterValues = buildCategoryFilterValues(categoryIds)
  const safeCategoryIds = categoryFilterValues.stringValues
  if (safeCategoryIds.length > 0 || includeUncategorizedIncome || includeUncategorizedExpenses) {
    const categoryConditions = []
    const uncategorizedIncomeCondition = {
      $or: [
        {
          $and: [
            { amount: { $gt: 0 } },
            {
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized income" },
              ],
            },
          ],
        },
        {
          splits: {
            $elemMatch: {
              amount: { $gt: 0 },
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized income" },
              ],
            },
          },
        },
      ],
    }
    const uncategorizedExpensesCondition = {
      $or: [
        {
          $and: [
            { amount: { $lt: 0 } },
            {
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized expenses" },
              ],
            },
          ],
        },
        {
          splits: {
            $elemMatch: {
              amount: { $lt: 0 },
              $or: [
                { categoryId: null },
                { categoryId: "" },
                { category: null },
                { category: "" },
                { category: "Uncategorized expenses" },
              ],
            },
          },
        },
      ],
    }

    if (safeCategoryIds.length > 0) {
      const directCategoryConditions = []
      const splitCategoryConditions = []
      const derivedCategoryConditions = []

      if (categoryFilterValues.stringValues.length > 0) {
        derivedCategoryConditions.push({ allCategoryIds: { $in: categoryFilterValues.stringValues } })
        directCategoryConditions.push({ categoryId: { $in: categoryFilterValues.stringValues } })
        splitCategoryConditions.push({ "splits.categoryId": { $in: categoryFilterValues.stringValues } })
      }

      if (categoryFilterValues.objectIdValues.length > 0) {
        directCategoryConditions.push({ categoryId: { $in: categoryFilterValues.objectIdValues } })
        splitCategoryConditions.push({ "splits.categoryId": { $in: categoryFilterValues.objectIdValues } })
      }

      categoryConditions.push({
        $or: [
          ...derivedCategoryConditions,
          ...directCategoryConditions,
          ...splitCategoryConditions,
        ],
      })
    }

    if (includeUncategorizedIncome) {
      categoryConditions.push(uncategorizedIncomeCondition)
    }

    if (includeUncategorizedExpenses) {
      categoryConditions.push(uncategorizedExpensesCondition)
    }

    if (categoryConditions.length === 1) {
      conditions.push(categoryConditions[0])
    } else {
      conditions.push({ $or: categoryConditions })
    }
  }

  if (fromDate || toDate) {
    const dateQuery = {}
    if (fromDate) dateQuery.$gte = fromDate
    if (toDate) dateQuery.$lte = toDate
    conditions.push({ date: dateQuery })
  }

  const safeYears = Array.isArray(years)
    ? years
      .map((item) => String(item || "").trim())
      .filter((item) => /^\d{4}$/.test(item))
    : []
  const safeMonths = Array.isArray(months)
    ? months
      .map((item) => String(item || "").trim())
      .filter((item) => /^(0[1-9]|1[0-2])$/.test(item))
    : []

  if (safeYears.length > 0 || safeMonths.length > 0) {
    if (safeYears.length > 0 && safeMonths.length > 0) {
      const monthRangeConditions = []
      safeYears.forEach((year) => {
        safeMonths.forEach((month) => {
          monthRangeConditions.push({
            date: {
              $gte: `${year}-${month}-01`,
              $lte: `${year}-${month}-31`,
            },
          })
        })
      })

      if (monthRangeConditions.length === 1) {
        conditions.push(monthRangeConditions[0])
      } else if (monthRangeConditions.length > 1) {
        conditions.push({ $or: monthRangeConditions })
      }
    } else if (safeYears.length > 0) {
      const yearRangeConditions = []
      safeYears.forEach((year) => {
        yearRangeConditions.push({
          date: {
            $gte: `${year}-01-01`,
            $lte: `${year}-12-31`,
          },
        })
      })

      if (yearRangeConditions.length === 1) {
        conditions.push(yearRangeConditions[0])
      } else if (yearRangeConditions.length > 1) {
        conditions.push({ $or: yearRangeConditions })
      }
    } else {
      const dateRegexConditions = []
      safeMonths.forEach((month) => {
        dateRegexConditions.push({ date: new RegExp(`^\\d{4}-${month}-`) })
      })

      if (dateRegexConditions.length === 1) {
        conditions.push(dateRegexConditions[0])
      } else if (dateRegexConditions.length > 1) {
        conditions.push({ $or: dateRegexConditions })
      }
    }
  }

  if (typeof minAmount === "number" || typeof maxAmount === "number") {
    const amountQuery = {}
    if (typeof minAmount === "number") amountQuery.$gte = minAmount
    if (typeof maxAmount === "number") amountQuery.$lte = maxAmount
    conditions.push({ amount: amountQuery })
  }

  if (llmProcessed === "processed") {
    conditions.push({
      $or: [
        { llmProcessed: true },
        { llmProcessedAt: { $ne: null } },
        { llmStatus: { $in: ["suggested", "empty", "error"] } },
      ],
    })
  } else if (llmProcessed === "not_processed") {
    conditions.push({
      $and: [
        {
          $or: [
            { llmProcessed: false },
            { llmProcessed: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmProcessedAt: null },
            { llmProcessedAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmStatus: "not_processed" },
            { llmStatus: null },
            { llmStatus: "" },
            { llmStatus: { $exists: false } },
          ],
        },
      ],
    })
  }

  if (iconType === "ai") {
    conditions.push({
      $and: [
        {
          $or: [
            { categorizedSource: null },
            { categorizedSource: "" },
            { categorizedSource: { $exists: false } },
            { categorizedSource: { $nin: ["memory"] } },
          ],
        },
        {
          $or: [
            { llmProcessed: true },
            { llmProcessedAt: { $ne: null } },
            { llmStatus: { $in: ["suggested", "empty", "error"] } },
          ],
        },
      ],
    })
  } else if (iconType === "memory") {
    conditions.push({ categorizedSource: "memory" })
  } else if (iconType === "none") {
    conditions.push({
      $and: [
        {
          $or: [
            { categorizedSource: null },
            { categorizedSource: "" },
            { categorizedSource: { $exists: false } },
            { categorizedSource: { $nin: ["memory"] } },
          ],
        },
        {
          $or: [
            { llmProcessed: false },
            { llmProcessed: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmProcessedAt: null },
            { llmProcessedAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { llmStatus: "not_processed" },
            { llmStatus: null },
            { llmStatus: "" },
            { llmStatus: { $exists: false } },
          ],
        },
      ],
    })
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions }
}

function buildCursorFilterFromCursor(cursor = "") {
  const parsedCursor = decodeTransactionsCursor(cursor)
  if (!parsedCursor) return null

  return {
    $or: [
      { date: { $lt: parsedCursor.date } },
      { date: parsedCursor.date, _id: { $lt: new ObjectId(parsedCursor.id) } },
    ],
  }
}

function combineMongoFilters(...filters) {
  const safeFilters = filters.filter(Boolean)
  if (safeFilters.length === 0) return {}
  if (safeFilters.length === 1) return safeFilters[0]
  return { $and: safeFilters }
}

function buildCursorPagePayload(rawItems = [], safeLimit) {
  const hasMore = rawItems.length > safeLimit
  const items = hasMore ? rawItems.slice(0, safeLimit) : rawItems
  const lastItem = items.length > 0 ? items[items.length - 1] : null

  return {
    items,
    limit: safeLimit,
    hasMore,
    nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
    paginationMode: "cursor",
  }
}

async function findTransactionsCursorPage(collection, filter, safeLimit, options = {}) {
  let cursor = collection
    .find(filter, { projection: TRANSACTION_LIST_PROJECTION })
    .sort({ date: -1, _id: -1 })
    .limit(safeLimit + 1)

  const maxTimeMS = Math.max(0, Number(options?.maxTimeMS || 0))
  if (maxTimeMS > 0) {
    cursor = cursor.maxTimeMS(maxTimeMS)
  }

  const rawItems = await cursor.toArray()
  return buildCursorPagePayload(rawItems, safeLimit)
}

async function findTransactionsPage(collection, filter, safePage, safeLimit, options = {}) {
  const skip = (safePage - 1) * safeLimit
  let itemsCursor = collection
    .find(filter, { projection: TRANSACTION_LIST_PROJECTION })
    .sort({ date: -1, _id: -1 })
    .skip(skip)
    .limit(safeLimit)

  let countCursor = collection.countDocuments(filter)
  const maxTimeMS = Math.max(0, Number(options?.maxTimeMS || 0))
  if (maxTimeMS > 0) {
    itemsCursor = itemsCursor.maxTimeMS(maxTimeMS)
    countCursor = collection.countDocuments(filter, { maxTimeMS })
  }

  const [items, total] = await Promise.all([
    itemsCursor.toArray(),
    countCursor,
  ])

  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
  }
}

// busca paginada
export async function listTransactionsPaginated(params) {
  // Post-migration adapter: reads from journal_entries and translates
  // each entry into the legacy transaction shape so the existing UI
  // (LedgerPage) works unchanged. Advanced filters (Atlas Search,
  // years/months, amount range, llmProcessed, iconType, split mode,
  // uncategorized flags) are no-ops for now — they'll be re-added
  // once the basic listing is verified end-to-end.
  return _listTransactionsFromJournalEntries(params || {})
}

async function _legacyUnusedListTransactionsPaginated({
  clientId,
  page = 1,
  limit = 50,
  paginationMode = "page",
  cursor = "",
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const queryStartMs = nowMs()
  const metric = {
    path: "mongo-fast",
    paginationMode,
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    searchLength: String(search || "").trim().length,
    accountFilterCount: Array.isArray(accountIds) ? accountIds.length : 0,
    categoryFilterCount: Array.isArray(categoryIds) ? categoryIds.length : 0,
    yearFilterCount: Array.isArray(years) ? years.length : 0,
    monthFilterCount: Array.isArray(months) ? months.length : 0,
    activeFilterCount: countActiveFilters({
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
    }),
    hasCursor: Boolean(String(cursor || "").trim()),
    atlasAttempted: false,
    atlasReturned: false,
    legacyAttempted: false,
    legacyTimedOut: false,
  }

  const db = getDB()
  const collection = db.collection("transactions")

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))
  const safePaginationMode = String(paginationMode || "page").trim().toLowerCase() === "cursor"
    ? "cursor"
    : "page"
  const filter = buildTransactionsFilter({
    clientId,
    search,
    searchMode: "fast",
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
  const atlasSearchStage = buildTransactionsAtlasSearchStage({
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
  if (safePaginationMode === "cursor") {
    const cursorFilter = buildCursorFilterFromCursor(cursor)
    const finalFilter = combineMongoFilters(filter, cursorFilter)

    if (atlasSearchStage) {
      metric.atlasAttempted = true
      const atlasStartMs = nowMs()
      const rawItems = await runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        ...(cursorFilter ? [{ $match: cursorFilter }] : []),
        { $sort: { date: -1, _id: -1 } },
        { $limit: safeLimit + 1 },
        { $project: TRANSACTION_LIST_PROJECTION },
      ])
      metric.atlasMs = roundMs(nowMs() - atlasStartMs)

      if (rawItems && rawItems.length > 0) {
        const hasMore = rawItems.length > safeLimit
        const items = hasMore ? rawItems.slice(0, safeLimit) : rawItems
        const lastItem = items.length > 0 ? items[items.length - 1] : null
        const result = {
          items,
          limit: safeLimit,
          hasMore,
          nextCursor: hasMore && lastItem ? encodeTransactionsCursor(lastItem) : null,
          paginationMode: "cursor",
        }

        metric.path = "atlas"
        metric.atlasReturned = true
        metric.returnedCount = items.length
        metric.hasMore = hasMore
        metric.totalMs = nowMs() - queryStartMs
        logTransactionsQueryMetric(metric)
        return result
      }
    }

    const fastStartMs = nowMs()
    const fastResult = await findTransactionsCursorPage(collection, finalFilter, safeLimit)
    metric.fastMs = roundMs(nowMs() - fastStartMs)
    metric.path = "mongo-fast"
    metric.returnedCount = fastResult.items.length
    metric.hasMore = Boolean(fastResult.hasMore)
    metric.totalMs = nowMs() - queryStartMs
    logTransactionsQueryMetric(metric)
    return fastResult
  }

  if (atlasSearchStage) {
    metric.atlasAttempted = true
    const atlasStartMs = nowMs()
    const [items, totalResult] = await Promise.all([
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $sort: { date: -1, _id: -1 } },
        { $skip: (safePage - 1) * safeLimit },
        { $limit: safeLimit },
        { $project: TRANSACTION_LIST_PROJECTION },
      ]),
      runTransactionsAtlasSearchAggregate(collection, [
        atlasSearchStage,
        { $count: "total" },
      ]),
    ])
    metric.atlasMs = roundMs(nowMs() - atlasStartMs)

    if (items && totalResult && items.length > 0) {
      const total = Number(totalResult?.[0]?.total || 0)
      const result = {
        items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      }
      metric.path = "atlas"
      metric.atlasReturned = true
      metric.returnedCount = items.length
      metric.hasMore = safePage < result.totalPages
      metric.totalMs = nowMs() - queryStartMs
      logTransactionsQueryMetric(metric)
      return result
    }
  }

  const fastStartMs = nowMs()
  const fastResult = await findTransactionsPage(collection, filter, safePage, safeLimit)
  metric.fastMs = roundMs(nowMs() - fastStartMs)
  metric.path = "mongo-fast"
  metric.returnedCount = fastResult.items.length
  metric.hasMore = safePage < fastResult.totalPages
  metric.totalMs = nowMs() - queryStartMs
  logTransactionsQueryMetric(metric)
  return fastResult
}

export async function summarizeTransactions(params = {}) {
  // Post-migration adapter: aggregates journal_entries instead of the
  // legacy transactions collection. Sums money_in / money_out / net
  // from the bank-side leg of each entry.
  return _summarizeFromJournalEntries(params)
}

async function _summarizeFromJournalEntries({ clientId, fromDate, toDate, accountIds, categoryIds, search }) {
  const db = getDB()
  const filter = { clientId: String(clientId) }
  if (fromDate || toDate) {
    filter.date = {}
    if (fromDate) filter.date.$gte = String(fromDate)
    if (toDate) filter.date.$lte = String(toDate)
  }
  if (String(search || "").trim()) {
    filter.description = { $regex: escapeRegex(String(search).trim()), $options: "i" }
  }
  const accountFilter = []
  if (Array.isArray(accountIds) && accountIds.length > 0) accountFilter.push(...accountIds)
  if (Array.isArray(categoryIds) && categoryIds.length > 0) accountFilter.push(...categoryIds)
  if (accountFilter.length > 0) {
    filter["legs.accountId"] = { $in: [...new Set(accountFilter.map(String))] }
  }

  const entries = await db.collection("journal_entries").find(filter).toArray()
  const accountsById = await _loadAccountsForLegs(db, entries)

  let income = 0
  let expense = 0
  let count = 0
  for (const entry of entries) {
    const tx = _journalEntryToTransaction(entry, accountsById)
    const amount = Number(tx.amount || 0)
    if (amount > 0) income += amount
    else expense += -amount
    count += 1
  }
  const net = income - expense

  return {
    totalCount: count,
    totalAmount: net,
    incomeAmount: income,
    expenseAmount: expense,
  }
}

async function _unusedLegacySummarize({
  clientId,
  search = "",
  accountIds = [],
  categoryIds = [],
  includeUncategorizedIncome = false,
  includeUncategorizedExpenses = false,
  splitMode = "all",
  amountSign = "all",
  years = [],
  months = [],
  fromDate = "",
  toDate = "",
  minAmount = null,
  maxAmount = null,
  llmProcessed = "all",
  iconType = "all",
}) {
  const db = getDB()
  const collection = db.collection("transactions")

  const filter = buildTransactionsFilter({
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

  const [result] = await collection
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalCount: { $sum: 1 },
        },
      },
    ])
    .toArray()

  return {
    totalAmount: Number(result?.totalAmount || 0),
    totalCount: Number(result?.totalCount || 0),
  }
}
