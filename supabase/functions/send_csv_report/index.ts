// ----------------- SUPABASE EDGE FUNCTION -----------------
// This function generates and logs 5-day transaction reports
// Deploy to Supabase and call via webhook or HTTP request

// Type declarations for Deno (Edge Function runtime)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

import { createClient } from '@supabase/supabase-js';

// ----------------- WALLETORA BUSINESS CONFIG -----------------
const BUSINESS_EMAIL = 'reports@walletora.co.za';
const ADMIN_EMAIL = 'admin@walletora.co.za';
const SUPPORT_EMAIL = 'support@walletora.co.za';
const OPERATIONS_EMAIL = 'operations@walletora.co.za';
const BUSINESS_PHONE = '0606464828';
const COMPANY_NAME = 'Walletora';
const BUSINESS_DOMAIN = 'walletora.co.za';

// Use Supabase environment variables - supporting both naming conventions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY');

// Email service configuration (simplified for Edge Functions)
const SMTP_USER = Deno.env.get('SMTP_USER') || BUSINESS_EMAIL;
const SMTP_PASS = Deno.env.get('SMTP_PASS'); // Resend API key or SMTP password
const RECIPIENT_EMAIL = Deno.env.get('RECIPIENT_EMAIL') || ADMIN_EMAIL;
const SUPPORT_EMAIL_ADDR = Deno.env.get('SUPPORT_EMAIL') || SUPPORT_EMAIL;
const OPERATIONS_EMAIL_ADDR = Deno.env.get('OPERATIONS_EMAIL') || OPERATIONS_EMAIL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials. Please check environment variables:');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌ Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌ Missing');
  throw new Error('Missing required environment variables');
}

console.log('📧 Email Configuration:');
console.log('BUSINESS_EMAIL (Sender):', BUSINESS_EMAIL);
console.log('SMTP_USER:', SMTP_USER);
console.log('SMTP_PASS:', SMTP_PASS ? '✅ Set' : '❌ Missing');
console.log('RECIPIENT_EMAIL (Admin):', RECIPIENT_EMAIL);
console.log('SUPPORT_EMAIL:', SUPPORT_EMAIL_ADDR);
console.log('OPERATIONS_EMAIL:', OPERATIONS_EMAIL_ADDR);

// ----------------- SMART EMAIL ROUTING -----------------
function getEmailRecipient(reportType: string): string {
  switch (reportType.toLowerCase()) {
    case 'withdrawal':
    case 'financial':
    case 'driver_earnings':
      return OPERATIONS_EMAIL_ADDR; // Operations handles financial matters
    case 'customer_support':
    case 'user_issues':
      return SUPPORT_EMAIL_ADDR; // Support handles customer issues
    case 'daily_report':
    case 'business_intelligence':
    case 'executive_summary':
    default:
      return RECIPIENT_EMAIL; // Admin receives reports and default emails
  }
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ----------------- EMAIL SENDING FUNCTION -----------------
async function sendEmailReport(emailSubject: string, emailBody: string, csvContent: string, fileName: string): Promise<{ success: boolean; reason?: string; emailId?: string }> {
  try {
    // Simple console logging for now - can be enhanced with actual email service
    if (!SMTP_PASS) {
      console.warn('⚠️ Email service not configured. Report generated but not emailed.');
      console.log('📧 To enable email sending, set SMTP_PASS environment variable');
      return { success: false, reason: 'Email service not configured' };
    }

    // Log email details (in production, this would send via email service)
    console.log('📧 Email would be sent with following details:');
    console.log('📤 From:', SMTP_USER);
    console.log('📥 To:', RECIPIENT_EMAIL);
    console.log('📋 Subject:', emailSubject);
    console.log('📎 Attachment:', fileName);
    console.log('📝 Body preview:', emailBody.substring(0, 200) + '...');
    
    // Simulate successful email sending
    const mockEmailId = `email_${Date.now()}`;
    console.log('✅ Email simulation completed');
    console.log('📧 Mock Email ID:', mockEmailId);
    
    return { 
      success: true, 
      emailId: mockEmailId,
      reason: 'Email simulated successfully (configure SMTP_PASS for real sending)'
    };

  } catch (error: any) {
    console.error('❌ Email function error:', error);
    return { success: false, reason: error.message || 'Email function error' };
  }
}

// ----------------- MAIN FUNCTION -----------------
async function generate5DayReport() {
  try {
    const now = new Date();
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    console.log(`🔍 Generating report for period: ${fiveDaysAgo.toISOString()} to ${now.toISOString()}`);

    // Fetch ALL orders from the last 5 days with restaurant and customer details
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, 
        customer_id, 
        restaurant_id, 
        total_amount, 
        delivery_fee,
        status, 
        created_at,
        restaurants!orders_restaurant_id_fkey(name, phone),
        customer:user_profiles!orders_customer_id_fkey(full_name, phone)
      `)
      .gte('created_at', fiveDaysAgo.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching orders:', error);
      throw error;
    }

    if (!orders || orders.length === 0) {
      console.log('ℹ️ No orders in the last 5 days.');
      return { message: 'No orders found', period: { from: fiveDaysAgo, to: now } };
    }

    console.log(`📊 Found ${orders.length} orders for 5-day period`);

    // Generate comprehensive CSV with business branding
    const headers = [
      'Order ID',
      'Restaurant Name', 
      'Customer Name',
      'Order Amount',
      'Delivery Fee',
      'Total Amount',
      'Status',
      'Date Created'
    ];

    const rows = orders.map((order) => {
      // Handle restaurant data (single object, not array)
      const restaurant = order.restaurants as any;
      const restaurantName = restaurant?.name || 'Unknown Restaurant';
      
      // Handle customer data (single object, not array) 
      const customer = order.customer as any;
      const customerName = customer?.full_name || 'Unknown Customer';
      
      const orderAmount = parseFloat(order.total_amount) || 0;
      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      const totalAmount = orderAmount + deliveryFee;
      
      return `"${order.id}","${restaurantName}","${customerName}",${orderAmount},${deliveryFee},${totalAmount},"${order.status}","${new Date(order.created_at).toLocaleDateString()}"`;
    });

    // Calculate period totals
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((sum, order) => {
      const orderAmount = parseFloat(order.total_amount) || 0;
      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      return sum + orderAmount + deliveryFee;
    }, 0);

    const totalDeliveryFees = deliveredOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.delivery_fee) || 0);
    }, 0);

    const totalOrders = orders.length;
    const deliveredCount = deliveredOrders.length;

    // Add summary section
    const summaryHeaders = ['', '', '', '', '', '', '', ''];
    const summary = [
      summaryHeaders,
      ['"=== WALLETORA 5-DAY PERIOD SUMMARY ==="', '', '', '', '', '', '', ''],
      [`"Period: ${fiveDaysAgo.toLocaleDateString()} to ${now.toLocaleDateString()}"`, '', '', '', '', '', '', ''],
      [`"Total Orders:"`, '', '', '', '', `${totalOrders}`, '', ''],
      [`"Delivered Orders:"`, '', '', '', '', `${deliveredCount}`, '', ''],
      [`"Total Revenue:"`, '', '', '', '', `R${totalRevenue.toFixed(2)}`, '', ''],
      [`"Total Delivery Fees:"`, '', '', '', '', `R${totalDeliveryFees.toFixed(2)}`, '', ''],
      ['', '', '', '', '', '', '', ''],
      [`"Generated by: ${COMPANY_NAME}"`, '', '', '', '', '', '', ''],
      [`"Contact: ${BUSINESS_EMAIL}"`, '', '', '', '', '', '', ''],
      [`"Phone: ${BUSINESS_PHONE}"`, '', '', '', '', '', '', '']
    ];

    const csvContent = [
      headers.join(','),
      ...rows,
      '',
      ...summary.map(row => row.join(','))
    ].join('\n');

    // Create period identifiers
    const periodStart = fiveDaysAgo.toISOString().split('T')[0];
    const periodEnd = now.toISOString().split('T')[0];
    const fileName = `Walletora_Transactions_${periodStart}_to_${periodEnd}.csv`;

    // Create email content
    const emailSubject = `${COMPANY_NAME} - 5-Day Transaction Report (${periodStart} to ${periodEnd})`;
    const emailBody = `
Dear ${COMPANY_NAME} Team,

Please find your comprehensive 5-day transaction report below.

PERIOD SUMMARY:
📅 Report Period: ${fiveDaysAgo.toLocaleDateString()} to ${now.toLocaleDateString()}
📦 Total Orders: ${totalOrders}
✅ Delivered Orders: ${deliveredCount}
💰 Total Revenue: R${totalRevenue.toFixed(2)}
🚚 Total Delivery Fees: R${totalDeliveryFees.toFixed(2)}

This report includes all transactions for the specified period to ensure complete accuracy.

CSV Content:
${csvContent}

---
${COMPANY_NAME}
Email: ${BUSINESS_EMAIL}
Phone: ${BUSINESS_PHONE}
    `;

    console.log(`✅ 5-day report generated successfully`);
    console.log(`📊 Report included ${totalOrders} orders, ${deliveredCount} delivered, R${totalRevenue.toFixed(2)} revenue`);
    
    // Attempt to send email
    console.log('📧 Attempting to send email...');
    const emailResult = await sendEmailReport(emailSubject, emailBody, csvContent, fileName);
    
    // Log the complete report for manual retrieval
    console.log('📋 COMPLETE REPORT:');
    console.log('='.repeat(50));
    console.log(emailBody);
    console.log('='.repeat(50));

    return {
      success: true,
      message: 'Report generated successfully',
      emailSent: emailResult.success,
      emailError: emailResult.reason || null,
      emailId: emailResult.emailId || null,
      summary: {
        period: { from: periodStart, to: periodEnd },
        totalOrders,
        deliveredOrders: deliveredCount,
        totalRevenue,
        totalDeliveryFees
      },
      csvContent,
      emailSubject,
      emailBody,
      fileName
    };
    
  } catch (err) {
    console.error('❌ Error generating report:', err);
    return { success: false, error: err };
  }
}

// ----------------- EDGE FUNCTION HANDLER -----------------
Deno.serve(async (req: Request) => {
  const { method } = req;
  
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`🚀 ${COMPANY_NAME} CSV report function called`);
    const result = await generate5DayReport();
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({ error: 'Function failed', details: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log(`📅 ${COMPANY_NAME} CSV report Edge Function ready`);
console.log(`📧 Reports will be generated for: ${ADMIN_EMAIL}`);
console.log(`🔗 Call this function via HTTP to generate reports`);