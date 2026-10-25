import { Router, type Request, type Response } from 'express'
import { getStaffOrdersList, getStaffOrderStats } from '../db'
import { config } from '../config'

export const staffRouter = Router()

/**
 * 1. Verify Staff Passkey
 * POST /api/staff/verify-passkey
 */
staffRouter.post('/verify-passkey', (req: Request, res: Response) => {
  const { passkey } = req.body
  if (passkey === config.staffSecretPasskey) {
    return res.status(200).json({
      success: true,
      authorized: true,
      role: 'staff',
      message: 'Staff access granted.',
    })
  }
  return res.status(401).json({
    success: false,
    authorized: false,
    error: 'Invalid canteen staff passkey. Please check with the canteen manager.',
  })
})

/**
 * 2. Get All Active and Past Orders for Staff Dashboard
 * GET /api/staff/orders
 */
staffRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query
    const orders = await getStaffOrdersList(status as string, Number(limit))
    return res.status(200).json({ success: true, orders })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 3. Staff Dashboard Queue Stats
 * GET /api/staff/stats
 */
staffRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getStaffOrderStats()
    return res.status(200).json({ success: true, stats })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})
