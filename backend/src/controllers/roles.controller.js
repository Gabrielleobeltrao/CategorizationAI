import {
  createCustomRoleService,
  deleteCustomRoleService,
  listPermissionsCatalogService,
  listRolesForOfficeService,
  updateCustomRoleService,
} from "../services/roles.service.js"

export async function listRolesController(req, res) {
  try {
    const officeId = String(req.query?.officeId || req.userProfile?.officeId || "").trim()
    const roles = await listRolesForOfficeService(officeId)
    return res.status(200).json(roles)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export function listPermissionsController(req, res) {
  const permissions = listPermissionsCatalogService()
  return res.status(200).json(permissions)
}

export async function createCustomRoleController(req, res) {
  try {
    const created = await createCustomRoleService(req.body, {
      actorOfficeId: req.userProfile?.officeId,
      actorEmail: req.user?.email,
    })
    return res.status(201).json(created)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function updateCustomRoleController(req, res) {
  try {
    const { id } = req.params
    const updated = await updateCustomRoleService(id, req.body, {
      actorOfficeId: req.userProfile?.officeId,
      actorEmail: req.user?.email,
    })
    return res.status(200).json(updated)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function deleteCustomRoleController(req, res) {
  try {
    const { id } = req.params
    const deleted = await deleteCustomRoleService(id, {
      actorOfficeId: req.userProfile?.officeId,
      actorEmail: req.user?.email,
    })
    return res.status(200).json(deleted)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
