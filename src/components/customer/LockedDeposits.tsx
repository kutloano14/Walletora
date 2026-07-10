import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import {updateCreditScore} from "../../lib/creditScore";

interface LockedDeposit {
  id: string;
  wallet_id: string;
  amount: number;
  interest_rate: number;
  lock_period: number; // months
  start_date: string;
  maturity_date: string;
  status: "active" | "matured" | "unlocked";
  created_at: string;
}

interface Wallet {
  id: string;
  balance: number;
  locked_balance: number;
}

export default function LockedDepositsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [principal, setPrincipal] = useState<number>(0);
  const [period, setPeriod] = useState<number>(3);
  const [deposits, setDeposits] = useState<LockedDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const interestRates: Record<number, number> = {
    1: 0.03,
    3: 0.05,
    6: 0.07,
    12: 0.1,
  };

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

    if (walletData?.id) fetchDeposits(walletData.id);
  };

  const fetchDeposits = async (walletId: string) => {
    const { data } = await supabase
      .from("locked_deposits")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false });
    if (data) setDeposits(data);
  };

  const handleLockDeposit = async () => {
    if (!wallet || principal <= 0) return alert("Enter valid amount");
    if (principal > wallet.balance) return alert("Insufficient balance");

    const rate = interestRates[period];
    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + period);

    setLoading(true);
    try {
      // 1. Insert new locked deposit
      const { data: newDeposit, error: insertError } = await supabase
        .from("locked_deposits")
        .insert({
          wallet_id: wallet.id,
          amount: principal,
          interest_rate: rate,
          lock_period: period,
          start_date: startDate.toISOString(),
          maturity_date: maturityDate.toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (insertError || !newDeposit) throw insertError || new Error("Deposit not created");

      // 2. Update wallet balances
      await supabase
        .from("wallets")
        .update({
          balance: wallet.balance - principal,
          locked_balance: wallet.locked_balance + principal,
        })
        .eq("id", wallet.id);

      // 3. Record transaction
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "lock",
        amount: principal,
        description: `Locked deposit for ${period} months`,
      });

      await updateCreditScore(wallet.id); // Update credit score after locking deposit

      setPrincipal(0);
      fetchWallet(); // refresh wallet & deposits
      alert("Deposit locked successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to lock deposit");
    }
    setLoading(false);
  };

  const handleUnlock = async (deposit: LockedDeposit) => {
    if (!wallet) return;

    const now = new Date();
    const maturity = new Date(deposit.maturity_date);
    let payout = deposit.amount;
    let description = "";

    if (now >= maturity) {
      const interest = deposit.amount * deposit.interest_rate * (deposit.lock_period / 12);
      payout = deposit.amount + interest;
      description = `Matured payout: Principal + Interest`;
    } else {
      const penalty = deposit.amount * 0.02;
      payout = deposit.amount - penalty;
      description = `Early unlock: Principal - 2% penalty`;
    }

    setLoading(true);
    try {
      await supabase
        .from("locked_deposits")
        .update({ status: "unlocked" })
        .eq("id", deposit.id);

      await supabase
        .from("wallets")
        .update({
          balance: wallet.balance + payout,
          locked_balance: wallet.locked_balance - deposit.amount,
        })
        .eq("id", wallet.id);

      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        type: "unlock",
        amount: payout,
        description,
      });

      await updateCreditScore(wallet.id); // Update credit score after unlocking deposit

      fetchWallet();
      alert("Deposit unlocked successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to unlock deposit");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white shadow-md rounded-lg p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold mb-4">Locked Deposits</h2>

      <div className="bg-blue-50 p-4 rounded mb-6 text-sm text-gray-700 space-y-2">
        <p>💡 How locked deposits work:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Lock funds for a chosen period (1-12 months).</li>
          <li>Interest accrues over time (3%-10%).</li>
          <li>Early unlock incurs a 2% penalty.</li>
          <li>Locking deposits keeps money safe and can earn rewards.</li>
        </ul>
      </div>

      {/* FORM */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Amount to Lock
          </label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded"
            placeholder="Enter amount"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Lock Period (months)
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded"
          >
            <option value={1}>1 Month - 3%</option>
            <option value={3}>3 Months - 5%</option>
            <option value={6}>6 Months - 7%</option>
            <option value={12}>12 Months - 10%</option>
          </select>
        </div>

        <button
          onClick={handleLockDeposit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
        >
          {loading ? "Processing..." : "Lock Deposit"}
        </button>
      </div>

      {/* DEPOSITS TABLE */}
      <h3 className="text-lg font-semibold mb-2">Your Locked Deposits</h3>
      {deposits.length === 0 ? (
        <p className="text-gray-500">No locked deposits yet</p>
      ) : (
        <table className="w-full border mt-2">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Amount</th>
              <th className="p-2 border">Period</th>
              <th className="p-2 border">Interest</th>
              <th className="p-2 border">Maturity</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="text-center">
                <td className="p-2 border">R{d.amount}</td>
                <td className="p-2 border">{d.lock_period}m</td>
                <td className="p-2 border">{(d.interest_rate * 100).toFixed(1)}%</td>
                <td className="p-2 border">{new Date(d.maturity_date).toLocaleDateString()}</td>
                <td className="p-2 border capitalize">{d.status}</td>
                <td className="p-2 border">
                  {d.status === "active" && (
                    <button
                      onClick={() => handleUnlock(d)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Unlock
                    </button>
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