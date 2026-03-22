import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback to localStorage mode if Supabase isn't configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey && supabaseUrl !== "https://your-project.supabase.co");

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
