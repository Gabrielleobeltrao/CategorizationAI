import { useState } from "react"

function AccordionCategory({ id, name, type, description }) {

    const [edit, setEdit] = useState(false)

    return (
        <form 
            className="w-full flex flex-col border-b-2 border-gray-200 pb-1"
        >
            <div
                className="flex items-center justify-between gap-4"
            >
                {edit ?
                    <input
                        className="w-full font-semibold bg-gray-100 p-2 rounded-md"
                        type="text"
                        placeholder="Enter category name"
                        value={name}
                    />
                    :
                    <h3
                        className="text-base font-semibold"
                        onClick={() => setEdit(true)}
                    >
                        {name}
                    </h3>
                }
                <span
                    onClick={() => setEdit(!edit)}
                >
                    {edit ?
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 15l6-6 6 6" />
                        </svg>
                        :
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    }
                </span>
            </div>
            {edit && (
                <div className="flex flex-col gap-4 pt-4">
                    <div className="relative w-full">
                        <select
                            className="w-full p-2 rounded-md bg-gray-100 appearance-none"
                            value={type}
                        >
                            <option value="cost of goods sold">Cost of Goods Sold</option>
                            <option value="operating expenses">Operating Expenses</option>
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
                    <textarea
                        className="bg-gray-100 p-2 rounded-md"
                        placeholder="Enter category description"
                        onInput={(e) => {
                            e.target.style.height = "auto"
                            e.target.style.height = `${e.target.scrollHeight}px`
                        }}
                        value={description}
                    />
                    <div className="w-full flex items-center gap-4 pb-4">
                        <button
                            className="w-full py-1 bg-gray-400 text-white rounded-md"
                            type="submit"
                        >
                            Save
                        </button>
                        <span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                            </svg>

                        </span>
                    </div>
                </div>
            )}
        </form>
    )
}

export default AccordionCategory