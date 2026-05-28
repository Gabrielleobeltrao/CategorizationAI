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
        <div className="relative flex min-h-dvh w-full flex-col bg-gray-50">
            <DecorBackground />

            <TopBar>
                <Link
                    to="/login"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100"
                >
                    Sign in
                </Link>
            </TopBar>

            <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
                <div className="w-full max-w-xl">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                            {step === 1 ? "Create your office" : "Create your owner account"}
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            {step === 1
                                ? "Start with the business details. Only the office name is required."
                                : "This account will be created as the owner of the office."}
                        </p>

                        <ol className="mt-6 flex items-center justify-center gap-3">
                            <StepBadge index={1} active={step === 1} done={step > 1}>Office</StepBadge>
                            <span className="h-px w-8 bg-gray-200" />
                            <StepBadge index={2} active={step === 2} done={false}>Owner</StepBadge>
                        </ol>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
                    >
                        <div className="flex flex-col gap-4">
                            {step === 1 && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="Office name" colSpan="md:col-span-2">
                                        <input
                                            type="text"
                                            placeholder="e.g. Hill & Co. Bookkeeping"
                                            value={officeName}
                                            onChange={(e) => setOfficeName(e.target.value)}
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Address" colSpan="md:col-span-2" optional>
                                        <input
                                            type="text"
                                            placeholder="Optional address"
                                            value={officeAddress}
                                            onChange={(e) => setOfficeAddress(e.target.value)}
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Business phone" optional>
                                        <input
                                            type="text"
                                            placeholder="Optional phone"
                                            value={officePhone}
                                            onChange={(e) => setOfficePhone(e.target.value)}
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Business email" optional>
                                        <input
                                            type="email"
                                            placeholder="Optional email"
                                            value={officeEmail}
                                            onChange={(e) => setOfficeEmail(e.target.value)}
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>
                            )}

                            {step === 2 && (
                                <>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field label="Your name" colSpan="md:col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Your name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className={inputClass}
                                            />
                                        </Field>
                                        <Field label="Email" colSpan="md:col-span-2">
                                            <input
                                                type="email"
                                                placeholder="you@office.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={inputClass}
                                            />
                                        </Field>
                                        <Field label="Password">
                                            <input
                                                type="password"
                                                placeholder="Create a password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={inputClass}
                                            />
                                        </Field>
                                        <Field label="Confirm password">
                                            <input
                                                type="password"
                                                placeholder="Repeat password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className={inputClass}
                                            />
                                        </Field>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ownership</p>
                                        <p className="mt-0.5 text-sm text-gray-700">
                                            Your account will be created as <span className="font-semibold">owner</span> of this office.
                                        </p>
                                    </div>

                                    <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 rounded border-gray-300"
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
                                            . I understand that all AI and automated actions must be reviewed by a qualified professional.
                                        </span>
                                    </label>
                                </>
                            )}

                            <div className="mt-2 flex items-center gap-2">
                                {step === 2 && (
                                    <button
                                        type="button"
                                        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                                        onClick={() => setStep(1)}
                                        disabled={isSubmitting}
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (step === 2 && !hasAcceptedTerms)}
                                    className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                    {step === 1 ? "Continue" : isSubmitting ? "Creating…" : "Create account"}
                                </button>
                            </div>
                        </div>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-600">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="font-semibold text-gray-900 hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </main>

            <PageFooter />

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
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">Private beta</p>
                        <p className="mt-1">
                            {openTestConfig?.notices?.auth || "This workspace is currently in private beta and access is limited to invited offices. Some screens may load more slowly while the final infrastructure is not in place."}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                            Enter your private beta access code to finish creating the account.
                        </p>
                        <p className="text-sm text-gray-500">
                            This is the final validation step for invited offices.
                        </p>
                    </div>

                    <Field label="Access code">
                        <input
                            type="text"
                            placeholder="Private beta access code"
                            value={openTestAccessCode}
                            onChange={(e) => setOpenTestAccessCode(e.target.value)}
                            autoFocus
                            className={inputClass}
                        />
                    </Field>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                            onClick={() => setIsOpenTestModalOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
                            onClick={handleConfirmOpenTestAccess}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating…" : "Create account"}
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
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
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
                            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                            onClick={() => setIsTermsModalOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </PopupModal>
        </div>
    )
}

export default Register

// --------------------------------------------------------------------
// Shared bits
// --------------------------------------------------------------------

const inputClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"

function Field({ label, optional = false, colSpan = "", children }) {
    return (
        <label className={`flex flex-col gap-1.5 text-left ${colSpan}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
                {optional && <span className="ml-1 normal-case text-gray-400">(optional)</span>}
            </span>
            {children}
        </label>
    )
}

function StepBadge({ index, active, done, children }) {
    return (
        <li className="flex items-center gap-2">
            <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                        ? "bg-emerald-500 text-white"
                        : active
                            ? "bg-gray-900 text-white"
                            : "border border-gray-200 bg-white text-gray-400"
                }`}
            >
                {done ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                ) : (
                    index
                )}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-gray-900" : "text-gray-500"}`}>
                {children}
            </span>
        </li>
    )
}

function TopBar({ children }) {
    return (
        <header className="relative z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <LogoMark />
                    CategorizationAI
                </Link>
                {children}
            </div>
        </header>
    )
}

function PageFooter() {
    return (
        <footer className="relative z-10 border-t border-gray-200 bg-white/60 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-xs text-gray-500 sm:px-6">
                <span>© {new Date().getFullYear()} CategorizationAI</span>
                <Link to="/" className="hover:text-gray-700">Back to home</Link>
            </div>
        </footer>
    )
}

function DecorBackground() {
    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 opacity-60"
                style={{
                    backgroundImage:
                        "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-gradient-to-b from-white via-white/70 to-transparent"
            />
        </>
    )
}

function LogoMark() {
    return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19h16" />
                <path d="M6 16V9" />
                <path d="M12 16V6" />
                <path d="M18 16v-4" />
            </svg>
        </span>
    )
}
