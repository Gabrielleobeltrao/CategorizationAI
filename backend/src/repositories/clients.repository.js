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

    // atualiza somente campos enviados no patch
    const allowed = {
        name: patch.name,
        businessType: patch.businessType,
        description: patch.description,
        mainActivity: patch.mainActivity,
        state: patch.state,
        updatedAt: new Date(),
    }

    const $set = Object.fromEntries(
        Object.entries(allowed).filter(([, value]) => value !== undefined)
    )

    return db.collection("clients").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set },
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
