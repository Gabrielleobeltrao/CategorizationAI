import { Router } from "express"
import healthRoutes from "./health.routes.js"
import accountsRoutes from "./accounts.routes.js"
import clientsRoutes from "./clients.routes.js"
import officesRoutes from "./offices.routes.js"
import categoriesRoutes from "./categories.routes.js"
import transactionsRoutes from "./transactions.routes.js"
import userProfileRoutes from "./userProfile.routes.js"

const router = Router()
router.use(healthRoutes)
router.use(accountsRoutes)
router.use(clientsRoutes)
router.use(officesRoutes)
router.use(categoriesRoutes)
router.use(transactionsRoutes)
router.use(userProfileRoutes)

export default router
