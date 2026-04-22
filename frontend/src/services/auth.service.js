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

export function signOut() {
  return api("/api/auth/sign-out", {
    method: "POST",
  })
}

export function getMyProfile() {
  return api("/api/user-profiles/me")
}

export function updateMyProfile(patch) {
  return api("/api/user-profiles/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function completeMyPasswordReset(newPassword) {
  return api("/api/user-profiles/me/complete-password-reset", {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  })
}
