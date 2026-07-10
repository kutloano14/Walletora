import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import {updateCreditScore} from "../../lib/creditScore";

interface Credit {
  id: string;
  wallet_id: string;
  amount: number;
  interest_rate: number;
  repayment_period: number;
  due_date: string;
  status: "pending" | "approved" | "active" | "paid" | "defaulted" | "rejected";
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

interface Wallet {
  id: string;
  balance: number;
  credit_score: number;
  credit_limit: number;
}

export default function CreditPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [period, setPeriod] = useState<number>(3);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const interestRates: Record<number, number> = {
    1: 0.06,
    3: 0.15,
    6: 0.30,
    12: 0.48,
  };

  const latePenalty = 0.05; // 5% per late month

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: walletData } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (walletData) setWallet(walletData);

    if (walletData?.id) fetchCredits(walletData.id);
  };

  const fetchCredits = async (walletId: string) => {
    const { data } = await supabase
      .from("credits")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false });
    if (data) setCredits(data);
  };

  /** --------------------
   * UPDATE CREDIT SCORE & LIMIT
   * -------------------- */


  /** --------------------
   * TAKE CREDIT
   * -------------------- */
const handleTakeCredit = async () => {
  if (!wallet || amount <= 0) return alert("Enter valid amount");
  if (amount > wallet.credit_limit) return alert("Exceeds credit limit");

  const rate = interestRates[period];
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + period);

  setLoading(true);
  try {
    // 1️⃣ Create credit application (pending admin approval)
    const { data: newCredit, error } = await supabase
      .from("credits")
      .insert([{
        wallet_id: wallet.id,
        amount,
        interest_rate: rate,
        repayment_period: period,
        due_date: dueDate.toISOString(),
        status: "pending", // Waiting for admin approval
      }])
      .select()
      .single();
    if (error || !newCredit) throw error || new Error("Credit application failed");

    // 2️⃣ Log credit application (not disbursement yet)
    const { error: transactionError } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "deposit", // Will show as application in transaction history
      amount: 0, // Zero amount since no money added yet
      description: `Credit application submitted - R${amount} (${period} months @ ${(rate * 100).toFixed(1)}% annual) - Awaiting approval`,
    });

    if (transactionError) {
      console.error('Transaction insert error:', transactionError);
      // Continue with the process even if transaction fails
    }

    // 3️⃣ Refresh UI to show pending credit
    fetchCredits(wallet.id);
    setAmount(0);
    alert(`Credit application submitted successfully!\n\nAmount: R${amount}\nPeriod: ${period} months\nInterest: ${(rate * 100).toFixed(1)}% annual\n\nYour application is now pending admin approval. You will receive the funds once approved.`);
  } catch (err) {
    console.error(err);
    alert("Failed to submit credit application");
  }
  setLoading(false);
};

const handleRepay = async (credit: Credit) => {
  if (!wallet) return;

  const due = new Date(credit.due_date);
  const now = new Date();

  let repayAmount = credit.amount + credit.amount * credit.interest_rate;

  // Apply penalty if overdue
  if (now > due) {
    const monthsLate =
      (now.getFullYear() - due.getFullYear()) * 12 +
      (now.getMonth() - due.getMonth());
    const penalty = credit.amount * latePenalty * monthsLate;
    repayAmount += penalty;
  }

  if (wallet.balance < repayAmount)
    return alert("Insufficient balance to repay");

  setLoading(true);
  try {
    const newStatus = now > due ? "defaulted" : "paid";

    // 1️⃣ Update credit record
    await supabase
      .from("credits")
      .update({ status: newStatus })
      .eq("id", credit.id);

    // 2️⃣ Deduct wallet balance
    await supabase
      .from("wallets")
      .update({ balance: wallet.balance - repayAmount })
      .eq("id", wallet.id);

    // 3️⃣ Log repayment transaction
    const { error: repaymentTransactionError } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "withdrawal", // Using "withdrawal" for repayment since money is leaving wallet
      amount: repayAmount,
      description: `Credit repayment of R${repayAmount} (${newStatus})`,
    });

    if (repaymentTransactionError) {
      console.error('Repayment transaction insert error:', repaymentTransactionError);
      // Continue with the process even if transaction fails
    }

    // 4️⃣ Update credit score and refresh wallet state
    const updatedWallet = await updateCreditScore(wallet.id);
    if (updatedWallet) {
  setWallet({
    ...wallet,
    credit_score: updatedWallet.credit_score,
    credit_limit: updatedWallet.credit_limit,
  });
}

    // 5️⃣ Refresh UI and wallet data
    await fetchWallet(); // This will refresh both wallet and credits
    alert("Credit repaid successfully!");
  } catch (err) {
    console.error("Repay error:", err);
    alert("Failed to repay credit");
  }
  setLoading(false);
};

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-md rounded-lg p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:underline">
        ← Back
      </button>

      <h2 className="text-2xl font-bold mb-4">Credit Facility</h2>

      <div className="bg-yellow-50 p-4 rounded mb-6 text-sm text-gray-700 space-y-2">
        <p>💡 How credit works:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Borrow instantly, no paperwork.</li>
          <li>Interest depends on repayment period (6%-48%).</li>
          <li>Late repayments incur penalties (5% per month).</li>
          <li>On-time repayment improves your credit score.</li>
          <li>Missed payments reduce score & credit limit.</li>
        </ul>
      </div>

      {/* Credit Status Display */}
      <div className="bg-blue-50 p-4 rounded mb-6 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">Credit Score:</span>
          <span className={`font-bold ${(wallet?.credit_score || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
            {wallet?.credit_score || 0}/100
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Available Credit:</span>
          <span className="font-bold text-green-600">R{wallet?.credit_limit || 0}</span>
        </div>
        <div className="text-xs text-gray-600">
          💡 Available credit reduces when you borrow and increases when you repay
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount to Borrow</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded"
            placeholder="Enter amount"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Repayment Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded"
          >
            <option value={1}>1 Month - 6%</option>
            <option value={3}>3 Months - 15%</option>
            <option value={6}>6 Months - 30%</option>
            <option value={12}>12 Months - 48%</option>
          </select>
        </div>

        <button
          onClick={handleTakeCredit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
        >
          {loading ? "Submitting..." : "Apply for Credit"}
        </button>

        <div className="mt-2 text-xs text-gray-600 text-center">
          💡 Your credit application will be reviewed by our admin team. Funds will be added to your wallet once approved.
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Your Credits</h3>
      {credits.length === 0 ? (
        <p className="text-gray-500">No active credits yet</p>
      ) : (
        <table className="w-full border mt-2">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Amount</th>
              <th className="p-2 border">Interest</th>
              <th className="p-2 border">Due Date</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.id} className="text-center">
                <td className="p-2 border">R{c.amount}</td>
                <td className="p-2 border">{(c.interest_rate * 100).toFixed(1)}%</td>
                <td className="p-2 border">{new Date(c.due_date).toLocaleDateString()}</td>
                <td className="p-2 border">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    c.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    c.status === 'active' ? 'bg-green-100 text-green-800' :
                    c.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                    c.status === 'paid' ? 'bg-gray-100 text-gray-800' :
                    c.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-orange-100 text-orange-800' // defaulted
                  }`}>
                    {c.status === 'pending' ? 'Pending Approval' : 
                     c.status === 'active' ? 'Active' :
                     c.status === 'approved' ? 'Approved' :
                     c.status === 'paid' ? 'Paid' :
                     c.status === 'rejected' ? 'Rejected' : 'Defaulted'}
                  </span>
                </td>
                <td className="p-2 border">
                  {c.status === "active" && (
                    <button
                      onClick={() => handleRepay(c)}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Repay
                    </button>
                  )}
                  {c.status === "pending" && (
                    <span className="text-sm text-yellow-600">Awaiting admin approval</span>
                  )}
                  {c.status === "approved" && (
                    <span className="text-sm text-green-600">Approved - Funds available</span>
                  )}
                  {c.status === "rejected" && (
                    <span className="text-sm text-red-600">Application denied</span>
                  )}
                  {c.status === "paid" && (
                    <span className="text-sm text-gray-600">Completed</span>
                  )}
                  {c.status === "defaulted" && (
                    <span className="text-sm text-orange-600">Payment overdue</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}