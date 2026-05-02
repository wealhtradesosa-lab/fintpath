/**
 * DashboardUS.jsx — English dashboard for US users
 * Standalone — does NOT touch App.jsx dashboard logic
 */
import { useMemo } from "react";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

const T = {
  bg:"#09090b",bg2:"#18181b",bg3:"#27272a",card:"#111113",
  border:"rgba(255,255,255,0.06)",
  tx:"#fafafa",tx2:"#a1a1aa",tx3:"#71717a",
  gn:"#22c55e",gnB:"rgba(34,197,94,0.08)",
  rd:"#ef4444",rdB:"rgba(239,68,68,0.06)",
  bl:"#3b82f6",pr:"#a78bfa",or:"#f59e0b",cy:"#06b6d4",
  ch:["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308"],
};
const fm = (n) => {
  if(n==null||isNaN(n)) return "$0";
  const v = Math.abs(n);
  if(v>=1e9) return "$"+(n/1e9).toFixed(1)+"B";
  if(v>=1e6) return "$"+(n/1e6).toFixed(1)+"M";
  return "$"+Math.round(n).toLocaleString("en-US");
};
const pct = (n) => ((n||0)).toFixed(1)+"%";

const Kpi = ({l,v,sub,c}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px"}}>
    <div style={{fontSize:10,color:T.tx3,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>{l}</div>
    <div style={{fontSize:22,fontWeight:700,color:c||T.tx,marginTop:6}}>{v}</div>
    {sub&&<div style={{fontSize:11,color:T.tx3,marginTop:2}}>{sub}</div>}
  </div>
);
const Card = ({children,s}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",...s}}>
    {children}
  </div>
);

// ── US Net Worth Percentiles (Fed Reserve SCF 2022) ──────────────────────
const NW_PCTS = [
  {p:10,v:-2800},{p:20,v:7500},{p:25,v:24000},{p:30,v:48000},
  {p:40,v:97000},{p:50,v:192700},{p:60,v:310000},{p:70,v:528000},
  {p:80,v:862000},{p:90,v:1860000},{p:95,v:3840000},{p:99,v:11100000},
];
function getNWPct(nw) {
  for(let i=0;i<NW_PCTS.length-1;i++) {
    if(nw<=NW_PCTS[i+1].v) {
      const lo=NW_PCTS[i],hi=NW_PCTS[i+1];
      const f=(nw-lo.v)/(hi.v-lo.v);
      return Math.round(lo.p+f*(hi.p-lo.p));
    }
  }
  return 99;
}

// ── FIRE levels ───────────────────────────────────────────────────────────
const LEVELS = [
  {name:"Security",     factor:0.65,c:"#3b82f6"},
  {name:"Vitality",     factor:0.825,c:"#22d3ee"},
  {name:"Independence", factor:1.0, c:"#22c55e"},
  {name:"Freedom",      factor:1.5, c:"#f97316"},
  {name:"Absolute",     factor:2.5, c:"#eab308"},
];

export default function DashboardUS({ u, t, ib, pen, setPg, generatePDF, mb }) {
  if(!u) return null;

  const inv       = (u.inv||[]).filter(i=>i.sim!==false);
  const ingresos  = (u.ingresos||[]).filter(i=>i.sim!==false);
  const gasRaw    = u.gas||{};
  const gas       = {};
  Object.entries(gasRaw).forEach(([cat, items]) => {
    const filtered = (items || []).filter(g => g.sim !== false);
    if (filtered.length > 0) gas[cat] = filtered;
  });
  const deu       = (u.deu||[]).filter(d=>d.sim!==false);
  const name      = u.p?.name||"";
  const firstName = (name&&name!=="Usuario")?name.split(" ")[0]:u.p?.email?.split("@")[0]||"";

  // Derived values
  const totalAssets = inv.reduce((s,i)=>s+(i.va||0),0);
  const totalDebt   = deu.reduce((s,d)=>s+(d.mt||0),0);
  const netWorth    = totalAssets - totalDebt;
  const nwPct       = getNWPct(netWorth);

  // Asset allocation
  const byType = {};
  inv.forEach(i=>{const tp=i.tp||i.tipo||"Other";byType[tp]=(byType[tp]||0)+(i.va||0);});
  const pie = Object.entries(byType).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  // Income by category
  const incByCat = {};
  ingresos.forEach(i=>{
    const cat = i.categoria||"Other";
    incByCat[cat]=(incByCat[cat]||0)+((i.mensual||0)*(i.moneda==="USD"?1:1/(u.trm||1)));
  });
  const incPie = Object.entries(incByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  // Expenses by category
  const expByCat = {};
  Object.entries(gas).forEach(([cat,items])=>{
    expByCat[cat]=(items||[]).reduce((s,g)=>s+(g.m||0),0);
  });
  const expPie = Object.entries(expByCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  // Freedom level
  const ratio   = t.te>0?t.ni/t.te:0;
  const lvlIdx  = LEVELS.reduce((idx,l,i)=>ratio>=l.factor?i:idx,-1);
  const curLevel= lvlIdx>=0?LEVELS[lvlIdx]:null;
  const nextLevel= lvlIdx<4?LEVELS[lvlIdx+1]:null;

  // FIRE
  const fireNum  = t.te*12*25;
  const firePct  = fireNum>0?Math.min(netWorth/fireNum*100,100):0;

  // Health score
  const savingsRate = t.ti>0?(t.cf/t.ti*100):0;
  let score = 0;
  if(savingsRate>=20) score+=25; else if(savingsRate>=10) score+=15; else score+=5;
  if(netWorth>0) score+=15; else score+=2;
  if(firePct>=50) score+=20; else if(firePct>=25) score+=10; else score+=3;
  if(nwPct>=75) score+=20; else if(nwPct>=50) score+=12; else score+=4;
  if(t.te>0&&t.ni/t.te>=1) score+=10;
  score=Math.min(100,score);
  const scoreColor = score>=80?T.gn:score>=60?T.cy:score>=40?T.or:T.rd;
  const scoreLabel = score>=80?"Excellent":score>=60?"Good":score>=40?"Fair":"Needs Work";

  // 5yr projection
  const proj = useMemo(()=>{
    const pts=[];
    let bal=netWorth;
    const r=0.08;
    for(let y=0;y<=5;y++){
      pts.push({yr:y===0?"Now":`+${y}y`,v:Math.round(bal)});
      bal=bal*(1+r)+t.cf*12;
    }
    return pts;
  },[netWorth,t.cf]);

  // Cashflow bar
  const cfData = [
    {name:"Income",a:t.ti},
    {name:"Expenses",a:-(t.gfm)},
    {name:"Debt pmts",a:-(t.tc)},
    {name:"Net",a:t.cf},
  ];

  const hour = new Date().getHours();
  const greeting = hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 6px"}}>
            {greeting}{firstName?`, ${firstName}`:""}
          </h1>
          <p style={{color:T.tx2,fontSize:13,margin:0}}>Your financial snapshot</p>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setPg("resumen")}
            style={{background:T.bl,color:"#fff",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
            📋 Summary
          </button>
          <button onClick={generatePDF}
            style={{background:T.gn,color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
            📄 PDF Report
          </button>
        </div>
      </div>

      {/* Net Worth hero + Health Score */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
        <Card s={{padding:0,background:"radial-gradient(ellipse at 30% 0%,rgba(34,197,94,.06),transparent 60%)"}}>
          <div style={{padding:"28px"}}>
            <div style={{fontSize:11,color:T.tx3,letterSpacing:2,fontWeight:600}}>NET WORTH</div>
            <div style={{fontSize:"clamp(2rem,5vw,3rem)",fontWeight:800,letterSpacing:"-0.04em",marginTop:4}}>
              {fm(netWorth)}
            </div>
            <div style={{display:"flex",gap:20,marginTop:16,flexWrap:"wrap"}}>
              {[{l:"Assets",v:fm(totalAssets),c:T.gn},{l:"Debt",v:fm(totalDebt),c:T.rd},{l:"D/A Ratio",v:pct(totalAssets>0?totalDebt/totalAssets*100:0),c:totalDebt/totalAssets<0.5?T.gn:T.rd}].map(k=>(
                <div key={k.l}>
                  <div style={{fontSize:10,color:T.tx3,letterSpacing:1}}>{k.l}</div>
                  <div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:2}}>{k.v}</div>
                </div>
              ))}
            </div>
            {/* US Wealth percentile */}
            <div style={{marginTop:16,background:`${T.pr}10`,border:`1px solid ${T.pr}20`,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:T.pr,fontWeight:700}}>🇺🇸 US WEALTH POSITION (Fed Reserve SCF 2022)</div>
              <div style={{fontSize:13,color:T.tx2,marginTop:4}}>
                You're in the <strong style={{color:T.gn}}>top {100-nwPct}%</strong> of US households by net worth
              </div>
              <div style={{fontSize:10,color:T.tx3,marginTop:2}}>
                Median US household: $192,700 · Top 10%: $1.86M · Top 1%: $11.1M
              </div>
            </div>
          </div>
        </Card>
        <Card s={{padding:"28px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
          <div style={{width:90,height:90,borderRadius:"50%",border:`4px solid ${scoreColor}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
            <div style={{fontSize:28,fontWeight:800,color:scoreColor}}>{score}</div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:scoreColor}}>{scoreLabel}</div>
          <div style={{fontSize:11,color:T.tx3,marginTop:2}}>Financial Health Score</div>
        </Card>
      </div>

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
        <Kpi l="Income/month"  v={fm(t.ti)}  c={T.gn} sub="/month"/>
        <Kpi l="Expenses/month" v={fm(t.te)} c={T.rd} sub="/month"/>
        <Kpi l="Cash Flow"     v={fm(t.cf)}  c={t.cf>=0?T.gn:T.rd} sub="/month"/>
        <Kpi l="Independence"  v={pct(t.ind)} c={t.ind>=100?T.gn:T.tx2} sub={t.ind>=100?"✅ Achieved!":"target 100%"}/>
      </div>

      {/* Financial Freedom Level */}
      <Card s={{padding:20,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>
          🏆 Financial Freedom Level
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          {LEVELS.map((l,i)=>{
            const reached = ratio>=l.factor;
            return(
              <div key={l.name} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:9,color:reached?l.c:T.tx3,fontWeight:reached?700:400}}>{l.name}</div>
                <div style={{fontSize:11,color:reached?l.c:T.tx3,marginTop:2}}>{(l.factor*100).toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
        <div style={{height:12,background:T.bg3,borderRadius:6,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:Math.min(ratio/2.5*100,100)+"%",
            background:"linear-gradient(90deg,#3b82f6,#22d3ee,#22c55e,#f97316,#eab308)",
            borderRadius:6,transition:"width 0.4s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            {curLevel
              ? <span style={{color:curLevel.c,fontWeight:700}}>Level: {curLevel.name} ({pct(ratio*100)} independence)</span>
              : <span style={{color:T.rd}}>Below Security level — need {fm(LEVELS[0].factor*t.te-t.ni)}/mo more</span>}
          </div>
          {nextLevel&&<div style={{fontSize:11,color:T.tx3}}>
            Next: {nextLevel.name} → need +{fm(Math.max(0,nextLevel.factor*t.te-t.ni))}/mo
          </div>}
        </div>
      </Card>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        {/* Monthly cash flow */}
        <Card s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Monthly Cash Flow</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cfData}>
              <ChartGradients/>
              <CartesianGrid {...gridProps}/>
              <XAxis dataKey="name" {...axisProps}/>
              <YAxis {...axisProps} tickFormatter={v=>fm(v).replace("$","")}/>
              <Tooltip cursor={{fill:"rgba(255,255,255,0.03)"}} content={<ChartTooltip formatter={v=>fm(v)}/>}/>
              <Bar dataKey="a" radius={[8,8,0,0]} maxBarSize={64}>
                {cfData.map((d,i)=><Cell key={i} fill={d.a>=0?CHART.green:CHART.red}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Asset allocation */}
        <Card s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Asset Allocation</div>
          {pie.length>0
            ? <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{width:130,height:130,flexShrink:0}}>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={58} paddingAngle={2}>
                        {pie.map((_,i)=><Cell key={i} fill={T.ch[i%T.ch.length]}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{flex:1,fontSize:11}}>
                  {pie.map((p,i)=>(
                    <div key={p.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:2,background:T.ch[i%T.ch.length]}}/>
                        <span style={{color:T.tx2}}>{p.name}</span>
                      </div>
                      <span style={{fontWeight:600,color:T.tx3,fontSize:10}}>
                        {totalAssets>0?(p.value/totalAssets*100).toFixed(0):0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            : <div style={{height:130,display:"flex",alignItems:"center",justifyContent:"center",color:T.tx3}}>
                Add assets to see allocation
              </div>}
        </Card>
      </div>

      {/* Income + Expenses */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
        <Card s={{padding:0}}>
          <div style={{padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💰 Income by Source</span>
            <span style={{fontSize:13,fontWeight:700,color:T.gn}}>{fm(t.ti)}/mo</span>
          </div>
          {ingresos.length>0
            ? ingresos.sort((a,b)=>(b.mensual||0)-(a.mensual||0)).slice(0,6).map((inc,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 18px",borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{inc.nombre||"—"}</div>
                    <div style={{fontSize:10,color:T.tx3}}>{inc.categoria}</div>
                  </div>
                  <div style={{fontWeight:700,color:T.gn}}>{fm(inc.mensual||0)}</div>
                </div>
              ))
            : <div style={{padding:24,textAlign:"center",color:T.tx3}}>Add income sources</div>}
        </Card>
        <Card s={{padding:0}}>
          <div style={{padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,fontWeight:700,color:T.tx2}}>💳 Expenses by Category</span>
            <span style={{fontSize:13,fontWeight:700,color:T.rd}}>{fm(t.gfm)}/mo</span>
          </div>
          {expPie.length>0
            ? expPie.map((exp,i)=>(
                <div key={exp.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 18px",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:3,background:T.ch[i%T.ch.length]}}/>
                    <span>{exp.name}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontWeight:700,color:T.rd}}>{fm(exp.value)}</span>
                    <span style={{fontSize:10,color:T.tx3}}>{t.gfm>0?(exp.value/t.gfm*100).toFixed(0):0}%</span>
                  </div>
                </div>
              ))
            : <div style={{padding:24,textAlign:"center",color:T.tx3}}>Add expenses</div>}
        </Card>
      </div>

      {/* FIRE + Projection */}
      <div style={{display:"grid",gridTemplateColumns:mb?"1fr":"2fr 1fr",gap:14,marginBottom:14}}>
        <Card s={{padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:14}}>Net Worth Projection (8% annual)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={proj}>
              <ChartGradients/>
              <CartesianGrid {...gridProps}/>
              <XAxis dataKey="yr" {...axisProps}/>
              <YAxis {...axisProps} tickFormatter={v=>fm(v).replace("$","")}/>
              <Tooltip content={<ChartTooltip formatter={v=>fm(v)}/>}/>
              <Area type="monotone" dataKey="v" stroke={CHART.green} strokeWidth={2.5} fill="url(#gradGreen)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card s={{padding:24,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:16}}>🔥 FIRE Progress</div>
          <div style={{position:"relative",height:14,background:T.bg3,borderRadius:7,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",width:Math.min(firePct,100)+"%",
              background:firePct>=100?"linear-gradient(90deg,#22c55e,#3b82f6)":"linear-gradient(90deg,#ef4444,#eab308)",
              borderRadius:7,transition:"width 0.5s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.tx3}}>
            <span>0%</span>
            <span style={{color:firePct>=100?T.gn:T.tx2,fontWeight:700}}>{firePct.toFixed(0)}%</span>
            <span>100%</span>
          </div>
          <div style={{marginTop:12,fontSize:12,color:T.tx2}}>
            FIRE Number: <strong>{fm(fireNum)}</strong>
          </div>
          <div style={{fontSize:11,color:T.tx3,marginTop:4}}>
            {firePct>=100
              ? <span style={{color:T.gn}}>🏆 Financially independent!</span>
              : `Need ${fm(Math.max(0,fireNum-netWorth))} more`}
          </div>
          {t.cf>0&&firePct<100&&(
            <div style={{fontSize:11,color:T.tx3,marginTop:4}}>
              At current pace: ~{Math.ceil((fireNum-netWorth)/(t.cf*12))} years
            </div>
          )}
        </Card>
      </div>

      {/* Key alerts */}
      <Card s={{padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:T.or,marginBottom:12}}>🔔 Key Alerts & Recommendations</div>
        {(()=>{
          const alerts = [];
          const savR = t.ti>0?(t.cf/t.ti*100):0;
          const dtiR  = t.ti>0?(t.tc/t.ti*100):0;

          if(t.cf<0) alerts.push({t:"🔴",l:"Negative cash flow",d:`You're spending ${fm(-t.cf)}/month more than you earn. Action required.`});
          if(savR<10&&savR>=0) alerts.push({t:"🟡",l:"Low savings rate",d:`${savR.toFixed(0)}% savings rate — target 20%+ for financial independence.`});
          if(dtiR>40) alerts.push({t:"🔴",l:"High debt-to-income",d:`${dtiR.toFixed(0)}% of income goes to debt payments — target below 36%.`});

          const maxDep = deu.filter(d=>(d.ts||0)>15).sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
          if(maxDep) alerts.push({t:"🔴",l:`High-rate debt: ${maxDep.n}`,d:`${maxDep.ts}% APR — pay this off aggressively. Every dollar saved is a ${maxDep.ts}% guaranteed return.`});

          if(t.ind>=100) alerts.push({t:"🟢",l:"Financial independence achieved!",d:`Your income covers 100%+ of expenses. Keep building your FIRE number.`});
          if(firePct>=75&&firePct<100) alerts.push({t:"🟢",l:`FIRE ${firePct.toFixed(0)}% complete`,d:`Almost there! ${fm(Math.max(0,fireNum-netWorth))} more to financial freedom.`});

          if(alerts.length===0) alerts.push({t:"🟢",l:"Looking good!",d:"No critical issues. Keep up your current strategy and review monthly."});

          return alerts.sort((a,b)=>a.t.localeCompare(b.t)).map((a,i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<alerts.length-1?`1px solid ${T.border}`:"none"}}>
              <span style={{fontSize:16,flexShrink:0}}>{a.t}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.tx}}>{a.l}</div>
                <div style={{fontSize:11,color:T.tx2,marginTop:2,lineHeight:1.5}}>{a.d}</div>
              </div>
            </div>
          ));
        })()}
      </Card>
    </div>
  );
}
