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

## Connect the app (once, before deploying)

1. Copy `config.example.js` to **`config.js`** in the same folder.
2. Paste your **Project URL** and **anon public key** into it.
3. Deploy the folder (with `config.js` included) to Netlify.

That's it — now **anyone who visits the site can create their own account**: they
tap the **👤** button, enter their email, click the magic link, and they're in.
Each person's data is isolated by row-level security. `config.js` is gitignored so
your keys aren't committed; the anon key is public-safe, but keeping it per
deployment is tidy.

> Personal use without editing files? If there's no `config.js`, the 👤 modal lets
> a single user paste the keys in-app instead. For a public app, prefer `config.js`.

## Exporting your data

Anyone can export their food log at any time (works offline too): open the **👤**
modal and tap **⬇ Export food log (CSV)**. You get one row per logged item — date,
meal, food name (English + Thai), serving, quantity, and the calories/protein/
carbs/fat actually eaten — with a UTF-8 BOM so Thai text opens correctly in Excel
and Google Sheets.

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
