import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getOnboardingState } from "../../services/onboarding.service"

// Persistent dismiss key per client. Once the user dismisses the panel
// for a client it won't reappear, even if a step regresses (since the
// bookkeeper has acknowledged they know what they're doing).
function dismissKeyFor(clientId) {
    return `getting-started-dismissed:${clientId}`
}

function wasDismissed(clientId) {
    if (typeof window === "undefined") return false
    try {
        return window.localStorage?.getItem(dismissKeyFor(clientId)) === "1"
    } catch {
        return false
    }
}

function markDismissed(clientId) {
    if (typeof window === "undefined") return
    try {
        window.localStorage?.setItem(dismissKeyFor(clientId), "1")
    } catch {
        /* ignore */
    }
}

function GetStartedPanel({ clientId, refreshKey }) {
    const navigate = useNavigate()
    const [state, setState] = useState(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isHidden, setIsHidden] = useState(() => wasDismissed(clientId))

    useEffect(() => {
        if (!clientId || isHidden) return
        let active = true
        getOnboardingState(clientId)
            .then((payload) => {
                if (!active) return
                setState(payload || null)
                setIsLoaded(true)
            })
            .catch(() => {
                if (!active) return
                setIsLoaded(true)
            })
        return () => {
            active = false
        }
    }, [clientId, isHidden, refreshKey])

    if (isHidden || !isLoaded || !state) return null
    // Hide on its own once the checklist is fully complete — no point
    // showing a 3/3 panel forever; bookkeeper knows their way around.
    if (state.isComplete) return null

    const { steps = [], doneCount, totalCount } = state
    const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    const handleDismiss = () => {
        markDismissed(clientId)
        setIsHidden(true)
    }

    return (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                        Getting started
                    </p>
                    <h2 className="mt-0.5 text-base font-semibold text-gray-900">
                        Finish setting up this client
                    </h2>
                    <p className="text-[12px] text-gray-600">
                        {doneCount} of {totalCount} steps complete · {percent}%
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-md p-1.5 text-gray-500 transition hover:bg-indigo-100 hover:text-gray-800"
                    title="Hide this panel"
                    aria-label="Hide getting started"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>
            </div>

            <div className="mt-3 h-1.5 w-full rounded-full bg-indigo-100">
                <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <ol className="mt-4 flex flex-col gap-2.5">
                {steps.map((step, idx) => (
                    <li
                        key={step.id}
                        className="flex items-start gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2.5"
                    >
                        <span
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                step.done
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-indigo-100 text-indigo-700"
                            }`}
                        >
                            {step.done ? (
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                idx + 1
                            )}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p
                                className={`text-sm font-medium ${
                                    step.done ? "text-gray-500 line-through" : "text-gray-900"
                                }`}
                            >
                                {step.label}
                            </p>
                            <p className="text-[12px] text-gray-600">{step.description}</p>
                        </div>
                        {!step.done && step.ctaPath && (
                            <button
                                type="button"
                                onClick={() => navigate(step.ctaPath)}
                                className="shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
                            >
                                {step.cta}
                            </button>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    )
}

export default GetStartedPanel
