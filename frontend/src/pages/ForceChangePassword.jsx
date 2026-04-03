import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { changeTemporaryPassword, signOut } from "../services/auth.service"
import { useNotification } from "../contexts/notification.context"

function ForceChangePassword() {
    const navigate = useNavigate()
    const { success, error } = useNotification()

    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (newPassword !== confirmPassword) {
            error("New password and confirmation must match")
            return
        }

        try {
            setIsSubmitting(true)
            await changeTemporaryPassword(newPassword)
            success("Password updated successfully")
            navigate("/home", { replace: true })
        } catch (err) {
            error(err.message || "Failed to update password")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className="w-full min-h-dvh flex items-center justify-center bg-white px-4">
            <form className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-3" onSubmit={handleSubmit}>
                <h1 className="text-xl font-semibold">Update your password</h1>
                <p className="text-sm text-gray-600">
                    You logged in with a temporary password. Set a new password to continue.
                </p>

                <input
                    className="border border-gray-300 rounded-md px-3 py-2"
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                    className="border border-gray-300 rounded-md px-3 py-2"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                    className="rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-black disabled:opacity-60"
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : "Save new password"}
                </button>

                <button
                    type="button"
                    className="rounded-md border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={async () => {
                        await signOut()
                        navigate("/login", { replace: true })
                    }}
                >
                    Sign out
                </button>
            </form>
        </section>
    )
}

export default ForceChangePassword
