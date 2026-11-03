import { createPaymentApp } from './paymentApi.js';

const config = {
  port: Number(process.env.PORT || 3004),
  frontendOrigin: process.env.FRONTEND_ORIGIN?.trim(),
  supabaseUrl: process.env.SUPABASE_URL?.trim(),
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
};

const missing = Object.entries({
  FRONTEND_ORIGIN: config.frontendOrigin,
  SUPABASE_URL: config.supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: config.supabasePublishableKey,
  SUPABASE_SERVICE_ROLE_KEY: config.serviceRoleKey,
}).filter(([, value]) => !value).map(([name]) => name);

if (missing.length) {
  throw new Error(`Missing backend environment variables: ${missing.join(', ')}. Fill backend/.env with Supabase values; keep the service-role key out of the frontend.`);
}

const app = createPaymentApp({ config });
app.listen(config.port, () => console.log(`AutoRent API listening on port ${config.port}`));
