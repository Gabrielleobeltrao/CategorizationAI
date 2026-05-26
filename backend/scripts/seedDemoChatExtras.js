// Pads the demo chat with longer conversations + fake audio/file
// attachments so the chat UI looks alive during a demo.
//
// Audio attachments use a 44-byte silent WAV data URL so the audio
// player renders without errors. File attachments carry believable
// metadata (name, size, mimeType) — the actual file body is NOT
// uploaded, so clicking download will fail, but the bubble renders
// fully (the user said "só visual").
//
// Idempotent-ish: targets only conversations that already have the
// "seed-extras" marker missing on at least one of their messages.

import "dotenv/config"
import { MongoClient, ObjectId } from "mongodb"

const DEMO_EMAIL = "demo@categorizationai.com"

// 44-byte WAV header with zero sample data — minimum valid file.
const SILENT_WAV_DATA_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

const FAKE_FILES = [
  { name: "April-bank-statement.pdf", size: 432_109, mimeType: "application/pdf" },
  { name: "Q1-financials.xlsx", size: 215_872, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { name: "logo-revised.png", size: 89_421, mimeType: "image/png" },
  { name: "vendor-invoice-INV-2412.pdf", size: 178_650, mimeType: "application/pdf" },
  { name: "checking-export-may.csv", size: 24_812, mimeType: "text/csv" },
  { name: "kickoff-notes.docx", size: 51_337, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { name: "client-photos.zip", size: 1_842_910, mimeType: "application/zip" },
  { name: "voice-memo-summary.txt", size: 4_120, mimeType: "text/plain" },
]

// Spread `n` timestamps backwards from now over `daysBack` days.
function spreadTimestamps(n, daysBack) {
  const now = Date.now()
  const span = daysBack * 86400000
  const out = []
  for (let i = 0; i < n; i += 1) {
    out.push(new Date(now - ((n - i) * span) / n - Math.random() * 60000))
  }
  return out
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Pre-canned message templates by conversation role.
const DM_MARIA = [
  { body: "Bom dia! Conseguiu olhar o reconcile da Aurora?" },
  { body: "Sim, terminei agora. Sobrou 3 transações que precisam revisão." },
  { body: "Ótimo. Manda as 3 que eu já categorizo." },
  { kind: "audio", body: "", duration: 8 },
  { kind: "file", file: FAKE_FILES[0], body: "Aqui o extrato bruto pra você confirmar" },
  { body: "Recebi. Vou revisar e devolvo ainda hoje." },
  { body: "Outra coisa — o cliente Blue Ridge pediu o P&L de Q1." },
  { body: "Tá pronto, só falta confirmar a depreciação do veículo." },
  { kind: "file", file: FAKE_FILES[1], body: "P&L Q1 — versão preliminar" },
  { body: "Show. Vou marcar uma call com eles pra apresentar." },
  { body: "Combinado. Quando você tiver a data me avisa." },
  { kind: "audio", body: "", duration: 14 },
  { body: "Marquei pra sexta 10h." },
  { body: "Perfeito 👍" },
]

const DM_JOAO = [
  { body: "Oi João, viu o erro de categorização do Stripe ontem?" },
  { body: "Vi sim. Foi um lote inteiro que entrou como Product Sales em vez de Service Revenue." },
  { body: "Você já corrigiu manualmente ou ainda tá rodando?" },
  { body: "Ainda rodando, vai terminar em uns 10 min." },
  { kind: "audio", body: "", duration: 22 },
  { body: "Ok, avisa quando terminar pra eu reprocessar a IA." },
  { body: "Terminou. Reprocessa quando quiser." },
  { kind: "file", file: FAKE_FILES[2], body: "Atualizei o logo do Sunset Cafe pra próxima apresentação" },
  { body: "Ficou bom. Vou subir no Drive compartilhado." },
  { body: "Outra: alguém pediu o backup do mês passado?" },
  { body: "Foi a Ana, ela tá compilando o arquivo morto." },
  { body: "Ok, vou mandar pra ela." },
  { kind: "file", file: FAKE_FILES[4], body: "Backup checking — Maio" },
  { body: "Valeu!" },
]

const GROUP_CHAT = [
  { author: "demo", body: "Pessoal, reunião de fechamento mensal sexta às 14h. Confirmem presença." },
  { author: "maria", body: "Confirmo!" },
  { author: "joao", body: "Confirmo." },
  { author: "ana", body: "Estarei lá." },
  { author: "demo", body: "Antes da reunião quero todos os clients com Q1 categorizado 100%." },
  { author: "maria", body: "Blue Ridge tá fechado." },
  { author: "joao", body: "Aurora também." },
  { author: "ana", body: "Sunset falta 12 transações." },
  { author: "ana", kind: "audio", body: "", duration: 18 },
  { author: "demo", body: "Manda o que tá pendente que ajudo a categorizar" },
  { author: "ana", kind: "file", file: FAKE_FILES[3], body: "Itens pendentes Sunset" },
  { author: "demo", body: "Recebi, vou olhar à tarde." },
  { author: "joao", body: "Aproveitando — preciso de input no novo CoA do cliente novo." },
  { author: "maria", body: "Manda o template que eu reviso amanhã." },
  { author: "joao", kind: "file", file: FAKE_FILES[5], body: "Notes da call com o cliente novo" },
  { author: "maria", body: "Lido. Tem uns ajustes pequenos, te mando inline." },
  { author: "demo", body: "Lembrando: payroll dia 10. Garantir que tá tudo conciliado até dia 9." },
  { author: "ana", kind: "audio", body: "", duration: 11 },
  { author: "demo", body: "Bom trabalho equipe, qualquer coisa me chamem." },
]

function attachmentForTemplate(t) {
  if (t.kind === "audio") {
    return {
      type: "audio",
      dataUrl: SILENT_WAV_DATA_URL,
      duration: Number(t.duration || 5),
      mimeType: "audio/wav",
    }
  }
  if (t.kind === "file" && t.file) {
    return {
      type: "file",
      // The UI will try to fetch /api/.../chat-files/:fileId — that 404s
      // because we never uploaded a real file. The bubble still renders
      // the name/size/icon from these fields, which is what the demo needs.
      fileId: `demo-${t.file.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      name: t.file.name,
      size: t.file.size,
      mimeType: t.file.mimeType,
      expiresAt: null,
    }
  }
  return null
}

async function seedConversation(db, conv, scriptList, participants) {
  const officeId = String(conv.officeId)
  const conversationId = String(conv._id)
  const existingExtras = await db.collection("chat_messages").countDocuments({
    conversationId,
    "metadata.seedExtras": true,
  })
  if (existingExtras > 0) {
    console.log(`  ~ ${conv.name || conv.type}: already padded (${existingExtras} extras)`)
    return
  }

  const stamps = spreadTimestamps(scriptList.length, 8)
  const docs = scriptList.map((t, idx) => {
    const speakerKey = t.author || (idx % 2 === 0 ? "demo" : Object.keys(participants).find((k) => k !== "demo"))
    const speaker = participants[speakerKey] || participants.demo
    return {
      conversationId,
      officeId,
      authorId: String(speaker._id),
      authorName: String(speaker.name || speaker.email || ""),
      body: String(t.body || ""),
      attachment: attachmentForTemplate(t),
      createdAt: stamps[idx],
      editedAt: null,
      metadata: { seedExtras: true },
    }
  })

  await db.collection("chat_messages").insertMany(docs)

  const lastAt = stamps[stamps.length - 1]
  await db.collection("chat_conversations").updateOne(
    { _id: conv._id },
    { $set: { lastMessageAt: lastAt, updatedAt: new Date() } }
  )

  console.log(`  + ${conv.name || conv.type}: appended ${docs.length} messages`)
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME)
  console.log(`Connected to ${process.env.MONGODB_DB_NAME}`)

  const demo = await db.collection("user_profile").findOne({ email: DEMO_EMAIL })
  if (!demo?._id) {
    console.error(`No user_profile for ${DEMO_EMAIL}`)
    process.exit(1)
  }
  const officeId = String(demo.officeId)

  const maria = await db.collection("user_profile").findOne({ officeId, email: /maria/i })
  const joao = await db.collection("user_profile").findOne({ officeId, email: /joao|joão/i })
  const ana = await db.collection("user_profile").findOne({ officeId, email: /ana/i })

  if (!maria || !joao || !ana) {
    console.error("Co-worker profiles missing. Run seedChatDemo.js first.")
    process.exit(1)
  }

  const dms = await db.collection("chat_conversations").find({ officeId, type: "dm" }).toArray()
  const groups = await db.collection("chat_conversations").find({ officeId, type: "group" }).toArray()

  const demoMaria = dms.find((c) =>
    c.memberIds.map(String).includes(String(demo._id)) &&
    c.memberIds.map(String).includes(String(maria._id))
  )
  const demoJoao = dms.find((c) =>
    c.memberIds.map(String).includes(String(demo._id)) &&
    c.memberIds.map(String).includes(String(joao._id))
  )

  if (demoMaria) {
    await seedConversation(db, demoMaria, DM_MARIA, {
      demo, maria,
    })
  }
  if (demoJoao) {
    await seedConversation(db, demoJoao, DM_JOAO, {
      demo, joao,
    })
  }
  for (const group of groups) {
    await seedConversation(db, group, GROUP_CHAT, {
      demo, maria, joao, ana,
    })
  }

  console.log("\nDone.")
  await client.close()
}

main().catch((err) => {
  console.error("FAILED:", err?.message || err)
  process.exit(1)
})
