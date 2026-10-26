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
  getLatestPaymentForOrder,
  processRazorpayPaymentEvent,
} from "../db"
import { requireAuth } from "../auth"
import {
  classifyPaymentAttempts,
  isValidHexHmac,
} from "../payment-utils"

export const paymentsRouter = Router()

let razorpayInstance: Razorpay | null = null

export function getRazorpayInstance(): Razorpay | null {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || ''

  if (!keyId || !keySecret || !isRazorpayConfigured()) {
    return null
  }

  if (!razorpayInstance || (razorpayInstance as any).key_id !== keyId) {
    try {
      razorpayInstance = new Razorpay({
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
  return "CB-" + String(Math.floor(10000 + Math.random() * 90000))
}

function genTokenNumber(): number {
  return Math.floor(10 + Math.random() * 89)
}

function paymentUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    error:
      "Razorpay Test Mode is not configured. Ask the project owner to configure test credentials.",
  })
}

function orderIsPayable(
  order: {
    status: string
    payment_status: string
    payment: string
  } | null,
): boolean {
  return Boolean(
    order &&
      order.status !== "CANCELLED" &&
      order.status !== "PICKED_UP" &&
      order.payment_status !== "PAID",
  )
}

async function createRazorpayOrder(input: {
  orderId: string
  orderNumber: string
  tokenNumber: number
  userId: string
  amount: number
}) {
  if (!razorpay || !isRazorpayTestConfigured()) {
    throw new Error("Razorpay Test Mode is not configured.")
  }
  const created = await razorpay.orders.create({
    amount: input.amount,
    currency: "INR",
    receipt: input.orderNumber,
    notes: {
      campus_order_id: input.orderId,
      token_number: String(input.tokenNumber),
      customer_user_id: input.userId,
    },
  })
  if (created.currency !== "INR" || created.amount !== input.amount) {
    throw new Error(
      "Razorpay returned an order with an unexpected amount or currency.",
    )
  }
  return created
}

/**
 * Creates a CampusBites order and a real Razorpay Test Mode order.
 * POST /api/payments/create-order
 */

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order items are required.' })
    }

    // 1. Authoritative Server-Side Menu Validation & Price Calculation
    const menu = await getAuthoritativeMenu()
    const validation = validateCartAndCalculateTotals(items, menu)

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error })
    }

    if (!['upi', 'card', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment method.' })
    }

    if (paymentMethod === 'card' && !isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Card payments are unavailable until Razorpay is configured.',
      })
    }

    if (paymentMethod !== 'cash' && !isRazorpayConfigured() && config.nodeEnv === 'production') {
      return res.status(503).json({
        success: false,
        error: 'Online payments are temporarily unavailable. Please choose cash or try again later.',
      })
    }

    const rzp = getRazorpayInstance()
    if (paymentMethod !== 'cash' && isRazorpayConfigured() && !rzp) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay could not be initialized. Please check credentials and try again later.',
      })
    }

    const { validatedItems, subtotal, tax, packing, total, amountInPaise } = validation
    const orderNumber = genOrderNumber()
    const tokenNumber = genTokenNumber()
    const itemCount = validatedItems.reduce((count, item) => count + item.quantity, 0)
    const etaMinutes = Math.min(35, Math.max(10, 7 + itemCount * 3))
    const estimatedReadyAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString()
    const effectiveUserId = req.user!.id

    // 2. Persist order in resilient database
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

    const campusOrderId = savedOrder.id

    // 3. Handle Cash Option
    if (paymentMethod === 'cash') {
      await savePaymentRecord({
        order_id: campusOrderId,
        user_id: effectiveUserId,
        gateway: 'cash',
        amount: amountInPaise,
        currency: 'INR',
        status: 'PENDING',
        payment_method: 'cash',
      })

      return res.status(200).json({
        success: true,
        orderId: campusOrderId,
        orderNumber,
        tokenNumber,
        userId: req.user!.id,
        amount: amountInPaise,
      })
    }

    // 4. Handle Online / UPI Payment with Razorpay
    let razorpayOrderId = ''
    let isSimulator = false

    if (isRazorpayConfigured() && rzp) {
      try {
        const rzpOrder = await rzp.orders.create({
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
        razorpayOrderId = rzpOrder.id
      } catch (rzpErr: any) {
        console.error('Razorpay order creation failed:', rzpErr instanceof Error ? rzpErr.message : rzpErr)
        return res.status(502).json({
          success: false,
          error: `Unable to start Razorpay checkout: ${rzpErr instanceof Error ? rzpErr.message : 'Gateway error'}`,
        })
      }
    } else {
      // Simulated payments are available only in non-production without gateway credentials.
      razorpayOrderId = 'order_test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      isSimulator = true
    }

    // Persist Payment record
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

    const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''

    return res.status(200).json({
      success: true,
      orderId: campusOrderId,
      orderNumber,
      tokenNumber,
      razorpayOrderId,
      amount: amountInPaise,
      total,
      currency: 'INR',
      keyId,
      isSimulator,
      etaMinutes,
    })
  } catch (error: unknown) {
    console.error('Error creating payment order:', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ success: false, error: 'Unable to create payment order. Please try again.' })
  }
})

/**
 * Verifies the checkout signature and the authoritative Razorpay payment.
 * POST /api/payments/verify
 */

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
      paymentRecord.user_id !== req.user!.id
    ) {
      return res.status(404).json({ success: false, verified: false, error: 'Payment order not found.' })
    }

    let isValid = false

    const trustedSimulator =
      !isRazorpayConfigured() &&
      process.env.NODE_ENV !== 'production' &&
      paymentRecord.gateway_order_id?.startsWith('order_test_')

    if (!trustedSimulator) {
      // Official Razorpay HMAC-SHA256 verification
      const body = razorpayOrderId + '|' + razorpayPaymentId
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body.toString())
        .digest('hex')

      if (razorpaySignature && expectedSignature.length === razorpaySignature.length) {
        isValid = crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(razorpaySignature)
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            verified: false,
            error: "Payment signature is invalid.",
          })
      }
      const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId)
      if (
        gatewayPayment.order_id !== razorpayOrderId ||
        Number(gatewayPayment.amount) !== paymentRecord.amount ||
        !gatewayPayment.currency ||
        gatewayPayment.currency !== paymentRecord.currency
      ) {
        return res
          .status(400)
          .json({
            success: false,
            verified: false,
            error: "Payment does not match the order.",
          })
      }
    }

    if (!isValid) {
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
    const rawBody = (req as any).rawBody || JSON.stringify(req.body)

    // Verify webhook signature
    if (config.razorpay.webhookSecret && !config.razorpay.webhookSecret.includes('demo')) {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(rawBody)
        .digest('hex')

      if (
        !signature ||
        expectedSignature.length !== signature.length ||
        !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
      ) {
        console.warn('Unauthorized webhook invocation: Invalid signature')
        return res.status(400).json({ error: 'Invalid webhook signature' })
      }
    }

    const event = req.body
    const eventId = event?.id || `evt_${Date.now()}`
    const eventType = event?.event

    // Idempotency check: Deduplicate event
    if (processedWebhooks.has(eventId)) {
      return res.status(200).json({ status: 'ok', deduplicated: true })
    }
    processedWebhooks.add(eventId)

    // Process event
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity
      const razorpayOrderId = paymentEntity?.order_id
      const razorpayPaymentId = paymentEntity?.id

      if (razorpayOrderId) {
        await updatePaymentRecord(razorpayOrderId, {
          status: 'PAID',
          gateway_payment_id: razorpayPaymentId,
          verified_at: new Date().toISOString(),
        })
      }
      if (gatewayPayment.status === "failed") {
        const attempts = await razorpay.orders.fetchPayments(razorpayOrderId)
        const attemptSummary = classifyPaymentAttempts(
          attempts.items || [],
          razorpayOrderId,
          paymentRecord.amount,
          paymentRecord.currency,
        )
        if (attemptSummary.captured) {
          await processRazorpayPaymentEvent({
            eventType: "payment.captured",
            gatewayOrderId: razorpayOrderId,
            paymentId: attemptSummary.captured.id,
            amount: Number(attemptSummary.captured.amount),
            currency: attemptSummary.captured.currency || "",
          })
          return res.status(200).json({
            success: true,
            verified: true,
            orderId,
            paymentId: attemptSummary.captured.id,
            status: "PAID",
          })
        }
        const failureIsFinal = attemptSummary.failureIsFinal
        await processRazorpayPaymentEvent({
          eventType: "payment.failed",
          gatewayOrderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          amount: Number(gatewayPayment.amount),
          currency: gatewayPayment.currency,
          failureReason: gatewayPayment.error_description || "Payment failed",
          failureIsFinal,
        })
        if (!failureIsFinal) {
          return res.status(202).json({
            success: true,
            verified: false,
            status: "PENDING",
            orderId,
            message: "Another payment attempt may still be processing.",
          })
        }
        return res
          .status(402)
          .json({ success: false, verified: false, status: "FAILED", orderId })
      }
      if (gatewayPayment.status !== "captured") {
        return res.status(202).json({
          success: true,
          verified: false,
          status: "PENDING",
          orderId,
          message: "Payment confirmation is still pending.",
        })
      }
      const status = await processRazorpayPaymentEvent({
        eventType: "payment.captured",
        gatewayOrderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        amount: Number(gatewayPayment.amount),
        currency: gatewayPayment.currency || "",
      })
      if (status !== "PAID") {
        return res
          .status(202)
          .json({ success: true, verified: false, status, orderId })
      }
      return res.status(200).json({
        success: true,
        verified: true,
        orderId,
        paymentId: razorpayPaymentId,
        status: "PAID",
        orderStatus: order.status,
        message:
          "Payment verified successfully. Your order is waiting for kitchen staff.",
      })
    } catch (error: unknown) {
      console.error(
        "Error verifying payment:",
        error instanceof Error ? error.message : "Unknown error",
      )
      return res
        .status(500)
        .json({
          success: false,
          verified: false,
          error: "Unable to verify payment. Please try again.",
        })
    }
  },
)

/**
 * Verifies Razorpay webhooks against the exact request body and processes them once.
 * POST /api/payments/webhook
 */

paymentsRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"]
    const eventId = req.headers["x-razorpay-event-id"]
    if (!isRazorpayTestConfigured() || !razorpay) {
      return paymentUnavailable(res)
    }
    if (
      typeof signature !== "string" ||
      typeof eventId !== "string" ||
      eventId.length === 0 ||
      eventId.length > 200 ||
      !req.rawBody
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid webhook request." })
    }
    if (
      !isValidHexHmac(req.rawBody, signature, config.razorpay.webhookSecret)
    ) {
      console.warn("Rejected Razorpay webhook with invalid signature.")
      return res
        .status(400)
        .json({ success: false, error: "Invalid webhook signature." })
    }
    const eventType = req.body?.event
    if (!["payment.captured", "payment.failed"].includes(eventType)) {
      return res.status(200).json({ status: "ignored" })
    }
    const payment = req.body?.payload?.payment?.entity
    if (
      typeof payment?.order_id !== "string" ||
      typeof payment?.id !== "string" ||
      !Number.isInteger(payment?.amount) ||
      typeof payment?.currency !== "string"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid payment event payload." })
    }
    let failureIsFinal = true
    if (eventType === "payment.failed") {
      const attempts = await razorpay.orders.fetchPayments(payment.order_id)
      const attemptSummary = classifyPaymentAttempts(
        attempts.items || [],
        payment.order_id,
        payment.amount,
        payment.currency,
      )
      failureIsFinal = attemptSummary.failureIsFinal
    }
    const status = await processRazorpayPaymentEvent({
      eventId,
      eventType,
      gatewayOrderId: payment.order_id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      failureReason: payment.error_description,
      failureIsFinal,
    })
    return res.status(200).json({ status: status.toLowerCase() })
  } catch (error: unknown) {
    console.error(
      "Razorpay webhook processing failed:",
      error instanceof Error ? error.message : "Unknown error",
    )
    return res
      .status(500)
      .json({ success: false, error: "Webhook processing failed." })
  }
})

/**
 * Returns the payment status only to the authenticated owner of an order.
 * GET /api/payments/status/:orderId
 */

paymentsRouter.get(
  "/status/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orderId = Array.isArray(req.params.orderId)
        ? req.params.orderId[0]
        : req.params.orderId
      const order = await getOrderById(orderId)
      if (!order || order.user_id !== req.user!.id) {
        return res
          .status(404)
          .json({ success: false, error: "Order not found." })
      }
      let payment = await getLatestPaymentForOrder(order.id)
      if (
        order.payment_status !== "PAID" &&
        payment?.gateway === "razorpay" &&
        payment.gateway_order_id &&
        isRazorpayTestConfigured() &&
        razorpay
      ) {
        const gatewayPayments = await razorpay.orders.fetchPayments(
          payment.gateway_order_id,
        )
        const attemptSummary = classifyPaymentAttempts(
          gatewayPayments.items || [],
          payment.gateway_order_id,
          payment.amount,
          payment.currency,
        )
        const capturedPayment = attemptSummary.captured
        const settledFailure = attemptSummary.failureIsFinal
          ? attemptSummary.matching[0]
          : null
        const paymentToApply = capturedPayment || settledFailure
        if (paymentToApply) {
          await processRazorpayPaymentEvent({
            eventType: capturedPayment ? "payment.captured" : "payment.failed",
            gatewayOrderId: payment.gateway_order_id,
            paymentId: paymentToApply.id,
            amount: Number(paymentToApply.amount),
            currency: paymentToApply.currency || "",
            failureReason: paymentToApply.error_description || undefined,
          })
        }
        payment = await getLatestPaymentForOrder(order.id)
      }
      const refreshedOrder = await getOrderById(order.id)
      return res.status(200).json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentMethod: order.payment,
        paymentStatus: refreshedOrder?.payment_status || order.payment_status,
        paymentFailureReason: payment?.failure_reason || null,
        orderStatus: refreshedOrder?.status || order.status,
        stage: refreshedOrder?.stage ?? order.stage,
        total: order.total,
      })
    } catch (error: unknown) {
      console.error(
        "Error checking payment status:",
        error instanceof Error ? error.message : "Unknown error",
      )
      return res
        .status(500)
        .json({ success: false, error: "Unable to check payment status." })
    }
  },
)
