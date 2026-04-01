import {
    createOfficeService,
    updateOfficeByIdService,
    getOfficeByIdService,
    getOfficeDashboardByIdService,
} from "../services/office.service.js"

export async function createOfficeController(req, res) {
    try {
        const office = await createOfficeService(req.body)
        return res.status(201).json(office)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function updateOfficeByIdController(req, res) {
    try {
        const { id } = req.params
        const updatedOffice = await updateOfficeByIdService(id, req.body)
        return res.status(200).json(updatedOffice)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function getOfficeByIdController(req, res) {
    try{
        const { id } = req.params
        const office = await getOfficeByIdService(id)

        if (!office) {
            return res.status(404).json({
                message: "Office not found",
            })
        }

        return res.status(200).json(office)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}

export async function getOfficeDashboardByIdController(req, res) {
    try {
        const { id } = req.params
        const dashboard = await getOfficeDashboardByIdService(id, {
            month: req.query?.month,
            actorOfficeId: req.userProfile?.officeId,
        })
        return res.status(200).json(dashboard)
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        })
    }
}
