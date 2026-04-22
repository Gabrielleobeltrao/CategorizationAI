const employees = [
  {
    id: "emp_1",
    officeId: "off_1",
    name: "Gabriel Beltrao",
    email: "gabriel@accounting.com",
    role: "owner",
    status: "active",
  },
  {
    id: "emp_2",
    officeId: "off_1",
    name: "Ana Costa",
    email: "ana@accounting.com",
    role: "manager",
    status: "active",
  },
  {
    id: "emp_3",
    officeId: "off_1",
    name: "Lucas Souza",
    email: "lucas@accounting.com",
    role: "staff",
    status: "invited",
  },
  {
    id: "emp_4",
    officeId: "off_2",
    name: "Maria Lima",
    email: "maria@otheroffice.com",
    role: "staff",
    status: "active",
  },
]

export function getEmployeesByOfficeId(officeId) {
  return employees.filter((employee) => employee.officeId === officeId)
}
