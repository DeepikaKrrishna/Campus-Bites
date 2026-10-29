import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import { config, isRazorpayConfigured } from '../config'
import {
  getAuthoritativeMenu,
  validateCartAndCalculateTotals,
  saveOrder,
  getOrderById,
  updateOrderRecord,
  savePaymentRecord,
  updatePaymentRecord,
  getPaymentRecord,
} from '../db'
import { requireAuth } from '../auth'
import { isValidHexHmac } from '../payment-utils'

export const paymentsRouter = Router()

let razorpayInstance: Razorpay | null = null

export function getRazorpayInstance(): Razorpay | null {
  const { keyId, keySecret } = config.razorpay

  if (!keyId || !keySecret || !isRazorpayConfigured()) {
    return null
  }

  if (!razorpayInstance || (razorpayInstance as any).key_id !== keyId) {
    try {
      const Rzp = (Razorpay as any)?.default || Razorpay
      razorpayInstance = new Rzp({
        key_id: keyId,
        key_secret: keySecret,
      })
    } catch (err) {
      console.warn('Razorpay SDK initialization warning:', err)
      return null
    }
  }

  return razorpayInstance
}

function genOrderNumber(): string {
  return 'CB-' + String(Math.floor(10000 + Math.random() * 90000))
}

function genTokenNumber(): number {
  return Math.floor(10 + Math.random() * 89)
}

/**
 * 1. Create Payment Order
 * POST /api/payments/create-order
 */
paymentsRouter.post('/create-order', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items, paymentMethod = 'upi' } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order items are required.' })
    }

    // 1. Authoritative Server-Side Menu Validation & Price Calculation
    const menu = await getAuthoritativeMenu()
    const validation = validateCartAndCalculateTotals(items, menu)

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error })
    }

    if (!['upi', 'card', 'cash', 'netbanking'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment method.' })
    }

    if (paymentMethod !== 'cash' && !isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Online payments require Razorpay Test Mode credentials on the server.',
      })
    }

    const rzp = getRazorpayInstance()
    if (paymentMethod !== 'cash' && !rzp) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay Test Mode could not be initialized. Check the server credentials and try again.',
      })
    }

    const { validatedItems, subtotal, tax, packing, total, amountInPaise } = validation
    const orderNumber = genOrderNumber()
    const tokenNumber = genTokenNumber()
    const itemCount = validatedItems.reduce((count, item) => count + item.quantity, 0)
    const etaMinutes = Math.min(35, Math.max(10, 7 + itemCount * 3))
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString()
    const effectiveUserId = req.user!.id

    if (paymentMethod === 'cash') {
      const savedOrder = await saveOrder({
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

      await savePaymentRecord({
        order_id: savedOrder.id,
        user_id: effectiveUserId,
        gateway: 'cash',
        amount: amountInPaise,
        currency: 'INR',
        status: 'PENDING',
        payment_method: 'cash',
      })

      return res.status(200).json({
        success: true,
        orderId: savedOrder.id,
        orderNumber,
        tokenNumber,
        amount: total,
        amountInPaise,
        total,
        currency: 'INR',
        paymentMethod: 'cash',
        paymentStatus: 'PENDING',
        etaMinutes,
        message: 'Order placed with Cash payment. Please pay at counter upon pickup.',
      })
    }

    const razorpay = rzp
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay Test Mode could not be initialized. Check the server credentials and try again.',
      })
    }

    const campusOrderId = crypto.randomUUID()
    let razorpayOrderId: string
    try {
      const gatewayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          campus_order_id: campusOrderId,
          token_number: String(tokenNumber),
          customer_user_id: effectiveUserId,
          payment_method: paymentMethod,
        },
      })
      razorpayOrderId = gatewayOrder.id
    } catch (rzpErr: unknown) {
      console.error('Razorpay order creation failed:', rzpErr instanceof Error ? rzpErr.message : 'Unknown gateway error')
      return res.status(502).json({
        success: false,
        error: 'Unable to start Razorpay Test Mode checkout. Check the Test Mode API keys and try again.',
      })
    }

    await saveOrder({
      id: campusOrderId,
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

    await savePaymentRecord({
      order_id: campusOrderId,
      user_id: effectiveUserId,
      gateway: 'razorpay',
      gateway_order_id: razorpayOrderId,
      amount: amountInPaise,
      currency: 'INR',
      status: 'PENDING',
      payment_method: paymentMethod,
    })

    return res.status(200).json({
      success: true,
      orderId: campusOrderId,
      orderNumber,
      tokenNumber,
      razorpayOrderId,
      amount: amountInPaise,
      total,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      etaMinutes,
    })
  } catch (error: unknown) {
    console.error('Error creating payment order:', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ success: false, error: 'Unable to create payment order. Please try again.' })
  }
})

/**
 * 2. Server-Side Payment Verification
 * POST /api/payments/verify
 */
paymentsRouter.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body

    if (!orderId || !razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification parameters.',
      })
    }

    const order = await getOrderById(orderId)
    if (!order || order.user_id !== req.user!.id) {
      return res.status(404).json({ success: false, verified: false, error: 'Order not found.' })
    }
    const paymentRecord = await getPaymentRecord(razorpayOrderId)
    if (
      !paymentRecord ||
      paymentRecord.order_id !== orderId ||
      paymentRecord.user_id !== req.user!.id ||
      paymentRecord.gateway !== 'razorpay'
    ) {
      return res.status(404).json({ success: false, verified: false, error: 'Payment order not found.' })
    }

    if (
      !razorpaySignature ||
      !isValidHexHmac(
        `${razorpayOrderId}|${razorpayPaymentId}`,
        razorpaySignature,
        config.razorpay.keySecret
      )
    ) {
      await updatePaymentRecord(razorpayOrderId, {
        status: 'FAILED',
        failure_reason: 'Signature verification failed',
      })

      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Payment verification failed: Signature mismatch. Order not marked as paid.',
      })
    }

    const razorpay = getRazorpayInstance()
    if (!razorpay) {
      return res.status(503).json({
        success: false,
        verified: false,
        error: 'Razorpay Test Mode is unavailable. Payment could not be confirmed.',
      })
    }

    const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId)
    if (
      gatewayPayment.order_id !== razorpayOrderId ||
      Number(gatewayPayment.amount) !== Number(paymentRecord.amount) ||
      gatewayPayment.currency !== paymentRecord.currency ||
      gatewayPayment.status !== 'captured' ||
      !gatewayPayment.captured
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Razorpay has not confirmed a captured payment for this order.',
      })
    }

    // Payment is legitimately VERIFIED on server
    const nowIso = new Date().toISOString()

    // 1. Update Payment record
    await updatePaymentRecord(razorpayOrderId, {
      status: 'PAID',
      gateway_payment_id: razorpayPaymentId,
      verified_at: nowIso,
    })

    // Payment confirmation is separate from the staff-controlled kitchen lifecycle.
    const updatedOrder = await updateOrderRecord(
      orderId,
      {
        payment_status: 'PAID',
      }
    )

    return res.status(200).json({
      success: true,
      verified: true,
      orderId,
      order: updatedOrder,
      paymentId: razorpayPaymentId,
      status: 'PAID',
      orderStatus: updatedOrder?.status || 'PLACED',
      message: 'Payment verified successfully. Your order is waiting for kitchen staff.',
    })
  } catch (error: unknown) {
    console.error('Error verifying payment:', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ success: false, error: 'Unable to verify payment. Please try again.' })
  }
})

/**
 * 3. Secure Webhook Processing
 * POST /api/payments/webhook
 */
const processedWebhooks = new Set<string>()

paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string
    const rawBody = (req as any).rawBody

    if (
      !config.razorpay.webhookSecret ||
      config.razorpay.webhookSecret.toLowerCase().includes('your_') ||
      config.razorpay.webhookSecret.toLowerCase().includes('placeholder')
    ) {
      return res.status(503).json({ error: 'Razorpay webhook secret is not configured.' })
    }
    if (!rawBody || !isValidHexHmac(rawBody, signature || '', config.razorpay.webhookSecret)) {
      console.warn('Unauthorized webhook invocation: Invalid signature')
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }

    const event = req.body
    const eventId = event?.id || `evt_${Date.now()}`
    const eventType = event?.event

    // Idempotency check: Deduplicate event
    if (processedWebhooks.has(eventId)) {
      return res.status(200).json({ status: 'ok', deduplicated: true })
    }

    if (eventType === 'payment.captured' || eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity
      const razorpayOrderId = paymentEntity?.order_id
      const razorpayPaymentId = paymentEntity?.id

      if (!razorpayOrderId || !razorpayPaymentId) {
        return res.status(400).json({ error: 'Razorpay payment event is incomplete.' })
      }

      const paymentRecord = await getPaymentRecord(razorpayOrderId)
      if (
        !paymentRecord ||
        paymentRecord.gateway !== 'razorpay' ||
        Number(paymentRecord.amount) !== Number(paymentEntity.amount) ||
        paymentRecord.currency !== paymentEntity.currency
      ) {
        return res.status(400).json({ error: 'Razorpay payment does not match a saved order.' })
      }

      if (eventType === 'payment.captured') {
        if (paymentEntity.status !== 'captured' || !paymentEntity.captured) {
          return res.status(400).json({ error: 'Razorpay payment is not captured.' })
        }
        await updatePaymentRecord(razorpayOrderId, {
          status: 'PAID',
          gateway_payment_id: razorpayPaymentId,
          verified_at: new Date().toISOString(),
        })
        await updateOrderRecord(paymentRecord.order_id, { payment_status: 'PAID' })
      } else if (paymentRecord.status !== 'PAID') {
        await updatePaymentRecord(razorpayOrderId, {
          status: 'FAILED',
          gateway_payment_id: razorpayPaymentId,
          failure_reason: paymentEntity.error_description || 'Payment failed',
        })
        await updateOrderRecord(paymentRecord.order_id, { payment_status: 'FAILED' })
      }
    }

    processedWebhooks.add(eventId)
    return res.status(200).json({ status: 'ok' })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Webhook processing error' })
  }
})

/**
 * 4. Payment Status Check (Recovery if browser was refreshed)
 * GET /api/payments/status/:orderId
 */
paymentsRouter.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : (req.params.orderId || '')
    const order = await getOrderById(orderId)

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    return res.status(200).json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentMethod: order.payment,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      stage: order.stage,
      total: order.total,
    })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})
