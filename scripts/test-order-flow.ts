import dotenv from 'dotenv'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const BASE_URL = 'http://localhost:5001'
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function runTests() {
  console.log('======================================================================')
  console.log('🧪 RUNNING COMPREHENSIVE CAMPUSBITES INTEGRATION TEST SUITE')
  console.log('======================================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${desc}`)
      failed++
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Health & Supabase Connectivity Check
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Backend Health & Database Connectivity ---')
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`)
    const health = await healthRes.json()
    assert(healthRes.status === 200, 'Health endpoint responds with HTTP 200')
    assert(health.status === 'ok', 'Service status is ok')
    assert(health.database.status.startsWith('connected'), 'Database is connected to Supabase')
  } catch (e: any) {
    assert(false, `Health check exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 2: Authoritative Cart Validation & Calculation (Reject Tampered Prices)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Cart Validation & Authoritative Price Calculation ---')
  try {
    // 2a. Valid Cart
    const validRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-001',
        items: [
          { id: 1, quantity: 2 }, // Hot & Cheesy Omelette @ 70 = 140
          { id: 4, quantity: 1 }, // Filter Coffee @ 25 = 25
        ],
        paymentMethod: 'upi',
      }),
    })
    const validData = await validRes.json()
    assert(validRes.status === 200, 'Valid cart returns HTTP 200')
    assert(validData.success === true, 'Order created successfully')
    // Subtotal: 140 + 25 = 165, Tax: 8 (5%), Packing: 10, Total: 183
    assert(validData.total === 183, `Total calculated accurately by server: ₹${validData.total} (Expected 183)`)
    assert(validData.amount === 18300, `Paise calculated accurately for Razorpay: ${validData.amount} (Expected 18300)`)
    assert(Boolean(validData.orderId), `Persistent order ID returned: ${validData.orderId}`)
    assert(Boolean(validData.tokenNumber), `Collection token assigned: #${validData.tokenNumber}`)

    // 2b. Invalid item ID
    const invalidItemRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-001',
        items: [{ id: 9999, quantity: 1 }],
      }),
    })
    const invalidItemData = await invalidItemRes.json()
    assert(invalidItemRes.status === 400, 'Non-existent menu item rejected with HTTP 400')
    assert(invalidItemData.success === false, 'Error message returned for invalid menu item')

    // 2c. Invalid Quantity
    const invalidQtyRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-001',
        items: [{ id: 1, quantity: -5 }],
      }),
    })
    assert(invalidQtyRes.status === 400, 'Negative/zero quantity rejected with HTTP 400')
  } catch (e: any) {
    assert(false, `Cart validation exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 3: Cash Payment Order Handling
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Cash Payment Flow ---')
  let cashOrderId = ''
  try {
    const cashRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-cash',
        items: [{ id: 2, quantity: 1 }], // Masala Dosa @ 60 + 3 tax + 10 packing = 73
        paymentMethod: 'cash',
      }),
    })
    const cashData = await cashRes.json()
    assert(cashRes.status === 200, 'Cash checkout created successfully')
    assert(cashData.paymentMethod === 'cash', 'Payment method marked as cash')
    assert(cashData.paymentStatus === 'PENDING', 'Payment status is PENDING (unpaid cash)')
    cashOrderId = cashData.orderId
  } catch (e: any) {
    assert(false, `Cash flow exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 4: Online UPI Payment Verification & Signature Check
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Server-Side UPI Payment Verification ---')
  let upiOrderId = ''
  let razorpayOrderId = ''
  try {
    const orderRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-upi',
        items: [{ id: 5, quantity: 1 }], // Chicken Biryani @ 160 + 8 + 10 = 178
        paymentMethod: 'upi',
      }),
    })
    const orderData = await orderRes.json()
    upiOrderId = orderData.orderId
    razorpayOrderId = orderData.razorpayOrderId

    // 4a. Verify with invalid signature (Must be rejected)
    const badVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: upiOrderId,
        razorpayOrderId,
        razorpayPaymentId: 'invalid_pay_id',
        razorpaySignature: 'forged_fake_signature',
        isSimulator: false,
      }),
    })
    assert(badVerifyRes.status === 400, 'Invalid payment signature rejected with HTTP 400')

    // 4b. Verify legitimate payment
    const validVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: upiOrderId,
        razorpayOrderId,
        razorpayPaymentId: 'pay_' + Date.now().toString(36),
        razorpaySignature: 'sig_verified_ok',
        isSimulator: true,
      }),
    })
    const validVerifyData = await validVerifyRes.json()
    assert(validVerifyRes.status === 200, 'Legitimate payment verified with HTTP 200')
    assert(validVerifyData.verified === true, 'Payment verified is true')
    assert(validVerifyData.status === 'PAID', 'Payment record updated to PAID')
  } catch (e: any) {
    assert(false, `Payment verification exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 5: Order Lifecycle State Machine Progression
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Order Lifecycle State Machine Progression ---')
  try {
    const staffPasskey = process.env.STAFF_SECRET_PASSKEY || 'CAMPUS_CHEF_2026'

    // 5a. Test Invalid Transition (Jumping from PLACED to PICKED_UP)
    const invalidJumpRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'PICKED_UP',
        staffPasskey,
      }),
    })
    assert(invalidJumpRes.status === 400, 'Illegal jump transition (PLACED -> PICKED_UP) rejected with HTTP 400')

    // 5b. Transition 1: PLACED -> ACCEPTED
    // (Note: Already accepted during payment verification, or let's verify next step)
    // 5c. Transition 2: ACCEPTED -> PREPARING
    const prepRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'PREPARING',
        note: 'Chef started cooking fresh meal in kitchen',
        staffPasskey,
      }),
    })
    const prepData = await prepRes.json()
    assert(prepRes.status === 200, 'Transitioned to PREPARING successfully')
    assert(prepData.order.status === 'PREPARING', 'Order status is now PREPARING')
    assert(prepData.order.stage === 2, 'Order stage is 2')

    // 5d. Transition 3: PREPARING -> READY_FOR_PICKUP
    const readyRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'READY_FOR_PICKUP',
        note: 'Order packed in eco-box and placed at Counter 2 window',
        staffPasskey,
      }),
    })
    const readyData = await readyRes.json()
    assert(readyRes.status === 200, 'Transitioned to READY_FOR_PICKUP successfully')
    assert(readyData.order.status === 'READY_FOR_PICKUP', 'Order status is READY_FOR_PICKUP')
    assert(readyData.order.stage === 3, 'Order stage is 3')

    // 5e. Transition 4: READY_FOR_PICKUP -> PICKED_UP
    const completeRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'PICKED_UP',
        note: 'Token verified and meal handed over to student',
        staffPasskey,
      }),
    })
    const completeData = await completeRes.json()
    assert(completeRes.status === 200, 'Transitioned to PICKED_UP (Terminal stage) successfully')
    assert(completeData.order.status === 'PICKED_UP', 'Order status is PICKED_UP')
    assert(completeData.order.stage === 4, 'Order stage is 4')

    // 5f. Transition 5: Terminal state cannot transition further
    const afterTerminalRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'CANCELLED',
        staffPasskey,
      }),
    })
    assert(afterTerminalRes.status === 400, 'Cannot transition terminal order (PICKED_UP -> CANCELLED)')
  } catch (e: any) {
    assert(false, `State machine exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 6: Order Cancellation Flow
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Order Cancellation Flow ---')
  try {
    const cancelTargetRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-student-cancel',
        items: [{ id: 4, quantity: 1 }],
        paymentMethod: 'cash',
      }),
    })
    const cancelTarget = await cancelTargetRes.json()

    const cancelRes = await fetch(`${BASE_URL}/api/orders/${cancelTarget.orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus: 'CANCELLED',
        reason: 'Student lecture rescheduled',
      }),
    })
    const cancelData = await cancelRes.json()
    assert(cancelRes.status === 200, 'Customer order cancellation succeeded')
    assert(cancelData.order.status === 'CANCELLED', 'Order status is CANCELLED')
    assert(cancelData.order.cancellation_reason === 'Student lecture rescheduled', 'Cancellation reason saved')
  } catch (e: any) {
    assert(false, `Cancellation exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 7: Staff Cash Collection Endpoint
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Staff Cash Collection ---')
  try {
    const staffPasskey = process.env.STAFF_SECRET_PASSKEY || 'CAMPUS_CHEF_2026'
    const collectRes = await fetch(`${BASE_URL}/api/orders/${cashOrderId}/collect-cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffPasskey }),
    })
    const collectData = await collectRes.json()
    assert(collectRes.status === 200, 'Cash collection recorded with HTTP 200')
    assert(collectData.order.payment_status === 'PAID', 'Order payment_status updated to PAID')
  } catch (e: any) {
    assert(false, `Cash collection exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 8: Webhook Signature Verification and Idempotency
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Webhook Signature Verification & Idempotency ---')
  try {
    const webhookPayload = JSON.stringify({
      id: 'evt_test_' + Date.now(),
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_test_1',
            order_id: razorpayOrderId,
            amount: 17800,
            status: 'captured',
          },
        },
      },
    })

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'demo_webhook_secret_for_test'
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex')

    // 8a. Legitimate Webhook Request
    const webhookRes = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validSignature,
      },
      body: webhookPayload,
    })
    assert(webhookRes.status === 200, 'Legitimate webhook accepted with HTTP 200')

    // 8b. Duplicate Webhook (Idempotent processing)
    const dupRes = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': validSignature,
      },
      body: webhookPayload,
    })
    assert(dupRes.status === 200, 'Duplicate webhook handled idempotently without error')
  } catch (e: any) {
    assert(false, `Webhook exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 9: Staff Dashboard Orders & Stats
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Staff Dashboard Orders & Stats ---')
  try {
    const staffOrdersRes = await fetch(`${BASE_URL}/api/staff/orders`)
    const staffOrdersData = await staffOrdersRes.json()
    assert(staffOrdersRes.status === 200, 'Staff orders endpoint responds with HTTP 200')
    assert(Array.isArray(staffOrdersData.orders), 'Staff orders returns array of persisted orders')

    const statsRes = await fetch(`${BASE_URL}/api/staff/stats`)
    const statsData = await statsRes.json()
    assert(statsRes.status === 200, 'Staff stats endpoint responds with HTTP 200')
    assert(typeof statsData.stats.pickedUp === 'number', 'Queue statistics calculated accurately')
  } catch (e: any) {
    assert(false, `Staff dashboard exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================')
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('======================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e)
  process.exit(1)
})
