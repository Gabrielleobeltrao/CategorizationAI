function escapePdfText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function buildTextCommand({
  text,
  x,
  y,
  size = 11,
  color = [0, 0, 0],
  font = "F1",
}) {
  const [r, g, b] = color
  return `BT\n/${font} ${size} Tf\n${r} ${g} ${b} rg\n1 0 0 1 ${x} ${y} Tm\n(${escapePdfText(text)}) Tj\nET\n`
}

function estimateTextWidth(text, size = 11) {
  return String(text || "").length * size * 0.52
}

function buildRectCommand({
  x,
  y,
  width,
  height,
  fill = null,
  stroke = null,
  lineWidth = 1,
}) {
  const commands = []
  if (fill) {
    commands.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`)
    commands.push(`${x} ${y} ${width} ${height} re f`)
  }
  if (stroke) {
    commands.push(`${lineWidth} w`)
    commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`)
    commands.push(`${x} ${y} ${width} ${height} re S`)
  }
  return commands.join("\n") + "\n"
}

function buildContentStream(lines = []) {
  const safeLines = lines.map((line) => escapePdfText(line))
  const lineHeight = 14
  const startX = 40
  const startY = 760

  const commands = ["BT", "/F1 11 Tf", `1 0 0 1 ${startX} ${startY} Tm`]

  safeLines.forEach((line, index) => {
    if (index > 0) commands.push(`0 -${lineHeight} Td`)
    commands.push(`(${line}) Tj`)
  })

  commands.push("ET")
  return `${commands.join("\n")}\n`
}

function buildPdfFromStreams({
  filename = "report.pdf",
  streams = [],
  includeBoldFont = false,
}) {
  const safeStreams = streams.length > 0 ? streams : [buildContentStream(["Empty report"])]
  const pageCount = safeStreams.length
  const firstFontObjectId = 3 + pageCount * 2
  const boldFontObjectId = includeBoldFont ? firstFontObjectId + 1 : null

  const objects = []
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

  const pageIds = Array.from({ length: pageCount }, (_, index) => 3 + index * 2)
  objects.push(
    `2 0 obj\n<< /Type /Pages /Count ${pageCount} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>\nendobj\n`
  )

  safeStreams.forEach((stream, index) => {
    const pageId = 3 + index * 2
    const contentId = 4 + index * 2
    const fonts = includeBoldFont
      ? `/Font << /F1 ${firstFontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >>`
      : `/Font << /F1 ${firstFontObjectId} 0 R >>`

    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << ${fonts} >> /Contents ${contentId} 0 R >>\nendobj\n`
    )
    objects.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`
    )
  })

  objects.push(`${firstFontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)
  if (includeBoldFont) {
    objects.push(`${boldFontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)
  }

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((obj) => {
    offsets.push(pdf.length)
    pdf += obj
  })

  const xrefStart = pdf.length
  pdf += `xref\n0 ${offsets.length}\n`
  pdf += "0000000000 65535 f \n"
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  const blob = new Blob([pdf], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function downloadPdfDocument({
  filename = "report.pdf",
  lines = [],
  linesPerPage = 48,
}) {
  const chunks = []
  for (let i = 0; i < lines.length; i += linesPerPage) {
    chunks.push(lines.slice(i, i + linesPerPage))
  }
  if (chunks.length === 0) chunks.push(["Empty report"])

  const streams = chunks.map((pageLines) => buildContentStream(pageLines))
  buildPdfFromStreams({ filename, streams })
}

export function downloadProfitLossPdf({
  filename = "profit-loss.pdf",
  title = "Profit & Loss",
  clientName = "",
  periodLabel = "",
  generatedAt = "",
  kpis = [],
  statementRows = [],
}) {
  const pageWidth = 612
  const pageHeight = 792
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  const bottomLimit = 52
  const rowHeight = 20
  const streams = []

  const buildPageHeader = (isFirstPage = false) => {
    const commands = []
    let y = pageHeight - margin

    if (isFirstPage) {
      commands.push(buildTextCommand({ text: title, x: margin, y, size: 24, font: "F2", color: [0.1, 0.12, 0.16] }))
      y -= 26
      commands.push(
        buildTextCommand({
          text: `${clientName || "-"}`,
          x: margin,
          y,
          size: 11,
          color: [0.35, 0.38, 0.45],
        })
      )
      y -= 14
      commands.push(
        buildTextCommand({
          text: `Period: ${periodLabel || "-"}`,
          x: margin,
          y,
          size: 11,
          color: [0.35, 0.38, 0.45],
        })
      )
      y -= 14
      commands.push(
        buildTextCommand({
          text: `Generated: ${generatedAt || "-"}`,
          x: margin,
          y,
          size: 10,
          color: [0.5, 0.53, 0.58],
        })
      )
      y -= 24
    } else {
      commands.push(buildTextCommand({ text: title, x: margin, y, size: 14, font: "F2", color: [0.1, 0.12, 0.16] }))
      y -= 18
      commands.push(
        buildTextCommand({
          text: `${clientName || "-"}  |  Period: ${periodLabel || "-"}`,
          x: margin,
          y,
          size: 10,
          color: [0.42, 0.45, 0.52],
        })
      )
      y -= 18
    }

    commands.push(buildRectCommand({ x: margin, y: y - 4, width: contentWidth, height: 1, fill: [0.9, 0.92, 0.95] }))
    y -= 18

    return { commands, y }
  }

  const kpiCommands = (yStart) => {
    if (!Array.isArray(kpis) || kpis.length === 0) {
      return { commands: [], y: yStart }
    }
    const commands = []
    const gap = 8
    const cards = kpis.slice(0, 4)
    const cardWidth = (contentWidth - gap * (cards.length - 1)) / cards.length
    const cardHeight = 54
    let x = margin

    cards.forEach((kpi) => {
      const amountColor =
        Array.isArray(kpi?.pdfColor)
          ? kpi.pdfColor
          : kpi?.id === "income" || (kpi?.id === "net_income" && Number(kpi?.value || 0) > 0)
            ? [0.08, 0.5, 0.3]
            : [0.12, 0.13, 0.16]

      commands.push(
        buildRectCommand({
          x,
          y: yStart - cardHeight,
          width: cardWidth,
          height: cardHeight,
          fill: [0.97, 0.98, 0.99],
          stroke: [0.9, 0.92, 0.95],
        })
      )
      commands.push(
        buildTextCommand({
          text: String(kpi?.label || "").toUpperCase(),
          x: x + 10,
          y: yStart - 16,
          size: 9,
          color: [0.45, 0.48, 0.55],
        })
      )
      commands.push(
        buildTextCommand({
          text: String(kpi?.displayValue || ""),
          x: x + 10,
          y: yStart - 38,
          size: 14,
          font: "F2",
          color: amountColor,
        })
      )
      x += cardWidth + gap
    })

    return { commands, y: yStart - cardHeight - 18 }
  }

  let page = buildPageHeader(true)
  const firstKpis = kpiCommands(page.y)
  let commands = [...page.commands, ...firstKpis.commands]
  let currentY = firstKpis.y

  commands.push(buildTextCommand({ text: "Statement", x: margin, y: currentY, size: 13, font: "F2", color: [0.1, 0.12, 0.16] }))
  currentY -= 16

  const pushTableHeader = () => {
    commands.push(
      buildRectCommand({
        x: margin,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        fill: [0.95, 0.96, 0.98],
      })
    )
    commands.push(buildTextCommand({ text: "Line Item", x: margin + 8, y: currentY - 14, size: 10, font: "F2", color: [0.28, 0.31, 0.38] }))
    commands.push(buildTextCommand({ text: "Amount", x: margin + contentWidth - 60, y: currentY - 14, size: 10, font: "F2", color: [0.28, 0.31, 0.38] }))
    currentY -= rowHeight
  }

  pushTableHeader()

  statementRows.forEach((row, index) => {
    if (currentY - rowHeight < bottomLimit) {
      streams.push(commands.join(""))
      page = buildPageHeader(false)
      commands = [...page.commands]
      currentY = page.y
      pushTableHeader()
    }

    if (index % 2 === 0) {
      commands.push(
        buildRectCommand({
          x: margin,
          y: currentY - rowHeight,
          width: contentWidth,
          height: rowHeight,
          fill: [0.985, 0.987, 0.992],
        })
      )
    }

    const leftPadding = row.level === 1 ? 20 : 8
    const labelFont = row.type === "total" || row.type === "group" ? "F2" : "F1"
    const amountFont = row.type === "total" || row.type === "group" ? "F2" : "F1"
    const amountColor = Array.isArray(row.amountPdfColor) ? row.amountPdfColor : [0.14, 0.16, 0.2]

    commands.push(
      buildTextCommand({
        text: row.label,
        x: margin + leftPadding,
        y: currentY - 14,
        size: 10.5,
        font: labelFont,
        color: [0.14, 0.16, 0.2],
      })
    )

    const amountX = margin + contentWidth - 10 - estimateTextWidth(row.amountText, 10.5)
    commands.push(
      buildTextCommand({
        text: row.amountText,
        x: amountX,
        y: currentY - 14,
        size: 10.5,
        font: amountFont,
        color: amountColor,
      })
    )

    currentY -= rowHeight
  })

  streams.push(commands.join(""))
  buildPdfFromStreams({ filename, streams, includeBoldFont: true })
}
