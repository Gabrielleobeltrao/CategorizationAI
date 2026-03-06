import AccordionCategory from "../components/AccordionCategory"

const categories = [
    {
        id: 1,
        name: "Supplies",
        type: "Cost of goods sold",
        description: "This category includes expenses related to the purchase of materials, products, used in the production or delivery of goods or services. examples like home depot.",
    },
    {
        id: 2,
        name: "Office supplies",
        type: "Operating expenses",
        description: "This category includes expenses related at office expenses, such as paper, pens, printer ink, and other items used in the day-to-day operations of a businesss. examples include staples and office depot.",
    },
    {
        id: 3,
        name: "Advertising",
        type: "Operating expenses",
        description: "This category includes every expense related to promoting a business's products or services. examples include television commercials and online ads examples google ads.",
    },
]

function Transactions() {
    return (
        <section className="h-dvh grid grid-cols-8 p-4">
            <div className="h-full w-full col-span-6 p-4 border-r-4 border-gray-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Transactions</h2>
                    <button className="text-base font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        Upload Transactions
                    </button>
                </div>
                <div>
                    
                </div>
            </div>
            <div className="h-full w-full col-span-2 p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Categories</h2>
                    <button className="text-base font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        New Category
                    </button>
                </div>
                <div className="flex flex-col gap-4">
                    {categories.map((category) => (
                        <AccordionCategory
                            key={category.id}
                            id={category.id}
                            name={category.name}
                            type={category.type}
                            description={category.description}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Transactions