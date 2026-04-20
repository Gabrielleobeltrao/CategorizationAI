import { useCallback, useEffect, useState } from "react"
import { deleteOfficeTag, listOfficeTags } from "../services/office.service"

export function useOfficeTags(officeId, options = {}) {
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingTag, setDeletingTag] = useState("")
  const { onError, onDeleteSuccess } = options

  const reloadTags = useCallback(async () => {
    const safeOfficeId = String(officeId || "").trim()
    if (!safeOfficeId) {
      setTags([])
      return []
    }

    try {
      setIsLoading(true)
      const nextTags = await listOfficeTags(safeOfficeId)
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
    const safeOfficeId = String(officeId || "").trim()
    const safeTag = String(tag || "").trim()

    if (!safeOfficeId) throw new Error("officeId is required")
    if (!safeTag) throw new Error("tag is required")

    try {
      setDeletingTag(safeTag)
      await deleteOfficeTag(safeOfficeId, safeTag)
      await reloadTags()
      onDeleteSuccess?.(safeTag)
      return true
    } catch (error) {
      onError?.(error)
      throw error
    } finally {
      setDeletingTag("")
    }
  }, [officeId, onDeleteSuccess, onError, reloadTags])

  return {
    tags,
    isLoading,
    reloadTags,
    deleteTag,
    deletingTag,
  }
}
