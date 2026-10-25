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
    keyId: process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_campusbites_demo',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'demo_secret_not_real_key_for_test',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'demo_webhook_secret_for_test',
    isTestMode: true,
  },
  staffSecretPasskey: process.env.STAFF_SECRET_PASSKEY || 'CAMPUS_CHEF_2026',
}

export function isRazorpayLiveConfigured(): boolean {
  return Boolean(
    config.razorpay.keyId &&
    config.razorpay.keySecret &&
    !config.razorpay.keyId.includes('demo') &&
    !config.razorpay.keySecret.includes('demo')
  )
}
