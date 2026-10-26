import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config()

export const config = {
  port: parseInt(process.env.SERVER_PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    isTestMode: (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').startsWith('rzp_test_'),
  },

  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || '',
}

export function isRazorpayConfigured(): boolean {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || ''

  return (
    (keyId.startsWith('rzp_test_') || keyId.startsWith('rzp_live_')) &&
    Boolean(keySecret) &&
    !keySecret.toLowerCase().includes('demo') &&
    !keyId.toLowerCase().includes('demo')
  )
}

export function isRazorpayLiveConfigured(): boolean {
  const keyId = config.razorpay.keyId || process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || ''
  const keySecret = config.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET || ''

  return (
    keyId.startsWith('rzp_live_') &&
    Boolean(keySecret) &&
    !keySecret.toLowerCase().includes('demo') &&
    !keyId.toLowerCase().includes('demo')
  )
}
