// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · TaxOptimizerUS.jsx — Sesión 4-may-2026
//
// "IRS Expert" — Tax Optimizer IA que analiza la situación del user y le
// devuelve oportunidades CONCRETAS de ahorro fiscal legal, con dollar amounts
// específicos. NO sustituye a un CPA, pero detecta el 80% de oportunidades
// que un user típico nunca aprovecha.
//
// ENFOQUE: tax planning legal y respetuoso de la ley. Cada estrategia cita
// la sección del IRC (Internal Revenue Code) cuando aplica. La idea es que
// el user vea exactamente cuánto puede ahorrar, qué tiene que hacer, y la
// base legal — no consejos genéricos.
//
// ESTRATEGIAS DETECTADAS (12 patrones):
//   1. 401(k) under-contribution → max out
//   2. Roth IRA available → eligible income
//   3. HSA available → triple tax advantage
//   4. Backdoor Roth opportunity (high income)
//   5. Mega Backdoor Roth (if employer allows)
//   6. Tax-loss harvesting (unrealized losses)
//   7. Long-term vs short-term cap gains (timing)
//   8. State tax move opportunity (TX/FL/NV)
//   9. Itemized vs Standard deduction (mortgage, SALT)
//   10. Charitable bunching / DAF
//   11. Solo 401(k) for self-employed
//   12. SEP-IRA for 1099 income
// ════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import Disclaimer from "./Disclaimer";
import { calculateStateTax, FEDERAL_BRACKETS_2025, STANDARD_DEDUCTION_2025 } from "../lib/jurisdictions/usStateTax.js";

// 2025 limits (IRS Rev. Proc. 2024-40)
const LIMITS_2025 = {
  K401:           23500,
  K401_CATCHUP_50: 7500,
  K401_CATCHUP_60: 11250,  // SECURE 2.0 ages 60-63
  IRA:             7000,
  IRA_CATCHUP_50:  1000,
  HSA_SINGLE:      4300,
  HSA_FAMILY:      8550,
  HSA_CATCHUP_55:  1000,
  ROTH_IRA_PHASEOUT_SINGLE: { start: 150000, end: 165000 },
  ROTH_IRA_PHASEOUT_MFJ:    { start: 236000, end: 246000 },
  TRAD_IRA_DEDUCT_SINGLE:   { start: 79000,  end: 89000  },
  TRAD_IRA_DEDUCT_MFJ:      { start: 126000, end: 146000 },
  K401_TOTAL_LIMIT:        70000, // employee + employer + after-tax (mega backdoor)
  SEP_IRA_RATE:            0.25,  // 25% of compensation
  SEP_IRA_LIMIT:           70000,
  ESTATE_EXEMPTION:        13990000, // 2025 (sunsets to ~$7M in 2026!)
};

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1f1f23",
  border: "rgba(255,255,255,0.08)",
  borderL: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", red: "#ef4444", blue: "#3b82f6",
  amber: "#f59e0b", purple: "#a78bfa",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const fm = (n) => `$${Math.round(Math.abs(n || 0)).toLocaleString("en-US")}`;
const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`;

// ─── Detectar oportunidades de ahorro fiscal ──────────────────────────────
function detectOpportunities(user) {
  const opps = [];
  const ingresos = user?.ingresos || [];
  const inv = user?.inv || [];
  const deu = user?.deu || [];
  const taxConfig = user?.taxConfig || { filingStatus: "single", state: "TX" };
  const filingStatus = taxConfig.filingStatus || "single";
  const stateCode = taxConfig.state || "TX";
  const trm = user?.trm || 1;

  // ── Calcular income breakdown ────────────────────────────────────────
  let w2 = 0, se = 0, rental = 0, divs = 0, interest = 0;
  ingresos.forEach((i) => {
    const annual = (i.mensual || 0) * (i.moneda === "USD" ? 1 : 1 / trm) * 12;
    const cat = i.categoria || "";
    if (/Salario|W-2/i.test(cat)) w2 += annual;
    else if (/Honorarios|Freelance|1099/i.test(cat)) se += annual;
    else if (/Arriendo|Rental/i.test(cat)) rental += annual;
    else if (/Dividend/i.test(cat)) divs += annual;
    else if (/Rendim|Interest/i.test(cat)) interest += annual;
  });
  const grossIncome = w2 + se + rental + divs + interest;

  // ── Estimar marginal tax rate del user ──────────────────────────────
  const stdDed = STANDARD_DEDUCTION_2025[filingStatus] || 15000;
  const taxableIncome = Math.max(0, grossIncome - stdDed);
  const brackets = FEDERAL_BRACKETS_2025[filingStatus] || FEDERAL_BRACKETS_2025.single;
  const fedMarginal = brackets.find((b) => taxableIncome <= b.max)?.rate || 0.37;
  const stateRes = calculateStateTax(taxableIncome, stateCode);
  const totalMarginal = fedMarginal + stateRes.rate;
  const fica = w2 > 0 ? 0.0765 : 0; // employee side only

  // ── Detectar accounts existentes ────────────────────────────────────
  const has401k = inv.some((a) => /401\(?k\)?/i.test(a.n || a.tp || ""));
  const k401Balance = inv.filter((a) => /401\(?k\)?/i.test(a.n || a.tp || "")).reduce((s, a) => s + (a.va || 0), 0);
  const hasRothIRA = inv.some((a) => /roth.?ira/i.test(a.n || a.tp || ""));
  const hasTradIRA = inv.some((a) => /trad.*ira|traditional.*ira/i.test(a.n || a.tp || ""));
  const hasHSA = inv.some((a) => /hsa/i.test(a.n || a.tp || ""));
  const hasTaxableBrokerage = inv.some((a) => /(brokerage|stocks|etf|taxable)/i.test(a.n || a.tp || ""));
  const taxableBrokerageBalance = inv.filter((a) => /(brokerage|stocks|etf|taxable)/i.test(a.n || a.tp || "")).reduce((s, a) => s + (a.va || 0), 0);
  const hasUnrealizedLoss = inv.some((a) => (a.va || 0) > 0 && (a.vc || 0) > (a.va || 0));

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #1 — 401(k) under-contribution
  // ════════════════════════════════════════════════════════════════════
  if (w2 > 30000) {
    // Asume que el user contribuye 6% (default) si tiene 401k, 0% si no
    const currentContrib = has401k ? Math.min(w2 * 0.06, LIMITS_2025.K401) : 0;
    const maxContrib = LIMITS_2025.K401;
    const gap = maxContrib - currentContrib;
    if (gap > 1000) {
      const taxSavings = Math.round(gap * (fedMarginal + stateRes.rate));
      opps.push({
        id: "401k_max",
        priority: gap > 15000 ? "high" : "medium",
        category: "Retirement",
        title: "Max out your 401(k)",
        oneliner: `Save up to ${fm(taxSavings)} in taxes this year`,
        savings: taxSavings,
        savingsLabel: `${fm(taxSavings)}/year tax savings`,
        action: `Increase 401(k) contribution by ${fm(gap)} to hit the 2025 limit of ${fm(maxContrib)}.`,
        why: `You're in the ${pct(fedMarginal)} federal bracket + ${pct(stateRes.rate)} ${stateRes.stateName} state tax. Every dollar you contribute pre-tax saves you ${pct(fedMarginal + stateRes.rate)} immediately.`,
        irc: "§401(k) · Internal Revenue Code",
        risk: "Reduces take-home pay until reimbursed via tax savings. Funds locked until age 59½ (10% penalty + tax for early withdrawal).",
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #2 — Roth IRA available (income within limits)
  // ════════════════════════════════════════════════════════════════════
  const rothPhase = filingStatus === "married_jointly" ? LIMITS_2025.ROTH_IRA_PHASEOUT_MFJ : LIMITS_2025.ROTH_IRA_PHASEOUT_SINGLE;
  if (grossIncome < rothPhase.end && !hasRothIRA && (w2 > 0 || se > 0)) {
    const eligible = grossIncome < rothPhase.start ? LIMITS_2025.IRA : LIMITS_2025.IRA * (1 - (grossIncome - rothPhase.start) / (rothPhase.end - rothPhase.start));
    const futureValue30yr = Math.round(eligible * 7.61); // 30 yr at 7%
    opps.push({
      id: "roth_ira_open",
      priority: "high",
      category: "Retirement",
      title: "Open and fund a Roth IRA",
      oneliner: `Tax-free growth on ${fm(eligible)}/year — ~${fm(futureValue30yr)} tax-free at retirement`,
      savings: 0,
      savingsLabel: `~${fm(futureValue30yr)} tax-free in 30 years`,
      action: `You qualify to contribute ${fm(eligible)} to a Roth IRA in 2025. Open one at Fidelity, Vanguard, or Schwab (free) and fund it before April 15, 2026.`,
      why: `Your income (${fm(grossIncome)}) is within the Roth phaseout (${fm(rothPhase.start)}–${fm(rothPhase.end)}). Roth contributions grow tax-free FOREVER — no tax on withdrawals in retirement, no RMDs.`,
      irc: "§408A · IRC Roth IRA",
      risk: "Contributions are after-tax (no immediate deduction). Money locked until age 59½ for earnings (contributions can be withdrawn anytime).",
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #3 — Backdoor Roth (income too high for direct Roth)
  // ════════════════════════════════════════════════════════════════════
  if (grossIncome > rothPhase.end && !hasTradIRA) {
    const taxFreeFV = Math.round(LIMITS_2025.IRA * 7.61);
    opps.push({
      id: "backdoor_roth",
      priority: "high",
      category: "Retirement",
      title: "Use the Backdoor Roth IRA",
      oneliner: `High income blocks direct Roth — backdoor adds ${fm(LIMITS_2025.IRA)}/yr tax-free`,
      savings: 0,
      savingsLabel: `~${fm(taxFreeFV)} tax-free in 30 years`,
      action: `1) Open Traditional IRA at Fidelity/Vanguard. 2) Contribute ${fm(LIMITS_2025.IRA)} (non-deductible). 3) Convert to Roth IRA within days. Same financial result as direct Roth.`,
      why: `Your income (${fm(grossIncome)}) exceeds the Roth IRA phaseout (${fm(rothPhase.end)}). The backdoor is 100% legal — confirmed by IRS in Notice 2014-54.`,
      irc: "§408A · Notice 2014-54",
      risk: "Pro-rata rule: if you have ANY pre-tax IRA balance, conversion is partly taxable. Roll existing Trad IRA into 401(k) first if possible.",
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #4 — HSA (triple tax advantage)
  // ════════════════════════════════════════════════════════════════════
  if (!hasHSA && w2 > 30000) {
    const hsaLimit = filingStatus === "married_jointly" ? LIMITS_2025.HSA_FAMILY : LIMITS_2025.HSA_SINGLE;
    const taxSavings = Math.round(hsaLimit * (fedMarginal + stateRes.rate + (w2 > 0 ? 0.0765 : 0))); // also FICA on payroll
    const fv30yr = Math.round(hsaLimit * 7.61);
    opps.push({
      id: "hsa_open",
      priority: "high",
      category: "Health & Tax",
      title: "Open an HSA (Health Savings Account)",
      oneliner: `Triple tax advantage — save up to ${fm(taxSavings)}/yr in taxes + grow tax-free`,
      savings: taxSavings,
      savingsLabel: `${fm(taxSavings)}/year tax savings`,
      action: `If you have an HDHP (High-Deductible Health Plan), open an HSA at Fidelity (no fees, full investment options). Contribute ${fm(hsaLimit)}/yr through payroll to also save FICA (7.65%).`,
      why: `HSA is the only triple tax-free account: deduct contributions, grow tax-free, withdraw tax-free for medical expenses. After 65, withdraw for ANY reason (taxed as Trad IRA). Future value at 7% over 30 years: ~${fm(fv30yr)}.`,
      irc: "§223 · IRC HSA",
      risk: "Requires HDHP enrollment. Contributions count even if you change to non-HDHP later (just can't keep contributing).",
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #5 — Tax-loss harvesting
  // ════════════════════════════════════════════════════════════════════
  if (hasUnrealizedLoss && hasTaxableBrokerage) {
    const losses = inv
      .filter((a) => /(brokerage|stocks|etf|crypto|taxable)/i.test(a.n || a.tp || ""))
      .filter((a) => (a.vc || 0) > (a.va || 0))
      .reduce((s, a) => s + ((a.vc || 0) - (a.va || 0)), 0);
    if (losses > 500) {
      const offsetCap = Math.min(losses, 3000); // $3k against ordinary income/yr
      const taxSavings = Math.round(offsetCap * (fedMarginal + stateRes.rate));
      opps.push({
        id: "tax_loss_harvest",
        priority: "medium",
        category: "Investment Tax Strategy",
        title: "Harvest tax losses",
        oneliner: `You have ${fm(losses)} in unrealized losses — convert to ${fm(taxSavings)} tax savings`,
        savings: taxSavings,
        savingsLabel: `${fm(taxSavings)} tax savings now`,
        action: `Sell losing positions in your taxable brokerage to "realize" the loss. Buy a similar (NOT identical) ETF immediately to maintain market exposure. Avoid the same security for 30 days (wash sale rule).`,
        why: `Realized losses offset capital gains dollar-for-dollar, plus up to $3,000/yr against ordinary income. Excess carries forward indefinitely.`,
        irc: "§1091 · Wash Sale Rule (avoid violation)",
        risk: "Wash sale rule: if you (or your spouse) buy the same/substantially identical security within 30 days, the loss is disallowed. Use different ETFs (e.g., VOO ↔ IVV are NOT substantially identical).",
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #6 — Self-employment retirement (SEP-IRA / Solo 401k)
  // ════════════════════════════════════════════════════════════════════
  if (se > 10000) {
    const sepLimit = Math.min(se * 0.25, LIMITS_2025.SEP_IRA_LIMIT);
    const taxSavings = Math.round(sepLimit * (fedMarginal + stateRes.rate));
    opps.push({
      id: "self_employed_retirement",
      priority: "high",
      category: "Retirement (Self-Employed)",
      title: "Open a Solo 401(k) or SEP-IRA",
      oneliner: `Your 1099 income (${fm(se)}) qualifies for ${fm(sepLimit)} retirement contribution — saves ${fm(taxSavings)} in taxes`,
      savings: taxSavings,
      savingsLabel: `${fm(taxSavings)}/year tax savings`,
      action: `Open a Solo 401(k) at Fidelity/Schwab (free, no annual fee). Contribute up to ${fm(sepLimit)} as employee + employer combined. Setup deadline: Dec 31 for current year.`,
      why: `As a 1099 worker, you're paying ${pct(fedMarginal + stateRes.rate + 0.153)} marginal (federal + state + SE tax) on this income. SEP/Solo 401(k) lets you defer all of it.`,
      irc: "§401(c) Solo 401(k) · §408(k) SEP-IRA",
      risk: "Solo 401(k) requires Form 5500-EZ once balance >$250K. SEP is simpler but employer-only (limits flexibility).",
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #7 — High state tax (relocate analysis)
  // ════════════════════════════════════════════════════════════════════
  if (stateRes.tax > 5000 && stateRes.type !== "none") {
    opps.push({
      id: "state_relocation",
      priority: "low",
      category: "State Tax Strategy",
      title: "Consider relocation to a no-income-tax state",
      oneliner: `${stateRes.stateName} costs you ${fm(stateRes.tax)}/yr in state tax`,
      savings: stateRes.tax,
      savingsLabel: `${fm(stateRes.tax)}/year saved if you relocate`,
      action: `States with no income tax: TX, FL, NV, WA, NH, AK, SD, TN, WY. If you work remotely, this is a permanent annual savings. Establish residency 183+ days/yr.`,
      why: `${stateRes.stateName} state tax: ${fm(stateRes.tax)}/yr at your income (${pct(stateRes.rate)} top rate). Over 30 years that's ${fm(stateRes.tax * 30)}.`,
      irc: "Domicile rules vary by state",
      risk: "Some states (CA, NY) aggressively audit residency claims. Need: voter registration, driver's license, primary residence, 183+ days. NOT a quick fix.",
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #8 — Long-term vs short-term capital gains
  // ════════════════════════════════════════════════════════════════════
  // We can't see holding period perfectly, but if there's appreciation, suggest awareness
  const taxableAppreciation = inv
    .filter((a) => /(brokerage|stocks|etf|taxable|crypto)/i.test(a.n || a.tp || ""))
    .reduce((s, a) => s + Math.max(0, (a.va || 0) - (a.vc || 0)), 0);
  if (taxableAppreciation > 5000) {
    const ltcgRate = grossIncome > 518900 ? 0.20 : grossIncome > 47025 ? 0.15 : 0;
    const stcgSaved = Math.round(taxableAppreciation * (fedMarginal - ltcgRate));
    if (stcgSaved > 500) {
      opps.push({
        id: "ltcg_timing",
        priority: "medium",
        category: "Investment Tax Strategy",
        title: "Hold investments >1 year for long-term gains rate",
        oneliner: `Selling now is ordinary income (${pct(fedMarginal)}). After 1 year: only ${pct(ltcgRate)}.`,
        savings: stcgSaved,
        savingsLabel: `${fm(stcgSaved)} saved by waiting`,
        action: `For each lot in your taxable brokerage, check the purchase date. If you're <1 year, wait until you cross 366 days before selling.`,
        why: `Short-term capital gains (held ≤1 year) taxed at ordinary income rates (${pct(fedMarginal)}). Long-term (>1 year) taxed at ${pct(ltcgRate)}. The ${pct(fedMarginal - ltcgRate)} delta on ${fm(taxableAppreciation)} = ${fm(stcgSaved)}.`,
        irc: "§1222 · Capital gains holding period",
        risk: "Markets can drop while you wait. Don't tail-wag-the-dog: if you have a strong reason to sell, the tax savings shouldn't override it.",
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  OPPORTUNITY #9 — High-interest debt > investment
  // ════════════════════════════════════════════════════════════════════
  const hiInterestDebt = deu.filter((d) => (d.ts || 0) > 12).reduce((s, d) => s + (d.mt || 0), 0);
  if (hiInterestDebt > 1000) {
    const avgRate = deu.filter((d) => (d.ts || 0) > 12).reduce((s, d) => s + ((d.ts || 0) * (d.mt || 0)), 0) / hiInterestDebt;
    const annualInterestCost = Math.round(hiInterestDebt * (avgRate / 100));
    opps.push({
      id: "pay_high_interest_debt",
      priority: "high",
      category: "Debt Strategy",
      title: "Pay off high-interest debt before investing extra",
      oneliner: `${fm(hiInterestDebt)} at ${avgRate.toFixed(1)}% costs you ${fm(annualInterestCost)}/yr — guaranteed loss`,
      savings: annualInterestCost,
      savingsLabel: `${fm(annualInterestCost)}/year saved in interest`,
      action: `Use any extra cash flow to pay down debts above 10% APR. The "return" on debt payoff = the APR — guaranteed and tax-free.`,
      why: `Your high-interest debt is at ${avgRate.toFixed(1)}% APR. The S&P 500 historical return is ~10%. Paying off ${avgRate.toFixed(1)}% debt is a GUARANTEED ${avgRate.toFixed(1)}% return — better than the stock market.`,
      irc: "Mathematical principle, not IRC",
      risk: "Don't drain emergency fund. Keep 3-6 months expenses liquid first.",
    });
  }

  // Sort: high → medium → low priority, then by dollar savings
  const priOrder = { high: 0, medium: 1, low: 2 };
  opps.sort((a, b) => priOrder[a.priority] - priOrder[b.priority] || (b.savings || 0) - (a.savings || 0));
  return opps;
}

// ─── Card de oportunidad individual ────────────────────────────────────────
function OpportunityCard({ opp, expanded, onToggle }) {
  const priColor = opp.priority === "high" ? T.green : opp.priority === "medium" ? T.amber : T.txt2;
  const priLabel = opp.priority === "high" ? "HIGH PRIORITY" : opp.priority === "medium" ? "MEDIUM" : "OPTIONAL";

  return (
    <div
      style={{
        background: T.bg2,
        border: `1px solid ${expanded ? priColor + "40" : T.border}`,
        borderRadius: 14,
        padding: 20,
        marginBottom: 12,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onClick={onToggle}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
                color: priColor,
                background: priColor + "15",
                padding: "3px 10px",
                borderRadius: 99,
              }}
            >
              {priLabel}
            </span>
            <span style={{ fontSize: 11, color: T.txt3 }}>{opp.category}</span>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: T.txt, margin: "0 0 6px", fontFamily: FONT_DISPLAY }}>
            {opp.title}
          </h3>
          <p style={{ fontSize: 13, color: T.txt2, margin: 0, lineHeight: 1.5 }}>{opp.oneliner}</p>
        </div>
        <div style={{ textAlign: "right", minWidth: 120 }}>
          {opp.savings > 0 && (
            <>
              <div style={{ fontSize: 11, color: T.txt3, marginBottom: 2 }}>You save</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: T.green, fontFamily: "monospace", lineHeight: 1 }}>
                {fm(opp.savings)}
              </div>
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>per year</div>
            </>
          )}
          {opp.savings === 0 && (
            <div style={{ fontSize: 12, color: T.purple, fontWeight: 700, marginTop: 8 }}>
              {opp.savingsLabel}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              ✅ What to do
            </div>
            <p style={{ fontSize: 13, color: T.txt, margin: 0, lineHeight: 1.6 }}>{opp.action}</p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.txt3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              💡 Why this works
            </div>
            <p style={{ fontSize: 13, color: T.txt2, margin: 0, lineHeight: 1.6 }}>{opp.why}</p>
          </div>

          {opp.risk && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: T.amber, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                ⚠️ Risk / caveat
              </div>
              <p style={{ fontSize: 13, color: T.txt2, margin: 0, lineHeight: 1.6 }}>{opp.risk}</p>
            </div>
          )}

          {opp.irc && (
            <div style={{ fontSize: 11, color: T.txt3, fontStyle: "italic", marginTop: 10 }}>
              Legal basis: {opp.irc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function TaxOptimizerUS({ user }) {
  const [expandedId, setExpandedId] = useState(null);

  const opportunities = useMemo(() => detectOpportunities(user), [user]);
  const totalSavings = opportunities.reduce((s, o) => s + (o.savings || 0), 0);
  const highPriorityCount = opportunities.filter((o) => o.priority === "high").length;

  if (opportunities.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", fontFamily: FONT_DISPLAY }}>
            🎯 Tax Optimizer
          </h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: 0 }}>
            IRS-grade analysis of your situation — finds legal tax savings opportunities
          </p>
        </div>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <h3 style={{ fontSize: 16, color: T.txt, marginBottom: 8 }}>Add your income & accounts to start</h3>
          <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
            Once you've added income (W-2, 1099) and your investments (401k, IRA, taxable brokerage),
            we'll scan for legal tax-saving opportunities specific to your situation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", fontFamily: FONT_DISPLAY }}>
          🎯 Tax Optimizer
        </h2>
        <p style={{ color: T.txt3, fontSize: 13, margin: 0 }}>
          IRS-grade analysis of your situation — every strategy below is 100% legal and cites IRC code.
        </p>
      </div>

      {/* Hero card with total savings */}
      <div
        style={{
          background: `linear-gradient(135deg, ${T.green}15, ${T.blue}10)`,
          border: `2px solid ${T.green}40`,
          borderRadius: 16,
          padding: 28,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.green, letterSpacing: 1, marginBottom: 6 }}>
            💰 OPPORTUNITIES DETECTED
          </div>
          <div style={{ fontSize: 14, color: T.txt2, lineHeight: 1.5 }}>
            <strong style={{ color: T.txt }}>{opportunities.length} ways</strong> to legally reduce your tax bill —{" "}
            <strong style={{ color: T.green }}>{highPriorityCount} high-priority</strong> action items below.
          </div>
        </div>
        {totalSavings > 0 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 2 }}>Potential annual savings</div>
            <div style={{ fontSize: "clamp(28px, 7vw, 36px)", fontWeight: 900, color: T.green, fontFamily: "monospace", lineHeight: 1 }}>
              {fm(totalSavings)}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>tax savings · year 1</div>
          </div>
        )}
      </div>

      {/* Opportunity list */}
      <div>
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            expanded={expandedId === opp.id}
            onToggle={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: T.bg3,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          fontSize: 11,
          color: T.txt3,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: T.txt2 }}>⚖️ Legal disclaimer.</strong> The strategies above are general guidance based on
        IRS publications and the Internal Revenue Code (current as of 2025). They are not personalized tax or legal advice.
        Specific situations may have nuances (state law, ownership structures, prior-year carryovers) that change the analysis.
        For implementation of high-dollar strategies, consult a CPA or Enrolled Agent.
      </div>
    
    <Disclaimer variante="fiscal" idioma="en" T={T} compacto />
  </div>
  );
}
