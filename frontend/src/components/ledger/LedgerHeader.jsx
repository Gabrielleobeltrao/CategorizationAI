import { useCallback, useEffect, useState } from "react"
import { useFeature } from "../../hooks/useFeature"
import { useNotification } from "../../contexts/notification.context"
import {
    getClientOperationalStatus,
    setClientOperationalStatus,
} from "../../services/operationalStatus.service"
import OperationalStatusBadge from "../crm/OperationalStatusBadge"
import OperationalStatusHelp from "../crm/OperationalStatusHelp"

function ManualStatusButton({ active, disabled, onClick, tone, label, activeLabel, icon }) {
    const baseClass = "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
    const idleClass = "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
    const activeClass = tone === "emerald"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"

    return (
        <button
            type="button"
            className={`${baseClass} ${active ? activeClass : idleClass}`}
            disabled={disabled}
            onClick={onClick}
        >
            {icon}
            <span>{active ? activeLabel : label}</span>
        </button>
    )
}

function LedgerHeader({ clientId, clientName }) {
    const isOperationalStatusEnabled = useFeature("crmOperationalStatus")
    const { success, error } = useNotification()
    const [record, setRecord] = useState(null)
    const [isLoadingStatus, setIsLoadingStatus] = useState(false)
    const [pendingStatus, setPendingStatus] = useState("")

    const safeClientId = String(clientId || "").trim()

    useEffect(() => {
        if (!safeClientId || !isOperationalStatusEnabled) {
            setRecord(null)
            return undefined
        }
        let active = true
        setIsLoadingStatus(true)
        getClientOperationalStatus(safeClientId)
            .then((payload) => {
                if (!active) return
                setRecord(payload || null)
            })
            .catch(() => {
                if (active) setRecord(null)
            })
            .finally(() => {
                if (active) setIsLoadingStatus(false)
            })
        return () => { active = false }
    }, [safeClientId, isOperationalStatusEnabled])

    const manualStatus = record?.manualStatus || null
    const effectiveStatus = record?.effectiveStatus || ""

    const applyManualStatus = useCallback(async (nextStatus) => {
        if (!safeClientId) return
        const isClearing = nextStatus === null
        const target = isClearing ? "clear" : nextStatus
        setPendingStatus(target)
        try {
            const updated = await setClientOperationalStatus(safeClientId, { status: nextStatus })
            setRecord(updated || null)
            success(
                isClearing
                    ? "Operational status reset to automatic."
                    : nextStatus === "paused"
                        ? "Client marked as paused."
                        : "Client marked as completed."
            )
        } catch (err) {
            error(err.message || "Failed to update operational status")
        } finally {
            setPendingStatus("")
        }
    }, [safeClientId, success, error])

    const toggleStatus = (target) => {
        if (manualStatus === target) {
            applyManualStatus(null)
        } else {
            applyManualStatus(target)
        }
    }

    const isBusy = Boolean(pendingStatus)

    return (
        <header className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="min-w-0 truncate text-xl font-semibold">
                        {clientName || "Unknown client"}
                    </h1>
                    {isOperationalStatusEnabled && effectiveStatus && (
                        <OperationalStatusBadge status={effectiveStatus} size="md" />
                    )}
                </div>

                {isOperationalStatusEnabled && safeClientId && (
                    <div className="flex flex-wrap items-center gap-2">
                        <ManualStatusButton
                            tone="emerald"
                            active={manualStatus === "completed"}
                            disabled={isBusy || isLoadingStatus}
                            onClick={() => toggleStatus("completed")}
                            label="Pronto"
                            activeLabel="Pronto ✓"
                            icon={
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            }
                        />
                        <ManualStatusButton
                            tone="rose"
                            active={manualStatus === "paused"}
                            disabled={isBusy || isLoadingStatus}
                            onClick={() => toggleStatus("paused")}
                            label="Pausar"
                            activeLabel="Pausado"
                            icon={
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="6" y="5" width="4" height="14" rx="1" />
                                    <rect x="14" y="5" width="4" height="14" rx="1" />
                                </svg>
                            }
                        />
                        <OperationalStatusHelp />
                    </div>
                )}
            </div>
        </header>
    )
}

export default LedgerHeader
