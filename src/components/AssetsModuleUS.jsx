/**
 * AssetsModuleUS.jsx
 * CPA + Wealth Advisor Grade — Assets & Liabilities
 *
 * Asset classes covered:
 *   Real Estate        IRC §§ 121, 168, 469, 1031, 1250, 1400Z
 *   Equities/ETFs      IRC §§ 1221, 1222, 1091 (wash sale), 1202 (QSBS)
 *   Retirement Accts   IRC §§ 401, 408, 408A, 223, 401(a)(9) RMDs
 *   Crypto/Digital     IRS Notice 2014-21, Rev. Rul. 2023-14
 *   Business Interests IRC §§ 702, 1014, 1202 (QSBS), 338(h)(10)
 *
 * Liabilities covered:
 *   Mortgage           IRC § 163(h), §1014 step-up in basis
 *   HELOC              IRC § 163(h)(3) — only if used for home improvement
 *   Student Loans      IRC § 221 phase-out
 *   Investment Margin  IRC § 163(d) — investment interest expense
 *   Business Debt      IRC § 162 — fully deductible
 *   Auto / Personal    Not deductible
 *
 * Tax Year 2025
 */

import { useState, useMemo } from "react";
import { US } from "../lib/jurisdictions/US.js";

// ─── Constants ───────────────────────────────────────────────────────────────
const C = {
  // Real estate
  PRIMARY_EXCLUSION_SINGLE:  250000,   // IRC § 121
  PRIMARY_EXCLUSION_MFJ:     500000,
  DEPRECIATION_RESIDENTIAL:  27.5,     // years — IRC § 168
  DEPRECIATION_COMMERCIAL:   39,
  RECAPTURE_RATE:            0.25,     // § 1250 unrecaptured depreciation
  // Equities
  WASH_SALE_DAYS:            30,       // IRC § 1091 — 30 days before/after
  QSBS_EXCLUSION:            0.00,     // § 1202: 100% exclusion up to $10M
  NIIT_THRESHOLD_SINGLE:     200000,   // § 1411
  NIIT_RATE:                 0.038,
  // Crypto
  CRYPTO_FIFO:               "fifo",
  // RMD ages
  RMD_START_AGE:             73,       // SECURE 2.0
  // LTCG rates 2025 (single)
  LTCG_0_MAX:                47025,
  LTCG_15_MAX:               518900,
};

// ─── Asset Types ──────────────────────────────────────────────────────────────
const ASSET_TYPES = [
  // Real Estate
  {v:"primary_home",   l:"🏠 Primary Residence",      cat:"real_estate",
   irc:"IRC § 121",    form:"Schedule D",
   desc:"Your main home. Eligible for gain exclusion on sale.",
   taxNote:"Up to $250K gain excluded (single) / $500K (MFJ) if owned & used 2 of last 5 years.",
   planning:"Track cost basis (purchase price + improvements). Keep records of all capital improvements — they increase basis. Consider exclusion timing strategy if married.",
   deprec:false},
  {v:"rental_res",     l:"🏘️ Rental Property (Residential)", cat:"real_estate",
   irc:"IRC §§ 168, 469, 1031", form:"Schedule E",
   desc:"Residential rental property. Depreciate over 27.5 years.",
   taxNote:"Net rental income taxed as ordinary. Passive activity limits apply (§ 469). Depreciation deduction reduces taxable income annually.",
   planning:"Cost segregation study for accelerated depreciation. 1031 exchange to defer capital gains on sale. Real Estate Professional status (750+ hrs/yr) removes passive limits.",
   deprec:true, deprecYears:27.5},
  {v:"rental_com",     l:"🏢 Commercial Property",    cat:"real_estate",
   irc:"IRC §§ 168, 1031, 1250", form:"Schedule E",
   desc:"Commercial real estate. Depreciate over 39 years.",
   taxNote:"Depreciation over 39 years. Unrecaptured § 1250 gain taxed at max 25% on sale. 1031 exchange available.",
   planning:"Triple-net (NNN) leases reduce management burden. Delaware Statutory Trust (DST) for passive 1031 replacement property. QOZ for gain deferral.",
   deprec:true, deprecYears:39},
  {v:"land",           l:"🌿 Raw Land / Lot",          cat:"real_estate",
   irc:"IRC §§ 1221, 1231", form:"Schedule D",
   desc:"Land held for investment. No depreciation allowed.",
   taxNote:"Long-term capital gain rates if held 12+ months. No depreciation. IRC § 1231 asset if held in trade/business.",
   planning:"Opportunity Zone investment for gain deferral/exclusion. Installment sale to spread gain over multiple years.",
   deprec:false},

  // Equities
  {v:"stocks_etf",     l:"📈 Stocks / ETFs",           cat:"equity",
   irc:"IRC §§ 1221, 1222, 1091", form:"Schedule D / Form 8949",
   desc:"Individual stocks, ETFs, mutual funds in taxable accounts.",
   taxNote:"LTCG rates (0/15/20%) if held 12+ months. STCG as ordinary income. Each lot has its own holding period and basis.",
   planning:"Tax-loss harvesting — offset gains with losses (watch 30-day wash sale rule). Specific ID cost basis (highest cost first to minimize gains). Hold 12+ months for preferential rates. Donate appreciated shares to charity.",
   deprec:false},
  {v:"qsbs",           l:"🚀 QSBS (Startup Equity)",   cat:"equity",
   irc:"IRC § 1202",  form:"Schedule D",
   desc:"Qualified Small Business Stock. Up to 100% gain exclusion.",
   taxNote:"100% of gain excluded from federal tax (up to $10M or 10× basis) if acquired after 9/27/2010, held 5+ years, C-Corp with ≤ $50M assets at issuance.",
   planning:"Confirm QSBS eligibility before sale. Consider rolling gain into new QSBS (§ 1045 rollover within 60 days). State tax may still apply (CA does not conform).",
   deprec:false},
  {v:"crypto",         l:"₿ Cryptocurrency",            cat:"crypto",
   irc:"Notice 2014-21, Rev. Rul. 2023-14", form:"Form 8949",
   desc:"Bitcoin, Ethereum, and other digital assets treated as property.",
   taxNote:"Every sale, exchange, or use to buy goods is a taxable event. LTCG if held 12+ months. Staking/mining rewards: ordinary income at FMV when received.",
   planning:"FIFO vs Specific ID for cost basis — specific ID often reduces gains. Track every transaction. DeFi/staking creates ordinary income. Consider tax-loss harvesting in down markets.",
   deprec:false},

  // Retirement
  {v:"401k_trad",      l:"🏛️ Traditional 401(k)",       cat:"retirement",
   irc:"IRC § 401(k)", form:"Form 1099-R on distribution",
   desc:"Employer-sponsored pre-tax retirement plan.",
   taxNote:"Contributions pre-tax. Growth tax-deferred. Distributions taxed as ordinary income. 10% penalty if withdrawn before 59½ (exceptions exist). RMDs at age 73.",
   planning:"Maximize contributions ($23,500 in 2025; $31,000 if 50+). Mega backdoor Roth if plan allows after-tax contributions. Roth conversions in low-income years.",
   deprec:false},
  {v:"roth_ira",       l:"💚 Roth IRA / Roth 401(k)",   cat:"retirement",
   irc:"IRC § 408A",   form:"Form 5498",
   desc:"After-tax retirement account. Tax-free growth and withdrawals.",
   taxNote:"Contributions are after-tax (not deductible). Qualified distributions are completely tax-free. No RMDs for Roth IRA. Roth 401(k) has RMDs (roll to Roth IRA to avoid).",
   planning:"Backdoor Roth IRA if income too high for direct contribution ($161K–$176K single for 2025). Roth conversions in low-income years. Best account for high-growth assets.",
   deprec:false},
  {v:"hsa",            l:"🏥 Health Savings Account",    cat:"retirement",
   irc:"IRC § 223",    form:"Form 8889",
   desc:"Triple tax-advantaged account for medical expenses.",
   taxNote:"Contributions deductible. Growth tax-free. Qualified medical withdrawals tax-free. After 65: non-medical withdrawals taxed as ordinary income (no penalty).",
   planning:"Max HSA ($4,150 individual / $8,300 family 2025). Invest for long-term growth — pay medical expenses out-of-pocket and reimburse yourself later. Effectively a stealth IRA.",
   deprec:false},

  // Business
  {v:"business",       l:"🏢 Business Interest",         cat:"business",
   irc:"IRC §§ 702, 1014, 1202", form:"Schedule K-1",
   desc:"Ownership in LLC, S-Corp, C-Corp, or partnership.",
   taxNote:"Pass-through: income/loss flows to personal return. C-Corp: double taxation on dividends. QSBS exclusion for qualifying C-Corp shares.",
   planning:"S-Corp salary vs. distributions planning to minimize SE tax. § 199A QBI deduction (up to 20%). Estate planning with step-up in basis (§ 1014).",
   deprec:false},

  // Other
  {v:"cash_equiv",     l:"💵 Cash / Money Market",       cat:"cash",
   irc:"IRC § 61(a)(4)", form:"1099-INT",
   desc:"Savings accounts, CDs, money market funds, T-bills.",
   taxNote:"Interest taxed as ordinary income. Treasury/US Govt interest is state-exempt. Municipal bond interest is federal-exempt.",
   planning:"High-Yield Savings or T-bills for short-term. I-Bonds for inflation hedge (defer tax up to 30 years). Consider tax-exempt municipal bonds if in 24%+ bracket.",
   deprec:false},
  {v:"other_asset",    l:"📦 Other Asset",               cat:"other",
   irc:"IRC § 1221",   form:"Schedule D",
   desc:"Collectibles, vehicles, other personal property.",
   taxNote:"Collectibles: max 28% LTCG rate (coins, art, wine, antiques). Vehicles depreciate — not an investment. Personal property losses are non-deductible.",
   planning:"Collectibles are taxed at max 28% even if in lower bracket. Document provenance and insurance appraisals for estate purposes.",
   deprec:false},
];

const LIAB_TYPES = [
  {v:"mortgage",       l:"🏠 Mortgage (Primary/Secondary)", deductible:true,
   irc:"IRC § 163(h)", note:"Interest deductible on first $750K of acquisition debt (post-12/15/2017 loans). Deduct via Schedule A if itemizing."},
  {v:"heloc",          l:"🔧 HELOC / Home Equity Loan",     deductible:"conditional",
   irc:"IRC § 163(h)(3)", note:"ONLY deductible if funds used to buy, build, or substantially improve the home. NOT deductible for debt consolidation, cars, or personal expenses."},
  {v:"student_loan",   l:"🎓 Student Loan",                 deductible:true,
   irc:"IRC § 221",    note:"Up to $2,500/yr above-the-line deduction. Phases out $75K–$90K AGI (single). No deduction if claimed as dependent or MFS."},
  {v:"investment_margin",l:"📈 Investment Margin Loan",     deductible:true,
   irc:"IRC § 163(d)", note:"Investment interest expense deductible up to net investment income. Excess carries forward. File Form 4952. NOT deductible against LTCG/qualified dividends."},
  {v:"business_loan",  l:"🏢 Business Loan",               deductible:true,
   irc:"IRC § 163(j)", note:"Business interest generally deductible (subject to § 163(j) 30% ATI limitation for large businesses). Deduct on Schedule C."},
  {v:"auto",           l:"🚗 Auto Loan",                    deductible:false,
   irc:"IRC § 163(h)(2)(A)", note:"Personal auto loan interest is NOT deductible. Business use portion deductible via actual expense method or mileage on Schedule C."},
  {v:"credit_card",    l:"💳 Credit Card",                  deductible:false,
   irc:"IRC § 163(h)(2)(A)", note:"Consumer/personal credit card interest is NOT deductible (since 1986 Tax Reform Act). Business credit card interest deductible on Schedule C."},
  {v:"other_debt",     l:"📋 Other Personal Debt",          deductible:false,
   irc:"IRC § 163(h)",       note:"Personal interest is not deductible."},
];

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:"#09090b", bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)", borderL:"rgba(255,255,255,0.1)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444", rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6", pr:"#a78bfa", or:"#f59e0b", cy:"#06b6d4",
  ch:["#22c55e","#3b82f6","#f97316","#a78bfa","#ec4899","#06b6d4","#eab308"],
};
const fm  = (n) => `$${Math.round(n||0).toLocaleString("en-US")}`;
const pct = (n) => `${((n||0)*100).toFixed(1)}%`;

// ─── Sub-components ───────────────────────────────────────────────────────────
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
const Pill = ({color,children}) => (
  <span style={{background:`${color}20`,color,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,marginLeft:4}}>{children}</span>
);

// ─── Depreciation Calculator ──────────────────────────────────────────────────
function calcDepreciation(costBasis, land, years) {
  const depreciableBasis = Math.max(0, costBasis - land);
  const annualDeprec     = depreciableBasis / years;
  return { annualDeprec, depreciableBasis };
}

// ─── Asset Detail Panel ───────────────────────────────────────────────────────
function AssetDetail({ asset }) {
  const info = ASSET_TYPES.find(t => t.v === asset.tp) || ASSET_TYPES[0];
  const gain = (asset.va || 0) - (asset.vc || 0);
  const gainPct = asset.vc > 0 ? gain / asset.vc : 0;

  const deprec = info.deprec
    ? calcDepreciation(asset.vc || 0, asset.landValue || 0, info.deprecYears)
    : null;

  const totalDeprec = deprec
    ? deprec.annualDeprec * (asset.yearsHeld || 0)
    : 0;

  // Net gain after depreciation recapture estimate
  const recaptureGain    = Math.min(totalDeprec, gain);
  const preferentialGain = Math.max(0, gain - recaptureGain);

  // § 121 exclusion for primary residence
  const exclusion121 = asset.tp === "primary_home"
    ? Math.min(gain, asset.filingStatus === "mfj" ? C.PRIMARY_EXCLUSION_MFJ : C.PRIMARY_EXCLUSION_SINGLE)
    : 0;

  // NIIT
  const niit = gain > 0 && (asset.magi || 0) > C.NIIT_THRESHOLD_SINGLE
    ? Math.round(Math.min(gain, (asset.magi || 0) - C.NIIT_THRESHOLD_SINGLE) * C.NIIT_RATE)
    : 0;

  return (
    <div style={{borderTop:`1px solid ${T.border}`,padding:"16px 18px",background:T.bg2}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:T.pr,marginBottom:6}}>📖 IRS Tax Treatment</div>
          <div style={{fontSize:11,color:T.tx2,lineHeight:1.7}}>{info.taxNote}</div>
          <div style={{fontSize:10,color:T.tx3,marginTop:4}}>Ref: <em>{info.irc}</em> | Form: <em>{info.form}</em></div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:T.gn,marginBottom:6}}>💡 Planning Opportunities</div>
          <div style={{fontSize:11,color:T.tx2,lineHeight:1.7}}>{info.planning}</div>
        </div>
      </div>

      {/* Gain analysis */}
      {gain !== 0 && (
        <div style={{background:T.bg3,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:10}}>📊 Gain / Loss Analysis</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
            <div><div style={{fontSize:9,color:T.tx3}}>COST BASIS</div><div style={{fontSize:14,fontWeight:700,color:T.tx2}}>{fm(asset.vc||0)}</div></div>
            <div><div style={{fontSize:9,color:T.tx3}}>CURRENT VALUE</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>{fm(asset.va||0)}</div></div>
            <div><div style={{fontSize:9,color:T.tx3}}>UNREALIZED GAIN</div><div style={{fontSize:14,fontWeight:700,color:gain>=0?T.gn:T.rd}}>{fm(gain)}</div></div>
            {totalDeprec > 0 && <div><div style={{fontSize:9,color:T.tx3}}>DEPREC. TAKEN</div><div style={{fontSize:14,fontWeight:700,color:T.or}}>{fm(totalDeprec)}</div></div>}
            {exclusion121 > 0 && <div><div style={{fontSize:9,color:T.tx3}}>§121 EXCLUSION</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>{fm(exclusion121)}</div></div>}
            {niit > 0 && <div><div style={{fontSize:9,color:T.rd}}>NIIT (3.8%)</div><div style={{fontSize:14,fontWeight:700,color:T.rd}}>{fm(niit)}</div></div>}
          </div>

          {info.deprec && totalDeprec > 0 && gain > 0 && (
            <InfoBox color={T.or}>
              <strong>⚠ § 1250 Unrecaptured Depreciation:</strong> {fm(recaptureGain)} of your gain is taxed at max 25% (unrecaptured § 1250 gain).
              The remaining {fm(preferentialGain)} qualifies for preferential LTCG rates (0/15/20%).
              Consider § 1031 exchange to defer BOTH the recapture AND the capital gain.
            </InfoBox>
          )}
          {exclusion121 > 0 && (
            <InfoBox color={T.gn}>
              <strong>✅ § 121 Exclusion:</strong> Up to {fm(exclusion121)} of gain is excluded from tax.
              {gain > exclusion121 ? ` Taxable gain: ${fm(gain - exclusion121)}.` : " Entire gain is excluded."}
              Requirements: owned and used as primary residence for 2 of last 5 years.
            </InfoBox>
          )}
        </div>
      )}

      {/* Depreciation schedule for rental */}
      {info.deprec && deprec && (
        <div style={{background:T.bg3,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:T.cy,marginBottom:10}}>📅 Depreciation Schedule (IRC § 168)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
            <div><div style={{fontSize:9,color:T.tx3}}>DEPRECIABLE BASIS</div><div style={{fontSize:14,fontWeight:700,color:T.cy}}>{fm(deprec.depreciableBasis)}</div><div style={{fontSize:9,color:T.tx3}}>building value (excl. land)</div></div>
            <div><div style={{fontSize:9,color:T.tx3}}>ANNUAL DEDUCTION</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>{fm(deprec.annualDeprec)}/yr</div><div style={{fontSize:9,color:T.tx3}}>{info.deprecYears} yr straight-line</div></div>
            <div><div style={{fontSize:9,color:T.tx3}}>MONTHLY DEDUCTION</div><div style={{fontSize:14,fontWeight:700,color:T.gn}}>{fm(deprec.annualDeprec/12)}/mo</div></div>
            {asset.yearsHeld > 0 && <div><div style={{fontSize:9,color:T.tx3}}>TOTAL DEPREC. TAKEN</div><div style={{fontSize:14,fontWeight:700,color:T.or}}>{fm(totalDeprec)}</div><div style={{fontSize:9,color:T.tx3}}>({asset.yearsHeld} years)</div></div>}
          </div>
          <InfoBox color={T.cy}>
            <strong>Cost Segregation Study:</strong> Reclassify components to 5/7/15-year property for accelerated depreciation.
            Typical result: 20–40% of building cost accelerated to Year 1 via bonus depreciation (40% in 2025).
            Best for properties valued above $1M — ROI is typically 10×–20× the study cost.
          </InfoBox>
        </div>
      )}

      {/* Crypto specific */}
      {asset.tp === "crypto" && (
        <InfoBox color={T.or}>
          <strong>🔑 Crypto Tax Rules (IRS Notice 2014-21):</strong><br/>
          • Every sale, swap, or use to purchase is a taxable event (report on Form 8949)<br/>
          • Staking/mining rewards: ordinary income at FMV when received, then new basis<br/>
          • Hard forks & airdrops: ordinary income at FMV on receipt (Rev. Rul. 2023-14)<br/>
          • DeFi: every swap is a taxable event — track each transaction<br/>
          • Cost basis methods: FIFO (default), HIFO (highest cost = lowest gain), Specific ID<br/>
          • Consider tax-loss harvesting — crypto has no wash sale rule (currently; legislation pending)
        </InfoBox>
      )}

      {/* QSBS */}
      {asset.tp === "qsbs" && (
        <InfoBox color={T.gn}>
          <strong>✅ QSBS § 1202 Checklist:</strong><br/>
          • Acquired from original issuance (not secondary market)<br/>
          • Held for 5+ years (clock starts at acquisition)<br/>
          • C-Corporation (not S-Corp, LLC, or partnership)<br/>
          • Company had &lt; $50M in assets at issuance<br/>
          • Active business in qualifying industry (no professional services, hotels, finance)<br/>
          • Exclusion: 100% of gain up to $10M or 10× basis (federal only — California does NOT conform)
        </InfoBox>
      )}
    </div>
  );
}

// ─── Empty Form ───────────────────────────────────────────────────────────────
const EMPTY_ASSET = {
  n:"", tp:"stocks_etf", vc:0, va:0, landValue:0, yearsHeld:0,
  monthlyIncome:0, filingStatus:"single", magi:0, notes:"",
};
const EMPTY_LIAB = {
  n:"", tp:"mortgage", mt:0, pg:0, ts:0, notes:"",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetsModuleUS({ inversiones = [], deudas = [], onUpdateAssets, onUpdateLiabs }) {
  const [tab,       setTab]       = useState("assets");
  const [showForm,  setShowForm]  = useState(null); // "asset" | "liab" | null
  const [form,      setForm]      = useState(EMPTY_ASSET);
  const [formL,     setFormL]     = useState(EMPTY_LIAB);
  const [editing,   setEditing]   = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  const sf  = (k,v) => setForm(p=>({...p,[k]:parseFloat(v)||0}));
  const sfS = (k,v) => setForm(p=>({...p,[k]:v}));
  const sfL = (k,v) => setFormL(p=>({...p,[k]:typeof v==="string"?v:parseFloat(v)||0}));

  const assetInfo = (v) => ASSET_TYPES.find(t=>t.v===v)||ASSET_TYPES[0];
  const liabInfo  = (v) => LIAB_TYPES.find(t=>t.v===v)||LIAB_TYPES[0];

  // ── Asset Totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byCategory = {};
    let totalValue=0, totalBasis=0, totalGain=0, annualIncome=0, totalDeprec=0;
    inversiones.forEach(a => {
      const info = assetInfo(a.tp);
      const va = a.va||0, vc = a.vc||0;
      totalValue  += va; totalBasis += vc;
      totalGain   += va - vc;
      annualIncome+= (a.monthlyIncome||0)*12;
      const cat = info.cat || "other";
      byCategory[cat] = (byCategory[cat]||0) + va;
      if(info.deprec) {
        const d = calcDepreciation(vc, a.landValue||0, info.deprecYears);
        totalDeprec += d.annualDeprec * (a.yearsHeld||0);
      }
    });
    const gainPct = totalBasis > 0 ? totalGain/totalBasis : 0;
    return { totalValue, totalBasis, totalGain, gainPct, annualIncome, byCategory, totalDeprec };
  }, [inversiones]);

  // ── Liability Totals ────────────────────────────────────────────────────
  const liabTotals = useMemo(() => {
    let total=0, deductible=0, monthlyPayments=0;
    deudas.forEach(d => {
      const info = liabInfo(d.tp);
      total += d.mt||0;
      monthlyPayments += d.pg||0;
      if(info.deductible === true) deductible += d.mt||0;
    });
    return { total, deductible, monthlyPayments, netWorth: totals.totalValue - total };
  }, [deudas, totals.totalValue]);

  const saveAsset = () => {
    const list = editing!==null
      ? inversiones.map((x,i)=>i===editing?{...form}:x)
      : [...inversiones,{...form}];
    onUpdateAssets(list);
    setShowForm(null); setEditing(null); setForm(EMPTY_ASSET);
  };
  const saveLiab = () => {
    const list = editing!==null
      ? deudas.map((x,i)=>i===editing?{...formL}:x)
      : [...deudas,{...formL}];
    onUpdateLiabs(list);
    setShowForm(null); setEditing(null); setFormL(EMPTY_LIAB);
  };
  const removeAsset = (i) => { if(confirm("Remove this asset?")) onUpdateAssets(inversiones.filter((_,j)=>j!==i)); };
  const removeLiab  = (i) => { if(confirm("Remove this liability?")) onUpdateLiabs(deudas.filter((_,j)=>j!==i)); };

  const selType = assetInfo(form.tp);
  const CAT_COLORS = {real_estate:T.or, equity:T.gn, crypto:T.cy, retirement:T.pr, business:T.bl, cash:T.tx2, other:T.tx3};
  const CAT_LABELS = {real_estate:"Real Estate", equity:"Equities", crypto:"Crypto", retirement:"Retirement", business:"Business", cash:"Cash", other:"Other"};

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🏦 Assets & Liabilities</h2>
          <p style={{color:T.tx3,fontSize:12,margin:0}}>Net Worth · Cost Basis · Depreciation · Tax Planning — 2025</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setForm(EMPTY_ASSET);setEditing(null);setShowForm("asset")}}
            style={{background:`linear-gradient(135deg,${T.gn},#16a34a)`,color:"#000",border:"none",padding:"10px 18px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>
            + Add Asset
          </button>
          <button onClick={()=>{setFormL(EMPTY_LIAB);setEditing(null);setShowForm("liab")}}
            style={{background:T.bg3,color:T.tx2,border:`1px solid ${T.border}`,padding:"10px 18px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13}}>
            + Add Liability
          </button>
        </div>
      </div>

      {/* Net Worth Hero */}
      <div style={{background:`radial-gradient(ellipse at 20% 0%,rgba(34,197,94,.06),transparent 60%)`,border:`1px solid ${T.border}`,borderRadius:16,padding:24,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
          {[
            {l:"Total Assets",     v:fm(totals.totalValue),   c:T.gn},
            {l:"Total Liabilities",v:fm(liabTotals.total),    c:T.rd},
            {l:"Net Worth",        v:fm(liabTotals.netWorth),  c:liabTotals.netWorth>=0?T.gn:T.rd},
            {l:"Unrealized Gain",  v:fm(totals.totalGain),     c:totals.totalGain>=0?T.gn:T.rd},
            {l:"Annual Income",    v:fm(totals.annualIncome),  c:T.cy},
            {l:"Debt/Asset Ratio", v:totals.totalValue>0?pct(liabTotals.total/totals.totalValue):"0%",
             c:totals.totalValue>0&&liabTotals.total/totals.totalValue<0.3?T.gn:T.or},
          ].map(k=>(
            <div key={k.l} style={{textAlign:"center"}}>
              <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:800,color:k.c,marginTop:4,fontFamily:"monospace"}}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      {inversiones.length > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx3,marginBottom:10}}>ALLOCATION BY CATEGORY</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {Object.entries(totals.byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>{
              const pct_ = totals.totalValue>0?(val/totals.totalValue*100):0;
              const color = CAT_COLORS[cat]||T.tx3;
              return(
                <div key={cat} style={{flex:1,minWidth:120}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{color}}>{CAT_LABELS[cat]||cat}</span>
                    <span style={{color:T.tx3}}>{pct_.toFixed(0)}%</span>
                  </div>
                  <div style={{height:6,background:T.bg3,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct_+"%",background:color,borderRadius:3}}/>
                  </div>
                  <div style={{fontSize:10,color:T.tx3,marginTop:2}}>{fm(val)}</div>
                </div>
              );
            })}
          </div>
          {/* Concentration warning */}
          {(() => {
            const max = Object.entries(totals.byCategory).sort((a,b)=>b[1]-a[1])[0];
            if(max && totals.totalValue>0 && max[1]/totals.totalValue > 0.50) return(
              <InfoBox color={T.or}>
                <strong>⚠ Concentration Risk:</strong> {CAT_LABELS[max[0]]||max[0]} represents {(max[1]/totals.totalValue*100).toFixed(0)}% of your portfolio.
                A diversified wealth plan targets no single asset class above 40–50%.
                Consider rebalancing via tax-efficient strategies (§ 1031 exchange for real estate, tax-loss harvesting for equities).
              </InfoBox>
            );
            return null;
          })()}
        </div>
      )}

      {/* Tab toggle */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:T.bg3,borderRadius:10,padding:3}}>
        {[{id:"assets",l:`Assets (${inversiones.length})`},{id:"liabilities",l:`Liabilities (${deudas.length})`}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
                    background:tab===t.id?T.card:"transparent",color:tab===t.id?T.tx:T.tx3}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════ ASSETS ════ */}
      {tab === "assets" && (
        inversiones.length === 0
          ? <div style={{padding:48,textAlign:"center",color:T.tx3,background:T.card,border:`1px solid ${T.border}`,borderRadius:16}}>
              <div style={{fontSize:36,marginBottom:12}}>🏦</div>
              <div style={{fontSize:15,fontWeight:700,color:T.tx2,marginBottom:6}}>No assets yet</div>
              <div style={{fontSize:13,marginBottom:20}}>Add real estate, stocks, retirement accounts, crypto, and other assets with full IRS tax analysis.</div>
              <button onClick={()=>{setForm(EMPTY_ASSET);setShowForm("asset")}} style={{background:T.gn,color:"#000",border:"none",padding:"12px 28px",borderRadius:10,cursor:"pointer",fontWeight:700}}>+ Add First Asset</button>
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {inversiones.map((asset,idx)=>{
                const info = assetInfo(asset.tp);
                const gain = (asset.va||0)-(asset.vc||0);
                const open = expanded===`a${idx}`;
                const color = CAT_COLORS[info.cat]||T.tx3;
                return(
                  <div key={idx} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",cursor:"pointer"}}
                         onClick={()=>setExpanded(open?null:`a${idx}`)}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:14,fontWeight:700}}>{asset.n||info.l}</span>
                          <span style={{fontSize:10,background:`${color}20`,color,padding:"2px 8px",borderRadius:99,fontWeight:600}}>{CAT_LABELS[info.cat]||info.cat}</span>
                          <span style={{fontSize:10,color:T.tx3}}>{info.form}</span>
                        </div>
                        <div style={{fontSize:11,color:T.tx3,marginTop:2}}>{info.l}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:16,fontWeight:800,color:T.gn,fontFamily:"monospace"}}>{fm(asset.va||0)}</div>
                        <div style={{fontSize:11,color:gain>=0?T.gn:T.rd,fontFamily:"monospace"}}>{gain>=0?"+":""}{fm(gain)}</div>
                      </div>
                      <div style={{color:T.tx3,fontSize:12}}>{open?"▲":"▼"}</div>
                    </div>
                    {open && (
                      <>
                        <AssetDetail asset={asset}/>
                        <div style={{padding:"12px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                          <button onClick={()=>{setForm({...EMPTY_ASSET,...asset});setEditing(idx);setShowForm("asset")}}
                            style={{padding:"8px 16px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,color:T.tx2,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                          <button onClick={()=>removeAsset(idx)}
                            style={{padding:"8px 16px",background:T.rdB,border:"none",borderRadius:8,color:T.rd,cursor:"pointer",fontSize:12,fontWeight:600}}>🗑️ Remove</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* ════ LIABILITIES ════ */}
      {tab === "liabilities" && (
        deudas.length === 0
          ? <div style={{padding:48,textAlign:"center",color:T.tx3,background:T.card,border:`1px solid ${T.border}`,borderRadius:16}}>
              <div style={{fontSize:36,marginBottom:12}}>📋</div>
              <div style={{fontSize:15,fontWeight:700,color:T.tx2,marginBottom:6}}>No liabilities yet</div>
              <button onClick={()=>{setFormL(EMPTY_LIAB);setShowForm("liab")}} style={{background:T.gn,color:"#000",border:"none",padding:"12px 28px",borderRadius:10,cursor:"pointer",fontWeight:700}}>+ Add First Liability</button>
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {deudas.map((liab,idx)=>{
                const info = liabInfo(liab.tp);
                const open = expanded===`l${idx}`;
                return(
                  <div key={idx} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",cursor:"pointer"}}
                         onClick={()=>setExpanded(open?null:`l${idx}`)}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:14,fontWeight:700}}>{liab.n||info.l}</span>
                          {info.deductible===true && <Pill color={T.gn}>DEDUCTIBLE</Pill>}
                          {info.deductible==="conditional" && <Pill color={T.or}>COND. DEDUCTIBLE</Pill>}
                          {info.deductible===false && <Pill color={T.tx3}>NON-DEDUCTIBLE</Pill>}
                        </div>
                        <div style={{fontSize:11,color:T.tx3,marginTop:2}}>{info.l} · {liab.ts||0}% interest</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:16,fontWeight:800,color:T.rd,fontFamily:"monospace"}}>{fm(liab.mt||0)}</div>
                        <div style={{fontSize:11,color:T.tx3}}>{fm(liab.pg||0)}/mo payment</div>
                      </div>
                      <div style={{color:T.tx3,fontSize:12}}>{open?"▲":"▼"}</div>
                    </div>
                    {open && (
                      <div style={{borderTop:`1px solid ${T.border}`,padding:"16px 18px",background:T.bg2}}>
                        <div style={{fontSize:11,color:T.tx2,lineHeight:1.7,marginBottom:12}}>
                          <strong style={{color:info.deductible?T.gn:T.or}}>{info.irc}</strong> — {info.note}
                        </div>
                        {/* Interest cost analysis */}
                        {(liab.ts||0) > 0 && (liab.mt||0) > 0 && (
                          <div style={{background:T.bg3,borderRadius:10,padding:12,marginBottom:12}}>
                            <div style={{fontSize:11,fontWeight:700,color:T.tx2,marginBottom:8}}>Annual Interest Cost</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                              <div><div style={{fontSize:9,color:T.tx3}}>ANNUAL INTEREST</div><div style={{fontSize:14,fontWeight:700,color:T.rd}}>{fm((liab.mt||0)*(liab.ts||0)/100)}</div></div>
                              <div><div style={{fontSize:9,color:T.tx3}}>MONTHLY PAYMENT</div><div style={{fontSize:14,fontWeight:700,color:T.or}}>{fm(liab.pg||0)}</div></div>
                              <div><div style={{fontSize:9,color:T.tx3}}>PAYOFF (est.)</div><div style={{fontSize:14,fontWeight:700,color:T.tx2}}>{liab.pg>0?Math.ceil((liab.mt||0)/(liab.pg||1))+" mo":"—"}</div></div>
                            </div>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setFormL({...EMPTY_LIAB,...liab});setEditing(idx);setShowForm("liab")}}
                            style={{padding:"8px 16px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,color:T.tx2,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                          <button onClick={()=>removeLiab(idx)}
                            style={{padding:"8px 16px",background:T.rdB,border:"none",borderRadius:8,color:T.rd,cursor:"pointer",fontSize:12,fontWeight:600}}>🗑️ Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}

      {/* ════ ASSET FORM MODAL ════ */}
      {showForm === "asset" && (
        <div onClick={()=>setShowForm(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:660,maxHeight:"90vh",overflowY:"auto",padding:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:800,margin:0}}>{editing!==null?"Edit":"Add"} Asset</h3>
              <button onClick={()=>setShowForm(null)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button>
            </div>

            {/* Type selector */}
            <div style={{marginBottom:20}}>
              <Label>Asset Type</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                {ASSET_TYPES.map(t=>(
                  <button key={t.v} type="button" onClick={()=>sfS("tp",t.v)}
                    style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${form.tp===t.v?(CAT_COLORS[t.cat]||T.gn):T.border}`,
                            background:form.tp===t.v?`${CAT_COLORS[t.cat]||T.gn}15`:T.bg3,cursor:"pointer",textAlign:"left",
                            color:form.tp===t.v?(CAT_COLORS[t.cat]||T.gn):T.tx2,fontSize:12,fontWeight:form.tp===t.v?700:400}}>
                    {t.l}
                  </button>
                ))}
              </div>
              <InfoBox color={CAT_COLORS[selType.cat]||T.bl}>
                <strong>{selType.form}</strong> · {selType.irc}<br/>{selType.taxNote}
              </InfoBox>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Asset Name / Description" value={form.n} onChange={v=>sfS("n",v)} type="text" placeholder={selType.l} />
              </div>
              <Field l="Cost Basis (what you paid)" value={form.vc} onChange={v=>sf("vc",v)} hint="Purchase price + all transaction costs + capital improvements." />
              <Field l="Current Market Value" value={form.va} onChange={v=>sf("va",v)} />
              {selType.deprec && <>
                <Field l="Land Value (not depreciable)" value={form.landValue} onChange={v=>sf("landValue",v)} hint="Allocate purchase price between land (non-depreciable) and building. IRS requires this separation." />
                <Field l="Years Held" value={form.yearsHeld} onChange={v=>sf("yearsHeld",v)} hint="Used to calculate total depreciation taken — relevant for § 1250 recapture on sale." />
              </>}
              {["rental_res","rental_com"].includes(form.tp) && (
                <Field l="Monthly Rental Income (gross)" value={form.monthlyIncome} onChange={v=>sf("monthlyIncome",v)} />
              )}
              {form.tp === "primary_home" && (
                <Field l="Filing Status" value={form.filingStatus}
                  onChange={v=>sfS("filingStatus",v)} type="text"
                  options={[{v:"single",l:"Single ($250K exclusion)"},{v:"mfj",l:"Married Filing Jointly ($500K)"}]} />
              )}
              {["lt_gains","st_gains","stocks_etf","crypto"].includes(form.tp) && (
                <Field l="Your MAGI (for NIIT calculation)" value={form.magi}
                  onChange={v=>sf("magi",v)} hint="NIIT (3.8%) applies if MAGI > $200K (single). Enter your estimated MAGI." />
              )}
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Notes" value={form.notes} onChange={v=>sfS("notes",v)} type="text" placeholder="Brokerage, account, location, etc." />
              </div>
            </div>

            <InfoBox color={T.pr}>
              <strong>💡 CPA Planning:</strong> {selType.planning}
            </InfoBox>

            <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:24}}>
              <button onClick={()=>setShowForm(null)} style={{padding:"10px 20px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.tx2,cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={saveAsset} style={{padding:"10px 24px",background:`linear-gradient(135deg,${T.gn},#16a34a)`,border:"none",borderRadius:10,color:"#000",cursor:"pointer",fontWeight:700}}>
                {editing!==null?"Update":"Add Asset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ LIABILITY FORM MODAL ════ */}
      {showForm === "liab" && (
        <div onClick={()=>setShowForm(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.borderL}`,borderRadius:20,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:800,margin:0}}>{editing!==null?"Edit":"Add"} Liability</h3>
              <button onClick={()=>setShowForm(null)} style={{background:"none",border:"none",color:T.tx3,cursor:"pointer",fontSize:18}}>✕</button>
            </div>

            <div style={{marginBottom:16}}>
              <Label>Liability Type</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                {LIAB_TYPES.map(t=>(
                  <button key={t.v} type="button" onClick={()=>sfL("tp",t.v)}
                    style={{padding:"9px 12px",borderRadius:9,border:`1px solid ${formL.tp===t.v?T.bl:T.border}`,
                            background:formL.tp===t.v?`${T.bl}15`:T.bg3,cursor:"pointer",textAlign:"left",
                            color:formL.tp===t.v?T.bl:T.tx2,fontSize:12,fontWeight:formL.tp===t.v?700:400}}>
                    {t.l}
                  </button>
                ))}
              </div>
              {(() => {
                const li = liabInfo(formL.tp);
                return <InfoBox color={li.deductible===true?T.gn:li.deductible==="conditional"?T.or:T.tx3}>
                  <strong>{li.irc}</strong> — {li.note}
                </InfoBox>;
              })()}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Lender / Description" value={formL.n} onChange={v=>sfL("n",v)} type="text" placeholder="Chase Mortgage, Sallie Mae, etc." />
              </div>
              <Field l="Outstanding Balance" value={formL.mt} onChange={v=>sfL("mt",v)} />
              <Field l="Monthly Payment" value={formL.pg} onChange={v=>sfL("pg",v)} />
              <Field l="Interest Rate (%)" value={formL.ts} onChange={v=>sfL("ts",v)} placeholder="6.75" />
              <div style={{gridColumn:"1/-1"}}>
                <Field l="Notes" value={formL.notes} onChange={v=>sfL("notes",v)} type="text" placeholder="Loan purpose, lender, origination date, etc." />
              </div>
            </div>

            <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:24}}>
              <button onClick={()=>setShowForm(null)} style={{padding:"10px 20px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:10,color:T.tx2,cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={saveLiab} style={{padding:"10px 24px",background:`linear-gradient(135deg,${T.gn},#16a34a)`,border:"none",borderRadius:10,color:"#000",cursor:"pointer",fontWeight:700}}>
                {editing!==null?"Update":"Add Liability"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{marginTop:16,padding:12,background:T.bg3,borderRadius:8,fontSize:10,color:T.tx3,lineHeight:1.6}}>
        <strong>Disclaimer:</strong> Tax analysis is for planning purposes. Cost basis calculations assume you provide accurate figures. § 1250 recapture, NIIT, and exclusion eligibility depend on individual circumstances. Consult a licensed CPA, CFP, or tax attorney before any sale, exchange, or major tax event.
      </div>
    </div>
  );
}
