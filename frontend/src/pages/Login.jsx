import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { signIn } from "../services/auth.service"
import { useAuth } from "../contexts/auth.context"
import { useNotification } from "../contexts/notification.context"

function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const navigate = useNavigate()
    const { success, error } = useNotification()
    const { beginAuthenticatedSession, clearAuth, refreshAuth } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setIsSubmitting(true)
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
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="relative flex min-h-dvh w-full flex-col bg-gray-50">
            <DecorBackground />

            <TopBar>
                <Link
                    to="/register"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100"
                >
                    Create an office
                </Link>
            </TopBar>

            <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
                <div className="w-full max-w-md">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Welcome back</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in to your office to keep the books moving.
                        </p>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
                    >
                        <div className="flex flex-col gap-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
                                <input
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@office.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Password</span>
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="Your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                {isSubmitting ? "Signing in…" : "Sign in"}
                            </button>
                        </div>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-600">
                        New to CategorizationAI?{" "}
                        <Link
                            to="/register"
                            className="font-semibold text-gray-900 hover:underline"
                        >
                            Create an office
                        </Link>
                    </p>
                </div>
            </main>

            <PageFooter />
        </div>
    )
}

export default Login

// --------------------------------------------------------------------
// Shared layout bits
// --------------------------------------------------------------------

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
    // Subtle dotted grid background — keeps the page from feeling empty
    // without distracting from the form. Sits below content (z-0).
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
