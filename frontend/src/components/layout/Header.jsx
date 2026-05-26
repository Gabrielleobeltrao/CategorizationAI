function Header({ onOpenNav }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          {onOpenNav && (
            <button
              type="button"
              onClick={onOpenNav}
              className="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </svg>
            </button>
          )}
          <h1 className="text-base font-bold sm:text-lg">CategorizationAI</h1>
        </div>
      </div>
    </header>
  )
}

export default Header
