import { getProfitLossByClientIdService } from "../services/profitLoss.service.js"

export async function getProfitLossByClientIdController(req, res) {
  try {
    const { clientId } = req.params
    const { period, month, year, fromDate, toDate } = req.query

    const result = await getProfitLossByClientIdService({
      clientId,
      period,
      month,
      year,
      fromDate,
      toDate,
    })

    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }
}
