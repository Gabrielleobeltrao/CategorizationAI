import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import PopupModal from "../components/ui/PopupModal"
import { registerWithOffice } from "../services/register.service"
import { useOpenTest } from "../contexts/openTest.context"
import { useNotification } from "../contexts/notification.context"
import { useAuth } from "../contexts/auth.context"

const TERMS_SECTIONS = [
    {
        title: "Professional review required",
        body: "Every AI categorization, automatic grouping, mapping suggestion, import result, split suggestion, profit and loss output, and any other automated result in the system must be reviewed by a qualified professional before use."
    },
    {
        title: "User responsibility",
        body: "You are responsible for reviewing, validating, correcting, approving, and deciding whether any information generated or processed by the system is accurate and appropriate for your office, your clients, and your reporting obligations."
    },
    {
        title: "No automatic reliance",
        body: "Automated outputs are support tools only. They must not be treated as final accounting, tax, financial, legal, or compliance advice without human verification."
    },
    {
        title: "Data quality and final decisions",
        body: "The quality of results depends on the quality of uploaded files, transaction descriptions, categories, account structure, and user review. Final decisions and filings remain under the user's responsibility."
    },
]

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
    const [isOpenTestModalOpen, setIsOpenTestModalOpen] = useState(false)
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { success, error } = useNotification()
    const { config: openTestConfig } = useOpenTest()
    const { refreshAuth } = useAuth()

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
                openTestConfig,
            })
            const snapshot = await refreshAuth({ force: true })
            success("Account created successfully")
            if (snapshot?.profile?.mustChangePassword) {
                navigate("/update-password")
                return
            }
            if (!snapshot?.profile) {
                navigate("/complete-registration")
                return
            }
            navigate("/home")
        } catch (err) {
            const snapshot = await refreshAuth({ force: true }).catch(() => null)
            error(err.message || "Failed to create account")
            if (snapshot?.isAuthenticated && !snapshot?.profile) {
                navigate("/complete-registration")
            }
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

        if (!hasAcceptedTerms) {
            error("You must agree to the terms to create the account")
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
        <section className="flex min-h-dvh w-full items-start justify-center overflow-y-auto bg-white px-4 py-6 md:items-center md:py-10">
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
                    className="flex flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-7"
                    onSubmit={handleSubmit}
                >
                    <div className="flex flex-col gap-5">
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
                                <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                                    <input
                                        className="mt-1 h-4 w-4 rounded border-gray-300"
                                        type="checkbox"
                                        checked={hasAcceptedTerms}
                                        onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                                    />
                                    <span className="text-sm text-gray-600">
                                        I agree to the{" "}
                                        <button
                                            type="button"
                                            className="font-semibold text-gray-900 underline underline-offset-2"
                                            onClick={() => setIsTermsModalOpen(true)}
                                        >
                                            terms and review responsibilities
                                        </button>
                                        . I understand that all AI and automated actions must be reviewed by a qualified professional, and the responsibility for the information remains with the user.
                                    </span>
                                </label>
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
                            disabled={isSubmitting || (step === 2 && !hasAcceptedTerms)}
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

            <PopupModal
                isOpen={isTermsModalOpen}
                onClose={() => setIsTermsModalOpen(false)}
                title="Terms and Review Responsibilities"
                maxWidthClass="max-w-2xl"
            >
                <div className="space-y-5">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">
                            CategorizationAI provides automated support tools, not final professional judgment.
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                            Before creating the account, you must understand that every automated output requires human review.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {TERMS_SECTIONS.map((section) => (
                            <div key={section.title} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    {section.title}
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-gray-600">
                                    {section.body}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                            onClick={() => setIsTermsModalOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </PopupModal>
        </section>
    )
}

export default Register
