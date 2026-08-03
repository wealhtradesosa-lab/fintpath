/**
 * GoalsModuleUS.jsx
 * CFP-grade US Financial Goals & Dashboard
 *
 * Goals covered:
 *   Emergency Fund          3-6 months (FDIC-insured HYSA)
 *   Home Down Payment       20% conventional / 3.5% FHA / 0% VA
 *   529 College Savings     IRC § 529; 2024 rules (Roth rollover option)
 *   Debt Payoff             Avalanche (highest rate) vs Snowball (smallest balance)
 *   Custom Goals            Any financial target with timeline
 *
 * Dashboard benchmarks:
 *   Net worth percentiles   Federal Reserve SCF 2022
 *   Income percentiles      IRS Statistics of Income 2023
 *   Savings rate            BLS Consumer Expenditure Survey
 *   Asset allocation        Vanguard Target Date Fund glide path
 *
 * Tax Year 2025
 */

import { useState, useMemo } from "react";
import Disclaimer from "./Disclaimer";
import NumberInput from "./NumberInput";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  // 529 Plan
  SUPERFUNDING_LIMIT:   90000,   // 5-year gift tax election §529(c)(2)(B)
  ANNUAL_GIFT_EXCL:     18000,   // IRC § 2503(b) 2024
  ROTH_529_ROLLOVER:    35000,   // SECURE 2.0: max lifetime rollover to Roth IRA
  // College costs
  COLLEGE_INFLATION:    0.06,    // ~6% annual increase in college costs
  AVG_COLLEGE_4YR:      35000,   // avg total cost per year (public in-state)
  PRIV_COLLEGE_4YR:     58000,   // avg private 4-year
  // Mortgage
  CONVENTIONAL_DOWN:    0.20,
  FHA_DOWN:             0.035,
  VA_DOWN:              0,
  JUMBO_THRESHOLD:      766550,  // 2024 conforming loan limit
  PMI_RATE:             0.01,    // ~1% if < 20% down
  // Emergency fund
  MIN_MONTHS:           3,
  IDEAL_MONTHS:         6,
  MAX_MONTHS:           12,      // for business owners / single income
  // Savings rates
  HYSA_RATE_2025:       0.048,   // ~4.8% top HYSA rates
  // Color scheme
};

// ─── Federal Reserve SCF 2022 — Net Worth Percentiles ────────────────────────
const NW_PERCENTILES = [
  {pct:10, nw:-2800},   {pct:20, nw:7500},    {pct:25, nw:24000},
  {pct:30, nw:48000},   {pct:40, nw:97000},   {pct:50, nw:192700},
  {pct:60, nw:310000},  {pct:70, nw:528000},  {pct:75, nw:650000},
  {pct:80, nw:862000},  {pct:90, nw:1860000}, {pct:95, nw:3840000},
  {pct:99, nw:11100000},{pct:100,nw:999000000},
];
function getNWPercentile(nw) {
  for (let i = 0; i < NW_PERCENTILES.length - 1; i++) {
    if (nw <= NW_PERCENTILES[i+1].nw) {
      const lo = NW_PERCENTILES[i], hi = NW_PERCENTILES[i+1];
      const frac = (nw - lo.nw) / (hi.nw - lo.nw);
      return Math.round(lo.pct + frac * (hi.pct - lo.pct));
    }
  }
  return 99;
}

// ─── IRS Income Percentiles 2023 ─────────────────────────────────────────────
const INCOME_PERCENTILES = [
  {pct:10,income:13500},{pct:25,income:29000},{pct:50,income:56000},
  {pct:75,income:96000},{pct:90,income:158000},{pct:95,income:223000},
  {pct:99,income:663000},
];
function getIncomePercentile(income) {
  for (let i = 0; i < INCOME_PERCENTILES.length - 1; i++) {
    if (income <= INCOME_PERCENTILES[i+1].income) {
      const lo = INCOME_PERCENTILES[i], hi = INCOME_PERCENTILES[i+1];
      const frac = (income - lo.income) / (hi.income - lo.income);
      return Math.round(lo.pct + frac * (hi.pct - lo.pct));
    }
  }
  return 99;
}

// ─── Vanguard Glide Path — Recommended Equity % by Age ───────────────────────
function recommendedEquity(age) {
  if (age <= 25) return 90;
  if (age <= 40) return Math.round(90 - (age - 25) * 1.0);
  if (age <= 55) return Math.round(75 - (age - 40) * 1.5);
  if (age <= 65) return Math.round(52 - (age - 55) * 1.2);
  return Math.max(30, Math.round(40 - (age - 65) * 1.0));
}

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
const fmK = (n) => n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:fm(n);
const pct = (n) => `${((n||0)).toFixed(1)}%`;

// ─── Sub-components ───────────────────────────────────────────────────────────
const Label = ({c,children}) => (
  <div style={{fontSize:10,fontWeight:700,color:c||T.tx3,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>
);
const Field = ({l,value,onChange,type="number",placeholder,hint,options}) => (
  <div style={{marginBottom:14}}>
    <Label>{l}</Label>
    {options
      ?<select value={value||""} onChange={e=>onChange(e.target.value)}
         style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}>
         {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
       </select>
      :type === "number"
        ?<NumberInput value={value??""} onChange={v=>onChange(v===""?"":String(v))} placeholder={placeholder||"0"}
           style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
        :<input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"0"}
           style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
    }
    {hint&&<div style={{fontSize:10,color:T.tx3,marginTop:3,lineHeight:1.5}}>{hint}</div>}
  </div>
);
const InfoBox = ({color=T.bl,children}) => (
  <div style={{background:`${color}10`,border:`1px solid ${color}25`,borderRadius:8,padding:"10px 14px",fontSize:11,color:T.tx2,lineHeight:1.8,marginTop:8}}>{children}</div>
);
const KPI = ({l,v,sub,c,onClick}) => (
  <div onClick={onClick} style={{background:T.bg3,borderRadius:12,padding:"14px 16px",cursor:onClick?"pointer":"default"}}>
    <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
    <div style={{fontSize:20,fontWeight:800,color:c||T.tx,marginTop:4,fontFamily:"monospace"}}>{v}</div>
    {sub&&<div style={{fontSize:10,color:T.tx3,marginTop:2}}>{sub}</div>}
  </div>
);
const ProgressBar = ({value,max,color,height=8}) => {
  const w = max>0?Math.min(value/max*100,100):0;
  return(
    <div style={{height,background:T.bg3,borderRadius:height/2,overflow:"hidden"}}>
      <div style={{height:"100%",width:w+"%",background:color||T.gn,borderRadius:height/2,transition:"width .4s"}}/>
    </div>
  );
};
const SectionCard = ({children,style={}}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24,marginBottom:16,...style}}>{children}</div>
);

// ─── Goal Types ───────────────────────────────────────────────────────────────
const GOAL_TYPES = [
  {v:"emergency",  l:"🛡️ Emergency Fund",     color:T.bl},
  {v:"home",       l:"🏠 Home Down Payment",   color:T.or},
  {v:"college_529",l:"🎓 529 College Fund",    color:T.pr},
  {v:"debt_payoff",l:"💳 Debt Payoff",         color:T.rd},
  {v:"vacation",   l:"✈️ Vacation / Travel",   color:T.cy},
  {v:"vehicle",    l:"🚗 Vehicle",             color:T.tx2},
  {v:"business",   l:"🏢 Start a Business",    color:T.gn},
  {v:"custom",     l:"🎯 Custom Goal",         color:T.gn},
];

// ─── Empty Goal ───────────────────────────────────────────────────────────────
const EMPTY_GOAL = {
  name:"", type:"emergency", target:0, saved:0, monthly:0,
  targetDate:"", notes:"",
  // Emergency fund fields
  monthlyExpenses:0, targetMonths:6,
  // Home fields
  homePrice:0, downPct:20, loanType:"conventional",
  // 529 fields
  childAge:0, collegeAge:18, collegeType:"public",
  // Debt fields
  debtBalance:0, debtRate:0, debtPayment:0,
};

// ─── 529 Calculator ───────────────────────────────────────────────────────────
function calc529(childAge, collegeAge, monthlyContrib, currentBalance, collegeType) {
  const yearsToCollege = Math.max(0, collegeAge - childAge);
  const annualCost = collegeType === "private" ? C.PRIV_COLLEGE_4YR : C.AVG_COLLEGE_4YR;
  const futureCost4yr = annualCost * 4 * Math.pow(1 + C.COLLEGE_INFLATION, yearsToCollege);
  const annualCostFuture = futureCost4yr / 4;

  // FV of current balance + contributions at 7% return
  let bal = currentBalance || 0;
  for (let m = 0; m < yearsToCollege * 12; m++) bal = bal * (1 + 0.07/12) + (monthlyContrib||0);
  const projectedBal = bal;
  const gap = Math.max(0, futureCost4yr - projectedBal);
  const neededMonthly = yearsToCollege > 0
    ? gap / (((Math.pow(1+0.07/12, yearsToCollege*12)-1)/(0.07/12)))
    : gap;

  return { futureCost4yr, annualCostFuture, projectedBal, gap, neededMonthly };
}

// ─── Debt Payoff Calculator ───────────────────────────────────────────────────
function calcDebtPayoff(balance, annualRate, monthlyPayment) {
  if (!balance || !monthlyPayment) return null;
  const r = annualRate / 100 / 12;
  let bal = balance, months = 0, totalInterest = 0;
  while (bal > 0 && months < 600) {
    const interest = bal * r;
    totalInterest += interest;
    bal = bal + interest - monthlyPayment;
    months++;
    if (bal < 0) bal = 0;
  }
  const minPayment = balance * r * 1.01;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return { months, totalInterest, payoffDate, minPayment };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GoalsModuleUS({
  goals = [], onUpdateGoals,
  netWorth = 0, annualIncome = 0, monthlyExpenses = 0,
  monthlySavings = 0, currentAge = 35, retirementBalance = 0,
}) {
  // Fase 3 commit 7: gating reader.
  const { role } = useRole();
  const [tab, setTab]       = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState(EMPTY_GOAL);
  const [editing, setEditing] = useState(null);

  const sf  = (k,v) => setForm(p=>({...p,[k]:parseFloat(v)||0}));
  const sfS = (k,v) => setForm(p=>({...p,[k]:v}));

  const gtInfo = (v) => GOAL_TYPES.find(t=>t.v===v)||GOAL_TYPES[GOAL_TYPES.length-1];

  // ── Dashboard calculations ──────────────────────────────────────────────
  const dash = useMemo(() => {
    const nwPct        = getNWPercentile(netWorth);
    const incPct       = getIncomePercentile(annualIncome);
    const savingsRate  = annualIncome>0?(monthlySavings*12/annualIncome*100):0;
    const fireNumber   = monthlyExpenses>0?(monthlyExpenses*12/0.04):0;
    const fireProgress = fireNumber>0?Math.min(netWorth/fireNumber*100,100):0;
    const recEquity    = recommendedEquity(currentAge);
    const runway       = monthlyExpenses>0?Math.round(netWorth/monthlyExpenses):0;
    const debtFreeDate = null; // computed per goal

    // Wealth score (0-100) — composite
    let score = 0;
    if (savingsRate >= 20) score += 25; else if (savingsRate >= 10) score += 15; else score += 5;
    if (netWorth > 0) score += 15; else if (netWorth > -10000) score += 5;
    if (fireProgress >= 50) score += 20; else if (fireProgress >= 25) score += 10; else score += 3;
    if (nwPct >= 75) score += 20; else if (nwPct >= 50) score += 12; else score += 4;
    if (runway >= 12) score += 10; else if (runway >= 6) score += 6;
    if (goals.filter(g=>g.saved>=g.target&&g.target>0).length > 0) score += 10;
    score = Math.min(100, score);
    const scoreLabel = score>=80?"Excellent":score>=60?"Good":score>=40?"Fair":"Needs Work";
    const scoreColor = score>=80?T.gn:score>=60?T.cy:score>=40?T.or:T.rd;

    return { nwPct, incPct, savingsRate, fireNumber, fireProgress, recEquity, runway, score, scoreLabel, scoreColor };
  }, [netWorth, annualIncome, monthlyExpenses, monthlySavings, currentAge, goals]);

  // ── Goal calculations ───────────────────────────────────────────────────
  const goalCalcs = useMemo(() => goals.map(g => {
    const pct_ = g.target>0?Math.min(g.saved/g.target*100,100):0;
    const remaining = Math.max(0, g.target - g.saved);
    const months = g.monthly>0?Math.ceil(remaining/g.monthly):null;
    const targetDate = months ? new Date(Date.now()+months*30*24*3600*1000) : null;
    let extra = {};
    if (g.type==="emergency") extra = { recommended: (g.monthlyExpenses||0)*(g.targetMonths||6) };
    if (g.type==="college_529") extra = calc529(g.childAge||0, g.collegeAge||18, g.monthly||0, g.saved||0, g.collegeType||"public");
    if (g.type==="debt_payoff") extra = calcDebtPayoff(g.debtBalance||0, g.debtRate||0, g.monthly||0)||{};
    return { ...g, pct_, remaining, months, targetDate, ...extra };
  }), [goals]);

  const saveGoal = () => {
    if (!guardEdit(role)) return;
    const list = editing!==null
      ? goals.map((x,i)=>i===editing?{...form}:x)
      : [...goals,{...form}];
    onUpdateGoals(list);
    setShowForm(false); setEditing(null); setForm(EMPTY_GOAL);
  };
  const remove = (i) => { if (!guardEdit(role)) return; if(confirm("Remove this goal?")) onUpdateGoals(goals.filter((_,j)=>j!==i)); };

  const selType = gtInfo(form.type);

  const TABS = [
    {id:"dashboard",l:"📊 Dashboard"},
    {id:"goals",    l:`🎯 Goals (${goals.length})`},
    {id:"college",  l:"🎓 529 Planner"},
    {id:"home",     l:"🏠 Home Buying"},
    {id:"debt",     l:"💳 Debt Payoff"},
  ];

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🎯 Goals & Financial Health</h2>
        <p style={{color:T.tx3,fontSize:12,margin:0}}>Dashboard · Goal Tracker · 529 · Mortgage · Debt Payoff</p>
      </div>

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

      {/* ════ DASHBOARD ════ */}
      {tab==="dashboard" && (
        <div>
          {/* Wealth Score */}
          <SectionCard style={{background:`radial-gradient(ellipse at 20% 0%,rgba(34,197,94,.05),transparent 60%)`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:11,color:T.tx3,fontWeight:700,letterSpacing:1}}>FINANCIAL HEALTH SCORE</div>
                <div style={{fontSize:56,fontWeight:900,color:dash.scoreColor,lineHeight:1}}>{dash.score}</div>
                <div style={{fontSize:16,fontWeight:700,color:dash.scoreColor}}>{dash.scoreLabel}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,flex:1,maxWidth:500}}>
                <KPI l="Net Worth Percentile" v={`Top ${100-dash.nwPct}%`} sub="vs US households (Fed SCF 2022)" c={dash.nwPct>=75?T.gn:T.or} />
                <KPI l="Income Percentile" v={`Top ${100-dash.incPct}%`} sub="vs US earners (IRS SOI 2023)" c={dash.incPct>=75?T.gn:T.or} />
                <KPI l="Savings Rate" v={pct(dash.savingsRate)} sub={dash.savingsRate>=20?"✅ Excellent (20%+ target)":dash.savingsRate>=10?"Good (target: 20%)":"⚠ Below target (20%)"} c={dash.savingsRate>=20?T.gn:dash.savingsRate>=10?T.or:T.rd} />
                <KPI l="FIRE Progress" v={pct(dash.fireProgress)} sub={`of ${fmK(dash.fireNumber)} FIRE number`} c={dash.fireProgress>=75?T.gn:T.or} />
              </div>
            </div>
          </SectionCard>

          {/* Net Worth Benchmarks */}
          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>📍 Net Worth vs US Benchmarks (Federal Reserve SCF 2022)</div>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:T.tx2}}>Your Net Worth: <strong style={{color:T.gn}}>{fmK(netWorth)}</strong></span>
                <span style={{color:T.tx3}}>Percentile: <strong style={{color:T.gn}}>{dash.nwPct}th</strong></span>
              </div>
              <div style={{position:"relative",height:24,background:T.bg3,borderRadius:12,overflow:"hidden"}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",
                  width:`${Math.min(dash.nwPct,99)}%`,
                  background:`linear-gradient(90deg,${T.bl},${T.gn})`,borderRadius:12}}/>
                <div style={{position:"absolute",left:`${Math.min(dash.nwPct,99)}%`,top:"50%",transform:"translate(-50%,-50%)",
                  width:16,height:16,borderRadius:"50%",background:T.gn,border:`2px solid ${T.bg2}`}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.tx3,marginTop:4}}>
                <span>$0 (0th)</span><span>$192K (50th)</span><span>$1.9M (90th)</span><span>$11.1M (99th)</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
              {[
                {l:"Median US household",v:"$192,700",note:"50th percentile"},
                {l:"Top 25%",v:"$528,000",note:"75th percentile"},
                {l:"Top 10%",v:"$1,860,000",note:"90th percentile"},
                {l:"Top 1%",v:"$11,100,000",note:"99th percentile"},
              ].map(b=>(
                <div key={b.l} style={{background:T.bg3,borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:9,color:T.tx3}}>{b.l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:netWorth>=parseFloat(b.v.replace(/[$,M]/g,""))*(b.v.includes("M")?1e6:1)?T.gn:T.tx2}}>{b.v}</div>
                  <div style={{fontSize:9,color:T.tx3}}>{b.note}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 6 key indicators */}
          <SectionCard>
            <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>📋 Financial Vitals — CFP Benchmarks</div>
            {[
              {
                l:"Emergency Fund",
                actual: fmK(netWorth>0?Math.min(netWorth,monthlyExpenses*12):0),
                target: `${fm(monthlyExpenses*6)} (6 months)`,
                status: netWorth>=monthlyExpenses*6?"✅ Adequate":netWorth>=monthlyExpenses*3?"⚠ Minimum":"❌ Below",
                color: netWorth>=monthlyExpenses*6?T.gn:netWorth>=monthlyExpenses*3?T.or:T.rd,
                tip:"Keep 3-6 months in FDIC-insured HYSA (4.8%+ in 2025). Business owners: 12 months.",
              },
              {
                l:"Savings Rate",
                actual: pct(dash.savingsRate),
                target:"≥ 20% of gross income",
                status: dash.savingsRate>=20?"✅ Excellent":dash.savingsRate>=15?"⚠ Good":dash.savingsRate>=10?"⚠ Fair":"❌ Low",
                color: dash.savingsRate>=20?T.gn:dash.savingsRate>=10?T.or:T.rd,
                tip:"Saving 20% puts you on track for retirement in ~37 years from zero. 50% → 17 years (FIRE territory).",
              },
              {
                l:"Runway (Months of Expenses Covered)",
                actual:`${dash.runway} months`,
                target:"≥ 6 months",
                status: dash.runway>=12?"✅ Strong":dash.runway>=6?"✅ Adequate":dash.runway>=3?"⚠ Thin":"❌ Fragile",
                color: dash.runway>=6?T.gn:dash.runway>=3?T.or:T.rd,
                tip:"How long you can cover all expenses without any income. Includes all liquid assets.",
              },
              {
                l:"Equity Allocation",
                actual:`${Math.round((retirementBalance>0?0.75:0.5)*100)}%`,
                target:`~${dash.recEquity}% at age ${currentAge} (Vanguard glide path)`,
                status: "ℹ Review",
                color: T.or,
                tip:`Vanguard Target Date funds hold ~${dash.recEquity}% equity at age ${currentAge}. Adjust based on risk tolerance and years to retirement.`,
              },
              {
                l:"FIRE Progress",
                actual: pct(dash.fireProgress),
                target:`100% = ${fmK(dash.fireNumber)} (25× annual expenses)`,
                status: dash.fireProgress>=100?"✅ FIRE Ready!":dash.fireProgress>=75?"🔥 Getting close":dash.fireProgress>=50?"📈 On track":"🌱 Building",
                color: dash.fireProgress>=75?T.gn:dash.fireProgress>=50?T.or:T.bl,
                tip:"The 4% rule: if your portfolio is 25× your annual spending, you can withdraw 4% indefinitely (historically).",
              },
            ].map((item,i)=>(
              <div key={i} style={{padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:T.tx}}>{item.l}</div>
                    <div style={{fontSize:10,color:T.tx3}}>Target: {item.target}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:13,fontWeight:700,color:item.color,fontFamily:"monospace"}}>{item.actual}</div>
                    <div style={{fontSize:11,fontWeight:600,color:item.color}}>{item.status}</div>
                  </div>
                </div>
                <div style={{fontSize:10,color:T.tx3,lineHeight:1.5}}>{item.tip}</div>
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ════ GOALS ════ */}
      {tab==="goals" && (
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
            <button onClick={()=>{setForm(EMPTY_GOAL);setEditing(null);setShowForm(true)}}
              style={{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#000",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>
              + Add Goal
            </button>
          </div>

          {goalCalcs.length===0
            ?<div style={{padding:48,textAlign:"center",color:T.tx3,background:T.card,border:`1px solid ${T.border}`,borderRadius:16}}>
               <div style={{fontSize:36,marginBottom:12}}>🎯</div>
               <div style={{fontSize:15,fontWeight:700,color:T.tx2,marginBottom:6}}>No goals yet</div>
               <div style={{fontSize:13,marginBottom:20}}>Add an emergency fund, home down payment, 529 college savings, or debt payoff goal.</div>
               <button onClick={()=>{setForm(EMPTY_GOAL);setShowForm(true)}} style={{background:T.gn,color:"#000",border:"none",padding:"12px 28px",borderRadius:10,cursor:"pointer",fontWeight:700}}>+ Add First Goal</button>
             </div>
            :<div style={{display:"flex",flexDirection:"column",gap:12}}>
               {goalCalcs.map((g,i)=>{
                 const info = gtInfo(g.type);
                 const done = g.pct_>=100;
                 return(
                   <div key={i} style={{background:T.card,border:`1px solid ${done?T.gn:T.border}`,borderRadius:14,padding:20}}>
                     <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                       <div>
                         <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                           <span style={{fontSize:14,fontWeight:700}}>{g.name||info.l}</span>
                           <span style={{fontSize:10,background:`${info.color}20`,color:info.color,padding:"2px 8px",borderRadius:99,fontWeight:600}}>{info.l}</span>
                           {done&&<span style={{fontSize:10,background:`${T.gn}20`,color:T.gn,padding:"2px 8px",borderRadius:99,fontWeight:700}}>✅ ACHIEVED</span>}
                         </div>
                         {g.notes&&<div style={{fontSize:11,color:T.tx3}}>{g.notes}</div>}
                       </div>
                       <div style={{textAlign:"right"}}>
                         <div style={{fontSize:16,fontWeight:800,color:T.gn,fontFamily:"monospace"}}>{fm(g.saved||0)}</div>
                         <div style={{fontSize:11,color:T.tx3}}>of {fm(g.target||0)}</div>
                       </div>
                     </div>
                     <ProgressBar value={g.saved||0} max={g.target||1} color={done?T.gn:info.color} height={10} />
                     <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.tx3,marginTop:6,marginBottom:g.months?8:0}}>
                       <span>{g.pct_.toFixed(0)}% complete · {fm(g.remaining)} remaining</span>
                       {g.months&&<span>~{g.months} months at {fm(g.monthly)}/mo</span>}
                     </div>
                     {/* 529 extra */}
                     {g.type==="college_529"&&g.futureCost4yr&&(
                       <div style={{background:T.bg3,borderRadius:8,padding:"8px 12px",marginTop:8,fontSize:11,color:T.tx2}}>
                         Projected 4-yr cost: <strong style={{color:T.or}}>{fm(g.futureCost4yr)}</strong> · Projected balance: <strong style={{color:T.gn}}>{fm(g.projectedBal)}</strong>
                         {g.gap>0&&<span style={{color:T.rd}}> · Gap: {fm(g.gap)} (need +{fm(g.neededMonthly)}/mo)</span>}
                         {g.gap<=0&&<span style={{color:T.gn}}> · ✅ On track!</span>}
                       </div>
                     )}
                     {/* Debt payoff extra */}
                     {g.type==="debt_payoff"&&g.months&&(
                       <div style={{background:T.bg3,borderRadius:8,padding:"8px 12px",marginTop:8,fontSize:11,color:T.tx2}}>
                         Payoff in <strong style={{color:T.gn}}>{g.months} months</strong> · Total interest: <strong style={{color:T.rd}}>{fm(g.totalInterest)}</strong>
                       </div>
                     )}
                     <div style={{display:"flex",gap:8,marginTop:12}}>
                       <button onClick={()=>{setForm({...EMPTY_GOAL,...g});setEditing(i);setShowForm(true)}}
                         style={{padding:"6px 14px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,color:T.tx2,cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ Edit</button>
                       <button onClick={()=>remove(i)}
                         style={{padding:"6px 14px",background:T.rdB,border:"none",borderRadius:8,color:T.rd,cursor:"pointer",fontSize:11,fontWeight:600}}>🗑️ Remove</button>
                     </div>
                   </div>
                 );
               })}
             </div>
          }
        </div>
      )}

      {/* ════ 529 PLANNER ════ */}
      {tab==="college" && (
        <SectionCard>
          <div style={{fontSize:14,fontWeight:700,color:T.pr,marginBottom:16}}>🎓 529 College Savings Planner (IRC § 529)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
            <Field l="Child's Current Age" value={form.childAge} onChange={v=>sf("childAge",v)} />
            <Field l="Expected College Start Age" value={form.collegeAge||18} onChange={v=>sf("collegeAge",v)} />
            <Field l="Current 529 Balance" value={form.saved} onChange={v=>sf("saved",v)} />
            <Field l="Monthly Contribution" value={form.monthly} onChange={v=>sf("monthly",v)} />
            <Field l="College Type" value={form.collegeType||"public"} onChange={v=>sfS("collegeType",v)}
              options={[{v:"public",l:"Public In-State (~$35,000/yr today)"},{v:"private",l:"Private (~$58,000/yr today)"}]} />
          </div>
          {(()=>{
            const calc = calc529(form.childAge||0, form.collegeAge||18, form.monthly||0, form.saved||0, form.collegeType||"public");
            const yearsLeft = Math.max(0,(form.collegeAge||18)-(form.childAge||0));
            return(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
                  <KPI l="Future 4-yr Cost" v={fmK(calc.futureCost4yr)} c={T.or} sub={`at 6%/yr inflation`} />
                  <KPI l="Cost Per Year" v={fmK(calc.annualCostFuture)} c={T.tx2} />
                  <KPI l="Projected Balance" v={fmK(calc.projectedBal)} c={T.gn} sub={`in ${yearsLeft} years @ 7%`} />
                  <KPI l="Gap" v={fmK(calc.gap)} c={calc.gap<=0?T.gn:T.rd} sub={calc.gap<=0?"✅ Fully funded!":"additional needed"} />
                  {calc.gap>0&&<KPI l="Extra Needed/Month" v={fm(calc.neededMonthly)} c={T.rd} sub="to fully fund" />}
                </div>
                <InfoBox color={T.pr}>
                  <strong>529 Tax Benefits:</strong><br/>
                  • Federal: Contributions are NOT deductible, but growth and qualified withdrawals are tax-FREE<br/>
                  • Most states offer a state income tax deduction for in-state 529 contributions<br/>
                  • <strong>Superfunding:</strong> Contribute up to {fm(C.SUPERFUNDING_LIMIT)} at once (5-year gift tax election, IRC § 529(c)(2)(B)) — removes from taxable estate immediately<br/>
                  • <strong>SECURE 2.0 Roth Rollover:</strong> Unused 529 funds can be rolled to Roth IRA (lifetime max {fm(C.ROTH_529_ROLLOVER)}, 15-year seasoning required)<br/>
                  • Qualified expenses: tuition, room/board, books, computers, K-12 (up to $10K/yr)<br/>
                  • <strong>Investment:</strong> Use age-based portfolios that automatically glide to conservative as college approaches
                </InfoBox>
              </>
            );
          })()}
        </SectionCard>
      )}

      {/* ════ HOME BUYING ════ */}
      {tab==="home" && (
        <SectionCard>
          <div style={{fontSize:14,fontWeight:700,color:T.or,marginBottom:16}}>🏠 Home Down Payment Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
            <Field l="Target Home Price" value={form.homePrice||0} onChange={v=>sf("homePrice",v)} />
            <Field l="Loan Type" value={form.loanType||"conventional"} onChange={v=>sfS("loanType",v)}
              options={[
                {v:"conventional",l:"Conventional (20% down — no PMI)"},
                {v:"conventional_low",l:"Conventional (3% down + PMI)"},
                {v:"fha",l:"FHA Loan (3.5% down)"},
                {v:"va",l:"VA Loan (0% down — military)"},
                {v:"jumbo",l:"Jumbo Loan (10-20% down)"},
              ]} />
            <Field l="Current Savings for Down Payment" value={form.saved||0} onChange={v=>sf("saved",v)} />
            <Field l="Monthly Savings Toward Down Payment" value={form.monthly||0} onChange={v=>sf("monthly",v)} />
          </div>
          {(()=>{
            const hp = form.homePrice||0;
            const loanTypes = {
              conventional:    {pct:0.20, pmi:false, label:"Conventional 20%"},
              conventional_low:{pct:0.03, pmi:true,  label:"Conventional 3%"},
              fha:             {pct:0.035,pmi:true,   label:"FHA 3.5%"},
              va:              {pct:0,    pmi:false,   label:"VA 0%"},
              jumbo:           {pct:0.20, pmi:false,   label:"Jumbo 20%"},
            };
            const lt = loanTypes[form.loanType||"conventional"]||loanTypes.conventional;
            const downPayment = hp * lt.pct;
            const loanAmount  = hp - downPayment;
            const r = 0.0675/12; // ~6.75% 30yr fixed 2025
            const monthlyPI = r>0 ? loanAmount * (r*Math.pow(1+r,360)) / (Math.pow(1+r,360)-1) : 0;
            const pmi = lt.pmi ? loanAmount * C.PMI_RATE / 12 : 0;
            const propTax = hp * 0.012 / 12; // ~1.2% avg
            const insurance = hp * 0.005 / 12; // ~0.5%
            const totalPITI = monthlyPI + pmi + propTax + insurance;
            const saved = form.saved||0;
            const gap = Math.max(0, downPayment - saved);
            const months = form.monthly>0?Math.ceil(gap/form.monthly):null;
            const isJumbo = loanAmount > C.JUMBO_THRESHOLD;
            return(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                  <KPI l="Down Payment" v={fm(downPayment)} c={T.or} sub={`${(lt.pct*100).toFixed(1)}% of ${fmK(hp)}`} />
                  <KPI l="Loan Amount" v={fmK(loanAmount)} c={T.tx2} sub={isJumbo?"⚠ JUMBO LOAN":"conforming"} />
                  <KPI l="Monthly P&I" v={fm(monthlyPI)} c={T.tx2} sub="principal + interest" />
                  {pmi>0&&<KPI l="PMI" v={fm(pmi)} c={T.rd} sub="until 80% LTV" />}
                  <KPI l="Taxes + Insurance" v={fm(propTax+insurance)} c={T.tx3} sub="estimated" />
                  <KPI l="Total PITI" v={fm(totalPITI)} c={T.rd} sub="total monthly payment" />
                  <KPI l="Down Payment Gap" v={fm(gap)} c={gap<=0?T.gn:T.or} sub={months?`~${months} months`:gap<=0?"✅ Ready!":""} />
                </div>
                <InfoBox color={T.or}>
                  <strong>Mortgage Planning (2025):</strong><br/>
                  • <strong>28% Rule:</strong> PITI should be ≤28% of gross monthly income. Your income needed: {fm(totalPITI/0.28)}/mo<br/>
                  • <strong>36% Rule:</strong> Total debt (PITI + all debt payments) ≤36% of gross income<br/>
                  • <strong>PMI Removal:</strong> Conventional PMI auto-cancels at 78% LTV; request at 80% LTV<br/>
                  • <strong>Points:</strong> Buying down rate costs 1% of loan per 0.25% rate reduction. Break-even ~3-4 years<br/>
                  • <strong>Jumbo loans</strong> {isJumbo?"⚠ apply here — typically require 720+ credit score, 20% down, 12 months reserves":"do not apply here"}<br/>
                  • <strong>Mortgage interest deduction:</strong> Only on first $750K of debt (post-12/15/2017). Deductible via Schedule A if itemizing.
                </InfoBox>
              </>
            );
          })()}
        </SectionCard>
      )}

      {/* ════ DEBT PAYOFF ════ */}
      {tab==="debt" && (
        <SectionCard>
          <div style={{fontSize:14,fontWeight:700,color:T.rd,marginBottom:16}}>💳 Debt Payoff Optimizer</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
            <Field l="Total Debt Balance" value={form.debtBalance||0} onChange={v=>sf("debtBalance",v)} />
            <Field l="Annual Interest Rate (%)" value={form.debtRate||0} onChange={v=>sf("debtRate",v)} placeholder="24.99" />
            <Field l="Current Monthly Payment" value={form.monthly||0} onChange={v=>sf("monthly",v)} />
            <Field l="Extra Payment (monthly)" value={form.homePrice||0} onChange={v=>sf("homePrice",v)}
              hint="How much more can you pay per month?" />
          </div>
          {(()=>{
            const base = calcDebtPayoff(form.debtBalance||0, form.debtRate||0, form.monthly||0);
            const extra = calcDebtPayoff(form.debtBalance||0, form.debtRate||0, (form.monthly||0)+(form.homePrice||0));
            if (!base) return <div style={{color:T.tx3,fontSize:13}}>Enter debt balance and payment to calculate.</div>;
            const interestSaved = extra ? base.totalInterest - extra.totalInterest : 0;
            const monthsSaved = extra ? base.months - extra.months : 0;
            return(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                  <KPI l="Payoff Time" v={`${base.months} mo`} c={T.rd} sub={`~${(base.months/12).toFixed(1)} years`} />
                  <KPI l="Total Interest" v={fm(base.totalInterest)} c={T.rd} sub="at current pace" />
                  {extra&&<KPI l="With Extra Payment" v={`${extra.months} mo`} c={T.gn} sub={`saves ${monthsSaved} months`} />}
                  {extra&&<KPI l="Interest Saved" v={fm(interestSaved)} c={T.gn} sub="with extra payment" />}
                </div>
                <InfoBox color={T.rd}>
                  <strong>Debt Elimination Strategies:</strong><br/>
                  <strong>Avalanche Method (mathematically optimal):</strong> Pay minimums on all debts, put extra toward highest interest rate first. Minimizes total interest paid.<br/>
                  <strong>Snowball Method (psychologically effective):</strong> Pay minimums on all, extra toward smallest balance. Faster wins build momentum.<br/>
                  <strong>0% Balance Transfer:</strong> Move high-rate credit card debt to a 0% APR card (12-21 months). Pay down aggressively before promo ends. Watch for 3-5% transfer fee.<br/>
                  <strong>Debt Consolidation Loan:</strong> Combine multiple debts into one lower-rate personal loan. Only if you stop accumulating new debt.<br/>
                  <strong>The math:</strong> At {form.debtRate}% APR, this debt costs {fm((form.debtBalance||0)*(form.debtRate||0)/100/12)}/month in interest. That money invested at 7% instead = {fmK((form.debtBalance||0)*(form.debtRate||0)/100/12*12*25)} in 25 years.
                </InfoBox>
              </>
            );
          })()}
        </SectionCard>
      )}

      {/* ════ GOAL FORM MODAL ════ */}
      {showForm && (
        <div onClick={()=>setShowForm(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:800,margin:0}}>{editing!==null?"Edit":"New"} Goal</h3>
              <button onClick={()=>setShowForm(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
              {GOAL_TYPES.map(t=>(
                <button key={t.v} type="button" onClick={()=>sfS("type",t.v)}
                  style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${form.type===t.v?t.color:T.border}`,
                          background:form.type===t.v?`${t.color}15`:T.bg3,cursor:"pointer",textAlign:"left",
                          color:form.type===t.v?t.color:T.tx2,fontSize:12,fontWeight:form.type===t.v?700:400}}>
                  {t.l}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Goal Name" value={form.name} onChange={v=>sfS("name",v)} type="text" placeholder={selType.l} />
              </div>
              <Field l="Target Amount" value={form.target} onChange={v=>sf("target",v)} />
              <Field l="Amount Saved So Far" value={form.saved} onChange={v=>sf("saved",v)} />
              <Field l="Monthly Contribution" value={form.monthly} onChange={v=>sf("monthly",v)} />
              {form.type==="emergency"&&<Field l="Monthly Expenses" value={form.monthlyExpenses} onChange={v=>sf("monthlyExpenses",v)} />}
              {form.type==="college_529"&&<>
                <Field l="Child's Age" value={form.childAge} onChange={v=>sf("childAge",v)} />
                <Field l="College Start Age" value={form.collegeAge||18} onChange={v=>sf("collegeAge",v)} />
              </>}
              {form.type==="debt_payoff"&&<>
                <Field l="Debt Balance" value={form.debtBalance} onChange={v=>sf("debtBalance",v)} />
                <Field l="Interest Rate (%)" value={form.debtRate} onChange={v=>sf("debtRate",v)} />
              </>}
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Notes" value={form.notes} onChange={v=>sfS("notes",v)} type="text" />
              </div>
            </div>
            <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setShowForm(false)} style={{padding:"10px 20px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.tx2,cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={saveGoal} style={{padding:"10px 24px",background:`linear-gradient(135deg,${T.gn},#16a34a)`,border:"none",borderRadius:10,color:"#000",cursor:"pointer",fontWeight:700}}>
                {editing!==null?"Update":"Add Goal"}
              </button>
            </div>
          </div>
        </div>
      )}
    
    <Disclaimer variante="proyeccion" idioma="en" T={T} compacto />
  </div>
  );
}
