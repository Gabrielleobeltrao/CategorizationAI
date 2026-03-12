const categories = [
  {
    id: 1,
    clientId: "cli_1",
    name: "Supplies",
    type: "Cost of goods sold",
    description: "Materials and supplies",
  },
  {
    id: 2,
    clientId: "cli_1",
    name: "Advertising",
    type: "Operating expenses",
    description: "Ads and promotion",
  },
  {
    id: 3,
    clientId: "cli_2",
    name: "Office supplies",
    type: "Operating expenses",
    description: "Office material",
  },
]

export function getCategoriesByClientId(clientId) {
  return categories.filter((category) => category.clientId === clientId)
}
