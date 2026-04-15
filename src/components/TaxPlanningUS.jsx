import { useMemo } from "react";
import { US } from "../lib/jurisdictions/US.js";

const T = {
  bg:"#09090b", bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)", borderL:"rgba(255,255,255,0.1)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444", rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6", pr:"#a78bfa", or:"#f59e0b",
};

const fm = (n) => US.formatCurrency(n || 0);
const pc = (n) => ((n || 0) * 100).toFixed(1) + "%";
const Row = ({ l, v, sub, cl }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
    padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
    <div>
      <div style={{ fontSize:13, color:T.tx2 }}>{l}</div>
      {sub && <div style={{ fontSize:10, color:T.tx3, marginTop:2 }}>{sub}</div>}
    </div>
    <div style={{ fontSize:14, fontWeight:700, color:cl||T.tx, fontFamily:"monospace" }}>{v}</div>
  </div>
);

export default function TaxPlanningUS({ user, fmt }) {
  const ingresos = user?.ingresos || [];
  const trm = user?.trm || 4200;

  // Annualize income in USD
  const annualIncome = useMemo(() => {
    return ingresos.reduce((s, i) => {
      const monthly = i.mensual || 0;
      const inUSD = i.moneda === "USD" ? monthly : monthly / trm;
      return s + inUSD * 12;
    }, 0);
  }, [ingresos, trm]);

  const w2Income = useMemo(() =>
    ingresos.filter(i => i.categoria === "Salario")
      .reduce((s, i) => s + ((i.moneda === "USD" ? i.mensual : (i.mensual||0)/trm) * 12), 0)
  , [ingresos, trm]);

  const selfEmploymentIncome = useMemo(() =>
    ingresos.filter(i => /Honorarios|Freelance/i.test(i.categoria||""))
      .reduce((s, i) => s + ((i.moneda === "USD" ? i.mensual : (i.mensual||0)/trm) * 12), 0)
  , [ingresos, trm]);

  const capitalGainIncome = useMemo(() =>
    ingresos.filter(i => /Dividendos|Rendimiento|Inversión/i.test(i.categoria||""))
      .reduce((s, i) => s + ((i.moneda === "USD" ? i.mensual : (i.mensual||0)/trm) * 12), 0)
  , [ingresos, trm]);

  const rentalIncome = useMemo(() =>
    ingresos.filter(i => /Arriendo/i.test(i.categoria||""))
      .reduce((s, i) => s + ((i.moneda === "USD" ? i.mensual : (i.mensual||0)/trm) * 12), 0)
  , [ingresos, trm]);

  const fedTax = US.calculateIncomeTax(annualIncome);
  const fica   = US.calculateRetirementContribution(w2Income);
  const seTax  = selfEmploymentIncome > 0
    ? Math.round(selfEmploymentIncome * 0.153)  // 15.3% self-employment tax
    : 0;

  const totalTax = fedTax.tax + fica.employee + seTax;
  const effectiveRate = annualIncome > 0 ? totalTax / annualIncome : 0;

  // Optimizations
  const k401Savings  = Math.min(w2Income * 0.1, US.constants.limit401k);
  const iraSavings   = Math.min(annualIncome * 0.05, US.constants.limitIRA);
  const hsaSavings   = 4150; // 2025 HSA individual limit
  const totalOptDeductions = k401Savings + iraSavings + hsaSavings;
  const optimizedIncome = Math.max(0, annualIncome - totalOptDeductions);
  const optimizedTax = US.calculateIncomeTax(optimizedIncome);
  const taxSavings   = fedTax.tax - optimizedTax.tax;

  if (annualIncome === 0) return (
    <div style={{ padding:48, textAlign:"center", color:T.tx3 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🇺🇸</div>
      <div style={{ fontSize:16, fontWeight:700, color:T.tx2, marginBottom:8 }}>US Tax Planning</div>
      <div style={{ fontSize:13 }}>Add your income sources in the <strong style={{color:T.gn}}>💰 Income</strong> section to see your federal tax estimate.</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🇺🇸 US Tax Planning</h2>
        <p style={{ color:T.tx3, fontSize:13, margin:0 }}>
          Federal estimate — Tax Year 2025 · IRS brackets (Single filer)
        </p>
      </div>

      {/* ── KPI cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { l:"Gross Income",    v:fm(annualIncome),   c:T.gn,  sub:"Annual" },
          { l:"Federal Tax",     v:fm(fedTax.tax),     c:T.rd,  sub:`${pc(fedTax.effectiveRate)} eff. rate` },
          { l:"Marginal Rate",   v:`${(fedTax.marginalRate*100).toFixed(0)}%`, c:T.or, sub:"Top bracket" },
          { l:"Est. Total Tax",  v:fm(totalTax),       c:T.rd,  sub:"Fed + FICA + SE" },
        ].map(k => (
          <div key={k.l} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 20px" }}>
            <div style={{ fontSize:10, color:T.tx3, textTransform:"uppercase", letterSpacing:1, fontWeight:600 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.c, marginTop:6 }}>{k.v}</div>
            {k.sub && <div style={{ fontSize:10, color:T.tx3, marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* ── Federal Income Tax detail ── */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.tx2, marginBottom:16 }}>📋 Federal Tax Breakdown</div>
          <Row l="Gross Income"           v={fm(annualIncome)} />
          <Row l="Standard Deduction"     v={`–${fm(US.constants.standardDeduction)}`} cl={T.gn} sub="2025 Single filer" />
          <Row l="Taxable Income"         v={fm(fedTax.taxableIncome)} />
          <Row l="Federal Income Tax"     v={fm(fedTax.tax)}  cl={T.rd} />
          <Row l="Marginal Bracket"       v={`${(fedTax.marginalRate*100).toFixed(0)}%`} cl={T.or} />
          <Row l="Effective Rate"         v={pc(fedTax.effectiveRate)} cl={T.tx2} />
          {fica.employee > 0 && <>
            <Row l="Social Security"      v={`–${fm(fica.breakdown?.socialSecurity||0)}`} cl={T.rd} sub="6.2% up to wage base" />
            <Row l="Medicare"             v={`–${fm(fica.breakdown?.medicare||0)}`}       cl={T.rd} sub="1.45% all wages" />
          </>}
          {seTax > 0 &&
            <Row l="Self-Employment Tax"  v={`–${fm(seTax)}`} cl={T.rd} sub="15.3% on 1099 income" />
          }
          <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", fontWeight:800, fontSize:15, color:T.rd }}>
            <span>Total Tax Burden</span>
            <span style={{ fontFamily:"monospace" }}>{fm(totalTax)}/yr</span>
          </div>
          <div style={{ fontSize:11, color:T.tx3 }}>
            Take-home after taxes: <strong style={{ color:T.gn }}>{fm(annualIncome - totalTax)}/yr</strong> ({fm((annualIncome - totalTax)/12)}/mo)
          </div>
        </div>

        {/* ── Tax Optimization ── */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.pr, marginBottom:16 }}>💡 Tax Optimization Strategy</div>

          <div style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.pr, marginBottom:8 }}>Potential Savings</div>
            <div style={{ fontSize:28, fontWeight:800, color:T.gn }}>{fm(taxSavings)}</div>
            <div style={{ fontSize:11, color:T.tx3 }}>per year by maximizing pre-tax contributions</div>
          </div>

          <Row l="401(k) Contribution"    v={`–${fm(k401Savings)}`}  cl={T.gn} sub={`Up to $${US.constants.limit401k.toLocaleString()} limit`} />
          <Row l="IRA Contribution"       v={`–${fm(iraSavings)}`}   cl={T.gn} sub={`Up to $${US.constants.limitIRA.toLocaleString()} limit`} />
          <Row l="HSA Contribution"       v={`–${fm(hsaSavings)}`}   cl={T.gn} sub="Health Savings Account" />
          <Row l="Total Pre-Tax Savings"  v={fm(totalOptDeductions)}  cl={T.gn} />
          <Row l="Optimized Taxable Inc." v={fm(optimizedIncome)}               />
          <Row l="Tax After Optimization" v={fm(optimizedTax.tax)}   cl={T.rd} />

          <div style={{ marginTop:16, padding:12, background:T.bg3, borderRadius:8, fontSize:11, color:T.tx2, lineHeight:1.7 }}>
            <strong>Next steps:</strong><br/>
            ✅ Max your 401(k): {fm(US.constants.limit401k)}/yr pre-tax<br/>
            ✅ Open a Roth IRA if income &lt; $146K (2025)<br/>
            ✅ HSA if enrolled in a High-Deductible Health Plan<br/>
            ✅ Track deductible business expenses (1099 income)
          </div>
        </div>

      </div>

      {/* ── Income breakdown ── */}
      {ingresos.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:24, marginTop:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.tx2, marginBottom:16 }}>💰 Income Sources (Annualized)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10 }}>
            {[
              { l:"W-2 Wages",         v:w2Income,            icon:"💼" },
              { l:"1099 / Freelance",  v:selfEmploymentIncome,icon:"🧾" },
              { l:"Rental Income",     v:rentalIncome,         icon:"🏠" },
              { l:"Dividends / Inv.",  v:capitalGainIncome,    icon:"📈" },
            ].filter(i => i.v > 0).map(i => (
              <div key={i.l} style={{ background:T.bg3, borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:11, color:T.tx3 }}>{i.icon} {i.l}</div>
                <div style={{ fontSize:18, fontWeight:700, color:T.gn, marginTop:4 }}>{fm(i.v)}</div>
                <div style={{ fontSize:10, color:T.tx3 }}>per year</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop:16, padding:14, background:T.bg3, borderRadius:10, fontSize:10, color:T.tx3, lineHeight:1.6 }}>
        <strong>Disclaimer:</strong> This is an estimate for informational purposes only. Assumes single filer, standard deduction, tax year 2025. 
        State income taxes are not included. Consult a CPA or tax professional for your official filing.
      </div>
    </div>
  );
}
