# 🏢 WALLETORA ADMIN SETUP GUIDE

## 📊 Two Admin Dashboards Available

### 1. **Business Intelligence Dashboard** (NEW!) 
📁 **File:** `business-intelligence-dashboard.html`
🎯 **Purpose:** Comprehensive revenue analytics with professional charts

### 2. **Withdrawal Management Dashboard**
📁 **File:** `withdrawal-dashboard.html`  
🎯 **Purpose:** Process driver and customer withdrawal requests

---

## 🚀 Business Intelligence Dashboard Features

### **📈 Revenue Analytics:**
- Total revenue from all sources
- Delivery commission tracking (20% of delivery fees)
- Withdrawal fees collected from customers
- Wallet service fees and monthly fees
- Net profit calculations and margins

### **📊 Professional Charts:**
- **Pie Charts:** Revenue sources breakdown
- **Doughnut Charts:** Expense categories and profit margins
- **Line Charts:** Revenue trends over time
- **Bar Charts:** Customer vs driver activity comparison
- **Double Circle Graphs:** Visual profit/expense ratios

### **💰 Key Business Metrics:**
- Total Revenue (all sources combined)
- Net Profit (revenue minus expenses)
- Total Fees Collected (withdrawal + service fees)
- Total Withdrawals Paid (driver + customer payouts)

### **⏰ Time Period Analysis:**
- 7 days, 30 days, 90 days, 1 year, or all time
- Period-over-period comparisons
- Trend analysis and growth tracking

---

## 🎯 Quick Start - Business Intelligence

### Step 1: Open BI Dashboard
📁 **Navigate to:** `c:\Users\HWIBI\Downloads\project_fixed\project\admin\`
📄 **Double-click:** `business-intelligence-dashboard.html`

### Step 2: Enter Database Credentials
**Supabase URL:**
```
https://xsjxtiyarsghakzfrlbw.supabase.co
```

**Supabase Service Role Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzanh0aXlhcnNnaGFremZybGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MDk3NDcsImV4cCI6MjA3MTA4NTc0N30.c9MBrqO6J3gqt_xX_MxRfNGZv-wygZKVTiUtn3owDUU
```

### Step 3: Click "🚀 Connect & Load Dashboard"
- Dashboard loads automatically with all charts
- Select different time periods (7d, 30d, 90d, 1y, all)
- Real-time revenue calculations

---

## 💼 What Revenue Sources Are Tracked

### **1. Delivery Commissions** 
- 20% of every delivery fee goes to Walletora
- Tracks completed deliveries only
- Shown in green on charts

### **2. Withdrawal Fees**
- R10 + 2.5% fee from customer withdrawals
- Minimum R15 per withdrawal
- Shown in yellow on charts

### **3. Wallet Service Fees**
- Monthly wallet maintenance fees
- Overdraft fees
- Service transaction fees
- Shown in blue on charts

### **4. Total Business Calculation**
```
Revenue = Delivery Commissions + Withdrawal Fees + Service Fees
Expenses = Driver Payouts + Customer Withdrawals + Operating Costs  
Profit = Revenue - Expenses
Margin = (Profit / Revenue) × 100%
```

---

## 📊 Dashboard Sections Explained

### **💰 Key Metrics Cards**
- **Total Revenue:** All money coming into Walletora
- **Net Profit:** Money left after paying drivers/customers
- **Total Fees:** Pure profit from fees charged
- **Total Withdrawals:** Money paid out to users

### **📈 Revenue Sources (Pie Chart)**
Shows where your money comes from:
- Green: Delivery commissions
- Yellow: Withdrawal fees  
- Blue: Wallet service fees

### **📉 Expense Breakdown (Pie Chart)**
Shows where money goes:
- Orange: Driver payouts
- Pink: Customer withdrawals
- Purple: Operating costs

### **📊 Revenue Trends (Line Chart)**
- Daily revenue over selected period
- Shows growth patterns
- Identifies peak business days

### **🎯 Profit Margin (Doughnut Chart)**
- Visual profit vs expense ratio
- Shows business health
- Target: Keep profit margin above 30%

### **👥 Activity Comparison (Bar Chart)**
- Driver vs customer transaction volume
- Helps understand user behavior
- Plan marketing strategies

---

## 💡 Business Intelligence Insights

### **Revenue Optimization:**
- Track which revenue sources grow fastest
- Identify seasonal patterns
- Optimize pricing strategies

### **Cost Management:**
- Monitor withdrawal patterns
- Track payout efficiency
- Control operating expenses

### **Growth Tracking:**
- Period-over-period comparisons
- Revenue trend analysis
- Profit margin monitoring

### **User Analytics:**
- Driver vs customer activity
- Withdrawal behavior patterns
- Fee structure effectiveness

---

## 🔧 Quick Actions

- **📊 Change Time Period:** Click period buttons (7d, 30d, etc.)
- **🔄 Refresh Data:** Click refresh button for latest data
- **📈 Export Charts:** Right-click charts to save as image
- **📋 View Details:** Scroll down for transaction tables

---

## 🎯 Business KPIs to Monitor

### **Daily Checks:**
- Total revenue vs yesterday
- New withdrawal requests
- Profit margin percentage

### **Weekly Reviews:**
- Revenue growth trends
- Withdrawal pattern analysis
- Fee collection efficiency

### **Monthly Analysis:**
- Profit margin optimization
- User activity trends
- Business growth metrics

---

## 📞 Quick Reference

**Dashboard Files:**
- `business-intelligence-dashboard.html` - Revenue analytics
- `withdrawal-dashboard.html` - Process withdrawals
- `process-withdrawals.cjs` - Command line tools
- `withdrawal-reports.cjs` - Generate CSV reports

**Key Formulas:**
- **Delivery Revenue** = delivery_fee × 0.15 (15% commission)
- **Withdrawal Fee** = max(15, 10 + amount × 0.025)
- **Advertisement Revenue** = R10 × posts × days_active
- **Monthly Fee** = wallet_balance × 0.15 ÷ 12
- **Credit Interest** = amount × interest_rate (6%-48% annual)
- **Early Unlock Penalty** = locked_amount × 0.02
- **Profit Margin** = (Revenue - Expenses) / Revenue × 100%

## 💰 **COMPLETE BUSINESS MODEL**

### **7 PRIMARY REVENUE STREAMS:**

1. **🚚 Delivery Commission (15%)** - Core platform revenue from all deliveries
2. **📅 Monthly Wallet Fees (15%)** - Recurring maintenance fees on wallet balances  
3. **💸 Withdrawal Fees** - Transaction fees on all withdrawals (min R15)
4. **🔒 Locked Deposits Revenue** - Early unlock penalties (2%) + float benefits
5. **💰 Credit Interest (6-48%)** - Interest on micro-loans and credit facilities
6. **📢 Advertisement Revenue (R10/post/day)** - Restaurant promotion fees per post per day
7. **🏦 Service Fees** - Overdraft, insufficient funds, and other penalty fees

### **Revenue Tracking:**
- **Real-time Analytics**: `simple-business-dashboard.html`
- **Comprehensive Reporting**: All streams tracked separately
- **Profit Optimization**: Detailed margin analysis and growth insights