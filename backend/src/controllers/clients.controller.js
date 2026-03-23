import {
    createClientService,
    updateClientByIdService,
    listClientsByOfficeIdService,
    getClientByIdService,
    deleteClientByIdService,
} from "../services/clients.service.js"

export async function createClientController(req, res) {
    try {
        const client = await createClientService(req.body)
        return res.status(201).json(client)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function updateClientByIdController(req, res) {
    try {
        const { id } = req.params
        const updatedClient = await updateClientByIdService(id, req.body)
        return res.status(200).json(updatedClient)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function listClientsByOfficeIdController(req, res) {
    try {
        const { officeId } = req.params
        const clients = await listClientsByOfficeIdService(officeId, req.query)
        return res.status(200).json(clients)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
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

        return res.status(200).json(client)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function deleteClientByIdController(req, res) {
    try {
        const { id } = req.params
        await deleteClientByIdService(id)
        return res.status(204).send()
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}
