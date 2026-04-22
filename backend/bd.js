const business = {
        id: 1,
        name: "VB CORP",
        businessType: "1120",
        description: "he works with construction and paninting",
        mainActivity: "construction",
        state: "florida",
    }

const categories = [
    {
        id: 1,
        name: "Supplies",
        type: "cost of goods sold",
        description: "This category includes expenses related to the purchase of materials, products,used in the production or delivery of goods or services. examples like home depot.",
    },
    {
        id: 2,
        name: "office supplies",
        type: "operating expenses",
        description: "This category includes expenses related at office expenses, such as paper, pens, printer ink, and other items used in the day-to-day operations of a businesss. examples include staples and office depot.",
    },
    {
        id: 3,
        name: "advertising",
        type: "operating expenses",
        description: "This category includes every expense related to promoting a business's products or services. examples include television commercials and online ads examples google ads.",
    },
]

const transactions = [
    {
        id: 1,
        date: "2026-03-01",
        amount: 80.40,
        description: "THE HOME DEPOT 05/07 #000047401 PURCHASE THE HOME DEPOT #6DELRAY BEACH FL",
        category: "",
    },
    {
        id: 2,
        date: "2026-03-01",
        amount: 53.90,
        description: "PURCHASE 1114 AFTERPAY 8552896014CA",
        category: "",
    },
    {
        id: 3,
        date: "2026-03-03",
        amount: 63.60,
        description: "NST #000634101 06/27 PURCHASE 9820 GLADES THE D HOME RD BOCA RATON FL",
        category: "",
    },
    {
        id: 4,
        date: "2026-03-02",
        amount: 123.70,
        description: "CHECKCARD 0116 AMAZON.COM*R85 SEATTLE WA 4816 XXXXXXXXXXXX0611 CKCD XXXX XXXX XXXX 0611",
        category: "",
    },
    {
        id: 5,
        date: "2026-03-06",
        amount: 93.20,
        description: "PURCHASE 0225 US*RW02 Mktp 8662161072WA AMZN",
        category: "",
    },
    {
        id: 6,
        date: "2026-03-06",
        amount: 13.50,
        description: "PURCHASE 0225 google ads",
        category: "",
    },
    {
        id: 7,
        date: "2026-03-08",
        amount: 37.80,
        description: "POS Purchase Dollartree Fort Myers Fl POS70839001",
        category: "",
    },
    {
        id: 8,
        date: "2026-03-09",
        amount: 117.20,
        description: "CHECKCARD 0601 BeachFL 55432864154207804788178 Pompano *EZ CREATIVE C SQ CKCD 5499 XXXXXXXXXXXX2785 XXXX XXXX XXXX ",
        category: "",
    },
    {
        id: 9,
        date: "2026-03-10",
        amount: 41.90,
        description: "NST #000634257 06/27 PURCHASE 9820 GLADES OFFICE DPOT RD BOCA RATON FL",
        category: "",
    },
]

export default {business, categories, transactions}