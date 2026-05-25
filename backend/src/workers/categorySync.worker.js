// No-op worker — the tag-based auto-sync was removed together with the
// tag system. The exported functions stay so callers across the codebase
// keep working without edits, but they don't queue or run anything.

export function enqueueClientCategorySync() {
  return false
}

export function enqueueOfficeCategorySync() {
  return false
}

export async function startCategorySyncWorker() {
  /* nothing to do */
}
