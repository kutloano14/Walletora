import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { PaystackButton } from "react-paystack";
import { Bar } from "react-chartjs-2";
import { Link } from "react-router-dom";
import {updateCreditScore} from "../../lib/creditScore";
import { User, LogOut } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type TransactionType =
  | "deposit"
  | "payment"
  | "markup"
  | "bonus"
  | "lock"
  | "unlock"
  | "service fee"
  | "overdraft_fee"
  | "insufficient_funds"
  | "credit"
  | "monthly_fee"
  | "withdrawal";


interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  locked_balance: number;
  credit_score: number;
  credit_limit: number;
  created_at: string;
  last_monthly_fee?: string;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  service_id?: string;
  created_at: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(false);

  // Add withdrawal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawalFee, setWithdrawalFee] = useState<number>(0);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_production_key_here";
  const [userEmail, setUserEmail] = useState("customer@walletora.com");

  // Add state for support functionality
  const [supportMessage, setSupportMessage] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);

  const CURRENCY = "ZAR";

// Apply monthly fee once per month per wallet
const applyMonthlyFee = async (wallet: Wallet, feeAmount: number = 10) => {
  try {
    if (!wallet) return;

    // Check if this is a newly created wallet (created within last hour)
    const walletCreated = new Date(wallet.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - walletCreated.getTime()) / (1000 * 60 * 60);
    
    // Don't apply fee to wallets created within the last hour (new accounts)
    if (hoursSinceCreation < 1) {
      return;
    }

    // Check if fee was applied in last 30 days
    const lastFee = wallet.last_monthly_fee ? new Date(wallet.last_monthly_fee) : null;
    const daysSinceLastFee = lastFee ? (now.getTime() - lastFee.getTime()) / (1000 * 60 * 60 * 24) : 30;

    if (daysSinceLastFee < 30) return; // Skip if less than 30 days

    // Avoid negative balance
    if (wallet.balance < feeAmount) return;

    const newBalance = wallet.balance - feeAmount;

    // Insert monthly fee transaction
    const { error: txnError } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "monthly_fee",
      amount: feeAmount,
      description: "Monthly wallet maintenance fee",
    });
    if (txnError) throw txnError;

    // Update wallet balance and last_monthly_fee timestamp
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: newBalance, last_monthly_fee: now.toISOString() })
      .eq("id", wallet.id);
    if (updateError) throw updateError;

  } catch (err) {
    // Error applying monthly fee - could be logged to monitoring service
  }
};

// Fetch or create wallet
const fetchWallet = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) return;

  let currentWallet: Wallet | null = null;

  const { data: wallets, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id);

  if (error) return;

  if (!wallets || wallets.length === 0) {
    // Create a new wallet if none exists
    const { data: newWallet, error: insertError } = await supabase
      .from("wallets")
      .insert({
        user_id: user.id,
        balance: 0,
        locked_balance: 0,
        credit_score: 50,
        credit_limit: 500,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    currentWallet = newWallet;
  } else {
    currentWallet = wallets[0];
  }

  // Apply monthly fee only if wallet exists
  if (currentWallet) {
    await applyMonthlyFee(currentWallet);
    
    // Refresh credit score and available credit limit
    const updatedCredit = await updateCreditScore(currentWallet.id);
    if (updatedCredit) {
      currentWallet = {
        ...currentWallet,
        credit_score: updatedCredit.credit_score,
        credit_limit: updatedCredit.credit_limit,
      };
    }
  }

  setWallet(currentWallet);
  setUserEmail(user?.email || "customer@walletora.com");
};
  
  const [showAll, setShowAll] = useState(false);

  const downloadCSV = (transactions: WalletTransaction[]) => {
    const header = "Type,Amount,Description,Date\n";
    const rows = transactions
      .map(
        (t) =>
          `${t.type},${t.amount},"${t.description || "-"}",${new Date(
            t.created_at
          ).toLocaleString()}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "transactions.csv";
    link.click();
  };

  const downloadPDF = (transactions: WalletTransaction[]) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write("<h1>Transaction History</h1>");
    win.document.write("<table border='1' style='width:100%; border-collapse:collapse;'>");
    win.document.write("<tr><th>Type</th><th>Amount</th><th>Description</th><th>Date</th></tr>");
    transactions.forEach((t) => {
      win.document.write(
        `<tr><td>${t.type}</td><td>R${t.amount.toFixed(
          2
        )}</td><td>${t.description || "-"} </td><td>${new Date(
          t.created_at
        ).toLocaleString()}</td></tr>`
      );
    });
    win.document.write("</table>");
    win.document.close();
    win.print();
  };

  const fetchTransactions = async () => {
    if (!wallet) return;
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false });
    if (!error && data) setTransactions(data);
  };

  const handlePaystackSuccess = async (ref: any) => {
    if (!wallet) return;

    try {
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "deposit",
        amount: depositAmount,
        description: `Deposit via Paystack Ref: ${ref.reference}`,
      });

      await supabase
        .from("wallets")
        .update({ balance: wallet.balance + depositAmount })
        .eq("id", wallet.id);

      await fetchWallet();
      await fetchTransactions();
      await updateCreditScore(wallet.id);

      setDepositAmount(0);
      alert("Deposit successful!");
    } catch (err) {
      console.error(err);
      alert("Deposit failed.");
    }
  };

  const handlePaystackClose = () => {
    alert("Payment cancelled");
  };

  // Calculate withdrawal fee (R10 + 2.5%, minimum R15)
  const calculateWithdrawalFee = (amount: number) => {
    return Math.max(15, 10 + (amount * 0.025));
  };

  // Handle withdrawal amount change
  const handleWithdrawAmountChange = (amount: number) => {
    setWithdrawAmount(amount);
    setWithdrawalFee(calculateWithdrawalFee(amount));
  };

  // Submit withdrawal request
  const handleWithdrawRequest = async () => {
    if (!wallet) return;
    
    const totalDeduction = withdrawAmount + withdrawalFee;
    
    // Enhanced validations
    if (withdrawAmount <= 0) return alert("Enter a valid amount");
    if (withdrawAmount < 50) return alert("Minimum withdrawal is R50");
    if (withdrawAmount > wallet.balance) return alert("Withdrawal amount exceeds available balance");
    if (totalDeduction > wallet.balance) return alert("Total amount (including fee) exceeds available balance");
    if (withdrawalFee < 15) return alert("Invalid withdrawal fee calculation");

    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) throw new Error("User not found");

      // Double-check wallet balance from database before submission
      const { data: currentWallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !currentWallet) {
        throw new Error("Could not verify wallet balance");
      }

      // Final validation with current database balance
      if (totalDeduction > currentWallet.balance) {
        return alert("Insufficient balance. Please refresh the page and try again.");
      }

      // Insert withdrawal request into database
      const { error } = await supabase
        .from('withdrawals')
        .insert([{
          driver_id: user.id, // Using driver_id field for customer too
          amount: withdrawAmount,
          withdrawal_fee: withdrawalFee,
          user_type: 'customer'
        }]);

      if (error) throw error;

      alert(`Withdrawal request submitted successfully!\nAmount: R${withdrawAmount}\nFee: R${withdrawalFee.toFixed(2)}\nTotal: R${totalDeduction.toFixed(2)}`);
      setShowWithdrawModal(false);
      setWithdrawAmount(0);
      setWithdrawalFee(0);

      // Refresh wallet balance
      await fetchWallet();
    } catch (err) {
      console.error('Withdrawal request failed:', err);
      alert('Failed to submit withdrawal request: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle support request submission
  const handleSupportRequest = async () => {
    if (!supportMessage.trim()) {
      alert('Please enter your message');
      return;
    }

    try {
      setSupportLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) throw new Error("User not found");

      // Get user profile for more context
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();

      // Prepare comprehensive support email
      const subject = `Wallet Support Request - ${user.email}`;
      const emailBody = `
WALLETORA SUPPORT REQUEST
========================

User Information:
- Email: ${user.email}
- Name: ${profile?.full_name || 'Not provided'}
- Phone: ${profile?.phone || 'Not provided'}
- User ID: ${user.id}

Wallet Information:
- Balance: R${wallet?.balance.toFixed(2) || '0.00'}
- Locked Balance: R${wallet?.locked_balance.toFixed(2) || '0.00'}
- Credit Score: ${wallet?.credit_score || 0}/100
- Credit Limit: R${wallet?.credit_limit || 0}
- Wallet ID: ${wallet?.id || 'N/A'}

Support Request:
${supportMessage}

Request Time: ${new Date().toLocaleString()}

========================
Please respond to this request within 24 hours.
      `;

      // Create mailto link with all the information
      const mailtoLink = `mailto:support@walletora.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      
      // Open email client
      window.open(mailtoLink, '_blank');

      alert('✅ Support email opened. Please send the email to complete your request.\\n\\nWe will respond within 24 hours.');
      setShowSupportModal(false);
      setSupportMessage('');
      
    } catch (err) {
      console.error('Support request error:', err);
      alert('❌ Failed to prepare support request. Please try again or contact support directly at support@walletora.co.za');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  useEffect(() => {
    const fetchWalletSetting = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("wallet_enabled")
        .eq("id", 1)
        .single();

      if (!error && data) {
        setWalletEnabled(Boolean((data as any).wallet_enabled));
      } else {
        setWalletEnabled(false);
      }
    };

    fetchWalletSetting();
  }, []);

  useEffect(() => {
    if (wallet) fetchTransactions();
  }, [wallet]);

  const totalBalance = wallet ? wallet.balance + wallet.locked_balance : 0;
  const chartData = {
    labels: transactions.map((t) => t.type),
    datasets: [
      {
        label: "Amount",
        data: transactions.map((t) => t.amount),
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  const paystackConfig = {
    reference: new Date().getTime().toString(),
    email: userEmail,
    amount: depositAmount * 100,
    publicKey,
    currency: CURRENCY,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      {/* TOP BAR */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur flex justify-between items-center px-4 py-3">
        <h1 className="text-xl font-bold text-slate-900">💳 Wallet</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => alert("Profile clicked")}
            className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            aria-label="Open profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="inline-flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-6xl p-4 pt-24 pb-8">
        {!walletEnabled && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <p className="font-semibold">Wallet is temporarily disabled.</p>
            <p className="mt-1 text-sm">Top-ups and withdrawals are paused for now. Your transactions and credit history still work, and payment is handled at checkout.</p>
          </div>
        )}

        {/* BALANCE CARD */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 p-6 shadow-lg text-white">
          <p className="text-sm font-medium opacity-90">Available Balance</p>
          <h2 className="mt-2 text-4xl font-bold">
            R{wallet?.balance.toFixed(2) || "0.00"}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="text-xs opacity-75">Locked</p>
              <p className="font-semibold">R{wallet?.locked_balance.toFixed(2) || "0.00"}</p>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="text-xs opacity-75">Total</p>
              <p className="font-semibold">R{totalBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* ACTIONS GRID */}
        {walletEnabled ? (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Deposit */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <PaystackButton
                  {...paystackConfig}
                  text="💳 Deposit"
                  onSuccess={handlePaystackSuccess}
                  onClose={handlePaystackClose}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                  disabled={depositAmount <= 0}
                />
              </div>
            </div>

            {/* Locked Savings */}
            <Link
              to="/locked-deposits"
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="text-center">
                <span className="text-3xl">🔒</span>
                <p className="mt-2 text-xs font-semibold text-slate-700">Locked Savings</p>
              </div>
            </Link>

            {/* Credit */}
            <Link
              to="/credit"
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="text-center">
                <span className="text-3xl">💰</span>
                <p className="mt-2 text-xs font-semibold text-slate-700">Credit</p>
              </div>
            </Link>

            {/* Withdraw */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex w-full flex-col items-center gap-2 transition hover:opacity-75"
              >
                <span className="text-3xl">💸</span>
                <p className="text-xs font-semibold text-slate-700">Withdraw</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-900">Wallet actions are paused</p>
                <p className="mt-1 text-sm text-slate-600">Transactions remain available for review, and credit still works normally.</p>
              </div>
              <Link
                to="/credit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open Credit
              </Link>
            </div>
          </div>
        )}

        {/* CREDIT INFO */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Credit Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Credit Score</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{wallet?.credit_score || 0}<span className="text-sm text-slate-600">/100</span></p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Credit Limit</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">R{wallet?.credit_limit || 0}</p>
            </div>
          </div>
        </div>

        {/* TRANSACTIONS */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-gray-500">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {t.type === "deposit" && (
                        <span className="text-green-600">Deposit</span>
                      )}
                      {t.type === "payment" && (
                        <span className="text-red-600">Payment</span>
                      )}
                      {t.type === "credit" && (
                        <span className="text-blue-600">Credit</span>
                      )}
                      {t.type === "withdrawal" && (
                        <span className="text-orange-600">Withdrawal</span>
                      )}
                      {t.type !== "deposit" &&
                        t.type !== "payment" &&
                        t.type !== "credit" &&
                        t.type !== "withdrawal" && <span>{t.type}</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t.description || "No description"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div
                    className={`font-bold ${
                      t.type === "deposit"
                        ? "text-green-600"
                        : t.type === "payment" || t.type === "monthly_fee" || t.type === "service fee" || t.type === "withdrawal"
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    {t.type === "payment" || t.type === "credit" || t.type === "monthly_fee" || t.type === "service fee" || t.type === "overdraft_fee" || t.type === "insufficient_funds" || t.type === "withdrawal"
                      ? `-R${t.amount.toFixed(2)}`
                      : `+R${t.amount.toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {transactions.length > 5 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                See All Transactions
              </button>
            </div>
          )}
        </div>

        {/* ANALYTICS */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Transaction Analytics</h2>
          {transactions.length > 0 ? (
            <Bar data={chartData} />
          ) : (
            <p>No data</p>
          )}
        </div>

        {/* SUPPORT CONTACT */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
          <h3 className="text-lg font-semibold text-blue-900">Need Help?</h3>
          <p className="mt-1 text-sm text-blue-800">Our support team is ready to assist with your wallet</p>
          <button
            onClick={() => setShowSupportModal(true)}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            📧 Contact Support
          </button>
        </div>
      </div>

      {/* TRANSACTION HISTORY MODAL */}
      {showAll && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg w-11/12 md:w-2/3 lg:w-1/2 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-900">Transaction History</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSV(transactions)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  📥 CSV
                </button>
                <button
                  onClick={() => downloadPDF(transactions)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  📄 PDF
                </button>
                <button
                  onClick={() => setShowAll(false)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {t.type === "deposit" && (
                        <span className="text-green-600">Deposit</span>
                      )}
                      {t.type === "payment" && (
                        <span className="text-red-600">Payment</span>
                      )}
                      {t.type === "credit" && (
                        <span className="text-blue-600">Credit</span>
                      )}
                      {t.type === "withdrawal" && (
                        <span className="text-orange-600">Withdrawal</span>
                      )}
                      {t.type !== "deposit" &&
                        t.type !== "payment" &&
                        t.type !== "credit" &&
                        t.type !== "withdrawal" && <span>{t.type}</span>}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t.description || "No description"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div
                  className={`font-bold ${
                    t.type === "deposit"
                      ? "text-green-600"
                      : t.type === "payment" || t.type === "overdraft_fee" || t.type === "insufficient_funds" || t.type === "monthly_fee" || t.type === "service fee" || t.type === "withdrawal"
                      ? "text-red-600"
                      : "text-blue-600"
                  }`}
                >
                  {t.type === "payment" || t.type === "credit" || t.type === "overdraft_fee" || t.type === "insufficient_funds" || t.type === "monthly_fee" || t.type === "service fee" || t.type === "withdrawal"
                    ? `-R${t.amount.toFixed(2)}`
                    : `+R${t.amount.toFixed(2)}`}
                </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg w-11/12 md:w-1/2 max-w-md p-6">
            <div className="mb-5 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">💸 Request Withdrawal</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Available Balance</p>
                <p className="mt-2 text-2xl font-bold text-blue-900">R{wallet?.balance.toFixed(2)}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Withdrawal Amount</label>
                <input
                  type="number"
                  value={withdrawAmount || ''}
                  onChange={(e) => handleWithdrawAmountChange(Number(e.target.value))}
                  placeholder="Enter amount (min R50)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  min="50"
                />
              </div>

              {withdrawAmount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-900">Withdrawal Amount:</span>
                    <span className="font-semibold text-amber-900">R{withdrawAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-900">Withdrawal Fee:</span>
                    <span className="font-semibold text-amber-700">R{withdrawalFee.toFixed(2)}</span>
                  </div>
                  <hr className="border-amber-200" />
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>Total Deduction:</span>
                    <span>R{(withdrawAmount + withdrawalFee).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-2">
                    Fee structure: R10 + 2.5% (minimum R15)
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdrawRequest}
                  disabled={loading || withdrawAmount < 50 || (withdrawAmount + withdrawalFee) > (wallet?.balance || 0)}
                  className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white transition hover:bg-orange-700 disabled:bg-slate-300"
                >
                  {loading ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT REQUEST MODAL */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-lg w-11/12 md:w-1/2 max-w-lg p-6">
            <div className="mb-5 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">📧 Contact Support</h3>
              <button
                onClick={() => setShowSupportModal(false)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900">How can we help?</p>
                <p className="mt-1 text-xs text-blue-800">
                  Your wallet details will be included automatically to expedite our response.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Describe your issue:</label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Explain your wallet issue or question in detail..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none h-32"
                  rows={4}
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">What happens next:</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li>✓ Email opens with pre-filled support details</li>
                  <li>✓ Send and we'll respond within 24 hours</li>
                  <li>✓ Call +27 60 646 4828 for urgent issues</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSupportRequest}
                  disabled={supportLoading || !supportMessage.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {supportLoading ? 'Preparing...' : '📧 Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}