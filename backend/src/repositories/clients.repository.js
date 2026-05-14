import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

const ATLAS_SEARCH_ENABLED = String(process.env.MONGODB_ATLAS_SEARCH_ENABLED || "true").trim().toLowerCase() !== "false"
const CLIENTS_SEARCH_INDEX_NAME = String(process.env.MONGODB_ATLAS_SEARCH_CLIENTS_INDEX_NAME || "clients_autocomplete").trim()
const ATLAS_SEARCH_QUERY_TIMEOUT_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_QUERY_TIMEOUT_MS || 2000))
const ATLAS_SEARCH_COOLDOWN_MS = Math.max(0, Number(process.env.MONGODB_ATLAS_SEARCH_COOLDOWN_MS || 120000))
let clientsAtlasSearchDisabledUntil = 0

const CLIENTS_SEARCH_STORED_SOURCE_FIELDS = [
    "_id",
    "officeId",
    "name",
    "businessType",
    "description",
    "mainActivity",
    "state",
    "tagIds",
    "owners",
    "ownerEmail",
    "ownerPhone",
    "ownerSearch",
    "createdAt",
    "updatedAt",
]

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function buildOwnerSearch(owners = [], ownerEmail = "", ownerPhone = "") {
    const ownerChunks = Array.isArray(owners)
        ? owners.flatMap((owner) => {
            if (typeof owner === "string") return [owner]
            if (!owner || typeof owner !== "object") return []

            return [
                owner.name,
                owner.email,
                owner.phone,
            ]
        })
        : []

    return [
        ...ownerChunks,
        ownerEmail,
        ownerPhone,
    ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ")
}

function buildSearchableStringFieldDefinition() {
    return [
        { type: "token" },
        { type: "string" },
        {
            type: "autocomplete",
            tokenization: "edgeGram",
            minGrams: 2,
            maxGrams: 15,
            foldDiacritics: true,
        },
    ]
}

function buildClientsSearchIndexDefinition() {
    const searchableField = buildSearchableStringFieldDefinition()

    return {
        storedSource: {
            include: CLIENTS_SEARCH_STORED_SOURCE_FIELDS,
        },
        mappings: {
            dynamic: false,
            fields: {
                officeId: { type: "token" },
                createdAt: { type: "date" },
                updatedAt: { type: "date" },
                name: searchableField,
                businessType: searchableField,
                description: searchableField,
                mainActivity: searchableField,
                state: searchableField,
                ownerSearch: searchableField,
            },
        },
    }
}

function isAtlasSearchUnavailableError(error) {
    const message = String(error?.message || "").toLowerCase()
    const errorCode = Number(error?.code || error?.errorResponse?.code || 0)

    return (
        errorCode === 20 ||
        message.includes("unrecognized pipeline stage name: '$search'") ||
        message.includes("search index commands are only supported with atlas") ||
        message.includes("command not found") ||
        message.includes("mongot") ||
        message.includes("maximum number of fts indexes") ||
        message.includes("maximum number of search indexes") ||
        message.includes("fts indexes has been reached") ||
        message.includes("search index") ||
        message.includes("index not found for search") ||
        message.includes("query requires a search index") ||
        message.includes("returnstoredsource") ||
        message.includes("storedsource")
    )
}

function buildAtlasAutocompleteClause(path, query, boost, fuzzy = null) {
    const autocomplete = {
        path,
        query,
        tokenOrder: "any",
        score: { boost: { value: boost } },
    }

    if (fuzzy) {
        autocomplete.fuzzy = fuzzy
    }

    return { autocomplete }
}

function buildClientsAtlasSearchStage({ officeId, search = "" }) {
    const safeOfficeId = String(officeId || "").trim()
    const safeSearch = String(search || "").trim()

    if (!ATLAS_SEARCH_ENABLED || !CLIENTS_SEARCH_INDEX_NAME || !safeOfficeId || !safeSearch) {
        return null
    }

    return {
        $search: {
            index: CLIENTS_SEARCH_INDEX_NAME,
            returnStoredSource: true,
            compound: {
                filter: [
                    {
                        equals: {
                            path: "officeId",
                            value: safeOfficeId,
                        },
                    },
                ],
                should: [
                    buildAtlasAutocompleteClause(
                        "name",
                        safeSearch,
                        8,
                        safeSearch.length >= 5
                            ? {
                                maxEdits: 1,
                                prefixLength: 2,
                                maxExpansions: 64,
                            }
                            : null
                    ),
                    buildAtlasAutocompleteClause("businessType", safeSearch, 3),
                    buildAtlasAutocompleteClause("mainActivity", safeSearch, 4),
                    buildAtlasAutocompleteClause("state", safeSearch, 2),
                    buildAtlasAutocompleteClause("ownerSearch", safeSearch, 4),
                    {
                        text: {
                            path: "name",
                            query: safeSearch,
                            score: { boost: { value: 6 } },
                        },
                    },
                    {
                        text: {
                            path: "description",
                            query: safeSearch,
                            score: { boost: { value: 3 } },
                        },
                    },
                    {
                        text: {
                            path: "mainActivity",
                            query: safeSearch,
                            score: { boost: { value: 4 } },
                        },
                    },
                    {
                        text: {
                            path: "ownerSearch",
                            query: safeSearch,
                            score: { boost: { value: 4 } },
                        },
                    },
                ],
                minimumShouldMatch: 1,
            },
        },
    }
}

function buildAtlasSearchTimeoutError(timeoutMs) {
    const error = new Error(`Atlas Search timed out after ${timeoutMs}ms`)
    error.code = "ATLAS_SEARCH_TIMEOUT"
    return error
}

async function ensureClientsSearchIndex() {
    if (!ATLAS_SEARCH_ENABLED || !CLIENTS_SEARCH_INDEX_NAME) return

    const db = getDB()
    const collection = db.collection("clients")
    const definition = buildClientsSearchIndexDefinition()

    try {
        const existingIndexes = await collection.listSearchIndexes(CLIENTS_SEARCH_INDEX_NAME).toArray()
        if (existingIndexes.length === 0) {
            await collection.createSearchIndex({
                name: CLIENTS_SEARCH_INDEX_NAME,
                definition,
            })
            return
        }

        const currentDefinition = existingIndexes[0]?.latestDefinition || existingIndexes[0]?.definition || null
        if (JSON.stringify(currentDefinition) === JSON.stringify(definition)) {
            return
        }

        await collection.updateSearchIndex(CLIENTS_SEARCH_INDEX_NAME, definition)
    } catch (error) {
        if (isAtlasSearchUnavailableError(error)) {
            console.warn(`[clients.repository] Atlas Search unavailable, keeping fallback search path: ${error.message}`)
            return
        }

        throw error
    }
}

async function runClientsAtlasSearchAggregate(collection, pipeline = []) {
    if (clientsAtlasSearchDisabledUntil > Date.now()) {
        return null
    }

    try {
        if (ATLAS_SEARCH_QUERY_TIMEOUT_MS <= 0) {
            return await collection.aggregate(pipeline).toArray()
        }

        return await Promise.race([
            collection.aggregate(pipeline).toArray(),
            new Promise((_, reject) => {
                setTimeout(() => reject(buildAtlasSearchTimeoutError(ATLAS_SEARCH_QUERY_TIMEOUT_MS)), ATLAS_SEARCH_QUERY_TIMEOUT_MS)
            }),
        ])
    } catch (error) {
        if (error?.code === "ATLAS_SEARCH_TIMEOUT" || isAtlasSearchUnavailableError(error)) {
            clientsAtlasSearchDisabledUntil = Date.now() + ATLAS_SEARCH_COOLDOWN_MS
            return null
        }

        throw error
    }
}

export async function ensureClientsIndexes() {
    const db = getDB()
    const collection = db.collection("clients")

    await Promise.all([
        collection.createIndex({ officeId: 1, createdAt: -1 }),
        collection.createIndex({ officeId: 1, name: 1 }),
        collection.createIndex({ officeId: 1, tagIds: 1 }),
    ])

    await ensureClientsSearchIndex()
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
        tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
        owners: Array.isArray(input.owners) ? input.owners : [],
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        ownerSearch: buildOwnerSearch(input.owners, input.ownerEmail, input.ownerPhone),
        createdBy: String(input.createdBy || ""),
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
        tagIds: patch.tagIds,
        owners: patch.owners,
        ownerEmail: patch.ownerEmail,
        ownerPhone: patch.ownerPhone,
        ownerSearch: patch.ownerSearch,
        updatedAt: new Date(),
    }

    const $set = Object.fromEntries(
        Object.entries(allowed).filter(([, value]) => value !== undefined)
    )

    const update = { $set }

    if (patch.clearLegacyTags) {
        update.$unset = { tags: "" }
    }

    return db.collection("clients").findOneAndUpdate(
        { _id: new ObjectId(id) },
        update,
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
    const collection = db.collection("clients")

    if (search) {
        const atlasSearchStage = buildClientsAtlasSearchStage({ officeId, search })
        if (atlasSearchStage) {
            const [items, totalResult] = await Promise.all([
                runClientsAtlasSearchAggregate(collection, [
                    atlasSearchStage,
                    { $sort: { createdAt: -1, _id: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                ]),
                runClientsAtlasSearchAggregate(collection, [
                    atlasSearchStage,
                    { $count: "total" },
                ]),
            ])

            if (items && totalResult) {
                const total = Number(totalResult?.[0]?.total || 0)
                const totalPages = Math.max(1, Math.ceil(total / limit))

                return {
                    items,
                    page,
                    limit,
                    total,
                    totalPages,
                }
            }
        }
    }

    if (search) {
        const safeSearch = escapeRegex(search)
        const searchRegex = new RegExp(safeSearch, "i")

        filter.$or = [
            { name: searchRegex },
            { businessType: searchRegex },
            { description: searchRegex },
            { mainActivity: searchRegex },
            { state: searchRegex },
            { "owners.name": searchRegex },
            { "owners.email": searchRegex },
            { "owners.phone": searchRegex },
            { ownerSearch: searchRegex },
            { ownerEmail: searchRegex },
            { ownerPhone: searchRegex },
        ]
    }

    const [items, total] = await Promise.all([
        collection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(filter),
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

export async function listAllClientsByOfficeId(officeId) {
    const db = getDB()
    return db.collection("clients").find({ officeId }).toArray()
}

// deletar cliente

export async function deleteClientById(id) {
    const db = getDB()
    return db.collection("clients").deleteOne({ _id: new ObjectId(id) })
}
