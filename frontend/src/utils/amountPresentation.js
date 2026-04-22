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

export function getTransactionAmountPresentation({ amount = 0, category = "" }) {
  const numericAmount = Number(amount || 0)
  const normalizedCategory = normalizeLabel(category)
  const isPendingRefundRule = normalizedCategory.includes("refund")

  if (numericAmount > 0) {
    return {
      text: formatAbsoluteCurrency(numericAmount),
      className: "text-emerald-700",
    }
  }

  return {
    text: formatAbsoluteCurrency(numericAmount),
    className: isPendingRefundRule ? "text-gray-900" : "text-gray-900",
  }
}

export function getProfitLossAmountPresentation({ amount = 0 }) {
  const numericAmount = Number(amount || 0)

  if (numericAmount > 0) {
    return {
      text: formatAbsoluteCurrency(numericAmount),
      className: "text-emerald-700",
      barClassName: "bg-emerald-500",
      pdfColor: [0.08, 0.5, 0.3],
    }
  }

  return {
    text: formatAbsoluteCurrency(numericAmount),
    className: "text-gray-900",
    barClassName: "bg-gray-500",
    pdfColor: [0.14, 0.16, 0.2],
  }
}

export function getProfitLossKpiPresentation({ amount = 0, kind = "net" }) {
  const numericAmount = Number(amount || 0)

  if (kind === "income" || kind === "net") {
    return {
      text: formatAbsoluteCurrency(numericAmount),
      className: numericAmount > 0 ? "text-emerald-700" : "text-gray-900",
      pdfColor: numericAmount > 0 ? [0.08, 0.5, 0.3] : [0.12, 0.13, 0.16],
    }
  }

  return {
    text: formatAbsoluteCurrency(numericAmount),
    className: numericAmount > 0 ? "text-gray-900" : "text-emerald-700",
    pdfColor: numericAmount > 0 ? [0.12, 0.13, 0.16] : [0.08, 0.5, 0.3],
  }
}
