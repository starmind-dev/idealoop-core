import { createClient } from "@supabase/supabase-js";

// Server-side admin client — uses the service_role key.
// NEVER import this file from frontend/client components.
// This bypasses RLS and has full database access.
// Only use in API routes (src/app/api/**/route.js).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);