import dotenv from "dotenv"
import app from "./app.js"
import { connectDB } from "./bd.js"

dotenv.config()

const PORT = process.env.PORT || 3001

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`API running on port ${PORT}`)
        })
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err)
        process.exit(1)
    })