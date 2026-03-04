// ============================================================
// HeartSync — Supabase Client
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://hurmvhtxiwfxrkkugeba.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cm12aHR4aXdmeHJra3VnZWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODIxNDAsImV4cCI6MjA4ODE1ODE0MH0.f6L178QPwCg3RUaQH4gvVgsRtE4Ktx1cwbyW4ssA5dM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export default supabase;
