import express from 'express';
import { createDemoTransactionId, isUniquePaymentConflict, simulateDemoOutcome, validateDemoPaymentBody } from './paymentLogic.js';

function jsonHeaders(publishableKey, accessToken) {
  return { apikey: publishableKey, authorization: `Bearer ${accessToken}`, accept: 'application/json' };
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function createRestClient({ supabaseUrl, serviceRoleKey, fetchImpl }) {
  return async function restRequest(path, { method = 'GET', body } = {}) {
    const headers = {
      apikey: serviceRoleKey,
      accept: 'application/json',
      'content-type': 'application/json',
      prefer: 'return=representation',
    };
    // New Supabase secret API keys (sb_secret_...) are API keys, not JWTs.
    // They belong in apikey only. Keep the Bearer header for legacy service_role JWTs.
    if (!serviceRoleKey.startsWith('sb_secret_')) {
      headers.authorization = `Bearer ${serviceRoleKey}`;
    }
    const response = await fetchImpl(new URL(`/rest/v1/${path}`, supabaseUrl), {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await readResponse(response);
    if (!response.ok) {
      const error = new Error(data?.message || data?.hint || `Supabase request failed (${response.status}).`);
      error.status = response.status;
      error.code = data?.code;
      throw error;
    }
    return data;
  };
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export function createDemoPaymentHandler({ config, fetchImpl = fetch, random = Math.random, uuid }) {
  const restRequest = createRestClient({ ...config, fetchImpl });

  return async (request, response) => {
    const match = (request.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) return response.status(401).json({ error: 'Sign in to start a demo payment.' });
    const parsed = validateDemoPaymentBody(request.body);
    if (parsed.error) return response.status(400).json({ error: parsed.error });

    let stage = 'verify_auth_token';
    try {
      // Supabase Auth verifies the bearer token; identity is never accepted from the body.
      const authResponse = await fetchImpl(new URL('/auth/v1/user', config.supabaseUrl), {
        headers: jsonHeaders(config.supabasePublishableKey, match[1]),
      });
      const authUser = await readResponse(authResponse);
      if (!authResponse.ok || !authUser?.id) return response.status(401).json({ error: 'Your login session is invalid or expired. Please sign in again.' });

      stage = 'read_customer_profile';
      const profileParams = new URLSearchParams({ id: `eq.${authUser.id}`, select: 'role', limit: '1' });
      const profile = firstRow(await restRequest(`users?${profileParams}`));
      if (profile?.role !== 'customer') return response.status(403).json({ error: 'Demo payments are available to customer accounts only.' });

      stage = 'read_owned_booking';
      const bookingParams = new URLSearchParams({
        id: `eq.${parsed.value.bookingId}`,
        user_id: `eq.${authUser.id}`,
        select: 'id,user_id,vehicle_id,pickup_date,return_date,total_price,booking_status',
        limit: '1',
      });
      const booking = firstRow(await restRequest(`bookings?${bookingParams}`));
      if (!booking) return response.status(404).json({ error: 'Booking not found for this account.' });
      if (booking.booking_status !== 'pending') return response.status(409).json({ error: 'Only pending bookings can be paid in this demo.' });

      stage = 'check_existing_successful_payment';
      const successfulParams = new URLSearchParams({
        booking_id: `eq.${booking.id}`,
        payment_status: 'eq.successful',
        select: 'id,booking_id,amount,payment_method,payment_status,transaction_id,created_at',
        limit: '1',
      });
      const existingPayment = firstRow(await restRequest(`payments?${successfulParams}`));
      if (existingPayment) return response.status(409).json({ error: 'This booking already has a successful payment.', payment: existingPayment });

      stage = 'insert_pending_payment';
      const transactionId = uuid ? createDemoTransactionId(uuid) : createDemoTransactionId();
      const pending = firstRow(await restRequest('payments?select=id,booking_id,amount,payment_method,payment_status,transaction_id,created_at', {
        method: 'POST',
        body: {
          booking_id: booking.id,
          amount: booking.total_price,
          payment_method: parsed.value.paymentMethod,
          payment_status: 'pending',
          transaction_id: transactionId,
        },
      }));
      if (!pending) throw new Error('Supabase did not return the created payment record.');

      const finalStatus = simulateDemoOutcome(random);
      let payment;
      stage = 'finalize_payment';
      try {
        payment = firstRow(await restRequest(`payments?id=eq.${pending.id}&payment_status=eq.pending&select=id,booking_id,amount,payment_method,payment_status,transaction_id,created_at`, {
          method: 'PATCH', body: { payment_status: finalStatus },
        }));
        if (!payment) throw new Error('The pending demo payment could not be finalized.');
      } catch (error) {
        if (finalStatus === 'successful' && isUniquePaymentConflict(error)) {
          await restRequest(`payments?id=eq.${pending.id}&payment_status=eq.pending`, { method: 'PATCH', body: { payment_status: 'failed' } }).catch(() => {});
          return response.status(409).json({ error: 'Another request completed a successful payment for this booking first.' });
        }
        return response.status(202).json({
          payment: pending,
          booking: { id: booking.id, pickup_date: booking.pickup_date, return_date: booking.return_date },
          message: 'The demo payment is pending. Refresh payment history shortly.',
        });
      }

      return response.status(201).json({ payment, booking: { id: booking.id, pickup_date: booking.pickup_date, return_date: booking.return_date }, demoOnly: true });
    } catch (error) {
      // Safe diagnostics: never log bearer tokens, key values, booking IDs, or response bodies.
      console.error('[demo-payment] Supabase request failed', {
        stage,
        status: Number.isInteger(error?.status) ? error.status : undefined,
        code: typeof error?.code === 'string' ? error.code : undefined,
        errorName: typeof error?.name === 'string' ? error.name : 'Error',
      });
      return response.status(502).json({ error: 'AutoRent could not complete the demo payment right now. Please try again.' });
    }
  };
}

export function createPaymentRouter({ config, fetchImpl = fetch, random = Math.random, uuid }) {
  const router = express.Router();
  router.post('/demo', createDemoPaymentHandler({ config, fetchImpl, random, uuid }));

  return router;
}

export function createPaymentApp({ config, fetchImpl = fetch, random = Math.random, uuid }) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use((request, response, next) => {
    response.setHeader('access-control-allow-origin', config.frontendOrigin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-headers', 'authorization, content-type');
    response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    if (request.get('origin') && request.get('origin') !== config.frontendOrigin) return response.status(403).json({ error: 'This frontend origin is not allowed.' });
    return next();
  });
  app.get('/api/health', (_request, response) => response.json({ status: 'ok', app: 'AutoRent API' }));
  app.use('/api/payments', createPaymentRouter({ config, fetchImpl, random, uuid }));
  return app;
}
