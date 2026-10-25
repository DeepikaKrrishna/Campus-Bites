import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { supabase } from './db'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Stable UUID for local integration tests (non-production only). */
export function testCustomerUuidFromLabel(label: string): string {
  const hash = crypto.createHash('sha256').update(`campusbites-test-customer:${label}`).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'customer' | 'staff' | 'admin'
  name?: string
  isStaff: boolean
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

// Trusted memory store for staff roles (synchronized with staff_roles DB table)
/**
 * Validates a Supabase JWT or authorized test token server-side.
 * Never trusts client-supplied identity or arbitrary header lengths.
 */
export async function authenticateToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string') return null

  // 1. Check for authorized test tokens (strictly for local integration test suites)
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_AUTH === 'true') {
    if (token === 'test_staff_token_secret_2026') {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'staff.canteen@campusbites.edu',
        role: 'staff',
        name: 'Head Chef (Test)',
        isStaff: true,
      }
    }
    if (token.startsWith('test_customer_token:')) {
      const customerLabel = token.split(':')[1] || 'student'
      const customerId = UUID_REGEX.test(customerLabel)
        ? customerLabel
        : testCustomerUuidFromLabel(customerLabel)
      return {
        id: customerId,
        email: `${customerLabel}@campusbites.edu`,
        role: 'customer',
        name: `Student (${customerLabel})`,
        isStaff: false,
      }
    }
  }

  // 2. Validate Supabase Auth session token server-side via Supabase Auth API
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return null
    }

    const sbUser = data.user
    const userId = sbUser.id

    // Determine staff role from protected sources:
    // a) app_metadata (set only by service role or Supabase admin)
    // b) public.staff_roles database table
    // c) Verified in-memory staff registry
    let isStaff = false
    let role: 'customer' | 'staff' | 'admin' = 'customer'

    if (
      sbUser.app_metadata?.role === 'staff' ||
      sbUser.app_metadata?.role === 'admin' ||
      sbUser.app_metadata?.is_staff === true
    ) {
      isStaff = true
      role = (sbUser.app_metadata.role as any) || 'staff'
    } else {
      // Query protected staff_roles table in Supabase
      try {
        const { data: staffRow } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', userId)
          .single()

        if (staffRow && (staffRow.role === 'staff' || staffRow.role === 'admin')) {
          isStaff = true
          role = staffRow.role
        }
      } catch (e) {
        // A database lookup failure must never grant staff access.
      }
    }

    return {
      id: userId,
      email: sbUser.email || '',
      role,
      name: sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0],
      isStaff,
    }
  } catch (err) {
    console.warn('Supabase token verification error:', err)
    return null
  }
}

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || typeof authHeader !== 'string') return null
  const parts = authHeader.trim().split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1]
  }
  return null
}

/**
 * Middleware: Requires a valid authenticated Supabase session.
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    })
  }

  const user = await authenticateToken(token)
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token. Please sign in again.',
    })
  }

  req.user = user
  next()
}

/**
 * Middleware: Requires a verified canteen staff role.
 * Rejects non-staff authenticated users with HTTP 403 Forbidden.
 */
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Staff authentication required. Please sign in with your staff account.',
    })
  }

  const user = await authenticateToken(token)
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired staff session token.',
    })
  }

  if (!user.isStaff) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Access restricted to authorized canteen staff only.',
    })
  }

  req.user = user
  next()
}

/**
 * Middleware: Optional authentication. Attaches user if valid token present.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req)
  if (token) {
    const user = await authenticateToken(token)
    if (user) {
      req.user = user
    }
  }
  next()
}
