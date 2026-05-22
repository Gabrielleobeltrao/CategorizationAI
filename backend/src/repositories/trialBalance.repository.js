import { getDB } from "../db.js"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Trial Balance = every account in the chart of accounts, side-by-side
// with its total debits and total credits as of a snapshot date. The
// double-entry invariant says SUM(debits) === SUM(credits) for the
// whole ledger; this report makes that check visible.

export async function getTrialBalanceByClientId({ clientId, asOfDate }) {
  const db = getDB()

  const dateFilter = asOfDate
    ? { $lte: asOfDate, $regex: DATE_REGEX }
    : { $regex: DATE_REGEX }

  const [accounts, sums] = await Promise.all([
    db
      .collection("coa_accounts")
      .find({ clientId })
      .sort({ accountType: 1, name: 1 })
      .toArray(),
    db
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
      .toArray(),
  ])

  const sumsMap = new Map(
    sums.map((row) => [String(row._id || ""), {
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
    }]),
  )

  // Each row shows the account's "side": debit-natural accounts (asset/
  // expense) put their net amount in the Debit column; credit-natural
  // accounts (liability/equity/income) put it in the Credit column. If
  // an account is in an unnatural position (overdrawn checking, for
  // example) the other column gets the absolute value instead.
  const rows = accounts.map((acc) => {
    const totals = sumsMap.get(String(acc._id)) || { debit: 0, credit: 0 }
    const net = totals.debit - totals.credit
    const debitNatural = acc.accountType?.startsWith("asset_") || ["operating_expense", "cost_of_goods_sold", "other_expense", "tax_expense"].includes(acc.accountType)
    let debitColumn = 0
    let creditColumn = 0
    if (net > 0) {
      debitColumn = net
    } else if (net < 0) {
      creditColumn = -net
    }
    return {
      accountId: String(acc._id),
      name: acc.name || "",
      accountType: acc.accountType || "",
      naturalSide: debitNatural ? "debit" : "credit",
      debit: debitColumn,
      credit: creditColumn,
    }
  })

  const totalDebits = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredits = rows.reduce((sum, row) => sum + row.credit, 0)

  return {
    asOfDate: asOfDate || null,
    rows,
    totals: {
      debits: totalDebits,
      credits: totalCredits,
      difference: totalDebits - totalCredits,
    },
  }
}
