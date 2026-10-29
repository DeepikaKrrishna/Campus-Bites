
import dotenv from 'dotenv'

// Load local environment variables during local development only.
if (!process.env.VERCEL) {
  dotenv.config()
}

export const config = {
  port: parseInt(process.env.SERVER_PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url:
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || '',
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = config.razorpay
  const normalizedKeyId = keyId.toLowerCase()
  const normalizedKeySecret = keySecret.toLowerCase()

  return (
    normalizedKeyId.startsWith('rzp_test_') &&
    normalizedKeyId !== 'rzp_test_tshqqnqzjsdrcwh' &&
    Boolean(keySecret) &&
    !normalizedKeyId.includes('demo') &&
    !normalizedKeySecret.includes('demo') &&
    !normalizedKeyId.includes('your_') &&
    !normalizedKeySecret.includes('your_') &&
    !normalizedKeySecret.includes('placeholder')
  )
}
