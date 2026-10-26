import express, { type Request, type Response } from 'express'
import cors from 'cors'
import {
  config,
  isRazorpayConfigured,
  isRazorpayLiveConfigured,
} from './config'
import { paymentsRouter } from './routes/payments'
import { ordersRouter } from './routes/orders'
import { staffRouter } from './routes/staff'
import { supabase } from './db'

export const app = express()

// 1. CORS Configuration
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
  })
)

// 2. Body Parser with raw body preservation for Webhook signature verification
app.use(
  express.json({
    verify: (req: Request, _res: Response, buf: Buffer) => {
      ;(req as any).rawBody = buf.toString('utf8')
    },
  })
)
app.use(express.urlencoded({ extended: true }))

// 3. Mount API Routes
app.use('/api/payments', paymentsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/staff', staffRouter)

// 4. Health & Status Check Endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'connected'
  try {
    const { error } = await supabase.from('orders').select('count', { count: 'exact', head: true })
    if (error) dbStatus = 'degraded: ' + error.message
  } catch (e: any) {
    dbStatus = 'unreachable: ' + e.message
  }

  res.status(200).json({
    status: 'ok',
    service: 'CampusBites Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: {
      supabaseUrl: config.supabase.url,
      status: dbStatus,
    },
    paymentGateway: {
      provider: 'Razorpay Standard Checkout',
      mode: isRazorpayLiveConfigured() ? 'Live Production Mode' : 'Verified Test Mode (UPI & Sandbox)',
      keyId: config.razorpay.keyId,
    },
  })
})

// 5. Start standalone server if invoked directly (never in serverless/Vercel)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`[CampusBites API] Server running on http://localhost:${config.port}`)
    const paymentMode = isRazorpayLiveConfigured()
  ? 'LIVE'
  : isRazorpayConfigured()
    ? 'RAZORPAY TEST MODE'
    : 'TEST / SIMULATOR'

console.log(`[CampusBites API] Payment Mode: ${paymentMode}`)
    console.log(`[CampusBites API] Supabase connected to: ${config.supabase.url}`)
  })
}
