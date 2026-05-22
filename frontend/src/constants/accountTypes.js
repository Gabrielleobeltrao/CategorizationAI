// Mirror of backend/src/config/accountTypes.js. Every account in the
// unified Chart of Accounts has exactly one of these accountType values
// after the double-entry migration.
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

export const ACCOUNT_TYPE_LABELS = Object.fromEntries(
    ACCOUNT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export const PNL_ACCOUNT_TYPES = ACCOUNT_TYPE_OPTIONS
    .filter((option) => ["income", "expense"].includes(option.parent))
    .map((option) => option.value)

export const BALANCE_SHEET_ACCOUNT_TYPES = ACCOUNT_TYPE_OPTIONS
    .filter((option) => ["asset", "liability", "equity"].includes(option.parent))
    .map((option) => option.value)
