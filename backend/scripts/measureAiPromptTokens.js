/* eslint-disable no-console */
// Builds the exact prompt that categorizeTransaction.js sends and
// reports input/output token estimates so we know the real-world
// token cost of the rewritten prompt.

import "dotenv/config"
import { MongoClient } from "mongodb"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYNTHETIC = [
  { id: "t1", description: "GOOGLE ADS PAYMENT 5544", amount: -480 },
  { id: "t2", description: "FACEBOOK ADS 13441", amount: -220 },
  { id: "t3", description: "AMAZON WEB SERVICES BILL", amount: -210 },
  { id: "t4", description: "FIGMA PROFESSIONAL", amount: -45 },
  { id: "t5", description: "WEWORK OFFICE RENT MARCH", amount: -890 },
  { id: "t6", description: "COMCAST INTERNET BILL", amount: -150 },
  { id: "t7", description: "UBER EATS DOWNTOWN", amount: -38.5 },
  { id: "t8", description: "STARBUCKS #4321", amount: -8.75 },
  { id: "t9", description: "DELTA AIRLINES TICKET", amount: -560 },
  { id: "t10", description: "MARRIOTT HOTEL CHICAGO", amount: -340 },
  { id: "t11", description: "SHELL OIL #4422", amount: -65.1 },
  { id: "t12", description: "EZ-PASS NJ TURNPIKE", amount: -12 },
  { id: "t13", description: "ADP PAYROLL RUN", amount: -8500 },
  { id: "t14", description: "ANTHEM HEALTH INSURANCE", amount: -1200 },
  { id: "t15", description: "STAPLES OFFICE SUPPLIES", amount: -85 },
  { id: "t16", description: "HARTFORD BUSINESS INSURANCE", amount: -420 },
  { id: "t17", description: "STRIPE PAYOUT", amount: 4250 },
  { id: "t18", description: "ACH FROM JOHN SMITH - CONSULTING", amount: 3500 },
  { id: "t19", description: "SHOPIFY PAYOUT - APRIL", amount: 980 },
  { id: "t20", description: "INTEREST EARNED 0.04%", amount: 4.12 },
]

const ACCOUNT_TYPE_HUMAN = {
  income: "Income (revenue earned from main business activity)",
  cost_of_goods_sold: "Cost of Goods Sold (direct cost of products/services sold)",
  operating_expense: "Operating Expense (recurring costs to run the business: rent, marketing, software, utilities…)",
  other_income: "Other Income (non-operating income: interest received, gains, refunds)",
  other_expense: "Other Expense (non-operating expense: interest paid, bank fees, one-off losses)",
  tax_expense: "Tax Expense (income tax, distinct from operating expenses)",
}

function promptAccounts(accounts) {
  return accounts
    .map((a) => {
      const d = String(a.description || "").trim()
      const hint = d ? ` | description: ${d}` : ""
      return `id: ${a._id} | name: ${a.name} | type: ${a.accountType}${hint}`
    })
    .join("\n")
}

function promptTransactions(txs) {
  return txs
    .map((t) => {
      const direction = Number(t.amount) >= 0 ? "money_in" : "money_out"
      return `id: ${t.id} | description: ${t.description} | amount: ${t.amount} (${direction})`
    })
    .join("\n")
}

function describeAccountTypesUsed(accounts) {
  const types = new Set(accounts.map((a) => a.accountType))
  return [...types].map((t) => `- ${t}: ${ACCOUNT_TYPE_HUMAN[t] || ""}`).join("\n")
}

const SYSTEM_PROMPT =
  "You are an accountant for Test Client. Business type: service business. Main activity: general operations. Each bank transaction must be assigned to exactly one P&L account from the chart of accounts. Read every account's description carefully — those descriptions are the user's authoritative hint about when an account applies. Match transaction descriptions to account descriptions first; the account type guides direction (money_in → income/other_income; money_out → expense types)."

function userPrompt(accounts, txs) {
  return `
Account types in this batch:
${describeAccountTypesUsed(accounts)}

Available accounts (read the descriptions carefully — they're the user's instructions for when each account applies):
${promptAccounts(accounts)}

Transactions to categorize:
${promptTransactions(txs)}

Return ONLY valid JSON in this format:
{
  "results": [
    { "id": "transaction-id", "accountId": "account-id-or-empty", "confidence": 0.0, "ambiguous": false }
  ]
}

Rules:
- accountId must be exactly one of the available account ids.
- if unclear, leave accountId as "".
- confidence must be a number from 0 to 1 reflecting how certain you are.
- historical_hint is optional compact history from prior client patterns — treat as supporting evidence, not decisive.
- ambiguous must be true when the description could reasonably fit more than one account.
- if ambiguous is true, prefer accountId = "" unless the description is still clearly decisive.
- if confidence is low, prefer accountId = "".
- money_in transactions must use income / other_income accounts. money_out transactions must use cost_of_goods_sold / operating_expense / other_expense / tax_expense accounts. Never mix directions.
- every transaction id in this batch should appear once in the output.
              `.trim()
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)

  const sample = await db
    .collection("coa_accounts")
    .findOne({ accountType: { $in: ["income", "operating_expense", "cost_of_goods_sold"] } })
  const clientId = sample.clientId

  const accounts = await db
    .collection("coa_accounts")
    .find({
      clientId,
      accountType: {
        $in: ["income", "cost_of_goods_sold", "operating_expense", "other_income", "other_expense", "tax_expense"],
      },
    })
    .toArray()

  console.log(`Sample size: ${accounts.length} P&L accounts, ${SYNTHETIC.length} transactions (one batch)\n`)

  const sys = SYSTEM_PROMPT
  const usr = userPrompt(accounts, SYNTHETIC)

  // Char counts — gpt tokenizer roughly 1 token ≈ 4 chars for English.
  const sysChars = sys.length
  const usrChars = usr.length

  console.log("=".repeat(60))
  console.log("CHAR / TOKEN ESTIMATE (1 token ≈ 4 chars heuristic)")
  console.log("=".repeat(60))
  console.log(`System message:  ${sysChars} chars  ≈ ${Math.round(sysChars / 4)} tokens`)
  console.log(`User message:    ${usrChars} chars  ≈ ${Math.round(usrChars / 4)} tokens`)
  console.log(`Total input:     ${sysChars + usrChars} chars  ≈ ${Math.round((sysChars + usrChars) / 4)} tokens`)

  // Real measurement via actual API call (more accurate but costs $)
  console.log("\nMaking a real API call to measure exact token usage...")
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
    max_tokens: 1500,
  })
  const usage = response.usage
  console.log("\n" + "=".repeat(60))
  console.log("REAL TOKEN USAGE (from OpenAI)")
  console.log("=".repeat(60))
  console.log(`Input tokens:    ${usage.prompt_tokens}`)
  console.log(`Output tokens:   ${usage.completion_tokens}`)
  console.log(`Total tokens:    ${usage.total_tokens}`)

  // Cost (gpt-4.1-mini pricing)
  const inputPricePerM = 0.40
  const outputPricePerM = 1.60
  const inputCost = (usage.prompt_tokens / 1_000_000) * inputPricePerM
  const outputCost = (usage.completion_tokens / 1_000_000) * outputPricePerM
  console.log(`\nCost per call (gpt-4.1-mini):`)
  console.log(`  input:  $${inputCost.toFixed(6)}`)
  console.log(`  output: $${outputCost.toFixed(6)}`)
  console.log(`  total:  $${(inputCost + outputCost).toFixed(6)}`)

  console.log(`\nProjections (assuming same shape):`)
  console.log(`  100 batches/month:    $${((inputCost + outputCost) * 100).toFixed(3)}`)
  console.log(`  1,000 batches/month:  $${((inputCost + outputCost) * 1000).toFixed(2)}`)
  console.log(`  10,000 batches/month: $${((inputCost + outputCost) * 10000).toFixed(2)}`)

  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
