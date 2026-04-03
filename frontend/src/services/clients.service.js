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

export async function updateClientById(clientId, patch) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")
  if (!patch || typeof patch !== "object") throw new Error("patch is required")

  return api(`/api/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export async function deleteClientById(clientId) {
  const id = String(clientId || "").trim()
  if (!id) throw new Error("clientId is required")

  return api(`/api/clients/${id}`, {
    method: "DELETE",
  })
}
