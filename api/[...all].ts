import { app } from './server/index'

export default function handler(req: any, res: any) {
  try {
    return app(req, res)
  } catch (err: any) {
    console.error('[API Serverless Error]:', err)
    return res.status(500).json({ error: 'Serverless invocation error', message: err?.message })
  }
}
