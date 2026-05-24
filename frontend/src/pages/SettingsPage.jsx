import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { updateMyProfile } from "../services/auth.service"
import { useAuth } from "../contexts/auth.context"
import { getCachedOfficeById, getOfficeById, updateOfficeById, updateOfficeFeatures } from "../services/office.service"
import { hasPermission } from "../utils/permissions"
import { useNotification } from "../contexts/notification.context"
import { useFeature } from "../hooks/useFeature"
import {
  isChatNotificationsEnabled,
  setChatNotificationsEnabled,
  requestNotificationPermission,
  getNotificationPermission,
  isInAppPopupsEnabled,
  setInAppPopupsEnabled,
} from "../utils/chatNotifications"

function normalizeAccountForm(profile) {
  return {
    name: String(profile?.name || ""),
  }
}

function normalizeOfficeForm(office) {
  return {
    name: String(office?.name || ""),
    businessEmail: String(office?.businessEmail || ""),
    businessPhone: String(office?.businessPhone || ""),
    address: String(office?.address || ""),
  }
}

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatRole(value) {
  const safe = String(value || "").trim()
  if (!safe) return "-"

  return safe
    .split("_")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ")
}

function formatStatus(value) {
  const safe = String(value || "").trim().toLowerCase()
  if (!safe) return "-"
  return safe.charAt(0).toUpperCase() + safe.slice(1)
}

function SettingsPage() {
  const { profile, updateProfile, refreshAuth } = useAuth()
  const [office, setOffice] = useState(null)
  const [accountForm, setAccountForm] = useState({
    name: "",
  })
  const [form, setForm] = useState({
    name: "",
    businessEmail: "",
    businessPhone: "",
    address: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingCrm, setIsTogglingCrm] = useState(false)
  const [isTogglingOperationalStatus, setIsTogglingOperationalStatus] = useState(false)
  const [isTogglingCrmTasks, setIsTogglingCrmTasks] = useState(false)
  const [isTogglingCrmChat, setIsTogglingCrmChat] = useState(false)
  const [isTogglingBookkeepingLlm, setIsTogglingBookkeepingLlm] = useState(false)
  const { success, error } = useNotification()

  const permissions = useMemo(() => profile?.permissions || [], [profile?.permissions])
  const canReadOffice = useMemo(() => hasPermission(permissions, "offices:read"), [permissions])
  const canEditOffice = useMemo(() => hasPermission(permissions, "offices:update"), [permissions])
  const isAccountDirty = useMemo(() => {
    const initial = normalizeAccountForm(profile)
    return JSON.stringify(initial) !== JSON.stringify(accountForm)
  }, [accountForm, profile])
  const isDirty = useMemo(() => {
    const initial = normalizeOfficeForm(office)
    return JSON.stringify(initial) !== JSON.stringify(form)
  }, [form, office])

  useEffect(() => {
    let active = true

    async function loadPage() {
      try {
        setIsLoading(true)
        const officeId = String(profile?.officeId || "").trim()
        const currentPermissions = profile?.permissions || []

        setAccountForm(normalizeAccountForm(profile))

        if (!officeId || !hasPermission(currentPermissions, "offices:read")) {
          setOffice(null)
          setForm(normalizeOfficeForm(null))
          return
        }

        const cachedOffice = getCachedOfficeById(officeId)
        if (cachedOffice) {
          setOffice(cachedOffice || null)
          setForm(normalizeOfficeForm(cachedOffice))
          setIsLoading(false)
          return
        }

        const officeData = await getOfficeById(officeId)
        if (!active) return

        setOffice(officeData || null)
        setForm(normalizeOfficeForm(officeData))
      } catch (err) {
        if (!active) return
        error(err.message || "Failed to load office settings")
      } finally {
        if (!active) return
        setIsLoading(false)
      }
    }

    if (!profile) {
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    loadPage()

    return () => {
      active = false
    }
  }, [error, profile])

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleAccountChange = (field, value) => {
    setAccountForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()

    if (!accountForm.name.trim()) {
      error("Name is required")
      return
    }

    try {
      setIsSavingAccount(true)

      const updatedProfile = await updateMyProfile({
        name: accountForm.name.trim(),
      })

      updateProfile(updatedProfile || null)
      setAccountForm(normalizeAccountForm(updatedProfile))
      success("Account updated")
    } catch (err) {
      error(err.message || "Failed to update account")
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleToggleBookkeepingLlm = async (nextEnabled) => {
    if (!office?._id) {
      error("Office not found")
      return
    }
    if (!canEditOffice) {
      error("You do not have permission to manage add-ons")
      return
    }
    try {
      setIsTogglingBookkeepingLlm(true)
      const updatedOffice = await updateOfficeFeatures(office._id, {
        bookkeepingLlm: Boolean(nextEnabled),
      })
      setOffice(updatedOffice || null)
      await refreshAuth({ force: true })
      success(nextEnabled ? "AI categorization enabled" : "AI categorization disabled")
    } catch (err) {
      error(err.message || "Failed to update add-on")
    } finally {
      setIsTogglingBookkeepingLlm(false)
    }
  }

  const handleToggleCrmTasks = async (nextEnabled) => {
    if (!office?._id) {
      error("Office not found")
      return
    }
    if (!canEditOffice) {
      error("You do not have permission to manage add-ons")
      return
    }
    try {
      setIsTogglingCrmTasks(true)
      const updatedOffice = await updateOfficeFeatures(office._id, {
        crmTasks: Boolean(nextEnabled),
      })
      setOffice(updatedOffice || null)
      await refreshAuth({ force: true })
      success(nextEnabled ? "Tasks enabled" : "Tasks disabled")
    } catch (err) {
      error(err.message || "Failed to update add-on")
    } finally {
      setIsTogglingCrmTasks(false)
    }
  }

  const handleToggleCrmChat = async (nextEnabled) => {
    if (!office?._id) {
      error("Office not found")
      return
    }
    if (!canEditOffice) {
      error("You do not have permission to manage add-ons")
      return
    }
    try {
      setIsTogglingCrmChat(true)
      const updatedOffice = await updateOfficeFeatures(office._id, {
        crmChat: Boolean(nextEnabled),
      })
      setOffice(updatedOffice || null)
      await refreshAuth({ force: true })
      success(nextEnabled ? "Team Chat enabled" : "Team Chat disabled")
    } catch (err) {
      error(err.message || "Failed to update add-on")
    } finally {
      setIsTogglingCrmChat(false)
    }
  }

  const handleToggleOperationalStatus = async (nextEnabled) => {
    if (!office?._id) {
      error("Office not found")
      return
    }
    if (!canEditOffice) {
      error("You do not have permission to manage add-ons")
      return
    }
    try {
      setIsTogglingOperationalStatus(true)
      const updatedOffice = await updateOfficeFeatures(office._id, {
        crmOperationalStatus: Boolean(nextEnabled),
      })
      setOffice(updatedOffice || null)
      await refreshAuth({ force: true })
      success(nextEnabled ? "Operational Status enabled" : "Operational Status disabled")
    } catch (err) {
      error(err.message || "Failed to update add-on")
    } finally {
      setIsTogglingOperationalStatus(false)
    }
  }

  const handleToggleCrm = async (nextEnabled) => {
    if (!office?._id) {
      error("Office not found")
      return
    }

    if (!canEditOffice) {
      error("You do not have permission to manage add-ons")
      return
    }

    try {
      setIsTogglingCrm(true)
      const updatedOffice = await updateOfficeFeatures(office._id, { crm: Boolean(nextEnabled) })
      setOffice(updatedOffice || null)
      await refreshAuth({ force: true })
      success(nextEnabled ? "Operations CRM enabled" : "Operations CRM disabled")
    } catch (err) {
      error(err.message || "Failed to update add-on")
    } finally {
      setIsTogglingCrm(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!office?._id) {
      error("Office not found")
      return
    }

    if (!canEditOffice) {
      error("You do not have permission to update office settings")
      return
    }

    if (!form.name.trim()) {
      error("Office name is required")
      return
    }

    try {
      setIsSaving(true)

      const updatedOffice = await updateOfficeById(office._id, {
        name: form.name.trim(),
        businessEmail: form.businessEmail.trim(),
        businessPhone: form.businessPhone.trim(),
        address: form.address.trim(),
      })

      setOffice(updatedOffice || null)
      setForm(normalizeOfficeForm(updatedOffice))
      success("Office settings updated")
    } catch (err) {
      error(err.message || "Failed to update office settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="w-full px-12 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="border-b border-gray-200 py-6">
            <p className="text-sm text-gray-500">Loading settings...</p>
          </div>
        </div>
      </section>
    )
  }

  if (!canReadOffice) {
    return (
      <section className="w-full px-12 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="border-b border-gray-200 py-6">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Settings</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-500">
              Your current role does not include permission to view office information. Add
              <span className="font-medium text-gray-700"> offices:read </span>
              to this role if this screen should be visible.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full px-12 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage your account and the main information used across your workspace.
            </p>
          </div>
        </header>

        <form
          id="account-settings-form"
          onSubmit={handleAccountSubmit}
          className="border-t border-gray-200"
        >
          <div className="py-4">
            <h2 className="text-lg font-semibold text-gray-900">My account</h2>
          </div>

          <div className="py-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Name
                </span>
                <input
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                  type="text"
                  value={accountForm.name}
                  onChange={(e) => handleAccountChange("name", e.target.value)}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Email
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {profile?.email || "-"}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Role
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {formatRole(profile?.role)}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Status
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {formatStatus(profile?.status)}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Office
                </span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {office?.name || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pb-4">
            <button
              type="submit"
              disabled={isSavingAccount || !isAccountDirty}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isSavingAccount ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        <form
          id="office-settings-form"
          onSubmit={handleSubmit}
          className="border-t border-gray-200"
        >
          <div className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Office information</h2>
              {!canEditOffice && (
                <span className="text-sm text-gray-500">
                  Read-only mode
                </span>
              )}
            </div>
          </div>

          <div className="py-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Office name
                </span>
                <input
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={!canEditOffice}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Business email
                </span>
                <input
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  type="email"
                  value={form.businessEmail}
                  onChange={(e) => handleChange("businessEmail", e.target.value)}
                  disabled={!canEditOffice}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Business phone
                </span>
                <input
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  type="text"
                  value={form.businessPhone}
                  onChange={(e) => handleChange("businessPhone", e.target.value)}
                  disabled={!canEditOffice}
                />
              </label>

              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Address
                </span>
                <textarea
                  className="min-h-[140px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  disabled={!canEditOffice}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 divide-y divide-gray-100">
            <div className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Office ID
              </p>
              <p className="break-all text-sm text-gray-700">
                {office?._id || "-"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Created
              </p>
              <p className="text-sm text-gray-700">
                {formatDate(office?.createdAt)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Updated
              </p>
              <p className="text-sm text-gray-700">
                {formatDate(office?.updatedAt)}
              </p>
            </div>
          </div>

          {!canEditOffice && (
            <div className="border-t border-gray-100 py-4">
              <p className="text-sm text-gray-500">
                This role can view office information, but cannot edit it.
              </p>
            </div>
          )}

          {canEditOffice && (
            <div className="flex justify-end pb-4">
              <button
                type="submit"
                disabled={isSaving || !isDirty}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </form>

        <ChatNotificationsPreference />

        {hasPermission(profile?.permissions, "activityLog:read") && String(profile?.clientScope || "all") !== "assigned" && (
          <section className="border-t border-gray-200" aria-labelledby="admin-tools-heading">
            <div className="py-4">
              <h2 id="admin-tools-heading" className="text-lg font-semibold text-gray-900">
                Admin tools
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Audit and observability for managers and owners.
              </p>
            </div>

            <Link
              to="/activity"
              className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-900 text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16" />
                    <path d="M4 12h10" />
                    <path d="M4 18h13" />
                    <circle cx="18" cy="12" r="1.5" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-gray-900">Activity Log</p>
                  <p className="text-sm text-gray-500">
                    Office-wide audit trail — who did what across clients, tasks, period close and reconciliation.
                  </p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </Link>
          </section>
        )}

        <section className="border-t border-gray-200" aria-labelledby="addons-heading">
          <div className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="addons-heading" className="text-lg font-semibold text-gray-900">
                Plan &amp; add-ons
              </h2>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                Manual toggle · Stripe coming soon
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Bookkeeping is always included. Operations CRM is an add-on you can toggle while billing is not connected yet.
            </p>
          </div>

          <div className="grid gap-3 py-4 md:grid-cols-2">
            <article className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Bookkeeping</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Clients, accounts, transactions, categories, ledger, P&amp;L.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  Included
                </span>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Always active on every office.
              </p>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Sub-features
                </p>
                <div className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">AI categorization</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Enables the &quot;Categorize with AI&quot; button, the AI suggestion icon column
                      on transactions, and the memory system that learns from past categorizations.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(office?.features?.bookkeepingLlm)}
                    disabled={!canEditOffice || isTogglingBookkeepingLlm}
                    onClick={() => handleToggleBookkeepingLlm(!office?.features?.bookkeepingLlm)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      office?.features?.bookkeepingLlm ? "bg-gray-900" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        office?.features?.bookkeepingLlm ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </article>

            <article className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Operations CRM</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Tasks, CRM status, missing documents, timeline, monthly closing, follow-ups.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    office?.features?.crm
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {office?.features?.crm ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {office?.features?.crm
                    ? "CRM menus and tabs are visible."
                    : "Turn on to reveal CRM menus and tabs."}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(office?.features?.crm)}
                  disabled={!canEditOffice || isTogglingCrm}
                  onClick={() => handleToggleCrm(!office?.features?.crm)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    office?.features?.crm ? "bg-gray-900" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      office?.features?.crm ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {!canEditOffice && (
                <p className="mt-2 text-[11px] text-gray-400">
                  Only roles with offices:update can manage add-ons.
                </p>
              )}

              {office?.features?.crm && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Sub-features
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">Tasks</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Team-wide task board with assignees, due dates, priorities and
                          status tracking. Turn off to hide the Tasks menu and pages.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(office?.features?.crmTasks)}
                        disabled={!canEditOffice || isTogglingCrmTasks}
                        onClick={() => handleToggleCrmTasks(!office?.features?.crmTasks)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          office?.features?.crmTasks ? "bg-gray-900" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            office?.features?.crmTasks ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">Operational Status</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Automatic per-client status driven by bookkeeping data (onboarding,
                          importing, needs review, etc). A few states can be manually overridden.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(office?.features?.crmOperationalStatus)}
                        disabled={!canEditOffice || isTogglingOperationalStatus}
                        onClick={() => handleToggleOperationalStatus(!office?.features?.crmOperationalStatus)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          office?.features?.crmOperationalStatus ? "bg-gray-900" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            office?.features?.crmOperationalStatus ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">Team Chat</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Floating internal chat for office employees. Messages are retained for 90 days.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(office?.features?.crmChat)}
                        disabled={!canEditOffice || isTogglingCrmChat}
                        onClick={() => handleToggleCrmChat(!office?.features?.crmChat)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          office?.features?.crmChat ? "bg-gray-900" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            office?.features?.crmChat ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          </div>
        </section>


      </div>
    </section>
  )
}

function ChatNotificationsPreference() {
  const isCrmChatEnabled = useFeature("crmChat")
  const [browserEnabled, setBrowserEnabled] = useState(() => isChatNotificationsEnabled())
  const [permission, setPermission] = useState(() => getNotificationPermission())
  const [inAppEnabled, setInAppEnabledState] = useState(() => isInAppPopupsEnabled())
  const [isBusy, setIsBusy] = useState(false)
  const { error, success } = useNotification()

  if (!isCrmChatEnabled) return null

  const handleToggleBrowser = async (next) => {
    if (!next) {
      setChatNotificationsEnabled(false)
      setBrowserEnabled(false)
      success("Browser notifications disabled")
      return
    }
    setIsBusy(true)
    try {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result === "granted") {
        setChatNotificationsEnabled(true)
        setBrowserEnabled(true)
        success("Browser notifications enabled")
      } else if (result === "denied") {
        setChatNotificationsEnabled(false)
        setBrowserEnabled(false)
        error("Browser blocked notifications. Allow them in your browser settings and try again.")
      } else if (result === "unsupported") {
        error("Your browser doesn't support notifications.")
      } else {
        setChatNotificationsEnabled(false)
        setBrowserEnabled(false)
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleToggleInApp = (next) => {
    setInAppPopupsEnabled(Boolean(next))
    setInAppEnabledState(Boolean(next))
    success(next ? "In-app popups enabled" : "In-app popups disabled")
  }

  const blocked = permission === "denied"

  return (
    <section className="border-t border-gray-200" aria-labelledby="prefs-heading">
      <div className="py-4">
        <h2 id="prefs-heading" className="text-lg font-semibold text-gray-900">
          Preferences
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Personal settings that only affect this device.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Browser notifications</p>
            <p className="mt-1 text-xs text-gray-500">
              Show the operating system / browser notification when a new chat message arrives.
              {blocked && (
                <span className="ml-1 font-medium text-amber-700">
                  Browser permission is blocked — change it in your browser settings.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(browserEnabled)}
            disabled={isBusy || blocked}
            onClick={() => handleToggleBrowser(!browserEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
              browserEnabled ? "bg-gray-900" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                browserEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">In-app popups</p>
            <p className="mt-1 text-xs text-gray-500">
              Show a small toast in the bottom-right corner inside the app — works without browser permission.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(inAppEnabled)}
            onClick={() => handleToggleInApp(!inAppEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              inAppEnabled ? "bg-gray-900" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                inAppEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  )
}

export default SettingsPage
