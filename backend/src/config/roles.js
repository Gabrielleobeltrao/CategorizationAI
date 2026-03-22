export const ROLE_DEFINITIONS = [
  {
    key: "viewer",
    label: "Viewer",
    description: "Can only view data. Cannot create, update or delete records.",
    permissions: [
      "offices:read",
      "clients:read",
      "accounts:read",
      "categories:read",
      "transactions:read",
      "profitLoss:read",
      "userProfiles:read",
    ],
  },
  {
    key: "staff",
    label: "Staff",
    description: "Can manage operational data, but cannot manage office settings or full team permissions.",
    permissions: [
      "offices:read",
      "clients:read",
      "clients:create",
      "clients:update",
      "accounts:read",
      "accounts:create",
      "accounts:update",
      "categories:read",
      "categories:create",
      "categories:update",
      "transactions:read",
      "transactions:create",
      "transactions:update",
      "profitLoss:read",
      "userProfiles:read",
    ],
  },
  {
    key: "manager",
    label: "Manager",
    description: "Can manage most accounting operations and employee profiles, except owner-level full control.",
    permissions: [
      "offices:read",
      "offices:update",
      "clients:*",
      "accounts:*",
      "categories:*",
      "transactions:*",
      "profitLoss:read",
      "userProfiles:read",
      "userProfiles:create",
      "userProfiles:update",
    ],
  },
  {
    key: "owner",
    label: "Owner",
    description: "Full access to all resources and actions.",
    permissions: ["*"],
  },
]

export const ROLE_PERMISSIONS = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.key, role.permissions])
)

