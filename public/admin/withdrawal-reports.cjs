// ----------------- WITHDRAWAL REPORTS GENERATOR -----------------
// Generate CSV reports for withdrawal tracking and business records
// Run with: node admin/withdrawal-reports.cjs

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Function to generate withdrawal report
async function generateWithdrawalReport(startDate = null, endDate = null) {
  try {
    console.log('📊 Generating withdrawal report...');

    let query = supabase
      .from('withdrawals')
      .select(`
        id,
        amount,
        status,
        requested_at,
        processed_at,
        notes,
        driver_id,
        driver:user_profiles!driver_id(full_name, email, phone)
      `)
      .order('requested_at', { ascending: false });

    // Add date filters if provided
    if (startDate) {
      query = query.gte('requested_at', startDate);
    }
    if (endDate) {
      query = query.lte('requested_at', endDate);
    }

    const { data: withdrawals, error } = await query;

    if (error) throw error;

    if (withdrawals.length === 0) {
      console.log('📝 No withdrawals found for the specified period.');
      return;
    }

    // Generate CSV content
    const headers = [
      'Withdrawal ID',
      'Driver Name', 
      'Driver Email',
      'Driver Phone',
      'Amount (R)',
      'Status',
      'Requested Date',
      'Processed Date',
      'Notes'
    ];

    const csvRows = [
      headers.join(','),
      ...withdrawals.map(w => [
        w.id,
        `"${w.driver?.full_name || 'N/A'}"`,
        w.driver?.email || 'N/A',
        w.driver?.phone || 'N/A',
        parseFloat(w.amount).toFixed(2),
        w.status,
        new Date(w.requested_at).toISOString().split('T')[0],
        w.processed_at ? new Date(w.processed_at).toISOString().split('T')[0] : 'N/A',
        `"${w.notes || ''}"`
      ].join(','))
    ];

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `withdrawals-report-${timestamp}.csv`;
    const filepath = path.join(reportsDir, filename);

    // Write CSV file
    fs.writeFileSync(filepath, csvRows.join('\n'));

    // Generate summary
    const summary = {
      total: withdrawals.length,
      pending: withdrawals.filter(w => w.status === 'pending').length,
      approved: withdrawals.filter(w => w.status === 'approved').length,
      paid: withdrawals.filter(w => w.status === 'paid').length,
      rejected: withdrawals.filter(w => w.status === 'rejected').length,
      totalAmount: withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0),
      paidAmount: withdrawals.filter(w => w.status === 'paid').reduce((sum, w) => sum + parseFloat(w.amount), 0)
    };

    console.log('📋 WITHDRAWAL REPORT SUMMARY');
    console.log('='.repeat(40));
    console.log(`📄 Report saved: ${filepath}`);
    console.log(`📊 Total withdrawals: ${summary.total}`);
    console.log(`⏳ Pending: ${summary.pending}`);
    console.log(`✅ Approved: ${summary.approved}`);
    console.log(`💰 Paid: ${summary.paid}`);
    console.log(`❌ Rejected: ${summary.rejected}`);
    console.log(`💵 Total requested: R${summary.totalAmount.toFixed(2)}`);
    console.log(`💸 Total paid: R${summary.paidAmount.toFixed(2)}`);

    return { filepath, summary };

  } catch (err) {
    console.error('❌ Error generating report:', err.message);
  }
}

// Function to generate driver earnings report
async function generateDriverEarningsReport() {
  try {
    console.log('📊 Generating driver earnings report...');

    const { data: earnings, error } = await supabase
      .from('earnings')
      .select(`
        id,
        amount,
        type,
        created_at,
        order_id,
        driver_id,
        driver:user_profiles!driver_id(full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate totals per driver
    const driverSummary = {};
    earnings.forEach(e => {
      const driverId = e.driver_id;
      if (!driverSummary[driverId]) {
        driverSummary[driverId] = {
          name: e.driver?.full_name || 'Unknown',
          email: e.driver?.email || 'N/A',
          phone: e.driver?.phone || 'N/A',
          totalEarnings: 0,
          deliveryCount: 0
        };
      }
      driverSummary[driverId].totalEarnings += parseFloat(e.amount);
      driverSummary[driverId].deliveryCount += 1;
    });

    // Generate CSV
    const headers = ['Driver Name', 'Email', 'Phone', 'Total Deliveries', 'Total Earnings (R)'];
    const csvRows = [
      headers.join(','),
      ...Object.values(driverSummary).map(d => [
        `"${d.name}"`,
        d.email,
        d.phone,
        d.deliveryCount,
        d.totalEarnings.toFixed(2)
      ].join(','))
    ];

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `driver-earnings-${timestamp}.csv`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, csvRows.join('\n'));

    console.log('📋 DRIVER EARNINGS SUMMARY');
    console.log('='.repeat(40));
    console.log(`📄 Report saved: ${filepath}`);
    console.log(`👥 Active drivers: ${Object.keys(driverSummary).length}`);
    console.log(`🚚 Total deliveries: ${earnings.length}`);
    console.log(`💰 Total earnings paid: R${Object.values(driverSummary).reduce((sum, d) => sum + d.totalEarnings, 0).toFixed(2)}`);

    return filepath;

  } catch (err) {
    console.error('❌ Error generating earnings report:', err.message);
  }
}

// Main function
async function main() {
  console.log('📊 WALLETORA REPORTS GENERATOR');
  console.log('='.repeat(50));

  // Generate both reports
  await generateWithdrawalReport();
  console.log('\n' + '-'.repeat(50) + '\n');
  await generateDriverEarningsReport();

  console.log('\n✅ Reports generation complete!');
  console.log('📁 Check the "admin/reports/" folder for CSV files');
}

module.exports = {
  generateWithdrawalReport,
  generateDriverEarningsReport
};

if (require.main === module) {
  main().catch(console.error);
}