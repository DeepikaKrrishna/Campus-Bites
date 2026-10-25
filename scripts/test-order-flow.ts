import dotenv from 'dotenv'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const BASE_URL = 'http://localhost:5001'
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Secure test tokens recognized by server in test/development mode
const STAFF_AUTH_HEADER = {
  Authorization: 'Bearer test_staff_token_secret_2026',
}

function getCustomerAuthHeader(customerId: string) {
  return {
    Authorization: `Bearer test_customer_token:${customerId}`,
  }
}

async function runTests() {
  console.log('======================================================================')
  console.log('🧪 RUNNING CAMPUSBITES SECURITY & INTEGRATION TEST SUITE')
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
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-001'),
      },
      body: JSON.stringify({
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
        userId: 'student-001',
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
        userId: 'student-001',
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
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-cash'),
      },
      body: JSON.stringify({
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
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-upi'),
      },
      body: JSON.stringify({
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
  // TEST 5: Order Lifecycle State Machine Progression & Security Checks
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Order Lifecycle State Machine Progression & Security ---')
  try {
    // 5a. Unauthenticated status update must be rejected with HTTP 401
    const unauthStatusRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'PREPARING' }),
    })
    assert(unauthStatusRes.status === 401, 'Unauthenticated status update rejected with HTTP 401')

    // 5b. Header-length spoofing (e.g. random token without Bearer) must be rejected
    const spoofHeaderRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'random_spoofed_header_longer_than_20_chars',
      },
      body: JSON.stringify({ newStatus: 'PREPARING' }),
    })
    assert(spoofHeaderRes.status === 401, 'Arbitrary long authorization header rejected with HTTP 401')

    // 5c. Customer token trying to advance kitchen stage must be rejected with HTTP 403 Forbidden
    const customerForbiddenRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-upi'),
      },
      body: JSON.stringify({ newStatus: 'PREPARING' }),
    })
    assert(customerForbiddenRes.status === 403, 'Customer token advancing kitchen stage rejected with HTTP 403')

    // 5d. Test Invalid Transition by staff (Jumping from ACCEPTED to PICKED_UP)
    const invalidJumpRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({
        newStatus: 'PICKED_UP',
      }),
    })
    assert(invalidJumpRes.status === 400, 'Illegal jump transition (ACCEPTED -> PICKED_UP) rejected with HTTP 400')

    // 5e. Transition 1: ACCEPTED -> PREPARING (by verified staff)
    const prepRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({
        newStatus: 'PREPARING',
        note: 'Chef started cooking fresh meal in kitchen',
      }),
    })
    const prepData = await prepRes.json()
    assert(prepRes.status === 200, 'Staff transitioned to PREPARING successfully')
    assert(prepData.order.status === 'PREPARING', 'Order status is now PREPARING')
    assert(prepData.order.stage === 2, 'Order stage is 2')

    // 5f. Transition 2: PREPARING -> READY_FOR_PICKUP (by verified staff)
    const readyRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({
        newStatus: 'READY_FOR_PICKUP',
        note: 'Order packed in eco-box and placed at Counter 2 window',
      }),
    })
    const readyData = await readyRes.json()
    assert(readyRes.status === 200, 'Transitioned to READY_FOR_PICKUP successfully')
    assert(readyData.order.status === 'READY_FOR_PICKUP', 'Order status is READY_FOR_PICKUP')
    assert(readyData.order.stage === 3, 'Order stage is 3')

    // 5g. Transition 3: READY_FOR_PICKUP -> PICKED_UP (by verified staff)
    const completeRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({
        newStatus: 'PICKED_UP',
        note: 'Token verified and meal handed over to student',
      }),
    })
    const completeData = await completeRes.json()
    assert(completeRes.status === 200, 'Transitioned to PICKED_UP (Terminal stage) successfully')
    assert(completeData.order.status === 'PICKED_UP', 'Order status is PICKED_UP')
    assert(completeData.order.stage === 4, 'Order stage is 4')

    // 5h. Terminal state cannot transition further
    const afterTerminalRes = await fetch(`${BASE_URL}/api/orders/${upiOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({
        newStatus: 'CANCELLED',
      }),
    })
    assert(afterTerminalRes.status === 400, 'Cannot transition terminal order (PICKED_UP -> CANCELLED)')
  } catch (e: any) {
    assert(false, `State machine exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 6: Order Cancellation Flow & Access Controls
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Order Cancellation Flow & Access Controls ---')
  try {
    const cancelTargetRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-alice'),
      },
      body: JSON.stringify({
        items: [{ id: 4, quantity: 1 }],
        paymentMethod: 'cash',
      }),
    })
    const cancelTarget = await cancelTargetRes.json()

    // 6a. Stranger cannot cancel Alice's order (HTTP 403)
    const strangerCancelRes = await fetch(`${BASE_URL}/api/orders/${cancelTarget.orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-bob-stranger'),
      },
      body: JSON.stringify({
        newStatus: 'CANCELLED',
        reason: 'Attempting malicious cancel',
      }),
    })
    assert(strangerCancelRes.status === 403, "Stranger cannot cancel another user's order (HTTP 403)")

    // 6b. Legitimate owner (Alice) CAN cancel her own order while PLACED
    const aliceCancelRes = await fetch(`${BASE_URL}/api/orders/${cancelTarget.orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-alice'),
      },
      body: JSON.stringify({
        newStatus: 'CANCELLED',
        reason: 'Lecture rescheduled',
      }),
    })
    const cancelData = await aliceCancelRes.json()
    assert(aliceCancelRes.status === 200, 'Owner successfully cancelled PLACED order')
    assert(cancelData.order.status === 'CANCELLED', 'Order status is CANCELLED')
    assert(cancelData.order.cancellation_reason === 'Lecture rescheduled', 'Cancellation reason saved')

    // 6c. Customer CANNOT cancel after kitchen accepted / prepared order
    const prepOrderRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-carol'),
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        paymentMethod: 'cash',
      }),
    })
    const prepOrder = await prepOrderRes.json()

    // Staff accepts it
    await fetch(`${BASE_URL}/api/orders/${prepOrder.orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...STAFF_AUTH_HEADER },
      body: JSON.stringify({ newStatus: 'ACCEPTED' }),
    })

    // Carol tries to cancel now -> rejected with 403
    const lateCancelRes = await fetch(`${BASE_URL}/api/orders/${prepOrder.orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-carol'),
      },
      body: JSON.stringify({ newStatus: 'CANCELLED' }),
    })
    assert(lateCancelRes.status === 403, 'Customer cannot cancel order once kitchen has accepted it (HTTP 403)')
  } catch (e: any) {
    assert(false, `Cancellation exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 7: Staff Cash Collection Access Control
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Staff Cash Collection Access Control ---')
  try {
    // 7a. Customer cannot collect cash (HTTP 403)
    const customerCollectRes = await fetch(`${BASE_URL}/api/orders/${cashOrderId}/collect-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getCustomerAuthHeader('student-cash'),
      },
      body: JSON.stringify({}),
    })
    assert(customerCollectRes.status === 403, 'Customer rejected from cash collection with HTTP 403')

    // 7b. Verified staff can collect cash (HTTP 200)
    const staffCollectRes = await fetch(`${BASE_URL}/api/orders/${cashOrderId}/collect-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...STAFF_AUTH_HEADER,
      },
      body: JSON.stringify({}),
    })
    const collectData = await staffCollectRes.json()
    assert(staffCollectRes.status === 200, 'Authorized staff collected cash with HTTP 200')
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
  // TEST 9: Staff Dashboard Endpoints Access Control
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Staff Dashboard Endpoints Access Control ---')
  try {
    // 9a. Unauthenticated GET /api/staff/orders must return HTTP 401
    const unauthOrdersRes = await fetch(`${BASE_URL}/api/staff/orders`)
    assert(unauthOrdersRes.status === 401, 'Unauthenticated staff orders request returns HTTP 401')

    // 9b. Customer token GET /api/staff/orders must return HTTP 403 Forbidden
    const customerStaffOrdersRes = await fetch(`${BASE_URL}/api/staff/orders`, {
      headers: getCustomerAuthHeader('student-001'),
    })
    assert(customerStaffOrdersRes.status === 403, 'Customer token requesting staff orders returns HTTP 403')

    // 9c. Verified Staff token GET /api/staff/orders must return HTTP 200
    const staffOrdersRes = await fetch(`${BASE_URL}/api/staff/orders`, {
      headers: STAFF_AUTH_HEADER,
    })
    const staffOrdersData = await staffOrdersRes.json()
    assert(staffOrdersRes.status === 200, 'Verified staff token retrieves staff orders with HTTP 200')
    assert(Array.isArray(staffOrdersData.orders), 'Staff orders returns array of persisted orders')

    // 9d. Unauthenticated GET /api/staff/stats must return HTTP 401
    const unauthStatsRes = await fetch(`${BASE_URL}/api/staff/stats`)
    assert(unauthStatsRes.status === 401, 'Unauthenticated stats request returns HTTP 401')

    // 9e. Verified Staff token GET /api/staff/stats must return HTTP 200
    const statsRes = await fetch(`${BASE_URL}/api/staff/stats`, {
      headers: STAFF_AUTH_HEADER,
    })
    const statsData = await statsRes.json()
    assert(statsRes.status === 200, 'Staff stats endpoint responds with HTTP 200 for staff token')
    assert(typeof statsData.stats.pickedUp === 'number', 'Queue statistics calculated accurately')
  } catch (e: any) {
    assert(false, `Staff dashboard exception: ${e.message}`)
  }

  // -------------------------------------------------------------------------
  // TEST 10: User Order History Privacy
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: User Order History Privacy ---')
  try {
    // 10a. Unauthenticated request to user orders returns 401
    const unauthRes = await fetch(`${BASE_URL}/api/orders/user/student-alice`)
    assert(unauthRes.status === 401, 'Unauthenticated access to user orders returns HTTP 401')

    // 10b. Student Bob cannot view Student Alice orders (HTTP 403)
    const bobRes = await fetch(`${BASE_URL}/api/orders/user/student-alice`, {
      headers: getCustomerAuthHeader('student-bob'),
    })
    assert(bobRes.status === 403, "Student Bob viewing Alice's order history returns HTTP 403")

    // 10c. Student Alice can view her own orders (HTTP 200)
    const aliceRes = await fetch(`${BASE_URL}/api/orders/user/student-alice`, {
      headers: getCustomerAuthHeader('student-alice'),
    })
    assert(aliceRes.status === 200, 'Student Alice viewing own order history returns HTTP 200')

    // 10d. Staff can view student orders (HTTP 200)
    const staffViewRes = await fetch(`${BASE_URL}/api/orders/user/student-alice`, {
      headers: STAFF_AUTH_HEADER,
    })
    assert(staffViewRes.status === 200, 'Staff viewing customer order history returns HTTP 200')
  } catch (e: any) {
    assert(false, `Order privacy exception: ${e.message}`)
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
