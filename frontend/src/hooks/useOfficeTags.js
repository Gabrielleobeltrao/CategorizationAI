import { useCallback, useEffect, useState } from "react"
import { deleteOfficeTag, listOfficeTags } from "../services/office.service"

const officeTagsCache = new Map()
const officeTagsInflight = new Map()

function normalizeOfficeId(officeId) {
  return String(officeId || "").trim()
}

async function loadOfficeTagsOnce(officeId, options = {}) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId) return []

  const force = Boolean(options?.force)
  if (!force && officeTagsCache.has(safeOfficeId)) {
    return officeTagsCache.get(safeOfficeId) || []
  }

  if (!force && officeTagsInflight.has(safeOfficeId)) {
    return officeTagsInflight.get(safeOfficeId)
  }

  const request = listOfficeTags(safeOfficeId)
    .then((nextTags) => {
      const normalizedTags = Array.isArray(nextTags) ? nextTags : []
      officeTagsCache.set(safeOfficeId, normalizedTags)
      return normalizedTags
    })
    .finally(() => {
      officeTagsInflight.delete(safeOfficeId)
    })

  officeTagsInflight.set(safeOfficeId, request)
  return request
}

export function hydrateOfficeTagsCache(officeId, tags) {
  const safeOfficeId = normalizeOfficeId(officeId)
  if (!safeOfficeId || !Array.isArray(tags)) return []
  officeTagsCache.set(safeOfficeId, tags)
  return tags
}

export function useOfficeTags(officeId, options = {}) {
  const [tags, setTags] = useState(() => {
    const safeOfficeId = normalizeOfficeId(officeId)
    return safeOfficeId ? officeTagsCache.get(safeOfficeId) || [] : []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [deletingTag, setDeletingTag] = useState("")
  const { onError, onDeleteSuccess } = options

  const reloadTags = useCallback(async (reloadOptions = {}) => {
    const safeOfficeId = normalizeOfficeId(officeId)
    if (!safeOfficeId) {
      setTags([])
      return []
    }

    try {
      setIsLoading(true)
      const nextTags = await loadOfficeTagsOnce(safeOfficeId, {
        force: Boolean(reloadOptions?.force),
      })
      setTags(Array.isArray(nextTags) ? nextTags : [])
      return Array.isArray(nextTags) ? nextTags : []
    } catch (error) {
      setTags([])
      onError?.(error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [officeId, onError])

  useEffect(() => {
    reloadTags()
  }, [reloadTags])

  const deleteTag = useCallback(async (tag) => {
    const safeOfficeId = normalizeOfficeId(officeId)
    const safeTag = String(tag || "").trim()

    if (!safeOfficeId) throw new Error("officeId is required")
    if (!safeTag) throw new Error("tag is required")

    try {
      setDeletingTag(safeTag)
      await deleteOfficeTag(safeOfficeId, safeTag)
      const nextTags = await loadOfficeTagsOnce(safeOfficeId, { force: true })
      setTags(Array.isArray(nextTags) ? nextTags : [])
      onDeleteSuccess?.(safeTag)
      return true
    } catch (error) {
      onError?.(error)
      throw error
    } finally {
      setDeletingTag("")
    }
  }, [officeId, onDeleteSuccess, onError])

  return {
    tags,
    isLoading,
    reloadTags,
    deleteTag,
    deletingTag,
  }
}
