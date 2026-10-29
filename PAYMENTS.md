# Razorpay Test Mode setup

Online checkout uses Razorpay Standard Checkout with server-created orders. The
server only accepts a `rzp_test_` Key ID, verifies the checkout signature, and
confirms the payment amount, currency, and captured status with Razorpay before
marking the CampusBites order paid. Online orders are hidden from the kitchen
and tracking views until payment is confirmed. No live-payment fallback or
simulated success path is available.

## Configure a development environment

1. In the Razorpay Dashboard, switch to **Test Mode** and create API keys.
2. Copy the Test Mode Key ID and Key Secret into the repository-root `.env`:

   ```dotenv
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

   Keep the Key Secret and Webhook Secret server-side; never add either to a
   `VITE_` variable or commit `.env`.
3. Apply `supabase/migrations/20261026_secure_razorpay_test_payments.sql` to
   the development Supabase project. It adds atomic payment reconciliation and
   durable webhook idempotency. This migration is not applied automatically.
4. Configure the Razorpay webhook URL to
   `https://<your-public-test-endpoint>/api/payments/webhook`, choose the
   `payment.captured` and `payment.failed` events, and set the exact same
   Webhook Secret in `.env`. For local webhook testing, use a temporary,
   authenticated HTTPS tunnel to the local Express server.
5. Ensure the repository-root `.env` also contains the project's Supabase URL,
   anon key, and server-only service-role key. The service-role key must never
   be exposed to Vite or committed.
6. Restart the Express server and Vite. Checkout opens the real Razorpay Test
   Mode interface; successful payment is shown only after server verification
   or a verified webhook.

Use the test payment methods and test details shown in the Razorpay Dashboard
documentation. Test success, failure, closing the checkout, and delayed webhook
delivery. The status/retry controls reuse the existing CampusBites order rather
than creating a duplicate order.

## Checks

Run `npm run test:payments` for payment-signature tests and `npm run build` for
the frontend production build. `npm test` also runs the existing staff
dashboard integration suite, which requires a dedicated Supabase test project
and its service-role credentials. End-to-end gateway and webhook testing
requires Razorpay Test Mode credentials.

Do not use live credentials, deploy, or apply this migration to production
without explicit approval.
