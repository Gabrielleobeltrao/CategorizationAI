export const BALANCE_SHEET_TYPE_OPTIONS = [
    { value: "asset_current", label: "Current Asset", group: "asset" },
    { value: "asset_noncurrent", label: "Non-current Asset", group: "asset" },
    { value: "liability_current", label: "Current Liability", group: "liability" },
    { value: "liability_noncurrent", label: "Non-current Liability", group: "liability" },
    { value: "equity", label: "Equity", group: "equity" },
]

export const BALANCE_SHEET_TYPE_LABELS = Object.fromEntries(
    BALANCE_SHEET_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)
