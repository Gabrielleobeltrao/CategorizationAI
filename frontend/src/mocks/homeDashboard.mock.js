const homeDashboardByOffice = {
  off_1: {
    kpis: [
      { id: "active_clients", label: "Active Clients", value: "24", trend: "+2 this month" },
      { id: "team_members", label: "Team Members", value: "8", trend: "1 on vacation" },
      { id: "due_today", label: "Tasks Due Today", value: "17", trend: "4 high priority" },
      { id: "auto_cat_rate", label: "Auto-Categorization Rate", value: "86%", trend: "+5.4%" },
    ],
    closeProgress: [
      { month: "Jan", progress: 100 },
      { month: "Feb", progress: 100 },
      { month: "Mar", progress: 92 },
      { month: "Apr", progress: 78 },
      { month: "May", progress: 65 },
      { month: "Jun", progress: 41 },
    ],
    workflowQueue: [
      { name: "New uploads", count: 42, colorClass: "bg-sky-500" },
      { name: "Pending review", count: 29, colorClass: "bg-amber-500" },
      { name: "Ready to file", count: 18, colorClass: "bg-emerald-500" },
      { name: "Overdue items", count: 6, colorClass: "bg-rose-500" },
    ],
    teamCapacity: [
      { name: "Gabriel", completed: 21, assigned: 25 },
      { name: "Ana", completed: 18, assigned: 22 },
      { name: "Lucas", completed: 16, assigned: 24 },
      { name: "Paula", completed: 19, assigned: 21 },
    ],
    alerts: [
      "6 transactions are overdue for categorization",
      "2 clients missing bank statement upload",
      "Quarter-close checklist at 78% completion",
    ],
    quickActions: [
      { id: "clients", label: "Open Clients", to: "/clients" },
      { id: "employees", label: "Open Team", to: "/employees" },
      { id: "new_client", label: "Add Client", to: "/clients" },
    ],
  },
}

export function getHomeDashboardByOfficeId(officeId) {
  return homeDashboardByOffice[officeId] || {
    kpis: [],
    closeProgress: [],
    workflowQueue: [],
    teamCapacity: [],
    alerts: [],
    quickActions: [],
  }
}
