import { GridFSBucket, ObjectId } from "mongodb"
import { getDB } from "../db.js"

const BUCKET_NAME = "chat_files"
const FILES_COLLECTION = `${BUCKET_NAME}.files`
// Chat file blobs are "transfer-only": auto-pruned a week after upload to
// keep storage flat. Cloud bucket (R2/S3) migration is a separate project.
const RETENTION_DAYS = 7
export const CHAT_FILE_RETENTION_DAYS = RETENTION_DAYS

let cachedBucket = null

function getBucket() {
  if (cachedBucket) return cachedBucket
  cachedBucket = new GridFSBucket(getDB(), { bucketName: BUCKET_NAME })
  return cachedBucket
}

export async function ensureChatFilesIndexes() {
  const db = getDB()
  // GridFS already creates its own internal indexes; we just add a metadata
  // lookup index so per-message cleanup is cheap, plus an index on uploadDate
  // so the periodic sweep can scan recent uploads quickly.
  await Promise.all([
    db.collection(FILES_COLLECTION).createIndex({ "metadata.messageId": 1 }),
    db.collection(FILES_COLLECTION).createIndex({ uploadDate: 1 }),
  ])
}

// Sweep — deletes chat files (and their chunks) older than RETENTION_DAYS.
// Mongo TTL on chat_messages auto-expires messages but doesn't cascade to
// GridFS, so we keep parity ourselves here. Called on startup and daily.
export async function pruneExpiredChatFiles() {
  const now = new Date()
  const fallbackCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const db = getDB()
  // Prefer the explicit expiresAt on new files; fall back to uploadDate for
  // any legacy file that was uploaded before the field existed.
  const expired = await db
    .collection(FILES_COLLECTION)
    .find(
      {
        $or: [
          { "metadata.expiresAt": { $lt: now } },
          { "metadata.expiresAt": { $exists: false }, uploadDate: { $lt: fallbackCutoff } },
        ],
      },
      { projection: { _id: 1 } },
    )
    .toArray()
  if (expired.length === 0) return 0
  const bucket = getBucket()
  let removed = 0
  for (const file of expired) {
    try {
      await bucket.delete(file._id)
      removed += 1
    } catch (err) {
      console.warn(`[chatFiles] prune failed for ${file._id}: ${err?.message || err}`)
    }
  }
  return removed
}

// Belt-and-suspenders cleanup: catches files whose owning message was
// removed early (manual delete bypasses GridFS deletion bugs). Slow on big
// data — only run alongside the daily sweep.
export async function pruneOrphanedChatFiles() {
  const db = getDB()
  const referencedRaw = await db.collection("chat_messages").aggregate([
    { $match: { "attachment.type": "file" } },
    { $group: { _id: "$attachment.fileId" } },
  ]).toArray()
  const referenced = new Set(referencedRaw.map((row) => String(row._id)))
  const allFiles = await db.collection(FILES_COLLECTION).find({}, { projection: { _id: 1, uploadDate: 1 } }).toArray()
  const bucket = getBucket()
  let removed = 0
  // Grace period — don't remove freshly-uploaded files that haven't been
  // attached to a message yet (upload happens before the message is created).
  const graceCutoff = new Date(Date.now() - 10 * 60 * 1000)
  for (const file of allFiles) {
    if (referenced.has(String(file._id))) continue
    if (file.uploadDate && file.uploadDate > graceCutoff) continue
    try {
      await bucket.delete(file._id)
      removed += 1
    } catch (err) {
      console.warn(`[chatFiles] orphan prune failed for ${file._id}: ${err?.message || err}`)
    }
  }
  return removed
}

export async function uploadChatFileBuffer({ buffer, filename, mimeType, metadata = {} }) {
  if (!buffer) throw new Error("buffer is required")
  const bucket = getBucket()
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(filename || "file", {
      contentType: mimeType || "application/octet-stream",
      metadata: { ...metadata, expiresAt },
    })
    stream.on("error", reject)
    stream.on("finish", () => {
      resolve({
        id: String(stream.id),
        filename: stream.filename,
        length: stream.length,
        contentType: mimeType || "application/octet-stream",
        expiresAt,
      })
    })
    stream.end(buffer)
  })
}

export async function getChatFileMetadata(fileId) {
  if (!ObjectId.isValid(fileId)) return null
  const db = getDB()
  return db.collection(FILES_COLLECTION).findOne({ _id: new ObjectId(fileId) })
}

export function openChatFileDownloadStream(fileId) {
  const bucket = getBucket()
  return bucket.openDownloadStream(new ObjectId(fileId))
}

export async function deleteChatFile(fileId) {
  if (!ObjectId.isValid(fileId)) return
  const bucket = getBucket()
  try {
    await bucket.delete(new ObjectId(fileId))
  } catch (err) {
    // ENOENT — file already gone; ignore.
    if (err?.message?.includes("FileNotFound")) return
    throw err
  }
}

// Best-effort batch delete used when a message with file attachments is
// removed. Never throws so the caller can finish the user-facing op.
export async function deleteChatFilesSilently(fileIds = []) {
  await Promise.allSettled(fileIds.map((id) => deleteChatFile(id)))
}
