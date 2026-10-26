import dotenv from 'dotenv'

// Safely load local .env without crashing on serverless / Vercel
try {
  if (typeof process !== 'undefined' && !process.env.VERCEL) {
    dotenv.config()
  }
} catch (_) {}

export const config = {
  port: parseInt(process.env.SERVER_PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.VITE_SUPABASE_URL || 'https://knxtcyedsbhgwbpvthhy.supabase.co',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueHRjeWVkc2JoZ3dicHZ0aGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTgwODQsImV4cCI6MjEwODA3NDA4NH0.8osxOT29NujHzkAAYvR2Ig3xosaGyVhvDTPMtYLPUJI',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueHRjeWVkc2JoZ3dicHZ0aGh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjQ5ODA4NCwiZXhwIjoyMTA4MDc0MDg0fQ.DlwUIec1eNX45dz-HV86l2--gsWVR4FtmkRdi_Gpm0Q',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TsHQqNzjSdRCWH',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'LOLznV3dkvLud5u83nYstRdh',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'qa6HW#s5gDwdzEW',
    isTestMode: (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TsHQqNzjSdRCWH').startsWith('rzp_test_'),
  },

  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || 'CAMPUS_CHEF_2026',
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
