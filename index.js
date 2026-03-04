import categorizeTransaction from "./categorizeTransaction"
import { business, categories, transactions } from "./bd"

async function mani() {
    const result = await categorizeTransaction(categories, transactions, business)
    console.log("Resultado da IA:",result)
    console.log("Transacoes atualizadas:", db.transactions)
}

mani().catch(console.error)