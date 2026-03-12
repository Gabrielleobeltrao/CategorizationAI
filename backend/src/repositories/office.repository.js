import { ObjectId, ReturnDocument } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createOffice(input) {
    const db = getDB()

    // adicionar informacoes do office
    const doc = {
        name: input.name,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("offices").insertOne(doc)
    return {...doc, _id: result.insertedId}
}

// atualizar

export async function updateOfficeById(id, patch) {
    const db = getDB()

    // informacoes que podem ser alteradas
    const { name } = patch

    return db.collection("offices").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name, updatedAt: new Date() } },
        { returnDocument: "after" }
    )
}

// buscar office

export async function getOfficeById(id) {
    const db = getDB()
    return db.collection("offices").findOne({_id: new ObjectId(id)})
}
