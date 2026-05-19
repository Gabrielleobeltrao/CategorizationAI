import { getDB } from "../db.js"
import { inferBalanceSheetType } from "../config/balanceSheetTypes.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function buildDateFilter(asOfDate) {
  if (asOfDate) {
    return { $lte: asOfDate, $regex: DATE_REGEX }
  }
  return { $regex: DATE_REGEX }
}

export async function getBalanceSheetByClientId({ clientId, asOfDate }) {
  const db = getDB()

  const accounts = await db
    .collection("account")
    .find({ clientId })
    .sort({ name: 1 })
    .toArray()

  const accountSums = accounts.length
    ? await db
        .collection("transactions")
        .aggregate([
          { $match: { clientId, date: buildDateFilter(asOfDate) } },
          {
            $group: {
              _id: "$accountId",
              balance: { $sum: "$amount" },
            },
          },
        ])
        .toArray()
    : []

  const balanceMap = new Map(accountSums.map((row) => [String(row._id || ""), Number(row.balance) || 0]))

  const accountRows = accounts.map((acc) => {
    const inferred = inferBalanceSheetType({
      balanceSheetType: acc.balanceSheetType,
      type: acc.type,
    })
    return {
      accountId: String(acc._id),
      name: acc.name || "",
      type: acc.type || "",
      balanceSheetType: inferred,
      isInferred: !acc.balanceSheetType,
      rawBalance: balanceMap.get(String(acc._id)) || 0,
    }
  })

  // Retained Earnings = cumulative net income (sum of all categorized transactions
  // up to the snapshot date). Uses the category type to ensure only revenue / COGS
  // / operating expenses contribute — equity-account movements don't double-count.
  const retainedEarningsAgg = await db
    .collection("transactions")
    .aggregate([
      { $match: { clientId, date: buildDateFilter(asOfDate) } },
      {
        $set: {
          categoryObjectId: {
            $convert: { input: "$categoryId", to: "objectId", onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryObjectId",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      {
        $project: {
          amount: 1,
          categoryType: { $first: "$categoryDoc.type" },
        },
      },
      {
        $match: {
          categoryType: {
            $in: [
              "income",
              "cost_of_goods_sold",
              "operating_expense",
              "other_income",
              "other_expense",
              "tax_expense",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          retained: { $sum: "$amount" },
        },
      },
    ])
    .toArray()

  const retainedEarnings = Number(retainedEarningsAgg?.[0]?.retained || 0)

  return {
    asOfDate: asOfDate || null,
    accounts: accountRows,
    retainedEarnings,
  }
}
