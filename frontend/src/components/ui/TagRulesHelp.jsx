import { useEffect, useRef, useState } from "react"

const TAG_RULES = [
  "Tags connect clients and global categories.",
  "Matching tags can add categories to a client automatically.",
  "Removing a tag can stop that automatic connection.",
  "Categories already used in transactions stay available.",
  "Deleting a tag removes it across the office.",
]

function TagRulesHelp() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
        aria-label="Tag rules"
        title="Tag rules"
        onClick={() => setIsOpen((current) => !current)}
      >
        ?
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[160] w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            Tag rules
          </p>
          <div className="mt-2 h-px bg-gray-100" />
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-5 text-gray-600">
            {TAG_RULES.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  )
}

export default TagRulesHelp
