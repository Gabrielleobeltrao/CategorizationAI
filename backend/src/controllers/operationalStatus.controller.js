import {
    getOperationalStatusForClientService,
    listOperationalStatusesByOfficeIdService,
    setManualOperationalStatusService,
} from "../services/operationalStatus.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

function buildContext(req) {
    return {
        actorOfficeId: req.userProfile?.officeId,
        actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
    }
}

export async function getClientOperationalStatusController(req, res) {
    try {
        const status = await getOperationalStatusForClientService(req.params.id, buildContext(req))
        return res.status(200).json(status)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function setClientOperationalStatusController(req, res) {
    try {
        const status = await setManualOperationalStatusService(
            req.params.id,
            req.body || {},
            buildContext(req)
        )
        return res.status(200).json(status)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function listOfficeOperationalStatusesController(req, res) {
    try {
        const items = await listOperationalStatusesByOfficeIdService(
            req.params.id,
            buildContext(req)
        )
        return res.status(200).json({ items })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}
