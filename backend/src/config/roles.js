export const PERMISSION_DEFINITIONS = [
  { key: "offices:read", group: "Offices", label: "Read offices" },
  { key: "offices:create", group: "Offices", label: "Create offices" },
  { key: "offices:update", group: "Offices", label: "Update offices" },
  { key: "offices:delete", group: "Offices", label: "Delete offices" },
  { key: "clients:read", group: "Clients", label: "Read clients" },
  { key: "clients:create", group: "Clients", label: "Create clients" },
  { key: "clients:update", group: "Clients", label: "Update clients" },
  { key: "clients:delete", group: "Clients", label: "Delete clients" },
  { key: "clientsOwnerInfo:read", group: "Clients", label: "View owner contact info" },
  { key: "clientsOwnerInfo:update", group: "Clients", label: "Edit owner contact info" },
  { key: "accounts:read", group: "Accounts", label: "Read accounts" },
  { key: "accounts:create", group: "Accounts", label: "Create accounts" },
  { key: "accounts:update", group: "Accounts", label: "Update accounts" },
  { key: "accounts:delete", group: "Accounts", label: "Delete accounts" },
  { key: "categories:read", group: "Categories", label: "Read categories" },
  { key: "categories:create", group: "Categories", label: "Create categories" },
  { key: "categories:update", group: "Categories", label: "Update categories" },
  { key: "categories:delete", group: "Categories", label: "Delete categories" },
  { key: "transactions:read", group: "Transactions", label: "Read transactions" },
  { key: "transactions:create", group: "Transactions", label: "Create transactions" },
  { key: "transactions:update", group: "Transactions", label: "Update transactions" },
  { key: "transactions:delete", group: "Transactions", label: "Delete transactions" },
  { key: "profitLoss:read", group: "Profit & Loss", label: "Read profit & loss" },
  { key: "userProfiles:read", group: "Employees", label: "Read employees" },
  { key: "userProfiles:create", group: "Employees", label: "Create employees" },
  { key: "userProfiles:update", group: "Employees", label: "Update employees" },
  { key: "userProfiles:delete", group: "Employees", label: "Delete employees" },
  { key: "roles:read", group: "Roles", label: "Read roles" },
  { key: "roles:create", group: "Roles", label: "Create roles" },
  { key: "roles:update", group: "Roles", label: "Update roles" },
  { key: "roles:delete", group: "Roles", label: "Delete roles" },
]

export const PERMISSION_KEYS = PERMISSION_DEFINITIONS.map((item) => item.key)

export const ROLE_DEFINITIONS = [
  {
    key: "viewer",
    label: "Viewer",
    description: "Can only view data. Cannot create, update or delete records.",
    permissions: [
      "offices:read",
      "clients:read",
      "clientsOwnerInfo:read",
      "accounts:read",
      "categories:read",
      "transactions:read",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
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
      "clientsOwnerInfo:read",
      "clientsOwnerInfo:update",
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
      "roles:read",
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
      "clientsOwnerInfo:*",
      "accounts:*",
      "categories:*",
      "transactions:*",
      "profitLoss:read",
      "userProfiles:read",
      "userProfiles:create",
      "userProfiles:update",
      "userProfiles:delete",
      "roles:*",
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

export const ROLE_LABELS = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.key, role.label])
)
