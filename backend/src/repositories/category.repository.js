import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createCategory(input) {
    const db = getDB()

    // adicionar informacoes da categoria
    const doc = {
        name: input.name,
        type: input.type,
        description: input.description,
        clientId: input.clientId,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("categories").insertOne(doc)
    return { ...doc, _id: result.insertedId }
}

// atualizar 

export async function updateCategoryById(id, patch) {
    const db = getDB()

    // atualiza somente campos enviados no patch
    const allowed = {
        name: patch.name,
        type: patch.type,
        description: patch.description,
        clientId: patch.clientId,
        updatedAt: new Date(),
    }

    const $set = Object.fromEntries(
        Object.entries(allowed).filter(([, value]) => value !== undefined)
    )

    return db.collection("categories").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
        { returnDocument: "after" }
    )
}

// buscar lista

export async function listCategoriesByClientId(clientId) {
    const db = getDB()
    return db.collection("categories").find({ clientId }).sort({ createdAt: -1}).toArray()
}

// buscar categoria 

export async function getCategoryById(id) {
    const db = getDB()
    return db.collection("categories").findOne({_id: new ObjectId(id)})
}

export async function listCategoriesByIds(ids = []) {
    const db = getDB()
    if (!Array.isArray(ids) || ids.length === 0) return []

    const objectIds = ids
        .filter((id) => id && ObjectId.isValid(String(id)))
        .map((id) => new ObjectId(String(id)))

    if (objectIds.length === 0) return []

    return db.collection("categories").find({ _id: { $in: objectIds } }).toArray()
}

export async function deleteCategoryById(id) {
    const db = getDB()
    return db.collection("categories").deleteOne({ _id: new ObjectId(id) })
}
