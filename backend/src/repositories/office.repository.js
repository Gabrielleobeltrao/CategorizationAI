import { ObjectId, ReturnDocument } from "mongodb"
import { getDB } from "../db.js"

export const DEFAULT_OFFICE_FEATURES = Object.freeze({
    crm: false,
    crmOperationalStatus: false,
})

export function normalizeOfficeFeatures(features) {
    const safeCrm = Boolean(features?.crm)
    return {
        ...DEFAULT_OFFICE_FEATURES,
        ...(features && typeof features === "object" ? features : {}),
        crm: safeCrm,
        // Sub-flag stays off whenever the parent CRM add-on is disabled.
        crmOperationalStatus: safeCrm && Boolean(features?.crmOperationalStatus),
    }
}

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
        // Feature flags drive paid add-ons (e.g. Operations CRM). Stripe will sync these later.
        features: { ...DEFAULT_OFFICE_FEATURES },
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await db.collection("offices").insertOne(doc)
    return {...doc, _id: result.insertedId}
}

// internal: bypass regular update path; used by scripts and (later) Stripe webhook
export async function setOfficeFeatures(id, featuresPatch) {
    const db = getDB()
    const safeFeatures = normalizeOfficeFeatures(featuresPatch)

    return db.collection("offices").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { features: safeFeatures, updatedAt: new Date() } },
        { returnDocument: "after" }
    )
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
    if (patch.isOpenTestOffice !== undefined) safePatch.isOpenTestOffice = Boolean(patch.isOpenTestOffice)
    if (patch.openTestAccessCodeLabel !== undefined) safePatch.openTestAccessCodeLabel = patch.openTestAccessCodeLabel
    if (patch.openTestCreatedAt !== undefined) safePatch.openTestCreatedAt = patch.openTestCreatedAt

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

export async function deleteOfficeById(id) {
    const db = getDB()
    return db.collection("offices").deleteOne({ _id: new ObjectId(id) })
}

export async function listAllOfficeIds() {
    const db = getDB()
    const offices = await db.collection("offices")
        .find({}, { projection: { _id: 1 } })
        .toArray()

    return offices
        .map((office) => String(office?._id || "").trim())
        .filter(Boolean)
}
