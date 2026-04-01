import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { getMyProfile, signIn } from "../services/auth.service"
import { useNotification } from "../contexts/notification.context"

function Login() {

    const [ email, setEmail] = useState("")
    const [ password, setPassword] = useState("")

    const navigate = useNavigate()
    const { success, error } = useNotification()

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
        <section className="w-full h-dvh flex items-center justify-center">
            <form className="flex flex-col gap-4 w-1/3" onSubmit={handleSubmit}>
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="text"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button 
                className="bg-gray-100 rounded-full p-2"
                type="submit"
            >
                Login
            </button>
            </form>
        </section>
    )
}
export default Login
