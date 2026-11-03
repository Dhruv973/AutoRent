import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigurationError = !supabaseUrl || !supabasePublishableKey
  ? 'Supabase is not configured. Add the project URL and publishable key to frontend/.env.local, then restart Vite.'
  : null;

// This browser client uses only the public publishable key. Database access is
// still governed by Supabase grants and Row Level Security policies.
export const supabase = supabaseConfigurationError
  ? null
  : createClient(supabaseUrl, supabasePublishableKey);
