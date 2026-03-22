import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createUserProfile(input) {
    const db = getDB()

    const doc = {
        name: input.name,
        officeId: input.officeId,
        role: input.role,
        email: input.email,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("user_profile").insertOne(doc)
    return {...doc, _id: result.insertedId}
}

// atualizar

export async function updateUserProfileById(id, patch) {
    const db = getDB()

    return db.collection("user_profile").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...patch, updatedAt: new Date() } },
        { returnDocument: "after"}
    )
}

// buscar userProfile

export async function getUserProfileById(id) {
    const db = getDB()
    return db.collection("user_profile").findOne({ _id: new ObjectId(id) })
}

export async function listUserProfilesByOfficeId(officeId) {
    const db = getDB()
    return db.collection("user_profile").find({ officeId }).sort({ createdAt: -1 }).toArray()
}

export async function getUserProfileByEmail(email) {
    const db = getDB()
    return db.collection("user_profile").findOne({ email: String(email).toLowerCase() })
}
