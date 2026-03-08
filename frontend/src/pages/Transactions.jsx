import AccordionCategory from "../components/categories/AccordionCategory"
import TransactionsTable from "../components/transactions/TransactionsTable"

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

const transactions = [
    {
        id: 1,
        date: "2026-03-01",
        amount: 80.40,
        description: "THE HOME DEPOT 05/07 #000047401 PURCHASE THE HOME DEPOT #6DELRAY BEACH FL",
        account: "Chase Business Checking",
        category: "Supplies",
    },
    {
        id: 2,
        date: "2026-03-01",
        amount: 53.90,
        description: "PURCHASE 1114 AFTERPAY 8552896014CA",
        account: "Chase Business Checking",
        category: "Supplies",
    },
    {
        id: 3,
        date: "2026-03-03",
        amount: 63.60,
        description: "NST #000634101 06/27 PURCHASE 9820 GLADES THE D HOME RD BOCA RATON FL",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 4,
        date: "2026-03-02",
        amount: 123.70,
        description: "CHECKCARD 0116 AMAZON.COM*R85 SEATTLE WA 4816 XXXXXXXXXXXX0611 CKCD XXXX XXXX XXXX 0611",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 5,
        date: "2026-03-06",
        amount: 93.20,
        description: "PURCHASE 0225 US*RW02 Mktp 8662161072WA AMZN",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 6,
        date: "2026-03-06",
        amount: 13.50,
        description: "PURCHASE 0225 google ads",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 7,
        date: "2026-03-08",
        amount: 37.80,
        description: "POS Purchase Dollartree Fort Myers Fl POS70839001",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 8,
        date: "2026-03-09",
        amount: 117.20,
        description: "CHECKCARD 0601 BeachFL 55432864154207804788178 Pompano *EZ CREATIVE C SQ CKCD 5499 XXXXXXXXXXXX2785 XXXX XXXX XXXX ",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 9,
        date: "2026-03-10",
        amount: 41.90,
        description: "NST #000634257 06/27 PURCHASE 9820 GLADES OFFICE DPOT RD BOCA RATON FL",
        account: "Chase Business Checking",
        category: "Supplies",
    },
    {
        id: 10,
        date: "2026-03-01",
        amount: 80.40,
        description: "THE HOME DEPOT 05/07 #000047401 PURCHASE THE HOME DEPOT #6DELRAY BEACH FL",
        account: "Chase Business Checking",
        category: "Supplies",
    },
    {
        id: 11,
        date: "2026-03-01",
        amount: 53.90,
        description: "PURCHASE 1114 AFTERPAY 8552896014CA",
        account: "Chase Business Checking",
        category: "Supplies",
    },
    {
        id: 12,
        date: "2026-03-03",
        amount: 63.60,
        description: "NST #000634101 06/27 PURCHASE 9820 GLADES THE D HOME RD BOCA RATON FL",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 13,
        date: "2026-03-02",
        amount: 123.70,
        description: "CHECKCARD 0116 AMAZON.COM*R85 SEATTLE WA 4816 XXXXXXXXXXXX0611 CKCD XXXX XXXX XXXX 0611",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 14,
        date: "2026-03-06",
        amount: 93.20,
        description: "PURCHASE 0225 US*RW02 Mktp 8662161072WA AMZN",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 15,
        date: "2026-03-06",
        amount: 13.50,
        description: "PURCHASE 0225 google ads",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 16,
        date: "2026-03-08",
        amount: 37.80,
        description: "POS Purchase Dollartree Fort Myers Fl POS70839001",
        account: "Chase Business Checking",
        category: "",
    },
    {
        id: 17,
        date: "2026-03-09",
        amount: 117.20,
        description: "CHECKCARD 0601 BeachFL 55432864154207804788178 Pompano *EZ CREATIVE C SQ CKCD 5499 XXXXXXXXXXXX2785 XXXX XXXX XXXX ",
        account: "Chase Business Checking",
        category: "Advertising",
    },
    {
        id: 18,
        date: "2026-03-10",
        amount: 41.90,
        description: "NST #000634257 06/27 PURCHASE 9820 GLADES OFFICE DPOT RD BOCA RATON FL",
        account: "Chase Business Checking",
        category: "Supplies",
    },
]

function Transactions() {
    return (
        <section className="h-screen box-border grid grid-cols-8 p-4 overflow-hidden">
            <div className="h-full min-h-0 w-full col-span-6 p-4 border-r-4 border-gray-200 flex flex-col">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Transactions</h2>
                    <button className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        Upload Transactions
                    </button>
                </div>
                <div className="pt-8 min-h-0 flex-1">
                    {transactions.length > 0 ? (
                        <TransactionsTable
                            transactions={transactions}
                        />
                    ) : (
                        <h4 className="text-center text-gray-500">No transactions found. Please upload your transactions to get started.</h4>
                    )}
                </div>
            </div>
            <div className="h-full w-full col-span-2 p-4 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Categories</h2>
                    <button className="text-sm font-bold text-white bg-gray-400 rounded-md px-4 py-2">
                        New Category
                    </button>
                </div>
                {categories.length > 0 ? (
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
                ) : (
                    <h4 className="text-center text-gray-500">No categories found. Please add categories.</h4>
                )}
            </div>
        </section>
    )
}

export default Transactions
