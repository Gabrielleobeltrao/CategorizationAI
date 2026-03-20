import { getProfitLossByClientIdService } from "../services/profitLoss.service.js"

export async function getProfitLossByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const { period, day, month, year } = req.query

    const result = await getProfitLossByClientIdService({
      clientId,
      period,
      day,
      month,
      year,
    })

    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
