/* eslint-disable no-console */
// Seeds a realistic chart of accounts on the test client used by
// testAiPrompt.js. Idempotent: skips accounts that already exist
// (matched by name within the same clientId).

import "dotenv/config"
import { MongoClient } from "mongodb"

const ACCOUNTS = [
  // Assets (current)
  { name: "Chase Business Checking", accountType: "asset_current", description: "Primary business checking account at Chase. All operational cash movements run through here." },
  { name: "Cash on Hand", accountType: "asset_current", description: "Petty cash kept in the office, not yet deposited in the bank." },

  // Liabilities (current)
  { name: "Amex Business Card", accountType: "liability_current", description: "Business credit card. Charges show up as expenses on this card until paid off from the bank." },

  // Equity
  { name: "Owner's Capital", accountType: "equity", description: "Owner contributions of capital into the business. Initial investment plus any later cash injections from the owner." },

  // Income
  { name: "Service Revenue", accountType: "income", description: "Payments received from clients for services rendered. Stripe payouts, client checks, ACH deposits from customers." },
  { name: "Product Sales", accountType: "income", description: "Revenue from selling physical or digital products. Shopify, Amazon, Etsy payouts." },
  { name: "Subscription Revenue", accountType: "income", description: "Recurring monthly/annual subscription income from customers." },

  // Cost of Goods Sold
  { name: "Materials & Supplies", accountType: "cost_of_goods_sold", description: "Raw materials, supplies, inventory directly tied to delivering the product or service. Home Depot, suppliers, distributors." },
  { name: "Contractor Payments", accountType: "cost_of_goods_sold", description: "Payments to subcontractors and freelancers who directly produced the work for clients. 1099 contractors." },
  { name: "Shipping & Fulfillment", accountType: "cost_of_goods_sold", description: "USPS, UPS, FedEx, DHL shipping costs and packaging materials for delivering products to customers." },

  // Operating Expenses
  { name: "Software & Subscriptions", accountType: "operating_expense", description: "SaaS tools, cloud services, software licenses. AWS, Google Workspace, Slack, Notion, Figma, GitHub, Adobe, Microsoft 365." },
  { name: "Advertising & Marketing", accountType: "operating_expense", description: "Paid ads and marketing spend. Google Ads, Facebook Ads, LinkedIn Ads, Instagram, TikTok, sponsored content." },
  { name: "Office Rent", accountType: "operating_expense", description: "Monthly office or co-working space lease payments. WeWork, Regus, landlord rent checks." },
  { name: "Utilities", accountType: "operating_expense", description: "Electricity, water, internet, phone. Comcast, Verizon, AT&T, ConEd, water bills." },
  { name: "Meals & Entertainment", accountType: "operating_expense", description: "Business meals with clients or team, coffee shops, restaurants when working. Uber Eats, DoorDash, Starbucks, Chipotle." },
  { name: "Travel", accountType: "operating_expense", description: "Business travel: airlines, hotels, rideshare, train tickets. United, Delta, Marriott, Hilton, Uber, Lyft, AirBnB." },
  { name: "Fuel & Vehicle", accountType: "operating_expense", description: "Gas, vehicle maintenance, parking, tolls. Shell, BP, Exxon, parking garages, EZ-Pass." },
  { name: "Payroll & Wages", accountType: "operating_expense", description: "Employee salaries, wages, and payroll taxes. Gusto, ADP, Rippling, direct paychecks to employees." },
  { name: "Employee Benefits", accountType: "operating_expense", description: "Health insurance, retirement contributions, employee perks. Anthem, BlueCross, 401k contributions." },
  { name: "Professional Services", accountType: "operating_expense", description: "Legal, accounting, consulting fees. Lawyers, CPAs, business consultants, bookkeepers." },
  { name: "Office Supplies", accountType: "operating_expense", description: "Pens, paper, printer ink, desk supplies. Staples, Office Depot, Amazon office products." },
  { name: "Insurance", accountType: "operating_expense", description: "Business insurance: general liability, professional liability, cyber, property. Hiscox, The Hartford, State Farm Business." },
  { name: "Repairs & Maintenance", accountType: "operating_expense", description: "Office or equipment repair and maintenance services." },
  { name: "Dues & Subscriptions", accountType: "operating_expense", description: "Industry memberships, professional associations, magazine subscriptions, paid newsletters." },

  // Other Income
  { name: "Interest Income", accountType: "other_income", description: "Interest earned on savings accounts, money market accounts, or short-term investments." },
  { name: "Refunds & Rebates", accountType: "other_income", description: "Refunds received from vendors, returned purchases credited back, rebate checks." },

  // Other Expense
  { name: "Bank Fees", accountType: "other_expense", description: "Monthly bank service charges, wire fees, ACH fees, overdraft fees. Bank of America, Chase, Wells Fargo fees." },
  { name: "Interest Expense", accountType: "other_expense", description: "Interest paid on business loans, lines of credit, and credit card carrying balance." },
  { name: "Penalties & Late Fees", accountType: "other_expense", description: "Late payment penalties, IRS late fees, missed bill penalties." },

  // Tax Expense
  { name: "Federal Income Tax", accountType: "tax_expense", description: "IRS federal income tax payments, quarterly estimated taxes, year-end true-up." },
  { name: "State Income Tax", accountType: "tax_expense", description: "State income tax payments. CA FTB, NY DOR, etc." },
]

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)

  // Accepts --clientId=<id> to target a specific client. Without it,
  // falls back to the first client that already has any P&L account.
  const clientIdArg = process.argv.find((arg) => arg.startsWith("--clientId="))
  let testClientId = clientIdArg ? clientIdArg.split("=")[1] : null
  if (!testClientId) {
    const anyPnL = await db
      .collection("coa_accounts")
      .findOne({ accountType: { $in: ["income", "operating_expense", "cost_of_goods_sold"] } })
    if (anyPnL) {
      testClientId = anyPnL.clientId
    } else {
      const anyClient = await db.collection("clients").findOne({})
      testClientId = anyClient ? String(anyClient._id) : null
    }
  }
  if (!testClientId) {
    console.error("No client found in the DB.")
    process.exit(1)
  }
  console.log(`Seeding CoA for clientId=${testClientId}\n`)

  let inserted = 0
  let skipped = 0
  for (const def of ACCOUNTS) {
    const existing = await db.collection("coa_accounts").findOne({
      clientId: testClientId,
      name: def.name,
    })
    if (existing) {
      skipped += 1
      continue
    }
    await db.collection("coa_accounts").insertOne({
      clientId: testClientId,
      name: def.name,
      accountType: def.accountType,
      description: def.description,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    inserted += 1
  }

  console.log(`Inserted ${inserted}, skipped ${skipped} (already existed)`)
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err)
  process.exit(1)
})
