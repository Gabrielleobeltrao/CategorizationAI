import categorizeTransaction from "./categorizeTransaction.js"
import bd from "./bd.js"

async function main() {
    const result = await categorizeTransaction(bd.categories, bd.transactions, bd.business)
    console.log("Resultado da IA:",result)
    console.log("Transacoes atualizadas:", bd.transactions)
}

main().catch(console.error)