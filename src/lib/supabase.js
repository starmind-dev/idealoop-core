import { createClient } from "@supabase/supabase-js";

// Browser client — uses the anon key, safe to expose in frontend.
// RLS policies protect data; this client can only access what the
// logged-in user is allowed to see.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);