import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoPaymentHandler } from '../src/paymentApi.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const bookingId = '33333333-3333-4333-8333-333333333333';

let payments;
let scenario;
let serviceHeaders;
const config = {
  frontendOrigin: 'http://localhost:5173',
  supabaseUrl: 'https://autorent.test',
  supabasePublishableKey: 'test-publishable-key',
  serviceRoleKey: 'test-server-only-key',
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function makeFetch() {
  return async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') {
      if (options.headers.authorization !== 'Bearer valid-customer-token') return response({ message: 'invalid token' }, 401);
      return response({ id: scenario === 'other-user' ? otherUserId : ownerId });
    }
    serviceHeaders.push(options.headers);
    if (url.pathname.endsWith('/users')) return response([{ role: scenario === 'admin-profile' ? 'admin' : 'customer' }]);
    if (url.pathname.endsWith('/bookings')) {
      const owned = url.searchParams.get('id') === `eq.${bookingId}` && url.searchParams.get('user_id') === `eq.${ownerId}`;
      if (!owned || scenario === 'other-user') return response([]);
      return response([{ id: bookingId, user_id: ownerId, vehicle_id: '44444444-4444-4444-8444-444444444444', pickup_date: '2026-12-01', return_date: '2026-12-03', total_price: '2400.00', booking_status: scenario === 'confirmed' ? 'confirmed' : 'pending' }]);
    }
    if (!url.pathname.endsWith('/payments')) return response({ message: 'not found' }, 404);
    if (options.method === 'POST') {
      const row = { id: `payment-${payments.length + 1}`, ...JSON.parse(options.body), created_at: '2026-11-04T00:00:00Z' };
      payments.push(row);
      return response([row], 201);
    }
    if (options.method === 'PATCH') {
      const id = url.searchParams.get('id')?.slice(3);
      const row = payments.find((item) => item.id === id);
      if (!row) return response([], 200);
      const changes = JSON.parse(options.body);
      if (changes.payment_status === 'successful' && payments.some((item) => item.booking_id === row.booking_id && item.payment_status === 'successful' && item.id !== row.id)) {
        return response({ code: '23505', message: 'duplicate successful payment' }, 409);
      }
      Object.assign(row, changes);
      return response([row]);
    }
    return response(payments.filter((item) => item.booking_id === bookingId && item.payment_status === 'successful'));
  };
}

function setup({ random = () => 0, serviceRoleKey = config.serviceRoleKey } = {}) {
  payments = [];
  serviceHeaders = [];
  scenario = 'owner';
  const handler = createDemoPaymentHandler({
    config: { ...config, serviceRoleKey },
    fetchImpl: makeFetch(),
    random,
    uuid: () => '55555555-5555-4555-8555-555555555555',
  });
  const send = async ({ body = { bookingId, paymentMethod: 'UPI' }, token = 'valid-customer-token', authorization = token ? `Bearer ${token}` : '' } = {}) => {
    let statusCode = 200;
    let payload;
    const request = { body, get: (name) => name.toLowerCase() === 'authorization' ? authorization : undefined };
    const responseSink = { status(code) { statusCode = code; return this; }, json(data) { payload = data; return this; } };
    await handler(request, responseSink);
    return { status: statusCode, body: payload };
  };
  send.serviceHeaders = serviceHeaders;
  return send;
}

afterEach(() => { payments = []; scenario = undefined; });

test('sends a new Supabase secret API key only in apikey, not as a Bearer JWT', async () => {
  const send = setup({ serviceRoleKey: 'sb_secret_test-only' });
  const result = await send();
  assert.equal(result.status, 201);
  assert.ok(send.serviceHeaders.length > 0);
  for (const headers of send.serviceHeaders) {
    assert.equal(headers.apikey, 'sb_secret_test-only');
    assert.equal(Object.hasOwn(headers, 'authorization'), false);
  }
});

test('creates a demo success using the database booking total and server transaction ID', async () => {
  const send = setup();
  const result = await send();
  assert.equal(result.status, 201);
  assert.equal(result.body.payment.amount, '2400.00');
  assert.equal(result.body.payment.payment_status, 'successful');
  assert.match(result.body.payment.transaction_id, /^DEMO-/);
  assert.equal(payments.length, 1);
});

test('rejects browser supplied amount or payment status', async () => {
  const send = setup();
  const result = await send({ body: { bookingId, paymentMethod: 'Card', amount: 1, payment_status: 'successful' } });
  assert.equal(result.status, 400);
  assert.equal(payments.length, 0);
});

test('requires a verified bearer token and booking ownership', async () => {
  const send = setup();
  assert.equal((await send({ token: null })).status, 401);
  scenario = 'other-user';
  assert.equal((await send()).status, 404);
  assert.equal(payments.length, 0);
});

test('does not create a second successful payment for the same booking', async () => {
  const send = setup();
  assert.equal((await send()).status, 201);
  assert.equal((await send({ body: { bookingId, paymentMethod: 'Card' } })).status, 409);
  assert.equal(payments.filter((item) => item.payment_status === 'successful').length, 1);
});

test('records a server simulated failed attempt without collecting credentials', async () => {
  const send = setup({ random: () => 0.99 });
  const result = await send({ body: { bookingId, paymentMethod: 'Cash' } });
  assert.equal(result.status, 201);
  assert.equal(result.body.payment.payment_status, 'failed');
  assert.equal(result.body.payment.amount, '2400.00');
  assert.equal(Object.hasOwn(result.body.payment, 'card_number'), false);
});

test('rejects non-customer profiles and non-pending bookings', async () => {
  const send = setup();
  scenario = 'admin-profile';
  assert.equal((await send()).status, 403);
  scenario = 'confirmed';
  assert.equal((await send()).status, 409);
  assert.equal(payments.length, 0);
});
