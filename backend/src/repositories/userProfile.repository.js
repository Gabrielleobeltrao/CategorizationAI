import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createUserProfile(input) {
    const db = getDB()

    const doc = {
        name: input.name,
        officeId: input.officeId,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("user_profile").insertOne(doc)
    return {...doc, _id: result.insertedId}
}

// atualizar

export async function updateUserProfileById(id, patch) {
    const db = getDB()

    // informacoes que podem ser alteradas
    const { name } = patch

    return db.collection("user_profile").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { name, updatedAt: new Date() } },
        { returnDocument: "after"}
    )
}

// buscar userProfile

export async function getUserProfileById(id) {
    const db = getDB()
    return db.collection("user_profile").findOne({ _id: new ObjectId(id) })
}