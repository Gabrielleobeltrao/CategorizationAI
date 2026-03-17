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
    id: 4,
    clientId: "cli_1",
    name: "Software",
    type: "Operating expenses",
    description: "SaaS and subscriptions",
  },
  {
    id: 5,
    clientId: "cli_1",
    name: "Payroll",
    type: "Operating expenses",
    description: "Employee salaries",
  },
  {
    id: 6,
    clientId: "cli_1",
    name: "Rent",
    type: "Operating expenses",
    description: "Office rent and utilities",
  },
  {
    id: 7,
    clientId: "cli_1",
    name: "Meals",
    type: "Operating expenses",
    description: "Meals and entertainment",
  },
  {
    id: 8,
    clientId: "cli_1",
    name: "Travel",
    type: "Operating expenses",
    description: "Flights, hotels and transport",
  },
  {
    id: 9,
    clientId: "cli_1",
    name: "Bank Fees",
    type: "Operating expenses",
    description: "Bank and payment processor fees",
  },
  {
    id: 10,
    clientId: "cli_1",
    name: "Professional Services",
    type: "Operating expenses",
    description: "Legal and accounting services",
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
