import { ObjectId, ReturnDocument } from "mongodb"
import { getDB } from "../db.js"

// criar

export async function createOffice(input) {
    const db = getDB()

    // adicionar informacoes do office
    const doc = {
        name: input.name,
        address: input.address || "",
        businessPhone: input.businessPhone || "",
        businessEmail: input.businessEmail || "",
        // OPEN TEST: temporary marker to identify offices created through test access codes.
        isOpenTestOffice: Boolean(input?.openTest?.isOpenTestOffice),
        openTestAccessCodeLabel: String(input?.openTest?.accessCodeLabel || ""),
        openTestCreatedAt: input?.openTest?.createdAt || null,
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
    const safePatch = {
        updatedAt: new Date(),
    }

    if (patch.name !== undefined) safePatch.name = patch.name
    if (patch.address !== undefined) safePatch.address = patch.address
    if (patch.businessPhone !== undefined) safePatch.businessPhone = patch.businessPhone
    if (patch.businessEmail !== undefined) safePatch.businessEmail = patch.businessEmail

    return db.collection("offices").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: safePatch },
        { returnDocument: "after" }
    )
}

// buscar office

export async function getOfficeById(id) {
    const db = getDB()
    return db.collection("offices").findOne({_id: new ObjectId(id)})
}
