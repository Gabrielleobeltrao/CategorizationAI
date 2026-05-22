export const PERMISSION_DEFINITIONS = [
  // General — office-wide settings, team management, observability.
  { key: "offices:read", module: "General", group: "Office settings", label: "Read office settings" },
  { key: "offices:create", module: "General", group: "Office settings", label: "Create offices" },
  { key: "offices:update", module: "General", group: "Office settings", label: "Update office settings" },
  { key: "offices:delete", module: "General", group: "Office settings", label: "Delete offices" },
  { key: "userProfiles:read", module: "General", group: "Employees", label: "Read employees" },
  { key: "userProfiles:create", module: "General", group: "Employees", label: "Create employees" },
  { key: "userProfiles:update", module: "General", group: "Employees", label: "Update employees" },
  { key: "userProfiles:delete", module: "General", group: "Employees", label: "Delete employees" },
  { key: "roles:read", module: "General", group: "Roles", label: "Read roles" },
  { key: "roles:create", module: "General", group: "Roles", label: "Create roles" },
  { key: "roles:update", module: "General", group: "Roles", label: "Update roles" },
  { key: "roles:delete", module: "General", group: "Roles", label: "Delete roles" },
  { key: "overview:read", module: "General", group: "Overview", label: "View team overview (full office)" },
  { key: "overview:readOwn", module: "General", group: "Overview", label: "View own overview only" },
  // Bookkeeping — accounting data.
  // Clients group covers list-level lifecycle (view list, add, remove).
  { key: "clients:read", module: "Bookkeeping", group: "Clients", label: "Read clients" },
  { key: "clients:create", module: "Bookkeeping", group: "Clients", label: "Create clients" },
  { key: "clients:delete", module: "Bookkeeping", group: "Clients", label: "Delete clients" },
  // Client Settings group covers in-page editing on /clients/:id/settings —
  // basic info, tags, and owner contact info.
  { key: "clients:update", module: "Bookkeeping", group: "Client Settings", label: "Edit client info & tags" },
  { key: "clientsOwnerInfo:read", module: "Bookkeeping", group: "Client Settings", label: "View owner contact info" },
  { key: "clientsOwnerInfo:update", module: "Bookkeeping", group: "Client Settings", label: "Edit owner contact info" },
  { key: "accounts:read", module: "Bookkeeping", group: "Accounts", label: "Read accounts" },
  { key: "accounts:create", module: "Bookkeeping", group: "Accounts", label: "Create accounts" },
  { key: "accounts:update", module: "Bookkeeping", group: "Accounts", label: "Update accounts" },
  { key: "accounts:delete", module: "Bookkeeping", group: "Accounts", label: "Delete accounts" },
  { key: "transactions:read", module: "Bookkeeping", group: "Transactions", label: "Read transactions" },
  { key: "transactions:create", module: "Bookkeeping", group: "Transactions", label: "Create transactions" },
  { key: "transactions:update", module: "Bookkeeping", group: "Transactions", label: "Update transactions" },
  { key: "transactions:delete", module: "Bookkeeping", group: "Transactions", label: "Delete transactions" },
  { key: "profitLoss:read", module: "Bookkeeping", group: "Profit & Loss", label: "Read profit & loss" },
  // Operations CRM — paid add-on.
  { key: "tasks:read", module: "Operations CRM", group: "Tasks", label: "Access Tasks Manager page" },
  { key: "tasks:create", module: "Operations CRM", group: "Tasks", label: "Create tasks" },
  { key: "tasks:update", module: "Operations CRM", group: "Tasks", label: "Edit tasks" },
  { key: "tasks:delete", module: "Operations CRM", group: "Tasks", label: "Delete tasks" },
  { key: "tasks:readStatusHistory", module: "Operations CRM", group: "Tasks", label: "View task logs (status history)" },
  { key: "tasks:commentCreate", module: "Operations CRM", group: "Task Comments", label: "Add comments" },
  { key: "tasks:commentUpdate", module: "Operations CRM", group: "Task Comments", label: "Edit any comment (other authors)" },
  { key: "tasks:commentDelete", module: "Operations CRM", group: "Task Comments", label: "Delete any comment (other authors)" },
  { key: "board:read", module: "Operations CRM", group: "Board", label: "View task board" },
  { key: "board:manageColumns", module: "Operations CRM", group: "Board", label: "Create / rename / delete board columns" },
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
      "transactions:read",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
      "tasks:read",
      "tasks:readStatusHistory",
      "board:read",
      "overview:readOwn",
      "overview:read",
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
      "transactions:read",
      "transactions:create",
      "transactions:update",
      "profitLoss:read",
      "userProfiles:read",
      "roles:read",
      "tasks:*",
      "board:*",
      "overview:*",
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
      "transactions:*",
      "profitLoss:read",
      "userProfiles:read",
      "userProfiles:create",
      "userProfiles:update",
      "userProfiles:delete",
      "roles:*",
      "tasks:*",
      "board:*",
      "overview:*",
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
