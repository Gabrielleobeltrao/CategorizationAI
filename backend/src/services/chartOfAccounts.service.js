import { getChartOfAccountsByClientId } from "../repositories/chartOfAccounts.repository.js"
import {
  createCoaPresetTemplate,
  listCoaPresetTemplatesByOfficeId,
  getCoaPresetTemplateById,
  deleteCoaPresetTemplateById,
} from "../repositories/coaPresetTemplate.repository.js"
import { getDB } from "../db.js"
import { AppError } from "../utils/appError.js"
import { getPresetById, listPresetSummaries } from "../config/coaPresets.js"

const GROUPS = [
  { id: "asset_current", label: "Current Assets", parent: "asset" },
  { id: "asset_noncurrent", label: "Non-current Assets", parent: "asset" },
  { id: "liability_current", label: "Current Liabilities", parent: "liability" },
  { id: "liability_noncurrent", label: "Non-current Liabilities", parent: "liability" },
  { id: "equity", label: "Equity", parent: "equity" },
  { id: "income", label: "Income", parent: "income" },
  { id: "cost_of_goods_sold", label: "Cost of Goods Sold", parent: "expense" },
  { id: "operating_expense", label: "Operating Expenses", parent: "expense" },
  { id: "other_income", label: "Other Income", parent: "income" },
  { id: "other_expense", label: "Other Expense", parent: "expense" },
  { id: "tax_expense", label: "Tax Expense", parent: "expense" },
  { id: "uncategorized", label: "Uncategorized", parent: "other" },
]

const PARENT_LABELS = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
  other: "Other",
}

export async function getChartOfAccountsService({ clientId }) {
  if (!clientId) throw new AppError("clientId is required", 400)

  const rows = await getChartOfAccountsByClientId({ clientId })

  const groupsMap = new Map(GROUPS.map((group) => [group.id, { ...group, items: [] }]))
  for (const row of rows) {
    const bucket = groupsMap.get(row.accountType) || groupsMap.get("uncategorized")
    bucket.items.push(row)
  }

  const groups = GROUPS
    .map((group) => groupsMap.get(group.id))
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const items = [...group.items].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      )
      const total = items.reduce((sum, item) => sum + Number(item.balance || 0), 0)
      return {
        id: group.id,
        label: group.label,
        parent: group.parent,
        parentLabel: PARENT_LABELS[group.parent] || "",
        items,
        total,
      }
    })

  return { groups }
}

export async function listCoaPresetsService({ officeId } = {}) {
  const builtIn = listPresetSummaries().map((p) => ({ ...p, source: "builtin" }))
  const customDocs = officeId ? await listCoaPresetTemplatesByOfficeId(officeId) : []
  const custom = customDocs.map((doc) => ({
    id: `custom:${String(doc._id)}`,
    label: doc.name,
    description: doc.description || "Custom preset",
    accountCount: Array.isArray(doc.accounts) ? doc.accounts.length : 0,
    source: "custom",
  }))
  return { presets: [...custom, ...builtIn] }
}

async function _resolvePreset(presetId, officeId) {
  // Custom presets are passed as `custom:<objectId>` to keep IDs flat.
  if (typeof presetId === "string" && presetId.startsWith("custom:")) {
    const id = presetId.slice("custom:".length)
    const doc = await getCoaPresetTemplateById(id)
    if (!doc) return null
    if (officeId && String(doc.officeId) !== String(officeId)) return null
    return {
      id: presetId,
      label: doc.name,
      description: doc.description || "",
      accounts: doc.accounts || [],
    }
  }
  return getPresetById(presetId)
}

// Inserts every account from the preset into coa_accounts for the
// client. Skips names that already exist (case-insensitive) so the
// operation is safe to retry. Suspense account is not touched.
export async function applyCoaPresetService({ clientId, presetId, officeId }) {
  if (!clientId) throw new AppError("clientId is required", 400)
  if (!presetId) throw new AppError("presetId is required", 400)

  const preset = await _resolvePreset(presetId, officeId)
  if (!preset) throw new AppError(`Unknown preset "${presetId}"`, 400)

  const db = getDB()
  const existing = await db
    .collection("coa_accounts")
    .find({ clientId: String(clientId) }, { projection: { name: 1 } })
    .toArray()
  const existingNames = new Set(existing.map((a) => String(a.name || "").toLowerCase()))

  const toInsert = preset.accounts
    .filter((a) => !existingNames.has(a.name.toLowerCase()))
    .map((a) => ({
      clientId: String(clientId),
      name: a.name,
      accountType: a.accountType,
      description: a.description || "",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

  if (toInsert.length === 0) {
    return { presetId, insertedCount: 0, skippedCount: preset.accounts.length }
  }

  await db.collection("coa_accounts").insertMany(toInsert)
  return {
    presetId,
    insertedCount: toInsert.length,
    skippedCount: preset.accounts.length - toInsert.length,
  }
}

export async function createCustomCoaPresetService({ officeId, name, description, accounts, createdBy }) {
  if (!officeId) throw new AppError("officeId is required", 400)
  if (!name) throw new AppError("name is required", 400)
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new AppError("at least one account is required", 400)
  }
  try {
    const doc = await createCoaPresetTemplate({ officeId, name, description, accounts, createdBy })
    return {
      id: `custom:${String(doc._id)}`,
      label: doc.name,
      description: doc.description,
      accountCount: doc.accounts.length,
      source: "custom",
    }
  } catch (err) {
    throw new AppError(err.message || "Failed to create preset", 400)
  }
}

export async function deleteCustomCoaPresetService({ id, officeId }) {
  const safeId = String(id || "").trim()
  if (!safeId) throw new AppError("id is required", 400)
  const doc = await getCoaPresetTemplateById(safeId)
  if (!doc) return { deletedCount: 0 }
  if (officeId && String(doc.officeId) !== String(officeId)) {
    throw new AppError("Not allowed", 403)
  }
  return deleteCoaPresetTemplateById(safeId)
}
