import { useEffect, useMemo, useState } from "react"
import ConfirmModal from "../components/ui/ConfirmModal"
import PopupModal from "../components/ui/PopupModal"
import TagsInput from "../components/ui/TagsInput"
import TagRulesHelp from "../components/ui/TagRulesHelp"
import { useOfficeTags } from "../hooks/useOfficeTags"
import { updateMyProfile } from "../services/auth.service"
import { useAuth } from "../contexts/auth.context"
import { getOfficeById, updateOfficeById } from "../services/office.service"
import {
  createCategoryTemplate,
  deleteCategoryTemplateById,
  listCategoryTemplatesByOfficeId,
  updateCategoryTemplateById,
} from "../services/categoryTemplates.service"
import { CATEGORY_TYPE_OPTIONS, getCategoryTypeLabel } from "../constants/categoryTypes"
import { hasPermission } from "../utils/permissions"
import { useNotification } from "../contexts/notification.context"

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

function normalizeTemplateDraft(template = null) {
  return {
    name: String(template?.name || ""),
    type: String(template?.type || ""),
    description: String(template?.description || ""),
    tags: Array.isArray(template?.tags) ? template.tags : [],
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
  const { profile, updateProfile } = useAuth()
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
  const [categoryTemplates, setCategoryTemplates] = useState([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState("")
  const [templateDraft, setTemplateDraft] = useState(normalizeTemplateDraft())
  const [templateToDelete, setTemplateToDelete] = useState(null)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const { success, error } = useNotification()

  const permissions = useMemo(() => profile?.permissions || [], [profile?.permissions])
  const canReadOffice = useMemo(() => hasPermission(permissions, "offices:read"), [permissions])
  const canEditOffice = useMemo(() => hasPermission(permissions, "offices:update"), [permissions])
  const canReadGlobalCategories = useMemo(() => hasPermission(permissions, "categories:read"), [permissions])
  const canCreateGlobalCategories = useMemo(() => hasPermission(permissions, "categories:create"), [permissions])
  const canUpdateGlobalCategories = useMemo(() => hasPermission(permissions, "categories:update"), [permissions])
  const canDeleteGlobalCategories = useMemo(() => hasPermission(permissions, "categories:delete"), [permissions])
  const isAccountDirty = useMemo(() => {
    const initial = normalizeAccountForm(profile)
    return JSON.stringify(initial) !== JSON.stringify(accountForm)
  }, [accountForm, profile])
  const isDirty = useMemo(() => {
    const initial = normalizeOfficeForm(office)
    return JSON.stringify(initial) !== JSON.stringify(form)
  }, [form, office])
  const officeId = String(profile?.officeId || "").trim()
  const { tags: officeTags, reloadTags, deleteTag, deletingTag } = useOfficeTags(officeId, {
    onError: (err) => error(err.message || "Failed to delete tag"),
    onDeleteSuccess: (tag) => success(`Tag "${tag}" deleted successfully`),
  })

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

  useEffect(() => {
    let active = true

    async function loadTemplates() {
      try {
        setIsLoadingTemplates(true)
        const officeId = String(profile?.officeId || "").trim()
        if (!officeId || !canReadGlobalCategories) {
          setCategoryTemplates([])
          return
        }

        const templates = await listCategoryTemplatesByOfficeId(officeId)
        if (!active) return
        setCategoryTemplates(Array.isArray(templates) ? templates : [])
      } catch (err) {
        if (!active) return
        error(err.message || "Failed to load global categories")
        setCategoryTemplates([])
      } finally {
        if (!active) return
        setIsLoadingTemplates(false)
      }
    }

    if (!profile) {
      setCategoryTemplates([])
      setIsLoadingTemplates(false)
      return () => {
        active = false
      }
    }

    loadTemplates()

    return () => {
      active = false
    }
  }, [profile, canReadGlobalCategories, error])

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

  const openCreateTemplateModal = () => {
    setEditingTemplateId("")
    setTemplateDraft(normalizeTemplateDraft())
    setIsTemplateModalOpen(true)
  }

  const openEditTemplateModal = (template) => {
    setEditingTemplateId(String(template?._id || ""))
    setTemplateDraft(normalizeTemplateDraft(template))
    setIsTemplateModalOpen(true)
  }

  const closeTemplateModal = () => {
    setIsTemplateModalOpen(false)
    setEditingTemplateId("")
    setTemplateDraft(normalizeTemplateDraft())
  }

  const handleTemplateSubmit = async (e) => {
    e.preventDefault()

    const officeId = String(profile?.officeId || "").trim()
    if (!officeId) {
      error("Office not found")
      return
    }

    try {
      setIsSavingTemplate(true)

      if (editingTemplateId) {
        const updated = await updateCategoryTemplateById(editingTemplateId, templateDraft)
        setCategoryTemplates((current) =>
          current.map((item) => (String(item?._id || "") === editingTemplateId ? updated : item))
        )
        success("Global category updated")
      } else {
        const created = await createCategoryTemplate({
          officeId,
          ...templateDraft,
        })
        setCategoryTemplates((current) => [created, ...current])
        success("Global category created")
      }

      reloadTags()
      closeTemplateModal()
    } catch (err) {
      error(err.message || "Failed to save global category")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async () => {
    const templateId = String(templateToDelete?._id || "")
    if (!templateId) return

    try {
      setIsSavingTemplate(true)
      await deleteCategoryTemplateById(templateId)
      setCategoryTemplates((current) => current.filter((item) => String(item?._id || "") !== templateId))
      setTemplateToDelete(null)
      success("Global category deleted")
      reloadTags()
    } catch (err) {
      error(err.message || "Failed to delete global category")
    } finally {
      setIsSavingTemplate(false)
    }
  }

  if (isLoading) {
    return (
      <section className="w-full p-8">
        <div className="mx-auto max-w-5xl">
          <div className="border-b border-gray-200 py-6">
            <p className="text-sm text-gray-500">Loading settings...</p>
          </div>
        </div>
      </section>
    )
  }

  if (!canReadOffice) {
    return (
      <section className="w-full p-8">
        <div className="mx-auto max-w-5xl">
          <div className="border-b border-gray-200 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
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
    <section className="w-full p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
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
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">My account</h2>
              <button
                type="submit"
                disabled={isSavingAccount || !isAccountDirty}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-left disabled:cursor-not-allowed disabled:text-gray-400"
              >
                {isSavingAccount ? "Saving..." : "Save changes"}
              </button>
            </div>
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
        </form>

        <form
          id="office-settings-form"
          onSubmit={handleSubmit}
          className="border-t border-gray-200"
        >
          <div className="py-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Office information</h2>
              <div className="flex items-center gap-3">
                {!canEditOffice && (
                  <span className="text-sm text-gray-500">
                    Read-only mode
                  </span>
                )}
                {canEditOffice && (
                  <button
                    type="submit"
                    disabled={isSaving || !isDirty}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-left disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                )}
              </div>
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

          <div className="border-t border-gray-200 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Workspace details</h2>
          </div>

          <div className="divide-y divide-gray-100">
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
        </form>

        <section className="border-t border-gray-200">
          <div className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Global categories</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create office-wide category templates with tags. New clients automatically receive matching categories based on their tags.
                </p>
              </div>
              {canCreateGlobalCategories && (
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium"
                  onClick={openCreateTemplateModal}
                >
                  New global category
                </button>
              )}
            </div>
          </div>

          {!canReadGlobalCategories ? (
            <div className="border-t border-gray-100 py-4">
              <p className="text-sm text-gray-500">
                This role can access settings, but cannot view global categories.
              </p>
            </div>
          ) : isLoadingTemplates ? (
            <div className="border-t border-gray-100 py-4">
              <p className="text-sm text-gray-500">Loading global categories...</p>
            </div>
          ) : categoryTemplates.length === 0 ? (
            <div className="border-t border-gray-100 py-4">
              <p className="text-sm text-gray-500">
                No global categories yet. Create one and assign tags to make new clients inherit matching categories automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {categoryTemplates.map((template) => (
                <div key={String(template?._id || "")} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{template?.name || "-"}</h3>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        {getCategoryTypeLabel(template?.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{template?.description || "-"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Array.isArray(template?.tags) && template.tags.length > 0 ? (
                        template.tags.map((tag) => (
                          <span
                            key={`${template?._id || "template"}-${tag}`}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">No tags</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-end gap-2">
                    {canUpdateGlobalCategories && (
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-700"
                        onClick={() => openEditTemplateModal(template)}
                        title="Edit global category"
                        aria-label="Edit global category"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                        </svg>
                      </button>
                    )}
                    {canDeleteGlobalCategories && (
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-rose-600"
                        onClick={() => setTemplateToDelete(template)}
                        title="Delete global category"
                        aria-label="Delete global category"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <PopupModal
        isOpen={isTemplateModalOpen}
        onClose={closeTemplateModal}
        title={editingTemplateId ? "Edit Global Category" : "Create Global Category"}
        maxWidthClass="max-w-2xl"
      >
        <form className="flex flex-col gap-4" onSubmit={handleTemplateSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Name
              </span>
              <input
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                type="text"
                value={templateDraft.name}
                onChange={(e) => setTemplateDraft((current) => ({ ...current, name: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Type
              </span>
              <select
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                value={templateDraft.type}
                onChange={(e) => setTemplateDraft((current) => ({ ...current, type: e.target.value }))}
              >
                <option value="">Select type</option>
                {CATEGORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                <span>Tags</span>
                <TagRulesHelp />
              </span>
              <TagsInput
                value={templateDraft.tags}
                onChange={(nextTags) => setTemplateDraft((current) => ({ ...current, tags: nextTags }))}
                options={officeTags}
                placeholder="Add tags that should match clients"
                onDeleteOption={deleteTag}
                deletingOption={deletingTag}
              />
            </label>

            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Description
              </span>
              <textarea
                className="min-h-[120px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500"
                value={templateDraft.description}
                onChange={(e) => setTemplateDraft((current) => ({ ...current, description: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium"
              onClick={closeTemplateModal}
              disabled={isSavingTemplate}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium disabled:text-gray-400"
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </PopupModal>

      <ConfirmModal
        isOpen={Boolean(templateToDelete)}
        title="Delete Global Category"
        message={`This action will permanently delete ${templateToDelete?.name || "this global category"}.`}
        confirmLabel="Delete Global Category"
        onConfirm={handleDeleteTemplate}
        onClose={() => setTemplateToDelete(null)}
        isLoading={isSavingTemplate}
      />
    </section>
  )
}

export default SettingsPage
