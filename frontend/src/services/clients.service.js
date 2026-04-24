import { api } from "../lib/api"

export async function listClientsByOfficeId(officeId, options = {}) {
  const cleanOfficeId = String(officeId || "").trim()
  if (!cleanOfficeId) throw new Error("officeId is required")

  const page = Number(options.page || 1)
  const limit = Number(options.limit || 10)
  const search = String(options.search || "").trim()
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (search) {
    params.set("search", search)
  }

  return api(`/api/offices/${cleanOfficeId}/clients?${params.toString()}`)
}

export async function createClient(input) {
  const officeId = String(input?.officeId || "").trim()
  const name = String(input?.name || "").trim()
  const businessType = String(input?.businessType || "").trim()
  const description = String(input?.description || "").trim()
  const mainActivity = String(input?.mainActivity || "").trim()
  const state = String(input?.state || "").trim()
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
    : []
  const owners = Array.isArray(input?.owners)
    ? input.owners
      .map((owner) => {
        if (typeof owner === "string") {
          return {
            name: owner.trim(),
            email: "",
            phone: "",
          }
        }

        return {
          name: String(owner?.name || "").trim(),
          email: String(owner?.email || "").trim(),
          phone: String(owner?.phone || "").trim(),
        }
      })
      .filter((owner) => owner.name || owner.email || owner.phone)
    : []

  if (!officeId) throw new Error("officeId is required")
  if (!name) throw new Error("name is required")
  if (!businessType) throw new Error("businessType is required")
  if (!description) throw new Error("description is required")
  if (!mainActivity) throw new Error("mainActivity is required")
  if (!state) throw new Error("state is required")

  const payload = {
    officeId,
    name,
    businessType,
    description,
    mainActivity,
    state,
    tags,
    owners,
  }

  return api("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getClientById(clientId) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  return api(`/api/clients/${id}`)
}

export async function getClientLedgerBootstrap(clientId, options = {}) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  const params = new URLSearchParams()
  const accountIds = Array.isArray(options.accountIds) ? options.accountIds : []
  const categoryIds = Array.isArray(options.categoryIds) ? options.categoryIds : []
  const years = Array.isArray(options.years) ? options.years : []
  const months = Array.isArray(options.months) ? options.months : []
  const search = String(options.search || "").trim()
  const paginationMode = String(options.paginationMode || "page").trim().toLowerCase()
  const cursor = String(options.cursor || "").trim()
  const limit = Number(options.limit || 50)

  params.set("limit", String(limit))
  if (paginationMode === "cursor") {
    params.set("paginationMode", "cursor")
    if (cursor) params.set("cursor", cursor)
  } else {
    params.set("page", String(Number(options.page || 1)))
  }

  if (search) params.set("search", search)
  if (accountIds.length > 0) params.set("accountIds", accountIds.join(","))
  if (categoryIds.length > 0) params.set("categoryIds", categoryIds.join(","))
  if (options.includeUncategorizedIncome) params.set("includeUncategorizedIncome", "true")
  if (options.includeUncategorizedExpenses) params.set("includeUncategorizedExpenses", "true")
  if (String(options.splitMode || "all").trim().toLowerCase() !== "all") params.set("splitMode", String(options.splitMode || "all").trim().toLowerCase())
  if (String(options.amountSign || "all").trim().toLowerCase() !== "all") params.set("amountSign", String(options.amountSign || "all").trim().toLowerCase())
  if (String(options.fromDate || "").trim()) params.set("fromDate", String(options.fromDate || "").trim())
  if (String(options.toDate || "").trim()) params.set("toDate", String(options.toDate || "").trim())
  if (years.length > 0) params.set("years", years.join(","))
  if (months.length > 0) params.set("months", months.join(","))
  if (String(options.llmProcessed || "all").trim().toLowerCase() !== "all") params.set("llmProcessed", String(options.llmProcessed || "all").trim().toLowerCase())
  if (String(options.iconType || "all").trim().toLowerCase() !== "all") params.set("iconType", String(options.iconType || "all").trim().toLowerCase())
  if (options.minAmount !== undefined && String(options.minAmount).trim() !== "") params.set("minAmount", String(options.minAmount).trim())
  if (options.maxAmount !== undefined && String(options.maxAmount).trim() !== "") params.set("maxAmount", String(options.maxAmount).trim())

  return api(`/api/clients/${id}/ledger-bootstrap?${params.toString()}`, {
    silentLoading: Boolean(options.silentLoading),
  })
}

export async function updateClientById(clientId, patch) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  const nextPatch = { ...patch }
  if (Array.isArray(patch?.tags)) {
    nextPatch.tags = patch.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
  }

  return api(`/api/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(nextPatch),
  })
}

export async function deleteClientById(clientId) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  return api(`/api/clients/${id}`, {
    method: "DELETE",
  })
}
