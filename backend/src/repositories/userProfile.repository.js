import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

export async function ensureUserProfileIndexes() {
    const db = getDB()
    const collection = db.collection("user_profile")
    const authUsersCollection = db.collection("user")

    await Promise.all([
        collection.createIndex(
            { email: 1 },
            {
                unique: true,
                sparse: true,
            }
        ),
        collection.createIndex({ officeId: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, role: 1 }),
        authUsersCollection.createIndex(
            { email: 1 },
            {
                unique: true,
                sparse: true,
            }
        ),
    ])
}

// criar

export async function createUserProfile(input) {
    const db = getDB()

    const doc = {
        name: input.name,
        officeId: input.officeId,
        role: input.role,
        email: input.email,
        status: input.status,
        authUserId: input.authUserId,
        mustChangePassword: input.mustChangePassword ?? false,
        passwordResetAt: input.passwordResetAt ?? null,
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

export async function countUserProfilesByOfficeIdAndRole(officeId, role) {
    const db = getDB()
    return db.collection("user_profile").countDocuments({
        officeId,
        role: String(role || "").toLowerCase(),
    })
}

export async function getUserProfileByEmail(email) {
    const db = getDB()
    return db.collection("user_profile").findOne({ email: String(email).toLowerCase() })
}

export async function deleteUserProfileById(id) {
    const db = getDB()
    return db.collection("user_profile").findOneAndDelete({ _id: new ObjectId(id) })
}

export async function getAuthUserByEmail(email) {
    const db = getDB()
    return db.collection("user").findOne({ email: String(email).toLowerCase() })
}

export async function deleteAuthUserCascadeById(authUserId) {
    const db = getDB()
    const userId = new ObjectId(authUserId)

    await Promise.all([
        db.collection("session").deleteMany({ userId }),
        db.collection("account").deleteMany({ userId }),
    ])

    return db.collection("user").deleteOne({ _id: userId })
}

export async function setCredentialPasswordByAuthUserId(authUserId, passwordHash) {
    const db = getDB()
    return db.collection("account").findOneAndUpdate(
        {
            providerId: "credential",
            userId: new ObjectId(authUserId),
        },
        {
            $set: {
                password: passwordHash,
                updatedAt: new Date(),
            },
        },
        { returnDocument: "after" }
    )
}
