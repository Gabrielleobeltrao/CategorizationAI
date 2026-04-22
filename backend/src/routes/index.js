import { Router } from "express"
import healthRoutes from "./health.routes.js"
import accountsRoutes from "./accounts.routes.js"
import clientsRoutes from "./clients.routes.js"
import officesRoutes from "./offices.routes.js"
import categoriesRoutes from "./categories.routes.js"
import transactionsRoutes from "./transactions.routes.js"
import userProfileRoutes from "./userProfile.routes.js"
import profitLossRoutes from "./profitLoss.routes.js"
import rolesRoutes from "./roles.routes.js"
import openTestRoutes from "./openTest.routes.js"
import categoryTemplatesRoutes from "./categoryTemplates.routes.js"

const router = Router()
router.use(healthRoutes)
router.use(openTestRoutes)
router.use(categoryTemplatesRoutes)
router.use(accountsRoutes)
router.use(clientsRoutes)
router.use(officesRoutes)
router.use(categoriesRoutes)
router.use(transactionsRoutes)
router.use(userProfileRoutes)
router.use(profitLossRoutes)
router.use(rolesRoutes)

export default router
