import type { Request, Response } from 'express'
import { config, isRazorpayConfigured, isRazorpayLiveConfigured } from '../server/config'
import { supabase } from '../server/db'

export default async function handler(_req: any, res: any) {
  let dbStatus = 'connected'
  try {
    const { error } = await supabase.from('orders').select('count', { count: 'exact', head: true })
    if (error) dbStatus = 'degraded: ' + error.message
  } catch (e: any) {
    dbStatus = 'unreachable: ' + e?.message
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')

  return res.status(200).json({
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
}
