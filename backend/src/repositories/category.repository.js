import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

export async function ensureCategoryIndexes() {
    const db = getDB()
    const collection = db.collection("categories")

    await Promise.all([
        collection.createIndex({ clientId: 1, createdAt: -1 }),
        collection.createIndex({ clientId: 1, type: 1 }),
        collection.createIndex({ clientId: 1, name: 1 }),
        collection.createIndex({ clientId: 1, tagIds: 1 }),
        collection.createIndex({ clientId: 1, templateCategoryId: 1 }),
    ])
}

// criar

export async function createCategory(input) {
    const db = getDB()

    // adicionar informacoes da categoria
    const doc = {
        name: input.name,
        type: input.type,
        description: input.description,
        clientId: input.clientId,
        tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
        templateCategoryId: input.templateCategoryId ?? null,
        isTemplateSynced: Boolean(input.isTemplateSynced),
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
        tagIds: patch.tagIds,
        templateCategoryId: patch.templateCategoryId,
        isTemplateSynced: patch.isTemplateSynced,
        updatedAt: new Date(),
    }

    const $set = Object.fromEntries(
        Object.entries(allowed).filter(([, value]) => value !== undefined)
    )

    const update = { $set }

    if (patch.clearLegacyTags) {
        update.$unset = { tags: "" }
    }

    return db.collection("categories").findOneAndUpdate(
        { _id: new ObjectId(id) },
        update,
        { returnDocument: "after" }
    )
}

export async function createCategoriesBulk(input = []) {
    const db = getDB()
    if (!Array.isArray(input) || input.length === 0) return []

    const docs = input.map((item) => ({
        name: item.name,
        type: item.type,
        description: item.description,
        clientId: item.clientId,
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        templateCategoryId: item.templateCategoryId ?? null,
        isTemplateSynced: Boolean(item.isTemplateSynced),
        createdAt: new Date(),
        updatedAt: new Date(),
    }))

    await db.collection("categories").insertMany(docs)
    return docs
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

export async function deleteCategoriesByIds(ids = []) {
    const db = getDB()
    const objectIds = Array.isArray(ids)
        ? ids
            .filter((id) => id && ObjectId.isValid(String(id)))
            .map((id) => new ObjectId(String(id)))
        : []

    if (objectIds.length === 0) {
        return { deletedCount: 0 }
    }

    return db.collection("categories").deleteMany({ _id: { $in: objectIds } })
}

export async function deleteCategoriesByClientId(clientId) {
    const db = getDB()
    return db.collection("categories").deleteMany({ clientId })
}
