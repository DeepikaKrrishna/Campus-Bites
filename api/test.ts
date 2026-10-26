export default async function handler(_req: any, res: any) {
  const diagnostics: Record<string, any> = {}

  try {
    diagnostics.express = 'attempting'
    const express = await import('express')
    diagnostics.express = typeof express
  } catch (e: any) {
    diagnostics.express = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.config = 'attempting'
    const configModule = await import('./server/config')
    diagnostics.config = { loaded: true, nodeEnv: configModule.config.nodeEnv }
  } catch (e: any) {
    diagnostics.config = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.db = 'attempting'
    const dbModule = await import('./server/db')
    diagnostics.db = { loaded: true, hasSupabase: Boolean(dbModule.supabase) }
  } catch (e: any) {
    diagnostics.db = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.auth = 'attempting'
    const authModule = await import('./server/auth')
    diagnostics.auth = { loaded: true, hasAuth: Boolean(authModule.authenticateToken) }
  } catch (e: any) {
    diagnostics.auth = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.paymentsRoute = 'attempting'
    const paymentsModule = await import('./server/routes/payments')
    diagnostics.paymentsRoute = { loaded: true, hasRouter: Boolean(paymentsModule.paymentsRouter) }
  } catch (e: any) {
    diagnostics.paymentsRoute = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.ordersRoute = 'attempting'
    const ordersModule = await import('./server/routes/orders')
    diagnostics.ordersRoute = { loaded: true, hasRouter: Boolean(ordersModule.ordersRouter) }
  } catch (e: any) {
    diagnostics.ordersRoute = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.staffRoute = 'attempting'
    const staffModule = await import('./server/routes/staff')
    diagnostics.staffRoute = { loaded: true, hasRouter: Boolean(staffModule.staffRouter) }
  } catch (e: any) {
    diagnostics.staffRoute = 'FAILED: ' + e?.message
  }

  try {
    diagnostics.serverIndex = 'attempting'
    const serverModule = await import('./server/index')
    diagnostics.serverIndex = { loaded: true, hasApp: Boolean(serverModule.app) }
  } catch (e: any) {
    diagnostics.serverIndex = 'FAILED: ' + e?.message
  }

  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json(diagnostics)
}
