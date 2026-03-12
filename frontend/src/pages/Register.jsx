import { useState } from "react"

function Register() {

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [officeName, setOfficeName] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        console.log({
            name,
            email,
            password,
            officeName,
        })
    }

    return (
        <section className="w-full h-dvh flex items-center justify-center">
            <div className="flex flex-col gap-4 w-1/3">
                <input
                    className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                    type="text"
                    placeholder="Name"
                    onChange={(e) => setName(e.target.value)}
                />
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
                <input
                    className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                    type="text"
                    placeholder="Office Name"
                    onChange={(e) => setOfficeName(e.target.value)}
                />
                <button
                    className="bg-gray-100 rounded-full p-2"
                    onClick={handleSubmit}
                >
                    Create Account
                </button>
            </div>
        </section>
    )
}

export default Register
