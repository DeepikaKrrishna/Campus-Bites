import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import {
  classifyPaymentAttempts,
  isValidHexHmac,
  type RazorpayPaymentAttempt,
} from './payment-utils'

const secret = 'test-only-webhook-secret'

function signatureFor(payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

test('accepts the exact valid HMAC-SHA256 signature', () => {
  const payload = 'order_123|pay_456'
  assert.equal(isValidHexHmac(payload, signatureFor(payload), secret), true)
})

test('rejects modified payloads and signatures', () => {
  const payload = 'order_123|pay_456'
  const signature = signatureFor(payload)
  assert.equal(isValidHexHmac(`${payload} `, signature, secret), false)
  assert.equal(isValidHexHmac(payload, `${signature.slice(0, -1)}0`, secret), false)
})

test('rejects malformed signatures and missing secrets', () => {
  assert.equal(isValidHexHmac('payload', 'not-a-signature', secret), false)
  assert.equal(isValidHexHmac('payload', 'a'.repeat(64), ''), false)
})

test('validates webhook signatures against the original raw bytes', () => {
  const rawBody = Buffer.from('{"event":"payment.captured","payload":{}}')
  assert.equal(isValidHexHmac(rawBody, signatureFor(rawBody), secret), true)
  assert.equal(isValidHexHmac(Buffer.from(rawBody.toString() + ' '), signatureFor(rawBody), secret), false)
})

const attempt = (
  id: string,
  status: string,
  amount = 1000,
  orderId = 'order_123',
  currency = 'INR'
): RazorpayPaymentAttempt => ({
  id,
  order_id: orderId,
  amount,
  currency,
  status,
})

test('treats failures as final only when every matching attempt failed', () => {
  const allFailed = classifyPaymentAttempts(
    [attempt('pay_1', 'failed'), attempt('pay_2', 'failed')],
    'order_123',
    1000,
    'INR'
  )
  assert.equal(allFailed.failureIsFinal, true)
  assert.equal(allFailed.matching.length, 2)

  const pending = classifyPaymentAttempts(
    [attempt('pay_1', 'failed'), attempt('pay_2', 'authorized')],
    'order_123',
    1000,
    'INR'
  )
  assert.equal(pending.failureIsFinal, false)
})

test('prefers a matching captured attempt over earlier failures', () => {
  const result = classifyPaymentAttempts(
    [attempt('pay_1', 'failed'), attempt('pay_2', 'captured')],
    'order_123',
    1000,
    'INR'
  )
  assert.equal(result.captured?.id, 'pay_2')
  assert.equal(result.failureIsFinal, false)
})

test('ignores attempts with a different order, amount, or currency', () => {
  const result = classifyPaymentAttempts(
    [
      attempt('pay_order', 'failed', 1000, 'other_order'),
      attempt('pay_amount', 'failed', 999),
      attempt('pay_currency', 'failed', 1000, 'order_123', 'USD'),
    ],
    'order_123',
    1000,
    'INR'
  )
  assert.deepEqual(result.matching, [])
  assert.equal(result.failureIsFinal, false)
})
