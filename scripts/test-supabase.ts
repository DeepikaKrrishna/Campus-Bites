import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function testRealtime() {
  const channel = supabase.channel('orders-test')
  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      console.log('Realtime change received!', payload)
    })
    .subscribe((status) => {
      console.log('Realtime subscription status:', status)
      if (status === 'SUBSCRIBED') {
        console.log('SUCCESS: Realtime is active!')
        process.exit(0)
      }
    })

  setTimeout(() => {
    console.log('Timeout waiting for subscription')
    process.exit(0)
  }, 6000)
}

testRealtime()
