import { api } from "../lib/api"

// Login

export function signIn(email, password) {
  return api("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

// Register

export function signUp(name, email, password) {
  return api("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })
}