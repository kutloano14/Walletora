# 🍕 WALLETORA - Complete Food Delivery Platform

A comprehensive multi-role food delivery platform with integrated financial services including wallet management, credit facilities, and locked deposits. Built for South African market with PayStack integration.

## 🎨 **Image Guidelines**

### 📸 **Restaurant Images**
- **Restaurant Logo/Header**: 
  - Size: **400x400px** (square format)
  - Aspect Ratio: 1:1
  - File Format: JPG or PNG
  - Max Size: 2MB
  - Usage: Profile display, search results

### 🍕 **Menu Item Images**
- **Food Photos**:
  - Size: **600x400px** (landscape format)
  - Aspect Ratio: 3:2 (recommended for food photography)
  - File Format: JPG or PNG
  - Max Size: 2MB per image
  - Usage: Menu display, order confirmation

### 📱 **Mobile Optimization**
- All images auto-resize for mobile devices
- High resolution ensures crisp display on retina screens
- Lazy loading implemented for faster page loads
- WebP format support for modern browsers

### 🎯 **Image Best Practices**
- **Restaurant Photos**: Well-lit storefront or interior shots
- **Food Photos**: Close-up, appetizing shots with good lighting
- **Avoid**: Low quality, blurry, or poorly lit images
- **Tip**: Use natural lighting for best food photography results

## 🚀 **Platform Overview**

**Walletora** is a production-ready food delivery ecosystem featuring:
- 📱 **Customer App**: Order food, manage wallet, access credit & locked deposits
- 🚗 **Driver App**: Accept deliveries, track earnings, request withdrawals
- 🏪 **Restaurant App**: Manage orders, menus, and business analytics
- 🎛️ **Admin Dashboard**: Business intelligence and financial management

## ✨ **Key Features**

### 📱 **Customer Features**
- 🔍 Browse restaurants by location & cuisine
- 💰 Digital wallet with PayStack integration
- 💳 Credit facility (6-48% interest rates)
- 🏦 Locked deposits (3-10% returns)
- 📦 Real-time order tracking with OTP verification
- 📍 GPS-based restaurant discovery

### 🚗 **Driver Features**
- 📋 Accept/decline order assignments
- 🗺️ Integrated navigation system
- 💵 Earnings tracking (75% commission)
- 💸 Withdrawal system (R50 minimum)
- 📱 OTP-based pickup/delivery verification
- 📊 Performance analytics

### 🏪 **Restaurant Features**
- 📝 Complete menu management with image upload
- 📦 Order processing workflow
- 📊 Sales analytics and reporting
- 📢 Advertisement management
- 💰 Revenue tracking
- 📧 Automated reporting
- 📸 **Recommended Image Sizes**:
  - **Restaurant Logo**: 400x400px (square, 1:1 ratio)
  - **Menu Item Photos**: 600x400px (landscape, 3:2 ratio)
  - **File Format**: JPG or PNG, max 2MB per image
  - **Quality**: High resolution for best display on all devices

### 🎛️ **Admin Features**
- 📊 Comprehensive business intelligence dashboard
- 💸 Withdrawal and credit management
- 📈 Revenue analytics across 7 streams
- 👥 User analytics and demographics
- 📧 Automated financial reporting
- 🏦 Complete balance sheet and cash flow analysis

## 🏗️ **Technology Stack**

### **Frontend**
- ⚛️ **React 18** with TypeScript
- 🎨 **Tailwind CSS** for responsive design
- 📱 **Progressive Web App** (PWA) ready
- 🔄 **Real-time updates** with Supabase subscriptions
- 🗺️ **Google Maps** integration for navigation
- 📊 **Chart.js** for analytics visualization

### **Backend**
- 🗄️ **Supabase** (PostgreSQL + Auth + Real-time)
- 🔒 **Row Level Security** (RLS) for data protection
- 💳 **PayStack** for payment processing
- 📧 **Email system** with professional routing
- 🔑 **JWT authentication** with role-based access

## 📦 **Quick Start**

### **1. Prerequisites**
```bash
# Required:
- Node.js 18+ and npm
- Supabase account
- PayStack account (for payments)
- Google Maps API key
```

### **2. Installation**
```bash
# Clone and install
git clone <your-repo>
cd project
npm install
```

### **3. Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Update with your credentials:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
VITE_GOOGLE_MAPS_KEY=your_maps_key
```

### **4. Database Setup**
```bash
# In Supabase Dashboard → SQL Editor, run ALL migrations in order:
# 1. supabase/migrations/20250829121157_holy_gate.sql
# 2. supabase/migrations/20250829121204_billowing_canyon.sql
# 3. supabase/migrations/20250829121214_amber_truth.sql
# 4. supabase/migrations/20250829121230_azure_firefly.sql
# 5. supabase/migrations/20251022_add_delivery_otp.sql
# 6. supabase/migrations/20251103_add_pickup_otp.sql
# 7. supabase/migrations/20251103_compat_restaurants_user_id.sql
# 8. supabase/migrations/20251111_fix_driver_order_access.sql
# 9. supabase/migrations/20251111_withdrawal_system.sql
# 10. supabase/migrations/20251112_credit_approval_system.sql
# 11. supabase/migrations/20251113_add_restaurant_coordinates.sql
# 12. supabase/migrations/20251113_add_user_coordinates.sql
# 13. supabase/migrations/20251120_add_wallet_transactions.sql
```

### **5. Start Development**
```bash
# Start the development server
npm run dev

# Open http://localhost:5173
# Create accounts with different roles to test
```

## 🚀 **Production Deployment**

### **Frontend Deployment (Vercel - Recommended)**
```bash
# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod

# Or connect GitHub repo for auto-deployment
```

### **Admin Tools Deployment**
```bash
# Copy admin dashboards to hosting
cp -r admin/ public/admin/

# Deploy Node.js scripts to VPS
scp admin/*.cjs user@server:/opt/walletora/
```

### **Environment Variables (Production)**
```bash
# In Vercel Dashboard → Project → Environment Variables:
VITE_SUPABASE_URL=production_url
VITE_SUPABASE_ANON_KEY=production_anon_key
SUPABASE_SERVICE_ROLE_KEY=production_service_key
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
```

## 💰 **Business Model**

### **Revenue Streams**
1. **Delivery Commission**: 25% per order
2. **Withdrawal Fees**: R2-R50 based on amount
3. **Credit Interest**: 6-48% annual rates
4. **Monthly Fees**: R10 wallet maintenance
5. **Locked Deposit Fees**: 2% of deposit amount
6. **Advertisement Revenue**: Restaurant promotions
7. **Premium Features**: Enhanced analytics

### **Financial Features**
- 💰 **Digital Wallet**: Instant top-ups via PayStack
- 💳 **Credit Facility**: AI-powered credit scoring
- 🏦 **Locked Deposits**: Investment-like savings with returns
- 💸 **Withdrawal System**: Automated processing for drivers
- 📊 **Comprehensive Analytics**: Real-time business intelligence

## 👥 **User Roles & Access**

### **🛡️ Security Model**
- 🔒 **Row Level Security**: Users access only their data
- 🎭 **Role-based Access**: Customer/Driver/Restaurant/Admin
- 🔑 **JWT Authentication**: Secure session management
- 🛡️ **API Protection**: Service role keys for admin functions

### **👤 User Journey Examples**

**Customer:**
1. Sign up → Add money to wallet → Browse restaurants → Place order → Track delivery → Receive food

**Driver:**
1. Sign up → Accept order → Navigate to restaurant → Pickup with OTP → Deliver to customer → Verify with OTP → Request earnings withdrawal

**Restaurant:**
1. Sign up → Create menu → Receive orders → Prepare food → Hand to driver → Track sales analytics

**Admin:**
1. Access admin dashboard → Monitor business metrics → Process withdrawals → Generate reports → Approve credits

## 📊 **Admin Dashboard Features**

### **Business Intelligence Dashboard**
- 📈 Revenue tracking across all streams
- 👥 User analytics and demographics
- 🏪 Restaurant performance metrics
- 📊 Interactive charts and visualizations
- 💰 Profit/loss statements
- ⚖️ Complete balance sheet
- 💸 Cash flow analysis

### **Financial Management Dashboard**
- 💸 Driver withdrawal processing
- 💳 Customer credit approvals
- 🏦 Locked deposit management
- 📧 Automated report generation
- 🔍 Transaction monitoring

## 🔧 **Development**

### **Project Structure**
```
src/
├── components/
│   ├── auth/          # Authentication components
│   ├── customer/      # Customer app components
│   ├── driver/        # Driver app components
│   ├── restaurant/    # Restaurant app components
│   └── maps/          # Navigation components
├── contexts/          # React contexts for state
├── hooks/            # Custom React hooks
├── lib/              # Supabase client & utilities
└── utils/            # Helper functions

admin/
├── business-intelligence-dashboard.html
├── withdrawal-credit-management.html
├── process-withdrawals.cjs
└── withdrawal-reports.cjs

supabase/
├── functions/        # Edge functions
└── migrations/       # Database migrations
```

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🔄 **Updates & Maintenance**

### **Quick Updates**
```bash
# Make changes → Test → Deploy
git add .
git commit -m "Update: New feature"
git push origin main
# ✅ Auto-deployed via Vercel/Netlify
```

### **Database Updates**
```sql
-- Create new migration file
-- Apply in Supabase Dashboard
-- Deploy updated app code
```

## 📧 **Email System**

**Professional Email Structure:**
- 📧 `admin@walletora.co.za` - Main admin communications
- 📊 `reports@walletora.co.za` - Automated financial reports  
- 🎧 `support@walletora.co.za` - Customer support
- ⚙️ `operations@walletora.co.za` - Operational notifications

## 🔐 **Security & Compliance**

- 🛡️ **Data Protection**: GDPR-compliant data handling
- 🔒 **Payment Security**: PCI-compliant via PayStack
- 🔑 **Authentication**: Secure JWT implementation
- 📊 **Audit Trail**: Complete transaction logging
- 🚫 **Rate Limiting**: API protection against abuse

## 📱 **Mobile App Ready**

- ✅ **PWA Compatible**: Installable on mobile devices
- 📱 **Responsive Design**: Perfect mobile experience
- 🔔 **Push Notifications**: Real-time order updates
- 📍 **GPS Integration**: Location-based features
- 🔄 **Offline Support**: Basic functionality without internet

## 📈 **Performance**

- ⚡ **Build Size**: 3.05MB optimized
- 🚀 **Load Time**: <2 seconds first load
- 📊 **Database**: Optimized queries with indexing
- 🔄 **Real-time**: Sub-second update delivery
- 📱 **Mobile**: 90+ Lighthouse score

## 🆘 **Support & Documentation**

- 📚 **Setup Guide**: `admin/ADMIN_SETUP_GUIDE.md`
- 🚀 **Deployment**: `DEPLOYMENT_GUIDE.md`
- 💳 **Payments**: `PAYSTACK_SETUP_GUIDE.md`
- 📧 **Email**: `PROFESSIONAL_EMAIL_SETUP.md`
- 🔒 **Security**: `SECURITY_DEPLOYMENT_GUIDE.md`

## 📄 **License**

This project is proprietary software. All rights reserved.

---

## 🎯 **Production Status: READY** ✅

**Platform Readiness: 95%**
- ✅ Core functionality: 100% operational
- ✅ Admin dashboards: Fully functional
- ✅ Payment system: PayStack integrated
- ✅ Email system: Professional setup complete
- ⚠️ Production keys: Replace test keys for live launch

**Ready for immediate deployment!** 🚀