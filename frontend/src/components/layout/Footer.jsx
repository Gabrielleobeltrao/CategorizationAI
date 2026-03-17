function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-4 text-sm text-gray-500">
        {year} CategorizationAI
      </div>
    </footer>
  )
}

export default Footer
