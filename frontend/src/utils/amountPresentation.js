function normalizeLabel(value = "") {
  return String(value || "").trim().toLowerCase()
}

export function formatAbsoluteCurrency(value, options = {}) {
  const numericValue = Math.abs(Number(value || 0))

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(numericValue)
}

export function isRefundCategoryLabel(label = "") {
  return normalizeLabel(label).includes("refund")
}

function isIncomeLikeLabel(label = "") {
  const normalized = normalizeLabel(label)
  return normalized.includes("income") || normalized.includes("revenue")
}

export function getTransactionAmountPresentation({ amount = 0, category = "" }) {
  const numericAmount = Number(amount || 0)

  if (isRefundCategoryLabel(category)) {
    return {
      text: formatAbsoluteCurrency(numericAmount),
      className: "text-rose-600",
    }
  }

  if (isIncomeLikeLabel(category) || numericAmount > 0) {
    return {
      text: formatAbsoluteCurrency(numericAmount),
      className: "text-emerald-700",
    }
  }

  return {
    text: formatAbsoluteCurrency(numericAmount),
    className: "text-gray-900",
  }
}

export function getProfitLossAmountPresentation({ amount = 0, label = "" }) {
  const numericAmount = Number(amount || 0)

  if (isRefundCategoryLabel(label)) {
    return {
      text: formatAbsoluteCurrency(numericAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      className: "text-rose-600",
      barClassName: "bg-rose-500",
      pdfColor: [0.75, 0.2, 0.25],
    }
  }

  if (isIncomeLikeLabel(label) || numericAmount > 0) {
    return {
      text: formatAbsoluteCurrency(numericAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      className: "text-emerald-700",
      barClassName: "bg-emerald-500",
      pdfColor: [0.08, 0.5, 0.3],
    }
  }

  return {
    text: formatAbsoluteCurrency(numericAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    className: "text-gray-900",
    barClassName: "bg-gray-500",
    pdfColor: [0.14, 0.16, 0.2],
  }
}
