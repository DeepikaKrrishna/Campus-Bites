import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import http from 'http'
import { createClient } from '@supabase/supabase-js'
import staffOrdersHandler from '../api/staff/orders'

process.env.NODE_ENV = 'test'
process.env.ENABLE_TEST_AUTH = 'true'

const TEST_PORT = 8799
const BASE_URL = `http://localhost:${TEST_PORT}`

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, serviceKey)

const STAFF_TOKEN = 'test_staff_token_secret_2026'

async function runSuite() {
  console.log('======================================================================')
  console.log('🧪 STAFF DASHBOARD INTEGRATION & SECURITY TEST SUITE')
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

  // 1. Start test server
  const app = express()
  app.use(express.json())

  app.all('/api/staff/orders', async (req: Request, res: Response) => {
    const query = Object.fromEntries(new URL(req.originalUrl, 'http://localhost').searchParams)
    try {
      await staffOrdersHandler(
        {
          method: req.method,
          headers: req.headers,
          query,
          body: req.body,
        },
        res as never
      )
    } catch (err) {
      console.error('Test server error:', err)
      res.status(500).json({ success: false, error: 'Internal test server error' })
    }
  })

  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()))
  console.log(`Test API listening at ${BASE_URL}\n`)

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Unauthenticated request must return 401 Unauthorized
    // -----------------------------------------------------------------------
    console.log('--- TEST 1: Authentication Enforcement ---')
    const noAuthRes = await fetch(`${BASE_URL}/api/staff/orders`)
    const noAuthData = await noAuthRes.json()
    assert(noAuthRes.status === 401, 'Request without authorization header returns HTTP 401')
    assert(noAuthData.success === false, 'noAuthData.success is false')

    // -----------------------------------------------------------------------
    // TEST 2: Student / Non-staff user must return 403 Forbidden
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 2: Staff Role Authorization Barrier ---')
    const studentRes = await fetch(`${BASE_URL}/api/staff/orders`, {
      headers: {
        Authorization: 'Bearer invalid_or_student_jwt_token_sample',
      },
    })
    const studentData = await studentRes.json()
    assert(studentRes.status === 403, 'Unauthorized student account rejected with HTTP 403 Forbidden')
    assert(studentData.error.includes('authorized for staff access'), 'Error explains staff authorization required')

    // -----------------------------------------------------------------------
    // TEST 3: Authorized staff can view orders list with customer information
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 3: Staff Order Retrieval & Data Enrichment ---')
    const staffRes = await fetch(`${BASE_URL}/api/staff/orders`, {
      headers: {
        Authorization: `Bearer ${STAFF_TOKEN}`,
      },
    })
    const staffData = await staffRes.json()
    assert(staffRes.status === 200, 'Authorized staff receives HTTP 200')
    assert(staffData.success === true, 'staffData.success is true')
    assert(Array.isArray(staffData.orders), 'Orders returned as an array')
    console.log(`  ℹ Loaded ${staffData.orders.length} orders from Supabase database`)

    // -----------------------------------------------------------------------
    // TEST 4: Create a real test order in Supabase to test state machine transitions
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 4: Order Creation & Life Cycle Transitions ---')
    const testOrderNumber = `CB-TEST-${Date.now().toString().slice(-5)}`
    const testToken = Math.floor(10 + Math.random() * 89)

    // Fetch an existing authenticated user ID from Supabase
    const { data: anyOrder } = await supabaseAdmin.from('orders').select('user_id').limit(1).maybeSingle()
    const validUserId = anyOrder?.user_id || 'd40fbff0-792e-4609-9b00-b5db8bf317cc'

    // Insert test order via admin client
    const { data: createdOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: testOrderNumber,
        token_number: testToken,
        user_id: validUserId,
        items: [
          { id: 1, name: 'Hot & Cheesy Omelette', price: 70, quantity: 1, subtotal: 70 },
          { id: 4, name: 'Filter Coffee', price: 25, quantity: 1, subtotal: 25 },
        ],
        subtotal: 95,
        tax: 5,
        packing: 10,
        total: 110,
        currency: 'INR',
        payment: 'upi',
        payment_status: 'PAID',
        status: 'PLACED',
        stage: 0,
        eta_minutes: 15,
      })
      .select()
      .single()

    if (insertError || !createdOrder) {
      assert(false, `Failed to setup test order in Supabase: ${insertError?.message}`)
    } else {
      assert(Boolean(createdOrder.id), `Created test order ${testOrderNumber} (ID: ${createdOrder.id})`)

      const orderId = createdOrder.id

      // 4a. Transition 1: Accept Order (PLACED -> ACCEPTED)
      const acceptRes = await fetch(`${BASE_URL}/api/staff/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STAFF_TOKEN}`,
        },
        body: JSON.stringify({
          orderId,
          newStatus: 'ACCEPTED',
        }),
      })
      const acceptData = await acceptRes.json()
      assert(acceptRes.status === 200, 'Staff accepted order with HTTP 200')
      assert(acceptData.success === true, 'acceptData.success is true')
      assert(acceptData.order.status === 'ACCEPTED', 'Order status moved to ACCEPTED')
      assert(acceptData.order.stage === 1, 'Order stage is 1')

      // 4b. Transition 2: Start Preparing (ACCEPTED -> PREPARING)
      const prepRes = await fetch(`${BASE_URL}/api/staff/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STAFF_TOKEN}`,
        },
        body: JSON.stringify({
          orderId,
          newStatus: 'PREPARING',
        }),
      })
      const prepData = await prepRes.json()
      assert(prepRes.status === 200, 'Staff moved order to PREPARING with HTTP 200')
      assert(prepData.order.status === 'PREPARING', 'Order status moved to PREPARING')
      assert(prepData.order.stage === 2, 'Order stage is 2')

      // 4c. Transition 3: Mark Ready for Pickup (PREPARING -> READY_FOR_PICKUP)
      const readyRes = await fetch(`${BASE_URL}/api/staff/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STAFF_TOKEN}`,
        },
        body: JSON.stringify({
          orderId,
          newStatus: 'READY_FOR_PICKUP',
        }),
      })
      const readyData = await readyRes.json()
      assert(readyRes.status === 200, 'Staff marked order READY_FOR_PICKUP with HTTP 200')
      assert(readyData.order.status === 'READY_FOR_PICKUP', 'Order status moved to READY_FOR_PICKUP')
      assert(readyData.order.stage === 3, 'Order stage is 3')

      // 4d. Transition 4: Mark Collected / Picked Up (READY_FOR_PICKUP -> PICKED_UP)
      const pickupRes = await fetch(`${BASE_URL}/api/staff/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STAFF_TOKEN}`,
        },
        body: JSON.stringify({
          orderId,
          newStatus: 'PICKED_UP',
        }),
      })
      const pickupData = await pickupRes.json()
      assert(pickupRes.status === 200, 'Staff marked order PICKED_UP with HTTP 200')
      assert(pickupData.order.status === 'PICKED_UP', 'Order status moved to PICKED_UP (Completed)')
      assert(pickupData.order.stage === 4, 'Order stage is 4')

      // 4e. Invalid Transition from Terminal State (PICKED_UP -> CANCELLED)
      const invalidTerminalRes = await fetch(`${BASE_URL}/api/staff/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STAFF_TOKEN}`,
        },
        body: JSON.stringify({
          orderId,
          newStatus: 'CANCELLED',
          reason: 'Attempting invalid cancel after pickup',
        }),
      })
      assert(invalidTerminalRes.status === 409, 'Invalid transition from terminal state rejected with HTTP 409 Conflict')

      // -----------------------------------------------------------------------
      // TEST 5: Order Decline with Mandatory Reason
      // -----------------------------------------------------------------------
      console.log('\n--- TEST 5: Order Decline Flow & Reason Recording ---')
      const cancelOrderNumber = `CB-DECLINE-${Date.now().toString().slice(-5)}`
      const { data: declineOrder } = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: cancelOrderNumber,
          token_number: testToken + 1,
          user_id: validUserId,
          items: [{ id: 4, name: 'Filter Coffee', price: 25, quantity: 1, subtotal: 25 }],
          subtotal: 25,
          tax: 1,
          packing: 10,
          total: 36,
          currency: 'INR',
          payment: 'cash',
          payment_status: 'PENDING',
          status: 'PLACED',
          stage: 0,
          eta_minutes: 10,
        })
        .select()
        .single()

      if (declineOrder) {
        // 5a. Decline without reason should be rejected
        const noReasonRes = await fetch(`${BASE_URL}/api/staff/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${STAFF_TOKEN}`,
          },
          body: JSON.stringify({
            orderId: declineOrder.id,
            newStatus: 'CANCELLED',
            reason: '',
          }),
        })
        assert(noReasonRes.status === 400, 'Decline without reason rejected with HTTP 400 Bad Request')

        // 5b. Decline with valid reason succeeds
        const reasonText = 'Kitchen ran out of filter coffee decoction'
        const declineRes = await fetch(`${BASE_URL}/api/staff/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${STAFF_TOKEN}`,
          },
          body: JSON.stringify({
            orderId: declineOrder.id,
            newStatus: 'CANCELLED',
            reason: reasonText,
          }),
        })
        const declineData = await declineRes.json()
        assert(declineRes.status === 200, 'Decline with reason succeeds with HTTP 200')
        assert(declineData.order.status === 'CANCELLED', 'Order status moved to CANCELLED')
        assert(declineData.order.stage === -1, 'Order stage is -1 (Cancelled)')
        assert(declineData.order.cancellation_reason === reasonText, 'cancellation_reason persisted in database')
      }

      // Clean up test orders from Supabase database
      await supabaseAdmin.from('orders').delete().in('order_number', [testOrderNumber, cancelOrderNumber])
      console.log('  ℹ Cleaned up test orders from Supabase database')
    }
  } finally {
    server.close()
  }

  console.log('\n======================================================================')
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`)
  console.log('======================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runSuite().catch((err) => {
  console.error('Test suite uncaught error:', err)
  process.exit(1)
})
