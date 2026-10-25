import { Router, type Request, type Response } from 'express'
import { getStaffOrdersList, getStaffOrderStats } from '../db'
import { requireStaff, requireAuth } from '../auth'

export const staffRouter = Router()

/**
 * 1. Verify Staff Role for Current Authenticated User
 * GET /api/staff/verify-role
 * Requires verified session token. Returns whether user is authorized staff.
 */
staffRouter.get('/verify-role', requireAuth, (req: Request, res: Response) => {
  const user = req.user!
  if (user.isStaff) {
    return res.status(200).json({
      success: true,
      authorized: true,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Verified canteen staff access granted.',
    })
  }

  return res.status(403).json({
    success: false,
    authorized: false,
    error: 'Access denied: Your account does not have canteen staff permissions.',
  })
})

/**
 * 2. Get All Active and Past Orders for Staff Dashboard
 * GET /api/staff/orders
 * Protected: Requires verified staff token (HTTP 401 if unauthenticated, HTTP 403 if customer)
 */
staffRouter.get('/orders', requireStaff, async (req: Request, res: Response) => {
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
 * Protected: Requires verified staff token (HTTP 401 if unauthenticated, HTTP 403 if customer)
 */
staffRouter.get('/stats', requireStaff, async (_req: Request, res: Response) => {
  try {
    const stats = await getStaffOrderStats()
    return res.status(200).json({ success: true, stats })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})
