import "dotenv/config"
import { connectDB, closeDB } from "../src/db.js"
import { ensureOfficeTagIndexes } from "../src/repositories/tag.repository.js"
import { listAllOfficeIds } from "../src/repositories/office.repository.js"
import { ensureOfficeTagCatalogFromLegacyService } from "../src/services/tagCatalog.service.js"

function parseOfficeIdArg() {
  const rawArg = process.argv.slice(2).find((item) => item.startsWith("--officeId="))
  if (!rawArg) return ""
  return String(rawArg.split("=")[1] || "").trim()
}

async function run() {
  const officeIdArg = parseOfficeIdArg()

  await connectDB()
  await ensureOfficeTagIndexes()

  const officeIds = officeIdArg
    ? [officeIdArg]
    : await listAllOfficeIds()

  if (officeIds.length === 0) {
    console.log("No offices found for office tag backfill")
    return
  }

  let processedCount = 0

  for (const officeId of officeIds) {
    const tags = await ensureOfficeTagCatalogFromLegacyService(officeId, {
      createdBy: "backfill-office-tags-script",
    })

    console.log(`office ${officeId}: ${Array.isArray(tags) ? tags.length : 0} tag(s) ensured`)
    processedCount += 1
  }

  console.log(`Backfill completed for ${processedCount} office(s)`)
}

run()
  .catch((error) => {
    console.error("Backfill failed")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDB()
  })
