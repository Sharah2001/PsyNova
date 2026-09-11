# PayHere integration fix

## What was fixed

1. PayHere now uses the server-side `APP_URL` for `return_url`, `cancel_url`, and `notify_url`. A browser-supplied origin is no longer trusted.
2. The real PayHere callback is `/api/payments/payhere/notify` and accepts PayHere's `application/x-www-form-urlencoded` POST body.
3. `/api/payhere/webhook` is kept as a compatibility alias to the canonical callback.
4. Payment notifications are verified with PayHere's MD5 formula before a booking is confirmed.
5. The callback also checks merchant ID, LKR currency, and that the PayHere amount matches the booking fee.
6. Payment gateway response data is stored with the booking for troubleshooting/audit.
7. The duplicate checkout hash implementation is now a compatibility wrapper around the same PayHere service.
8. The booking entity had a misplaced TypeORM decorator for `rescheduleStatus`; this is corrected.
9. Pending bookings now pass the real slot ID to PostgreSQL through `saveBooking`.
10. The frontend no longer depends on an un-loaded PayHere JavaScript global. It uses the official Checkout API HTML form redirect, while payment confirmation remains server-side through `notify_url`.
11. The example environment file no longer contains a hard-coded Merchant Secret.

## Required environment

Keep your real `.env.local` on your machine. It is intentionally not included in the fixed ZIP.

```env
APP_URL="https://YOUR-PUBLIC-HTTPS-DOMAIN"
PAYHERE_MERCHANT_ID="YOUR_MERCHANT_ID"
PAYHERE_MERCHANT_SECRET="YOUR_DOMAIN_SPECIFIC_MERCHANT_SECRET"
PAYHERE_MODE="sandbox"
```

`APP_URL` must be the same public HTTPS domain registered under PayHere Integrations. PayHere says the Merchant Secret is domain-specific, so if you change an ngrok domain, register the new domain and use its new Merchant Secret.

## Test order

1. Start PostgreSQL.
2. Run the pending TypeORM migrations.
3. Start PsyNova.
4. Start ngrok against the same local port.
5. Put the current ngrok HTTPS URL in `APP_URL` and register that domain in PayHere Sandbox.
6. Restart Next.js after changing `.env.local`.
7. Open PsyNova through the ngrok HTTPS URL, not localhost.
8. Make a booking and use the PayHere Sandbox test card documented by PayHere.
9. Confirm the server logs show a POST to `/api/payments/payhere/notify` and `MD5 verification result: true`.
10. Confirm the booking changes from `pending/pending` to `confirmed/paid` in PostgreSQL.

Do not mark a booking paid from the browser return page. The return page should only read the booking status from the database after the PayHere server notification is processed.
