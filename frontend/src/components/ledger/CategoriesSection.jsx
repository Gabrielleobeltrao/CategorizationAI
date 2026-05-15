import { useEffect, useMemo, useRef, useState } from "react"
import TagsInput from "../ui/TagsInput"
import TagRulesHelp from "../ui/TagRulesHelp"
import PopupModal from "../ui/PopupModal"
import { CATEGORY_TYPE_OPTIONS, getCategoryTypeLabel, normalizeCategoryType } from "../../constants/categoryTypes"

function CategoriesSection({
    categories,
    onCreate,
    onClearUnused,
    onSaveEdit,
    onDelete,
    onDeleteMany,
    tagOptions = [],
    onDeleteTag,
    deletingTag = "",
}) {
    const [editingId, setEditingId] = useState("")
    const [draftName, setDraftName] = useState("")
    const [draftType, setDraftType] = useState("")
    const [draftDescription, setDraftDescription] = useState("")
    const [draftTags, setDraftTags] = useState([])
    const [isSaving, setIsSaving] = useState(false)
    const [selectedIds, setSelectedIds] = useState([])
    const selectAllRef = useRef(null)

    useEffect(() => {
        const validIds = new Set((Array.isArray(categories) ? categories : []).map((category) => category.id))
        setSelectedIds((current) => current.filter((id) => validIds.has(id)))
    }, [categories])

    const startEdit = (category) => {
        setEditingId(category.id)
        setDraftName(category.name || "")
        setDraftType(normalizeCategoryType(category.type) || "")
        setDraftDescription(category.description || "")
        setDraftTags(Array.isArray(category.tags) ? category.tags : [])
    }

    const cancelEdit = () => {
        setEditingId("")
        setDraftName("")
        setDraftType("")
        setDraftDescription("")
        setDraftTags([])
    }

    const saveEdit = async () => {
        if (!editingId) return
        try {
            setIsSaving(true)
            await onSaveEdit?.(editingId, {
                name: draftName,
                type: draftType,
                description: draftDescription,
                tags: draftTags,
            })
            cancelEdit()
        } finally {
            setIsSaving(false)
        }
    }

    const categoryIds = useMemo(
        () => (Array.isArray(categories) ? categories.map((category) => category.id) : []),
        [categories]
    )
    const allSelected = useMemo(
        () => categoryIds.length > 0 && categoryIds.every((id) => selectedIds.includes(id)),
        [categoryIds, selectedIds]
    )

    const someSelected = useMemo(
        () => !allSelected && categoryIds.some((id) => selectedIds.includes(id)),
        [categoryIds, selectedIds, allSelected]
    )

    useEffect(() => {
        if (!selectAllRef.current) return
        selectAllRef.current.indeterminate = someSelected
    }, [someSelected])

    const toggleSelectAll = (isChecked) => {
        if (!isChecked) {
            setSelectedIds([])
            return
        }
        setSelectedIds(categoryIds)
    }

    const toggleOne = (id, isChecked) => {
        setSelectedIds((current) => {
            if (isChecked) {
                if (current.includes(id)) return current
                return [...current, id]
            }
            return current.filter((item) => item !== id)
        })
    }

    return (
        <section className="min-h-0 h-full p-1 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold">Categories</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        onClick={onClearUnused}
                    >
                        <span className="hidden sm:inline">Clear Unused</span>
                        <span className="sm:hidden">Clear</span>
                    </button>
                    <button
                        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                        onClick={onCreate}
                    >
                        <span className="hidden sm:inline">+ New Category</span>
                        <span className="sm:hidden">+ Category</span>
                    </button>
                </div>
            </div>
            {categories.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 px-1">
                        <label className="inline-flex items-center gap-2">
                            <input
                                ref={selectAllRef}
                                type="checkbox"
                                className="h-4 w-4"
                                checked={allSelected}
                                onChange={(e) => toggleSelectAll(e.target.checked)}
                            />
                            <span className="text-xs text-gray-600">
                                Select all {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
                            </span>
                        </label>
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => onDeleteMany?.(selectedIds)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                </svg>
                                Delete {selectedIds.length}
                            </button>
                        )}
                    </div>
                    {categories.map((category, index) => (
                        <article
                            key={category.id}
                            className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="pt-1">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={selectedIds.includes(category.id)}
                                        onChange={(e) => toggleOne(category.id, e.target.checked)}
                                        aria-label={`Select category ${category.name}`}
                                    />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                    <h3 className="text-sm font-semibold truncate">{category.name}</h3>
                                    <p className="text-xs text-gray-500">{getCategoryTypeLabel(category.type)}</p>
                                    <p className="text-xs text-gray-400 truncate">{category.description}</p>
                                    {Array.isArray(category.tags) && category.tags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {category.tags.map((tag) => (
                                                <span
                                                    key={`${category.id}-${tag}`}
                                                    className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="rounded-md p-2 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                    onClick={() => startEdit(category)}
                                    title="Edit category"
                                    aria-label="Edit category"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                    </svg>
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <h4 className="text-center text-gray-500">No categories found. Please add categories.</h4>
            )}

            <PopupModal
                isOpen={Boolean(editingId)}
                title="Edit category"
                onClose={cancelEdit}
                maxWidthClass="max-w-lg"
            >
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</span>
                        <input
                            type="text"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Category name"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                        <div className="relative">
                            <select
                                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700 outline-none focus:border-gray-500"
                                value={draftType}
                                onChange={(e) => setDraftType(e.target.value)}
                            >
                                <option value="">Select type</option>
                                {CATEGORY_TYPE_OPTIONS.map((typeOption) => (
                                    <option key={typeOption.value} value={typeOption.value}>
                                        {typeOption.label}
                                    </option>
                                ))}
                            </select>
                            <svg
                                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </div>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
                        <input
                            type="text"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            placeholder="Description"
                        />
                    </label>
                    <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <span>Tags</span>
                            <TagRulesHelp />
                        </span>
                        <TagsInput
                            value={draftTags}
                            onChange={setDraftTags}
                            options={tagOptions}
                            placeholder="Add tags for this category"
                            onDeleteOption={onDeleteTag}
                            deletingOption={deletingTag}
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const editingCategory = categories.find((cat) => cat.id === editingId)
                                if (editingCategory) {
                                    cancelEdit()
                                    onDelete?.(editingCategory)
                                }
                            }}
                            disabled={isSaving}
                            className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete category"
                            aria-label="Delete category"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                {isSaving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            </PopupModal>
        </section>
    )
}

export default CategoriesSection
