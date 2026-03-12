const transactions = [
  {
    id: 1,
    clientId: "cli_1",
    date: "2026-03-01",
    amount: 80.4,
    description: "THE HOME DEPOT PURCHASE",
    account: "Chase Business Checking",
    category: "Supplies",
  },
  {
    id: 2,
    clientId: "cli_1",
    date: "2026-03-06",
    amount: 13.5,
    description: "GOOGLE ADS",
    account: "Chase Business Checking",
    category: "Advertising",
  },
  {
    id: 3,
    clientId: "cli_2",
    date: "2026-03-03",
    amount: 55.9,
    description: "STAPLES OFFICE MATERIAL",
    account: "Bank of America Business",
    category: "Office supplies",
  },
]

export function getTransactionsByClientId(clientId) {
  return transactions.filter((transaction) => transaction.clientId === clientId)
}
