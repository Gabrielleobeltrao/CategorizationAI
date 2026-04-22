const accounts = [
  {
    id: 1,
    clientId: "cli_1",
    name: "Chase Business Checking",
    type: "checking",
  },
  {
    id: 2,
    clientId: "cli_1",
    name: "Amex Business Card",
    type: "credit",
  },
  {
    id: 4,
    clientId: "cli_1",
    name: "Mercury Operating",
    type: "checking",
  },
  {
    id: 5,
    clientId: "cli_1",
    name: "BofA Payroll",
    type: "checking",
  },
  {
    id: 6,
    clientId: "cli_1",
    name: "Stripe Clearing",
    type: "clearing",
  },
  {
    id: 7,
    clientId: "cli_1",
    name: "Petty Cash",
    type: "cash",
  },
  {
    id: 8,
    clientId: "cli_1",
    name: "Capital One Spark",
    type: "credit",
  },
  {
    id: 9,
    clientId: "cli_1",
    name: "Wells Fargo Reserve",
    type: "savings",
  },
  {
    id: 10,
    clientId: "cli_1",
    name: "PayPal Balance",
    type: "wallet",
  },
  {
    id: 3,
    clientId: "cli_2",
    name: "Bank of America Business",
    type: "checking",
  },
]

export function getAccountsByClientId(clientId) {
  return accounts.filter((account) => account.clientId === clientId)
}
