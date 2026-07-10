# 🚀 Walletora Deployment Setup Guide

**Target Deployment Date:** November 28, 2025
**Current Status:** Code Ready ✅ | Server Ready ✅ | Database Ready ✅

---

## 📋 Pre-Deployment Checklist

### 1. ✅ Code Quality
- [x] All debug files removed
- [x] Build succeeds without errors
- [x] No breaking compilation errors
- [x] Email system configured
- [x] Report system tested and working

### 2. ✅ Database
- [x] Supabase project created
- [x] All migrations applied
- [x] RLS policies configured
- [x] Tables and relationships verified

### 3. ✅ Environment Variables
- [x] Supabase credentials set
- [x] Google Maps API key set
- [x] ORS (OpenRouteService) key set
- [x] Gmail credentials configured
- [x] Paystack test key set

### 4. ⏳ To Do Before Deployment

---

## 🎯 Deployment Steps (IN ORDER)

### **STEP 1: Update Paystack Key** (5 minutes)
**Current Status:** Using TEST key (pk_test_...)

**Action Required:**
1. Go to Paystack Dashboard: https://dashboard.paystack.com
2. Navigate to Settings → API Keys & Webhooks
3. Copy your LIVE public key (starts with `pk_live_`)
4. Update `.env` file:
   ```env
   # Change this line:
   VITE_PAYSTACK_PUBLIC_KEY=pk_test_44cc412ef3221ceb1b0e793319fd8a946f4718d3
   
   # To this (your live key):
   VITE_PAYSTACK_PUBLIC_KEY=pk_live_YOUR_LIVE_KEY_HERE
   ```
5. Save and commit

**⚠️ CRITICAL:** Don't deploy with test key - real payments won't process!

---

### **STEP 2: Deploy to Vercel** (10 minutes)

**Prerequisites:**
- GitHub account (if not already connected)
- Vercel account (free)

**Process:**
```bash
# 1. Make sure all changes are committed
git add .
git commit -m "Final deployment prep"

# 2. Build locally to verify
npm run build

# 3. Install Vercel CLI
npm install -g vercel

# 4. Deploy
vercel --prod

# 5. Follow prompts:
#    - Link to existing project (if you have one)
#    - Set environment variables when prompted
#    - Confirm deployment
```

**After Deployment:**
- Your app will be live at: `https://your-walletora.vercel.app`
- Admin panel at: `https://your-walletora.vercel.app/admin/withdrawal-credit-management.html`
- BI Dashboard at: `https://your-walletora.vercel.app/admin/business-intelligence-dashboard.html`

---

### **STEP 3: Deploy Edge Functions** (10 minutes)

**Note:** You have 2 Edge Functions to deploy

#### Function 1: `send-support-email` (Email support requests)
```bash
# Deploy the support email function
supabase functions deploy send-support-email
```
**Endpoint:** `https://xsjxtiyarsghakzfrlbw.supabase.co/functions/v1/send-support-email`

#### Function 2: `send_csv_report` (Weekly reports to admin)
```bash
# Deploy the CSV report function
supabase functions deploy send_csv_report
```
**Endpoint:** `https://xsjxtiyarsghakzfrlbw.supabase.co/functions/v1/send_csv_report`

**Verify Deployment:**
```bash
# List deployed functions
supabase functions list
```

---

### **STEP 4: Set Up Automated Weekly Reports** (5 minutes)

**Option A: Using Supabase Webhooks** (Recommended)

1. Go to Supabase Dashboard
2. Click on "Webhooks" in left sidebar
3. Create new webhook:
   - **Event:** HTTP request
   - **Name:** Weekly Report Generator
   - **Function:** send_csv_report
   - **Schedule:** Every 7 days at 00:00 UTC
   - **Payload:** `{ "type": "weekly_report" }`

4. Enable and save

**What happens:**
- Every Monday at midnight (UTC), function runs automatically
- Generates 5-day transaction report
- Emails CSV to admin@walletora.co.za

---

### **STEP 5: Update Production Domain** (Optional but Recommended)

If you have a custom domain (walletora.co.za):

1. **In Vercel Dashboard:**
   - Project Settings → Domains
   - Add custom domain
   - Follow DNS setup instructions

2. **Update .env for production:**
   ```env
   VITE_API_URL=https://walletora.co.za
   ```

---

### **STEP 6: Configure Email for Production** (Optional - Phase 2)

**Current Setup (Phase 1):**
- Gmail sends emails (kutlaonophasha@gmail.com)
- Works but shows personal email as sender

**Recommended for Production (Phase 2):**
- Switch to professional email service (SendGrid, Mailgun, AWS SES)
- Send from official Walletora email address
- Better delivery rates and email logs

**For now:** Phase 1 works perfectly fine for launch!

---

### **STEP 7: Final Testing** (15 minutes)

Before going fully live, test these scenarios:

**Test 1: Customer Support Email**
- Go to Customer App → Wallet
- Click "Support" button
- Verify email client opens with pre-filled info
- ✅ Should work

**Test 2: Help/Complaint Email**
- Go to Customer App → Profile
- Submit help request
- Verify email opens
- ✅ Should work

**Test 3: Driver Withdrawal Email**
- Go to Driver App → Request Withdrawal
- Verify email opens
- ✅ Should work

**Test 4: Create Test Order**
- Place an order as customer
- Track through driver app
- Complete delivery
- ✅ Order should record in admin panel

**Test 5: Admin Panel Access**
- Go to: `/admin/withdrawal-credit-management.html`
- Enter Supabase credentials
- Try to approve a withdrawal
- ✅ Admin controls should work

---

## 🔐 Security Checklist

Before going live:

- [ ] .env file is in .gitignore (never commit secrets)
- [ ] All API keys are rotated if ever exposed
- [ ] HTTPS enabled (Vercel does this automatically)
- [ ] CORS headers configured (done in Edge Functions)
- [ ] RLS policies enabled on Supabase (done)
- [ ] No console.log statements with sensitive data (cleaned)

---

## 📊 Deployment Timeline

| Step | Time | Status |
|------|------|--------|
| 1. Update Paystack Key | 5 min | ⏳ To Do |
| 2. Deploy to Vercel | 10 min | ⏳ To Do |
| 3. Deploy Edge Functions | 10 min | ⏳ To Do |
| 4. Set Up Report Webhooks | 5 min | ⏳ To Do |
| 5. Test All Features | 15 min | ⏳ To Do |
| **TOTAL** | **~45 minutes** | ⏳ Ready |

---

## 🎉 After Deployment

### First Week Checklist:
1. Monitor error logs (Vercel Dashboard)
2. Check admin email for weekly report
3. Test all user flows (customer, driver, restaurant, admin)
4. Collect user feedback
5. Fix any bugs that surface

### Communication:
- Tell users about the new app URL
- Send welcome emails to early users
- Set up customer support response process
- Monitor admin dashboard for issues

---

## 🆘 Troubleshooting

### If Paystack isn't working:
- Verify live key in .env
- Check Paystack webhook configuration
- Ensure app is live (not localhost)

### If emails aren't sending:
- Check Gmail app passwords in .env
- Verify SMTP settings
- Check email client opens (mailto: fallback)

### If reports aren't sending:
- Verify Edge Function deployed
- Check webhook is enabled
- Monitor Supabase function logs

### If admin panel doesn't connect:
- Verify Supabase credentials entered
- Check browser console for errors
- Ensure CORS headers are present

---

## 📞 Support Resources

**Vercel Issues:**
- https://vercel.com/support

**Supabase Issues:**
- https://supabase.com/docs

**Paystack Issues:**
- https://paystack.com/support

**Email Issues:**
- Check Gmail app passwords: https://myaccount.google.com/apppasswords

---

## ✅ Ready to Deploy?

**Yes! Everything is ready!**

1. Start with Step 1 (Update Paystack key)
2. Follow each step in order
3. Test after deployment
4. Go live! 🚀

**Questions?** Check the troubleshooting section or contact support.

---

**Last Updated:** November 28, 2025
**Deployment Status:** READY FOR LAUNCH ✅
