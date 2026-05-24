import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const TARGET_EMAIL = (process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] || "gabrielleoaus@gmail.com")
    .toLowerCase()

const FAKE_COWORKERS = [
    { name: "Maria Silva", email: "maria.demo@chat-demo.local", role: "manager" },
    { name: "João Pereira", email: "joao.demo@chat-demo.local", role: "staff" },
    { name: "Ana Costa", email: "ana.demo@chat-demo.local", role: "viewer" },
]

function offsetDate(minutesAgo) {
    return new Date(Date.now() - minutesAgo * 60 * 1000)
}

async function ensureFakeUser(profilesCol, officeId, fake) {
    const existing = await profilesCol.findOne({ email: fake.email })
    if (existing) {
        // Make sure they belong to the target office (in case the script
        // was run before for a different office).
        if (String(existing.officeId || "") !== String(officeId)) {
            await profilesCol.updateOne(
                { _id: existing._id },
                { $set: { officeId: String(officeId), role: fake.role, updatedAt: new Date() } },
            )
        }
        return existing._id
    }
    const now = new Date()
    const doc = {
        name: fake.name,
        email: fake.email,
        role: fake.role,
        officeId: String(officeId),
        permissions: ["chat:read", "chat:send"],
        createdAt: now,
        updatedAt: now,
        isDemo: true,
    }
    const result = await profilesCol.insertOne(doc)
    return result.insertedId
}

async function ensureCrmChatEnabled(officesCol, officeId) {
    const office = await officesCol.findOne({ _id: new ObjectId(officeId) })
    if (!office) return
    const features = office.features || {}
    if (features.crm && features.crmChat) return
    await officesCol.updateOne(
        { _id: new ObjectId(officeId) },
        {
            $set: {
                "features.crm": true,
                "features.crmChat": true,
                updatedAt: new Date(),
            },
        },
    )
}

async function ensureDmConversation(convCol, officeId, a, b) {
    const pairKey = [String(a), String(b)].sort().join("|")
    const existing = await convCol.findOne({ officeId: String(officeId), type: "dm", pairKey })
    if (existing) return existing
    const doc = {
        officeId: String(officeId),
        type: "dm",
        memberIds: [String(a), String(b)].sort(),
        pairKey,
        createdAt: new Date(),
        lastMessageAt: null,
    }
    const result = await convCol.insertOne(doc)
    return { ...doc, _id: result.insertedId }
}

async function ensureGroupConversation(convCol, officeId, name, memberIds, createdBy) {
    const existing = await convCol.findOne({ officeId: String(officeId), type: "group", name })
    if (existing) return existing
    const doc = {
        officeId: String(officeId),
        type: "group",
        name,
        memberIds: Array.from(new Set(memberIds.map(String))),
        pairKey: null,
        createdBy: String(createdBy),
        createdAt: new Date(),
        lastMessageAt: null,
    }
    const result = await convCol.insertOne(doc)
    return { ...doc, _id: result.insertedId }
}

async function seedMessages(messagesCol, convCol, conversationId, officeId, messages) {
    await messagesCol.deleteMany({ conversationId: String(conversationId) })
    const docs = messages.map((m, idx) => ({
        conversationId: String(conversationId),
        officeId: String(officeId),
        authorId: String(m.authorId),
        authorName: m.authorName,
        body: m.body,
        createdAt: offsetDate(messages.length * 6 - idx * 6),
        editedAt: null,
    }))
    if (docs.length === 0) return
    await messagesCol.insertMany(docs)
    const last = docs[docs.length - 1]
    await convCol.updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { lastMessageAt: last.createdAt } },
    )
}

async function main() {
    const uri = process.env.MONGODB_URI
    const dbName = process.env.MONGODB_DB_NAME
    if (!uri || !dbName) {
        console.error("MONGODB_URI and MONGODB_DB_NAME are required")
        process.exit(1)
    }
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)
    const profilesCol = db.collection("user_profile")
    const officesCol = db.collection("offices")
    const convCol = db.collection("chat_conversations")
    const messagesCol = db.collection("chat_messages")

    const me = await profilesCol.findOne({ email: TARGET_EMAIL })
    if (!me) {
        console.error(`No user_profile found for email ${TARGET_EMAIL}`)
        process.exit(1)
    }
    const officeId = String(me.officeId || "")
    if (!officeId) {
        console.error(`User ${TARGET_EMAIL} has no officeId`)
        process.exit(1)
    }

    console.log(`✓ Found user ${me.name || me.email} (${me._id}) in office ${officeId}`)

    await ensureCrmChatEnabled(officesCol, officeId)
    console.log(`✓ Office ${officeId} has crm + crmChat enabled`)

    const fakeIds = []
    for (const fake of FAKE_COWORKERS) {
        const id = await ensureFakeUser(profilesCol, officeId, fake)
        fakeIds.push({ id: String(id), ...fake })
        console.log(`  · ${fake.name} (${fake.role}) → ${id}`)
    }

    // DM with Maria (manager).
    const maria = fakeIds[0]
    const dmMaria = await ensureDmConversation(convCol, officeId, me._id, maria.id)
    await seedMessages(messagesCol, convCol, dmMaria._id, officeId, [
        { authorId: maria.id, authorName: maria.name, body: "Oi Gabriel! Conferiu o relatório do cliente WALTER hoje?" },
        { authorId: me._id, authorName: me.name || me.email, body: "Olhei rápido, mas ainda tem 3 transações em suspense." },
        { authorId: maria.id, authorName: maria.name, body: "Beleza. Eu fecho o período assim que você categorizar elas." },
        { authorId: me._id, authorName: me.name || me.email, body: "Combinado, te chamo aqui quando terminar." },
    ])
    console.log(`✓ DM with ${maria.name} seeded`)

    // DM with João (staff) — short, recent.
    const joao = fakeIds[1]
    const dmJoao = await ensureDmConversation(convCol, officeId, me._id, joao.id)
    await seedMessages(messagesCol, convCol, dmJoao._id, officeId, [
        { authorId: joao.id, authorName: joao.name, body: "Você tem o extrato do banco de novembro?" },
        { authorId: me._id, authorName: me.name || me.email, body: "Tenho sim, te mando agora." },
    ])
    console.log(`✓ DM with ${joao.name} seeded`)

    // Group with all three demo users + me.
    const group = await ensureGroupConversation(
        convCol,
        officeId,
        "Mensal · Fechamento de Período",
        [me._id, ...fakeIds.map((u) => u.id)],
        me._id,
    )
    await seedMessages(messagesCol, convCol, group._id, officeId, [
        { authorId: me._id, authorName: me.name || me.email, body: "Pessoal, fechamento começa segunda. Quem tá com o que?" },
        { authorId: fakeIds[0].id, authorName: fakeIds[0].name, body: "Eu pego os 5 clientes do norte. Reconciliação até quarta." },
        { authorId: fakeIds[1].id, authorName: fakeIds[1].name, body: "Eu cuido das categorizações pendentes." },
        { authorId: fakeIds[2].id, authorName: fakeIds[2].name, body: "Posso revisar os P&Ls depois que vocês fecharem." },
        { authorId: me._id, authorName: me.name || me.email, body: "Top. Vou criar um Activity Log diário pra acompanharmos o progresso." },
        { authorId: fakeIds[0].id, authorName: fakeIds[0].name, body: "Boa! Se alguém travar, joga aqui no grupo." },
    ])
    console.log(`✓ Group "${group.name}" seeded with ${group.memberIds.length} members`)

    console.log("\nDone. Reload the app to see the conversations.")
    await client.close()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
