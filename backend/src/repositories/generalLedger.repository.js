import { getDB } from "../db.js"
import { ObjectId } from "mongodb"

// General Ledger = full chronological detail of every journal-entry leg
// that touched a given account, with a running balance computed on the
// account's natural side. The classic "show me every movement in
// Office Rent for March" report.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value) {
  return typeof value === "string" && DATE_REGEX.test(value)
}

function naturalSide(accountType) {
  if (!accountType) return "debit"
  if (accountType.startsWith("asset_")) return "debit"
  if (accountType.startsWith("liability_")) return "credit"
  if (accountType === "equity") return "credit"
  if (accountType === "income" || accountType === "other_income") return "credit"
  return "debit"
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

// Sum of (debit - credit) for the given account across all entries
// strictly BEFORE fromDate. Used to compute the opening balance.
async function sumLegsBefore(db, clientId, accountId, beforeDate) {
  const match = {
    clientId,
    "legs.accountId": accountId,
    date: { $regex: DATE_REGEX },
  }
  if (beforeDate) match.date.$lt = beforeDate

  const result = await db
    .collection("journal_entries")
    .aggregate([
      { $match: match },
      { $unwind: "$legs" },
      { $match: { "legs.accountId": accountId } },
      {
        $group: {
          _id: null,
          debit: { $sum: "$legs.debit" },
          credit: { $sum: "$legs.credit" },
        },
      },
    ])
    .toArray()

  const row = result[0]
  return {
    debit: Number(row?.debit || 0),
    credit: Number(row?.credit || 0),
  }
}

export async function getGeneralLedgerByAccount({
  clientId,
  accountId,
  fromDate,
  toDate,
} = {}) {
  if (!clientId) throw new TypeError("clientId is required")
  if (!accountId) throw new TypeError("accountId is required")
  if (fromDate && !isValidDate(fromDate)) {
    throw new TypeError("fromDate must be YYYY-MM-DD")
  }
  if (toDate && !isValidDate(toDate)) {
    throw new TypeError("toDate must be YYYY-MM-DD")
  }

  const db = getDB()
  const account = await db
    .collection("coa_accounts")
    .findOne({ _id: new ObjectId(String(accountId)) })
  if (!account) {
    throw new TypeError("Account not found")
  }
  if (String(account.clientId) !== String(clientId)) {
    throw new TypeError("Account does not belong to this client")
  }

  const side = naturalSide(account.accountType)
  const before = await sumLegsBefore(db, String(clientId), String(accountId), fromDate)
  const openingNet = before.debit - before.credit
  const openingBalance = side === "debit" ? openingNet : -openingNet

  // Fetch all entries in range that touch this account.
  const dateClause = { $regex: DATE_REGEX }
  if (fromDate) dateClause.$gte = fromDate
  if (toDate) dateClause.$lte = toDate

  const entries = await db
    .collection("journal_entries")
    .find({
      clientId: String(clientId),
      "legs.accountId": String(accountId),
      date: dateClause,
    })
    .sort({ date: 1, _id: 1 })
    .toArray()

  let running = openingBalance
  let totalDebit = 0
  let totalCredit = 0
  const rows = []
  for (const entry of entries) {
    for (let i = 0; i < (entry.legs || []).length; i += 1) {
      const leg = entry.legs[i]
      if (String(leg.accountId) !== String(accountId)) continue
      const debit = Number(leg.debit || 0)
      const credit = Number(leg.credit || 0)
      const net = debit - credit
      // Running balance flips depending on natural side so positive
      // numbers always mean "the account got fuller" (asset increasing,
      // liability increasing, expense growing, etc.).
      running += side === "debit" ? net : -net
      totalDebit += debit
      totalCredit += credit
      rows.push({
        entryId: String(entry._id),
        legIndex: i,
        date: entry.date,
        description: entry.description || "",
        lineDescription: typeof leg.description === "string" ? leg.description : "",
        source: entry.source || "manual",
        debit: round2(debit),
        credit: round2(credit),
        runningBalance: round2(running),
      })
    }
  }

  return {
    account: {
      id: String(account._id),
      name: account.name || "",
      accountType: account.accountType || "",
      naturalSide: side,
    },
    fromDate: fromDate || null,
    toDate: toDate || null,
    openingBalance: round2(openingBalance),
    closingBalance: round2(running),
    totals: {
      debit: round2(totalDebit),
      credit: round2(totalCredit),
    },
    rows,
  }
}
