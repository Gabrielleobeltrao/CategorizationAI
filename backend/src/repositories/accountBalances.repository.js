import { getDB } from "../db.js"

export async function getAccountBalancesByClientId({ clientId, asOfDate }) {
  const db = getDB()

  const accounts = await db
    .collection("account")
    .find({ clientId })
    .sort({ name: 1 })
    .toArray()

  if (accounts.length === 0) return []

  const dateFilter = asOfDate
    ? { $lte: asOfDate, $regex: /^\d{4}-\d{2}-\d{2}$/ }
    : { $regex: /^\d{4}-\d{2}-\d{2}$/ }

  const sums = await db
    .collection("transactions")
    .aggregate([
      { $match: { clientId, date: dateFilter } },
      {
        $group: {
          _id: "$accountId",
          balance: { $sum: "$amount" },
        },
      },
    ])
    .toArray()

  const balanceMap = new Map(sums.map((row) => [String(row._id || ""), Number(row.balance) || 0]))

  return accounts.map((acc) => ({
    accountId: String(acc._id),
    name: acc.name || "",
    type: acc.type || "",
    balance: balanceMap.get(String(acc._id)) || 0,
  }))
}
