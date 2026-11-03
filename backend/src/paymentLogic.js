import { randomUUID } from 'node:crypto';

export const DEMO_PAYMENT_METHODS = Object.freeze(['UPI', 'Card', 'Cash']);

export function validateDemoPaymentBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send a bookingId and paymentMethod.' };
  const keys = Object.keys(body);
  if (keys.some((key) => !['bookingId', 'paymentMethod'].includes(key))) {
    return { error: 'Only bookingId and paymentMethod are accepted. Amount, status, and transaction ID are assigned by AutoRent.' };
  }
  if (typeof body.bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.bookingId)) return { error: 'A valid bookingId is required.' };
  if (!DEMO_PAYMENT_METHODS.includes(body.paymentMethod)) return { error: 'Choose UPI, Card, or Cash for this demo payment.' };
  return { value: { bookingId: body.bookingId, paymentMethod: body.paymentMethod } };
}

export function createDemoTransactionId(uuid = randomUUID) {
  return `DEMO-${uuid()}`;
}

// The server decides the outcome. No credentials are collected or sent to a gateway.
export function simulateDemoOutcome(random = Math.random) {
  return random() < 0.9 ? 'successful' : 'failed';
}

export function isUniquePaymentConflict(error) {
  return error?.code === '23505' || error?.status === 409;
}
