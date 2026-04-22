import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

function normalizeTag(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function getPopupPosition(anchorElement, popupElement) {
  if (!anchorElement || typeof window === "undefined") {
    return {
      top: 16,
      left: 16,
      width: 360,
    }
  }

  const padding = 16
  const rect = anchorElement.getBoundingClientRect()
  const popupRect = popupElement?.getBoundingClientRect?.()
  const width = Math.max(320, Math.round(rect.width))
  const popupHeight = Math.round(popupRect?.height || 360)
  const spaceBelow = window.innerHeight - rect.bottom - padding
  const spaceAbove = rect.top - padding
  const shouldOpenAbove = spaceBelow < Math.min(popupHeight, 260) && spaceAbove > spaceBelow

  const top = shouldOpenAbove
    ? Math.max(padding, rect.top - popupHeight - 8)
    : Math.min(window.innerHeight - popupHeight - padding, rect.bottom + 8)

  const left = Math.min(
    Math.max(padding, rect.left),
    window.innerWidth - width - padding
  )

  return {
    top,
    left,
    width,
  }
}

function TagsInput({
  value = [],
  onChange,
  options = [],
  placeholder = "Select tags",
  disabled = false,
  onDeleteOption,
  deletingOption = "",
}) {
  const anchorRef = useRef(null)
  const popupRef = useRef(null)
  const searchInputRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [localOptions, setLocalOptions] = useState([])
  const [popupPosition, setPopupPosition] = useState({
    top: 16,
    left: 16,
    width: 360,
  })

  const tags = useMemo(
    () => (Array.isArray(value) ? value.map((item) => normalizeTag(item)).filter(Boolean) : []),
    [value]
  )

  const normalizedOptions = useMemo(
    () => (Array.isArray(options) ? options.map((item) => normalizeTag(item)).filter(Boolean) : []),
    [options]
  )

  const availableOptions = useMemo(() => {
    const unique = new Set([...normalizedOptions, ...localOptions, ...tags])
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [localOptions, normalizedOptions, tags])

  const filteredOptions = useMemo(() => {
    const safeSearch = normalizeTag(searchTerm)
    const baseOptions = safeSearch
      ? availableOptions.filter((tag) => tag.includes(safeSearch))
      : availableOptions

    const selected = baseOptions.filter((tag) => tags.includes(tag))
    const unselected = baseOptions.filter((tag) => !tags.includes(tag))

    return [...selected, ...unselected]
  }, [availableOptions, searchTerm])

  const normalizedDraftTag = useMemo(() => normalizeTag(searchTerm), [searchTerm])
  const canCreateTag = Boolean(
    normalizedDraftTag &&
    !availableOptions.includes(normalizedDraftTag)
  )

  const updatePopupPosition = useCallback(() => {
    setPopupPosition(getPopupPosition(anchorRef.current, popupRef.current))
  }, [])

  const commitCreateTag = useCallback((rawValue) => {
    const nextTag = normalizeTag(rawValue)
    if (!nextTag) return

    setLocalOptions((current) => (
      current.includes(nextTag) ? current : [...current, nextTag]
    ))

    onChange?.(
      tags.includes(nextTag)
        ? tags
        : [...tags, nextTag]
    )

    setSearchTerm("")
  }, [onChange, tags])

  const toggleTag = useCallback((targetTag) => {
    if (!targetTag) return

    if (tags.includes(targetTag)) {
      onChange?.(tags.filter((tag) => tag !== targetTag))
      return
    }

    onChange?.([...tags, targetTag])
  }, [onChange, tags])

  const removeTag = useCallback((targetTag) => {
    onChange?.(tags.filter((tag) => tag !== targetTag))
  }, [onChange, tags])

  const handleDeleteOption = useCallback(async (targetTag) => {
    if (!onDeleteOption || !targetTag) return

    await onDeleteOption(targetTag)
    if (tags.includes(targetTag)) {
      onChange?.(tags.filter((tag) => tag !== targetTag))
    }
    setLocalOptions((current) => current.filter((tag) => tag !== targetTag))
  }, [onChange, onDeleteOption, tags])

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (
        anchorRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return
      }

      setIsOpen(false)
    }

    const handleResize = () => updatePopupPosition()
    const handleScroll = () => updatePopupPosition()

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleScroll, true)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [isOpen, updatePopupPosition])

  useEffect(() => {
    if (!isOpen) return
    updatePopupPosition()

    const timeoutId = window.setTimeout(() => {
      updatePopupPosition()
      searchInputRef.current?.focus()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, updatePopupPosition])

  useEffect(() => {
    if (!disabled) return undefined
    setIsOpen(false)
    return undefined
  }, [disabled])

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === "Enter") {
      event.preventDefault()
      if (canCreateTag) {
        commitCreateTag(searchTerm)
      }
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left transition ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-gray-300 hover:bg-white"} ${isOpen ? "border-gray-400 bg-white" : ""}`}
        onClick={() => {
          if (disabled) return
          setIsOpen((current) => !current)
        }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                <span className="truncate">{tag}</span>
                {!disabled && (
                  <span
                    role="button"
                    tabIndex={-1}
                    className="text-gray-400 transition hover:text-gray-700"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeTag(tag)
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </span>
                )}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">{placeholder}</span>
          )}
        </div>

        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              className="fixed z-[140] rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/5"
              style={{
                top: `${popupPosition.top}px`,
                left: `${popupPosition.left}px`,
                width: `${popupPosition.width}px`,
              }}
            >
              <div className="flex flex-col">
                <div className="px-4 pt-4">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search tags"
                    className="w-full rounded-full border-2 border-gray-100 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-300"
                  />
                </div>

                <div className="mt-3 border-t border-gray-100" />

                <div className="max-h-56 overflow-y-auto px-2 py-2">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((tag) => {
                      const isSelected = tags.includes(tag)

                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${isSelected ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                          onClick={() => toggleTag(tag)}
                        >
                          <span className="min-w-0 flex-1 truncate">{tag}</span>
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m20 6-11 11-5-5" />
                              </svg>
                            ) : null}
                            {onDeleteOption ? (
                              <span
                                role="button"
                                tabIndex={-1}
                                className={`rounded-md p-1 transition ${isSelected ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-gray-400 hover:bg-gray-200 hover:text-rose-600"} ${deletingOption === tag ? "pointer-events-none opacity-50" : ""}`}
                                onClick={async (event) => {
                                  event.stopPropagation()
                                  await handleDeleteOption(tag)
                                }}
                                title={`Delete tag ${tag}`}
                                aria-label={`Delete tag ${tag}`}
                              >
                                {deletingOption === tag ? (
                                  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                  </svg>
                                )}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-3 py-3 text-sm text-gray-400">
                      No tags found
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 px-3 py-3">
                  <button
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-medium transition ${canCreateTag ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-100" : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"}`}
                    onClick={() => {
                      if (!canCreateTag) return
                      commitCreateTag(searchTerm)
                    }}
                    disabled={!canCreateTag}
                  >
                    {canCreateTag ? `Create tag "${normalizedDraftTag}"` : "Create new tag"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export default TagsInput
