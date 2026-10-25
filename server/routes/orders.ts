import { Router, type Request, type Response } from 'express'
import {
  getAuthoritativeMenu,
  validateCartAndCalculateTotals,
  saveOrder,
  getOrderById,
  updateOrderRecord,
  getUserOrdersList,
  appendStatusHistory,
} from '../db'
import { config } from '../config'

export const ordersRouter = Router()

// Valid stage mapping
export const STATUS_TO_STAGE: Record<string, number> = {
  PLACED: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY_FOR_PICKUP: 3,
  PICKED_UP: 4,
  CANCELLED: -1,
}

export const STAGE_TO_STATUS: Record<number, string> = {
  0: 'PLACED',
  1: 'ACCEPTED',
  2: 'PREPARING',
  3: 'READY_FOR_PICKUP',
  4: 'PICKED_UP',
}

function genOrderNumber(): string {
  return 'CB-' + String(Math.floor(10000 + Math.random() * 90000))
}

function genTokenNumber(): number {
  return Math.floor(10 + Math.random() * 89)
}

/**
 * 1. Create Order (Validated Server-Side)
 * POST /api/orders/create
 */
ordersRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { userId, items, paymentMethod = 'upi' } = req.body

    const menu = await getAuthoritativeMenu()
    const validation = validateCartAndCalculateTotals(items, menu)

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error })
    }

    const { validatedItems, subtotal, tax, packing, total } = validation
    const orderNumber = genOrderNumber()
    const tokenNumber = genTokenNumber()
    const etaMinutes = Math.min(25, Math.max(10, Math.round(subtotal / 30) + 8))
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString()
    const effectiveUserId = userId || 'demo-student'

    const order = await saveOrder({
      user_id: effectiveUserId,
      order_number: orderNumber,
      token_number: tokenNumber,
      items: validatedItems,
      subtotal,
      tax,
      packing,
      total,
      currency: 'INR',
      payment: paymentMethod,
      payment_status: paymentMethod === 'cash' ? 'PENDING' : 'PENDING',
      status: 'PLACED',
      stage: 0,
      eta_minutes: etaMinutes,
      estimated_ready_at: estimatedReadyAt,
    })

    return res.status(201).json({
      success: true,
      order,
    })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 2. Get User Orders
 * GET /api/orders/user/:userId
 */
ordersRouter.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : (req.params.userId || '')
    const orders = await getUserOrdersList(userId)
    return res.status(200).json({ success: true, orders })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 3. Update Order Status (Strict State Machine for Staff)
 * POST /api/orders/:id/status
 */
ordersRouter.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '')
    const { newStatus, note, reason, staffPasskey } = req.body

    // 1. Verify Authorization (either passkey or auth header)
    const authHeader = req.headers.authorization
    const isPasskeyValid = staffPasskey === config.staffSecretPasskey
    const isStaffAuthorized = isPasskeyValid || (authHeader && authHeader.length > 20)

    if (!isStaffAuthorized && newStatus !== 'CANCELLED') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Only authorized canteen staff can update order progression.',
      })
    }

    // 2. Fetch current order from DB
    const currentOrder = await getOrderById(id)

    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const currentStatus = currentOrder.status || STAGE_TO_STATUS[currentOrder.stage] || 'PLACED'

    // 3. Strict State Machine Validation
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PLACED: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
      READY_FOR_PICKUP: ['PICKED_UP'],
      PICKED_UP: [], // Terminal
      CANCELLED: [], // Terminal
    }

    const allowed = VALID_TRANSITIONS[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition: Order cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: [${allowed.join(', ')}]`,
      })
    }

    const newStage = STATUS_TO_STAGE[newStatus] ?? currentOrder.stage

    // 4. Update order in database
    const updatePayload: any = {
      status: newStatus,
      stage: newStage >= 0 ? newStage : currentOrder.stage,
    }

    if (newStatus === 'CANCELLED' && reason) {
      updatePayload.cancellation_reason = reason
    }

    if (note) {
      updatePayload.notes = note
    }

    const updated = await updateOrderRecord(id, updatePayload)

    // 5. Append to Order Status History
    await appendStatusHistory({
      order_id: id,
      previous_status: currentStatus,
      new_status: newStatus,
      actor_role: isPasskeyValid ? 'staff' : 'user',
      status_note: note || (newStatus === 'CANCELLED' ? `Reason: ${reason}` : undefined),
    })

    return res.status(200).json({
      success: true,
      message: `Order transitioned from ${currentStatus} to ${newStatus}`,
      order: updated,
    })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 4. Staff Cash Collection
 * POST /api/orders/:id/collect-cash
 */
ordersRouter.post('/:id/collect-cash', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '')
    const { staffPasskey } = req.body

    if (staffPasskey !== config.staffSecretPasskey) {
      return res.status(403).json({ success: false, error: 'Unauthorized staff action' })
    }

    const updated = await updateOrderRecord(id, {
      payment_status: 'PAID',
    })

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    return res.status(200).json({
      success: true,
      message: 'Physical cash payment collected and recorded.',
      order: updated,
    })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 5. Rate Order
 * POST /api/orders/:id/rate
 */
ordersRouter.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id || '')
    const { rating, comment } = req.body

    const parsedRating = Number(rating)
    if (parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' })
    }

    const updated = await updateOrderRecord(id, {
      rating: parsedRating,
      rating_comment: comment || null,
    })

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    return res.status(200).json({ success: true, order: updated })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})
