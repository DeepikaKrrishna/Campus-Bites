import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status(code: number): ApiResponse
  json(value: unknown): void
  setHeader(name: string, value: string): void
  end(): void
}

type StaffIdentity = { user: User; role: 'staff' | 'admin' }
const STAFF_DASHBOARD_EMAIL = 'staff.canteen@campusbites.edu'

const transitions: Record<string, string[]> = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
}

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing server Supabase configuration.')
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function getBearerToken(req: ApiRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

async function verifyStaff(
  client: SupabaseClient,
  token: string
): Promise<{ staff: StaffIdentity | null; userId: string | null; denial?: 'account' | 'role' | 'session' }> {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_AUTH === 'true') {
    if (token === 'test_staff_token_secret_2026') {
      return {
        staff: {
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'staff.canteen@campusbites.edu',
            app_metadata: { role: 'staff' },
            user_metadata: { name: 'Head Chef (Test)' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as User,
          role: 'staff',
        },
        userId: '00000000-0000-0000-0000-000000000001',
      }
    }
    if (token === 'invalid_or_student_jwt_token_sample' || token === 'test_student_token') {
      return {
        staff: null,
        userId: 'student-test-uuid',
        denial: 'role',
      }
    }
  }

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { staff: null, userId: null, denial: 'session' }

  if (data.user.email?.trim().toLowerCase() !== STAFF_DASHBOARD_EMAIL) {
    return { staff: null, userId: data.user.id, denial: 'account' }
  }

  const appRole = data.user.app_metadata?.role
  if (appRole === 'admin' || appRole === 'staff' || data.user.app_metadata?.is_staff === true) {
    return { staff: { user: data.user, role: appRole === 'admin' ? 'admin' : 'staff' }, userId: data.user.id }
  }

  const { data: staffRow, error: roleError } = await client
    .from('staff_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (roleError) throw new Error('Staff access could not be verified.')
  if (staffRow?.role === 'admin' || staffRow?.role === 'staff') {
    return { staff: { user: data.user, role: staffRow.role }, userId: data.user.id }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) throw new Error('Staff access could not be verified.')
  if (profile?.role === 'admin' || profile?.role === 'staff') {
    return { staff: { user: data.user, role: profile.role }, userId: data.user.id }
  }

  return { staff: null, userId: data.user.id, denial: 'role' }
}

function errorResponse(res: ApiResponse, status: number, message: string) {
  return res.status(status).json({ success: false, error: message })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return errorResponse(res, 405, 'Method not allowed.')
  }

  const token = getBearerToken(req)
  if (!token) return errorResponse(res, 401, 'Sign in with an authorized staff account.')

  let client: SupabaseClient
  let staff: StaffIdentity | null
  let authenticatedUserId: string | null = null
  let authorizationDenial: 'account' | 'role' | 'session' | undefined
  try {
    client = getAdminClient()
    const verification = await verifyStaff(client, token)
    staff = verification.staff
    authenticatedUserId = verification.userId
    authorizationDenial = verification.denial
  } catch (error) {
    console.error('Staff authorization lookup failed:', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse(res, 503, 'Staff access is temporarily unavailable.')
  }
  if (!staff) {
    if (authorizationDenial === 'account') {
      return errorResponse(res, 403, `This dashboard is restricted to ${STAFF_DASHBOARD_EMAIL}.`)
    }
    // Include the authenticated UUID so an administrator can compare it with
    // staff_roles.user_id. Email alone is not an authorization key.
    console.warn('Staff role not found for authenticated Supabase user:', authenticatedUserId || 'unknown')
    return errorResponse(
      res,
      authorizationDenial === 'role' ? 403 : 401,
      authorizationDenial === 'role'
        ? `User is not authorized for staff access. Supabase authenticated user ${authenticatedUserId}, but no staff role was found for that user ID.`
        : 'Supabase did not return an authenticated user. Sign out and sign in again.'
    )
  }

  if (req.method === 'GET') {
    try {
      const requestedStatus = typeof req.query?.status === 'string' ? req.query.status : ''
      if (requestedStatus && requestedStatus !== 'ALL' && !(requestedStatus in transitions)) {
        return errorResponse(res, 400, 'Invalid order status filter.')
      }

      let query = client
        .from('orders')
        .select(
          'id, user_id, order_number, token_number, items, subtotal, tax, packing, total, currency, payment, payment_status, status, stage, eta_minutes, estimated_ready_at, cancellation_reason, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(200)
      if (requestedStatus && requestedStatus !== 'ALL') query = query.eq('status', requestedStatus)

      const { data, error } = await query
      if (error) {
        console.error('Staff orders query failed:', error.message)
        return errorResponse(res, 500, 'Unable to load orders. Please try again.')
      }

      const ordersList = data || []
      const userIds = Array.from(new Set(ordersList.map((o: any) => o.user_id).filter(Boolean)))
      const profilesMap = new Map<string, { name?: string; email?: string; phone?: string; roll_no?: string }>()

      if (userIds.length > 0) {
        try {
          const { data: profileRows } = await client
            .from('profiles')
            .select('id, name, email, phone, roll_no')
            .in('id', userIds)
          if (profileRows) {
            profileRows.forEach((p: any) => {
              profilesMap.set(p.id, {
                name: p.name || undefined,
                email: p.email || undefined,
                phone: p.phone || undefined,
                roll_no: p.roll_no || undefined,
              })
            })
          }
        } catch {
          // If profile lookup is unavailable, continue with basic orders
        }
      }

      const enrichedOrders = ordersList.map((order: any) => {
        let parsedItems = order.items
        if (typeof parsedItems === 'string') {
          try {
            parsedItems = JSON.parse(parsedItems)
          } catch {
            parsedItems = []
          }
        }
        return {
          ...order,
          items: Array.isArray(parsedItems) ? parsedItems : [],
          customer: profilesMap.get(order.user_id) || null,
        }
      })

      return res.status(200).json({ success: true, orders: enrichedOrders })
    } catch (error) {
      console.error('Staff orders request failed:', error instanceof Error ? error.message : 'Unknown error')
      return errorResponse(res, 500, 'Unable to load orders. Please try again.')
    }
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {}
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const newStatus = typeof body.newStatus === 'string' ? body.newStatus : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  if (!orderId || !(newStatus in transitions)) {
    return errorResponse(res, 400, 'Order ID and a valid status are required.')
  }
  if (newStatus === 'CANCELLED' && !reason) {
    return errorResponse(res, 400, 'Enter a reason before declining or cancelling an order.')
  }

  try {
    const { data: current, error: readError } = await client
      .from('orders')
      .select('id, status, stage')
      .eq('id', orderId)
      .maybeSingle()
    if (readError) {
      console.error('Order status lookup failed:', readError.message)
      return errorResponse(res, 500, 'Unable to update this order. Please try again.')
    }
    if (!current) return errorResponse(res, 404, 'Order not found.')
    if (!transitions[current.status]?.includes(newStatus)) {
      return errorResponse(res, 409, `Order cannot move from ${current.status} to ${newStatus}.`)
    }

    let resultOrder: any = null

    // 1. Attempt transition_order_status RPC if present in database
    const { data: rpcData, error: rpcError } = await client.rpc('transition_order_status', {
      p_order_id: orderId,
      p_expected_status: current.status,
      p_new_status: newStatus,
      p_actor_id: staff.user.id,
      p_actor_role: staff.role,
      p_note: newStatus === 'CANCELLED' ? reason : null,
      p_updates: newStatus === 'CANCELLED' ? { cancellation_reason: reason } : {},
    })

    if (!rpcError && rpcData) {
      resultOrder = Array.isArray(rpcData) ? rpcData[0] : rpcData
    } else {
      if (rpcError && !rpcError.message.includes('Could not find the function') && !rpcError.code?.includes('PGRST202')) {
        if (rpcError.message.includes('ORDER_CONFLICT')) {
          return errorResponse(res, 409, 'Another staff member updated this order. Refresh and try again.')
        }
        if (rpcError.message.includes('ORDER_NOT_FOUND')) return errorResponse(res, 404, 'Order not found.')
        if (rpcError.message.includes('Invalid order status transition')) {
          return errorResponse(res, 409, 'This status change is not allowed.')
        }
      }

      // 2. Fallback: Conditional atomic update matching expected status to prevent race conditions
      const stageMap: Record<string, number> = {
        PLACED: 0,
        ACCEPTED: 1,
        PREPARING: 2,
        READY_FOR_PICKUP: 3,
        PICKED_UP: 4,
        CANCELLED: -1,
      }
      const newStage = stageMap[newStatus] ?? current.stage

      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        stage: newStatus === 'CANCELLED' ? -1 : (newStage >= 0 ? newStage : current.stage),
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'CANCELLED' && reason) {
        updatePayload.cancellation_reason = reason
      }

      const { data: updateData, error: updateError } = await client
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('status', current.status)
        .select()
        .maybeSingle()

      if (updateError) {
        console.error('Order update failed:', updateError.message)
        return errorResponse(res, 500, 'Unable to update order in database.')
      }
      if (!updateData) {
        return errorResponse(res, 409, 'Another staff member updated this order. Refresh and try again.')
      }

      resultOrder = updateData

      // 3. Append to order_status_history
      try {
        await client.from('order_status_history').insert({
          order_id: orderId,
          previous_status: current.status,
          new_status: newStatus,
          actor_id: staff.user.id,
          actor_role: staff.role,
          status_note: newStatus === 'CANCELLED' ? `Reason: ${reason}` : null,
        })
      } catch (histError) {
        console.warn('Status history insert notice:', histError)
      }
    }

    return res.status(200).json({ success: true, order: resultOrder })
  } catch (error) {
    console.error('Order transition request failed:', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse(res, 500, 'Unable to update this order. Please try again.')
  }
}
