# CampusBites — Smart Canteen Ordering System

A real campus food-ordering app with **Supabase backend** for authentication,
persistent orders, and real-time order tracking.

## Quick Start (Demo Mode — no backend needed)

```bash
npm install
npm run dev        # Opens at http://localhost:5173
```

Demo mode works fully: sign in with any email + 6-char password,
browse the menu, add to cart, place orders, and track them
(stages auto-advance on a timer). All data lives in localStorage.

---

## Deploy with Real Backend (Supabase)

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Pick a name and region (Mumbai is closest for you)
3. Save the **database password** — you'll need it

### Step 2: Set up the database

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run** — this creates tables, security policies, and seeds menu data

### Step 3: Enable Google OAuth (optional)

1. Dashboard → **Authentication** → **Providers** → **Google**
2. Add your Google OAuth Client ID and Secret
3. Set the redirect URL to your Vercel domain

### Step 4: Enable Realtime

1. Dashboard → **Database** → **Replication**
2. Make sure the `orders` table has realtime enabled
   (the SQL script does this, but verify it's on)

### Step 5: Connect the app

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key
```

Get these from: Dashboard → **Settings** → **API** → copy the
**Project URL** and **anon/public** key.

### Step 6: Deploy to Vercel

```bash
# Option A: CLI
npm i -g vercel
vercel              # preview
vercel --prod       # production

# Option B: GitHub
# Push to GitHub → import at vercel.com → it auto-detects Vite
```

On Vercel, add the same two env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Architecture

```
Frontend (React + Vite + Tailwind)
  ↕  Supabase JS Client
Backend (Supabase — hosted PostgreSQL + Auth + Realtime)
```

### Files

```
src/
  lib/
    supabase.ts     — Supabase client (auto-detects demo vs live)
    auth.ts         — Sign up, sign in, Google OAuth, session restore
    orders.ts       — Place order, fetch history, rate, realtime subscribe
    menu.ts         — Fetch menu from DB or local fallback
  data/
    menuItems.ts    — Local menu data (used in demo mode)
  pages/            — Login, Home, Menu, Cart, Track, Profile
  components/       — FoodCard, BottomNav
supabase/
  schema.sql        — Full database schema + RLS + seed data
```

### How the dual-mode works

| Feature | Demo Mode | Live Mode (Supabase) |
|---------|-----------|---------------------|
| Auth | Any email + 6-char pw | Real email/password + Google |
| Menu | Local `menuItems.ts` | `menu_items` table |
| Orders | localStorage | `orders` table with RLS |
| Tracking | Timer auto-advance | Realtime subscriptions |
| Rating | localStorage | Saved to `orders.rating` |

The app detects which mode to use based on whether `VITE_SUPABASE_URL`
is set. Zero code changes needed to switch.

---

## Managing the Canteen (Admin)

With Supabase connected:

- **Add/edit menu items**: Go to Supabase Dashboard → Table Editor → `menu_items`
- **Update order status**: Change `stage` column (0→1→2→3) — the student's app updates in real-time
- **View all orders**: Table Editor → `orders`
- **Disable a dish**: Set `available = false`

For a proper admin panel, you can build one later using the same Supabase client.
