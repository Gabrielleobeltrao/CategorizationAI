import {
    createClientService,
    updateClientByIdService,
    listClientsByOfficeIdService,
    getClientByIdService
} from "../services/clients.service.js"

export async function createClientController(req, res) {
    try {
        const client = await createClientService(req.body)
        return res.status(201).json(client)
    } catch {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function listClientsByOfficeIdController(req, res) {
    try {
        const { id } = req.params
        const updatedClient = await updateClientByIdService(id, req.body)
        return res.status(201).json(updatedClient)
    } catch {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function listClientsByOfficeIdController(req, res) {
    try {
        const officeId = req.params
        const clients = listClientsByOfficeIdService(officeId)
        return res.status(201).json(clients)
    } catch {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function getClientByIdController(req, res) {
    try {
        const { id } = req.params
        const client = getClientByIdService(id)

        if (!client) {
            return res.status(404).json({
                message: "Client not found",
            })
        }

        return res.status(201).status(client)
    } catch {
        return res.status(400).json({
            message: error.message,
        })
    }
}