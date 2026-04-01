const homeDashboardByOffice = {
  off_1: {
    header: {
      periodLabel: "March 2026",
      lastSyncAt: "2026-03-31 18:42",
      queueStatus: "running",
    },
    kpis: [
      { id: "imported_month", label: "Transactions Imported (Month)", value: "18,420", trend: "+12.6% vs Feb" },
      { id: "categorized_month", label: "Transactions Categorized (Month)", value: "16,804", trend: "91.2% coverage" },
      { id: "ai_categorized_month", label: "Auto-Categorized by AI (Month)", value: "12,730", trend: "75.7% of categorized" },
      { id: "pending_now", label: "Pending Categorization (Now)", value: "1,616", trend: "Needs manual review" },
    ],
    funnel: [
      { id: "imported", label: "Imported", count: 18420, colorClass: "bg-slate-500" },
      { id: "ai_tagged", label: "AI Categorized", count: 12730, colorClass: "bg-sky-500" },
      { id: "manual_review", label: "Manual Reviewed", count: 4074, colorClass: "bg-amber-500" },
      { id: "finalized", label: "Finalized", count: 16804, colorClass: "bg-emerald-500" },
    ],
    backlogAging: [
      { bucket: "0-2 days", count: 642 },
      { bucket: "3-7 days", count: 503 },
      { bucket: "8-15 days", count: 312 },
      { bucket: "15+ days", count: 159 },
    ],
    weeklyTrend: [
      { week: "W1", imported: 4110, categorized: 3580, pending: 530 },
      { week: "W2", imported: 4520, categorized: 4065, pending: 455 },
      { week: "W3", imported: 4890, categorized: 4455, pending: 435 },
      { week: "W4", imported: 4900, categorized: 4704, pending: 196 },
    ],
    teamProductivity: [
      { id: "emp_1", name: "Gabriel", categorized: 2310, reviewed: 812, avgMinutes: 3.8, reworkRate: "4.9%" },
      { id: "emp_2", name: "Ana", categorized: 2194, reviewed: 903, avgMinutes: 4.1, reworkRate: "5.3%" },
      { id: "emp_3", name: "Lucas", categorized: 1988, reviewed: 744, avgMinutes: 4.4, reworkRate: "6.1%" },
      { id: "emp_4", name: "Paula", categorized: 2142, reviewed: 821, avgMinutes: 3.9, reworkRate: "4.7%" },
    ],
    clientsAttention: [
      { id: "cli_1", name: "VB Construction LLC", pending: 242, uncategorizedRate: "18.3%", lastUpload: "2h ago", slaRisk: "high" },
      { id: "cli_2", name: "Northline Services", pending: 174, uncategorizedRate: "14.2%", lastUpload: "5h ago", slaRisk: "medium" },
      { id: "cli_3", name: "Sunbay Dental Group", pending: 162, uncategorizedRate: "12.9%", lastUpload: "1d ago", slaRisk: "medium" },
      { id: "cli_4", name: "Horizon Logistics", pending: 133, uncategorizedRate: "11.1%", lastUpload: "1d ago", slaRisk: "low" },
    ],
    jobsQueue: [
      { id: "job_7f2", client: "VB Construction LLC", progress: 72, processed: 720, total: 1000, status: "running", updatedAt: "20s ago", error: null },
      { id: "job_9a1", client: "Northline Services", progress: 100, processed: 430, total: 430, status: "done", updatedAt: "2m ago", error: null },
      { id: "job_11c", client: "Sunbay Dental Group", progress: 43, processed: 215, total: 500, status: "queued", updatedAt: "1m ago", error: null },
      { id: "job_3d8", client: "Westfield Air", progress: 100, processed: 390, total: 390, status: "failed", updatedAt: "4m ago", error: "Rate limit from provider" },
    ],
    recentActivities: [
      { id: "act_1", time: "18:40", title: "Upload completed", detail: "VB Construction LLC • 1,024 transactions" },
      { id: "act_2", time: "18:31", title: "LLM categorization finished", detail: "Northline Services • 430 transactions" },
      { id: "act_3", time: "18:14", title: "Manual review batch applied", detail: "Ana • 162 transactions updated" },
      { id: "act_4", time: "17:58", title: "New employee created", detail: "User: maria@office.com • role: Viewer" },
      { id: "act_5", time: "17:43", title: "Client onboarded", detail: "Horizon Logistics LLC" },
    ],
    alerts: [
      "Backlog above target for 3-7 day bucket",
      "1 job failed in the last 30 minutes",
      "2 clients without upload in the last 48 hours",
      "SLA risk detected for VB Construction LLC",
    ],
    quickActions: [
      { id: "clients", label: "Open Clients", to: "/clients" },
      { id: "ledger", label: "Open Ledger", to: "/ledger" },
      { id: "employees", label: "Open Employees", to: "/employees" },
    ],
  },
}

export function getHomeDashboardByOfficeId(officeId) {
  return homeDashboardByOffice[officeId] || {
    header: {
      periodLabel: "-",
      lastSyncAt: "-",
      queueStatus: "idle",
    },
    kpis: [],
    funnel: [],
    backlogAging: [],
    weeklyTrend: [],
    teamProductivity: [],
    clientsAttention: [],
    jobsQueue: [],
    recentActivities: [],
    alerts: [],
    quickActions: [],
  }
}
