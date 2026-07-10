import { supabase } from "./supabase";

export async function updateCreditScore(walletId: string) {
  try {
    const { data: credits } = await supabase
      .from("credits")
      .select("*")
      .eq("wallet_id", walletId);

    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", walletId);

    if (!credits || !transactions) return null;

    let score = 0; // Base score

    // ------------------
    // POSITIVE BEHAVIORS
    // ------------------
    const onTime = credits.filter(c => c.status === "paid").length;
    score += onTime * 10;

    const deposits = transactions.filter(t => t.type === "deposit").length;
    score += Math.min(deposits * 2, 10);

    const locks = transactions.filter(t => t.type === "lock").length;
    score += Math.min(locks * 3, 10);

    const activeCredits = credits.filter(c => c.status === "active").length;
    if (activeCredits > 0) score += 5;

    // ------------------
    // NEGATIVE BEHAVIORS
    // ------------------
    const defaulted = credits.filter(c => c.status === "defaulted").length;
    score -= defaulted * 15;

    // Late active credits past due date
    const now = new Date();
    const lateActive = credits.filter(c => {
      return c.status === "active" && new Date(c.due_date) < now;
    }).length;
    score -= lateActive * 5;

    // Early unlocks of locked deposits
    const earlyUnlocks = transactions.filter(t => t.type === "unlock" && t.description?.includes("Early")).length;
    score -= earlyUnlocks * 5;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // ------------------
    // Credit limit calculation
    // ------------------
    
    // Maximum credit limit based on score
    const maxCreditLimit =
      score >= 90 ? 1000 :
      score >= 75 ? 700 :
      score >= 50 ? 500 :
      score >= 30 ? 300 : 0;

    // Calculate currently borrowed amount (active credits only)
    const currentlyBorrowed = credits
      .filter(c => c.status === "active")
      .reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);

    // Available credit limit = max limit - currently borrowed
    const availableCreditLimit = Math.max(0, maxCreditLimit - currentlyBorrowed);

    // Update wallet with available credit limit (not max limit)
    const { error } = await supabase
      .from("wallets")
      .update({ 
        credit_score: score, 
        credit_limit: availableCreditLimit 
      })
      .eq("id", walletId);

    if (error) throw error;

    return { 
      credit_score: score, 
      credit_limit: availableCreditLimit,
      max_credit_limit: maxCreditLimit,
      currently_borrowed: currentlyBorrowed
    };
  } catch (err) {
    console.error("Credit score update failed:", err);
    return null;
  }
}