import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { getMyProfile, signIn } from "../services/auth.service"
import { getOpenTestConfig } from "../services/openTest.service"
import { useNotification } from "../contexts/notification.context"

function Login() {

    const [ email, setEmail] = useState("")
    const [ password, setPassword] = useState("")
    const [openTestConfig, setOpenTestConfig] = useState(null)

    const navigate = useNavigate()
    const { success, error } = useNotification()

    useEffect(() => {
        let active = true

        getOpenTestConfig()
            .then((config) => {
                if (!active) return
                setOpenTestConfig(config || null)
            })
            .catch(() => {
                if (!active) return
                setOpenTestConfig(null)
            })

        return () => {
            active = false
        }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
            try {
                await signIn(email, password)
                success("Login successful")
                const profile = await getMyProfile().catch(() => null)
                if (profile?.mustChangePassword) {
                    navigate("/update-password")
                    return
                }
                navigate("/home")
            } catch (err) {
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

                {openTestConfig?.enabled && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">Open test environment</p>
                        <p className="mt-1">
                            {openTestConfig?.notices?.auth || "This environment is currently limited to invited offices."}
                        </p>
                    </div>
                )}

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
