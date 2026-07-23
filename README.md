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
- **Fine serving quantities** — type any decimal portion (× 0.2, × 0.5, × 1.5)
  or nudge with 0.1-step buttons
- **Private by design** — everything is stored in your browser
  (`localStorage`); no account, no server, no tracking

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
