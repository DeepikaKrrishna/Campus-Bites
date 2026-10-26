export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json({
    status: 'ok',
    service: 'CampusBites API',
    time: new Date().toISOString(),
  })
}
