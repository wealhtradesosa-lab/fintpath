/**
 * ExpensesModuleUS.jsx
 * CPA-grade US Expenses & Deductions Tracker
 *
 * Covers:
 *   Above-the-line deductions (Schedule 1, Form 1040) — reduce AGI directly
 *   Schedule A Itemized Deductions (IRC § 63) vs Standard Deduction
 *   Schedule C Business Deductions (for self-employed)
 *   Tax Credits (non-refundable & refundable)
 *   TCJA 2017 impact notes where relevant
 *   Tax Year 2025
 */

import { useState, useMemo } from "react";
import Disclaimer from "./Disclaimer";
import NumberInput from "./NumberInput";

// ─── 2025 Constants ─────────────────────────────────────────────────────────
const C = {
  STANDARD_DEDUCTION_SINGLE:  15000,
  STANDARD_DEDUCTION_MFJ:     30000,
  STANDARD_DEDUCTION_HOH:     22500,
  STANDARD_DEDUCTION_MFS:     15000,
  SALT_CAP:                   10000,   // IRC § 164(b)(6) — TCJA 2017
  MORTGAGE_DEBT_LIMIT:        750000,  // IRC § 163(h)(3)(B) — post-12/15/2017 loans
  MEDICAL_FLOOR_PCT:          0.075,   // IRC § 213 — 7.5% of AGI
  CHARITABLE_CASH_LIMIT:      0.60,    // IRC § 170(b)(1)(G)
  CHARITABLE_PROP_LIMIT:      0.30,    // IRC § 170(e)(1)
  STUDENT_LOAN_MAX:           2500,    // IRC § 221
  STUDENT_LOAN_PO_START:      75000,   // Phase-out start (single 2025)
  STUDENT_LOAN_PO_END:        90000,
  EDUCATOR_MAX:               300,     // IRC § 62(a)(2)(D)
  HSA_INDIVIDUAL:             4150,    // IRC § 223
  HSA_FAMILY:                 8300,
  IRA_LIMIT:                  7000,    // IRC § 219
  IRA_CATCHUP:                8000,    // Age 50+
  SECTION_179_LIMIT:          1220000, // IRC § 179 — 2025
  BONUS_DEPRECIATION:         0.40,    // 40% bonus depreciation 2025 (phasing down)
  MILEAGE_BUSINESS:           0.70,    // Rev. Proc. 2024-25
  MILEAGE_MEDICAL:            0.21,
  MILEAGE_CHARITY:            0.14,
  QBI_RATE:                   0.20,    // IRC § 199A
};

// ─── Design Tokens ──────────────────────────────────────────────────────────
const T = {
  bg:"#09090b", bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)", borderL:"rgba(255,255,255,0.1)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444", rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6", pr:"#a78bfa", or:"#f59e0b", cy:"#06b6d4",
};
const fm  = (n) => `$${Math.round(n||0).toLocaleString("en-US")}`;
const pct = (n) => `${((n||0)*100).toFixed(1)}%`;

// ─── Sub-components ──────────────────────────────────────────────────────────
const Label = ({c,children}) => (
  <div style={{fontSize:10,fontWeight:700,color:c||T.tx3,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{children}</div>
);
const Field = ({l, value, onChange, type="number", placeholder, hint}) => (
  <div style={{marginBottom:14}}>
    <Label>{l}</Label>
    {type === "number"
      ? <NumberInput value={value??""} onChange={v=>onChange(v===""?"":String(v))} placeholder={placeholder||"0"}
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
      : <input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"0"}
          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"10px 12px",color:T.tx,fontSize:13,outline:"none"}}/>
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
const SectionHeader = ({icon, title, subtitle, color}) => (
  <div style={{marginBottom:16}}>
    <div style={{fontSize:14,fontWeight:800,color:color||T.tx2}}>{icon} {title}</div>
    {subtitle && <div style={{fontSize:11,color:T.tx3,marginTop:2}}>{subtitle}</div>}
  </div>
);
const DeductRow = ({label, amount, irc, note, color}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
               padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
    <div style={{flex:1}}>
      <div style={{fontSize:12,color:T.tx2,fontWeight:600}}>{label}</div>
      {irc && <div style={{fontSize:10,color:T.tx3}}>Ref: <em>{irc}</em></div>}
      {note && <div style={{fontSize:10,color:T.tx3,marginTop:2,lineHeight:1.5}}>{note}</div>}
    </div>
    <div style={{fontSize:14,fontWeight:700,color:color||(amount>0?T.gn:T.tx3),
                 fontFamily:"monospace",marginLeft:12,whiteSpace:"nowrap"}}>
      {amount>0?`–${fm(amount)}`:fm(0)}
    </div>
  </div>
);

// ─── Filing Status Selector ──────────────────────────────────────────────────
const FILING_STATUSES = [
  {v:"single",   l:"Single",               std:C.STANDARD_DEDUCTION_SINGLE},
  {v:"mfj",      l:"Married Filing Jointly",std:C.STANDARD_DEDUCTION_MFJ},
  {v:"hoh",      l:"Head of Household",     std:C.STANDARD_DEDUCTION_HOH},
  {v:"mfs",      l:"Married Filing Separately",std:C.STANDARD_DEDUCTION_MFS},
];

// ─── Empty Form State ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  filingStatus: "single",
  agi: 0,

  // Above-the-line (Schedule 1) — reduce AGI
  studentLoanInterest:   0,  // IRC § 221
  educatorExpenses:      0,  // IRC § 62(a)(2)(D)
  hsaContrib:            0,  // IRC § 223
  selfEmployedHealthIns: 0,  // IRC § 162(l)
  halfSETax:             0,  // IRC § 164(f) — auto-calculated elsewhere
  tradIRAContrib:        0,  // IRC § 219
  sepIRAContrib:         0,  // IRC § 408(k)
  alimonyPaid:           0,  // IRC § 215 — only pre-2019 agreements

  // Schedule A — Itemized Deductions
  medicalDentalGross:    0,  // IRC § 213 — only excess over 7.5% AGI
  stateTaxPaid:          0,  // SALT — income tax or sales tax (not both)
  propertyTaxPaid:       0,  // SALT — subject to $10K combined cap
  mortgageInterest:      0,  // IRC § 163(h) — $750K debt limit
  mortgageBalance:       0,  // To check $750K limit
  charitableCash:        0,  // IRC § 170 — up to 60% AGI
  charitableProperty:    0,  // Appreciated property — up to 30% AGI (FMV)
  casualtyLoss:          0,  // IRC § 165 — federally declared disasters only

  // Schedule C business deductions
  businessExpenses:      0,  // Ordinary & necessary IRC § 162
  homeOfficeSqFt:        0,  // IRC § 280A — simplified $5/sqft, max 300
  businessMiles:         0,  // Rev. Proc. 2024-25 — $0.70/mile
  businessMeals:         0,  // IRC § 274 — 50% deductible
  section179:            0,  // IRC § 179 — immediate asset expensing
  professionalDev:       0,  // IRC § 162 — education maintaining skills

  // Energy Credits (credits, not deductions — reduce tax dollar-for-dollar)
  energyHomeCredit:      0,  // IRC § 25C — 30% of qualifying improvements, up to $3,200/yr
  solarCredit:           0,  // IRC § 25D — 30% of solar installation cost
  evCredit:              0,  // IRC § 30D — up to $7,500 new EV
  childTaxCredit:        0,  // IRC § 24 — $2,000/child under 17
  childCareCredit:       0,  // IRC § 21 — 20–35% of up to $3,000 ($6,000 for 2+ children)
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ExpensesModuleUS({ gastos = {}, onUpdate, agi: agiProp = 0 }) {
  const [form, setForm] = useState(() => ({...EMPTY_FORM, agi: agiProp}));
  const [activeTab, setActiveTab] = useState("above");

  const sf = (k, v) => setForm(p => ({...p, [k]: parseFloat(v)||0}));
  const sfS = (k, v) => setForm(p => ({...p, [k]: v}));

  const filingStatus = FILING_STATUSES.find(f => f.v === form.filingStatus) || FILING_STATUSES[0];
  const agi = form.agi;

  // ── Above-the-line calculations ─────────────────────────────────────────
  const aboveLine = useMemo(() => {
    const studentLoan = Math.min(form.studentLoanInterest, C.STUDENT_LOAN_MAX) *
      (agi > C.STUDENT_LOAN_PO_END ? 0 :
       agi > C.STUDENT_LOAN_PO_START
         ? 1 - (agi - C.STUDENT_LOAN_PO_START) / (C.STUDENT_LOAN_PO_END - C.STUDENT_LOAN_PO_START)
         : 1);
    const educator   = Math.min(form.educatorExpenses, C.EDUCATOR_MAX);
    const hsa        = Math.min(form.hsaContrib, C.HSA_INDIVIDUAL);
    const seHealth   = form.selfEmployedHealthIns;
    const ira        = Math.min(form.tradIRAContrib, C.IRA_LIMIT);
    const sep        = form.sepIRAContrib;
    const alimony    = form.alimonyPaid;
    const total      = studentLoan + educator + hsa + seHealth + ira + sep + alimony;
    return { studentLoan, educator, hsa, seHealth, ira, sep, alimony, total };
  }, [form, agi]);

  // ── Schedule A (Itemized) calculations ──────────────────────────────────
  const schedA = useMemo(() => {
    const adjustedAGI = Math.max(0, agi - aboveLine.total);

    // Medical: only excess over 7.5% AGI (§ 213)
    const medFloor   = adjustedAGI * C.MEDICAL_FLOOR_PCT;
    const medical    = Math.max(0, form.medicalDentalGross - medFloor);

    // SALT cap $10,000 (§ 164(b)(6))
    const saltRaw    = form.stateTaxPaid + form.propertyTaxPaid;
    const salt       = Math.min(saltRaw, C.SALT_CAP);
    const saltWasted = Math.max(0, saltRaw - C.SALT_CAP);

    // Mortgage interest — $750K debt limit
    const mortgageRatio = form.mortgageBalance > C.MORTGAGE_DEBT_LIMIT
      ? C.MORTGAGE_DEBT_LIMIT / form.mortgageBalance : 1;
    const mortgage   = form.mortgageInterest * mortgageRatio;
    const mortgageExcluded = form.mortgageInterest * (1 - mortgageRatio);

    // Charitable — cash up to 60% AGI, property up to 30% AGI
    const charitable = Math.min(form.charitableCash, adjustedAGI * C.CHARITABLE_CASH_LIMIT) +
                       Math.min(form.charitableProperty, adjustedAGI * C.CHARITABLE_PROP_LIMIT);
    const charCarryForward = Math.max(0,
      (form.charitableCash - adjustedAGI * C.CHARITABLE_CASH_LIMIT) +
      (form.charitableProperty - adjustedAGI * C.CHARITABLE_PROP_LIMIT));

    // Casualty losses — only federally declared disasters (§ 165(h))
    const casualty   = form.casualtyLoss;

    const total      = medical + salt + mortgage + charitable + casualty;
    return { medical, medFloor, salt, saltRaw, saltWasted, mortgage, mortgageExcluded,
             charitable, charCarryForward, casualty, total, adjustedAGI };
  }, [form, aboveLine, agi]);

  // ── Schedule C (Business) deductions ────────────────────────────────────
  const schedC = useMemo(() => {
    const homeOffice  = Math.min(form.homeOfficeSqFt, 300) * 5;   // simplified method
    const mileage     = form.businessMiles * C.MILEAGE_BUSINESS;
    const meals       = form.businessMeals * 0.50;                 // 50% rule
    const s179        = Math.min(form.section179, C.SECTION_179_LIMIT);
    const profDev     = form.professionalDev;
    const bizExpenses = form.businessExpenses;
    const total       = homeOffice + mileage + meals + s179 + profDev + bizExpenses;
    return { homeOffice, mileage, meals, s179, profDev, bizExpenses, total };
  }, [form]);

  // ── Credits (reduce tax dollar-for-dollar) ───────────────────────────────
  const credits = useMemo(() => {
    const energy  = Math.min(form.energyHomeCredit * 0.30, 3200); // § 25C — 30%, cap $3,200
    const solar   = form.solarCredit * 0.30;                        // § 25D — 30%, no cap thru 2032
    const ev      = Math.min(form.evCredit, 7500);                  // § 30D
    const child   = form.childTaxCredit * 2000;                     // $2,000/child
    const care    = form.childCareCredit;
    const total   = energy + solar + ev + child + care;
    return { energy, solar, ev, child, care, total };
  }, [form]);

  // ── Standard vs Itemized decision ───────────────────────────────────────
  const stdDeduction  = filingStatus.std;
  const itemizedTotal = schedA.total;
  const useItemized   = itemizedTotal > stdDeduction;
  const deductionBenefit = Math.max(stdDeduction, itemizedTotal);
  const itemizedBonus = Math.max(0, itemizedTotal - stdDeduction);

  const adjustedAGI   = Math.max(0, agi - aboveLine.total - schedC.total);
  const taxableIncome = Math.max(0, adjustedAGI - deductionBenefit);

  // Federal tax brackets (simplified single 2025)
  const BRACKETS = [
    {max:11925,  rate:0.10},{max:48475, rate:0.12},{max:103350,rate:0.22},
    {max:197300, rate:0.24},{max:250525,rate:0.32},{max:626350, rate:0.35},
    {max:Infinity,rate:0.37}
  ];
  function calcFedTax(income) {
    let tax=0, prev=0;
    for(const b of BRACKETS) {
      if(income<=prev) break;
      tax += (Math.min(income,b.max)-prev)*b.rate;
      prev=b.max;
    }
    return Math.round(tax);
  }
  const estFedTax     = calcFedTax(taxableIncome) - credits.total;
  const marginalRate  = BRACKETS.find(b => taxableIncome <= b.max)?.rate || 0.37;

  // ─── TABS ────────────────────────────────────────────────────────────────
  const tabs = [
    {id:"above",  l:"Above-the-Line",    count: aboveLine.total > 0 ? fm(aboveLine.total) : null},
    {id:"schedA", l:"Schedule A",        count: schedA.total > 0 ? fm(schedA.total) : null},
    {id:"schedC", l:"Schedule C",        count: schedC.total > 0 ? fm(schedC.total) : null},
    {id:"credits",l:"Tax Credits",       count: credits.total > 0 ? fm(credits.total) : null},
    {id:"summary",l:"Summary",           count: null},
  ];

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>💳 Deductions & Expenses</h2>
        <p style={{color:T.tx3,fontSize:12,margin:0}}>
          Schedule A · Schedule C · Above-the-line deductions · Tax Credits — Tax Year 2025
        </p>
      </div>

      {/* AGI + Filing Status */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:20,marginBottom:20}}>
        <SectionHeader icon="⚙️" title="Tax Situation" subtitle="Used to calculate deduction limits" color={T.bl} />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Field l="Adjusted Gross Income (AGI) — before deductions"
            value={form.agi} onChange={v=>sf("agi",v)} placeholder="Your total income" />
          <div style={{marginBottom:14}}>
            <Label>Filing Status</Label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {FILING_STATUSES.map(s=>(
                <button key={s.v} type="button" onClick={()=>sfS("filingStatus",s.v)}
                  style={{padding:"9px 12px",borderRadius:8,border:`1px solid ${form.filingStatus===s.v?T.gn:T.border}`,
                          background:form.filingStatus===s.v?T.gnB:T.bg3,cursor:"pointer",textAlign:"left",
                          color:form.filingStatus===s.v?T.gn:T.tx2,fontSize:12,fontWeight:600}}>
                  {s.l}<br/>
                  <span style={{fontSize:10,fontWeight:400,color:T.tx3}}>Std: {fm(s.std)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Quick standard vs itemized preview */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:4}}>
          {[
            {l:"Standard Deduction",v:fm(stdDeduction),c:useItemized?T.tx3:T.gn,badge:useItemized?"":"USE THIS"},
            {l:"Your Itemized Total",v:fm(itemizedTotal),c:useItemized?T.gn:T.tx3,badge:useItemized?"USE THIS":""},
            {l:"Extra Benefit",v:useItemized?`+${fm(itemizedBonus)}`:"$0",c:useItemized?T.cy:T.tx3,badge:null},
          ].map(k=>(
            <div key={k.l} style={{background:T.bg3,borderRadius:10,padding:"12px 14px",textAlign:"center"}}>
              <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:800,color:k.c,marginTop:4}}>{k.v}</div>
              {k.badge&&<div style={{fontSize:9,fontWeight:700,color:"#000",background:T.gn,borderRadius:99,padding:"2px 8px",marginTop:4,display:"inline-block"}}>{k.badge}</div>}
            </div>
          ))}
        </div>
        {!useItemized && itemizedTotal > 0 && (
          <InfoBox color={T.or}>
            <strong>Standard deduction wins by {fm(stdDeduction - itemizedTotal)}.</strong> You would need {fm(stdDeduction)} or more in itemized deductions to benefit from Schedule A.
            Strategy: "Bunch" 2 years of charitable donations into one year using a Donor Advised Fund (DAF) to exceed the standard deduction threshold every other year.
          </InfoBox>
        )}
        {useItemized && (
          <InfoBox color={T.gn}>
            <strong>✅ Itemizing saves you {fm(itemizedBonus)} more</strong> than the standard deduction. Make sure to keep all receipts and documentation (§ 6001 record-keeping requirements).
          </InfoBox>
        )}
      </div>

      {/* Tab navigation */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:T.bg3,borderRadius:12,padding:4,flexWrap:"wrap"}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{flex:1,minWidth:100,padding:"8px 12px",borderRadius:9,border:"none",cursor:"pointer",
                    fontSize:12,fontWeight:600,
                    background:activeTab===tab.id?T.card:"transparent",
                    color:activeTab===tab.id?T.tx:T.tx3}}>
            {tab.l}
            {tab.count && <span style={{marginLeft:6,fontSize:10,color:T.gn,fontWeight:700}}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ════ TAB: ABOVE-THE-LINE ════ */}
      {activeTab === "above" && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24}}>
          <SectionHeader icon="⬆️" title="Above-the-Line Deductions (Schedule 1)"
            subtitle="These reduce your AGI directly — available whether you itemize or take standard deduction. The most valuable deductions."
            color={T.cy} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <Field l="Student Loan Interest (max $2,500)" value={form.studentLoanInterest}
              onChange={v=>sf("studentLoanInterest",v)}
              hint={`IRC § 221. Phases out $${C.STUDENT_LOAN_PO_START.toLocaleString("en-US")}–$${C.STUDENT_LOAN_PO_END.toLocaleString("en-US")} AGI (single). Allowed: ${fm(aboveLine.studentLoan)}`} />
            <Field l="Educator Expenses (max $300)" value={form.educatorExpenses}
              onChange={v=>sf("educatorExpenses",v)}
              hint="IRC § 62(a)(2)(D). K-12 teachers only. Classroom supplies, professional development." />
            <Field l="HSA Contribution (max $4,150 individual)" value={form.hsaContrib}
              onChange={v=>sf("hsaContrib",v)}
              hint={`IRC § 223. Only if enrolled in High-Deductible Health Plan. Allowed: ${fm(aboveLine.hsa)}. Triple tax advantage: deductible, grows tax-free, withdrawals tax-free for medical.`} />
            <Field l="Self-Employed Health Insurance Premium" value={form.selfEmployedHealthIns}
              onChange={v=>sf("selfEmployedHealthIns",v)}
              hint="IRC § 162(l). 100% deductible above-the-line if self-employed with net profit. Cannot exceed net SE income. Includes dental, vision, long-term care." />
            <Field l="Traditional IRA Contribution (max $7,000)" value={form.tradIRAContrib}
              onChange={v=>sf("tradIRAContrib",v)}
              hint={`IRC § 219. Deductibility phases out if covered by workplace plan: single $77K–$87K AGI (2025). Allowed: ${fm(aboveLine.ira)}.`} />
            <Field l="SEP-IRA Contribution" value={form.sepIRAContrib}
              onChange={v=>sf("sepIRAContrib",v)}
              hint="IRC § 408(k). Self-employed: up to 25% of net SE income, max $69,000 (2025). Most powerful retirement vehicle for self-employed — combine with QBI deduction." />
            <Field l="Alimony Paid (pre-2019 divorce only)" value={form.alimonyPaid}
              onChange={v=>sf("alimonyPaid",v)}
              hint="IRC § 215. Only deductible for divorce agreements executed before Jan 1, 2019. Post-2019 alimony is NOT deductible (TCJA 2017 change)." />
          </div>
          <div style={{background:T.bg3,borderRadius:12,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.cy,marginBottom:12}}>Calculated Above-the-Line Deductions</div>
            {aboveLine.studentLoan > 0 && <DeductRow label="Student Loan Interest" amount={aboveLine.studentLoan} irc="§ 221" />}
            {aboveLine.educator    > 0 && <DeductRow label="Educator Expenses"     amount={aboveLine.educator}    irc="§ 62(a)(2)(D)" />}
            {aboveLine.hsa         > 0 && <DeductRow label="HSA Contribution"      amount={aboveLine.hsa}         irc="§ 223" />}
            {aboveLine.seHealth    > 0 && <DeductRow label="SE Health Insurance"   amount={aboveLine.seHealth}    irc="§ 162(l)" />}
            {aboveLine.ira         > 0 && <DeductRow label="Traditional IRA"       amount={aboveLine.ira}         irc="§ 219" />}
            {aboveLine.sep         > 0 && <DeductRow label="SEP-IRA"               amount={aboveLine.sep}         irc="§ 408(k)" />}
            {aboveLine.alimony     > 0 && <DeductRow label="Alimony Paid"          amount={aboveLine.alimony}     irc="§ 215" />}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
                         fontWeight:800,fontSize:15,color:T.cy,borderTop:`2px solid ${T.border}`,marginTop:4}}>
              <span>Total Above-the-Line</span>
              <span>–{fm(aboveLine.total)}</span>
            </div>
            <div style={{fontSize:11,color:T.tx3}}>New AGI: {fm(agi)} – {fm(aboveLine.total)} = <strong style={{color:T.tx}}>{fm(agi - aboveLine.total)}</strong></div>
          </div>
          <InfoBox color={T.cy}>
            <strong>Why above-the-line deductions matter:</strong> They reduce AGI, which in turn reduces phase-outs for other deductions and credits.
            Lower AGI = better eligibility for Roth IRA contributions, education credits, premium tax credits (ACA), and the NIIT threshold.
            Always maximize above-the-line deductions before considering Schedule A.
          </InfoBox>
        </div>
      )}

      {/* ════ TAB: SCHEDULE A ════ */}
      {activeTab === "schedA" && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24}}>
          <SectionHeader icon="📋" title="Schedule A — Itemized Deductions"
            subtitle={`Only beneficial if total exceeds your standard deduction of ${fm(stdDeduction)}. Current total: ${fm(itemizedTotal)}`}
            color={T.pr} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>

            {/* Medical */}
            <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:10,padding:14}}>
              <Label c={T.pr}>Medical & Dental Expenses — IRC § 213</Label>
              <Field l="Total Medical & Dental Expenses Paid" value={form.medicalDentalGross}
                onChange={v=>sf("medicalDentalGross",v)}
                hint={`Only the amount EXCEEDING 7.5% of AGI is deductible. Your floor: ${fm(schedA.medFloor)}. Deductible amount: ${fm(schedA.medical)}`} />
              <InfoBox color={T.pr}>
                Qualifies: Prescription drugs, doctor/dentist/hospital fees, medical equipment, vision, dental, mental health, long-term care premiums (age-limited), mileage at $0.21/mile.
                Does NOT qualify: Over-the-counter meds (unless Rx), cosmetic surgery, gym memberships (unless medically required), health insurance if deducted above-the-line.
                <br/><strong>Strategy:</strong> "Bunch" medical expenses into one year to exceed the 7.5% floor. Use HSA to pay qualified expenses (§ 213(d)).
              </InfoBox>
            </div>

            {/* SALT */}
            <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:10,padding:14}}>
              <Label c={T.pr}>State & Local Taxes (SALT) — IRC § 164 (capped $10,000)</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Field l="State Income Tax Paid (or Sales Tax)" value={form.stateTaxPaid}
                  onChange={v=>sf("stateTaxPaid",v)}
                  hint="Enter state income taxes withheld + any additional state tax owed. OR use sales tax tables (Publication 600) — whichever is higher." />
                <Field l="Real Estate / Property Tax Paid" value={form.propertyTaxPaid}
                  onChange={v=>sf("propertyTaxPaid",v)}
                  hint="Property taxes on primary and secondary residences. Foreign real estate taxes no longer deductible (TCJA 2017)." />
              </div>
              {schedA.saltWasted > 0 && (
                <InfoBox color={T.or}>
                  <strong>⚠ SALT Cap Alert:</strong> Your total SALT of {fm(schedA.saltRaw)} exceeds the $10,000 cap.
                  You lose {fm(schedA.saltWasted)} in deductions (TCJA 2017, § 164(b)(6)).
                  Workaround: Some states offer Pass-Through Entity (PTE) tax elections to bypass SALT cap — consult your CPA.
                </InfoBox>
              )}
            </div>

            {/* Mortgage Interest */}
            <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:10,padding:14}}>
              <Label c={T.pr}>Home Mortgage Interest — IRC § 163(h)</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Field l="Mortgage Interest Paid (Box 1 of Form 1098)" value={form.mortgageInterest}
                  onChange={v=>sf("mortgageInterest",v)} />
                <Field l="Outstanding Mortgage Balance" value={form.mortgageBalance}
                  onChange={v=>sf("mortgageBalance",v)}
                  hint={`Deductible only on first $750,000 of acquisition debt (for loans after 12/15/2017). Older loans: $1M limit. Deductible: ${fm(schedA.mortgage)}`} />
              </div>
              {schedA.mortgageExcluded > 0 && (
                <InfoBox color={T.or}>
                  <strong>⚠ Debt Limit Alert:</strong> Your mortgage balance exceeds $750,000. Only {pct(C.MORTGAGE_DEBT_LIMIT / form.mortgageBalance)} of interest ({fm(schedA.mortgage)}) is deductible. {fm(schedA.mortgageExcluded)} is excluded.
                </InfoBox>
              )}
              <InfoBox color={T.pr}>
                Also deductible: Points paid on home purchase (deducted over life of loan for refinance; fully deductible in year of purchase).
                Home equity loan interest is deductible ONLY if used to buy, build, or substantially improve the home (TCJA 2017).
                NOT deductible if used for debt consolidation, car purchases, or other personal expenses.
              </InfoBox>
            </div>

            {/* Charitable */}
            <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:10,padding:14}}>
              <Label c={T.pr}>Charitable Contributions — IRC § 170</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <Field l="Cash / Check / Credit Card Donations" value={form.charitableCash}
                  onChange={v=>sf("charitableCash",v)}
                  hint="Limit: 60% of AGI. Must have written acknowledgment from charity for donations ≥ $250." />
                <Field l="Appreciated Property / Stock (FMV)" value={form.charitableProperty}
                  onChange={v=>sf("charitableProperty",v)}
                  hint="Limit: 30% of AGI. Donate long-term appreciated stock directly — deduct full FMV and avoid capital gains entirely. Most powerful charitable strategy." />
              </div>
              {schedA.charCarryForward > 0 && (
                <InfoBox color={T.cy}>
                  <strong>📋 Carryforward:</strong> {fm(schedA.charCarryForward)} exceeds AGI limit this year. Unused charitable deductions carry forward 5 years (§ 170(d)(1)).
                </InfoBox>
              )}
              <InfoBox color={T.gn}>
                <strong>💡 Donor Advised Fund (DAF) Strategy:</strong> Contribute 2+ years of donations into a DAF in one year to exceed the standard deduction threshold. Get the full deduction now; recommend grants to charities over time.
                <br/><strong>Qualified Charitable Distribution (QCD):</strong> If age 70½+, donate up to $105,000 directly from IRA to charity — satisfies RMD without increasing taxable income (§ 408(d)(8)).
              </InfoBox>
            </div>

            <div style={{gridColumn:"1/-1"}}>
              <Field l="Casualty & Theft Losses (Federally declared disasters only)" value={form.casualtyLoss}
                onChange={v=>sf("casualtyLoss",v)}
                hint="IRC § 165(h). Post-TCJA: only losses in a federally declared disaster area. Subject to $100 per-casualty floor and 10% AGI limitation." />
            </div>
          </div>

          {/* Schedule A Summary */}
          <div style={{background:T.bg3,borderRadius:12,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.pr,marginBottom:12}}>Schedule A Summary</div>
            {schedA.medical   > 0 && <DeductRow label="Medical & Dental"   amount={schedA.medical}   irc="§ 213" note={`Gross ${fm(form.medicalDentalGross)} – floor ${fm(schedA.medFloor)}`} />}
            {schedA.salt      > 0 && <DeductRow label="State & Local Taxes (SALT)" amount={schedA.salt} irc="§ 164" note={schedA.saltWasted>0?`Capped at $10,000 (${fm(schedA.saltWasted)} lost)`:undefined} />}
            {schedA.mortgage  > 0 && <DeductRow label="Mortgage Interest"  amount={schedA.mortgage}  irc="§ 163(h)" />}
            {schedA.charitable> 0 && <DeductRow label="Charitable Contributions" amount={schedA.charitable} irc="§ 170" />}
            {schedA.casualty  > 0 && <DeductRow label="Casualty Loss"      amount={schedA.casualty}  irc="§ 165(h)" />}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
                         fontWeight:800,fontSize:15,borderTop:`2px solid ${T.border}`,marginTop:4}}>
              <span style={{color:useItemized?T.gn:T.or}}>Total Itemized {useItemized?"✅ USE THIS":"(standard deduction wins)"}</span>
              <span style={{color:useItemized?T.gn:T.or,fontFamily:"monospace"}}>–{fm(schedA.total)}</span>
            </div>
            <div style={{fontSize:11,color:T.tx3}}>
              vs. Standard Deduction: {fm(stdDeduction)} → {useItemized?`Itemizing saves you ${fm(itemizedBonus)}`:`Standard saves you ${fm(stdDeduction-itemizedTotal)} more`}
            </div>
          </div>
        </div>
      )}

      {/* ════ TAB: SCHEDULE C ════ */}
      {activeTab === "schedC" && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24}}>
          <SectionHeader icon="🏢" title="Schedule C — Business Deductions"
            subtitle="For self-employed, freelancers, 1099 contractors. Reduce Schedule C net profit = reduce SE tax + income tax."
            color={T.or} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <Field l="General Business Expenses / Month" value={form.businessExpenses}
              onChange={v=>sf("businessExpenses",v)}
              hint="IRC § 162. Ordinary and necessary business expenses. Software, subscriptions, professional fees, advertising, bank fees, office supplies, phone/internet (business %). Keep receipts." />
            <Field l="Home Office (sq ft used exclusively for business)" value={form.homeOfficeSqFt}
              onChange={v=>sf("homeOfficeSqFt",v)}
              hint={`IRC § 280A. Simplified method: $5/sq ft × up to 300 sq ft = max $1,500/yr. Must be used regularly and exclusively for business. Your deduction: ${fm(schedC.homeOffice)}.`} />
            <Field l="Business Miles (annual)" value={form.businessMiles}
              onChange={v=>sf("businessMiles",v)}
              hint={`Rev. Proc. 2024-25: $0.70/mile for business (2025). Your deduction: ${fm(schedC.mileage)}. Keep a mileage log — IRS requires contemporaneous records.`} />
            <Field l="Business Meals (total, before 50% limit)" value={form.businessMeals}
              onChange={v=>sf("businessMeals",v)}
              hint={`IRC § 274(n). 50% deductible. Must have business purpose and document: who, where, business discussed. Deductible: ${fm(schedC.meals)}. Entertainment is no longer deductible (TCJA 2017).`} />
            <Field l="Section 179 Asset Expensing (cost of equipment)" value={form.section179}
              onChange={v=>sf("section179",v)}
              hint={`IRC § 179. Immediately expense up to $1,220,000 of qualifying assets (2025). Computers, equipment, furniture. Cannot create a loss (limited to net income). Deductible: ${fm(schedC.s179)}.`} />
            <Field l="Professional Development / Education" value={form.professionalDev}
              onChange={v=>sf("professionalDev",v)}
              hint="IRC § 162. Courses, conferences, books, certifications that maintain or improve current business skills. NOT for education to qualify for a new profession." />
          </div>
          <div style={{background:T.bg3,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.or,marginBottom:12}}>Schedule C Deductions Summary</div>
            {schedC.bizExpenses > 0 && <DeductRow label="Business Expenses (monthly × 12)"   amount={schedC.bizExpenses*12} irc="§ 162" />}
            {schedC.homeOffice  > 0 && <DeductRow label="Home Office (simplified method)"    amount={schedC.homeOffice}    irc="§ 280A" />}
            {schedC.mileage     > 0 && <DeductRow label={`Mileage (${form.businessMiles.toLocaleString("en-US")} mi × $0.70)`} amount={schedC.mileage} irc="§ 162" />}
            {schedC.meals       > 0 && <DeductRow label="Business Meals (50% of total)"     amount={schedC.meals}         irc="§ 274(n)" />}
            {schedC.s179        > 0 && <DeductRow label="Section 179 Expensing"              amount={schedC.s179}          irc="§ 179" />}
            {schedC.profDev     > 0 && <DeductRow label="Professional Development"           amount={schedC.profDev}       irc="§ 162" />}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
                         fontWeight:800,fontSize:15,color:T.or,borderTop:`2px solid ${T.border}`,marginTop:4}}>
              <span>Total Schedule C Deductions</span>
              <span>–{fm(schedC.total)}</span>
            </div>
          </div>
          <InfoBox color={T.or}>
            <strong>🔑 Key Rule (IRC § 162):</strong> Expenses must be "ordinary and necessary." Keep meticulous records — IRS audits Schedule C filers at higher rates.
            <br/><strong>Bonus Depreciation (§ 168(k)):</strong> 40% bonus depreciation in 2025 (phasing down 20%/year from 80% in 2023). For assets not qualifying for § 179.
            <br/><strong>Vehicle Actual vs. Standard Mileage:</strong> If you use actual expenses (gas, insurance, depreciation), you must apply the business-use percentage. Standard mileage ($0.70/mile) is simpler but may be less.
            <br/><strong>Qualified Business Income (§ 199A):</strong> 20% deduction on net business income automatically calculated in your income module.
          </InfoBox>
        </div>
      )}

      {/* ════ TAB: CREDITS ════ */}
      {activeTab === "credits" && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24}}>
          <SectionHeader icon="⚡" title="Tax Credits"
            subtitle="Credits reduce your tax bill dollar-for-dollar — far more valuable than deductions. A $1,000 credit saves $1,000 in tax; a $1,000 deduction saves only $220–$370."
            color={T.gn} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <Field l="Energy-Efficient Home Improvements (total cost)" value={form.energyHomeCredit}
              onChange={v=>sf("energyHomeCredit",v)}
              hint={`IRC § 25C. 30% credit on qualifying improvements (insulation, windows, heat pumps, water heaters). Annual cap: $3,200 ($600 for windows, $2,000 for heat pumps). Credit: ${fm(credits.energy)}.`} />
            <Field l="Solar Panel / Renewable Energy (installation cost)" value={form.solarCredit}
              onChange={v=>sf("solarCredit",v)}
              hint={`IRC § 25D. 30% federal tax credit with no cap through 2032. Includes solar panels, battery storage, solar water heaters. Credit: ${fm(credits.solar)}.`} />
            <Field l="New Electric Vehicle (purchase price)" value={form.evCredit}
              onChange={v=>sf("evCredit",v)}
              hint={`IRC § 30D. Up to $7,500 for qualifying new EVs. Income limits: $150K (single). Vehicle MSRP cap: $55K (cars), $80K (SUVs/trucks). Credit: ${fm(credits.ev)}.`} />
            <Field l="Number of Qualifying Children (under 17)" value={form.childTaxCredit}
              onChange={v=>sf("childTaxCredit",v)} type="number"
              hint={`IRC § 24. $2,000/child under 17. Phases out at $200K AGI (single). Up to $1,700 refundable (Additional Child Tax Credit). Credit: ${fm(credits.child)}.`} />
            <Field l="Child & Dependent Care Credit" value={form.childCareCredit}
              onChange={v=>sf("childCareCredit",v)}
              hint="IRC § 21. 20–35% of qualifying expenses (based on AGI). Up to $3,000 for one child/$6,000 for two+. Enter the credit amount directly (20% of your care expenses if AGI > $43K)." />
          </div>
          <div style={{background:T.bg3,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.gn,marginBottom:12}}>Total Tax Credits (dollar-for-dollar tax reduction)</div>
            {credits.energy > 0 && <DeductRow label="Energy-Efficient Home (§ 25C)" amount={credits.energy} irc="§ 25C" color={T.gn} />}
            {credits.solar  > 0 && <DeductRow label="Solar / Renewable Energy (§ 25D)" amount={credits.solar} irc="§ 25D" color={T.gn} />}
            {credits.ev     > 0 && <DeductRow label="Electric Vehicle Credit (§ 30D)" amount={credits.ev} irc="§ 30D" color={T.gn} />}
            {credits.child  > 0 && <DeductRow label={`Child Tax Credit (${form.childTaxCredit} children × $2,000)`} amount={credits.child} irc="§ 24" color={T.gn} />}
            {credits.care   > 0 && <DeductRow label="Child & Dependent Care" amount={credits.care} irc="§ 21" color={T.gn} />}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
                         fontWeight:800,fontSize:15,color:T.gn,borderTop:`2px solid ${T.border}`,marginTop:4}}>
              <span>Total Credits (direct tax reduction)</span>
              <span>–{fm(credits.total)}</span>
            </div>
          </div>
          <InfoBox color={T.gn}>
            <strong>Other credits to explore with your CPA:</strong><br/>
            • <strong>Earned Income Tax Credit (EITC)</strong> — § 32, refundable, up to $7,830 (2025) for low-to-moderate income<br/>
            • <strong>American Opportunity Credit</strong> — § 25A, up to $2,500/student for first 4 years college<br/>
            • <strong>Lifetime Learning Credit</strong> — § 25A, up to $2,000 for any higher education<br/>
            • <strong>Retirement Savings Credit (Saver's Credit)</strong> — § 25B, up to $1,000 if AGI &lt; $38,250 (single 2025)<br/>
            • <strong>Premium Tax Credit</strong> — § 36B, for ACA marketplace health insurance
          </InfoBox>
        </div>
      )}

      {/* ════ TAB: SUMMARY ════ */}
      {activeTab === "summary" && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24}}>
          <SectionHeader icon="📊" title="Complete Tax Reduction Summary"
            subtitle="All deductions and credits combined" color={T.tx2} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[
              {l:"Gross AGI",           v:fm(agi),                    c:T.tx2},
              {l:"Above-the-Line",      v:`–${fm(aboveLine.total)}`,  c:T.cy},
              {l:"Schedule C (Biz)",    v:`–${fm(schedC.total)}`,     c:T.or},
              {l:"Adjusted AGI",        v:fm(schedA.adjustedAGI),     c:T.tx2},
              {l:useItemized?"Itemized (Sch. A)":"Standard Deduction", v:`–${fm(deductionBenefit)}`, c:T.pr},
              {l:"Taxable Income",      v:fm(taxableIncome),           c:T.or},
              {l:"Estimated Fed. Tax",  v:fm(estFedTax+credits.total), c:T.rd},
              {l:"Tax Credits",         v:`–${fm(credits.total)}`,     c:T.gn},
              {l:"Net Tax Owed",        v:fm(Math.max(0,estFedTax)),   c:T.rd},
              {l:"Marginal Rate",       v:pct(marginalRate),            c:T.or},
              {l:"Effective Rate",      v:agi>0?pct((Math.max(0,estFedTax))/agi):"0%", c:T.tx2},
              {l:"Total Deductions",    v:fm(aboveLine.total+schedC.total+deductionBenefit), c:T.gn},
            ].map(k=>(
              <div key={k.l} style={{background:T.bg3,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
                <div style={{fontSize:16,fontWeight:700,color:k.c,marginTop:4,fontFamily:"monospace"}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Waterfall */}
          <div style={{background:T.bg3,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.tx2,marginBottom:12}}>Deduction Waterfall</div>
            {[
              {l:"Gross AGI",                v:agi,                        c:T.tx2},
              {l:"Above-the-line deductions",v:aboveLine.total,            c:T.cy,  minus:true},
              {l:"Schedule C deductions",    v:schedC.total,               c:T.or,  minus:true},
              {l:useItemized?"Schedule A itemized":"Standard deduction", v:deductionBenefit, c:T.pr, minus:true},
              {l:"= Taxable Income",         v:taxableIncome,              c:T.or,  bold:true},
              {l:"Federal Tax (before credits)", v:estFedTax+credits.total,c:T.rd},
              {l:"Tax Credits",              v:credits.total,              c:T.gn,  minus:true},
              {l:"= Net Federal Tax",        v:Math.max(0,estFedTax),      c:T.rd,  bold:true},
            ].filter(r=>r.v>0||r.bold).map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                                   padding:"8px 0",borderBottom:`1px solid ${T.border}`,
                                   fontWeight:r.bold?800:400}}>
                <span style={{fontSize:12,color:r.c||T.tx2}}>{r.minus?"  ↳ ":""}{r.l}</span>
                <span style={{fontSize:13,fontFamily:"monospace",color:r.c||T.tx2}}>
                  {r.minus?`–${fm(r.v)}`:fm(r.v)}
                </span>
              </div>
            ))}
          </div>

          <InfoBox color={T.gn}>
            <strong>CPA Final Checklist:</strong><br/>
            {aboveLine.total > 0 ? "✅" : "⚠"} Above-the-line: {aboveLine.total > 0 ? fm(aboveLine.total)+" maximized" : "Review HSA, IRA, SE deductions"}<br/>
            {useItemized ? "✅" : "ℹ️"} {useItemized ? `Itemizing: saving ${fm(itemizedBonus)} over standard` : `Standard deduction wins. Bunching strategy may help.`}<br/>
            {schedC.total > 0 ? "✅" : "ℹ️"} Schedule C: {schedC.total > 0 ? fm(schedC.total)+" in business deductions" : "No business deductions entered"}<br/>
            {credits.total > 0 ? "✅" : "ℹ️"} Credits: {credits.total > 0 ? fm(credits.total)+" direct tax reduction" : "Review energy, EV, child credits"}<br/>
            <br/><em>Disclaimer: This is an estimate for planning purposes only. State taxes not included. Consult a CPA or EA for your official return.</em>
          </InfoBox>
        </div>
      )}
    
    <Disclaimer variante="fiscal" idioma="en" T={T} compacto />
  </div>
  );
}
