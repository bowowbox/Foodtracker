# Backend setup — sync your log across devices (optional)

KinDee works fully offline with no account: everything is saved in your browser.
Turning on the backend adds **accounts + cross-device sync**, so your log is kept
per person and survives clearing your browser or switching phones/computers.

It uses [Supabase](https://supabase.com) (a hosted Postgres database with built-in
auth). The free tier is plenty for personal use. There's **no server of our own**
to run — the static site talks to Supabase directly.

## One-time setup (about 5 minutes)

1. **Create a project** at <https://supabase.com> → *New project*. Pick a name and
   a database password (you won't need the password for KinDee).
2. **Create the table.** In the project, open **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
   This creates a `user_data` table with row-level security so each person can only
   access their own data.
3. **Turn on email login.** Go to **Authentication → Providers → Email** and make
   sure it's enabled. (Magic links are on by default — no password needed.)
4. **Allow your site URL.** Go to **Authentication → URL Configuration** and add your
   Netlify URL (e.g. `https://your-site.netlify.app`) to **Site URL** and
   **Redirect URLs**, so the magic link brings people back to the app.
5. **Grab your keys.** Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long `eyJ…` string — this one is safe to use in a browser)

## Connect the app

1. Open KinDee and tap the **👤 account** button (top-left).
2. Paste the **Project URL** and **anon public key**, then **Connect**.
3. Enter your email and tap **Send magic link**. Open the email, click the link, and
   you're signed in. Your existing log uploads automatically the first time.
4. On another device, do the same (connect the same project, sign in with the same
   email) and your log appears there too.

## How syncing behaves

- **Signed out:** identical to before — data lives only in this browser.
- **Signed in:** every change is saved locally *and* pushed to Supabase (debounced a
  second or two). On load, if your account has newer data, it's pulled in.
- **Conflicts:** simple last-write-wins per device. Fine for one person on a couple of
  devices; if you need true multi-editor merging later, switch to the normalized
  `food_entries` table sketched at the bottom of `schema.sql`.
- **Privacy:** the anon key is meant to be public; row-level security is what protects
  your data, so one user can never read another's rows.

## Weekly & monthly summaries

The **📊 stats** screen (This week / This month) is always available and needs no
backend — it's computed from your log in the browser. Once you're signed in, it simply
reads the same log after it has synced.
