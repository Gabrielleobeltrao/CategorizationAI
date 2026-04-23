import { betterAuth } from "better-auth"
import { mongodbAdapter } from "@better-auth/mongo-adapter"
import { ALLOWED_ORIGINS } from "../config/security.js"

export function createAuth(db) {
  const baseURL = String(process.env.BETTER_AUTH_URL || "").trim()
  const isHttpsDeployment = baseURL.startsWith("https://")

  return betterAuth({
    database: mongodbAdapter(db),
    emailAndPassword: { enabled: true },
    baseURL,
    trustedOrigins: ALLOWED_ORIGINS,
    advanced: isHttpsDeployment
      ? {
          useSecureCookies: true,
          defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
            partitioned: true,
          },
        }
      : undefined,
  })
}
