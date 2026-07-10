# Walletora — BI & Reports README

Purpose
- Explains how the BI/reporting system works, how to trigger reports manually, and how to automate weekly reports.

What the Reports Contain
- 5-day transaction summary (orders, delivered count, revenue)
- CSV attachment with detailed rows: orders, wallet transactions, deliveries, restaurant summaries
- Email is sent to `RECIPIENT_EMAIL` (default `admin@walletora.co.za`)

Edge Function
- Function location: `supabase/functions/send_csv_report`
- Runtime: Supabase Deno Edge Function
- Main entry: `generate5DayReport()` which prepares CSV and summary and calls the mailer.

Manual Trigger (curl)
```bash
curl -X POST "https://<your-project>.supabase.co/functions/v1/send_csv_report" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

Automation (recommended)
- Use Supabase Webhooks or an external cron to POST to the function on a weekly schedule.
- Example cron (UTC Monday 00:00): `0 0 * * 1`
- In Supabase Dashboard: Webhooks → Create new webhook → select `send_csv_report` and set the cron expression.

Environment Variables (Edge Function)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `RECIPIENT_EMAIL` (admin), `BUSINESS_EMAIL` (for branding)

Troubleshooting
- `Email service not configured`: ensure `SMTP_USER` and `SMTP_PASS` are present in function env.
- Emails landing in spam: check sending domain and use a proper sending service (SendGrid, Mailgun) for production.
- Function errors: check Supabase function logs in the dashboard and verify DB queries (permissions, RLS).

Testing
- Use the test script approach (a small Node script) to query DB and simulate report generation locally.
- After deployment, run the manual curl trigger and confirm email delivery.

Notes
- The report function logs complete CSV output to the function logs (useful if an email fails).
- Keep `RECIPIENT_EMAIL` updated to the current admin inbox.

_Last updated: December 5, 2025_