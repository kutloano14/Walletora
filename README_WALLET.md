# Walletora — Wallet (Customer) README

Purpose
- Explains customer wallet flows: viewing balance, support flow, making payments, and withdrawals.

Key Features
- View wallet balance and transaction history
- Pay for orders using wallet balance
- Request withdrawals (driver-side request opens email to operations)
- Submit support requests (opens user's email client with pre-filled details)

Support Flow
- Frontend constructs a pre-filled `mailto:` link with subject and body containing user, wallet, and request details.
- `mailto:` is used as a reliable, client-side fallback to avoid CORS and to allow the user to review before sending.
- There is a server-side Edge Function stub `supabase/functions/send-support-email` that can be used when deployed and configured for CORS/sender credentials.

Checkout & Payments
- `Checkout.tsx` calculates `itemsTotal` and `deliveryFee` (Haversine formula).
- If wallet funds are insufficient, a configurable penalty transaction can be applied (falls back to allowed transaction types if DB check constraints exist).
- Successful payments create `wallet_transactions` rows and reduce the `wallets.balance`.

Withdrawals
- Drivers submit withdrawal requests (opens email to operations by default).
- Admin approves/marks as paid via the Admin panel. When marking paid, associated wallet and transaction rows are updated.

Troubleshooting
- Checkout fails: check `decrease_stock` RPC and `wallet_transactions` constraint violations.
- `mailto:` does not open: instruct users to open their native email client or copy the recipient address listed in UI.
- Emails not sent server-side: verify Edge Function deployment and SMTP credentials.

Testing
- Place a test order and verify:
  - `orders` + `order_items` rows
  - `wallet_transactions` entry for payment
  - Wallet balance update

Developer Notes
- Keep `VITE_API_URL` and Supabase keys correctly configured in `.env` for API calls.
- Avoid committing `.env` to version control.

_Last updated: December 5, 2025_