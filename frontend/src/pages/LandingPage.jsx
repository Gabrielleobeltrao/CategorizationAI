import { Link } from "react-router-dom"

function LandingPage() {
    return (
        <div className="min-h-screen bg-white text-gray-900">
            <Header />
            <Hero />
            <FeatureBookkeeping />
            <FeatureAI />
            <FeatureReports />
            <FeatureCrm />
            <FeatureChat />
            <FeatureTeam />
            <FinalCta />
            <Footer />
        </div>
    )
}

export default LandingPage

// --------------------------------------------------------------------
// Layout primitives
// --------------------------------------------------------------------

function Header() {
    return (
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                    <LogoMark />
                    <span>CategorizationAI</span>
                </div>
                <nav className="hidden gap-6 text-sm text-gray-600 md:flex">
                    <a href="#bookkeeping" className="hover:text-gray-900">Bookkeeping</a>
                    <a href="#ai" className="hover:text-gray-900">AI</a>
                    <a href="#reports" className="hover:text-gray-900">Reports</a>
                    <a href="#crm" className="hover:text-gray-900">CRM</a>
                    <a href="#chat" className="hover:text-gray-900">Chat</a>
                    <a href="#team" className="hover:text-gray-900">Team</a>
                </nav>
                <div className="flex items-center gap-2">
                    <Link
                        to="/login"
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                        Log in
                    </Link>
                    <Link
                        to="/register"
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
                    >
                        Start free
                    </Link>
                </div>
            </div>
        </header>
    )
}

function LogoMark() {
    return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19h16" />
                <path d="M6 16V9" />
                <path d="M12 16V6" />
                <path d="M18 16v-4" />
            </svg>
        </span>
    )
}

function SectionHeading({ eyebrow, title, body }) {
    return (
        <div className="mx-auto max-w-3xl text-center">
            {eyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</p>
            )}
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h2>
            {body && <p className="mt-4 text-base text-gray-600 sm:text-lg">{body}</p>}
        </div>
    )
}

// --------------------------------------------------------------------
// Hero
// --------------------------------------------------------------------

function Hero() {
    return (
        <section className="relative overflow-hidden border-b border-gray-100">
            {/* Vertically center the left text against the dashboard mock
                on lg+ so the headline anchors to the middle of the preview
                card. Mobile stacks naturally so items-start there. */}
            <div className="mx-auto grid max-w-7xl items-start gap-10 px-6 pt-10 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14 lg:pt-12 lg:pb-20">
                <div className="flex flex-col">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Bookkeeping + Operations CRM
                    </span>
                    <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                        The bookkeeping office, finally on one screen.
                    </h1>
                    <p className="mt-5 text-lg text-gray-600">
                        Multi-client books, AI categorization, real-time team chat and a tasks board — built for accounting firms that grew past spreadsheets.
                    </p>
                    <div className="mt-7 flex flex-wrap items-center gap-3">
                        <Link
                            to="/register"
                            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
                        >
                            Start free
                        </Link>
                        <Link
                            to="/login"
                            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                        >
                            Log in
                        </Link>
                    </div>
                    <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-gray-100 pt-6 text-sm">
                        <Stat label="Clients per office" value="Unlimited" />
                        <Stat label="AI auto-categorization" value="90%+" />
                        <Stat label="Set-up" value="< 5 min" />
                    </dl>
                </div>
                <div className="relative min-w-0">
                    <DashboardMock />
                </div>
            </div>
        </section>
    )
}

function Stat({ label, value }) {
    return (
        <div>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 text-base font-semibold">{value}</dd>
        </div>
    )
}

// --------------------------------------------------------------------
// Mock: Bookkeeping Overview dashboard
// --------------------------------------------------------------------

function DashboardMock() {
    const kpis = [
        { label: "Transactions Imported", value: "2,418", trend: "Selected range" },
        { label: "Transactions Categorized", value: "2,217", trend: "91.7% of imported" },
        { label: "AI Processed", value: "2,083", trend: "86.1% of imported" },
        { label: "Auto-Categorized by AI", value: "1,940", trend: "93.1% of AI processed" },
    ]
    // Mirror of PerformanceOverview's default series (same colors).
    const series = [
        { key: "imported", label: "Imported", color: "#111827" },
        { key: "categorized", label: "Categorized", color: "#2563eb" },
        { key: "aiProcessed", label: "AI Processed", color: "#0f766e" },
        { key: "aiCategorized", label: "AI Categorized", color: "#16a34a" },
        { key: "pending", label: "Pending", color: "#d97706" },
    ]
    // Spikier / less correlated buckets — each series has its own rhythm so
    // the chart looks like real activity instead of parallel lines.
    const data = [
        { imported:  82, categorized:  18, aiProcessed:  62, aiCategorized:  14, pending:  64 },
        { imported: 145, categorized:  41, aiProcessed:  88, aiCategorized:  37, pending: 104 },
        { imported:  64, categorized:  88, aiProcessed:  31, aiCategorized:  26, pending:  46 },
        { imported: 168, categorized:  72, aiProcessed: 152, aiCategorized:  61, pending:  92 },
        { imported:  98, categorized: 122, aiProcessed:  80, aiCategorized: 110, pending:  18 },
        { imported: 192, categorized: 154, aiProcessed: 168, aiCategorized:  88, pending:  44 },
        { imported:  74, categorized: 188, aiProcessed:  58, aiCategorized: 145, pending:  12 },
        { imported: 220, categorized: 116, aiProcessed: 174, aiCategorized:  98, pending:  68 },
        { imported: 112, categorized: 198, aiProcessed: 102, aiCategorized: 162, pending:  16 },
        { imported: 184, categorized: 142, aiProcessed: 156, aiCategorized: 124, pending:  34 },
    ]
    const max = Math.max(...data.flatMap((d) => series.map((s) => d[s.key])))
    const w = 320
    const h = 130
    const pathFor = (key) =>
        data
            .map((d, i) => `${(i * w) / (data.length - 1)},${h - (d[key] / max) * (h - 20)}`)
            .join(" ")

    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                    <p className="text-base font-semibold">Performance Overview</p>
                    <p className="text-[11px] text-gray-500">Office performance for the selected range</p>
                </div>
                <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700">
                    May 1 – May 28
                </span>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                {/* KPIs column */}
                <div className="flex flex-col gap-2">
                    {kpis.map((k) => (
                        <article
                            key={k.label}
                            className="flex items-baseline justify-between gap-2 rounded-xl border border-gray-200 bg-white p-2.5"
                        >
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
                                <p className="mt-0.5 text-[10px] text-gray-500">{k.trend}</p>
                            </div>
                            <p className="shrink-0 text-base font-semibold text-gray-900 tabular-nums">{k.value}</p>
                        </article>
                    ))}
                </div>
                {/* Chart column */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {series.map((s) => (
                            <span
                                key={s.key}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700"
                            >
                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </span>
                        ))}
                    </div>
                    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
                        {[0, 1, 2, 3].map((i) => (
                            <line key={i} x1="0" x2={w} y1={20 + i * 28} y2={20 + i * 28} stroke="#e5e7eb" />
                        ))}
                        {series.map((s) => (
                            <polyline
                                key={s.key}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={pathFor(s.key)}
                            />
                        ))}
                        {series.map((s) =>
                            data.map((d, i) => (
                                <circle
                                    key={`${s.key}-${i}`}
                                    cx={(i * w) / (data.length - 1)}
                                    cy={h - (d[s.key] / max) * (h - 20)}
                                    r="2.5"
                                    fill={s.color}
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                />
                            ))
                        )}
                    </svg>
                </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                    <p className="font-semibold text-gray-900">Live Jobs Queue</p>
                    <span className="text-gray-400">AI categorization pipeline status</span>
                </div>
                <div className="flex flex-col gap-1.5">
                    <QueueItem name="Aurora Digital Studio" progress={64} status="running" />
                    <QueueItem name="Blue Ridge Construction" progress={32} status="queued" />
                    <QueueItem name="Sunset Cafe" progress={100} status="done" />
                </div>
            </div>
        </div>
    )
}

function QueueItem({ name, progress, status }) {
    const statusClass =
        status === "running"
            ? "bg-sky-100 text-sky-700"
            : status === "queued"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
    return (
        <div className="rounded-md border border-gray-100 bg-gray-50/60 p-2">
            <div className="flex items-center justify-between">
                <span className="truncate text-[11px] font-medium text-gray-800">{name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusClass}`}>
                    {status}
                </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-gray-700" style={{ width: `${progress}%` }} />
            </div>
        </div>
    )
}

// --------------------------------------------------------------------
// Bookkeeping section
// --------------------------------------------------------------------

function FeatureBookkeeping() {
    return (
        <section id="bookkeeping" className="border-b border-gray-100 bg-gray-50/50">
            <div className="mx-auto max-w-7xl px-6 py-20">
                <SectionHeading
                    eyebrow="Bookkeeping core"
                    title="One workspace, every client"
                    body="Each client gets its own Chart of Accounts, journal, and reports. The office sees them all from a single sidebar."
                />
                <div className="mt-12 grid gap-6 lg:grid-cols-2">
                    <ClientsListMock />
                    <ChartOfAccountsMock />
                </div>
                <div className="mt-6">
                    <JournalEntriesMock />
                </div>
                <FeatureBullets
                    items={[
                        { title: "Multi-client", body: "Sidebar groups every client's books under one office. Scope filters everywhere." },
                        { title: "Double-entry journal", body: "Every transaction is a balanced journal entry under the hood. Splits are first-class." },
                        { title: "Reconciliation + Period close", body: "Lock the books after the month is reconciled. Domain errors surface as toast notifications." },
                    ]}
                />
            </div>
        </section>
    )
}

function ClientsListMock() {
    // Status values mirror the real operational status taxonomy
    // (frontend/src/constants/operationalStatuses.js).
    const rows = [
        { name: "Blue Ridge Construction LLC", state: "FL", activity: "Construction", status: "Ready to review", tone: "emerald" },
        { name: "Aurora Digital Studio", state: "NY", activity: "Creative services", status: "Categorizing", tone: "violet" },
        { name: "Sunset Cafe & Roasters", state: "CA", activity: "Food & beverage", status: "Onboarding", tone: "gray" },
    ]
    const toneClasses = {
        emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        violet: "bg-violet-50 text-violet-700 ring-violet-200",
        gray: "bg-gray-100 text-gray-700 ring-gray-200",
        amber: "bg-amber-50 text-amber-700 ring-amber-200",
        rose: "bg-rose-50 text-rose-700 ring-rose-200",
    }
    return (
        <BrowserFrame title="Clients">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold">Clients</p>
                <button className="rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">+ New client</button>
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 border-b border-gray-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 sm:grid">
                <span>Client</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-gray-100">
                {rows.map((r) => (
                    <li
                        key={r.name}
                        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 hover:bg-gray-50"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                            <p className="text-[11px] text-gray-500">{r.activity} · {r.state}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses[r.tone]}`}>
                            {r.status}
                        </span>
                        <div className="flex items-center justify-end text-gray-500">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>
                    </li>
                ))}
            </ul>
        </BrowserFrame>
    )
}

function ChartOfAccountsMock() {
    // Mirror of ChartOfAccountsPage: groups as <article>s with a gray-50
    // header (label + parent uppercase + total + add button), then a list
    // of accounts with name, description, balance and hover-only edit/delete.
    const groups = [
        {
            label: "Bank & Cash",
            parent: "ASSET",
            total: 84210.55,
            items: [
                { name: "Chase Business Checking", description: "Primary operating account", balance: 78420.12 },
                { name: "Cash on Hand", description: "Petty cash", balance: 5790.43 },
            ],
        },
        {
            label: "Credit Cards",
            parent: "LIABILITY",
            total: 8420.18,
            items: [
                { name: "Amex Business Card", description: "Business credit card", balance: 8420.18 },
            ],
        },
        {
            label: "Income",
            parent: "INCOME",
            total: 106200.0,
            items: [
                { name: "Service Revenue", description: "Stripe payouts, client checks", balance: 84120.0 },
                { name: "Product Sales", description: "Shopify, Amazon, Etsy payouts", balance: 12480.0 },
                { name: "Subscription Revenue", description: "Recurring monthly subscriptions", balance: 9600.0 },
            ],
        },
        {
            label: "Operating Expenses",
            parent: "EXPENSE",
            total: 46770.0,
            items: [
                { name: "Payroll & Wages", description: "Gusto, ADP, Rippling", balance: 38400.0 },
                { name: "Office Rent", description: "WeWork, Regus, landlord", balance: 4450.0 },
                { name: "Advertising & Marketing", description: "Google Ads, Facebook Ads", balance: 2280.0 },
                { name: "Software & Subscriptions", description: "AWS, Figma, Notion", balance: 1640.0 },
            ],
        },
    ]
    const summary = [
        { label: "Assets", total: 84210.55 },
        { label: "Liabilities", total: 8420.18 },
        { label: "Equity", total: 25000.0 },
        { label: "Income", total: 106200.0 },
        { label: "Expenses", total: 46770.0 },
    ]
    const fmt = (n) =>
        n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

    return (
        <BrowserFrame title="Chart of Accounts">
            <div className="flex flex-col gap-3 p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900">Chart of Accounts</h2>
                        <p className="text-[11px] text-gray-500">
                            All financial accounts — banks, cards, income, expenses, equity — in one canonical list.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            CSV
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            PDF
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                            New Account
                        </button>
                    </div>
                </header>

                <div className="relative">
                    <svg
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        type="text"
                        readOnly
                        placeholder="Filter by name or description"
                        className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-[12px] text-gray-500"
                    />
                </div>

                <div className="flex flex-col gap-3">
                    {groups.map((g) => (
                        <article key={g.label} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <header className="flex items-baseline justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2">
                                <div className="flex min-w-0 items-baseline gap-2">
                                    <h3 className="truncate text-[12px] font-semibold text-gray-900">{g.label}</h3>
                                    <span className="text-[10px] uppercase tracking-wide text-gray-400">{g.parent}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-[12px] font-semibold tabular-nums text-gray-900">{fmt(g.total)}</span>
                                    <span className="rounded-md p-0.5 text-gray-400">
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    </span>
                                </div>
                            </header>
                            <ul className="divide-y divide-gray-50">
                                {g.items.map((item) => (
                                    <li key={item.name} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]">
                                        <div className="min-w-0">
                                            <p className="truncate text-gray-900">{item.name}</p>
                                            <p className="truncate text-[10px] text-gray-500">{item.description}</p>
                                        </div>
                                        <span className="shrink-0 tabular-nums text-gray-900">{fmt(item.balance)}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>

                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {summary.map((s) => (
                        <div key={s.label} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
                            <p className="text-[12px] font-semibold tabular-nums text-gray-900">{fmt(s.total)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </BrowserFrame>
    )
}

function JournalEntriesMock() {
    // Faithful mirror of LedgerEntriesTable + LedgerEntryRow:
    //   - toolbar: Select All (left)  /  Search · Filter · Categorize with AI (right)
    //   - grid header: 24 | Date | Description | Account | Category | 20 | Amount | Actions
    //   - rows alternate bg-gray-100 / bg-white (NOT a striped <table>)
    //   - category as rounded-full pill with border-2 border-gray-100
    //   - icon column: AI star (violet) or memory icon (sky)
    //   - date as dd/mm/yyyy
    //   - uncategorized rows show "Uncategorized income" / "Uncategorized expenses"
    //     in gray-400, depending on amount sign
    const rows = [
        { date: "12/05/2026", desc: "STRIPE PAYOUT - APRIL", account: "Chase Business Checking", category: "Service Revenue", icon: "ai", amount: 4250.0 },
        { date: "11/05/2026", desc: "ADP PAYROLL RUN", account: "Chase Business Checking", category: "Payroll & Wages", icon: "ai", amount: -8500.0 },
        { date: "10/05/2026", desc: "GOOGLE ADS PAYMENT", account: "Chase Business Checking", category: "Advertising & Marketing", icon: "ai", amount: -480.0 },
        { date: "09/05/2026", desc: "AMAZON WEB SERVICES", account: "Chase Business Checking", category: "Software & Subscriptions", icon: "memory", amount: -210.0 },
        { date: "08/05/2026", desc: "POS DEBIT TST*MERCHANT", account: "Chase Business Checking", category: null, icon: null, amount: -64.2 },
        { date: "07/05/2026", desc: "SHOPIFY PAYOUT APRIL", account: "Chase Business Checking", category: "Product Sales", icon: "ai", amount: 980.0 },
        { date: "06/05/2026", desc: "WEWORK RENT MAY", account: "Chase Business Checking", category: "Office Rent", icon: "ai", amount: -890.0 },
    ]
    const fmt = (n) =>
        Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

    const gridClass =
        "grid grid-cols-[18px_minmax(70px,0.8fr)_minmax(140px,2fr)_minmax(96px,1fr)_minmax(120px,1.2fr)_16px_minmax(72px,0.7fr)_80px] items-center gap-3"

    return (
        <BrowserFrame title="Transactions · Blue Ridge Construction">
            <div className="flex flex-col p-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" className="h-3.5 w-3.5" readOnly />
                        <span className="text-[12px] font-medium text-gray-700">Select All</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="relative">
                            <svg
                                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                type="text"
                                readOnly
                                placeholder="Search"
                                className="w-44 rounded-md border border-gray-300 bg-white py-1 pl-7 pr-2 text-[12px] text-gray-500"
                            />
                        </div>
                        <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 6h16l-6 7v5l-4 2v-7L4 6z" />
                            </svg>
                            Filter
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700">
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3v18" />
                                <path d="M3 12h18" />
                            </svg>
                            Categorize with AI
                        </button>
                    </div>
                </div>

                {/* Grid header */}
                <div className={`${gridClass} bg-white px-2 py-2.5 text-[11px] font-semibold text-gray-900`}>
                    <span aria-hidden="true" />
                    <span>Date</span>
                    <span>Description</span>
                    <span>Account</span>
                    <span>Category</span>
                    <span aria-hidden="true" />
                    <span className="text-right">Amount</span>
                    <span className="text-right pr-2">Actions</span>
                </div>

                {/* Rows */}
                <div className="rounded-b-lg border-b-4 border-gray-100">
                    {rows.map((r, i) => {
                        const isUncategorized = !r.category
                        const categoryLabel = isUncategorized
                            ? (r.amount >= 0 ? "Uncategorized income" : "Uncategorized expenses")
                            : r.category
                        return (
                            <div
                                key={r.desc}
                                className={`${gridClass} px-2 py-2.5 text-[12px] ${i % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                            >
                                <input type="checkbox" className="h-3.5 w-3.5" readOnly />
                                <span className="whitespace-nowrap text-gray-900">{r.date}</span>
                                <span className="line-clamp-2 text-gray-900">{r.desc}</span>
                                <span className="truncate text-gray-900">{r.account}</span>
                                <button
                                    type="button"
                                    className={`flex w-full items-center justify-between rounded-full border-2 border-gray-100 bg-white px-2.5 py-1 text-left text-[11px] ${
                                        isUncategorized ? "text-gray-400" : "text-gray-900"
                                    }`}
                                >
                                    <span className="truncate">{categoryLabel}</span>
                                    <svg className="h-3 w-3 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>
                                <span className="flex items-center justify-center">
                                    {r.icon === "ai" && (
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 3l1.9 4.3L18 9.2l-4.1 1.9L12 15.5l-1.9-4.4L6 9.2l4.1-1.9z" />
                                        </svg>
                                    )}
                                    {r.icon === "memory" && (
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 8a3 3 0 0 1 3-3h7v14h-7a3 3 0 0 0-3 3z" />
                                            <path d="M17 5a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3" />
                                        </svg>
                                    )}
                                </span>
                                <span className={`text-right tabular-nums ${r.amount > 0 ? "text-emerald-700" : "text-gray-900"}`}>
                                    {fmt(r.amount)}
                                </span>
                                <span className="flex items-center justify-end gap-1 pr-1 text-gray-500">
                                    {/* Edit */}
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                    </svg>
                                    {/* Split */}
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 7h9" />
                                        <path d="M13 7l-2-2m2 2-2 2" />
                                        <path d="M20 17h-9" />
                                        <path d="M11 17l2-2m-2 2 2 2" />
                                    </svg>
                                    {/* Delete */}
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M8 6V4h8v2" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                    </svg>
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </BrowserFrame>
    )
}

// --------------------------------------------------------------------
// AI section
// --------------------------------------------------------------------

function FeatureAI() {
    return (
        <section id="ai" className="border-b border-gray-100">
            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr]">
                <div>
                    <SectionHeadingLeft
                        eyebrow="AI categorization"
                        title="The AI does the boring part."
                        body="Uncategorized rows flow through the LLM pipeline. The model suggests a category, you review or auto-apply. Confidence and rationale travel with every suggestion."
                    />
                    <FeatureBulletsCompact
                        items={[
                            "Batch categorize whole imports in one click",
                            "Confidence score on every suggestion",
                            "Manual edits override the AI permanently",
                            "Per-client memory — your conventions stick",
                        ]}
                    />
                </div>
                <AIMock />
            </div>
        </section>
    )
}

function AIMock() {
    const rows = [
        { desc: "STARBUCKS #3849", suggestion: "Meals & Entertainment", confidence: 0.94, status: "auto" },
        { desc: "HOME DEPOT #6021", suggestion: "Materials & Supplies", confidence: 0.88, status: "auto" },
        { desc: "ZELLE FROM CLIENT", suggestion: "Service Revenue", confidence: 0.81, status: "review" },
        { desc: "POS DEBIT TST*RW02", suggestion: "—", confidence: 0, status: "skipped" },
        { desc: "DELTA AIRLINES", suggestion: "Travel", confidence: 0.97, status: "auto" },
    ]
    return (
        <BrowserFrame title="AI Categorization · live">
            <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Categorizing 5 transactions</p>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Running · 4 / 5</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" />
                </div>
            </div>
            <ul className="divide-y divide-gray-100 text-[12px]">
                {rows.map((r) => (
                    <li key={r.desc} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="font-mono text-[11px] text-gray-500 w-44 shrink-0 truncate">{r.desc}</span>
                        <span className="flex-1 truncate text-gray-800">{r.suggestion}</span>
                        {r.status === "auto" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Auto · {Math.round(r.confidence * 100)}%
                            </span>
                        )}
                        {r.status === "review" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                Review · {Math.round(r.confidence * 100)}%
                            </span>
                        )}
                        {r.status === "skipped" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                Skipped
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </BrowserFrame>
    )
}

// --------------------------------------------------------------------
// Reports section
// --------------------------------------------------------------------

function FeatureReports() {
    return (
        <section id="reports" className="border-b border-gray-100 bg-gray-50/50">
            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr]">
                <PLMock />
                <div className="flex flex-col justify-center">
                    <SectionHeadingLeft
                        eyebrow="Reports"
                        title="Reports your clients will actually understand."
                        body="P&L, Balance Sheet, Trial Balance, General Ledger, Account Balances — every report rebuilds from the journal in real time. Export as PDF in a click."
                    />
                    <FeatureBulletsCompact
                        items={[
                            "P&L by month, quarter, year",
                            "Balance Sheet with comparative columns",
                            "Trial Balance ready for tax",
                            "General Ledger with drill-down",
                        ]}
                    />
                </div>
            </div>
        </section>
    )
}

function PLMock() {
    // Faithful mirror of ProfitLossPage:
    //   1. formula bar  Income − COGS − OpEx = Net Income (KPI tiles + operators)
    //   2. Statement card: title + "%" toggle + subtitle + alternating rows
    // Item rows use pl-4 to nest under a header row; section headers and the
    // Net Income row use font-semibold; amounts go right and negatives stay
    // gray-900 while positives are emerald-700.
    const fmt = (n) =>
        Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

    const lines = [
        { id: "revenue", label: "Revenue", level: 0, type: "header", amount: 106200 },
        { id: "service_income", label: "Service Revenue", level: 1, type: "item", amount: 84120 },
        { id: "product_sales", label: "Product Sales", level: 1, type: "item", amount: 12480 },
        { id: "subs_revenue", label: "Subscription Revenue", level: 1, type: "item", amount: 9600 },
        { id: "cogs", label: "Cost of Goods Sold", level: 0, type: "header", amount: 13020 },
        { id: "materials", label: "Materials & Supplies", level: 1, type: "item", amount: 4820 },
        { id: "contractors", label: "Contractor Payments", level: 1, type: "item", amount: 8200 },
        { id: "gross_profit", label: "Gross Profit", level: 0, type: "subtotal", amount: 93180 },
        { id: "opex", label: "Operating Expenses", level: 0, type: "header", amount: 46770 },
        { id: "payroll", label: "Payroll & Wages", level: 1, type: "item", amount: 38400 },
        { id: "rent", label: "Office Rent", level: 1, type: "item", amount: 4450 },
        { id: "ads", label: "Advertising & Marketing", level: 1, type: "item", amount: 2280 },
        { id: "software", label: "Software & Subscriptions", level: 1, type: "item", amount: 1640 },
        { id: "net_income", label: "Net Income", level: 0, type: "total", amount: 46410 },
    ]

    const income = 106200
    const cogs = 13020
    const opex = 46770
    const netIncome = income - cogs - opex

    const weightFor = (type) => {
        if (type === "header") return "font-semibold text-gray-900"
        if (type === "subtotal") return "font-semibold text-gray-900"
        if (type === "total") return "font-bold text-gray-900"
        return "text-gray-700"
    }

    return (
        <BrowserFrame title="Profit & Loss · May 2026">
            <div className="flex flex-col gap-3 p-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Profit & Loss</h2>
                        <p className="text-[11px] text-gray-500">Blue Ridge Construction · May 1 – May 31, 2026</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700">CSV</span>
                        <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-medium text-gray-700">PDF</span>
                    </div>
                </header>

                {/* Formula bar — equal-width tiles, labels fixed height so
                    each value sits on the same baseline; operators center on
                    the value row. */}
                <article className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)] items-stretch gap-x-1.5">
                        <PLFormulaTile label="Income" amount={income} positive />
                        <PLFormulaSep>−</PLFormulaSep>
                        <PLFormulaTile label="Cost of Goods Sold" amount={cogs} />
                        <PLFormulaSep>−</PLFormulaSep>
                        <PLFormulaTile label="Operating Expenses" amount={opex} />
                        <PLFormulaSep>=</PLFormulaSep>
                        <PLFormulaTile label="Net Income" amount={netIncome} positive net />
                    </div>
                </article>

                {/* Statement card */}
                <article className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-gray-900">Statement</h3>
                        <button className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700">%</button>
                    </div>
                    <p className="text-[11px] text-gray-500">Revenue, costs, expenses and net income</p>
                    <div className="mt-3 overflow-hidden rounded-lg border border-gray-100">
                        {lines.map((line, idx) => (
                            <div
                                key={line.id}
                                className={`grid grid-cols-[minmax(0,1fr)_120px] items-center px-3 py-1.5 text-[12px] ${idx % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                            >
                                <span className={`${line.level === 1 ? "pl-4" : ""} ${weightFor(line.type)}`}>{line.label}</span>
                                <span className={`text-right tabular-nums ${weightFor(line.type)} ${line.id === "net_income" ? "text-emerald-700" : ""}`}>
                                    {fmt(line.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </article>
            </div>
        </BrowserFrame>
    )
}

function PLFormulaTile({ label, amount, positive = false, net = false }) {
    const fmt = (n) =>
        Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
    return (
        <div className="flex h-full flex-col items-center justify-between gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-center">
            <p
                className={`flex h-7 items-center text-[9px] uppercase leading-tight tracking-wide ${
                    net ? "text-emerald-700" : "text-gray-500"
                }`}
            >
                {label}
            </p>
            <p
                className={`text-[14px] tabular-nums ${
                    positive ? "text-emerald-700" : "text-gray-900"
                } ${net ? "font-bold" : "font-semibold"}`}
            >
                {fmt(amount)}
            </p>
        </div>
    )
}

function PLFormulaSep({ children }) {
    // The separator sits at the bottom row so it aligns with the amount
    // baseline of the tiles, regardless of label height.
    return (
        <span className="flex h-full items-end justify-center pb-2 text-[14px] font-medium text-gray-400">
            {children}
        </span>
    )
}

// --------------------------------------------------------------------
// CRM section
// --------------------------------------------------------------------

function FeatureCrm() {
    return (
        <section id="crm" className="border-b border-gray-100">
            <div className="mx-auto max-w-7xl px-6 py-20">
                <SectionHeading
                    eyebrow="Operations CRM"
                    title="Tasks and a board, with context."
                    body="Every task lives in the office. Link it to clients, assign to teammates, drag across columns. Done tasks sink to the bottom automatically."
                />
                <div className="mt-12">
                    <BoardMock />
                </div>
            </div>
        </section>
    )
}

function BoardMock() {
    // Mirror of BoardPage + TaskCard: in-progress tasks have the pulsing
    // red dot, done tasks get line-through + opacity. Each card carries
    // due date, assignee, and (optionally) description + comments count.
    const columns = [
        {
            name: "Backlog",
            tasks: [
                { title: "Update vendor W-9 forms", priority: "low", client: "Aurora Digital Studio", assignee: "Maria", due: "Jun 15" },
                { title: "Send year-end tax package", priority: "urgent", client: "Blue Ridge Construction", assignee: "João", due: "Jun 02", comments: 3 },
                { title: "Generate trial balance", priority: "medium", client: "Sunset Cafe", assignee: "Ana", due: "Jun 10" },
                { title: "Set up new Chart of Accounts", priority: "low", client: "Aurora Digital Studio", assignee: "Demo", description: "Service-business preset, 22 accounts.", due: "Jun 20" },
            ],
        },
        {
            name: "This Week",
            tasks: [
                {
                    title: "Reconcile April bank statement",
                    priority: "high",
                    client: "Blue Ridge Construction",
                    assignee: "Maria",
                    status: "in_progress",
                    description: "12 transactions still uncleared.",
                    due: "May 30",
                    comments: 5,
                },
                {
                    title: "Send Q1 P&L to client",
                    priority: "medium",
                    client: "Aurora Digital Studio",
                    assignee: "Demo",
                    status: "in_progress",
                    due: "May 29",
                },
                { title: "Categorize uncleared transactions", priority: "high", client: "Sunset Cafe", assignee: "Ana", due: "May 31", comments: 2 },
                { title: "Match Stripe payouts to invoices", priority: "medium", client: "Aurora Digital Studio", assignee: "João", due: "May 30" },
            ],
        },
        {
            name: "In Review",
            tasks: [
                {
                    title: "Prep client review meeting",
                    priority: "high",
                    client: "Blue Ridge Construction",
                    assignee: "Maria",
                    status: "in_progress",
                    description: "Walk-through of P&L, balance sheet and AR aging.",
                    due: "May 28",
                    comments: 7,
                },
                { title: "Reclassify miscategorized rows", priority: "medium", client: "Sunset Cafe", assignee: "Ana", comments: 1 },
                { title: "Confirm 1099 vendor list", priority: "low", client: "Aurora Digital Studio", assignee: "Demo", comments: 2 },
            ],
        },
        {
            name: "Done Archive",
            tasks: [
                { title: "Reconcile Amex statement", priority: "high", client: "Aurora Digital Studio", assignee: "Maria", done: true, due: "May 22", comments: 4 },
                { title: "Close out previous month", priority: "high", client: "Blue Ridge Construction", assignee: "Demo", done: true, due: "May 18" },
                { title: "Generate trial balance for April", priority: "medium", client: "Sunset Cafe", assignee: "Ana", done: true, due: "May 15", comments: 1 },
            ],
        },
    ]
    const priorityColor = (p) =>
        p === "urgent" ? "#dc2626" : p === "high" ? "#f97316" : p === "medium" ? "#facc15" : "#94a3b8"

    return (
        <BrowserFrame title="Board">
            <div className="flex gap-3 overflow-x-auto p-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
                {columns.map((c) => (
                    <section
                        key={c.name}
                        className="flex w-72 shrink-0 grow-0 flex-col rounded-xl border border-gray-200 bg-gray-100 p-3 lg:w-auto lg:shrink lg:grow"
                    >
                        <header className="mb-3 flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                                <p className="text-[11px] text-gray-500">
                                    {c.tasks.length} task{c.tasks.length === 1 ? "" : "s"}
                                </p>
                            </div>
                            <button className="rounded-md p-1 text-gray-400" aria-hidden="true">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                </svg>
                            </button>
                        </header>
                        <ul className="flex flex-col gap-2">
                            {c.tasks.map((t) => {
                                const isInProgress = t.status === "in_progress"
                                const hasMeta = Boolean(t.due) || Boolean(t.assignee) || Boolean(t.comments)
                                return (
                                    <li
                                        key={t.title}
                                        className={`rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 ${t.done ? "opacity-70" : ""}`}
                                        style={{ borderLeft: `4px solid ${priorityColor(t.priority)}` }}
                                    >
                                        <div className="flex min-w-0 items-start gap-2">
                                            {isInProgress && (
                                                <span className="relative mt-1 inline-flex h-2 w-2 shrink-0" aria-hidden="true">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                                    <span className="relative inline-block h-2 w-2 rounded-full bg-red-500" />
                                                </span>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className={`truncate text-[12px] font-medium ${t.done ? "text-gray-500 line-through" : "text-gray-900"}`}>
                                                    {t.title}
                                                </p>
                                                <p className="truncate text-[10px] text-gray-500">{t.client}</p>
                                            </div>
                                        </div>
                                        {t.description && (
                                            <p className="mt-1 line-clamp-2 text-[10px] text-gray-500">{t.description}</p>
                                        )}
                                        {hasMeta && (
                                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500">
                                                {t.due && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                                            <line x1="16" y1="2" x2="16" y2="6" />
                                                            <line x1="8" y1="2" x2="8" y2="6" />
                                                            <line x1="3" y1="10" x2="21" y2="10" />
                                                        </svg>
                                                        {t.due}
                                                    </span>
                                                )}
                                                {t.assignee && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        {t.assignee}
                                                    </span>
                                                )}
                                                {t.comments > 0 && (
                                                    <span className="ml-auto inline-flex items-center gap-1">
                                                        <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                        </svg>
                                                        <span className="tabular-nums">{t.comments}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </BrowserFrame>
    )
}

// --------------------------------------------------------------------
// Chat section
// --------------------------------------------------------------------

function FeatureChat() {
    return (
        <section id="chat" className="border-b border-gray-100 bg-gray-50/50">
            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.05fr]">
                <div className="flex flex-col justify-center">
                    <SectionHeadingLeft
                        eyebrow="Team chat"
                        title="Chat that doesn't leave the app."
                        body="DMs, groups, voice notes and file attachments — all scoped to the office. No Slack tab to switch."
                    />
                    <FeatureBulletsCompact
                        items={[
                            "Direct messages and group conversations",
                            "Voice notes recorded right in the bubble",
                            "Files (PDF, CSV, images) up to 25 MB",
                            "Real-time desktop notifications",
                        ]}
                    />
                </div>
                <ChatMock />
            </div>
        </section>
    )
}

function ChatMock() {
    return (
        <BrowserFrame title="Monthly · Period Close">
            {/* Dark header — mirrors ChatWidget: back arrow, title, subtitle,
                then manage-members / delete / close icons aligned to the right. */}
            <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-900 px-4 py-3 text-white">
                <button
                    type="button"
                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                    aria-label="Back"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">Monthly · Period Close</p>
                    <p className="truncate text-[11px] text-gray-300">Group · 4 members</p>
                </div>
                <button
                    type="button"
                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                    title="Manage members"
                    aria-label="Manage members"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="7" r="4" />
                        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    </svg>
                </button>
                <button
                    type="button"
                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-rose-300"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                    </svg>
                </button>
                <button
                    type="button"
                    className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                    aria-label="Close chat"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>
            </header>
            <div className="flex flex-col gap-3 p-4 text-[12px]">
                <ChatBubble who="Maria" mine={false}>
                    Blue Ridge is wrapped up — just need to review the last split.
                </ChatBubble>
                <ChatBubble who="You" mine>
                    Nice. How's Sunset coming along?
                </ChatBubble>
                <ChatBubble who="Ana" mine={false} attachment="audio" />
                <ChatBubble who="Ana" mine={false} attachment="file" filename="Sunset-pending-items.pdf" filesize="178 KB" />
                <ChatBubble who="You" mine>
                    Got it, I'll go through it this afternoon.
                </ChatBubble>
                <ChatBubble who="João" mine={false}>
                    Reminder: payroll runs on the 10th.
                </ChatBubble>
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-400">
                    <span className="flex-1">Message #Monthly · Period Close</span>
                    <MicIcon />
                    <ClipIcon />
                    <span className="rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">Send</span>
                </div>
            </div>
        </BrowserFrame>
    )
}

function ChatBubble({ who, mine, children, attachment, filename, filesize }) {
    return (
        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] shadow-sm ${
                    mine ? "bg-gray-900 text-white" : "border border-gray-100 bg-white text-gray-900"
                }`}
            >
                {!mine && (
                    <p className="mb-0.5 text-[11px] font-medium text-gray-500">{who}</p>
                )}
                {children}
                {attachment === "audio" && <AudioBubblePreview />}
                {attachment === "file" && <FileBubblePreview filename={filename} filesize={filesize} />}
            </div>
        </div>
    )
}

function AudioBubblePreview() {
    return (
        <div className="flex items-center gap-2">
            <button className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <div className="flex flex-1 items-center gap-[2px]">
                {[3, 6, 4, 7, 9, 5, 8, 6, 3, 5, 7, 4].map((h, i) => (
                    <span key={i} className="w-[2px] rounded-full bg-gray-400" style={{ height: `${h * 2}px` }} />
                ))}
            </div>
            <span className="text-[10px] tabular-nums text-gray-500">0:18</span>
        </div>
    )
}

function FileBubblePreview({ filename, filesize }) {
    return (
        <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-600">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                </svg>
            </span>
            <div className="min-w-0">
                <p className="truncate text-[11px] font-medium">{filename}</p>
                <p className="text-[10px] text-gray-400">{filesize}</p>
            </div>
        </div>
    )
}

function MicIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M19 11a7 7 0 0 1-14 0" />
            <path d="M12 18v3" />
        </svg>
    )
}

function ClipIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 12-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l9-9" />
        </svg>
    )
}

// --------------------------------------------------------------------
// Team section
// --------------------------------------------------------------------

function FeatureTeam() {
    return (
        <section id="team" className="border-b border-gray-100">
            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr]">
                <EmployeesMock />
                <div className="flex flex-col justify-center">
                    <SectionHeadingLeft
                        eyebrow="Team & permissions"
                        title="Permissions that respect the org chart."
                        body="Roles map to permissions; employees can be restricted to specific clients. Owners see everything, staff only see what they should."
                    />
                    <FeatureBulletsCompact
                        items={[
                            "Roles: owner, manager, staff, viewer",
                            "Per-client scope for freelancers and contractors",
                            "Activity log of every change",
                            "Status toggle that's obviously interactive",
                        ]}
                    />
                </div>
            </div>
        </section>
    )
}

function EmployeesMock() {
    const rows = [
        { name: "Demo Owner", email: "demo@categorizationai.com", role: "Owner", active: true, scope: "All clients" },
        { name: "Maria Silva", email: "maria.demo@chat-demo.local", role: "Manager", active: true, scope: "All clients" },
        { name: "João Pereira", email: "joao.demo@chat-demo.local", role: "Staff", active: true, scope: "2 clients" },
        { name: "Ana Costa", email: "ana.demo@chat-demo.local", role: "Viewer", active: false, scope: "1 client" },
    ]
    return (
        <BrowserFrame title="Employees">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                    <p className="text-sm font-semibold">Employees</p>
                    <p className="text-[11px] text-gray-500">4 in office</p>
                </div>
                <button className="rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">+ Invite</button>
            </div>
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_120px_120px] gap-3 border-b border-gray-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 md:grid">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-gray-100">
                {rows.map((r) => (
                    <li
                        key={r.email}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_120px_120px] items-center gap-3 px-4 py-2.5 text-[12px]"
                    >
                        <span className="truncate font-medium text-gray-900">{r.name}</span>
                        <span className="truncate text-gray-700">{r.email}</span>
                        <span className="text-gray-700">{r.role}</span>
                        <span>
                            {r.active ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    Inactive
                                </span>
                            )}
                        </span>
                        <div className="flex items-center justify-end gap-1 text-gray-400">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                            </svg>
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="2" width="16" height="20" rx="2" />
                                <path d="M9 22v-4h6v4" />
                            </svg>
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                            </svg>
                        </div>
                    </li>
                ))}
            </ul>
        </BrowserFrame>
    )
}

// --------------------------------------------------------------------
// Reusable bits
// --------------------------------------------------------------------

function BrowserFrame({ title, children }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2">
                <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <p className="truncate text-[11px] font-medium text-gray-500">{title}</p>
                <span className="w-12" />
            </div>
            {children}
        </div>
    )
}

function SectionHeadingLeft({ eyebrow, title, body }) {
    return (
        <div className="max-w-xl">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</p>}
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h2>
            {body && <p className="mt-4 text-base text-gray-600">{body}</p>}
        </div>
    )
}

function FeatureBullets({ items }) {
    return (
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {items.map((it) => (
                <div key={it.title} className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-sm font-semibold">{it.title}</p>
                    <p className="mt-2 text-sm text-gray-600">{it.body}</p>
                </div>
            ))}
        </div>
    )
}

function FeatureBulletsCompact({ items }) {
    return (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {items.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>{t}</span>
                </li>
            ))}
        </ul>
    )
}

// --------------------------------------------------------------------
// Final CTA + Footer
// --------------------------------------------------------------------

function FinalCta() {
    return (
        <section className="border-b border-gray-100 bg-gray-900 text-white">
            <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-20 text-center">
                <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
                    Stop juggling spreadsheets, Slack, and three different bookkeeping tools.
                </h2>
                <p className="max-w-2xl text-base text-gray-300">
                    Move your office to a single platform. Start free, invite your team in minutes.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link
                        to="/register"
                        className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                    >
                        Start free
                    </Link>
                    <Link
                        to="/login"
                        className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                        Log in
                    </Link>
                </div>
            </div>
        </section>
    )
}

function Footer() {
    return (
        <footer className="border-t border-gray-100 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <LogoMark />
                    <span>CategorizationAI</span>
                </div>
                <p className="text-xs text-gray-500">© {new Date().getFullYear()} CategorizationAI. All rights reserved.</p>
            </div>
        </footer>
    )
}
