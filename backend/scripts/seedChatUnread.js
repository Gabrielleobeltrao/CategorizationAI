// Inserts a few brand-new messages from the demo coworkers into existing
// conversations so the current user sees the unread badge light up. The
// chat widget marks a conversation as unread when `lastMessageAt` is
// newer than `localStorage[chat:last-seen-by-conversation][conversationId]`,
// so freshly-stamped messages from the other side are guaranteed unread.
import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const TARGET_EMAIL = (process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] || "gabrielleoaus@gmail.com")
    .toLowerCase()

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

    const me = await db.collection("user_profile").findOne({ email: TARGET_EMAIL })
    if (!me) {
        console.error(`No user_profile for ${TARGET_EMAIL}`)
        process.exit(1)
    }
    const officeId = String(me.officeId)

    // Pick the seeded demo users so the unread messages have plausible authors.
    const demoUsers = await db.collection("user_profile").find({
        email: { $in: ["maria.demo@chat-demo.local", "joao.demo@chat-demo.local", "ana.demo@chat-demo.local"] },
    }).toArray()
    if (demoUsers.length === 0) {
        console.error("No demo users found — run seedChatDemo.js first.")
        process.exit(1)
    }
    const maria = demoUsers.find((u) => u.email.startsWith("maria"))
    const joao = demoUsers.find((u) => u.email.startsWith("joao"))
    const ana = demoUsers.find((u) => u.email.startsWith("ana"))

    // Resolve conversations.
    const conversations = await db.collection("chat_conversations").find({
        officeId,
        type: { $in: ["dm", "group"] },
    }).toArray()
    const dmWithMaria = conversations.find((c) => c.type === "dm" && c.memberIds.includes(String(maria._id)))
    const dmWithJoao = conversations.find((c) => c.type === "dm" && c.memberIds.includes(String(joao._id)))
    const group = conversations.find((c) => c.type === "group")

    const now = new Date()
    const minutesAgo = (n) => new Date(now.getTime() - n * 60 * 1000)

    const messages = []
    if (dmWithMaria) {
        messages.push(
            { conversationId: String(dmWithMaria._id), officeId, authorId: String(maria._id), authorName: maria.name, body: "Oi Gabriel, conferiu meu email?", createdAt: minutesAgo(8), editedAt: null, attachment: null },
            { conversationId: String(dmWithMaria._id), officeId, authorId: String(maria._id), authorName: maria.name, body: "Preciso fechar o período hoje 🙏", createdAt: minutesAgo(7), editedAt: null, attachment: null },
        )
    }
    if (dmWithJoao) {
        messages.push(
            { conversationId: String(dmWithJoao._id), officeId, authorId: String(joao._id), authorName: joao.name, body: "Achei uma divergência no extrato de novembro", createdAt: minutesAgo(3), editedAt: null, attachment: null },
        )
    }
    if (group && ana) {
        messages.push(
            { conversationId: String(group._id), officeId, authorId: String(ana._id), authorName: ana.name, body: "Pessoal, alguém pode revisar o P&L do cliente Walter?", createdAt: minutesAgo(2), editedAt: null, attachment: null },
        )
    }

    if (messages.length === 0) {
        console.warn("No matching conversations to seed unread into. Run seedChatDemo.js first.")
        await client.close()
        return
    }

    await db.collection("chat_messages").insertMany(messages)

    // Bump lastMessageAt on each touched conversation so the list resorts and
    // the badge logic sees fresh activity.
    const grouped = new Map()
    for (const msg of messages) {
        const prev = grouped.get(msg.conversationId)
        if (!prev || msg.createdAt > prev) grouped.set(msg.conversationId, msg.createdAt)
    }
    await Promise.all([...grouped.entries()].map(([convId, at]) =>
        db.collection("chat_conversations").updateOne(
            { _id: new ObjectId(convId) },
            { $set: { lastMessageAt: at } },
        ),
    ))

    console.log(`✓ Seeded ${messages.length} unread messages across ${grouped.size} conversations.`)
    console.log("Tip: also clear localStorage `chat:last-seen-by-conversation` if you've already opened these chats before.")
    await client.close()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
