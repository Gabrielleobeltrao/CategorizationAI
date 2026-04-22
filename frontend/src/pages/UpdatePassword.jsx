import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { completeMyPasswordReset } from "../services/auth.service"
import { useNotification } from "../contexts/notification.context"

function UpdatePassword() {
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const navigate = useNavigate()
    const { success, error } = useNotification()

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!newPassword) {
            error("New password is required")
            return
        }

        if (newPassword.length < 8) {
            error("Password must have at least 8 characters")
            return
        }

        if (newPassword !== confirmPassword) {
            error("Passwords do not match")
            return
        }

        try {
            setIsSubmitting(true)
            await completeMyPasswordReset(newPassword)
            success("Password updated successfully")
            navigate("/home")
        } catch (err) {
            error(err.message || "Failed to update password")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className="w-full h-dvh flex items-center justify-center px-4">
            <form className="flex w-full max-w-md flex-col gap-3" onSubmit={handleSubmit}>
                <h1 className="text-2xl font-semibold">Update your password</h1>
                <p className="text-sm text-gray-600">
                    Set a new password to continue using your account.
                </p>
                <input
                    className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                    className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                    className="bg-gray-100 rounded-full p-2 disabled:opacity-60"
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : "Save new password"}
                </button>
            </form>
        </section>
    )
}

export default UpdatePassword
