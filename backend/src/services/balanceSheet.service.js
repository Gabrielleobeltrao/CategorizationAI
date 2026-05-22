import { getBalanceSheetByClientId } from "../repositories/balanceSheet.repository.js"
import { AppError } from "../utils/appError.js"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_PATTERN.test(value)
}

// Liabilities are stored with a negative sign in single-entry (e.g.
// credit card purchases reduce the account sum). The double-entry
// migration will rewrite this in a later phase; until then we flip the
// sign here so the report shows the amount actually owed as a positive
// figure. Assets and equity keep their raw sign.
function presentBalance(group, rawBalance) {
  if (group === "liability") return -rawBalance
  return rawBalance
}

function groupOf(accountType) {
  if (accountType?.startsWith("asset_")) return "asset"
  if (accountType?.startsWith("liability_")) return "liability"
  if (accountType === "equity") return "equity"
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
    const bucketId = account.accountType || "uncategorized"
    const section = sections[bucketId] || sections.uncategorized
    const group = section.group
    const presented = presentBalance(group, account.rawBalance)

    section.rows.push({
      accountId: account.accountId,
      name: account.name,
      accountType: account.accountType,
      balance: presented,
    })
    section.total += presented
  }

  const retainedEarnings = data.retainedEarnings
  if (retainedEarnings !== 0) {
    sections.equity.rows.push({
      accountId: null,
      name: "Retained Earnings",
      accountType: "equity",
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

export { groupOf }
