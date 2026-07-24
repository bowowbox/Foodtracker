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
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
};
