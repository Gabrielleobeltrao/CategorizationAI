import { getChartOfAccountsByClientId } from "../repositories/chartOfAccounts.repository.js"
import { AppError } from "../utils/appError.js"

const GROUPS = [
  { id: "asset_current", label: "Current Assets", code: "1100", parent: "asset" },
  { id: "asset_noncurrent", label: "Non-current Assets", code: "1200", parent: "asset" },
  { id: "liability_current", label: "Current Liabilities", code: "2100", parent: "liability" },
  { id: "liability_noncurrent", label: "Non-current Liabilities", code: "2200", parent: "liability" },
  { id: "equity", label: "Equity", code: "3000", parent: "equity" },
  { id: "income", label: "Income", code: "4000", parent: "income" },
  { id: "cost_of_goods_sold", label: "Cost of Goods Sold", code: "5000", parent: "expense" },
  { id: "operating_expense", label: "Operating Expenses", code: "6000", parent: "expense" },
  { id: "uncategorized", label: "Uncategorized", code: "9999", parent: "other" },
]

const PARENT_LABELS = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
  other: "Other",
}

export async function getChartOfAccountsService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)

  const rows = await getChartOfAccountsByClientId({ clientId })

  const groupsMap = new Map(GROUPS.map((group) => [group.id, { ...group, items: [] }]))
  for (const row of rows) {
    const bucket = groupsMap.get(row.group) || groupsMap.get("uncategorized")
    bucket.items.push(row)
  }

  // Sort items within each group by source then name, then assign sequential
  // numeric codes (e.g. 1110, 1120…) so the page reads like a familiar CoA.
  const groups = GROUPS
    .map((group) => groupsMap.get(group.id))
    .filter((group) => group.items.length > 0 || group.id !== "uncategorized")
    .map((group) => {
      const sortedItems = [...group.items].sort((a, b) => {
        if (a.source !== b.source) return a.source === "account" ? -1 : 1
        return String(a.name).localeCompare(String(b.name))
      })
      const items = sortedItems.map((item, index) => ({
        ...item,
        code: `${group.code.slice(0, 2)}${String(10 + index * 10).padStart(2, "0")}`,
      }))
      const total = items.reduce((sum, item) => sum + Number(item.balance || 0), 0)
      return {
        id: group.id,
        label: group.label,
        code: group.code,
        parent: group.parent,
        parentLabel: PARENT_LABELS[group.parent] || "",
        items,
        total,
      }
    })

  return { groups }
}
