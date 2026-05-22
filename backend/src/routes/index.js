import { Router } from "express"
import healthRoutes from "./health.routes.js"
import accountsRoutes from "./accounts.routes.js"
import clientsRoutes from "./clients.routes.js"
import officesRoutes from "./offices.routes.js"
import categoriesRoutes from "./categories.routes.js"
import transactionsRoutes from "./transactions.routes.js"
import journalEntriesRoutes from "./journalEntries.routes.js"
import userProfileRoutes from "./userProfile.routes.js"
import profitLossRoutes from "./profitLoss.routes.js"
import accountBalancesRoutes from "./accountBalances.routes.js"
import balanceSheetRoutes from "./balanceSheet.routes.js"
import chartOfAccountsRoutes from "./chartOfAccounts.routes.js"
import trialBalanceRoutes from "./trialBalance.routes.js"
import rolesRoutes from "./roles.routes.js"
import openTestRoutes from "./openTest.routes.js"
import categoryTemplatesRoutes from "./categoryTemplates.routes.js"
import registrationRoutes from "./registration.routes.js"
import appRoutes from "./app.routes.js"
import tasksRoutes from "./tasks.routes.js"
import boardRoutes from "./board.routes.js"
import reconciliationRoutes from "./reconciliation.routes.js"
import generalLedgerRoutes from "./generalLedger.routes.js"
import periodCloseRoutes from "./periodClose.routes.js"
import recurringRoutes from "./recurring.routes.js"
import onboardingRoutes from "./onboarding.routes.js"

const router = Router()
router.use(healthRoutes)
router.use(appRoutes)
router.use(openTestRoutes)
router.use(registrationRoutes)
router.use(categoryTemplatesRoutes)
router.use(accountsRoutes)
router.use(clientsRoutes)
router.use(officesRoutes)
router.use(categoriesRoutes)
router.use(transactionsRoutes)
router.use(journalEntriesRoutes)
router.use(userProfileRoutes)
router.use(profitLossRoutes)
router.use(accountBalancesRoutes)
router.use(balanceSheetRoutes)
router.use(chartOfAccountsRoutes)
router.use(trialBalanceRoutes)
router.use(rolesRoutes)
router.use(tasksRoutes)
router.use(boardRoutes)
router.use(reconciliationRoutes)
router.use(generalLedgerRoutes)
router.use(periodCloseRoutes)
router.use(recurringRoutes)
router.use(onboardingRoutes)

export default router
