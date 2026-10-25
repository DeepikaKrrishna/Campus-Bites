import { Router, type Request, type Response } from 'express'
import {
  getAuthoritativeMenu,
  validateCartAndCalculateTotals,
  saveOrder,
  getOrderById,
  updateOrderRecord,
  getUserOrdersList,
  transitionOrderStatus,
} from '../db'
import { requireAuth, requireStaff } from '../auth'

export const ordersRouter = Router()

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

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * 1. Create Order (Validated Server-Side)
 * POST /api/orders/create
 */
ordersRouter.post('/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items, paymentMethod = 'upi' } = req.body

    const menu = await getAuthoritativeMenu()
    const validation = validateCartAndCalculateTotals(items, menu)

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error })
    }

    const { validatedItems, subtotal, tax, packing, total } = validation
    const orderNumber = genOrderNumber()
    const tokenNumber = genTokenNumber()
    const itemCount = validatedItems.reduce((count, item) => count + item.quantity, 0)
    const etaMinutes = Math.min(35, Math.max(10, 7 + itemCount * 3))
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString()

    const effectiveUserId = req.user!.id

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
      payment_status: 'PENDING',
      status: 'PLACED',
      stage: 0,
      eta_minutes: etaMinutes,
      estimated_ready_at: estimatedReadyAt,
    })

    return res.status(201).json({
      success: true,
      order,
    })
  } catch (error: unknown) {
    console.error('Order creation failed:', safeErrorMessage(error))

    return res.status(500).json({
      success: false,
      error: 'Unable to place your order. Please try again.',
    })
  }
})

/**
 * 2. Get User Orders
 * GET /api/orders/user/:userId
 */
ordersRouter.get('/user/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId || ''
    const authenticatedUser = req.user!

    if (authenticatedUser.id !== userId && !authenticatedUser.isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are only authorized to view your own order history.',
      })
    }

    const orders = await getUserOrdersList(userId)
    return res.status(200).json({ success: true, orders })
  } catch (error: unknown) {
    console.error('getUserOrdersList failed:', safeErrorMessage(error))
    return res.status(500).json({
      success: false,
      error: 'Unable to load orders. Please try again.',
    })
  }
})

/**
 * 3. Get single order (ownership enforced)
 * GET /api/orders/:id
 */
ordersRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || ''
    const authenticatedUser = req.user!

    const order = await getOrderById(id)
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    if (order.user_id !== authenticatedUser.id && !authenticatedUser.isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this order.',
      })
    }

    return res.status(200).json({ success: true, order })
  } catch (error: unknown) {
    console.error('getOrderById failed:', safeErrorMessage(error))
    return res.status(500).json({
      success: false,
      error: 'Unable to load order. Please try again.',
    })
  }
})

/**
 * 4. Update Order Status (Strict State Machine with Verified Authorization)
 * POST /api/orders/:id/status
 */
ordersRouter.post('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || ''
    const { newStatus, note, reason } = req.body
    const authenticatedUser = req.user!

    const currentOrder = await getOrderById(id)
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const currentStatus = currentOrder.status || STAGE_TO_STATUS[currentOrder.stage] || 'PLACED'

    if (newStatus === 'CANCELLED') {
      const isOwner = currentOrder.user_id === authenticatedUser.id
      if (!isOwner && !authenticatedUser.isStaff) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only cancel your own orders.',
        })
      }

      if (!authenticatedUser.isStaff && currentStatus !== 'PLACED') {
        return res.status(403).json({
          success: false,
          error: `Customer cannot cancel order once kitchen has ${currentStatus.toLowerCase()} it. Please contact counter staff.`,
        })
      }
    } else if (!authenticatedUser.isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Only authorized canteen staff can update order kitchen progression.',
      })
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      PLACED: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
      READY_FOR_PICKUP: ['PICKED_UP'],
      PICKED_UP: [],
      CANCELLED: [],
    }

    const allowed = VALID_TRANSITIONS[currentStatus] || []
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition: Order cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: [${allowed.join(', ')}]`,
      })
    }

    const updatePayload: Record<string, unknown> = {}
    if (newStatus === 'CANCELLED' && reason) {
      updatePayload.cancellation_reason = reason
    }
    if (note) {
      updatePayload.notes = note
    }

    const result = await transitionOrderStatus({
      orderId: id,
      expectedStatus: currentStatus,
      newStatus,
      updates: updatePayload,
      history: {
        previous_status: currentStatus,
        new_status: newStatus,
        actor_id: authenticatedUser.id,
        actor_role: authenticatedUser.isStaff ? 'staff' : 'customer',
        status_note:
          note || (newStatus === 'CANCELLED' && reason ? `Reason: ${reason}` : undefined),
      },
    })

    if (!result.ok) {
      if (result.code === 'CONFLICT') {
        return res.status(409).json({
          success: false,
          error:
            result.message ||
            'This order was already updated by another staff member. Please refresh.',
        })
      }
      if (result.code === 'NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'Order not found' })
      }
      return res.status(500).json({
        success: false,
        error: 'Unable to update order status. Please try again.',
      })
    }

    return res.status(200).json({
      success: true,
      message: `Order transitioned from ${currentStatus} to ${newStatus}`,
      order: result.order,
    })
  } catch (error: unknown) {
    console.error('Order status update failed:', safeErrorMessage(error))
    return res.status(500).json({
      success: false,
      error: 'Unable to update order status. Please try again.',
    })
  }
})

/**
 * 5. Staff Cash Collection
 * POST /api/orders/:id/collect-cash
 */
ordersRouter.post('/:id/collect-cash', requireStaff, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || ''

    const updated = await updateOrderRecord(id, { payment_status: 'PAID' })

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    return res.status(200).json({
      success: true,
      message: 'Physical cash payment collected and recorded by authorized staff.',
      order: updated,
    })
  } catch (error: unknown) {
    console.error('collect-cash failed:', safeErrorMessage(error))
    return res.status(500).json({
      success: false,
      error: 'Unable to record cash payment. Please try again.',
    })
  }
})

/**
 * 6. Rate Order
 * POST /api/orders/:id/rate
 */
ordersRouter.post('/:id/rate', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || ''
    const { rating, comment } = req.body
    const authenticatedUser = req.user!

    const currentOrder = await getOrderById(id)
    if (!currentOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    if (currentOrder.user_id !== authenticatedUser.id && !authenticatedUser.isStaff) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only rate your own orders.' })
    }

    if (currentOrder.status !== 'PICKED_UP') {
      return res.status(400).json({ success: false, error: 'Only completed orders can be reviewed.' })
    }

    const parsedRating = Number(rating)
    if (parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' })
    }

    const updated = await updateOrderRecord(
      id,
      {
        rating: parsedRating,
        rating_comment: comment || null,
      }
    )

    return res.status(200).json({ success: true, order: updated })
  } catch (error: unknown) {
    console.error('rate order failed:', safeErrorMessage(error))
    return res.status(500).json({
      success: false,
      error: 'Unable to save rating. Please try again.',
    })
  }
})
