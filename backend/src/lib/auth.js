import { betterAuth } from "better-auth"
import { mongodbAdapter } from "@better-auth/mongo-adapter"
import { ALLOWED_ORIGINS } from "../config/security.js"

export function createAuth(db) {
  return betterAuth({
    database: mongodbAdapter(db),
    emailAndPassword: { enabled: true },
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: ALLOWED_ORIGINS,
  })
}
