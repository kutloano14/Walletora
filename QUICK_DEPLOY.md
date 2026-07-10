# 🚀 QUICK START - Deploy in 45 Minutes

## What You Need Ready:
- [ ] Paystack live API key (from paystack.com)
- [ ] Vercel account (free at vercel.com)
- [ ] GitHub account (if not already set up)
- [ ] Internet connection

---

## STEP 1: Update Paystack Key ⚡ (5 min)

1. Go to: https://dashboard.paystack.com/settings/developer
2. Copy your LIVE public key (pk_live_...)
3. Open file: `.env`
4. Find this line:
   ```
   VITE_PAYSTACK_PUBLIC_KEY=pk_test_44cc412ef3221ceb1b0e793319fd8a946f4718d3
   ```
5. Replace with your live key:
   ```
   VITE_PAYSTACK_PUBLIC_KEY=pk_live_YOUR_KEY_HERE
   ```
6. Save file

✅ **Done!**

---

## STEP 2: Push Code to GitHub 🔧 (2 min)

Open terminal in project folder:

```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

✅ **Done!**

---

## STEP 3: Deploy to Vercel 🚀 (10 min)

Go to: https://vercel.com

1. Click "New Project"
2. Import your GitHub repository
3. Select the project folder (if asked)
4. Add environment variables:
   - Copy all values from `.env` file
   - Paste into Vercel environment variables
5. Click "Deploy"

**Wait for build to complete** (usually 2-3 minutes)

Once done, you'll see:
```
✅ Production: https://walletora.vercel.app
```

✅ **Your app is LIVE!**

---

## STEP 4: Deploy Edge Functions 📧 (10 min)

Open terminal and run:

```bash
# Deploy email function
supabase functions deploy send-support-email

# Deploy report function
supabase functions deploy send_csv_report

# Verify
supabase functions list
```

You should see both functions listed.

✅ **Done!**

---

## STEP 5: Test Everything ✔️ (10 min)

### Test 1: Customer Support
- Open app: https://walletora.vercel.app
- Go to Wallet page
- Click "Support" button
- ✅ Email should open

### Test 2: Admin Panel
- Go to: https://walletora.vercel.app/admin/withdrawal-credit-management.html
- Enter your Supabase URL and API key
- ✅ Should load dashboard

### Test 3: Create an Order
- Login as customer
- Place an order
- ✅ Order appears in admin panel

### Test 4: Driver App
- Login as driver
- Accept an order
- ✅ Should appear in driver dashboard

✅ **All tests pass!**

---

## STEP 6: Set Up Weekly Reports ⏰ (5 min)

Go to Supabase Dashboard:

1. Click "Webhooks" (left sidebar)
2. Create new webhook:
   - Name: "Weekly Reports"
   - Function: `send_csv_report`
   - Event: HTTP POST
   - Schedule: Every 7 days, Monday at 00:00 UTC
3. Enable
4. Save

Now your reports will send automatically every week!

✅ **Done!**

---

## 🎉 YOU'RE LIVE!

**Your app is now deployed and ready for users!**

### What's Now Live:
- ✅ Customer app (orders, delivery tracking, support)
- ✅ Driver app (deliveries, earnings, withdrawals)
- ✅ Restaurant dashboard (order management)
- ✅ Admin panel (approvals, reports, user management)
- ✅ Automated weekly reports
- ✅ Payment processing (Paystack live)
- ✅ Email notifications

### Share These Links:
- **Main App:** https://walletora.vercel.app
- **Admin:** https://walletora.vercel.app/admin/withdrawal-credit-management.html
- **BI Dashboard:** https://walletora.vercel.app/admin/business-intelligence-dashboard.html

### First Week Checklist:
- [ ] Check admin email for first weekly report
- [ ] Monitor for any errors (Vercel dashboard)
- [ ] Get feedback from early users
- [ ] Test all features with real data
- [ ] Fix any bugs

---

## ⏱️ Estimated Total Time: 45 Minutes

Start time: ________
End time: ________

---

**Ready?** Start with Step 1! 🚀
