import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

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
        owners: Array.isArray(input.owners) ? input.owners : [],
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
        owners: patch.owners,
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

export async function listClientsByOfficeId(officeId, options = {}) {
    const db = getDB()
    const page = options.page || 1
    const limit = options.limit || 10
    const skip = (page - 1) * limit
    const search = String(options.search || "").trim()
    const filter = { officeId }

    if (search) {
        const safeSearch = escapeRegex(search)
        const searchRegex = new RegExp(safeSearch, "i")

        filter.$or = [
            { name: searchRegex },
            { businessType: searchRegex },
            { description: searchRegex },
            { mainActivity: searchRegex },
            { state: searchRegex },
            { owners: searchRegex },
        ]
    }

    const [items, total] = await Promise.all([
        db.collection("clients")
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection("clients").countDocuments(filter),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
        items,
        page,
        limit,
        total,
        totalPages,
    }
}

// buscar cliente

export async function getClientById(id) {
    const db = getDB()
    return db.collection("clients").findOne({ _id: new ObjectId(id) })
}

// deletar cliente

export async function deleteClientById(id) {
    const db = getDB()
    return db.collection("clients").deleteOne({ _id: new ObjectId(id) })
}
