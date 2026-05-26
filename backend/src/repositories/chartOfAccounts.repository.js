import { getDB } from "../db.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// "Natural side" of an account type — used to flip the sign when
// displaying balances so the user always sees positive numbers for
// healthy accounts (positive cash, positive owed, positive revenue,
// positive expenses, etc.).
function naturalSide(accountType) {
  if (!accountType) return "debit"
  if (accountType.startsWith("asset_")) return "debit"
  if (accountType.startsWith("liability_")) return "credit"
  if (accountType === "equity") return "credit"
  if (accountType === "income" || accountType === "other_income") return "credit"
  return "debit"
}

export async function getChartOfAccountsByClientId({ clientId }) {
  const db = getDB()

  const accounts = await db
    .collection("coa_accounts")
    .find({ clientId })
    .sort({ accountType: 1, name: 1 })
    .toArray()

  const sums = accounts.length
    ? await db
        .collection("journal_entries")
        .aggregate([
          { $match: { clientId, date: { $regex: DATE_REGEX } } },
          { $unwind: "$legs" },
          {
            $group: {
              _id: "$legs.accountId",
              debit: { $sum: "$legs.debit" },
              credit: { $sum: "$legs.credit" },
            },
          },
        ])
        .toArray()
    : []

  const sumsMap = new Map(
    sums.map((row) => [String(row._id || ""), {
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
    }]),
  )

  return accounts.map((acc) => {
    const totals = sumsMap.get(String(acc._id)) || { debit: 0, credit: 0 }
    const balance = naturalSide(acc.accountType) === "debit"
      ? totals.debit - totals.credit
      : totals.credit - totals.debit
    return {
      id: String(acc._id),
      source: "account",
      name: acc.name || "",
      description: typeof acc.description === "string" ? acc.description : "",
      accountType: acc.accountType || "uncategorized",
      isActive: acc.isActive !== false,
      balance,
    }
  })
}
