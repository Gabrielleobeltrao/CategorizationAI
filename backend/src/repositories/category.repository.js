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

    // informacoes que podem ser alteradas
    const { name, type, description, clientId } = patch

    return db.collection("categories").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name, type, description, clientId, updatedAt: new Date() } },
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
