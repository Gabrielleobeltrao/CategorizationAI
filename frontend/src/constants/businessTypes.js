// Business types used in the client form. `code` is the IRS form badge,
// `entity` is the human-readable description bookkeepers actually look for,
// `label` is the flattened combination kept for places that still want a
// single string.
export const BUSINESS_TYPE_OPTIONS = [
    { value: "1040-SchC", code: "Sch C", entity: "Sole Proprietor / Single-member LLC" },
    { value: "1065", code: "1065", entity: "Partnership / Multi-member LLC" },
    { value: "1120", code: "1120", entity: "C Corporation" },
    { value: "1120-S", code: "1120-S", entity: "S Corporation" },
    { value: "1041", code: "1041", entity: "Trust / Estate" },
    { value: "990", code: "990", entity: "Non-profit" },
    { value: "1040-SchE", code: "Sch E", entity: "Rental / Royalty" },
    { value: "Other", code: "•", entity: "Other" },
].map((opt) => ({ ...opt, label: `${opt.code} — ${opt.entity}` }))

export function getBusinessTypeOption(value) {
    const safe = String(value || "").trim()
    return BUSINESS_TYPE_OPTIONS.find((opt) => opt.value === safe) || null
}

export function isKnownBusinessType(value) {
    return Boolean(getBusinessTypeOption(value))
}
