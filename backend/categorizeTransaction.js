import OpenAI from "openai"
import dotnet from "dotenv"

dotnet.config({ quiet: true })

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

async function categorizeTransaction(categories, transactions, business) {

    // helper functions to produce prompt text

    function promptCategories(categories) {

        return categories.map(c =>
            `name: ${c.name}, type: ${c.type}, description: ${c.description}`
        ).join("\n")
    }

    function promptTransactions(transactions) {

        return transactions.map(t =>
            `id: ${t.id}, description: ${t.description}, amount: ${t.amount}`
        ).join("\n")
    }

    function promptBusiness(business) {
        if (!business) {
            throw new Error("Business information is required for categorization")
        }


        const parts = []

        if (business.name) {
            parts.push(`You are an accountant who works for the ${business.name}`)
        } else {
            parts.push("You are an accountant")
        }

        if (business.businessType) {
            parts.push(`,the type ${business.businessType},`)
        }

        if (business.mainActivity) {
            parts.push(`,the main activity is ${business.mainActivity}`)
        }

        if (business.description) {
            parts.push(`,${business.description}`)
        }

        return parts.join("")

    }

    // main function

    const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            {
                role: "system",
                content: promptBusiness(business),
            },
            {
                role: "user",
                content: `
                    Available categories:
                    ${promptCategories(categories)}

                    Transaction list:
                    ${promptTransactions(transactions)}

                    For each transaction, return ONLY valid JSON in this format:
                    {
                    "results": [
                        {"id": 1, "category": ""}
                    ]
                    }

                    Rules:
                    - category must be exactly one of the available category names.
                    - if the transaction is unclear or no category applies, set category to "".
                `
            }
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "categorization",
                schema: {
                    type: "object",
                    properties: {
                        results: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "number" },
                                    category: { type: "string" },
                                },
                                required: ["id", "category"]
                            }
                        }
                    },
                    required: ["results"]
                }
            }
        }
    })

    const responseAI = response.choices[0].message

    try {
        const parsed = JSON.parse(responseAI.content)
        const results = parsed.results
        const allowedCategories = new Set(categories.map(c => c.name))

        // update transactions with categories

        for (const item of results) {
            const tx = transactions.find(t => t.id === item.id)
            if (tx) {
                tx.category = allowedCategories.has(item.category) ? item.category : ""
            }
        }


        return results
    } catch (e) {
        console.error("Falha ao analisar a resposta:", responseAI)
        throw e
    }

}

export default categorizeTransaction
