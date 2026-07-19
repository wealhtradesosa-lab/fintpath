/**
 * RetirementModuleUS.jsx
 * CPA + CFP Grade — Retirement Planning
 *
 * Covers:
 *   Account Contribution Optimization    IRC §§ 401(k), 408, 408A, 223
 *   Roth Conversion Analysis             IRC § 408A; SECURE 2.0
 *   Required Minimum Distributions       IRC § 401(a)(9); IRS Pub. 590-B
 *   Social Security Optimization         SSA § 202; IRC § 86
 *   Retirement Income Projections        4% Rule (Bengen 1994), SWR
 *   Early Retirement (FIRE)              Rule 72(t) SEPP; Roth Ladder
 *
 * Tax Year 2025 | SECURE 2.0 Act of 2022
 */

import { useState, useMemo } from "react";
import NumberInput from "./NumberInput";

// ─── 2025 Constants ──────────────────────────────────────────────────────────
const C = {
  // 401(k) / 403(b) / 457
  K401_LIMIT:           23500,
  K401_CATCHUP_50:      31000,   // age 50-59, 64+
  K401_CATCHUP_60_63:   34750,   // SECURE 2.0: age 60-63 super catch-up
  // IRA
  IRA_LIMIT:            7000,
  IRA_CATCHUP:          8000,    // age 50+
  // Roth IRA income phase-outs (single 2025)
  ROTH_PHASEOUT_START:  150000,
  ROTH_PHASEOUT_END:    165000,
  // Traditional IRA deductibility phase-outs (single, covered by workplace plan)
  TRAD_IRA_PO_START:    77000,
  TRAD_IRA_PO_END:      87000,
  // SEP-IRA
  SEP_LIMIT:            69000,
  SEP_RATE:             0.25,
  // SIMPLE IRA
  SIMPLE_LIMIT:         16500,
  SIMPLE_CATCHUP:       20000,
  // HSA
  HSA_INDIVIDUAL:       4150,
  HSA_FAMILY:           8300,
  // RMD
  RMD_START_AGE:        73,      // SECURE 2.0
  // Social Security
  SS_MAX_BENEFIT_70:    4873,    // 2025 max monthly benefit at age 70
  SS_FRA:               67,      // Full Retirement Age for born after 1960
  SS_EARLY_REDUCTION:   0.00556, // ~5/9% per month for first 36 months early
  SS_DELAYED_CREDIT:    0.08,    // 8% per year after FRA
  // Standard inflation / return assumptions
  INFLATION:            0.03,
  EQUITY_RETURN:        0.07,    // real return after inflation
  BOND_RETURN:          0.02,
  // SWR
  SAFE_WITHDRAWAL_RATE: 0.04,    // Bengen 1994; 3.5% for 40+ year horizons
  CONSERVATIVE_SWR:     0.035,
};

// ─── IRS Uniform Lifetime Table (simplified) for RMD ────────────────────────
const RMD_TABLE = {
  72:27.4, 73:26.5, 74:25.5, 75:24.6, 76:23.7, 77:22.9, 78:22.0,
  79:21.1, 80:20.2, 81:19.4, 82:18.5, 83:17.7, 84:16.8, 85:16.0,
  86:15.2, 87:14.4, 88:13.7, 89:12.9, 90:12.2, 91:11.5, 92:10.8,
  93:10.1, 94:9.5,  95:8.9,  96:8.4,  97:7.8,  98:7.3,  99:6.8,
  100:6.4,
};

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:"#09090b", bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)", borderL:"rgba(255,255,255,0.1)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444", rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6", pr:"#a78bfa", or:"#f59e0b", cy:"#06b6d4",
};
const fm  = (n) => `$${Math.round(n||0).toLocaleString("en-US")}`;
const fmK = (n) => n>=1000000 ? `$${(n/1000000).toFixed(2)}M` : n>=1000 ? `$${(n/1000).toFixed(0)}K` : fm(n);
const pct = (n) => `${((n||0)*100).toFixed(1)}%`;
const age = (n) => `Age ${n}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Label = ({c,children}) => (
  <div style={{fontSize:10,fontWeight:700,color:c||T.tx3,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>
);
const Field = ({l, value, onChange, type="number", placeholder, hint, options}) => (
  <div style={{marginBottom:14}}>
    <Label>{l}</Label>
    {options
      ? <select value={value||""} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}>
          {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      : type === "number"
        ? <NumberInput value={value??""} onChange={v=>onChange(v===""?"":String(v))} placeholder={placeholder||"0"}
            style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
        : <input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"0"}
            style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
    }
    {hint && <div style={{fontSize:10,color:T.tx3,marginTop:3,lineHeight:1.5}}>{hint}</div>}
  </div>
);
const InfoBox = ({color=T.bl, children}) => (
  <div style={{background:`${color}10`,border:`1px solid ${color}25`,borderRadius:8,
               padding:"10px 14px",fontSize:11,color:T.tx2,lineHeight:1.8,marginTop:8}}>
    {children}
  </div>
);
const KPI = ({l, v, sub, c}) => (
  <div style={{background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
    <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
    <div style={{fontSize:20,fontWeight:800,color:c||T.tx,marginTop:4,fontFamily:"monospace"}}>{v}</div>
    {sub && <div style={{fontSize:10,color:T.tx3,marginTop:2}}>{sub}</div>}
  </div>
);
const SectionCard = ({children, style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24,marginBottom:16,...style}}>
    {children}
  </div>
);

// ─── FV Calculator ───────────────────────────────────────────────────────────
function futureValue(pv, annualContrib, rate, years) {
  const fvPV     = pv * Math.pow(1 + rate, years);
  const fvAnnuity = annualContrib * ((Math.pow(1+rate, years) - 1) / rate);
  return fvPV + fvAnnuity;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RetirementModuleUS({ user = {} }) {
  const [tab, setTab] = useState("overview");

  // ── Profile inputs ──────────────────────────────────────────────────────
  const [p, setP] = useState({
    currentAge:       35,
    retirementAge:    65,
    annualIncome:     150000,
    filingStatus:     "single",
    // Current balances
    bal401k:          120000,
    balRothIRA:       45000,
    balTradIRA:       30000,
    balHSA:           12000,
    // Monthly contributions
    contrib401k:      1500,    // monthly pre-tax
    contribRoth:      583,     // monthly ($7,000/yr)
    contribHSA:       346,     // monthly ($4,150/yr)
    // Social Security
    ssEstimatedBenefit: 2800,  // monthly at FRA
    ssClaimAge:         67,    // FRA
    // Desired retirement income
    desiredIncome:    8000,    // monthly in today's dollars
    // Roth conversion
    rothConvertAmount: 50000,  // annual conversion
    rothConvertYears:  5,
    // Investment allocation (% equity)
    equityPct:        0.80,
  });
  const sp = (k,v) => setP(prev=>({...prev,[k]:parseFloat(v)||0}));
  const spS = (k,v) => setP(prev=>({...prev,[k]:v}));

  const yearsToRetire = Math.max(0, p.retirementAge - p.currentAge);
  const yearsInRetire = Math.max(0, 95 - p.retirementAge);

  // ── Contribution optimization ────────────────────────────────────────────
  const contribOpt = useMemo(() => {
    const age50 = p.currentAge >= 50;
    const age6063 = p.currentAge >= 60 && p.currentAge <= 63;
    const k401Max = age6063 ? C.K401_CATCHUP_60_63 : age50 ? C.K401_CATCHUP_50 : C.K401_LIMIT;
    const iraMax  = age50 ? C.IRA_CATCHUP : C.IRA_LIMIT;
    const hsaMax  = C.HSA_INDIVIDUAL;

    // Roth IRA eligibility
    const rothEligible = p.annualIncome <= C.ROTH_PHASEOUT_END;
    const rothLimit = p.annualIncome <= C.ROTH_PHASEOUT_START ? iraMax
      : p.annualIncome >= C.ROTH_PHASEOUT_END ? 0
      : Math.round(iraMax * (1 - (p.annualIncome - C.ROTH_PHASEOUT_START) / (C.ROTH_PHASEOUT_END - C.ROTH_PHASEOUT_START)));

    const current401k = (p.contrib401k||0) * 12;
    const currentRoth = (p.contribRoth||0) * 12;
    const currentHSA  = (p.contribHSA||0) * 12;

    const gap401k = Math.max(0, k401Max - current401k);
    const gapRoth = Math.max(0, rothLimit - currentRoth);
    const gapHSA  = Math.max(0, hsaMax - currentHSA);
    const totalGap = gap401k + gapRoth + gapHSA;

    const taxSavingsMarginal = p.annualIncome > 197300 ? 0.32
      : p.annualIncome > 103350 ? 0.22 : p.annualIncome > 48475 ? 0.22 : 0.12;
    const annualTaxSavings = (gap401k + gapHSA) * taxSavingsMarginal;

    return { k401Max, iraMax, hsaMax, rothEligible, rothLimit,
             current401k, currentRoth, currentHSA,
             gap401k, gapRoth, gapHSA, totalGap, annualTaxSavings };
  }, [p]);

  // ── Portfolio projection ─────────────────────────────────────────────────
  const projection = useMemo(() => {
    const blendedReturn = p.equityPct * C.EQUITY_RETURN + (1-p.equityPct) * C.BOND_RETURN;
    const annualContrib = (p.contrib401k + p.contribRoth + p.contribHSA) * 12;
    const currentTotal  = (p.bal401k||0) + (p.balRothIRA||0) + (p.balTradIRA||0) + (p.balHSA||0);

    // Year-by-year projection
    const years = [];
    let bal = currentTotal;
    for (let y = 0; y <= Math.min(yearsToRetire + 30, 50); y++) {
      const age_ = p.currentAge + y;
      const inRetirement = age_ >= p.retirementAge;
      const withdrawal = inRetirement ? (p.desiredIncome * 12 * Math.pow(1+C.INFLATION, y)) : 0;
      bal = bal * (1 + blendedReturn) + (inRetirement ? 0 : annualContrib) - withdrawal;
      if (y % 5 === 0 || age_ === p.retirementAge)
        years.push({ age: age_, bal: Math.max(0, bal), inRetirement });
      if (bal <= 0) { years.push({age: age_, bal:0, depleted:true}); break; }
    }

    const retirementBal = futureValue(currentTotal, annualContrib, blendedReturn, yearsToRetire);
    const fireNumber    = (p.desiredIncome * 12) / C.SAFE_WITHDRAWAL_RATE;
    const fireProgress  = fireNumber > 0 ? Math.min(currentTotal / fireNumber, 1) : 0;
    const depletionAge  = years.find(y=>y.depleted)?.age || 95;
    const surplusAtDeath = retirementBal > 0
      ? futureValue(retirementBal, -(p.desiredIncome*12), blendedReturn/2, yearsInRetire)
      : 0;

    return { retirementBal, fireNumber, fireProgress, years, depletionAge, surplusAtDeath, blendedReturn };
  }, [p, yearsToRetire, yearsInRetire]);

  // ── Roth Conversion Analysis ─────────────────────────────────────────────
  const rothAnalysis = useMemo(() => {
    const annualConvert = p.rothConvertAmount || 0;
    if (!annualConvert) return null;

    // Tax cost of conversion (taxed as ordinary income)
    const BRACKETS = [
      {max:11925,rate:0.10},{max:48475,rate:0.12},{max:103350,rate:0.22},
      {max:197300,rate:0.24},{max:250525,rate:0.32},{max:626350,rate:0.35},{max:Infinity,rate:0.37}
    ];
    function calcTax(income) {
      let tax=0,prev=0;
      for(const b of BRACKETS){if(income<=prev)break;tax+=(Math.min(income,b.max)-prev)*b.rate;prev=b.max;}
      return Math.round(tax);
    }
    const baseIncomeTax = calcTax(p.annualIncome);
    const convertedTax  = calcTax(p.annualIncome + annualConvert);
    const yearlyTaxCost = convertedTax - baseIncomeTax;
    const marginalRate  = yearlyTaxCost / annualConvert;

    // Growth comparison: Tax-deferred vs Roth over retirement horizon
    // Roth wins if future tax rate > current conversion rate
    const rothFV   = annualConvert * Math.pow(1 + C.EQUITY_RETURN, yearsToRetire + yearsInRetire);
    const tradFVbeforeTax = annualConvert * Math.pow(1 + C.EQUITY_RETURN, yearsToRetire + yearsInRetire);
    const estFutureRate = marginalRate > 0.22 ? marginalRate : 0.22; // assume rates stay or go up
    const tradFVafterTax = tradFVbeforeTax * (1 - estFutureRate);
    const rothAdvantage  = rothFV - tradFVafterTax;

    // Break-even in years (simple estimate)
    const breakEven = yearlyTaxCost > 0
      ? Math.round(yearlyTaxCost / (rothFV / (yearsToRetire + yearsInRetire) * (estFutureRate - marginalRate)))
      : null;

    return {
      yearlyTaxCost, marginalRate, rothFV, tradFVafterTax, rothAdvantage,
      breakEven, totalConversion: annualConvert * p.rothConvertYears,
      isAdvantageousNow: marginalRate < 0.22,
    };
  }, [p, yearsToRetire, yearsInRetire]);

  // ── RMD Calculator ───────────────────────────────────────────────────────
  const rmdCalc = useMemo(() => {
    if (p.currentAge >= C.RMD_START_AGE) {
      const factor = RMD_TABLE[Math.min(p.currentAge, 100)] || 6.4;
      const totalPreTax = (p.bal401k||0) + (p.balTradIRA||0);
      const rmd = Math.round(totalPreTax / factor);
      return { rmd, factor, totalPreTax, active: true };
    }
    // Project RMD at age 73
    const yearsToRMD = Math.max(0, C.RMD_START_AGE - p.currentAge);
    const projectedBal = futureValue(
      (p.bal401k||0) + (p.balTradIRA||0),
      (p.contrib401k||0) * 12,
      C.EQUITY_RETURN, yearsToRMD
    );
    const factor73 = RMD_TABLE[73] || 26.5;
    const projectedRMD = Math.round(projectedBal / factor73);
    return { projectedRMD, projectedBal, yearsToRMD, factor73, active: false };
  }, [p]);

  // ── Social Security Optimizer ────────────────────────────────────────────
  const ssOpt = useMemo(() => {
    const fra = C.SS_FRA;
    const baseBenefit = p.ssEstimatedBenefit || 2800;

    const calcBenefit = (claimAge) => {
      if (claimAge <= fra) {
        const monthsEarly = (fra - claimAge) * 12;
        const firstThirty = Math.min(monthsEarly, 36);
        const beyond      = Math.max(0, monthsEarly - 36);
        const reduction   = firstThirty * (5/9/100) + beyond * (5/12/100);
        return Math.round(baseBenefit * (1 - reduction));
      } else {
        const delay = (claimAge - fra) * C.SS_DELAYED_CREDIT;
        return Math.round(baseBenefit * (1 + delay));
      }
    };

    const options = [62,63,64,65,66,67,68,69,70].map(a => {
      const monthly = calcBenefit(a);
      const totalBy80  = monthly * 12 * Math.max(0, 80 - a);
      const totalBy85  = monthly * 12 * Math.max(0, 85 - a);
      const totalBy90  = monthly * 12 * Math.max(0, 90 - a);
      return { age:a, monthly, totalBy80, totalBy85, totalBy90 };
    });

    // Break-even vs age 62
    const base = options[0];
    const breakEvens = options.slice(1).map(o => {
      const extraMonthly = o.monthly - base.monthly;
      const missedMonths = (o.age - 62) * 12;
      const missedTotal  = base.monthly * missedMonths;
      return { age:o.age, monthly:o.monthly, breakEvenAge: extraMonthly > 0
        ? Math.round(62 + missedMonths/12 + missedTotal / (extraMonthly * 12))
        : null };
    });

    // SS taxability
    const ssBenefit85pct = (p.ssEstimatedBenefit * 12) * 0.85;
    const taxOnSS = ssBenefit85pct * (p.annualIncome > 197300 ? 0.24 : 0.22);

    return { options, breakEvens, ssBenefit85pct, taxOnSS };
  }, [p]);

  // ── FIRE Calculator ──────────────────────────────────────────────────────
  const fireCalc = useMemo(() => {
    const currentSavings = (p.bal401k||0) + (p.balRothIRA||0) + (p.balTradIRA||0) + (p.balHSA||0);
    const annualExpenses = (p.desiredIncome||0) * 12;

    // Different FIRE variants
    const leanFIRE  = (annualExpenses * 0.75) / C.SAFE_WITHDRAWAL_RATE;
    const regularFIRE = annualExpenses / C.SAFE_WITHDRAWAL_RATE;
    const fatFIRE   = (annualExpenses * 1.50) / C.SAFE_WITHDRAWAL_RATE;
    const coastFIRE = regularFIRE / Math.pow(1+C.EQUITY_RETURN, yearsToRetire);

    // Years to each
    const annualSavings = (p.contrib401k + p.contribRoth + p.contribHSA) * 12;
    const calcYears = (target) => {
      if (currentSavings >= target) return 0;
      let bal = currentSavings, y = 0;
      while (bal < target && y < 60) { bal = bal*(1+C.EQUITY_RETURN)+annualSavings; y++; }
      return y;
    };
    const coastReached = currentSavings >= coastFIRE;

    // Rule 72(t) SEPP for penalty-free early withdrawal
    const sepp = currentSavings > 0 ? Math.round(currentSavings / 30) : 0; // simplified annuitization

    return { leanFIRE, regularFIRE, fatFIRE, coastFIRE, coastReached,
             yearsToLean: calcYears(leanFIRE), yearsToFIRE: calcYears(regularFIRE),
             yearsToFat: calcYears(fatFIRE), currentSavings, sepp };
  }, [p, yearsToRetire]);

  // ─── TABS ────────────────────────────────────────────────────────────────
  const TABS = [
    {id:"overview",   l:"📊 Overview"},
    {id:"contribs",   l:"💰 Contributions"},
    {id:"projection", l:"📈 Projection"},
    {id:"roth",       l:"🔄 Roth Strategy"},
    {id:"rmd",        l:"📋 RMDs"},
    {id:"ss",         l:"👴 Social Security"},
    {id:"fire",       l:"🔥 FIRE"},
  ];

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🏛️ Retirement Planning</h2>
        <p style={{color:T.tx3,fontSize:12,margin:0}}>
          401(k) · IRA · Roth · RMDs · Social Security · FIRE — SECURE 2.0 / Tax Year 2025
        </p>
      </div>

      {/* Profile quick setup */}
      <SectionCard>
        <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>⚙️ Your Profile</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12}}>
          <Field l="Current Age"        value={p.currentAge}      onChange={v=>sp("currentAge",v)} />
          <Field l="Retirement Age"     value={p.retirementAge}   onChange={v=>sp("retirementAge",v)} />
          <Field l="Annual Income"      value={p.annualIncome}    onChange={v=>sp("annualIncome",v)} />
          <Field l="Monthly Desired Inc (today $)" value={p.desiredIncome} onChange={v=>sp("desiredIncome",v)} />
          <Field l="Current 401(k) Balance" value={p.bal401k}    onChange={v=>sp("bal401k",v)} />
          <Field l="Roth IRA Balance"   value={p.balRothIRA}      onChange={v=>sp("balRothIRA",v)} />
          <Field l="Traditional IRA"    value={p.balTradIRA}      onChange={v=>sp("balTradIRA",v)} />
          <Field l="HSA Balance"        value={p.balHSA}          onChange={v=>sp("balHSA",v)} />
          <Field l="Monthly 401(k) Contrib" value={p.contrib401k} onChange={v=>sp("contrib401k",v)} />
          <Field l="Monthly Roth IRA"   value={p.contribRoth}     onChange={v=>sp("contribRoth",v)} />
          <Field l="Monthly HSA"        value={p.contribHSA}      onChange={v=>sp("contribHSA",v)} />
          <Field l="Equity % in Portfolio" value={p.equityPct*100} onChange={v=>sp("equityPct",v/100)}
            hint="80% equity typical pre-retirement" />
        </div>
      </SectionCard>

      {/* Tab nav */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:T.bg3,borderRadius:12,padding:4,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flexShrink:0,padding:"8px 14px",borderRadius:9,border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:600,whiteSpace:"nowrap",
                    background:tab===t.id?T.card:"transparent",color:tab===t.id?T.tx:T.tx3}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ OVERVIEW ════ */}
      {tab === "overview" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
            <KPI l="Total Retirement Assets" v={fmK((p.bal401k||0)+(p.balRothIRA||0)+(p.balTradIRA||0)+(p.balHSA||0))} c={T.gn} />
            <KPI l={`Projected at ${age(p.retirementAge)}`} v={fmK(projection.retirementBal)} c={T.cy} sub={`${yearsToRetire} yrs @ ${pct(projection.blendedReturn)} blended`} />
            <KPI l="FIRE Number" v={fmK(projection.fireNumber)} sub={`4% rule on ${fm(p.desiredIncome)}/mo`} c={T.or} />
            <KPI l="FIRE Progress" v={pct(projection.fireProgress)} c={projection.fireProgress>=1?T.gn:T.or} />
            <KPI l="Annual Tax Savings (contribs)" v={fm(contribOpt.annualTaxSavings)} c={T.gn} sub="pre-tax contributions" />
            <KPI l="Contribution Gap" v={fm(contribOpt.totalGap)} c={contribOpt.totalGap>0?T.or:T.gn} sub="per year unused" />
          </div>

          {/* Account summary */}
          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>Account Breakdown</div>
            {[
              {l:"Traditional 401(k)",  v:p.bal401k,  c:T.bl,  note:"Pre-tax. RMD at 73. Best for: High earners expecting lower tax in retirement."},
              {l:"Roth IRA",            v:p.balRothIRA,c:T.gn, note:"After-tax. Tax-free growth. No RMDs. Best for: Young investors, low-income years."},
              {l:"Traditional IRA",     v:p.balTradIRA,c:T.pr, note:"Pre-tax (if deductible). RMD at 73. Consider Roth conversion in low-income years."},
              {l:"HSA (invested)",      v:p.balHSA,   c:T.cy,  note:"Triple tax advantage. After 65 = IRA (ordinary income). Best: let it grow, pay medical OOP."},
            ].map((acc,i)=>{
              const total = (p.bal401k||0)+(p.balRothIRA||0)+(p.balTradIRA||0)+(p.balHSA||0);
              const pct_ = total>0?(acc.v||0)/total:0;
              return(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                    <span style={{fontWeight:600,color:acc.c}}>{acc.l}</span>
                    <span style={{fontFamily:"monospace",color:T.tx}}>{fm(acc.v||0)} <span style={{color:T.tx3}}>({(pct_*100).toFixed(0)}%)</span></span>
                  </div>
                  <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden",marginBottom:3}}>
                    <div style={{height:"100%",width:(pct_*100)+"%",background:acc.c,borderRadius:3}}/>
                  </div>
                  <div style={{fontSize:10,color:T.tx3}}>{acc.note}</div>
                </div>
              );
            })}
          </SectionCard>

          {/* Asset location strategy */}
          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.or,marginBottom:12}}>📍 Asset Location Strategy (Tax Efficiency)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {l:"Taxable Account",c:T.tx3,assets:["Municipal bonds","Tax-managed index funds","Buy-and-hold stocks","I-Bonds","ETFs (low turnover)"],note:"Minimize taxable events. Hold long-term. Harvest losses."},
                {l:"Tax-Deferred (401k/Trad IRA)",c:T.bl,assets:["Bonds/Bond funds","REITs","High-dividend stocks","Actively managed funds","Inflation-protected (TIPS)"],note:"Best for income-generating assets. Pay tax later when (hopefully) in lower bracket."},
                {l:"Roth IRA / Roth 401k",c:T.gn,assets:["High-growth stocks","Small-cap/international","Emerging markets","REITs (if no taxable)","Crypto (if any)"],note:"Put highest expected return here — all growth comes out tax-FREE."},
              ].map(a=>(
                <div key={a.l} style={{background:T.bg3,borderRadius:10,padding:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:a.c,marginBottom:8}}>{a.l}</div>
                  {a.assets.map(x=><div key={x} style={{fontSize:11,color:T.tx2,marginBottom:3}}>✓ {x}</div>)}
                  <div style={{fontSize:10,color:T.tx3,marginTop:8,lineHeight:1.5}}>{a.note}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ════ CONTRIBUTIONS ════ */}
      {tab === "contribs" && (
        <div>
          <SectionCard>
            <div style={{fontSize:14,fontWeight:700,color:T.cy,marginBottom:16}}>💰 2025 Contribution Limits & Your Gap</div>
            {[
              {l:"401(k) / 403(b)",    max:contribOpt.k401Max, current:contribOpt.current401k, irc:"§ 401(k)",
               note:p.currentAge>=60&&p.currentAge<=63?"Super catch-up age 60-63: $34,750!":p.currentAge>=50?"Catch-up contribution available: $31,000":"Standard limit"},
              {l:"Roth / Traditional IRA", max:contribOpt.rothLimit||contribOpt.iraMax, current:contribOpt.currentRoth, irc:"§ 408 / § 408A",
               note:!contribOpt.rothEligible?"⚠ Over income limit — use Backdoor Roth IRA (no income limit)":contribOpt.rothLimit<contribOpt.iraMax?`Phase-out: limited to ${fm(contribOpt.rothLimit)}`:"Full contribution allowed"},
              {l:"HSA",                max:C.HSA_INDIVIDUAL, current:contribOpt.currentHSA, irc:"§ 223",
               note:"Must be enrolled in HDHP. Invest HSA funds — triple tax advantage."},
            ].map(acc=>{
              const gap = Math.max(0, acc.max - acc.current);
              const pct_ = acc.max>0?Math.min(acc.current/acc.max,1):0;
              return(
                <div key={acc.l} style={{marginBottom:20,padding:16,background:T.bg3,borderRadius:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:T.tx}}>{acc.l}</div>
                      <div style={{fontSize:10,color:T.tx3}}>{acc.irc}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,color:T.tx2}}>{fm(acc.current)}<span style={{color:T.tx3}}> / {fm(acc.max)}</span></div>
                      {gap > 0 && <div style={{fontSize:11,color:T.or,fontWeight:700}}>Gap: {fm(gap)}/yr</div>}
                      {gap === 0 && <div style={{fontSize:11,color:T.gn,fontWeight:700}}>✅ Maxed!</div>}
                    </div>
                  </div>
                  <div style={{height:8,background:T.bg2,borderRadius:4,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",width:(pct_*100)+"%",background:pct_>=1?T.gn:T.cy,borderRadius:4,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:10,color:T.tx3,lineHeight:1.5}}>{acc.note}</div>
                </div>
              );
            })}

            <div style={{background:`${T.gn}10`,border:`1px solid ${T.gn}25`,borderRadius:12,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:8}}>💡 Annual Tax Savings Opportunity</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><div style={{fontSize:10,color:T.tx3}}>TOTAL UNUSED SPACE</div><div style={{fontSize:20,fontWeight:800,color:T.or}}>{fm(contribOpt.totalGap)}/yr</div></div>
                <div><div style={{fontSize:10,color:T.tx3}}>TAX SAVINGS IF MAXED</div><div style={{fontSize:20,fontWeight:800,color:T.gn}}>{fm(contribOpt.annualTaxSavings)}/yr</div></div>
              </div>
              <div style={{fontSize:11,color:T.tx2,marginTop:10,lineHeight:1.7}}>
                Every dollar in your 401(k) or HSA saves you {Math.round((p.annualIncome>103350?0.22:0.12)*100)}¢ in taxes today AND grows tax-deferred.
                {contribOpt.gap401k > 0 && ` Increasing your 401(k) by ${fm(contribOpt.gap401k/12)}/month would max it out.`}
              </div>
            </div>
          </SectionCard>

          {!contribOpt.rothEligible && (
            <SectionCard>
              <div style={{fontSize:13,fontWeight:700,color:T.pr,marginBottom:12}}>🔄 Backdoor Roth IRA Strategy</div>
              <div style={{fontSize:12,color:T.tx2,lineHeight:1.8,marginBottom:12}}>
                Your income (${(p.annualIncome||0).toLocaleString("en-US")}) exceeds the Roth IRA direct contribution limit (${C.ROTH_PHASEOUT_END.toLocaleString("en-US")}).
                Use the <strong>Backdoor Roth</strong> — it's completely legal (IRS Notice 2014-54):
              </div>
              {[
                "1. Contribute $7,000 to a Traditional IRA (non-deductible — file Form 8606)",
                "2. Wait 1-2 days for the funds to settle",
                "3. Convert the Traditional IRA to Roth IRA (taxable only on earnings, usually near $0)",
                "4. File Form 8606 with your return to track non-deductible basis",
              ].map((s,i)=><div key={i} style={{fontSize:12,color:T.tx2,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>{s}</div>)}
              <InfoBox color={T.or}>
                <strong>⚠ Pro Rata Rule (IRC § 408):</strong> If you have other pre-tax IRA money, the conversion will be partially taxable.
                Best solution: roll pre-tax IRA funds into your 401(k) before doing the backdoor conversion.
                This is called the "Reverse Rollover" strategy.
              </InfoBox>
            </SectionCard>
          )}
        </div>
      )}

      {/* ════ PROJECTION ════ */}
      {tab === "projection" && (
        <SectionCard>
          <div style={{fontSize:14,fontWeight:700,color:T.tx2,marginBottom:16}}>📈 Retirement Projection</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
            <KPI l={`Balance at ${age(p.retirementAge)}`} v={fmK(projection.retirementBal)} c={T.gn} />
            <KPI l="FIRE Number" v={fmK(projection.fireNumber)} c={T.or} />
            <KPI l="Monthly Income (4% rule)" v={fm(projection.retirementBal*C.SAFE_WITHDRAWAL_RATE/12)} c={T.cy} sub="inflation-adjusted" />
            <KPI l="Portfolio Survives To" v={age(projection.depletionAge)} c={projection.depletionAge>=90?T.gn:T.rd} />
          </div>

          {/* Milestone chart */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.tx3,marginBottom:10}}>PORTFOLIO MILESTONES</div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
              {projection.years.map((y,i)=>{
                const h = Math.max(10, Math.min(100, y.bal/projection.retirementBal*80));
                return(
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:50}}>
                    <div style={{fontSize:9,color:T.tx3,fontFamily:"monospace"}}>{fmK(y.bal)}</div>
                    <div style={{width:36,height:h,background:y.inRetirement?T.or:(y.bal>=projection.fireNumber?T.gn:T.bl),borderRadius:"4px 4px 0 0",minHeight:4}}/>
                    <div style={{fontSize:9,color:y.inRetirement?T.or:T.tx3}}>{age(y.age)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <InfoBox color={T.or}>
            <strong>Sequence of Returns Risk:</strong> A market crash in your first 5 years of retirement can permanently impair your portfolio even if long-term returns are good.
            <br/><strong>Mitigation strategies:</strong>
            <br/>• <strong>Bucket Strategy:</strong> Keep 2 years of expenses in cash/bonds, 3-7 years in bonds, rest in equities.
            <br/>• <strong>Flexible Withdrawals:</strong> Reduce withdrawals 10-15% in down years.
            <br/>• <strong>Social Security as Floor:</strong> Delay SS to 70 for guaranteed inflation-adjusted income.
            <br/>• <strong>QLAC:</strong> Qualified Longevity Annuity Contract — use up to $200,000 to guarantee income starting at age 85.
          </InfoBox>
        </SectionCard>
      )}

      {/* ════ ROTH STRATEGY ════ */}
      {tab === "roth" && (
        <div>
          <SectionCard>
            <div style={{fontSize:14,fontWeight:700,color:T.gn,marginBottom:16}}>🔄 Roth Conversion Strategy</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
              <Field l="Annual Conversion Amount" value={p.rothConvertAmount}
                onChange={v=>sp("rothConvertAmount",v)}
                hint="Convert this amount from Traditional IRA/401(k) to Roth each year. Taxed as ordinary income in year of conversion." />
              <Field l="Years of Conversions" value={p.rothConvertYears}
                onChange={v=>sp("rothConvertYears",v)} />
            </div>

            {rothAnalysis && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
                  <KPI l="Tax Cost / Year" v={fm(rothAnalysis.yearlyTaxCost)} c={T.rd} />
                  <KPI l="Marginal Rate Paid" v={pct(rothAnalysis.marginalRate)} c={T.or} />
                  <KPI l="Roth FV (at 90)" v={fmK(rothAnalysis.rothFV)} c={T.gn} sub="tax-free" />
                  <KPI l="Trad FV after tax" v={fmK(rothAnalysis.tradFVafterTax)} c={T.tx2} sub="if converted later" />
                  <KPI l="Roth Advantage" v={fmK(rothAnalysis.rothAdvantage)} c={rothAnalysis.rothAdvantage>0?T.gn:T.rd} />
                  <KPI l="Total Conversion" v={fm(rothAnalysis.totalConversion)} c={T.cy} sub={`over ${p.rothConvertYears} years`} />
                </div>

                <InfoBox color={rothAnalysis.isAdvantageousNow?T.gn:T.or}>
                  {rothAnalysis.isAdvantageousNow
                    ? <><strong>✅ Conversion looks favorable now.</strong> You're paying {pct(rothAnalysis.marginalRate)} to convert, which is likely lower than your future retirement rate. Converting now locks in today's lower rates.</>
                    : <><strong>⚠ Consider timing.</strong> You're at {pct(rothAnalysis.marginalRate)} marginal rate for conversions. Best to convert in years when your income is lower (sabbaticals, early retirement gap years, before Social Security starts).</>
                  }
                </InfoBox>
              </>
            )}
          </SectionCard>

          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:12}}>🪜 Roth Conversion Ladder (Early Retirement)</div>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.8,marginBottom:12}}>
              If retiring before 59½, the Roth Conversion Ladder lets you access retirement funds penalty-free:
            </div>
            {[
              {step:"Year 1-5",   action:"Retire. Live on taxable accounts or Roth contributions (always accessible).",color:T.bl},
              {step:"Year 1",     action:"Convert $X from 401(k)/Trad IRA → Roth IRA. Pay tax now at (hopefully) low rate.",color:T.cy},
              {step:"Year 2-4",   action:"Continue annual conversions. Keep conversions within low tax brackets.",color:T.cy},
              {step:"Year 6",     action:"First conversion (from Year 1) is now 5 years old → withdraw penalty-free!",color:T.gn},
              {step:"Ongoing",    action:"New conversions fund year 5 from now. Perpetual tax-efficient income stream.",color:T.gn},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",gap:12,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:r.color,minWidth:80,flexShrink:0}}>{r.step}</div>
                <div style={{fontSize:11,color:T.tx2}}>{r.action}</div>
              </div>
            ))}
            <InfoBox color={T.cy}>
              <strong>Key rules:</strong> Roth CONTRIBUTIONS (not conversions) are always accessible penalty-free.
              Converted amounts require a 5-year seasoning period per conversion.
              Ordering rules: contributions first, then conversions (oldest first), then earnings.
            </InfoBox>
          </SectionCard>
        </div>
      )}

      {/* ════ RMDs ════ */}
      {tab === "rmd" && (
        <SectionCard>
          <div style={{fontSize:14,fontWeight:700,color:T.pr,marginBottom:16}}>📋 Required Minimum Distributions (RMDs)</div>
          <div style={{background:T.bg3,borderRadius:12,padding:16,marginBottom:16}}>
            {rmdCalc.active ? (
              <>
                <div style={{fontSize:12,color:T.rd,fontWeight:700,marginBottom:8}}>⚠ RMDs are Active (Age {p.currentAge})</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <KPI l="Pre-Tax Balance" v={fm(rmdCalc.totalPreTax)} c={T.tx2} />
                  <KPI l="Distribution Factor" v={rmdCalc.factor} c={T.tx3} sub="IRS Uniform Lifetime Table" />
                  <KPI l="This Year's RMD" v={fm(rmdCalc.rmd)} c={T.rd} sub="minimum withdrawal" />
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:12,color:T.tx2,fontWeight:700,marginBottom:8}}>RMD starts at {age(C.RMD_START_AGE)} ({rmdCalc.yearsToRMD} years away)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <KPI l="Projected Pre-Tax at 73" v={fmK(rmdCalc.projectedBal)} c={T.tx2} />
                  <KPI l="Distribution Factor (73)" v={rmdCalc.factor73} c={T.tx3} />
                  <KPI l="Projected First RMD" v={fm(rmdCalc.projectedRMD)} c={T.or} sub="per year at 73" />
                </div>
              </>
            )}
          </div>

          <InfoBox color={T.rd}>
            <strong>RMD Penalty:</strong> Failing to take RMD → 25% excise tax on shortfall (reduced to 10% if corrected within 2 years — SECURE 2.0).
            RMDs apply to: Traditional 401(k), Traditional IRA, SEP-IRA, SIMPLE IRA.
            Roth IRA → <strong>NO RMD</strong>. Roth 401(k) → RMD required (roll to Roth IRA to avoid).
          </InfoBox>

          <SectionCard style={{marginTop:16}}>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:12}}>💡 RMD Reduction Strategies</div>
            {[
              {s:"Roth Conversions Now", d:"Convert traditional IRA/401(k) to Roth before RMDs begin. Reduces future RMD base. Pay tax now at (hopefully) lower rate."},
              {s:"Qualified Charitable Distribution (QCD)", d:"IRC § 408(d)(8): Donate up to $105,000/yr directly from IRA to charity — satisfies RMD, excludes from income. Best strategy for charitably inclined retirees."},
              {s:"Qualified Longevity Annuity (QLAC)", d:"Move up to $200,000 of IRA to a QLAC. That amount is excluded from RMD calculation until the annuity starts (max age 85)."},
              {s:"Aggregate RMDs", d:"For multiple IRAs, you can aggregate RMDs and take the total from just one IRA. Not allowed to aggregate with 401(k)s."},
              {s:"Still Working Exception", d:"If still working at RMD age, current employer 401(k) is exempt from RMDs (not rollover IRAs). Keep working = defer 401(k) RMDs."},
            ].map((s,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:T.gn,marginBottom:3}}>{s.s}</div>
                <div style={{fontSize:11,color:T.tx2,lineHeight:1.6}}>{s.d}</div>
              </div>
            ))}
          </SectionCard>
        </SectionCard>
      )}

      {/* ════ SOCIAL SECURITY ════ */}
      {tab === "ss" && (
        <div>
          <SectionCard>
            <div style={{fontSize:14,fontWeight:700,color:T.tx2,marginBottom:16}}>👴 Social Security — Claiming Strategy</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
              <Field l="Your Estimated Benefit at FRA (age 67)" value={p.ssEstimatedBenefit}
                onChange={v=>sp("ssEstimatedBenefit",v)}
                hint="Find your estimate at ssa.gov/myaccount. Your actual benefit depends on your 35 highest-earning years." />
              <Field l="Planned Claiming Age" value={p.ssClaimAge}
                onChange={v=>sp("ssClaimAge",v)} placeholder="67"
                hint="Range: 62 (early, reduced) to 70 (maximum, +8%/yr after FRA)" />
            </div>

            {/* Benefits table */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr>{["Claim Age","Monthly Benefit","By Age 80","By Age 85","By Age 90","vs Age 62"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:h==="Claim Age"?"left":"right",
                      color:T.tx3,fontWeight:700,borderBottom:`1px solid ${T.border}`,fontSize:10,textTransform:"uppercase"}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {ssOpt.options.map((o,i)=>{
                    const base = ssOpt.options[0];
                    const diff = o.monthly - base.monthly;
                    const highlight = o.age === p.ssClaimAge;
                    return(
                      <tr key={o.age} style={{background:highlight?`${T.gn}08`:"transparent",
                        borderBottom:`1px solid ${T.border}`}}>
                        <td style={{padding:"8px 10px",fontWeight:highlight?800:400,color:highlight?T.gn:T.tx}}>{age(o.age)} {o.age===67?"(FRA)":o.age===70?"(MAX)":""}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:highlight?T.gn:T.tx}}>{fm(o.monthly)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:T.tx2}}>{fmK(o.totalBy80)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:T.tx2}}>{fmK(o.totalBy85)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:T.tx2}}>{fmK(o.totalBy90)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:diff>=0?T.gn:T.rd}}>{diff>=0?"+":""}{fm(diff)}/mo</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <InfoBox color={T.or}>
              <strong>Break-even analysis:</strong> Delaying from 62→70 requires living to approximately age 80+ to collect more total lifetime benefits.
              However, the higher inflation-adjusted benefit at 70 ({fm(ssOpt.options[ssOpt.options.length-1]?.monthly||0)}/mo) provides superior longevity insurance.
              <br/><strong>CPA strategy:</strong> Delay SS to 70, use Roth IRA withdrawals in the gap years (62-70). This maximizes the tax-free income while earning +8%/year guaranteed on SS.
            </InfoBox>
          </SectionCard>

          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.or,marginBottom:12}}>🧾 Social Security Taxation (IRC § 86)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {l:"Combined income < $25K",   tax:"0% of SS taxable",   c:T.gn},
                {l:"Combined income $25K–$34K", tax:"Up to 50% taxable", c:T.or},
                {l:"Combined income > $34K",    tax:"Up to 85% taxable", c:T.rd},
              ].map(t=>(
                <div key={t.l} style={{background:T.bg3,borderRadius:10,padding:12,textAlign:"center"}}>
                  <div style={{fontSize:10,color:T.tx3,lineHeight:1.4,marginBottom:6}}>{t.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:t.c}}>{t.tax}</div>
                </div>
              ))}
            </div>
            <InfoBox color={T.cy}>
              <strong>Combined income = AGI + non-taxable interest + ½ of SS benefits.</strong>
              Strategy: Keep combined income below $34K by using Roth IRA withdrawals (don't count toward combined income) instead of traditional IRA/401(k) in years around SS start.
              This can save thousands annually in SS taxation.
            </InfoBox>
          </SectionCard>
        </div>
      )}

      {/* ════ FIRE ════ */}
      {tab === "fire" && (
        <div>
          <SectionCard>
            <div style={{fontSize:14,fontWeight:700,color:T.or,marginBottom:16}}>🔥 FIRE Calculator (Financial Independence, Retire Early)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
              <KPI l="Current Savings" v={fmK(fireCalc.currentSavings)} c={T.tx2} />
              <KPI l="Lean FIRE" v={fmK(fireCalc.leanFIRE)} sub={`${fm(p.desiredIncome*0.75*12)}/yr · ${fireCalc.yearsToLean} yrs`} c={T.cy} />
              <KPI l="Regular FIRE" v={fmK(fireCalc.regularFIRE)} sub={`${fm(p.desiredIncome*12)}/yr · ${fireCalc.yearsToFIRE} yrs`} c={T.gn} />
              <KPI l="Fat FIRE" v={fmK(fireCalc.fatFIRE)} sub={`${fm(p.desiredIncome*1.5*12)}/yr · ${fireCalc.yearsToFat} yrs`} c={T.pr} />
              <KPI l="Coast FIRE" v={fmK(fireCalc.coastFIRE)} sub={fireCalc.coastReached?"✅ REACHED!":"Stop saving, let it grow"} c={fireCalc.coastReached?T.gn:T.or} />
            </div>

            <InfoBox color={T.gn}>
              <strong>Coast FIRE</strong> means you've saved enough that — even without another contribution — your portfolio will grow to your FIRE number by traditional retirement age.
              {fireCalc.coastReached
                ? " ✅ You've already reached Coast FIRE! Your current savings will reach your retirement goal without additional contributions."
                : ` You need ${fmK(fireCalc.coastFIRE)} to Coast FIRE. ${fireCalc.currentSavings > 0 ? `You're at ${((fireCalc.currentSavings/fireCalc.coastFIRE)*100).toFixed(0)}%.` : ""}`}
            </InfoBox>
          </SectionCard>

          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.rd,marginBottom:12}}>⚡ Rule 72(t) SEPP — Penalty-Free Early Access</div>
            <div style={{fontSize:12,color:T.tx2,lineHeight:1.8,marginBottom:12}}>
              If you retire before 59½, Rule 72(t) Substantially Equal Periodic Payments (SEPP) lets you take fixed annual distributions from your IRA without the 10% early withdrawal penalty (IRC § 72(t)(2)(A)(iv)).
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <KPI l="Estimated Annual SEPP" v={fm(fireCalc.sepp)} c={T.or} sub="simplified annuitization method" />
              <KPI l="Monthly SEPP" v={fm(fireCalc.sepp/12)} c={T.or} />
              <KPI l="Duration Required" v="5 yrs or age 59½" c={T.tx3} sub="whichever is longer" />
            </div>
            <InfoBox color={T.rd}>
              <strong>⚠ Critical Rules:</strong> Once you start SEPP, you CANNOT change the amount for 5 years or until you reach 59½ (whichever is longer).
              Modifying the schedule triggers all penalties retroactively with interest.
              Three calculation methods: Required Minimum Distribution, Fixed Amortization, Fixed Annuitization.
              Use a CPA to set up correctly — the IRS is unforgiving on errors.
            </InfoBox>
          </SectionCard>

          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:12}}>📊 The 4% Rule — Is It Safe?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {[
                {l:"4% SWR (Bengen 1994)",   v:fm(projection.retirementBal*0.04/12)+"/mo", note:"Based on 30-year horizons. May be aggressive for 40+ year retirements.",c:T.gn},
                {l:"3.5% Conservative SWR",  v:fm(projection.retirementBal*0.035/12)+"/mo", note:"Better for early retirees (40+ yr horizon). ~95% success rate historical.",c:T.cy},
                {l:"3.3% Ultra-Safe",        v:fm(projection.retirementBal*0.033/12)+"/mo", note:"Based on worst historical sequences. Near 100% success any scenario.",c:T.bl},
                {l:"Flexible Spending",      v:"Variable", note:"Spend less in down markets (-10%), more in up markets (+10%). Extends portfolio significantly.",c:T.pr},
              ].map(r=>(
                <div key={r.l} style={{background:T.bg3,borderRadius:10,padding:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:r.c}}>{r.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:T.tx,marginTop:4,fontFamily:"monospace"}}>{r.v}</div>
                  <div style={{fontSize:10,color:T.tx3,marginTop:4,lineHeight:1.5}}>{r.note}</div>
                </div>
              ))}
            </div>
            <InfoBox color={T.or}>
              <strong>FIRE math simplified:</strong> Your FIRE number = Annual expenses ÷ your chosen SWR.
              At $8,000/month: Regular FIRE = {fmK(p.desiredIncome*12/0.04)}, Conservative = {fmK(p.desiredIncome*12/0.035)}.
              Add Social Security income at 70 to reduce the portfolio required (SS effectively reduces your FIRE number).
            </InfoBox>
          </SectionCard>
        </div>
      )}

      <div style={{marginTop:16,padding:12,background:T.bg3,borderRadius:8,fontSize:10,color:T.tx3,lineHeight:1.6}}>
        <strong>Disclaimer:</strong> Retirement projections use historical return assumptions and are not guaranteed. Tax rules, contribution limits, and SS benefits are subject to change.
        Roth conversion decisions should be reviewed annually with a CPA. Past performance does not guarantee future results. Consult a licensed CFP and CPA for personalized retirement planning.
      </div>
    </div>
  );
}
