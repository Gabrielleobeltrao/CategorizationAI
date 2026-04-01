import { api } from "../lib/api"

export async function getOfficeHomeDashboard(officeId, options = {}) {
  const safeOfficeId = String(officeId || "").trim()
  if (!safeOfficeId) {
    throw new Error("officeId is required")
  }

  const query = new URLSearchParams()
  if (options?.month) {
    query.set("month", String(options.month))
  }

  const queryString = query.toString()
  const path = queryString
    ? `/api/offices/${safeOfficeId}/dashboard?${queryString}`
    : `/api/offices/${safeOfficeId}/dashboard`

  return api(path, { silentLoading: true })
}
