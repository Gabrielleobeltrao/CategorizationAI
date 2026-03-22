import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { registerWithOffice } from "../services/register.service"

function Register() {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [officeName, setOfficeName] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        if (step === 1) {
            if (!name.trim() || !email.trim() || !password) {
                setError("Please fill name, email and password")
                return
            }

            if (password !== confirmPassword) {
                setError("Passwords do not match")
                return
            }

            setStep(2)
            return
        }

        if (!officeName.trim()) {
            setError("Please fill office name")
            return
        }

        try {
            setIsSubmitting(true)
            await registerWithOffice({
                name,
                email,
                password,
                officeName,
            })
            navigate("/home")
        } catch (err) {
            setError(err.message || "Failed to create account")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className="w-full h-dvh flex items-center justify-center">
            <form className="flex flex-col gap-4 w-1/3 min-w-[320px]" onSubmit={handleSubmit}>
                <h1 className="text-2xl font-bold">
                    {step === 1 ? "Create your user" : "Create your office"}
                </h1>

                {step === 1 && (
                    <>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="email"
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
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </>
                )}

                {step === 2 && (
                    <>
                        <input
                            className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                            type="text"
                            placeholder="Office Name"
                            value={officeName}
                            onChange={(e) => setOfficeName(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                            Your account will be created as <span className="font-semibold">owner</span> of this office
                        </p>
                    </>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex items-center gap-2">
                    {step === 2 && (
                        <button
                            type="button"
                            className="bg-gray-200 rounded-full px-4 py-2"
                            onClick={() => setStep(1)}
                            disabled={isSubmitting}
                        >
                            Back
                        </button>
                    )}
                    <button
                        className="bg-gray-100 rounded-full px-4 py-2"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {step === 1 ? "Continue" : isSubmitting ? "Creating..." : "Create Account"}
                    </button>
                </div>
            </form>
        </section>
    )
}

export default Register
