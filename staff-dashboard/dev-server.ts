import 'dotenv/config'
import express from 'express'
import staffOrdersHandler from './api/staff/orders'

const app = express()
app.use(express.json())

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>CampusBites Staff API</title></head>
      <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 60px 20px; background: #f4f6f8; color: #1c2737;">
        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <h2 style="margin-top: 0; color: #15803d;">Staff Backend API is Running</h2>
          <p style="color: #64748b; font-size: 14px;">This port (8788) powers the backend database operations.</p>
          <div style="margin: 25px 0; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
            <p style="margin: 0 0 10px; font-weight: 600; font-size: 14px;">Open the Staff Dashboard Web App here:</p>
            <a href="http://localhost:5174" style="display: inline-block; padding: 10px 22px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">👉 Open http://localhost:5174</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">(Ensure you ran <code>npm run staff:dev</code> in your second terminal)</p>
        </div>
      </body>
    </html>
  `)
})

app.all('/api/staff/orders', async (req, res) => {
  const query = Object.fromEntries(new URL(req.originalUrl, 'http://localhost').searchParams)
  try {
    await staffOrdersHandler(
      {
        method: req.method,
        headers: req.headers,
        query,
        body: req.body,
      },
      res as never
    )
  } catch (error) {
    console.error('Local staff API failed:', error instanceof Error ? error.message : 'Unknown error')
    res.status(500).json({ success: false, error: 'Staff API is temporarily unavailable.' })
  }
})

const port = Number(process.env.STAFF_API_PORT || 8788)
app.listen(port, () => console.log(`[CampusBites Staff API] Running on http://localhost:${port}`))
