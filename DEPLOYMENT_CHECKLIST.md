# 🚀 Production Deployment Checklist

## 🔒 CRITICAL SECURITY ITEMS

### 1. Environment Variables (.env)
- [ ] **NEVER commit `.env` to git** - Verify `.gitignore` includes `.env`
- [ ] **Change Paystack to LIVE key** (not test)
  - Get from: https://dashboard.paystack.co → Settings → API Keys & Webhooks
  - Old: `pk_test_44cc412ef3221ceb1b0e793319fd8a946f4718d3`
  - New: `pk_live_xxxxxxxxxxxxx` (from your Paystack account)
- [ ] **Update SUPABASE_SERVICE_ROLE_KEY** - Use production Supabase instance
- [ ] **Change email credentials** if using production Gmail
  - [ ] Use app-specific password, not main Google password
  - [ ] Enable 2FA on Gmail account
- [ ] **Rotate all sensitive keys** before going live

### 2. Supabase Security
- [ ] **Enable Row Level Security (RLS)** on all public tables
  - Tables that need RLS:
    - `user_profiles` - Only users can see their own profile
    - `deliveries` - Only assigned driver can see
    - `orders` - Only customer/driver/restaurant can see
    - `earnings` - Only driver can see their own
    - `wallets` - Only owner can see
    - `wallet_transactions` - Only owner can see
    - `withdrawals` - Only owner can see
    - `credits` - Only owner can see
    - `drivers` - Public read, protected write
    
- [ ] **RLS Policy Examples:**
  ```sql
  -- user_profiles: Only user can see own profile
  CREATE POLICY "Users can see own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);
  
  -- deliveries: Only assigned driver
  CREATE POLICY "Driver can see own deliveries"
  ON deliveries FOR SELECT
  USING (driver_id = auth.uid());
  ```

- [ ] **Disable anonymous access** unless needed for signup
- [ ] **Use authenticated API client** (not anon key for admin operations)
- [ ] **Enable audit logging** in Supabase dashboard
- [ ] **Set up backup schedule** - Automatic daily backups
- [ ] **Test backup restoration** - Ensure you can recover

### 3. API Keys & Secrets
- [ ] **Google Maps API** - Restrict to your domain only
  - Go to: Google Cloud Console → APIs → Credentials
  - Set "Application restrictions" to "HTTP referrers"
  - Add: `https://yourdomain.com/*`

- [ ] **OpenRouteService (ORS) Key** - Keep private, use backend only
  - Don't expose in frontend code
  - Implement backend proxy for API calls

- [ ] **Paystack Public Key** - Can be public (it's in frontend)
- [ ] **Paystack Secret Key** - MUST be backend only
  - Use in admin backend/edge functions
  - Never expose to frontend

### 4. Authentication & Passwords
- [ ] **Admin panel access control**
  - [ ] Only admins can access `/admin/withdrawal-credit-management.html`
  - [ ] Implement role-based access checks
  - [ ] Add login requirement before showing admin panel
  
- [ ] **Change default/test passwords**
- [ ] **Implement password reset flow** for users who forget
- [ ] **Enable MFA for admin accounts** (if Supabase supports)
- [ ] **Rate limiting** on login attempts (prevent brute force)

### 5. Frontend Security
- [ ] **Remove all `console.log()` debug statements** ✅ DONE
- [ ] **Remove test/debug files** ✅ DONE
- [ ] **Use HTTPS only** (not HTTP)
- [ ] **Set security headers**:
  ```
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Strict-Transport-Security: max-age=31536000
  Content-Security-Policy: default-src 'self'
  ```
- [ ] **Never hardcode secrets** in code
- [ ] **Validate all user inputs** on frontend and backend
- [ ] **Sanitize user-generated content** to prevent XSS

### 6. Database Security
- [ ] **Change database passwords** from development
- [ ] **Enable SSL/TLS** for database connections
- [ ] **Disable public internet access** to database (Supabase handles this)
- [ ] **Create database backups** before launch
- [ ] **Test rollback procedures** in case of issues
- [ ] **Monitor slow queries** and optimize indexes
- [ ] **Set up alerts** for unusual database activity

### 7. Deployment Infrastructure
- [ ] **Use production domain** (not localhost or test domain)
- [ ] **Enable HTTPS/SSL certificate** (use Let's Encrypt if needed)
- [ ] **Set up CDN** for static assets (Vercel, Cloudflare, etc.)
- [ ] **Enable rate limiting** on API endpoints
- [ ] **Set up CORS properly** - Only allow your domain
  ```
  CORS_ORIGINS=https://yourdomain.com
  ```
- [ ] **Enable DDoS protection** (Cloudflare, AWS Shield, etc.)

### 8. Payment Processing (Paystack)
- [ ] **Switch to LIVE account** in `.env`:
  ```
  VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
  ```
- [ ] **Update webhook endpoint** to production URL
- [ ] **Test payment flow end-to-end** with small amount
- [ ] **Enable Paystack security features**:
  - [ ] Verify webhook signatures
  - [ ] Use secret key for backend calls
  - [ ] Enable address verification if needed
  
- [ ] **Have payment support contact ready** (Paystack support)
- [ ] **Monitor failed payments** and alerts
- [ ] **Test refund process** before going live
- [ ] **Ensure PCI compliance** - Don't store card data

### 9. Email Configuration
- [ ] **Switch to production email** (if applicable)
- [ ] **Test email delivery** with real domain
- [ ] **Set up SPF/DKIM/DMARC** records:
  ```
  SPF: v=spf1 include:sendgrid.net ~all
  DKIM: Configure in email provider
  DMARC: v=DMARC1; p=quarantine
  ```
- [ ] **Monitor email deliverability** (check spam folder)
- [ ] **Update email footer** with real company info
- [ ] **Enable email verification** for user accounts

### 10. Monitoring & Logging
- [ ] **Set up error logging** (Sentry, LogRocket, etc.)
- [ ] **Enable performance monitoring** (APM)
- [ ] **Monitor database performance** (slow queries, unused indexes)
- [ ] **Set up alerts for**:
  - [ ] Failed API calls
  - [ ] Payment failures
  - [ ] Database errors
  - [ ] High error rates
  - [ ] Unusual user activity
  
- [ ] **Regular log review** (daily for first week)

### 11. Backup & Disaster Recovery
- [ ] **Daily automated backups** of database
- [ ] **Backup strategy tested** - Can restore from backup
- [ ] **Document disaster recovery procedures**
- [ ] **Keep backup encryption keys** safe
- [ ] **Test restore process** monthly

### 12. Code & Dependencies
- [ ] **Run security audit**: `npm audit`
- [ ] **Update dependencies** to latest secure versions
- [ ] **Remove unused packages**
- [ ] **Code review** before deployment
- [ ] **Run tests** to ensure nothing is broken
  ```bash
  npm run build
  npm run lint
  npm test
  ```

### 13. Documentation
- [ ] **Document admin procedures**
- [ ] **Create user guides** for different roles
- [ ] **Document API endpoints** (if applicable)
- [ ] **Create runbooks** for common issues
- [ ] **Document emergency contacts** and escalation

### 14. Testing Before Launch
- [ ] **Test driver app** (accept order → complete delivery → earnings recorded)
- [ ] **Test restaurant app** (create order → mark as ready)
- [ ] **Test customer app** (place order → track delivery)
- [ ] **Test admin panel** (approve withdrawals, reassign orders)
- [ ] **Test payment flow** with test Paystack account (then live)
- [ ] **Test with real network** (not just localhost)
- [ ] **Load testing** - Can system handle peak traffic?
- [ ] **Security testing** - Penetration test if possible

---

## 📋 STEP-BY-STEP DEPLOYMENT GUIDE

### Phase 1: Pre-Launch (Now)
1. Complete all security checklist items above
2. Update `.env` with production values
3. Test all features in production environment
4. Set up monitoring and logging
5. Brief team on deployment

### Phase 2: Launch
1. **Backup current database**
2. **Deploy code** to production
3. **Run migrations** (if any pending)
4. **Verify all features** work in production
5. **Monitor closely** for first 24 hours

### Phase 3: Post-Launch (First Week)
1. **Monitor error logs** daily
2. **Check payment processing** works
3. **Review user feedback** for issues
4. **Be ready to rollback** if critical issues
5. **Gradual rollout** to full user base if beta tested

---

## 🚨 IMMEDIATE ACTION ITEMS

### Must Do Before Going Live:
1. **Update Paystack Key** from test to live
2. **Enable HTTPS** on your domain
3. **Set up RLS policies** on all sensitive tables
4. **Test payment flow** end-to-end
5. **Backup database** before any changes
6. **Set up error monitoring** (Sentry, etc.)
7. **Remove all console.log statements** ✅ DONE
8. **Set CORS origin** to production domain

### Verify These Work:
```bash
# Build for production
npm run build

# Check for errors
npm run lint

# Test critical flows:
# 1. Driver accepts order
# 2. Driver marks delivered
# 3. Earnings recorded
# 4. Admin approves withdrawal
# 5. Payment processed successfully
```

---

## 🔗 Useful Resources

- [Supabase Security Guide](https://supabase.com/docs/guides/auth)
- [Paystack Documentation](https://paystack.com/docs)
- [OWASP Security Checklist](https://owasp.org/www-project-top-ten/)
- [Vercel Deployment Security](https://vercel.com/docs/security)

---

## ⚠️ COMMON DEPLOYMENT MISTAKES

❌ **Don't:**
- Deploy with test API keys
- Commit `.env` to git
- Use same password everywhere
- Ignore error logs
- Skip backup before launch
- Deploy without testing first
- Leave debug code in production
- Use HTTP instead of HTTPS

✅ **Do:**
- Use environment variables
- Keep secrets in vault
- Unique strong passwords
- Monitor everything
- Regular backups
- Test thoroughly
- Remove debug code ✅ DONE
- Always use HTTPS

---

## 📞 Support Contacts

- **Supabase:** support@supabase.io
- **Paystack:** support@paystack.com
- **Your hosting provider:** [depends on where deployed]
- **Google Maps API:** developers.google.com/maps

---

**Status:** Ready for deployment ✅
**Next:** Update `.env` with production values and test!
