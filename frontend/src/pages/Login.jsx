import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signIn } from "../services/auth.service"

function Login() {

    const [ email, setEmail] = useState("")
    const [ password, setPassword] = useState("")

    const navigate = useNavigate()

    const handleSubmit = (e) => {
        e.preventDefault()
            try {
                signIn(email, password)
                navigate("/home")
            } catch (err) {
                console.log(err)
            }
    }

    return (
        <section className="w-full h-dvh flex items-center justify-center">
            <div className="flex flex-col gap-4 w-1/3">
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="text"
                placeholder="Email"
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="password"
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
            />
            <button 
                className="bg-gray-100 rounded-full p-2"
                onClick={handleSubmit}
            >
                Login
            </button>
            </div>
        </section>
    )
}
export default Login