import {
    createClientService,
    updateClientByIdService,
    listClientsByOfficeIdService,
    getClientByIdService,
    deleteClientByIdService,
} from "../services/clients.service.js"
import { userHasPermissionService } from "../services/roles.service.js"
import { getErrorStatusCode } from "../utils/appError.js"

function sanitizeClientOwnerInfo(client, canReadOwnerInfo) {
    if (!client || canReadOwnerInfo) return client

    const sanitized = { ...client }
    delete sanitized.ownerEmail
    delete sanitized.ownerPhone

    if (Array.isArray(sanitized.owners)) {
        sanitized.owners = sanitized.owners.map((owner) => {
            if (typeof owner === "string") return owner
            if (!owner || typeof owner !== "object") return owner

            return {
                ...owner,
                email: "",
                phone: "",
            }
        })
    }

    return sanitized
}

function ownersPayloadHasContactInfo(owners) {
    if (!Array.isArray(owners)) return false

    return owners.some((owner) => {
        if (!owner || typeof owner !== "object") return false
        const email = String(owner.email || "").trim()
        const phone = String(owner.phone || "").trim()
        return Boolean(email || phone)
    })
}

function payloadTouchesOwnerInfo(payload) {
    if (!payload || typeof payload !== "object") return false
    return Object.prototype.hasOwnProperty.call(payload, "ownerEmail") ||
        Object.prototype.hasOwnProperty.call(payload, "ownerPhone") ||
        ownersPayloadHasContactInfo(payload.owners)
}

export async function createClientController(req, res) {
    try {
        if (payloadTouchesOwnerInfo(req.body)) {
            const canUpdateOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:update")
            if (!canUpdateOwnerInfo) {
                return res.status(403).json({
                    message: "Forbidden owner info update",
                })
            }
        }

        const client = await createClientService(req.body)
        const canReadOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:read")
        return res.status(201).json(sanitizeClientOwnerInfo(client, canReadOwnerInfo))
    } catch (error) {
        return res.status(getErrorStatusCode(error)).json({
            message: error.message,
            ...(error?.details ? { details: error.details } : {}),
        })
    }
}

export async function updateClientByIdController(req, res) {
    try {
        const { id } = req.params
        const canUpdateOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:update")

        if (payloadTouchesOwnerInfo(req.body)) {
            if (!canUpdateOwnerInfo) {
                return res.status(403).json({
                    message: "Forbidden owner info update",
                })
            }
        }

        if (!canUpdateOwnerInfo && Array.isArray(req.body?.owners)) {
            const currentClient = await getClientByIdService(id)
            const currentOwners = Array.isArray(currentClient?.owners) ? currentClient.owners : []

            req.body.owners = req.body.owners.map((owner, index) => {
                if (!owner || typeof owner !== "object") return owner
                const currentOwner = currentOwners[index]
                if (!currentOwner || typeof currentOwner !== "object") return owner

                return {
                    ...owner,
                    email: String(currentOwner.email || ""),
                    phone: String(currentOwner.phone || ""),
                }
            })
        }

        const updatedClient = await updateClientByIdService(id, req.body)
        const canReadOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:read")
        return res.status(200).json(sanitizeClientOwnerInfo(updatedClient, canReadOwnerInfo))
    } catch (error) {
        return res.status(getErrorStatusCode(error)).json({
            message: error.message,
            ...(error?.details ? { details: error.details } : {}),
        })
    }
}

export async function listClientsByOfficeIdController(req, res) {
    try {
        const { officeId } = req.params
        const clients = await listClientsByOfficeIdService(officeId, req.query)
        const canReadOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:read")

        const items = Array.isArray(clients?.items)
            ? clients.items.map((item) => sanitizeClientOwnerInfo(item, canReadOwnerInfo))
            : []

        return res.status(200).json({
            ...clients,
            items,
        })
    } catch (error) {
        return res.status(getErrorStatusCode(error)).json({
            message: error.message,
            ...(error?.details ? { details: error.details } : {}),
        })
    }
}

export async function getClientByIdController(req, res) {
    try {
        const { id } = req.params
        const client = await getClientByIdService(id)

        if (!client) {
            return res.status(404).json({
                message: "Client not found",
            })
        }

        const canReadOwnerInfo = await userHasPermissionService(req.userProfile, "clientsOwnerInfo:read")
        return res.status(200).json(sanitizeClientOwnerInfo(client, canReadOwnerInfo))
    } catch (error) {
        return res.status(getErrorStatusCode(error)).json({
            message: error.message,
            ...(error?.details ? { details: error.details } : {}),
        })
    }
}

export async function deleteClientByIdController(req, res) {
    try {
        const { id } = req.params
        await deleteClientByIdService(id)
        return res.status(204).send()
    } catch (error) {
        return res.status(getErrorStatusCode(error)).json({
            message: error.message,
            ...(error?.details ? { details: error.details } : {}),
        })
    }
}
