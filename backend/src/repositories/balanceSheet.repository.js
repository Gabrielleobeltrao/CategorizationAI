import { getDB } from "../db.js"
import { BALANCE_SHEET_ACCOUNT_TYPES, PNL_ACCOUNT_TYPES } from "../config/accountTypes.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function buildDateFilter(asOfDate) {
  if (asOfDate) {
    return { $lte: asOfDate, $regex: DATE_REGEX }
  }
  return { $regex: DATE_REGEX }
}

// For each balance-sheet account, total of net debits − net credits.
// Assets/expenses are debit-natural so their displayed balance =
// debits − credits. Liabilities/equity are credit-natural — the
// service layer flips the sign for presentation.
async function getAccountNetDebits({ clientId, asOfDate }) {
  const db = getDB()
  return db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId, date: buildDateFilter(asOfDate) } },
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
}

export async function getBalanceSheetByClientId({ clientId, asOfDate }) {
  const db = getDB()

  const accounts = await db
    .collection("coa_accounts")
    .find({ clientId, accountType: { $in: BALANCE_SHEET_ACCOUNT_TYPES } })
    .sort({ accountType: 1, name: 1 })
    .toArray()

  const sums = accounts.length ? await getAccountNetDebits({ clientId, asOfDate }) : []
  const sumsMap = new Map(
    sums.map((row) => [String(row._id || ""), {
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
    }]),
  )

  const accountRows = accounts.map((acc) => {
    const totals = sumsMap.get(String(acc._id)) || { debit: 0, credit: 0 }
    return {
      accountId: String(acc._id),
      name: acc.name || "",
      accountType: acc.accountType || "",
      // Raw debit − credit. Service layer flips sign for liabilities/
      // equity so the user sees "owed amount" / "capital" as positive.
      rawBalance: totals.debit - totals.credit,
    }
  })

  // Retained Earnings = cumulative net income up to the snapshot date.
  // Income/other_income legs naturally credit (so net credit = revenue);
  // expense legs naturally debit (so net debit = total cost).
  // Net income = (credits − debits) on income types + (debits − credits)
  // on expense types, all flipped so a profitable period feeds equity.
  const pnlAgg = await db
    .collection("journal_entries")
    .aggregate([
      { $match: { clientId, date: buildDateFilter(asOfDate) } },
      { $unwind: "$legs" },
      {
        $set: {
          accountObjectId: {
            $convert: { input: "$legs.accountId", to: "objectId", onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: "coa_accounts",
          localField: "accountObjectId",
          foreignField: "_id",
          as: "accountDoc",
        },
      },
      {
        $project: {
          debit: "$legs.debit",
          credit: "$legs.credit",
          accountType: { $first: "$accountDoc.accountType" },
        },
      },
      { $match: { accountType: { $in: PNL_ACCOUNT_TYPES } } },
      {
        $group: {
          _id: "$accountType",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" },
        },
      },
    ])
    .toArray()

  let retainedEarnings = 0
  for (const row of pnlAgg) {
    const debit = Number(row.debit || 0)
    const credit = Number(row.credit || 0)
    if (row._id === "income" || row._id === "other_income") {
      retainedEarnings += credit - debit
    } else {
      retainedEarnings -= debit - credit
    }
  }

  return {
    asOfDate: asOfDate || null,
    accounts: accountRows,
    retainedEarnings,
  }
}
