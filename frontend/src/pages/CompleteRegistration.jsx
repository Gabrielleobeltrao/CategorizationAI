import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { completeRegistrationWithOffice } from "../services/register.service"
import { useOpenTest } from "../contexts/openTest.context"
import { useNotification } from "../contexts/notification.context"
import { useAuth } from "../contexts/auth.context"

function CompleteRegistration() {
  const navigate = useNavigate()
  const { success, error } = useNotification()
  const { config: openTestConfig } = useOpenTest()
  const { profile, refreshAuth } = useAuth()
  const [officeName, setOfficeName] = useState("")
  const [officeAddress, setOfficeAddress] = useState("")
  const [officePhone, setOfficePhone] = useState("")
  const [officeEmail, setOfficeEmail] = useState("")
  const [openTestAccessCode, setOpenTestAccessCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOpenTestEnabled = Boolean(openTestConfig?.enabled)

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)

      await completeRegistrationWithOffice({
        name: String(profile?.name || "").trim(),
        officeName,
        officeAddress,
        officePhone,
        officeEmail,
        openTestAccessCode,
        requiresOpenTestAccessCode: isOpenTestEnabled,
        openTestConfig,
      })

      const snapshot = await refreshAuth({ force: true })
      if (!snapshot?.profile) {
        throw new Error("Failed to complete workspace setup")
      }

      success("Workspace completed successfully")
      navigate("/home")
    } catch (err) {
      error(err.message || "Failed to complete workspace")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="flex min-h-dvh w-full items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-gray-900">CategorizationAI</h1>
          <p className="mt-1 text-sm text-gray-500">Complete your workspace to continue</p>
        </div>

        <form
          className="flex flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Finish office setup</h2>
            <p className="mt-1 text-sm text-gray-500">
              Your account exists, but your office was not completed yet.
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

          {isOpenTestEnabled && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Private beta access code
              </span>
              <input
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                type="text"
                placeholder="Access code"
                value={openTestAccessCode}
                onChange={(e) => setOpenTestAccessCode(e.target.value)}
              />
            </label>
          )}

          <div className="flex justify-end">
            <button
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Complete workspace"}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default CompleteRegistration
