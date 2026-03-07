require("dotenv").config()
const app = require("./app")
const { connectDB } = require("./bd")

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

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`)
})