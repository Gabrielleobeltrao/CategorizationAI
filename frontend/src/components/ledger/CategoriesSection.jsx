function CategoriesSection({ categories, onCreate, onEdit, onDelete }) {
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
                    {categories.map((category, index) => (
                        <article
                            key={category.id}
                            className={`border border-gray-100 rounded-md p-2 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold truncate">{category.name}</h3>
                                    <p className="text-xs text-gray-500">{category.type}</p>
                                    <p className="text-xs text-gray-400 truncate">{category.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                        onClick={() => onEdit(category)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                        onClick={() => onDelete(category)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
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
