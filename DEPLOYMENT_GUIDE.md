# 🚀 WALLETORA DEPLOYMENT GUIDE

## 📋 **DEPLOYMENT ARCHITECTURE OVERVIEW**

Your Walletora app has **4 main components** that need deployment:

### **1. 📱 Main React App (Customer/Driver/Restaurant)**
- **Technology**: Vite + React + TypeScript 
- **Files**: `src/`, `public/`, `index.html`
- **Deployment**: Static site hosting

### **2. 🎛️ Admin Dashboards (HTML)**
- **Files**: `admin/business-intelligence-dashboard.html`, `admin/withdrawal-dashboard.html`
- **Technology**: Static HTML + Chart.js
- **Deployment**: Web server hosting

### **3. ⚙️ Admin Tools (Node.js Scripts)**
- **Files**: `admin/process-withdrawals.cjs`, `admin/withdrawal-reports.cjs`
- **Technology**: Node.js scripts
- **Deployment**: Cloud server with cron jobs

### **4. 🗄️ Database & Backend**
- **Technology**: Supabase (already hosted)
- **Migrations**: Need to be applied to production database

---

## 🏗️ **DEPLOYMENT STRATEGY OPTIONS**

### **OPTION 1: 💰 Budget-Friendly (Recommended)**

#### **Frontend: Vercel/Netlify (FREE)**
```bash
# Build the main app
npm run build

# Deploy to Vercel
npx vercel --prod
# OR Deploy to Netlify (drag & drop dist/ folder)
```

#### **Admin Dashboards: Same hosting**
- Copy `admin/` folder to `public/admin/` before build
- Access via: `yourapp.com/admin/business-intelligence-dashboard.html`

#### **Admin Tools: VPS/DigitalOcean ($5-10/month)**
- Deploy Node.js scripts to cheap VPS
- Set up cron jobs for automated reports

#### **Total Cost: $5-10/month**

### **OPTION 2: 🚀 Professional (Scalable)**

#### **Frontend: Vercel Pro or AWS CloudFront**
- Custom domain with SSL
- Global CDN for fast loading
- Environment variable management

#### **Admin Tools: AWS Lambda or Google Cloud Functions**
- Serverless functions for admin scripts
- Pay only for usage
- Automated scaling

#### **Admin Dashboards: Separate subdomain**
- `admin.walletora.com` for admin access
- Enhanced security and access control

#### **Total Cost: $20-50/month**

---

## 📦 **STEP-BY-STEP DEPLOYMENT**

### **STEP 1: Prepare for Production**

#### **1. Environment Setup**
```bash
# Create production environment file
cp .env .env.production

# Update production URLs
VITE_API_URL=https://walletora.com
SUPABASE_URL=https://xsjxtiyarsghakzfrlbw.supabase.co
```

#### **2. Build the App**
```bash
# Install dependencies
npm install

# Build for production
npm run build
```

#### **3. Prepare Admin Files**
```bash
# Copy admin dashboards to public folder
mkdir -p public/admin
cp admin/*.html public/admin/
cp admin/ADMIN_SETUP_GUIDE.md public/admin/
```

### **STEP 2: Deploy Database**

#### **Apply All Migrations**
```sql
-- In Supabase SQL Editor, run all migration files in order:
-- 1. supabase/migrations/20250829121157_holy_gate.sql
-- 2. supabase/migrations/20250829121204_billowing_canyon.sql
-- 3. supabase/migrations/20250829121214_amber_truth.sql
-- 4. supabase/migrations/20250829121230_azure_firefly.sql
-- 5. All other migration files in chronological order
```

#### **Set Row Level Security**
```sql
-- Verify all RLS policies are active
-- Check admin access permissions
-- Test with your service role key
```

### **STEP 3: Deploy Frontend (Vercel)**

#### **Connect to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod
```

#### **Environment Variables in Vercel**
```
VITE_SUPABASE_URL=https://xsjxtiyarsghakzfrlbw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GOOGLE_MAPS_KEY=your_google_maps_key
VITE_ORS_KEY=your_ors_key
VITE_APP_NAME=Walletora
```

### **STEP 4: Deploy Admin Tools**

#### **Option A: Simple VPS (DigitalOcean/Linode)**
```bash
# Connect to VPS
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Upload admin scripts
scp admin/*.cjs root@your-server:/opt/walletora/
scp .env root@your-server:/opt/walletora/

# Set up cron jobs
crontab -e
# Add: 0 9 * * * cd /opt/walletora && node process-withdrawals.cjs
# Add: 0 0 1 * * cd /opt/walletora && node withdrawal-reports.cjs
```

#### **Option B: Serverless Functions**
```javascript
// vercel.json for admin functions
{
  "functions": {
    "admin/process-withdrawals.cjs": {
      "runtime": "nodejs18.x"
    }
  }
}
```

### **STEP 5: Configure Domain & SSL**

#### **Custom Domain Setup**
```bash
# In Vercel dashboard:
# 1. Add custom domain: walletora.com
# 2. Configure DNS records
# 3. SSL will be automatic

# For admin subdomain:
# admin.walletora.com → point to admin hosting
```

---

## 🔐 **SECURITY CONSIDERATIONS**

### **Production Environment Variables**
```bash
# Never commit these to git:
SUPABASE_SERVICE_ROLE_KEY=your_service_key
EMAIL_PASS=your_email_password

# Use environment variable services:
# - Vercel: Project Settings → Environment Variables
# - Netlify: Site Settings → Environment Variables
```

### **Admin Dashboard Security**
```javascript
// Add basic auth to admin dashboards
// Option 1: .htaccess password protection
// Option 2: Add login requirement to admin pages
```

### **API Security**
```sql
-- In Supabase, ensure RLS is enabled:
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
-- Verify admin access policies
```

---

## 📊 **MONITORING & MAINTENANCE**

### **Set Up Monitoring**
1. **Vercel Analytics** - Track app performance
2. **Supabase Logs** - Monitor database activity  
3. **Email Alerts** - For admin tool failures
4. **Uptime Monitoring** - Use UptimeRobot (free)

### **Backup Strategy**
1. **Database**: Supabase automatic backups
2. **Admin Reports**: Store in cloud storage
3. **Application Code**: Git repository backup

---

## 🎯 **PRODUCTION CHECKLIST**

### **Before Launch:**
- [ ] All migrations applied to production database
- [ ] Environment variables configured
- [ ] Admin dashboards accessible and secured
- [ ] Payment integration (Paystack) tested
- [ ] Google Maps API key configured
- [ ] Email notifications working
- [ ] Admin tools scheduled and tested
- [ ] Domain and SSL configured
- [ ] Monitoring and alerts set up

### **After Launch:**
- [ ] Test all user flows (customer, driver, restaurant)
- [ ] Verify admin dashboards show real data
- [ ] Check automated withdrawal processing
- [ ] Monitor revenue calculations
- [ ] Test business intelligence analytics

---

## 💡 **RECOMMENDED DEPLOYMENT APPROACH**

**For MVP Launch (Recommended):**

1. **Frontend**: Deploy to **Vercel** (free tier)
2. **Admin Dashboards**: Include with main app
3. **Admin Tools**: Simple VPS ($5/month)
4. **Database**: Keep Supabase
5. **Domain**: Custom domain through Vercel

**Total Cost: ~$5-15/month**

This gives you:
✅ Professional app deployment
✅ Admin business intelligence dashboards  
✅ Automated withdrawal processing
✅ Complete revenue tracking
✅ Scalable architecture for growth

**Need help with any specific deployment step?** 🚀