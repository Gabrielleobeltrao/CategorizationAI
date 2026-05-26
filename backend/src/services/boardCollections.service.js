import {
    createBoardCollection,
    deleteBoardCollectionById,
    getBoardCollectionById,
    listBoardCollectionsByOfficeId,
    unsetCollectionIdOnAllTasks,
    updateBoardCollectionById,
} from "../repositories/boardCollections.repository.js"

function ensureOfficeMatch(collection, actorOfficeId) {
    const safeActor = String(actorOfficeId || "").trim()
    if (!safeActor) throw new Error("Office context required")
    if (String(collection?.officeId || "") !== safeActor) {
        throw new Error("Forbidden for this office")
    }
}

export async function listBoardCollectionsService(context = {}) {
    const officeId = String(context?.actorOfficeId || "").trim()
    if (!officeId) throw new Error("Office context required")
    return listBoardCollectionsByOfficeId(officeId)
}

export async function createBoardCollectionService(input = {}, context = {}) {
    const officeId = String(context?.actorOfficeId || "").trim()
    if (!officeId) throw new Error("Office context required")
    return createBoardCollection({
        officeId,
        name: input?.name,
        createdBy: String(context?.actorProfileId || "").trim(),
    })
}

export async function updateBoardCollectionService(id, patch = {}, context = {}) {
    if (!id) throw new Error("id is required")
    const existing = await getBoardCollectionById(id)
    if (!existing) throw new Error("Board column not found")
    ensureOfficeMatch(existing, context?.actorOfficeId)
    return updateBoardCollectionById(id, patch)
}

export async function deleteBoardCollectionService(id, context = {}) {
    if (!id) throw new Error("id is required")
    const existing = await getBoardCollectionById(id)
    if (!existing) throw new Error("Board column not found")
    ensureOfficeMatch(existing, context?.actorOfficeId)
    await unsetCollectionIdOnAllTasks(id)
    await deleteBoardCollectionById(id)
}
