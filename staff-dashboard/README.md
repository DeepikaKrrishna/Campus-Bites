# CampusBites Staff Dashboard

An independent React/Vite staff application. It uses the same Supabase project as the student app and does not create a second orders database.

## Local setup

1. In Supabase, apply the existing CampusBites schema and the repository migration `../supabase/migrations/20261025_transactional_order_tracking.sql`. This migration adds the atomic status-transition RPC and milestone timestamps used by the dashboard. Do not put a service-role key in a `VITE_` variable.
2. Copy `.env.example` to `.env` in this folder and fill in the values from the **same Supabase project** used by the student app:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used by the browser for sign-in and Realtime.
   - `SUPABASE_SERVICE_ROLE_KEY` is used only by the local API and Vercel Function. Keep it server-side and out of Git.
3. Install dependencies from this folder: `npm install`.
4. Start the local API in one terminal:

   ```powershell
   cd "C:\Users\Admin\Downloads\CampusBites (1)\staff-dashboard"
   npm run dev:api
   ```

5. Start the dashboard in a second terminal:

   ```powershell
   cd "C:\Users\Admin\Downloads\CampusBites (1)\staff-dashboard"
   npm run dev
   ```

The local Vite server proxies `/api` to the local staff API on port 8788. The API verifies every Supabase session and checks trusted `app_metadata` or `public.staff_roles` before returning orders or allowing transitions.

## Authorize a staff account

Have a Supabase project administrator add the account's Auth user UUID to the existing `public.staff_roles` table using the SQL Editor. The staff member must sign up or be invited first. Replace the placeholder with that account's UUID:

```sql
insert into public.staff_roles (user_id, role)
values ('00000000-0000-4000-8000-000000000000', 'staff')
on conflict (user_id) do update set role = excluded.role;
```

The dashboard does not provide a role-editing or self-promotion flow. An ordinary student can sign in but receives no order data or actions unless an administrator explicitly assigns a staff role.

## Deploy as a separate Vercel project

1. Import the existing CampusBites repository as a **new** Vercel project; leave the student app's Vercel project and settings unchanged.
2. Set the new project's **Root Directory** to `staff-dashboard`.
3. Use these project settings (also recorded in `vercel.json`):
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variables for Preview and Production:
   - `VITE_SUPABASE_URL` — same Supabase project URL as the student app.
   - `VITE_SUPABASE_ANON_KEY` — that project's public anon/publishable key.
   - `SUPABASE_SERVICE_ROLE_KEY` — that project's server-only service-role key. Do not prefix it with `VITE_`.
   - Optional `SUPABASE_URL` — same project URL; if omitted, the server function uses `VITE_SUPABASE_URL`.
5. Deploy the new Vercel project. Its `/api/staff/orders` function shares the dashboard's own domain, so cross-origin API configuration is not needed.
6. In Supabase Auth URL Configuration, add the deployed dashboard URL to the allowed redirect URLs if you later enable OAuth or email-link authentication. Password sign-in works without an OAuth redirect callback.

To verify both apps point at one database, compare the project reference in their Supabase URLs and confirm both use the same Supabase project in the dashboard. The service-role key must stay only in server-side Vercel environment variables.

## Data and Realtime behavior

- Reads use the existing `orders` rows; item names, quantities, and historical prices come from their stored order snapshots.
- Updates call the existing `transition_order_status` RPC with the expected current status. The database row lock, valid transition checks, and history insert remain atomic, so concurrent updates receive a conflict response.
- Declining a new order records a reason as `CANCELLED` with `cancellation_reason`, matching the existing schema and state model.
- Realtime subscribes to the existing `public.orders` table, refreshes from the protected API after events/reconnection, and removes its channel on sign-out/unmount. The existing schema adds `orders` to `supabase_realtime`; confirm that publication and staff SELECT RLS are present in the target Supabase project.
- No production migration is applied by this app or its deployment.
