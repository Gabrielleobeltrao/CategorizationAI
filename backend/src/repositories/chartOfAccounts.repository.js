import { getDB } from "../db.js"
import { inferBalanceSheetType } from "../config/balanceSheetTypes.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function getChartOfAccountsByClientId({ clientId }) {
  const db = getDB()

  const [accounts, categories] = await Promise.all([
    db.collection("account").find({ clientId }).sort({ name: 1 }).toArray(),
    db.collection("categories").find({ clientId }).sort({ name: 1 }).toArray(),
  ])

  const balanceFilter = { clientId, date: { $regex: DATE_REGEX } }

  const [accountSums, categorySums] = await Promise.all([
    accounts.length
      ? db
          .collection("transactions")
          .aggregate([
            { $match: balanceFilter },
            { $group: { _id: "$accountId", balance: { $sum: "$amount" } } },
          ])
          .toArray()
      : [],
    categories.length
      ? db
          .collection("transactions")
          .aggregate([
            { $match: balanceFilter },
            {
              $project: {
                splitItems: {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ["$splits", []] } }, 0] },
                    "$splits",
                    [{ amount: "$amount", categoryId: "$categoryId" }],
                  ],
                },
              },
            },
            { $unwind: "$splitItems" },
            {
              $group: {
                _id: "$splitItems.categoryId",
                total: { $sum: "$splitItems.amount" },
              },
            },
          ])
          .toArray()
      : [],
  ])

  const accountBalanceMap = new Map(
    accountSums.map((row) => [String(row._id || ""), Number(row.balance) || 0]),
  )
  const categoryTotalMap = new Map(
    categorySums.map((row) => [String(row._id || ""), Number(row.total) || 0]),
  )

  const accountRows = accounts.map((acc) => {
    const bsType = inferBalanceSheetType({
      balanceSheetType: acc.balanceSheetType,
      type: acc.type,
    })
    return {
      id: String(acc._id),
      source: "account",
      name: acc.name || "",
      subtypeLabel: acc.type || "",
      group: bsType || "uncategorized",
      balanceSheetType: bsType,
      isInferred: !acc.balanceSheetType,
      balance: accountBalanceMap.get(String(acc._id)) || 0,
    }
  })

  const categoryRows = categories.map((cat) => ({
    id: String(cat._id),
    source: "category",
    name: cat.name || "",
    subtypeLabel: "",
    group: cat.type || "uncategorized",
    balanceSheetType: null,
    isInferred: false,
    balance: categoryTotalMap.get(String(cat._id)) || 0,
  }))

  return [...accountRows, ...categoryRows]
}
