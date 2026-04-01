import {
  createCategorizationJobService,
  getCategorizationJobByIdService,
  listCategorizationJobsService,
} from "../services/categorizationJob.service.js"

export async function createCategorizationJobController(req, res) {
  try {
    const result = await createCategorizationJobService(req.body, req.user?.id)
    return res.status(202).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

export async function getCategorizationJobByIdController(req, res) {
  try {
    const result = await getCategorizationJobByIdService(req.params.jobId, req.user?.id)
    return res.status(200).json(result)
  } catch (error) {
    const message = String(error?.message || "")
    const statusCode = message.includes("not found")
      ? 404
      : message.includes("not allowed")
        ? 403
        : 400

    return res.status(statusCode).json({
      message,
    })
  }
}

export async function listCategorizationJobsController(req, res) {
  try {
    const result = await listCategorizationJobsService(req.user?.id, req.query)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}

