const clients = [
  {
    id: "cli_1",
    officeId: "off_1",
    name: "VB Construction LLC",
    businessType: "1120",
    state: "florida",
  },
  {
    id: "cli_2",
    officeId: "off_1",
    name: "Coastal Painting Inc",
    businessType: "1120",
    state: "texas",
  },
  {
    id: "cli_3",
    officeId: "off_2",
    name: "Northside Electric",
    businessType: "1120",
    state: "georgia",
  },
]

export function getClientsByOfficeId(officeId) {
  return clients.filter((client) => client.officeId === officeId)
}
