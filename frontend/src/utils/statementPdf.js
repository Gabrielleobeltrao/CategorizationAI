import { GlobalWorkerOptions, getDocument } from "pdfjs-dist"
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const DEFAULT_COLUMNS = ["Date", "Description", "Amount"]

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function groupTextItemsIntoLines(items = []) {
  const sorted = [...items]
    .filter((item) => normalizeWhitespace(item?.str || ""))
    .sort((a, b) => {
      const yDiff = Number(b?.transform?.[5] || 0) - Number(a?.transform?.[5] || 0)
      if (Math.abs(yDiff) > 2) return yDiff
      return Number(a?.transform?.[4] || 0) - Number(b?.transform?.[4] || 0)
    })

  const lines = []

  sorted.forEach((item) => {
    const y = Number(item?.transform?.[5] || 0)
    const x = Number(item?.transform?.[4] || 0)
    const text = normalizeWhitespace(item?.str || "")
    if (!text) return

    const currentLine = lines.find((line) => Math.abs(line.y - y) <= 2)
    if (!currentLine) {
      lines.push({
        y,
        parts: [{ x, text }],
      })
      return
    }

    currentLine.parts.push({ x, text })
  })

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const parts = line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => ({
          x: part.x,
          text: normalizeWhitespace(part.text),
        }))
        .filter((part) => part.text)

      return {
        y: line.y,
        parts,
        text: normalizeWhitespace(parts.map((part) => part.text).join(" ")),
      }
    })
    .filter((line) => line.text)
}

function detectStatementColumns(items = []) {
  const positions = {
    depositX: 411,
    withdrawalX: 480,
    endingBalanceX: 543,
  }

  items.forEach((item) => {
    const text = normalizeWhitespace(item?.str || "").toLowerCase()
    const x = Number(item?.transform?.[4] || 0)

    if (text === "deposits/" || text === "credits") {
      positions.depositX = Math.min(positions.depositX, x)
    }

    if (text === "withdrawals/" || text === "debits") {
      positions.withdrawalX = Math.min(positions.withdrawalX, x)
    }

    if (text === "ending daily" || text === "balance") {
      positions.endingBalanceX = Math.min(positions.endingBalanceX, x)
    }
  })

  return positions
}

function detectStatementYear(text = "") {
  const yearMatches = String(text || "").match(/\b20\d{2}\b/g) || []
  const counts = yearMatches.reduce((acc, year) => {
    acc[year] = (acc[year] || 0) + 1
    return acc
  }, {})

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (ranked.length > 0) return ranked[0][0]

  return String(new Date().getFullYear())
}

function normalizePdfDate(dateValue = "", fallbackYear = "") {
  const safeDate = String(dateValue || "").trim()
  if (!safeDate) return ""

  const isoMatch = safeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return safeDate

  const slashMatch = safeDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!slashMatch) return safeDate

  const [, month, day, year] = slashMatch
  const normalizedYear = year
    ? (year.length === 2 ? `20${year}` : year)
    : fallbackYear

  const baseDate = `${month.padStart(2, "0")}/${day.padStart(2, "0")}`
  return normalizedYear ? `${baseDate}/${normalizedYear}` : baseDate
}

function parseCurrencyToken(token = "") {
  const safeToken = String(token || "").trim()
  if (!safeToken) return null

  const isParenthesesNegative = safeToken.startsWith("(") && safeToken.endsWith(")")
  const normalized = safeToken.replace(/[^0-9.-]/g, "")
  const numericValue = Number(normalized)
  if (Number.isNaN(numericValue)) return null

  return isParenthesesNegative ? -Math.abs(numericValue) : numericValue
}

function parseStatementLine(line = {}, fallbackYear = "", statementColumns = {}) {
  const normalizedLine = normalizeWhitespace(line?.text || line)
  if (!normalizedLine) return null

  const dateMatch = normalizedLine.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(.+)$/)
  if (!dateMatch) return null

  const [, rawDate, rawRest] = dateMatch
  const amountRegex = /^\(?-?\$?\d[\d,]*\.\d{2}\)?$/
  const amountParts = Array.isArray(line?.parts)
    ? line.parts.filter((part) => amountRegex.test(part.text))
    : []
  if (amountParts.length === 0) return null

  const firstAmountText = amountParts[0]?.text || ""
  const firstAmountIndex = rawRest.indexOf(firstAmountText)
  const description = normalizeWhitespace(
    firstAmountIndex >= 0 ? rawRest.slice(0, firstAmountIndex) : rawRest
  )

  const amountTokens = amountParts.map((part) => part.text)
  let amount = null

  if (amountTokens.length === 1) {
    const [firstPart] = amountParts
    const firstX = Number(firstPart?.x || 0)
    const depositDelta = Math.abs(firstX - Number(statementColumns.depositX || 411))
    const withdrawalDelta = Math.abs(firstX - Number(statementColumns.withdrawalX || 480))
    const parsedAmount = parseCurrencyToken(amountTokens[0])

    amount = withdrawalDelta < depositDelta
      ? -Math.abs(Number(parsedAmount || 0))
      : Math.abs(Number(parsedAmount || 0))
  } else if (amountTokens.length === 2) {
    const [firstPart] = amountParts
    const firstX = Number(firstPart?.x || 0)
    const depositDelta = Math.abs(firstX - Number(statementColumns.depositX || 411))
    const withdrawalDelta = Math.abs(firstX - Number(statementColumns.withdrawalX || 480))
    const parsedAmount = parseCurrencyToken(amountTokens[0])

    if (withdrawalDelta < depositDelta) {
      amount = -Math.abs(Number(parsedAmount || 0))
    } else {
      amount = Math.abs(Number(parsedAmount || 0))
    }
  } else {
    const debit = parseCurrencyToken(amountTokens[amountTokens.length - 2])
    const credit = parseCurrencyToken(amountTokens[amountTokens.length - 3])

    if ((debit || 0) !== 0 && (credit || 0) === 0) {
      amount = -Math.abs(Number(debit || 0))
    } else if ((credit || 0) !== 0 && (debit || 0) === 0) {
      amount = Math.abs(Number(credit || 0))
    } else {
      amount = parseCurrencyToken(amountTokens[amountTokens.length - 2])
    }
  }

  if (amount === null || Number.isNaN(amount)) return null

  return {
    Date: normalizePdfDate(rawDate, fallbackYear),
    Description: description,
    Amount: amount.toFixed(2),
  }
}

export async function parseStatementPdf(file) {
  const pdfData = await file.arrayBuffer()
  const documentTask = getDocument({
    data: pdfData,
    useWorkerFetch: false,
    isEvalSupported: false,
  })
  const pdf = await documentTask.promise

  let fullText = ""
  const parsedRows = []
  let statementColumns = null

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const lines = groupTextItemsIntoLines(textContent.items || [])
    statementColumns = statementColumns || detectStatementColumns(textContent.items || [])

    fullText += `\n${lines.map((line) => line.text).join("\n")}`

    lines.forEach((line) => {
      const parsedLine = parseStatementLine(line, "", statementColumns)
      if (!parsedLine) return
      parsedRows.push(parsedLine)
    })
  }

  const fallbackYear = detectStatementYear(fullText)
  const normalizedRows = parsedRows.map((row) => ({
    ...row,
    Date: normalizePdfDate(row.Date, fallbackYear),
  }))

  const uniqueRows = normalizedRows.filter((row, index) => {
    const currentKey = `${row.Date}|${row.Description}|${row.Amount}`
    return normalizedRows.findIndex(
      (candidate) => `${candidate.Date}|${candidate.Description}|${candidate.Amount}` === currentKey
    ) === index
  })

  if (uniqueRows.length === 0) {
    throw new Error("Could not extract transactions from this PDF. For now, use text-based bank statements.")
  }

  return {
    columns: DEFAULT_COLUMNS,
    rows: uniqueRows,
    previewRows: uniqueRows.slice(0, 4),
    sourceType: "pdf",
    isMappingLocked: true,
  }
}
