import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { signIn } from "../services/auth.service"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"

function Login() {

    const [ email, setEmail] = useState("")
    const [ password, setPassword] = useState("")
    const navigate = useNavigate()
    const { success, error } = useNotification()
    const { beginAuthenticatedSession, clearAuth, refreshAuth } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
            try {
                await signIn(email, password)
                success("Login successful")
                beginAuthenticatedSession()
                navigate("/home")
                const snapshot = await refreshAuth({ force: true })
                const profile = snapshot?.profile || null
                if (profile?.mustChangePassword) {
                    navigate("/update-password", { replace: true })
                    return
                }
                if (!profile) {
                    navigate("/complete-registration", { replace: true })
                    return
                }
            } catch (err) {
                clearAuth()
                error(err.message || "Failed to login")
            }
    }

    return (
        <section className="flex h-dvh w-full items-center justify-center bg-white px-4">
            <div className="w-full max-w-md">
                <div className="mb-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-bold text-gray-900">
                            CategorizationAI
                        </h1>
                        <p className="text-sm text-gray-500">
                            Login
                        </p>
                    </div>
                </div>

                <form className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5" onSubmit={handleSubmit}>
                    <input
                        className="rounded-full border-2 border-gray-100 px-3 py-2 placeholder:text-black outline-none focus:border-gray-300"
                        type="text"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        className="rounded-full border-2 border-gray-100 px-3 py-2 placeholder:text-black outline-none focus:border-gray-300"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                        className="rounded-full bg-gray-900 p-2 text-white transition hover:bg-black"
                        type="submit"
                    >
                        Login
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                    Don&apos;t have an account?{" "}
                    <Link
                        to="/register"
                        className="font-semibold text-gray-900 transition hover:text-gray-600"
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </section>
    )
}
export default Login
