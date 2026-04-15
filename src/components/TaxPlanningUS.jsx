/**
 * TaxPlanningUS.jsx — CPA Grade
 * Clarity-first: 3 hero numbers → Before / Savings / After
 * Then full waterfall breakdown
 */
import { useState, useMemo } from "react";
import { US } from "../lib/jurisdictions/US.js";

const C = {
  STD_DED: 15000, K401: 23500, IRA: 7000, HSA: 4150,
  QBI: 0.20, NIIT_THRESH: 200000, NIIT_RATE: 0.038,
  SS_WAGE_BASE: 176100,
};
const BRACKETS = [
  {max:11925,  rate:0.10},{max:48475, rate:0.12},{max:103350,rate:0.22},
  {max:197300, rate:0.24},{max:250525,rate:0.32},{max:626350, rate:0.35},
  {max:Infinity,rate:0.37},
];
function fedTax(income) {
  let tax=0,prev=0;
  for(const b of BRACKETS){if(income<=prev)break;tax+=(Math.min(income,b.max)-prev)*b.rate;prev=b.max;}
  return Math.max(0,Math.round(tax));
}
function marginalRate(income) {
  return BRACKETS.find(b=>income<=b.max)?.rate||0.37;
}

const T = {
  bg:"#09090b",bg2:"#18181b",bg3:"#27272a",card:"#111113",
  border:"rgba(255,255,255,0.06)",
  tx:"#fafafa",tx2:"#a1a1aa",tx3:"#71717a",
  gn:"#22c55e",rd:"#ef4444",bl:"#3b82f6",pr:"#a78bfa",or:"#f59e0b",cy:"#06b6d4",
};
const fm  = (n) => `$${Math.round(Math.abs(n||0)).toLocaleString("en-US")}`;
const pct = (n) => `${((n||0)*100).toFixed(1)}%`;

const WRow = ({label,amount,note,color,bold,indent,irc}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
    padding:"8px 0",borderBottom:`1px solid ${T.border}`,paddingLeft:indent?14:0}}>
    <div style={{flex:1}}>
      <div style={{fontSize:bold?13:12,fontWeight:bold?700:400,color:bold?T.tx:T.tx2}}>
        {indent&&<span style={{color:T.tx3,marginRight:4}}>↳</span>}{label}
      </div>
      {note&&<div style={{fontSize:10,color:T.tx3,marginTop:1,lineHeight:1.4}}>{note}</div>}
      {irc &&<div style={{fontSize:9, color:T.tx3,fontStyle:"italic"}}>{irc}</div>}
    </div>
    <div style={{fontSize:bold?14:12,fontWeight:bold?800:600,color:color||T.tx2,
      fontFamily:"monospace",marginLeft:12,whiteSpace:"nowrap"}}>{amount}</div>
  </div>
);

export default function TaxPlanningUS({user}) {
  const [showDetail, setShowDetail] = useState(false);
  const ingresos = user?.ingresos || [];
  const trm = user?.trm || 1;

  // ── Parse income ──────────────────────────────────────────────────────────
  const inc = useMemo(() => {
    let w2=0,se=0,rental=0,inv=0,other=0;
    ingresos.forEach(i => {
      const annual = (i.mensual||0)*(i.moneda==="USD"?1:1/trm)*12;
      const cat = i.categoria||"";
      if(/Salario/i.test(cat))                              w2   +=annual;
      else if(/Honorarios|Freelance/i.test(cat))            se   +=annual;
      else if(/Arriendo/i.test(cat))                        rental+=annual;
      else if(/Dividendos|Rendimiento|Inversión/i.test(cat))inv  +=annual;
      else                                                  other+=annual;
    });
    return {w2,se,rental,inv,other,gross:w2+se+rental+inv+other};
  },[ingresos,trm]);

  // ── SCENARIO A — No optimization ─────────────────────────────────────────
  const A = useMemo(()=>{
    if(!inc.gross) return null;
    const ficaSS  = Math.round(Math.min(inc.w2,C.SS_WAGE_BASE)*0.062);
    const ficaMed = Math.round(inc.w2*0.0145);
    const fica    = ficaSS+ficaMed;
    const seTax   = Math.round(inc.se*0.9235*0.153);
    const halfSE  = Math.round(seTax/2);
    const agi     = Math.max(0,inc.gross-halfSE);
    const taxInc  = Math.max(0,agi-C.STD_DED);
    const fed     = fedTax(taxInc);
    const niit    = inc.inv>0&&agi>C.NIIT_THRESH?Math.round(Math.min(inc.inv,agi-C.NIIT_THRESH)*C.NIIT_RATE):0;
    const total   = fed+fica+seTax+niit;
    return {agi,taxInc,fed,fica,ficaSS,ficaMed,seTax,halfSE,niit,total,
      takeHome:inc.gross-total,effRate:inc.gross>0?total/inc.gross:0,
      mRate:marginalRate(taxInc),mLabel:`${(marginalRate(taxInc)*100).toFixed(0)}%`};
  },[inc]);

  // ── SCENARIO B — Optimized ────────────────────────────────────────────────
  const B = useMemo(()=>{
    if(!inc.gross) return null;
    const k401    = Math.min(inc.w2*0.15,C.K401);
    const hsa     = inc.w2>0?C.HSA:0;
    const ira     = inc.gross<90000?C.IRA:0;
    const seHlth  = Math.round(inc.se*0.08);
    const seNet   = Math.max(0,inc.se-seHlth);
    const seTax   = Math.round(seNet*0.9235*0.153);
    const halfSE  = Math.round(seTax/2);
    const qbi     = Math.round(Math.max(0,seNet-halfSE)*C.QBI);
    const ficaSS  = Math.round(Math.min(inc.w2,C.SS_WAGE_BASE)*0.062);
    const ficaMed = Math.round(inc.w2*0.0145);
    const fica    = ficaSS+ficaMed;
    const agiRed  = k401+hsa+ira+seHlth+halfSE;
    const agi     = Math.max(0,inc.gross-agiRed);
    const taxInc  = Math.max(0,agi-C.STD_DED-qbi);
    const fed     = fedTax(taxInc);
    const niit    = inc.inv>0&&agi>C.NIIT_THRESH?Math.round(Math.min(inc.inv,agi-C.NIIT_THRESH)*C.NIIT_RATE):0;
    const total   = fed+fica+seTax+niit;
    return {k401,hsa,ira,seHlth,qbi,agiRed,agi,taxInc,fed,fica,ficaSS,ficaMed,seTax,halfSE,niit,total,
      takeHome:inc.gross-total,effRate:inc.gross>0?total/inc.gross:0,
      mRate:marginalRate(taxInc),mLabel:`${(marginalRate(taxInc)*100).toFixed(0)}%`};
  },[inc]);

  if(!inc.gross) return (
    <div style={{padding:48,textAlign:"center",background:T.card,border:`1px solid ${T.border}`,borderRadius:16,color:T.tx3}}>
      <div style={{fontSize:32,marginBottom:12}}>🧾</div>
      <div style={{fontSize:16,fontWeight:700,color:T.tx2,marginBottom:8}}>No income data yet</div>
      <div style={{fontSize:13}}>Add your income in <strong style={{color:T.gn}}>💰 Income</strong> first.</div>
    </div>
  );

  const savings = A && B ? A.total - B.total : 0;

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🧾 US Tax Planning 2025</h2>
        <p style={{color:T.tx3,fontSize:12,margin:0}}>Federal estimate · Single filer · IRS brackets</p>
      </div>

      {/* ══════════════════════════════════════════════════
          HERO — 3 números enormes, imposible de confundir
          ══════════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>

        {/* SIN estrategia */}
        <div style={{background:`${T.rd}10`,border:`2px solid ${T.rd}50`,
          borderRadius:16,padding:24,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.rd,letterSpacing:1,marginBottom:8}}>
            ❌ WITHOUT STRATEGY
          </div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:4}}>You pay today</div>
          <div style={{fontSize:36,fontWeight:900,color:T.rd,fontFamily:"monospace",lineHeight:1}}>
            {fm(A?.total||0)}
          </div>
          <div style={{fontSize:12,color:T.tx2,marginTop:6}}>/year in taxes</div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.rd}30`}}>
            <div style={{fontSize:11,color:T.tx3}}>Take-home</div>
            <div style={{fontSize:16,fontWeight:700,color:T.tx}}>{fm(A?.takeHome||0)}/yr</div>
            <div style={{fontSize:11,color:T.tx3}}>{fm((A?.takeHome||0)/12)}/month</div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:T.or}}>
            Effective rate: {pct(A?.effRate||0)}
          </div>
          <div style={{fontSize:11,color:T.tx3}}>Top bracket: {A?.mLabel}</div>
        </div>

        {/* AHORRO */}
        <div style={{background:`${T.gn}10`,border:`2px solid ${T.gn}`,
          borderRadius:16,padding:24,textAlign:"center",
          boxShadow:`0 0 24px ${T.gn}20`}}>
          <div style={{fontSize:11,fontWeight:700,color:T.gn,letterSpacing:1,marginBottom:8}}>
            💡 YOU SAVE
          </div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:4}}>with optimization</div>
          <div style={{fontSize:36,fontWeight:900,color:T.gn,fontFamily:"monospace",lineHeight:1}}>
            {fm(savings)}
          </div>
          <div style={{fontSize:12,color:T.tx2,marginTop:6}}>/year less in taxes</div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.gn}30`}}>
            <div style={{fontSize:11,color:T.tx3}}>That's</div>
            <div style={{fontSize:16,fontWeight:700,color:T.gn}}>{fm(savings/12)}/month</div>
            <div style={{fontSize:11,color:T.tx3}}>back in your pocket</div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:T.gn,fontWeight:700}}>
            ↓ {A&&A.effRate>0?((1-B.effRate/A.effRate)*100).toFixed(0):"0"}% effective rate reduction
          </div>
        </div>

        {/* CON estrategia */}
        <div style={{background:`${T.bl}10`,border:`2px solid ${T.bl}50`,
          borderRadius:16,padding:24,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.bl,letterSpacing:1,marginBottom:8}}>
            ✅ WITH STRATEGY
          </div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:4}}>You would pay</div>
          <div style={{fontSize:36,fontWeight:900,color:T.bl,fontFamily:"monospace",lineHeight:1}}>
            {fm(B?.total||0)}
          </div>
          <div style={{fontSize:12,color:T.tx2,marginTop:6}}>/year in taxes</div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.bl}30`}}>
            <div style={{fontSize:11,color:T.tx3}}>Take-home</div>
            <div style={{fontSize:16,fontWeight:700,color:T.gn}}>{fm(B?.takeHome||0)}/yr</div>
            <div style={{fontSize:11,color:T.gn}}>{fm((B?.takeHome||0)/12)}/month ↑</div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:T.cy}}>
            Effective rate: {pct(B?.effRate||0)}
          </div>
          <div style={{fontSize:11,color:T.tx3}}>Top bracket: {B?.mLabel}</div>
        </div>
      </div>

      {/* Monthly comparison bar */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,
        padding:"16px 20px",marginBottom:16,display:"flex",
        justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{fontSize:13,color:T.tx2}}>
          <span style={{color:T.rd,fontWeight:700}}>{fm(A?.total/12||0)}/month</span>
          <span style={{color:T.tx3,margin:"0 8px"}}>→</span>
          <span style={{color:T.bl,fontWeight:700}}>{fm(B?.total/12||0)}/month</span>
          <span style={{color:T.tx3,fontSize:12,marginLeft:8}}>in taxes</span>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:T.gn}}>
          Save {fm(savings/12)}/month = {fm(savings)}/year
        </div>
      </div>

      {/* Toggle for detail */}
      <button onClick={()=>setShowDetail(d=>!d)}
        style={{width:"100%",padding:"12px",background:T.bg3,border:`1px solid ${T.border}`,
          borderRadius:12,color:T.tx2,cursor:"pointer",fontSize:13,fontWeight:600,
          marginBottom:16,display:"flex",justifyContent:"center",alignItems:"center",gap:8}}>
        {showDetail?"▲ Hide":"▼ Show"} detailed breakdown
      </button>

      {showDetail && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>

          {/* BEFORE */}
          <div style={{background:T.card,border:`1px solid ${T.rd}40`,borderRadius:14,padding:20}}>
            <div style={{fontSize:13,fontWeight:800,color:T.rd,marginBottom:14,
              paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
              ❌ Without Strategy — how it's calculated
            </div>
            <WRow label="Gross Income"          amount={fm(inc.gross)} bold color={T.tx}/>
            {A.halfSE>0&&<WRow label="½ SE Tax deduction" amount={`–${fm(A.halfSE)}`} color={T.tx3} indent irc="§ 164(f)"/>}
            <WRow label="Standard Deduction"    amount={`–${fm(C.STD_DED)}`} color={T.tx3} indent irc="§ 63"/>
            <WRow label="Taxable Income"         amount={fm(A.taxInc)} bold color={T.or}/>
            <div style={{margin:"10px 0 6px",fontSize:10,fontWeight:700,color:T.rd,letterSpacing:1}}>TAXES OWED</div>
            <WRow label="Federal Income Tax"     amount={fm(A.fed)}    color={T.rd} note={`${A.mLabel} bracket`}/>
            {A.fica>0  &&<WRow label="FICA (SS + Medicare)" amount={fm(A.fica)}   color={T.rd} note={`SS: ${fm(A.ficaSS)} · Medicare: ${fm(A.ficaMed)}`}/>}
            {A.seTax>0 &&<WRow label="Self-Employment Tax"  amount={fm(A.seTax)}  color={T.rd} note="15.3% on 1099"/>}
            {A.niit>0  &&<WRow label="NIIT Surtax 3.8%"     amount={fm(A.niit)}   color={T.rd} note="Investment income over $200K"/>}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
              borderTop:`2px solid ${T.rd}40`,marginTop:4,fontWeight:800}}>
              <span style={{color:T.rd}}>TOTAL TAX / YEAR</span>
              <span style={{color:T.rd,fontFamily:"monospace",fontSize:16}}>{fm(A.total)}</span>
            </div>
          </div>

          {/* AFTER */}
          <div style={{background:T.card,border:`1px solid ${T.gn}60`,borderRadius:14,padding:20}}>
            <div style={{fontSize:13,fontWeight:800,color:T.gn,marginBottom:14,
              paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>
              ✅ With Strategy — what changes
            </div>
            <WRow label="Gross Income"           amount={fm(inc.gross)} bold color={T.tx}/>
            {B.k401>0   &&<WRow label="401(k) Pre-Tax"      amount={`–${fm(B.k401)}`}  color={T.gn} indent note="Invested, grows tax-deferred" irc="§ 401(k)"/>}
            {B.hsa>0    &&<WRow label="HSA Contribution"    amount={`–${fm(B.hsa)}`}   color={T.gn} indent note="Triple tax advantage" irc="§ 223"/>}
            {B.ira>0    &&<WRow label="IRA Contribution"    amount={`–${fm(B.ira)}`}   color={T.gn} indent irc="§ 219"/>}
            {B.seHlth>0 &&<WRow label="SE Health Insurance" amount={`–${fm(B.seHlth)}`}color={T.gn} indent irc="§ 162(l)"/>}
            {B.halfSE>0 &&<WRow label="½ SE Tax deduction"  amount={`–${fm(B.halfSE)}`}color={T.gn} indent irc="§ 164(f)"/>}
            <WRow label="Adjusted Gross (AGI)"   amount={fm(B.agi)} bold color={T.cy}/>
            <WRow label="Standard Deduction"     amount={`–${fm(C.STD_DED)}`} color={T.gn} indent irc="§ 63"/>
            {B.qbi>0    &&<WRow label="QBI Deduction 20%"   amount={`–${fm(B.qbi)}`}   color={T.gn} indent note="Qualified Business Income" irc="§ 199A"/>}
            <WRow label="Taxable Income"          amount={fm(B.taxInc)} bold color={T.or}
              note={`${fm(A.taxInc-B.taxInc)} less than without optimization`}/>
            <div style={{margin:"10px 0 6px",fontSize:10,fontWeight:700,color:T.rd,letterSpacing:1}}>TAXES OWED</div>
            <WRow label="Federal Income Tax"      amount={fm(B.fed)}   color={T.rd} note={`${B.mLabel} bracket (was ${A.mLabel})`}/>
            {B.fica>0  &&<WRow label="FICA (SS + Medicare)" amount={fm(B.fica)}  color={T.rd} note="Can't reduce — mandatory"/>}
            {B.seTax>0 &&<WRow label="Self-Employment Tax"  amount={fm(B.seTax)} color={T.rd} note="Slightly lower (reduced SE income)"/>}
            {B.niit>0  &&<WRow label="NIIT Surtax 3.8%"     amount={fm(B.niit)}  color={T.rd}/>}
            {B.niit===0&&A?.niit>0&&<WRow label="NIIT Surtax" amount="✅ $0 — avoided" color={T.gn} note={`Saved ${fm(A.niit)} by lowering AGI`}/>}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",
              borderTop:`2px solid ${T.gn}40`,marginTop:4,fontWeight:800}}>
              <span style={{color:T.gn}}>TOTAL TAX / YEAR</span>
              <span style={{color:T.gn,fontFamily:"monospace",fontSize:16}}>{fm(B.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action plan */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:20,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:12}}>
          🎯 What to do to achieve those savings
        </div>
        {[
          B?.k401>0 && {p:"🔴 HIGH",c:T.rd,
            a:`Max 401(k): contribute ${fm(C.K401/12)}/month ($${C.K401.toLocaleString()}/year)`,
            i:`Saves ~${fm(B.k401*(B.mRate||0.22))} in federal tax + grows tax-deferred`},
          B?.hsa>0&&inc.w2>0 && {p:"🔴 HIGH",c:T.rd,
            a:`Open & max HSA: ${fm(C.HSA/12)}/month ($${C.HSA.toLocaleString()}/year)`,
            i:"Deductible + grows tax-free + tax-free for medical = triple tax win"},
          inc.se>0 && {p:"🟡 MED",c:T.or,
            a:"Track ALL business expenses (home office, mileage, software, equipment)",
            i:"Every $1 deducted saves ~$0.37 in combined federal + SE tax"},
          inc.inv>0 && {p:"🟡 MED",c:T.or,
            a:"Hold investments 12+ months before selling",
            i:`Long-term gains taxed at 0–20% instead of your ${A?.mLabel} ordinary rate`},
          A?.niit>0&&B?.niit===0 && {p:"🟢 OPT",c:T.gn,
            a:"Pre-tax contributions keep AGI below $200K NIIT threshold",
            i:`Avoids 3.8% surtax on investment income — saves ${fm(A.niit)}/year`},
        ].filter(Boolean).map((item,i)=>(
          <div key={i} style={{background:T.bg3,borderRadius:10,padding:"11px 14px",marginBottom:8,borderLeft:`3px solid ${item.c}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:11,fontWeight:700,color:item.c,flexShrink:0}}>{item.p}</span>
              <span style={{fontSize:12,fontWeight:700,color:T.tx}}>{item.a}</span>
            </div>
            <div style={{fontSize:11,color:T.tx2}}>{item.i}</div>
          </div>
        ))}
      </div>

      {/* Quarterly estimates */}
      {B&&B.total>1000&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:20,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.or,marginBottom:4}}>📅 Quarterly Estimated Payments (Form 1040-ES)</div>
          <div style={{fontSize:11,color:T.tx3,marginBottom:12}}>
            Required if you owe ≥$1,000 · Penalty ~8%/year if underpaid (IRC § 6654)
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Q1","April 15, 2025"],["Q2","June 16, 2025"],["Q3","Sep 15, 2025"],["Q4","Jan 15, 2026"]].map(([q,d])=>(
              <div key={q} style={{background:T.bg3,borderRadius:10,padding:"12px 14px",
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:12,fontWeight:700,color:T.or}}>{q}</div>
                  <div style={{fontSize:10,color:T.tx3}}>{d}</div></div>
                <div style={{fontSize:16,fontWeight:800,color:T.tx,fontFamily:"monospace"}}>{fm(B.total/4)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{padding:12,background:T.bg3,borderRadius:8,fontSize:10,color:T.tx3,lineHeight:1.6}}>
        <strong>Disclaimer:</strong> Estimates based on 2025 IRS single-filer rules. State taxes not included.
        Consult a licensed CPA or EA for your official return.
      </div>
    </div>
  );
}
