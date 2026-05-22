import { Link } from "react-router-dom"

// Reusable empty-state block. Used across reports and report-like pages
// so users always see *what to do next* instead of a bare "No data."
//
// Props:
//   icon       Optional ReactNode (defaults to a generic chart icon)
//   title      Short headline, e.g. "No transactions yet"
//   description Longer hint with the recommended next step
//   primaryAction  { label, to } | { label, onClick }  — dark button
//   secondaryAction same shape — outline button (optional)
//   variant    "default" | "compact" — tighter padding for in-card slots

function ActionButton({ action, variant = "primary" }) {
    if (!action) return null
    const className =
        variant === "primary"
            ? "inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
            : "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"

    if (action.to) {
        return (
            <Link to={action.to} className={className}>
                {action.icon}
                {action.label}
            </Link>
        )
    }
    return (
        <button type="button" onClick={action.onClick} className={className}>
            {action.icon}
            {action.label}
        </button>
    )
}

function DefaultIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 3v18" />
        </svg>
    )
}

function EmptyState({
    icon,
    title,
    description,
    primaryAction,
    secondaryAction,
    variant = "default",
}) {
    const pad = variant === "compact" ? "px-6 py-8" : "px-8 py-12"
    return (
        <div className={`flex flex-col items-center gap-3 text-center ${pad}`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                {icon || <DefaultIcon />}
            </div>
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {description && (
                <p className="max-w-md text-sm text-gray-600">{description}</p>
            )}
            {(primaryAction || secondaryAction) && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
                    {secondaryAction && (
                        <ActionButton action={secondaryAction} variant="secondary" />
                    )}
                </div>
            )}
        </div>
    )
}

export default EmptyState
