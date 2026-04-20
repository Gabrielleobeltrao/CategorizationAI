import { useEffect, useMemo, useRef, useState } from "react"
import TagsInput from "../ui/TagsInput"
import TagRulesHelp from "../ui/TagRulesHelp"
import { CATEGORY_TYPE_OPTIONS, getCategoryTypeLabel, normalizeCategoryType } from "../../constants/categoryTypes"

function CategoriesSection({
    categories,
    onCreate,
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
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Categories</h3>
                <button
                    className="text-xs font-bold text-white bg-gray-700 rounded-md px-3 py-2"
                    onClick={onCreate}
                >
                    New Category
                </button>
            </div>
            {categories.length > 0 ? (
                <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
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
                    </div>
                    {categories.map((category, index) => (
                        <article
                            key={category.id}
                            className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                        >
                            {editingId === category.id ? (
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1 flex flex-col gap-2">
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-500"
                                            value={draftName}
                                            onChange={(e) => setDraftName(e.target.value)}
                                            placeholder="Category name"
                                        />
                                        <div className="relative w-full">
                                            <select
                                                className="w-full rounded-full border-3 border-gray-100 bg-white p-2 pl-3 pr-8 text-sm text-gray-700 appearance-none outline-none"
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
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-500"
                                            value={draftDescription}
                                            onChange={(e) => setDraftDescription(e.target.value)}
                                            placeholder="Description"
                                        />
                                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <span>Tags</span>
                                            <TagRulesHelp />
                                        </div>
                                        <TagsInput
                                            value={draftTags}
                                            onChange={setDraftTags}
                                            options={tagOptions}
                                            placeholder="Add tags for this category"
                                            onDeleteOption={onDeleteTag}
                                            deletingOption={deletingTag}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-emerald-700 disabled:opacity-50"
                                            onClick={saveEdit}
                                            disabled={isSaving}
                                            title="Save category"
                                            aria-label="Save category"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m20 6-11 11-5-5" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                                            onClick={cancelEdit}
                                            disabled={isSaving}
                                            title="Cancel edit"
                                            aria-label="Cancel edit"
                                        >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 6 6 18" />
                                                <path d="m6 6 12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
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
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-sky-700"
                                        onClick={() => startEdit(category)}
                                        title="Edit category"
                                        aria-label="Edit category"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-rose-600"
                                        onClick={() => {
                                            if (selectedIds.includes(category.id) && selectedIds.length > 0) {
                                                onDeleteMany?.(selectedIds)
                                                return
                                            }
                                            onDelete(category)
                                        }}
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
                                </div>
                            </div>
                            )}
                        </article>
                    ))}
                </div>
            ) : (
                <h4 className="text-center text-gray-500">No categories found. Please add categories.</h4>
            )}
        </section>
    )
}

export default CategoriesSection
