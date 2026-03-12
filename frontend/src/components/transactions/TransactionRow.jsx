function TransactionRow({ index, categories, id, date, description, account, category, amount }) {
    return (
        <div className={`grid grid-cols-[min-content_0.5fr_2fr_0.75fr_1.5fr_0.5fr] items-center gap-4 px-2 py-3 text-sm ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
            <input className="self-center" type="checkbox" />
            <h4 className="break-all">{date.split("-").reverse().join("/")}</h4>
            <h4 className="line-clamp-2">{description}</h4>
            <h4>{account}</h4>
            <div className="relative w-full">
                <select className="w-full p-2 pl-3 rounded-full border-3 border-gray-100 bg-white appearance-none" value={category}>
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                            {c.name}
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
            <h4>${amount.toFixed(2)}</h4>
        </div>
    )
}

export default TransactionRow
