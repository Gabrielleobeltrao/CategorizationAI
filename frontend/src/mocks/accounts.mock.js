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
    id: 3,
    clientId: "cli_2",
    name: "Bank of America Business",
    type: "checking",
  },
]

export function getAccountsByClientId(clientId) {
  return accounts.filter((account) => account.clientId === clientId)
}
