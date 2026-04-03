export const CATEGORY_TYPE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "cost_of_goods_sold", label: "Cost of Goods Sold" },
  { value: "operating_expense", label: "Operating Expense" },
]

const CATEGORY_TYPE_ALIASES = {
  income: "income",
  revenue: "income",
  other_income: "income",
  "other income": "income",
  cost_of_goods_sold: "cost_of_goods_sold",
  "cost of goods sold": "cost_of_goods_sold",
  cogs: "cost_of_goods_sold",
  expense: "operating_expense",
  expenses: "operating_expense",
  operating_expense: "operating_expense",
  operating_expenses: "operating_expense",
  "operating expense": "operating_expense",
  "operating expenses": "operating_expense",
}

export function normalizeCategoryType(value = "") {
  const safe = String(value || "").trim().toLowerCase()
  return CATEGORY_TYPE_ALIASES[safe] || ""
}

export function isValidCategoryType(value = "") {
  return CATEGORY_TYPE_OPTIONS.some((option) => option.value === value)
}

export function getCategoryTypeLabel(value = "") {
  const normalized = normalizeCategoryType(value)
  const matched = CATEGORY_TYPE_OPTIONS.find((option) => option.value === normalized)
  return matched?.label || ""
}
