// Tag-driven category template auto-sync was retired together with the tag
// system. Kept as no-op stubs so existing callers (clients service, etc.)
// don't need to be edited. Future "Apply preset to client" UI would live
// elsewhere and explicitly take a template id from the user.

export async function syncClientCategoriesByTagsService() {
  return { copied: 0, updated: 0, removed: 0 }
}

export async function syncOfficeClientsByTagsService() {
  return { copied: 0, updated: 0, removed: 0 }
}
