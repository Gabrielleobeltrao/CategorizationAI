import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import { registerWithOffice } from "../services/register.service"
import { getOpenTestConfig } from "../services/openTest.service"
import { useNotification } from "../contexts/notification.context"

function Register() {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [officeName, setOfficeName] = useState("")
    const [officeAddress, setOfficeAddress] = useState("")
    const [officePhone, setOfficePhone] = useState("")
    const [officeEmail, setOfficeEmail] = useState("")
    const [openTestAccessCode, setOpenTestAccessCode] = useState("")
    const [openTestConfig, setOpenTestConfig] = useState(null)
    const [isOpenTestModalOpen, setIsOpenTestModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
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

    const isOpenTestEnabled = Boolean(openTestConfig?.enabled)

    const submitRegistration = async () => {
        try {
            setIsSubmitting(true)
            await registerWithOffice({
                name,
                email,
                password,
                officeName,
                officeAddress,
                officePhone,
                officeEmail,
                openTestAccessCode,
                requiresOpenTestAccessCode: isOpenTestEnabled,
            })
            success("Account created successfully")
            navigate("/home")
        } catch (err) {
            error(err.message || "Failed to create account")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (step === 1) {
            if (!officeName.trim()) {
                error("Please fill office name")
                return
            }

            setStep(2)
            return
        }

        if (!name.trim() || !email.trim() || !password) {
            error("Please fill name, email and password")
            return
        }

        if (password !== confirmPassword) {
            error("Passwords do not match")
            return
        }

        if (isOpenTestEnabled) {
            setIsOpenTestModalOpen(true)
            return
        }

        await submitRegistration()
    }

    const handleConfirmOpenTestAccess = async () => {
        if (!openTestAccessCode.trim()) {
            error("Please fill access code")
            return
        }

        await submitRegistration()
    }

    return (
        <section className="flex h-dvh w-full items-center justify-center bg-white px-4">
            <div className="w-full max-w-3xl">
                <div className="mb-6 flex flex-col items-center gap-1 text-center">
                    <h1 className="text-lg font-bold text-gray-900">
                        CategorizationAI
                    </h1>
                    <p className="text-sm text-gray-500">
                        Two quick steps to create your workspace
                    </p>
                </div>

                <form
                    className="flex min-h-[640px] flex-col justify-between rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:min-h-[560px]"
                    onSubmit={handleSubmit}
                >
                    <div className="flex flex-1 flex-col gap-5">
                        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1">
                            <div className={`rounded-xl px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition ${
                                step === 1 ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                            }`}>
                                1. Office
                            </div>
                            <div className={`rounded-xl px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide transition ${
                                step === 2 ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                            }`}>
                                2. User
                            </div>
                        </div>

                        {step === 1 && (
                            <>
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Create your office
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        Start with the business details. Only the office name is required.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="flex flex-col gap-1.5 md:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Office name
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="text"
                                            placeholder="Office name"
                                            value={officeName}
                                            onChange={(e) => setOfficeName(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5 md:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Address
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="text"
                                            placeholder="Optional address"
                                            value={officeAddress}
                                            onChange={(e) => setOfficeAddress(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Business phone
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="text"
                                            placeholder="Optional business phone"
                                            value={officePhone}
                                            onChange={(e) => setOfficePhone(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Business email
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="email"
                                            placeholder="Optional business email"
                                            value={officeEmail}
                                            onChange={(e) => setOfficeEmail(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-gray-500">
                                        {isOpenTestEnabled ? "Private beta note" : "Optional details"}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                        {isOpenTestEnabled
                                            ? "If your office is in private beta, you will be asked for the access code at the final step. AI-generated results are still under validation and should always be reviewed."
                                            : "You can keep only the office name now and complete the rest later."}
                                    </p>
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Create your user
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        This account will be created as the owner of the office.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="flex flex-col gap-1.5 md:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Name
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="text"
                                            placeholder="Your name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5 md:col-span-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Email
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="email"
                                            placeholder="you@office.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Password
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="password"
                                            placeholder="Create a password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Confirm password
                                        </span>
                                        <input
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                                            type="password"
                                            placeholder="Repeat your password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-gray-500">
                                        Ownership
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                        Your account will be created as <span className="font-semibold">owner</span> of this office
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                        {step === 2 && (
                            <button
                                type="button"
                                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                onClick={() => setStep(1)}
                                disabled={isSubmitting}
                            >
                                Back
                            </button>
                        )}
                        <button
                            className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {step === 1 ? "Continue to user" : isSubmitting ? "Creating..." : "Create Account"}
                        </button>
                    </div>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="font-semibold text-gray-900 transition hover:text-gray-600"
                    >
                        Login
                    </Link>
                </p>
            </div>

            <PopupModal
                isOpen={isOpenTestModalOpen}
                onClose={() => {
                    if (isSubmitting) return
                    setIsOpenTestModalOpen(false)
                }}
                title="Private beta access"
                maxWidthClass="max-w-lg"
            >
                <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">Private beta</p>
                        <p className="mt-1">
                            {openTestConfig?.notices?.auth || "This workspace is currently in private beta and access is limited to invited offices."}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                            Enter your private beta access code to finish creating the account.
                        </p>
                        <p className="text-sm text-gray-500">
                            This is the final validation step for invited offices. After the account is created, review AI-generated categories and financial outputs carefully before using them in real work.
                        </p>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Access code
                        </span>
                        <input
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:bg-white"
                            type="text"
                            placeholder="Private beta access code"
                            value={openTestAccessCode}
                            onChange={(e) => setOpenTestAccessCode(e.target.value)}
                            autoFocus
                        />
                    </label>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                            onClick={() => setIsOpenTestModalOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                            onClick={handleConfirmOpenTestAccess}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating..." : "Create Account"}
                        </button>
                    </div>
                </div>
            </PopupModal>
        </section>
    )
}

export default Register
