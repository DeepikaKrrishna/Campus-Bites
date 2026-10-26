import { app } from './server/index'

export default function handler(req: any, res: any) {
  try {
    return app(req, res)
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]:', err)
    return res.status(500).json({
      error: 'Internal server error in API function',
      message: err?.message,
    })
  }
}

