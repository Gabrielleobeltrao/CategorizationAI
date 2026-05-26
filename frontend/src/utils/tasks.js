// Sort utility shared by every task list / board so that completed tasks
// always sink to the bottom while preserving the original relative order
// of the rest. Stable thanks to the index tiebreaker on `sort`.
export function sortTasksDoneLast(tasks) {
    if (!Array.isArray(tasks)) return []
    return tasks
        .map((task, index) => ({ task, index }))
        .sort((a, b) => {
            const aDone = String(a.task?.status || "").toLowerCase() === "done"
            const bDone = String(b.task?.status || "").toLowerCase() === "done"
            if (aDone === bDone) return a.index - b.index
            return aDone ? 1 : -1
        })
        .map((entry) => entry.task)
}
