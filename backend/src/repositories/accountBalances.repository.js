import { getDB } from "../db.js"
import { BALANCE_SHEET_ACCOUNT_TYPES } from "../config/accountTypes.js"

export async function getAccountBalancesByClientId({ clientId, asOfDate }) {
  const db = getDB()

  // Account Balances only shows balance-sheet accounts (cash, bank,
  // credit cards, equity). P&L accounts reset each period and live
  // on the P&L report instead.
  const accounts = await db
    .collection("coa_accounts")
    .find({ clientId, accountType: { $in: BALANCE_SHEET_ACCOUNT_TYPES } })
    .sort({ accountType: 1, name: 1 })
    .toArray()

  if (accounts.length === 0) return []

  const dateFilter = asOfDate
    ? { $lte: asOfDate, $regex: /^\d{4}-\d{2}-\d{2}$/ }
    : { $regex: /^\d{4}-\d{2}-\d{2}$/ }

  const sums = await db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId, date: dateFilter } },
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

  const sumsMap = new Map(
    sums.map((row) => [String(row._id || ""), {
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
    }]),
  )

  return accounts.map((acc) => {
    const totals = sumsMap.get(String(acc._id)) || { debit: 0, credit: 0 }
    return {
      accountId: String(acc._id),
      name: acc.name || "",
      accountType: acc.accountType || "",
      balance: totals.debit - totals.credit,
    }
  })
}
