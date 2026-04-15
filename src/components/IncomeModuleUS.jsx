/**
 * IncomeModuleUS.jsx
 * CPA-grade US Income Tracker — IRC §§ 61, 71, 86, 101-140, 162, 199A, 469, 1221-1256
 * Tax Year 2025 | Prepared to the standard of a 20-year licensed CPA / CFP
 *
 * Covers:
 *   W-2 Wages                (IRC § 61, withholding IRC § 3402)
 *   1099-NEC Self-Employment  (IRC § 1401, Schedule SE, QBI § 199A)
 *   1099-B Capital Gains      (IRC §§ 1221, 1222, 1231, 1256)
 *   1099-DIV Dividends        (IRC §§ 1(h), 243, qualified div.)
 *   1099-INT Interest         (IRC § 61(a)(4))
 *   Schedule E Rental         (IRC § 469, depreciation § 168, passive loss rules)
 *   1099-R Retirement Dist.   (IRC §§ 72, 402, RMD § 401(a)(9))
 *   K-1 Pass-through          (IRC §§ 702, 1366)
 *   Social Security           (IRC § 86 — up to 85% taxable)
 */

import { useState, useMemo } from "react";
import { US } from "../lib/jurisdictions/US.js";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:"#09090b", bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)", borderL:"rgba(255,255,255,0.1)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444", rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6", pr:"#a78bfa", or:"#f59e0b", cy:"#06b6d4",
};
const fm = (n) => US.formatCurrency(n || 0);
const pct = (n) => `${((n||0)*100).toFixed(1)}%`;

// ─── IRS Income Categories ─────────────────────────────────────────────────
export const US_INCOME_TYPES = [
  {
    v:"w2",         l:"💼 W-2 Wages",            form:"W-2 Box 1",
    desc:"Wages, salaries, tips from employer. Pre-tax 401(k)/HSA already excluded.",
    taxed:"Ordinary income rates. FICA withheld by employer (6.2% SS + 1.45% Medicare).",
    irc:"IRC § 61; withholding § 3402",
    planning:"Maximize 401(k) ($23,500), FSA ($3,300), HSA ($4,150). Verify W-4 withholding.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"1099nec",     l:"🧾 1099-NEC / Freelance", form:"1099-NEC",
    desc:"Self-employment, consulting, gig economy. You are your own employer.",
    taxed:"Ordinary rates + 15.3% SE tax (SS + Medicare) on 92.35% of net profit. Minus QBI deduction (up to 20%).",
    irc:"IRC §§ 1401-1402; QBI § 199A",
    planning:"Maximize SEP-IRA (25% of net self-employment, up to $69,000). Deduct home office, vehicle, equipment, health insurance (above-the-line § 162(l)).",
    scheduleC:true, passive:false, selfEmployed:true,
  },
  {
    v:"rental",      l:"🏠 Rental Income",        form:"Schedule E",
    desc:"Net rental income after allowable expenses. Subject to passive loss rules.",
    taxed:"Ordinary rates. Passive activity rules apply (IRC § 469). $25K rental loss allowance if AGI < $100K.",
    irc:"IRC § 469; depreciation § 168; basis § 1012",
    planning:"Depreciate residential property over 27.5 years (commercial 39). Cost segregation study for accelerated depreciation. Real Estate Professional status (750+ hrs) removes passive limits.",
    scheduleC:false, passive:true, selfEmployed:false,
  },
  {
    v:"lt_gains",    l:"📈 Long-Term Capital Gains", form:"Schedule D / 1099-B",
    desc:"Assets held > 12 months. Preferential tax rates.",
    taxed:"0% (income ≤ $47,025), 15% ($47,026–$518,900), 20% (above). Plus 3.8% NIIT if MAGI > $200K.",
    irc:"IRC §§ 1(h), 1221, 1222",
    planning:"Tax-loss harvesting. Hold assets 12+ months for preferential rates. Donate appreciated stock to charity (avoid capital gains entirely). Opportunity Zone investments.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"st_gains",    l:"📉 Short-Term Capital Gains", form:"Schedule D / 1099-B",
    desc:"Assets held ≤ 12 months. Taxed as ordinary income.",
    taxed:"Ordinary income rates (10%–37%). No preferential treatment.",
    irc:"IRC §§ 1221, 1222",
    planning:"Hold assets to 12+ months to convert to long-term gains. Offset with capital losses (wash sale rule IRC § 1091 applies).",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"qual_div",    l:"💰 Qualified Dividends",  form:"1099-DIV Box 1b",
    desc:"Dividends from domestic corporations held 60+ days. Preferential rate.",
    taxed:"Same rates as long-term capital gains: 0%, 15%, or 20%. Plus 3.8% NIIT if applicable.",
    irc:"IRC § 1(h)(11)",
    planning:"Hold dividend stocks 60+ days around ex-dividend date. Hold in Roth IRA to eliminate tax entirely. Municipal bond interest is federal tax-exempt.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"ord_div",     l:"📊 Ordinary Dividends",  form:"1099-DIV Box 1a",
    desc:"Non-qualified dividends. Taxed as ordinary income.",
    taxed:"Ordinary income rates (10%–37%). No preferential treatment.",
    irc:"IRC § 61(a)(7)",
    planning:"Hold in tax-advantaged accounts (IRA, 401k). Consider replacing with qualified dividend stocks.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"interest",    l:"🏦 Interest Income",     form:"1099-INT",
    desc:"Bank interest, CDs, Treasury bonds, savings accounts.",
    taxed:"Ordinary income rates. US Treasury interest is state-exempt. Municipal bond interest is federal-exempt.",
    irc:"IRC § 61(a)(4)",
    planning:"I-Bonds (inflation-protected, defer taxes up to 30 years). Series EE bonds. Municipal bonds if in 24%+ bracket. Treasury Direct for state-exempt interest.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"retirement",  l:"🏛️ Retirement Distribution", form:"1099-R",
    desc:"401(k), Traditional IRA, pension distributions. Roth distributions generally tax-free.",
    taxed:"Ordinary rates for pre-tax accounts. 10% early withdrawal penalty if under 59½ (exceptions exist). RMDs required at age 73.",
    irc:"IRC §§ 72, 402, 408; RMD § 401(a)(9)",
    planning:"Roth conversions in low-income years. Qualified Charitable Distribution (QCD) to satisfy RMD up to $105,000 tax-free. 72(t) SEPP for penalty-free early withdrawals.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"k1",          l:"🏢 K-1 Pass-through",    form:"Schedule K-1",
    desc:"Partnership, S-Corp, LLC, trust income passed to you.",
    taxed:"Ordinary rates on ordinary income. Capital gain treatment on capital gain allocations. Self-employment tax may apply to general partners.",
    irc:"IRC §§ 702, 1366; at-risk § 465; passive § 469",
    planning:"Monitor at-risk basis (§ 465) and passive activity limits. QBI deduction (§ 199A) may apply. Guaranteed payments vs. distributive share planning.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"social_sec",  l:"👴 Social Security Benefits", form:"SSA-1099",
    desc:"Up to 85% of SS benefits are taxable depending on combined income.",
    taxed:"0% if combined income < $25K (single). Up to 50% if $25K–$34K. Up to 85% if > $34K.",
    irc:"IRC § 86",
    planning:"Delay benefits to age 70 for 8%/year increase. Roth conversions before claiming SS to reduce provisional income. Consider sequence of withdrawals.",
    scheduleC:false, passive:false, selfEmployed:false,
  },
  {
    v:"other",       l:"📝 Other Income",         form:"Schedule 1",
    desc:"Alimony (pre-2019 divorces), gambling winnings, prizes, crypto, forgiven debt.",
    taxed:"Generally ordinary income. Crypto: property treatment (Notice 2014-21). Canceled debt: IRC § 61(a)(12) unless exclusion applies.",
    irc:"IRC § 61; crypto Notice 2014-21",
    planning:"Document all crypto transactions (cost basis tracking). Form W-2G for gambling. Insolvency exclusion for canceled debt (IRC § 108).",
    scheduleC:false, passive:false, selfEmployed:false,
  },
];

// ─── Form defaults ─────────────────────────────────────────────────────────
const EMPTY = {
  nombre:"", tipo:"w2", mensual:0, moneda:"USD",
  notes:"", w2_401k:0, w2_hsa:0,
  se_expenses:0, se_mileage:0, se_homeoffice:0,
  rental_expenses:0, rental_depreciation:0, rental_sqft:0,
  holding_days:400,
};

// ─── Sub-components ────────────────────────────────────────────────────────
const Label = ({children}) => (
  <div style={{fontSize:10,fontWeight:700,color:T.tx3,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>
);
const Field = ({l, value, onChange, type="text", options, placeholder}) => (
  <div style={{marginBottom:14}}>
    <Label>{l}</Label>
    {options
      ? <select value={value||""} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}>
          {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      : <input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
    }
  </div>
);
const InfoBox = ({color, children}) => (
  <div style={{background:`${color}10`,border:`1px solid ${color}30`,borderRadius:8,padding:"10px 14px",fontSize:11,color:T.tx2,lineHeight:1.7,marginTop:8}}>
    {children}
  </div>
);
const Chip = ({children, color}) => (
  <span style={{background:`${color}20`,color,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,marginLeft:6}}>{children}</span>
);

// ─── Tax Calculator per income source ──────────────────────────────────────
function calcTaxForSource(src, ordinaryIncome = 0) {
  const annual = (src.mensual || 0) * 12;
  if (!annual) return null;

  switch(src.tipo) {
    case "w2": {
      const pre401k   = (src.w2_401k || 0) * 12;
      const preHSA    = (src.w2_hsa  || 0) * 12;
      const netW2     = Math.max(0, annual - pre401k - preHSA);
      const fica      = US.calculateRetirementContribution(annual);
      return {
        grossAnnual: annual, taxableAnnual: netW2,
        fica: fica.employee,
        label:"W-2 after pre-tax deductions",
        savings: pre401k + preHSA,
        chips:[{l:`401(k) –${fm(pre401k)}`,c:T.gn},{l:`HSA –${fm(preHSA)}`,c:T.cy}].filter(x=>x.l.includes("–$0")?false:true),
      };
    }
    case "1099nec": {
      const netSE   = Math.max(0, annual - (src.se_expenses||0)*12 - (src.se_mileage||0)*12 - (src.se_homeoffice||0)*12);
      const seTax   = Math.round(netSE * 0.9235 * 0.153);   // SE tax on 92.35%
      const halfSE  = Math.round(seTax / 2);                  // above-the-line deduction § 164(f)
      const qbi     = Math.round(Math.max(0, netSE - halfSE) * 0.20); // § 199A up to 20%
      const taxableInc = Math.max(0, netSE - halfSE - qbi);
      return {
        grossAnnual: annual, taxableAnnual: taxableInc,
        seTax, qbi, halfSEdeduction: halfSE,
        label:"Schedule C net after SE deductions + QBI",
        chips:[{l:`SE Tax ${fm(seTax)}`,c:T.rd},{l:`QBI –${fm(qbi)}`,c:T.gn}],
      };
    }
    case "rental": {
      const netRent = Math.max(0, annual - (src.rental_expenses||0)*12 - (src.rental_depreciation||0)*12);
      return {
        grossAnnual: annual, taxableAnnual: netRent,
        depreciation: (src.rental_depreciation||0)*12,
        label:"Schedule E net (gross – expenses – depreciation)",
        chips:[{l:`Depr –${fm((src.rental_depreciation||0)*12)}`,c:T.gn}],
      };
    }
    case "lt_gains":
      return {
        grossAnnual: annual, taxableAnnual: annual,
        rate: ordinaryIncome > 518900 ? 0.20 : ordinaryIncome > 47025 ? 0.15 : 0,
        label:"Long-term cap gains (preferential rate)",
        chips:[{l:"LTCG Rate",c:T.pr}],
      };
    case "st_gains":
      return { grossAnnual: annual, taxableAnnual: annual, label:"Short-term (ordinary rates)", chips:[] };
    case "qual_div":
      return {
        grossAnnual: annual, taxableAnnual: annual,
        rate: ordinaryIncome > 518900 ? 0.20 : ordinaryIncome > 47025 ? 0.15 : 0,
        label:"Qualified dividends (preferential rate)",
        chips:[{l:"Qualified",c:T.gn}],
      };
    default:
      return { grossAnnual: annual, taxableAnnual: annual, label:"Ordinary income", chips:[] };
  }
}

// ─── Quarterly Estimated Tax Calculator ───────────────────────────────────
function QuarterlyEstimates({ totalTax }) {
  const perQ = Math.round(totalTax / 4);
  const quarters = [
    {q:"Q1",due:"April 15, 2025",  amount:perQ},
    {q:"Q2",due:"June 16, 2025",   amount:perQ},
    {q:"Q3",due:"September 15, 2025",amount:perQ},
    {q:"Q4",due:"January 15, 2026",amount:perQ},
  ];
  return (
    <div>
      <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:4}}>📅 Form 1040-ES — Quarterly Estimated Payments</div>
      <div style={{fontSize:11,color:T.tx3,marginBottom:12}}>
        Required if you expect to owe ≥ $1,000 after withholding (IRC § 6654). 
        Safe harbor: pay 100% of prior year tax (110% if AGI &gt; $150K).
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {quarters.map(q=>(
          <div key={q.q} style={{background:T.bg3,borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.or}}>{q.q}</div>
              <div style={{fontSize:10,color:T.tx3}}>Due {q.due}</div>
            </div>
            <div style={{fontSize:16,fontWeight:800,color:T.tx,fontFamily:"monospace"}}>{fm(q.amount)}</div>
          </div>
        ))}
      </div>
      <InfoBox color={T.or}>
        <strong>⚠ Underpayment Penalty (IRC § 6654):</strong> IRS charges ~8% annualized on underpaid estimated taxes. 
        Avoid by paying the lesser of: (a) 90% of current year tax, or (b) 100% of prior year tax (110% if prior AGI &gt; $150K).
      </InfoBox>
    </div>
  );
}

// ─── NIIT Warning ─────────────────────────────────────────────────────────
function NIITWarning({ investmentIncome, magi }) {
  if (magi < 200000 || investmentIncome <= 0) return null;
  const niitBase = Math.min(investmentIncome, magi - 200000);
  const niit = Math.round(niitBase * 0.038);
  return (
    <InfoBox color={T.rd}>
      <strong>⚠ Net Investment Income Tax (NIIT) — IRC § 1411:</strong>{" "}
      3.8% surtax applies on investment income for MAGI &gt; $200K (single). 
      Estimated NIIT: <strong>{fm(niit)}</strong> on {fm(niitBase)} of net investment income.
      Strategy: Maximize deductions to reduce MAGI below threshold; consider installment sales for real estate gains.
    </InfoBox>
  );
}

// ─── Additional Medicare Tax Warning ──────────────────────────────────────
function AddlMedicare({ wages, magi }) {
  if (magi <= 200000) return null;
  const excess = Math.max(0, wages - 200000);
  const tax = Math.round(excess * 0.009);
  if (tax <= 0) return null;
  return (
    <InfoBox color={T.or}>
      <strong>⚠ Additional Medicare Tax — IRC § 3101(b)(2):</strong>{" "}
      0.9% on wages/SE income over $200K (single). Estimated: <strong>{fm(tax)}</strong>. 
      Employer does not withhold this until $200K threshold is met in-house. Verify Form W-4 or pay via estimated taxes.
    </InfoBox>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function IncomeModuleUS({ ingresos = [], onUpdate, trm = 1 }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [editing, setEditing]   = useState(null);
  const [expanded, setExpanded] = useState(null);

  const sf = (k, v) => setForm(p => ({...p, [k]: v}));

  // ── Totals ──────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let grossAnnual = 0, taxableAnnual = 0, seTaxTotal = 0,
        investmentIncome = 0, w2Wages = 0, seIncome = 0;

    ingresos.forEach(src => {
      const annual = (src.mensual || 0) * 12;
      grossAnnual += annual;

      if (src.tipo === "w2")                { w2Wages += annual; taxableAnnual += Math.max(0, annual - (src.w2_401k||0)*12 - (src.w2_hsa||0)*12); }
      else if (src.tipo === "1099nec")      { seIncome += annual; const net = Math.max(0, annual - (src.se_expenses||0)*12); seTaxTotal += Math.round(net*0.9235*0.153); taxableAnnual += Math.max(0,net-seTaxTotal/2-net*0.20); }
      else if (src.tipo === "rental")       { taxableAnnual += Math.max(0, annual - (src.rental_expenses||0)*12 - (src.rental_depreciation||0)*12); }
      else if (["lt_gains","qual_div"].includes(src.tipo)) { investmentIncome += annual; taxableAnnual += annual; }
      else                                  { taxableAnnual += annual; }
    });

    const fedTax = US.calculateIncomeTax(taxableAnnual);
    const fica   = US.calculateRetirementContribution(w2Wages);
    const totalTax = fedTax.tax + fica.employee + seTaxTotal;
    const niitBase = investmentIncome > 0 && taxableAnnual > 200000
      ? Math.min(investmentIncome, taxableAnnual - 200000) : 0;
    const niit = Math.round(niitBase * 0.038);

    return { grossAnnual, taxableAnnual, fedTax, fica, seTaxTotal, totalTax, investmentIncome, w2Wages, niit };
  }, [ingresos]);

  const typeInfo = (v) => US_INCOME_TYPES.find(t => t.v === v) || US_INCOME_TYPES[0];

  const openAdd = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (idx) => { setForm({...EMPTY,...ingresos[idx]}); setEditing(idx); setShowForm(true); };
  const save = () => {
    const list = editing !== null
      ? ingresos.map((x,i) => i === editing ? {...form, mensual: +form.mensual||0} : x)
      : [...ingresos, {...form, mensual: +form.mensual||0}];
    onUpdate(list);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
  };
  const remove = (idx) => { if(confirm("Remove this income source?")) onUpdate(ingresos.filter((_,i)=>i!==idx)); };

  const selType = typeInfo(form.tipo);

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>💰 Income</h2>
          <p style={{color:T.tx3,fontSize:12,margin:0}}>
            All income types per IRS classification — Tax Year 2025
          </p>
        </div>
        <button onClick={openAdd} style={{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#000",border:"none",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>
          + Add Income
        </button>
      </div>

      {/* KPI row */}
      {ingresos.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          {[
            {l:"Gross Income",  v:fm(totals.grossAnnual),   c:T.gn,  sub:"/year"},
            {l:"Taxable Income",v:fm(totals.taxableAnnual), c:T.tx2, sub:"after deductions"},
            {l:"Federal Tax",   v:fm(totals.fedTax.tax),    c:T.rd,  sub:pct(totals.fedTax.effectiveRate)+" eff."},
            {l:"Total Tax Burden",v:fm(totals.totalTax),    c:T.rd,  sub:"Fed+FICA+SE"},
            {l:"Monthly Take-Home",v:fm((totals.grossAnnual-totals.totalTax)/12),c:T.gn,sub:"/month net"},
          ].map(k=>(
            <div key={k.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:4}}>{k.v}</div>
              <div style={{fontSize:10,color:T.tx3,marginTop:2}}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* NIIT + Additional Medicare warnings */}
      <NIITWarning investmentIncome={totals.investmentIncome} magi={totals.taxableAnnual} />
      <AddlMedicare wages={totals.w2Wages} magi={totals.taxableAnnual} />

      {/* Income sources list */}
      {ingresos.length === 0 ? (
        <div style={{padding:56,textAlign:"center",color:T.tx3,background:T.card,border:`1px solid ${T.border}`,borderRadius:16}}>
          <div style={{fontSize:36,marginBottom:12}}>📋</div>
          <div style={{fontSize:15,fontWeight:700,color:T.tx2,marginBottom:6}}>No income sources yet</div>
          <div style={{fontSize:13,marginBottom:20}}>Add your W-2, 1099-NEC, rental, dividends, and other income. Each is handled per IRS rules.</div>
          <button onClick={openAdd} style={{background:T.gn,color:"#000",border:"none",padding:"12px 28px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Add First Income Source</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {ingresos.map((src, idx) => {
            const info   = typeInfo(src.tipo);
            const annual = (src.mensual||0) * 12;
            const calc   = calcTaxForSource(src, totals.taxableAnnual);
            const open   = expanded === idx;
            return (
              <div key={idx} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
                {/* Row */}
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",cursor:"pointer"}}
                     onClick={()=>setExpanded(open?null:idx)}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:700}}>{src.nombre||info.l}</span>
                      <span style={{fontSize:10,background:`${T.bl}20`,color:T.bl,padding:"2px 8px",borderRadius:99,fontWeight:600}}>{info.form}</span>
                      {calc?.chips?.map((ch,i)=><Chip key={i} color={ch.c}>{ch.l}</Chip>)}
                    </div>
                    <div style={{fontSize:11,color:T.tx3,marginTop:3}}>{info.l} · {src.notes||info.desc.slice(0,60)+"…"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:800,color:T.gn,fontFamily:"monospace"}}>{fm(src.mensual||0)}<span style={{fontSize:10,color:T.tx3,fontWeight:400}}>/mo</span></div>
                    <div style={{fontSize:10,color:T.tx3}}>{fm(annual)}/yr</div>
                  </div>
                  <div style={{color:T.tx3,fontSize:12,marginLeft:4}}>{open?"▲":"▼"}</div>
                </div>

                {/* Expanded detail */}
                {open && (
                  <div style={{borderTop:`1px solid ${T.border}`,padding:"16px 18px",background:T.bg2}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                      {/* IRS Treatment */}
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.pr,marginBottom:6}}>📖 IRS Tax Treatment</div>
                        <div style={{fontSize:11,color:T.tx2,lineHeight:1.7}}>{info.taxed}</div>
                        <div style={{fontSize:10,color:T.tx3,marginTop:4}}>Ref: <em>{info.irc}</em></div>
                      </div>
                      {/* Planning */}
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:T.gn,marginBottom:6}}>💡 Planning Opportunities</div>
                        <div style={{fontSize:11,color:T.tx2,lineHeight:1.7}}>{info.planning}</div>
                      </div>
                    </div>

                    {/* Calc breakdown */}
                    {calc && (
                      <div style={{marginTop:14,background:T.bg3,borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:8}}>🔢 Tax Calculation — {calc.label}</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                          <div><div style={{fontSize:9,color:T.tx3}}>GROSS/YR</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>{fm(calc.grossAnnual)}</div></div>
                          {calc.savings>0 && <div><div style={{fontSize:9,color:T.tx3}}>PRE-TAX SAVINGS</div><div style={{fontSize:14,fontWeight:700,color:T.cy}}>–{fm(calc.savings)}</div></div>}
                          {calc.seTax>0   && <div><div style={{fontSize:9,color:T.tx3}}>SE TAX (15.3%)</div><div style={{fontSize:14,fontWeight:700,color:T.rd}}>+{fm(calc.seTax)}</div></div>}
                          {calc.qbi>0     && <div><div style={{fontSize:9,color:T.tx3}}>QBI DEDUCTION §199A</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>–{fm(calc.qbi)}</div></div>}
                          {calc.depreciation>0 && <div><div style={{fontSize:9,color:T.tx3}}>DEPRECIATION §168</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>–{fm(calc.depreciation)}</div></div>}
                          <div><div style={{fontSize:9,color:T.tx3}}>TAXABLE/YR</div><div style={{fontSize:14,fontWeight:700,color:T.or}}>{fm(calc.taxableAnnual)}</div></div>
                        </div>
                      </div>
                    )}

                    <div style={{display:"flex",gap:8,marginTop:12}}>
                      <button onClick={()=>openEdit(idx)} style={{padding:"8px 16px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,color:T.tx2,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                      <button onClick={()=>remove(idx)} style={{padding:"8px 16px",background:T.rdB,border:"none",borderRadius:8,color:T.rd,cursor:"pointer",fontSize:12,fontWeight:600}}>🗑️ Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quarterly estimates */}
      {totals.totalTax > 1000 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24,marginBottom:20}}>
          <QuarterlyEstimates totalTax={totals.totalTax} />
        </div>
      )}

      {/* ── Modal Form ── */}
      {showForm && (
        <div onClick={()=>setShowForm(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:620,maxHeight:"90vh",overflowY:"auto",padding:32}}>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <h3 style={{fontSize:18,fontWeight:800,margin:0}}>{editing!==null?"Edit":"Add"} Income Source</h3>
              <button onClick={()=>setShowForm(false)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button>
            </div>

            {/* Type selector */}
            <div style={{marginBottom:20}}>
              <Label>IRS Income Type</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {US_INCOME_TYPES.map(t=>(
                  <button key={t.v} type="button" onClick={()=>sf("tipo",t.v)}
                    style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${form.tipo===t.v?T.gn:T.border}`,background:form.tipo===t.v?T.gnB:T.bg3,cursor:"pointer",textAlign:"left",color:form.tipo===t.v?T.gn:T.tx2,fontSize:12,fontWeight:form.tipo===t.v?700:400}}>
                    {t.l}
                  </button>
                ))}
              </div>
              {/* IRC reference */}
              <InfoBox color={T.bl}>
                <strong>{selType.form}</strong> · {selType.irc}<br/>
                {selType.taxed}
              </InfoBox>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Name / Description" value={form.nombre} onChange={v=>sf("nombre",v)} placeholder={selType.l} />
              </div>
              <Field l="Monthly Amount (USD)" value={form.mensual} onChange={v=>sf("mensual",v)} type="number" placeholder="0" />
              <Field l="Notes" value={form.notes} onChange={v=>sf("notes",v)} placeholder="Employer, payer, etc." />
            </div>

            {/* W-2 extra fields */}
            {form.tipo === "w2" && (
              <div style={{marginTop:4,padding:14,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:T.gn,marginBottom:12}}>W-2 Pre-Tax Deductions (lowers taxable income)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <Field l="401(k) Monthly Contribution" value={form.w2_401k} onChange={v=>sf("w2_401k",v)} type="number" placeholder="0" />
                  <Field l="HSA Monthly Contribution" value={form.w2_hsa} onChange={v=>sf("w2_hsa",v)} type="number" placeholder="0" />
                </div>
                <InfoBox color={T.gn}>
                  2025 limits: 401(k) $23,500 · HSA $4,150 (individual) / $8,300 (family) · FSA $3,300 (use-it-or-lose-it).
                  These reduce your W-2 Box 1 taxable wages.
                </InfoBox>
              </div>
            )}

            {/* 1099-NEC extra fields */}
            {form.tipo === "1099nec" && (
              <div style={{marginTop:4,padding:14,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:T.gn,marginBottom:12}}>Schedule C Deductions (reduce SE income + tax)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <Field l="Business Expenses / Month" value={form.se_expenses} onChange={v=>sf("se_expenses",v)} type="number" placeholder="Software, supplies, etc." />
                  <Field l="Mileage Deduction / Month" value={form.se_mileage} onChange={v=>sf("se_mileage",v)} type="number" placeholder="$0.70/mile × biz miles" />
                  <Field l="Home Office / Month" value={form.se_homeoffice} onChange={v=>sf("se_homeoffice",v)} type="number" placeholder="Sq ft × $5 simplified" />
                </div>
                <InfoBox color={T.gn}>
                  2025: Standard mileage rate $0.70/mile (Rev. Proc. 2024-25). Home office simplified method: $5/sq ft up to 300 sq ft ($1,500 max).
                  QBI deduction (§ 199A): up to 20% of qualified business income — automatic in calculation.
                  SEP-IRA: deduct up to 25% of net SE income (max $69,000).
                </InfoBox>
              </div>
            )}

            {/* Rental extra fields */}
            {form.tipo === "rental" && (
              <div style={{marginTop:4,padding:14,background:T.bg3,borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,color:T.gn,marginBottom:12}}>Schedule E — Rental Deductions</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <Field l="Operating Expenses / Month" value={form.rental_expenses} onChange={v=>sf("rental_expenses",v)} type="number" placeholder="Mortgage int, taxes, ins, mgmt" />
                  <Field l="Depreciation / Month" value={form.rental_depreciation} onChange={v=>sf("rental_depreciation",v)} type="number" placeholder="Building cost ÷ 27.5 yrs ÷ 12" />
                </div>
                <InfoBox color={T.gn}>
                  <strong>Depreciation (§168):</strong> Residential rental = basis ÷ 27.5 yrs. Commercial = basis ÷ 39 yrs.
                  Depreciation is mandatory (recaptured at 25% on sale per § 1250).
                  <br/><strong>Passive loss rules (§ 469):</strong> Rental losses deductible up to $25K if AGI &lt; $100K (phases out $100K–$150K). Real Estate Professional (750+ hrs/yr) eliminates passive limits.
                  <br/><strong>Cost segregation:</strong> Reclassify components to 5/7/15-yr property for accelerated depreciation — typically 10–40% tax deferral in Year 1.
                </InfoBox>
              </div>
            )}

            {/* Capital gains holding period */}
            {["lt_gains","st_gains"].includes(form.tipo) && (
              <div style={{marginTop:4,padding:14,background:T.bg3,borderRadius:10}}>
                <Field l="Holding Period (days)" value={form.holding_days} onChange={v=>sf("holding_days",v)} type="number" />
                <InfoBox color={form.holding_days > 365 ? T.gn : T.or}>
                  {form.holding_days > 365
                    ? "✅ Long-term gains (>12 months): 0%, 15%, or 20% preferential rate. Hold to qualify."
                    : "⚠ Short-term gains (≤12 months): Taxed as ordinary income. Consider holding to 366+ days."}
                </InfoBox>
              </div>
            )}

            {/* Planning tip */}
            <div style={{marginTop:16,padding:12,background:`${T.pr}10`,border:`1px solid ${T.pr}30`,borderRadius:10,fontSize:11,color:T.tx2,lineHeight:1.7}}>
              <strong style={{color:T.pr}}>💡 CPA Planning:</strong> {selType.planning}
            </div>

            <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:24}}>
              <button onClick={()=>setShowForm(false)} style={{padding:"10px 20px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.tx2,cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={save} style={{padding:"10px 24px",background:`linear-gradient(135deg,${T.gn},#16a34a)`,border:"none",borderRadius:10,color:"#000",cursor:"pointer",fontWeight:700}}>
                {editing!==null?"Update":"Add Income"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom disclaimer */}
      {ingresos.length > 0 && (
        <div style={{marginTop:16,padding:12,background:T.bg3,borderRadius:8,fontSize:10,color:T.tx3,lineHeight:1.6}}>
          <strong>Disclaimer:</strong> Estimates based on 2025 IRS single-filer rules. State income taxes not included. 
          Consult a licensed CPA or EA for your official tax return. IRC references are provided for informational purposes.
        </div>
      )}
    </div>
  );
}
