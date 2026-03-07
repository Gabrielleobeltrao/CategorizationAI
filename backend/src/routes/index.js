const express = require("express")
const router = express.Router()

const healthRoutes = require("./health.routes")

router.use(healthRoutes)

module.exports = router