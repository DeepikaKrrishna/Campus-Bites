import { Router, type Request, type Response } from "express"
import crypto from "crypto"
import Razorpay from "razorpay"
import { config, isRazorpayTestConfigured } from "../config"
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

const razorpay = isRazorpayTestConfigured()
  ? new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    })
  : null

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

paymentsRouter.post(
  "/create-order",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { items, paymentMethod = "upi", orderId } = req.body
      if (!["upi", "card", "cash"].includes(paymentMethod)) {
        return res
          .status(400)
          .json({ success: false, error: "Unsupported payment method." })
      }
      if (orderId !== undefined) {
        if (typeof orderId !== "string" || paymentMethod === "cash") {
          return res
            .status(400)
            .json({ success: false, error: "Invalid payment retry request." })
        }
        if (!isRazorpayTestConfigured() || !razorpay)
          return paymentUnavailable(res)
        const order = await getOrderById(orderId)
        if (!order || order.user_id !== req.user!.id) {
          return res
            .status(404)
            .json({ success: false, error: "Order not found." })
        }
        if (!orderIsPayable(order) || order.payment === "cash") {
          return res
            .status(409)
            .json({
              success: false,
              error: "This order is not eligible for payment.",
            })
        }
        const previousPayment = await getLatestPaymentForOrder(order.id)
        if (
          !previousPayment ||
          previousPayment.gateway !== "razorpay" ||
          previousPayment.status !== "FAILED" ||
          !previousPayment.gateway_order_id
        ) {
          return res.status(409).json({
            success: false,
            error:
              "Payment is not confirmed as failed yet. Check its status before retrying.",
          })
        }
        const previousAttempts = await razorpay.orders.fetchPayments(
          previousPayment.gateway_order_id,
        )
        const attemptSummary = classifyPaymentAttempts(
          previousAttempts.items || [],
          previousPayment.gateway_order_id,
          previousPayment.amount,
          previousPayment.currency,
        )
        if (attemptSummary.captured) {
          await processRazorpayPaymentEvent({
            eventType: "payment.captured",
            gatewayOrderId: previousPayment.gateway_order_id,
            paymentId: attemptSummary.captured.id,
            amount: Number(attemptSummary.captured.amount),
            currency: attemptSummary.captured.currency || "",
          })
          return res
            .status(409)
            .json({ success: false, error: "This order is already paid." })
        }
        if (!attemptSummary.failureIsFinal) {
          return res.status(409).json({
            success: false,
            error:
              "A previous payment is still being processed. Check its status before retrying.",
          })
        }
        const amountInPaise = Math.round(Number(order.total) * 100)
        if (
          previousPayment.amount !== amountInPaise ||
          previousPayment.currency !== "INR"
        ) {
          return res
            .status(409)
            .json({
              success: false,
              error: "Saved payment amount no longer matches this order.",
            })
        }
        const gatewayOrder = await razorpay.orders.fetch(
          previousPayment.gateway_order_id,
        )
        if (
          !["created", "attempted"].includes(gatewayOrder.status) ||
          gatewayOrder.amount !== amountInPaise ||
          gatewayOrder.currency !== "INR"
        ) {
          return res
            .status(409)
            .json({
              success: false,
              error: "This Razorpay order is no longer eligible for payment.",
            })
        }
        await updatePaymentRecord(previousPayment.gateway_order_id, {
          status: "PENDING",
          gateway_payment_id: null,
          failure_reason: null,
          verified_at: null,
        })
        await updateOrderRecord(order.id, { payment_status: "PENDING" })
        return res.status(201).json({
          success: true,
          orderId: order.id,
          orderNumber: order.order_number,
          tokenNumber: order.token_number,
          razorpayOrderId: previousPayment.gateway_order_id,
          amount: amountInPaise,
          currency: "INR",
          keyId: config.razorpay.keyId,
          etaMinutes: order.eta_minutes,
        })
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Order items are required." })
      }
      const menu = await getAuthoritativeMenu()
      const validation = validateCartAndCalculateTotals(items, menu)
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error })
      }
      const { validatedItems, subtotal, tax, packing, total, amountInPaise } =
        validation
      const orderNumber = genOrderNumber()
      const tokenNumber = genTokenNumber()
      const itemCount = validatedItems.reduce(
        (count, item) => count + item.quantity,
        0,
      )
      const etaMinutes = Math.min(35, Math.max(10, 7 + itemCount * 3))
      const estimatedReadyAt = new Date(
        Date.now() + etaMinutes * 60 * 1000,
      ).toISOString()
      const campusOrderId = crypto.randomUUID()
      const orderPayload = {
        id: campusOrderId,
        user_id: req.user!.id,
        order_number: orderNumber,
        token_number: tokenNumber,
        items: validatedItems,
        subtotal,
        tax,
        packing,
        total,
        currency: "INR",
        payment: paymentMethod,
        payment_status: "PENDING",
        status: "PLACED",
        stage: 0,
        eta_minutes: etaMinutes,
        estimated_ready_at: estimatedReadyAt,
      }
      if (paymentMethod === "cash") {
        const savedOrder = await saveOrder(orderPayload)
        await savePaymentRecord({
          order_id: savedOrder.id,
          user_id: req.user!.id,
          gateway: "cash",
          amount: amountInPaise,
          currency: "INR",
          status: "PENDING",
          payment_method: "cash",
        })
        return res.status(201).json({
          success: true,
          orderId: savedOrder.id,
          orderNumber,
          tokenNumber,
          amount: total,
          total,
          currency: "INR",
          paymentMethod: "cash",
          paymentStatus: "PENDING",
          isCash: true,
          etaMinutes,
          message:
            "Order placed with Cash payment. Please pay at counter upon pickup.",
        })
      }
      if (!isRazorpayTestConfigured() || !razorpay)
        return paymentUnavailable(res)
      const gatewayOrder = await createRazorpayOrder({
        orderId: campusOrderId,
        orderNumber,
        tokenNumber,
        userId: req.user!.id,
        amount: amountInPaise,
      })
      const savedOrder = await saveOrder(orderPayload)
      await savePaymentRecord({
        order_id: savedOrder.id,
        user_id: req.user!.id,
        gateway: "razorpay",
        gateway_order_id: gatewayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        status: "PENDING",
        payment_method: paymentMethod,
      })
      return res.status(201).json({
        success: true,
        orderId: savedOrder.id,
        orderNumber,
        tokenNumber,
        razorpayOrderId: gatewayOrder.id,
        amount: amountInPaise,
        total,
        currency: "INR",
        keyId: config.razorpay.keyId,
        etaMinutes,
      })
    } catch (error: unknown) {
      console.error(
        "Error creating payment order:",
        error instanceof Error ? error.message : "Unknown error",
      )
      return res
        .status(500)
        .json({
          success: false,
          error: "Unable to create payment order. Please try again.",
        })
    }
  },
)

/**
 * Verifies the checkout signature and the authoritative Razorpay payment.
 * POST /api/payments/verify
 */

paymentsRouter.post(
  "/verify",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        req.body
      if (
        typeof orderId !== "string" ||
        typeof razorpayOrderId !== "string" ||
        typeof razorpayPaymentId !== "string" ||
        typeof razorpaySignature !== "string"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            verified: false,
            error: "Invalid payment verification details.",
          })
      }
      if (!isRazorpayTestConfigured() || !razorpay)
        return paymentUnavailable(res)
      const order = await getOrderById(orderId)
      if (!order || order.user_id !== req.user!.id) {
        return res
          .status(404)
          .json({ success: false, verified: false, error: "Order not found." })
      }
      const paymentRecord = await getPaymentRecord(razorpayOrderId)
      if (
        !paymentRecord ||
        paymentRecord.order_id !== order.id ||
        paymentRecord.user_id !== req.user!.id ||
        paymentRecord.gateway !== "razorpay"
      ) {
        return res
          .status(404)
          .json({
            success: false,
            verified: false,
            error: "Payment order not found.",
          })
      }
      const signedPayload = `${razorpayOrderId}|${razorpayPaymentId}`
      if (
        !isValidHexHmac(
          signedPayload,
          razorpaySignature,
          config.razorpay.keySecret,
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
      if (gatewayPayment.status === "authorized") {
        return res.status(202).json({
          success: true,
          verified: false,
          status: "PENDING",
          orderId,
          message: "Payment is authorized and awaiting capture confirmation.",
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
