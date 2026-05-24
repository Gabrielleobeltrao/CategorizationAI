import { getOfficeOverviewService } from "../services/officeOverview.service.js"
import {
    listActivityByOfficeAndActor,
    listActivityByOffice,
} from "../repositories/activityLog.repository.js"
import { sendErrorResponse } from "../utils/httpError.js"

export async function getOfficeOverviewController(req, res) {
    try {
        const data = await getOfficeOverviewService({
            officeId: req.params.officeId,
            actorId: req.userProfile?._id,
        })
        return res.status(200).json(data)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

function serializeActivity(entry) {
    return {
        id: String(entry._id),
        actorId: entry.actorId,
        actorName: entry.actorName || "",
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        label: entry.label || "",
        meta: entry.meta || null,
        at: entry.at,
    }
}

export async function getOfficeMyActivityController(req, res) {
    try {
        const actorId = String(req.userProfile?._id || "").trim()
        const items = await listActivityByOfficeAndActor(req.params.officeId, actorId, {
            limit: Number(req.query?.limit) || 30,
        })
        return res.status(200).json({
            items: items.map(serializeActivity),
        })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function getOfficeActivityController(req, res) {
    try {
        const items = await listActivityByOffice(req.params.officeId, {
            actorId: req.query?.actorId,
            action: req.query?.action,
            targetType: req.query?.targetType,
            from: req.query?.from,
            to: req.query?.to,
            limit: Number(req.query?.limit) || 50,
        })
        return res.status(200).json({
            items: items.map(serializeActivity),
        })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}
