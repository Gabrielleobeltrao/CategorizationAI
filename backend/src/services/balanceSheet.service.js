import { getBalanceSheetByClientId } from "../repositories/balanceSheet.repository.js"
import { AppError } from "../utils/appError.js"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value)
}

// Liabilities are stored with a negative sign in single-entry (e.g. credit card
// purchases reduce the account sum); flip them so the report shows the amount
// actually owed as a positive figure. Asset and equity accounts keep their raw
// sign so an overdrawn checking account still shows up as negative.
function presentBalance(group, rawBalance) {
  if (group === "liability") return -rawBalance
  return rawBalance
}

function groupOf(balanceSheetType) {
  if (balanceSheetType?.startsWith("asset_")) return "asset"
  if (balanceSheetType?.startsWith("liability_")) return "liability"
  if (balanceSheetType === "equity") return "equity"
  return "uncategorized"
}

export async function getBalanceSheetReportService({ clientId, asOfDate }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new AppError("asOfDate must be YYYY-MM-DD", 400)
  }

  const data = await getBalanceSheetByClientId({ clientId, asOfDate })

  const sections = {
    asset_current: { id: "asset_current", label: "Current Assets", group: "asset", rows: [], total: 0 },
    asset_noncurrent: { id: "asset_noncurrent", label: "Non-current Assets", group: "asset", rows: [], total: 0 },
    liability_current: { id: "liability_current", label: "Current Liabilities", group: "liability", rows: [], total: 0 },
    liability_noncurrent: { id: "liability_noncurrent", label: "Non-current Liabilities", group: "liability", rows: [], total: 0 },
    equity: { id: "equity", label: "Equity", group: "equity", rows: [], total: 0 },
    uncategorized: { id: "uncategorized", label: "Uncategorized", group: "uncategorized", rows: [], total: 0 },
  }

  for (const account of data.accounts) {
    const bsType = account.balanceSheetType || "uncategorized"
    const section = sections[bsType] || sections.uncategorized
    const group = section.group
    const presented = presentBalance(group, account.rawBalance)

    section.rows.push({
      accountId: account.accountId,
      name: account.name,
      type: account.type,
      balanceSheetType: bsType,
      isInferred: account.isInferred,
      balance: presented,
    })
    section.total += presented
  }

  const retainedEarnings = data.retainedEarnings
  if (retainedEarnings !== 0) {
    sections.equity.rows.push({
      accountId: null,
      name: "Retained Earnings",
      type: "",
      balanceSheetType: "equity",
      isInferred: false,
      balance: retainedEarnings,
      isDerived: true,
    })
    sections.equity.total += retainedEarnings
  }

  const totalAssets = sections.asset_current.total + sections.asset_noncurrent.total
  const totalLiabilities = sections.liability_current.total + sections.liability_noncurrent.total
  const totalEquity = sections.equity.total
  const totalUncategorized = sections.uncategorized.total
  const liabilitiesPlusEquity = totalLiabilities + totalEquity
  const difference = totalAssets - liabilitiesPlusEquity

  return {
    asOfDate: asOfDate || null,
    sections: [
      sections.asset_current,
      sections.asset_noncurrent,
      sections.liability_current,
      sections.liability_noncurrent,
      sections.equity,
      ...(sections.uncategorized.rows.length > 0 ? [sections.uncategorized] : []),
    ],
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      uncategorized: totalUncategorized,
      liabilitiesPlusEquity,
      difference,
    },
    retainedEarnings,
  }
}

// re-export so route imports work even if not currently used
export { groupOf }
