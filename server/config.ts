import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.SERVER_PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.VITE_SUPABASE_URL || 'https://knxtcyedsbhgwbpvthhy.supabase.co',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || 'CAMPUS_CHEF_2026',
}

export function isRazorpayTestConfigured(): boolean {
  const placeholders = /(your|placeholder|example|demo)/i
  return Boolean(
    /^rzp_test_[a-z0-9]+$/i.test(config.razorpay.keyId) &&
    config.razorpay.keySecret.trim() &&
    config.razorpay.webhookSecret.trim() &&
    !placeholders.test(config.razorpay.keyId) &&
    !placeholders.test(config.razorpay.keySecret) &&
    !placeholders.test(config.razorpay.webhookSecret)
  )
}
