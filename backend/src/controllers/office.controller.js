import {
    createOfficeService,
    updateOfficeByIdService,
    getOfficeByIdService,
    getOfficeDashboardByIdService,
    setOfficeFeaturesService,
} from "../services/office.service.js"
import { deleteOfficeTagService, listOfficeTagsService } from "../services/tag.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function createOfficeController(req, res) {
    try {
        const office = await createOfficeService(req.body, {
            actorHasProfile: Boolean(req.userProfile?._id),
        })
        return res.status(201).json(office)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function updateOfficeByIdController(req, res) {
    try {
        const { id } = req.params
        const updatedOffice = await updateOfficeByIdService(id, {
            ...req.body,
            actorOfficeId: req.userProfile?.officeId,
        })
        return res.status(200).json(updatedOffice)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function setOfficeFeaturesController(req, res) {
    try {
        const { id } = req.params
        const features = req.body?.features && typeof req.body.features === "object"
            ? req.body.features
            : {}
        const updatedOffice = await setOfficeFeaturesService(id, features, {
            actorOfficeId: req.userProfile?.officeId,
        })
        return res.status(200).json(updatedOffice)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function getOfficeByIdController(req, res) {
    try{
        const { id } = req.params
        const office = await getOfficeByIdService(id, {
            actorOfficeId: req.userProfile?.officeId,
        })

        if (!office) {
            return res.status(404).json({
                message: "Office not found",
            })
        }

        return res.status(200).json(office)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function getOfficeDashboardByIdController(req, res) {
    try {
        const { id } = req.params
        const dashboard = await getOfficeDashboardByIdService(id, {
            month: req.query?.month,
            actorId: req.query?.actorId,
            actorOfficeId: req.userProfile?.officeId,
        })
        return res.status(200).json(dashboard)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function listOfficeTagsController(req, res) {
    try {
        const { id } = req.params
        const tags = await listOfficeTagsService(id, {
            actorOfficeId: req.userProfile?.officeId,
        })

        return res.status(200).json({
            items: tags,
        })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function deleteOfficeTagController(req, res) {
    try {
        const { id } = req.params
        const result = await deleteOfficeTagService(id, req.body?.tag, {
            actorOfficeId: req.userProfile?.officeId,
        })

        return res.status(200).json(result)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}
