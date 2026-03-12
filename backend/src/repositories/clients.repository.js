import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createClient(input) {
    const db = getDB()

    // adicionar informacoes do cliente
    const doc = {
        officeId: input.officeId,
        name: input.name,
        businessType: input.businessType,
        description: input.description,
        mainActivity: input.mainActivity,
        state: input.state,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("clients").insertOne(doc)
    return {...doc, _id: result.insertedId}
}

// atualizar

export async function updateClientById(id, patch) {
    const db = getDB()

    // informacoes que podem ser alteradas
    const { name, businessType, description, mainActivity, state } = patch

    return db.collection("clients").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name, businessType, description, mainActivity, state, updatedAt: new Date() } },
        { returnDocument: "after"}
    )
}

// buscar lista

export async function listClientsByOfficeId(officeId) {
    const db = getDB()
    return db.collection("clients").find({ officeId }).sort({ createdAt: -1}).toArray()
}

// buscar cliente

export async function getClientById(id) {
    const db = getDB()
    return db.collection("clients").findOne({ _id: new ObjectId(id) })
}