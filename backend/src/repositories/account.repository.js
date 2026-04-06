import { ObjectId } from "mongodb"
import { getDB } from "../db.js"

export async function createAccount(input) {
  const db = getDB()

  const doc = {
    name: input.name,
    type: input.type,
    clientId: input.clientId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection("account").insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateAccountById(id, patch) {
  const db = getDB()

  const allowed = {
    name: patch.name,
    type: patch.type,
    clientId: patch.clientId,
    updatedAt: new Date(),
  }

  const $set = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined)
  )

  return db.collection("account").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" }
  )
}

export async function listAccountsByClientId(clientId) {
  const db = getDB()
  return db.collection("account").find({ clientId }).sort({ createdAt: -1 }).toArray()
}

export async function getAccountById(id) {
  const db = getDB()
  return db.collection("account").findOne({ _id: new ObjectId(id) })
}

export async function deleteAccountById(id) {
  const db = getDB()
  return db.collection("account").deleteOne({ _id: new ObjectId(id) })
}

export async function deleteAccountsByClientId(clientId) {
  const db = getDB()
  return db.collection("account").deleteMany({ clientId })
}
