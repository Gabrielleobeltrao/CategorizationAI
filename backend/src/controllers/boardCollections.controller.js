import {
    listBoardCollectionsService,
    createBoardCollectionService,
    updateBoardCollectionService,
    deleteBoardCollectionService,
} from "../services/boardCollections.service.js"
import { sendErrorResponse } from "../utils/httpError.js"

function buildContext(req) {
    return {
        actorOfficeId: req.userProfile?.officeId,
        actorProfileId: req.userProfile?._id ? String(req.userProfile._id) : "",
    }
}

export async function listBoardCollectionsController(req, res) {
    try {
        const items = await listBoardCollectionsService(buildContext(req))
        return res.status(200).json({ items })
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function createBoardCollectionController(req, res) {
    try {
        const created = await createBoardCollectionService(req.body || {}, buildContext(req))
        return res.status(201).json(created)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function updateBoardCollectionController(req, res) {
    try {
        const updated = await updateBoardCollectionService(req.params.id, req.body || {}, buildContext(req))
        return res.status(200).json(updated)
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}

export async function deleteBoardCollectionController(req, res) {
    try {
        await deleteBoardCollectionService(req.params.id, buildContext(req))
        return res.status(204).send()
    } catch (error) {
        return sendErrorResponse(res, error)
    }
}
