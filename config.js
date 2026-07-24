/* KinDee deployment config — OPTIONAL, enables accounts + cross-device sync.
 *
 * To turn on public sign-up so anyone can create their own account:
 *   1. Copy this file to `config.js` (same folder).
 *   2. Fill in your Supabase project URL and anon public key
 *      (Supabase dashboard → Project Settings → API).
 *   3. Deploy the folder (config.js included).
 *
 * The anon key is designed to be used in the browser and is safe to ship;
 * row-level security (see supabase/schema.sql) is what protects each user's
 * data. Without config.js, KinDee still works fully offline with no account.
 */
window.KINDEE_CONFIG = {
  SUPABASE_URL: "https://qeohfbenzozgbjopepyk.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlb2hmYmVuem96Z2Jqb3BlcHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NTk3NjAsImV4cCI6MjEwMDQzNTc2MH0.gLz5q6Eg758D6aRzvjofw0tTG3laFblLYpgc6ZGQPV4",
};
