// ----------------- WALLETORA ADMIN WITHDRAWAL PROCESSOR -----------------
// This script helps you process driver withdrawal requests manually
// Run with: node admin/process-withdrawals.cjs

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY; // Use service role key for admin operations

console.log('🔍 Environment Check:');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Function to list all pending withdrawals
async function listPendingWithdrawals() {
  try {
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select(`
        id,
        amount,
        status,
        requested_at,
        driver_id,
        driver:user_profiles!driver_id(full_name, email, phone)
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) throw error;

    if (withdrawals.length === 0) {
      console.log('✅ No pending withdrawals found.');
      return [];
    }

    console.log(`\n📋 Found ${withdrawals.length} pending withdrawal(s):\n`);
    withdrawals.forEach((w, index) => {
      console.log(`${index + 1}. Withdrawal ID: ${w.id.substring(0, 8)}`);
      console.log(`   Driver: ${w.driver?.full_name} (${w.driver?.email})`);
      console.log(`   Amount: R${parseFloat(w.amount).toFixed(2)}`);
      console.log(`   Requested: ${new Date(w.requested_at).toLocaleDateString()}`);
      console.log(`   Status: ${w.status}`);
      console.log('   ' + '-'.repeat(50));
    });

    return withdrawals;
  } catch (err) {
    console.error('❌ Error fetching withdrawals:', err.message);
    return [];
  }
}

// Function to process a specific withdrawal
async function processWithdrawal(withdrawalId, newStatus, notes = null) {
  try {
    console.log(`\n🔄 Processing withdrawal ${withdrawalId.substring(0, 8)}...`);

    // Update withdrawal status
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
        notes: notes
      })
      .eq('id', withdrawalId);

    if (updateError) throw updateError;

    // If approved/paid, we would also update driver balance here
    // For now, just log the action
    console.log(`✅ Withdrawal ${withdrawalId.substring(0, 8)} marked as: ${newStatus}`);
    
    if (newStatus === 'paid') {
      console.log('💰 Payment processed successfully!');
      console.log('📧 Consider notifying the driver about the payment.');
    } else if (newStatus === 'approved') {
      console.log('✅ Withdrawal approved. Process payment and mark as "paid" when complete.');
    } else if (newStatus === 'rejected') {
      console.log('❌ Withdrawal rejected.');
      if (notes) console.log(`📝 Reason: ${notes}`);
    }

  } catch (err) {
    console.error('❌ Error processing withdrawal:', err.message);
  }
}

// Main admin interface
async function main() {
  console.log('🏢 WALLETORA WITHDRAWAL PROCESSOR');
  console.log('='.repeat(50));

  const withdrawals = await listPendingWithdrawals();
  
  if (withdrawals.length === 0) {
    console.log('\n✅ All withdrawals are up to date!');
    return;
  }

  console.log(`\n📋 Example commands to process withdrawals:`);
  console.log(`\n// To approve a withdrawal:`);
  console.log(`processWithdrawal('${withdrawals[0]?.id}', 'approved');`);
  console.log(`\n// To reject a withdrawal:`);
  console.log(`processWithdrawal('${withdrawals[0]?.id}', 'rejected', 'Insufficient funds');`);
  console.log(`\n// To mark as paid after bank transfer:`);
  console.log(`processWithdrawal('${withdrawals[0]?.id}', 'paid');`);
  
  console.log(`\n🔧 To process withdrawals:`);
  console.log(`1. Copy the processWithdrawal command above`);
  console.log(`2. Replace the withdrawal ID with the actual ID`);
  console.log(`3. Run the command in a Node.js environment`);
  console.log(`4. Verify the status change in your database`);

  // Example: Uncomment to actually process a withdrawal
  // await processWithdrawal('withdrawal-id-here', 'approved');
}

// Export functions for manual use
module.exports = {
  listPendingWithdrawals,
  processWithdrawal,
  supabase
};

// Run main function if script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

console.log('\n📚 Available functions:');
console.log('- listPendingWithdrawals(): List all pending withdrawals');
console.log('- processWithdrawal(id, status, notes): Process a withdrawal');
console.log('- Status options: "approved", "rejected", "paid"');