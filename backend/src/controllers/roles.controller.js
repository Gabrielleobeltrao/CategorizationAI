import { ROLE_DEFINITIONS } from "../config/roles.js"

export function listRolesController(req, res) {
  const roles = ROLE_DEFINITIONS.map((role) => ({
    key: role.key,
    label: role.label,
    description: role.description,
    permissions: role.permissions,
  }))

  return res.status(200).json(roles)
}

