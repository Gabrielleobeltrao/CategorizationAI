export const BALANCE_SHEET_TYPE_OPTIONS = [
  { value: "asset_current", label: "Current Asset", group: "asset" },
  { value: "asset_noncurrent", label: "Non-current Asset", group: "asset" },
  { value: "liability_current", label: "Current Liability", group: "liability" },
  { value: "liability_noncurrent", label: "Non-current Liability", group: "liability" },
  { value: "equity", label: "Equity", group: "equity" },
]

export const BALANCE_SHEET_TYPE_VALUES = BALANCE_SHEET_TYPE_OPTIONS.map((option) => option.value)

const ACCOUNT_TYPE_FALLBACK = {
  checking: "asset_current",
  savings: "asset_current",
  cash: "asset_current",
  credit_card: "liability_current",
  loan: "liability_noncurrent",
}

export function inferBalanceSheetType({ balanceSheetType = "", type = "" } = {}) {
  const safe = String(balanceSheetType || "").trim().toLowerCase()
  if (BALANCE_SHEET_TYPE_VALUES.includes(safe)) return safe

  const fallback = ACCOUNT_TYPE_FALLBACK[String(type || "").trim().toLowerCase()]
  return fallback || ""
}

export function isValidBalanceSheetType(value = "") {
  return BALANCE_SHEET_TYPE_VALUES.includes(String(value || "").trim().toLowerCase())
}
