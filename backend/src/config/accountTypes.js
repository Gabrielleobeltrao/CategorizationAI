// Canonical account types after the double-entry migration. Every account
// in the Chart of Accounts has exactly one of these, replacing the legacy
// split between `account.type` (checking/savings/credit_card/etc.) and
// `categories.type` (income/cogs/operating_expense).
export const ACCOUNT_TYPE_OPTIONS = [
  { value: "asset_current", label: "Current Asset", parent: "asset", normalSide: "debit" },
  { value: "asset_noncurrent", label: "Non-current Asset", parent: "asset", normalSide: "debit" },
  { value: "liability_current", label: "Current Liability", parent: "liability", normalSide: "credit" },
  { value: "liability_noncurrent", label: "Non-current Liability", parent: "liability", normalSide: "credit" },
  { value: "equity", label: "Equity", parent: "equity", normalSide: "credit" },
  { value: "income", label: "Income", parent: "income", normalSide: "credit" },
  { value: "cost_of_goods_sold", label: "Cost of Goods Sold", parent: "expense", normalSide: "debit" },
  { value: "operating_expense", label: "Operating Expense", parent: "expense", normalSide: "debit" },
  { value: "other_income", label: "Other Income", parent: "income", normalSide: "credit" },
  { value: "other_expense", label: "Other Expense", parent: "expense", normalSide: "debit" },
  { value: "tax_expense", label: "Tax Expense", parent: "expense", normalSide: "debit" },
]

export const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPE_OPTIONS.map((option) => option.value)

const ACCOUNT_TYPE_BY_VALUE = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((option) => [option.value, option]),
)

export const PNL_ACCOUNT_TYPES = [
  "income",
  "cost_of_goods_sold",
  "operating_expense",
  "other_income",
  "other_expense",
  "tax_expense",
]

export const BALANCE_SHEET_ACCOUNT_TYPES = [
  "asset_current",
  "asset_noncurrent",
  "liability_current",
  "liability_noncurrent",
  "equity",
]

export function isValidAccountType(value = "") {
  return ACCOUNT_TYPE_VALUES.includes(String(value || "").trim())
}

export function getAccountTypeMeta(value = "") {
  return ACCOUNT_TYPE_BY_VALUE[String(value || "").trim()] || null
}

export function getAccountTypeLabel(value = "") {
  return getAccountTypeMeta(value)?.label || ""
}

// Used by single-entry → double-entry migration. Picks the canonical
// account type for an old `account` document that only had legacy
// type/balanceSheetType fields. Fallback chain: explicit balanceSheetType
// → inferred from old `type` → "uncategorized" (caller decides what to do).
const LEGACY_BALANCE_SHEET_FALLBACK = {
  asset_current: "asset_current",
  asset_noncurrent: "asset_noncurrent",
  liability_current: "liability_current",
  liability_noncurrent: "liability_noncurrent",
  equity: "equity",
}

const LEGACY_ACCOUNT_TYPE_FALLBACK = {
  checking: "asset_current",
  savings: "asset_current",
  cash: "asset_current",
  wallet: "asset_current",
  payroll: "asset_current",
  other: "asset_current",
  credit_card: "liability_current",
  credit: "liability_current",
  creditcard: "liability_current",
  loan: "liability_noncurrent",
  mortgage: "liability_noncurrent",
}

export function inferAccountTypeFromLegacyAccount({ balanceSheetType = "", type = "" } = {}) {
  const bsClean = String(balanceSheetType || "").trim().toLowerCase()
  if (LEGACY_BALANCE_SHEET_FALLBACK[bsClean]) return LEGACY_BALANCE_SHEET_FALLBACK[bsClean]

  const typeClean = String(type || "").trim().toLowerCase()
  if (LEGACY_ACCOUNT_TYPE_FALLBACK[typeClean]) return LEGACY_ACCOUNT_TYPE_FALLBACK[typeClean]

  return ""
}

// Used by single-entry → double-entry migration. Maps legacy category.type
// into the new accountType, tolerating the inconsistent casing/plurals
// the old schema accumulated ("expense" / "Operating Expenses" /
// "Cost of Goods Sold" all valid).
const LEGACY_CATEGORY_TYPE_ALIASES = {
  income: "income",
  revenue: "income",
  cost_of_goods_sold: "cost_of_goods_sold",
  "cost of goods sold": "cost_of_goods_sold",
  cogs: "cost_of_goods_sold",
  operating_expense: "operating_expense",
  "operating expense": "operating_expense",
  operating_expenses: "operating_expense",
  "operating expenses": "operating_expense",
  expense: "operating_expense",
  expenses: "operating_expense",
  other_income: "other_income",
  "other income": "other_income",
  non_operating_income: "other_income",
  other_expense: "other_expense",
  "other expense": "other_expense",
  non_operating_expense: "other_expense",
  tax_expense: "tax_expense",
  "tax expense": "tax_expense",
  income_tax: "tax_expense",
  "income tax": "tax_expense",
}

export function inferAccountTypeFromLegacyCategory({ type = "" } = {}) {
  const clean = String(type || "").trim().toLowerCase()
  return LEGACY_CATEGORY_TYPE_ALIASES[clean] || ""
}
