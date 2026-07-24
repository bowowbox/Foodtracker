# 🥗 KinDee (กินดี) — Thai Nutrition Tracker

A clean, minimal web app for tracking what you eat every meal — with a built-in
database of foods commonly eaten in Thailand. Inspired by apps like Noom.

## Features

- **Meal-by-meal logging** — breakfast, lunch, dinner, and snacks & drinks
- **Big Thai-first food database** — 1,000+ items across 20 categories: Thai
  dishes (with pork / chicken / beef / seafood / tofu and regional variants),
  generic ingredients per 100 g, fast food & chains, café & bakery, snacks,
  drinks, desserts and international dishes — all with calories and macros
  (protein / carbs / fat), searchable in English or Thai (e.g. `pad thai` or `ส้มตำ`)
- **Add your own foods, with smart suggestions** — as you type a new food's
  name, KinDee suggests nutrition values from similar foods (tap to fill), plus
  dish-type starting points (rice dish, curry, dessert…) for anything with no
  close match. Saved foods are reused later.
- **Daily calorie goal** — set your target and watch the progress ring fill up
- **Encouraging words** — supportive messages that adapt to how your day is
  going (tap the card for another one)
- **Week overview** — see the last 7 days at a glance and jump between days
- **Weekly & monthly summaries** — tap 📊 for average calories, days on goal,
  average protein, a daily bar chart, your closest-to-goal and highest days, and
  most-logged foods (computed in the browser, no backend needed)
- **Fine serving quantities** — type any decimal portion (× 0.2, × 0.5, × 1.5)
  or nudge with 0.1-step buttons
- **Export to CSV** — tap 👤 → *Export food log (CSV)* to download every logged
  item (date, meal, food EN/Thai, serving, quantity, calories & macros); UTF-8
  BOM so Thai opens cleanly in Excel/Sheets. Works offline
- **Private by default, accounts when you want** — data is stored in your browser
  (`localStorage`) with no account required. Add a free
  [Supabase](https://supabase.com) project (keys in `config.js`) and every visitor
  can create their own account with an email magic link and sync across devices,
  each person's log isolated by row-level security — see
  [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)

## Running it

No build step, no dependencies. Either:

- Open `index.html` directly in a browser, or
- Serve the folder: `python3 -m http.server 8000` and visit
  <http://localhost:8000>, or
- Host it on GitHub Pages (Settings → Pages → deploy from branch).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout and modals |
| `styles.css` | All styling (mobile-first, minimal) |
| `foods.js` | Built-in Thai food database |
| `app.js` | App logic, state and localStorage persistence |

## Notes

- Nutrition values are approximations per typical serving; restaurant portions
  vary. Use them as a guide, not medical advice.
- Data lives in the browser you use it in. Clearing site data resets the app
  (goal, logs, and custom foods).
