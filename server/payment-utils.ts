import crypto from 'crypto'

export function isValidHexHmac(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false

  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  const received = Buffer.from(signature, 'hex')
  return received.length === expected.length && crypto.timingSafeEqual(expected, received)
}

export type RazorpayPaymentAttempt = {
  id: string
  order_id: string | null
  amount: number | string
  currency: string | null
  status: string
}

export function classifyPaymentAttempts<T extends RazorpayPaymentAttempt>(
  attempts: T[],
  orderId: string,
  amount: number,
  currency: string
): {
  matching: T[]
  captured?: T
  failureIsFinal: boolean
} {
  const matching = attempts.filter(
    (attempt) =>
      attempt.order_id === orderId &&
      Number(attempt.amount) === amount &&
      attempt.currency === currency
  )
  const captured = matching.find((attempt) => attempt.status === 'captured')
  const failureIsFinal =
    !captured && matching.length > 0 && matching.every((attempt) => attempt.status === 'failed')

  return { matching, captured, failureIsFinal }
}
