# Walletora — Admin README

Purpose
- This file explains how to access and operate the Admin panel, common admin workflows, and troubleshooting steps.

Access
- URL: `/admin/withdrawal-credit-management.html` (relative to your deployed site)
- Provide your Supabase project URL and service role key when prompted (or use configured admin auth if available).

Key Workflows
- Withdrawals
  - Review pending driver withdrawal requests.
  - Approve / Mark as Paid / Reject.
  - When marking paid, update driver wallet transactions and driver balance checks.
- Credits
  - Review customer credit requests and approve or deny.
- Users
  - View users, filter by role (customer, driver, restaurant, admin).
  - Inspect user wallets, transactions, and statuses.
- Orders Management
  - Search orders by order ID, customer, or restaurant.
  - Reassign orders to different drivers. Note: current workaround passes `driver.user_id` to `deliveries.driver_id` due to FK mismatch (see `DELIVERIES_FK_WORKAROUND.md`).

Admin Tips
- Use filters to limit by date, status, and role to find records quickly.
- When reassigning orders, verify both `deliveries` and `orders` table updates in the DB.
- For audit, check `order_reassignments_audit` (if present) after critical operations.

Environment Variables (Admin needs)
- `VITE_SUPABASE_URL` — frontend Supabase URL
- `VITE_SUPABASE_ANON_KEY` — anon/public key (for UI operations)
- `SUPABASE_SERVICE_ROLE_KEY` — service role (server-only, required for some admin operations in admin UI if used)

Quick Commands
```powershell
# Build frontend
npm run build

# Deploy Edge Functions (if you manage them locally)
supabase functions deploy send-support-email
supabase functions deploy send_csv_report
```

Troubleshooting
- Panel fails to load: confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct and that CORS is configured.
- Reassignment fails: check network console for API errors, confirm admin uses service role key if required, and inspect database for FK issues.
- Missing data: check Supabase migrations are applied and RLS policies are not blocking service-role access.

Security Notes
- Never store `SUPABASE_SERVICE_ROLE_KEY` in client-side code or commit it to Git. Use server-side environment variables.
- Admin actions are powerful — ensure keys and access are restricted to trusted admins only.

Contact
- For deployment or DB help: see `DEPLOYMENT_SETUP.md` and `FULL_DEPLOYMENT_GUIDE.md`.

_Last updated: December 5, 2025_