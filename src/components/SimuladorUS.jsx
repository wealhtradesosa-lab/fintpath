/**
 * SimuladorUS.jsx
 * US Financial Freedom Simulator
 * Sliders for income/expenses → real-time financial independence index
 * 5 levels: Security → Vitality → Independence → Freedom → Absolute
 */
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const T = {
  bg2:"#18181b", bg3:"#27272a", card:"#111113",
  border:"rgba(255,255,255,0.06)",
  tx:"#fafafa", tx2:"#a1a1aa", tx3:"#71717a",
  gn:"#22c55e", rd:"#ef4444", bl:"#3b82f6",
  pr:"#a78bfa", or:"#f97316", cy:"#22d3ee", gd:"#eab308",
};
const fm = (n) => "$" + Math.round(Math.abs(n||0)).toLocaleString("en-US");

// ── 5 Levels of Financial Freedom ─────────────────────────────────────────
const LEVELS = [
  { id:1, name:"Security",      icon:"🛡️",  color:"#3b82f6", factor:0.65,
    desc:"Passive income covers basic needs",
    detail:"Your income covers 65% of expenses — housing, food, utilities, transport, basic insurance. If you lost your job, your assets would keep you alive." },
  { id:2, name:"Vitality",      icon:"⚡",  color:"#22d3ee", factor:0.825,
    desc:"Security + half your lifestyle",
    detail:"Your income covers 82.5% of expenses. Beyond basics, you can maintain half your current lifestyle: some entertainment, modest travel, education." },
  { id:3, name:"Independence",  icon:"🏆",  color:"#22c55e", factor:1.0,
    desc:"Income covers 100% of all expenses",
    detail:"The breakpoint! Your income covers ALL your current expenses. You no longer need a job to maintain your lifestyle. You could stop working today and live the same." },
  { id:4, name:"Freedom",       icon:"🚀",  color:"#f97316", factor:1.5,
    desc:"Independence + 50% extra for luxuries",
    detail:"Your income is 1.5× your expenses. You have margin for luxuries, travel, expensive hobbies, giving to causes you care about. You can upgrade your lifestyle without worry." },
  { id:5, name:"Absolute",      icon:"👑",  color:"#eab308", factor:2.5,
    desc:"Income is 2.5× your expenses",
    detail:"The maximum level. Your income is 2.5× your expenses. You can do what you want, when you want, where you want. Money is no longer a constraint." },
];

// ── Slider component ────────────────────────────────────────────────────────
function Slider({ label, value, base, max, color, onChange, sub }) {
  const diff = value - base;
  return (
    <div style={{marginBottom:4,background:color+"10",padding:"8px 12px",borderRadius:8,borderLeft:"3px solid "+color}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:12,color:T.tx2,fontWeight:500}}>
          {label} {sub && <span style={{fontSize:10,color:T.tx3}}>{sub}</span>}
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {diff !== 0 && (
            <span style={{fontSize:10,color:diff>0?T.gn:T.rd,fontWeight:600}}>
              {diff>0?"+":""}{fm(diff)}
            </span>
          )}
          <span style={{fontSize:12,fontWeight:700,color}}>{fm(value)}</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <input type="range" min="0" max={max} step={Math.max(Math.round(max*0.01),5)}
          value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{flex:1,accentColor:color,height:4,cursor:"pointer"}}/>
        <span style={{fontSize:10,color:T.tx3,minWidth:32,textAlign:"right"}}>
          {base>0?Math.round(value/base*100):100}%
        </span>
      </div>
    </div>
  );
}

// ── Freedom Bar ─────────────────────────────────────────────────────────────
function FreedomBar({ ni, te }) {
  const [expanded, setExpanded] = useState(null);
  const ratio = te > 0 ? ni / te : 0;
  let currentLevel = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (ratio >= LEVELS[i].factor) currentLevel = i + 1;
  }
  const current = currentLevel > 0 ? LEVELS[currentLevel-1] : null;
  const next    = currentLevel < 5 ? LEVELS[currentLevel] : null;
  const progress = Math.min((ratio / LEVELS[4].factor) * 100, 100);
  const gap = next ? Math.max(0, next.factor * te - ni) : 0;

  return (
    <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:20,padding:24,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,margin:0}}>Financial Freedom Index</h3>
          <p style={{fontSize:12,color:T.tx3,margin:"3px 0 0"}}>5 levels · Updates in real time</p>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:28,fontWeight:900,color:current?.color||T.tx3}}>
            {(ratio*100).toFixed(0)}%
          </div>
          <div style={{fontSize:11,color:T.tx3}}>independence ratio</div>
        </div>
      </div>

      {/* Progress bar with level markers */}
      <div style={{position:"relative",marginBottom:20}}>
        <div style={{height:16,background:T.bg3,borderRadius:8,overflow:"hidden",position:"relative"}}>
          <div style={{
            height:"100%",
            width:Math.min(progress,100)+"%",
            background:`linear-gradient(90deg,#3b82f6,#22d3ee,#22c55e,#f97316,#eab308)`,
            borderRadius:8,transition:"width 0.3s ease",
          }}/>
        </div>
        {/* Level markers */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          {LEVELS.map(l=>{
            const pos = (l.factor / LEVELS[4].factor) * 100;
            const reached = ratio >= l.factor;
            return (
              <div key={l.id} onClick={()=>setExpanded(expanded===l.id?null:l.id)}
                style={{cursor:"pointer",textAlign:"center",flex:1}}>
                <div style={{fontSize:16,filter:reached?"none":"grayscale(1) opacity(0.4)"}}>{l.icon}</div>
                <div style={{fontSize:9,color:reached?l.color:T.tx3,fontWeight:reached?700:400}}>{l.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current level card */}
      <div style={{
        background:current?`${current.color}12`:T.bg3,
        border:`1px solid ${current?.color||T.border}40`,
        borderRadius:12,padding:"12px 16px",marginBottom:12,
      }}>
        {current ? (
          <>
            <div style={{fontSize:13,fontWeight:700,color:current.color}}>
              {current.icon} Level {current.id}: {current.name}
            </div>
            <div style={{fontSize:11,color:T.tx2,marginTop:4,lineHeight:1.6}}>{current.desc}</div>
          </>
        ) : (
          <>
            <div style={{fontSize:13,fontWeight:700,color:T.tx3}}>⬇️ Below Security Level</div>
            <div style={{fontSize:11,color:T.tx2,marginTop:4}}>
              Your income doesn't yet cover 65% of expenses. Need +{fm(LEVELS[0].factor*te - ni)}/mo more.
            </div>
          </>
        )}
      </div>

      {/* Next level */}
      {next && (
        <div style={{background:T.bg3,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:T.tx3}}>Next level: {next.icon} {next.name}</div>
            <div style={{fontSize:11,color:T.tx2,marginTop:2}}>Need +{fm(gap)}/month more income</div>
          </div>
          <div style={{fontSize:11,color:next.color,fontWeight:700}}>
            {(next.factor*100).toFixed(0)}% target
          </div>
        </div>
      )}
      {!next && ratio >= LEVELS[4].factor && (
        <div style={{background:`${T.gd}15`,border:`1px solid ${T.gd}40`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.gd}}>👑 Absolute Financial Freedom Achieved!</div>
          <div style={{fontSize:11,color:T.tx2,marginTop:4}}>Your income is {(ratio*100).toFixed(0)}% of your expenses. Money is no longer a constraint.</div>
        </div>
      )}

      {/* Expanded level detail */}
      {expanded && (
        <div style={{marginTop:12,background:`${LEVELS[expanded-1].color}10`,border:`1px solid ${LEVELS[expanded-1].color}30`,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:12,fontWeight:700,color:LEVELS[expanded-1].color,marginBottom:6}}>
            {LEVELS[expanded-1].icon} {LEVELS[expanded-1].name} — What this means
          </div>
          <div style={{fontSize:11,color:T.tx2,lineHeight:1.7}}>{LEVELS[expanded-1].detail}</div>
          <div style={{fontSize:11,color:T.tx3,marginTop:6}}>
            Target: income ≥ {fm(LEVELS[expanded-1].factor * te)}/month ({(LEVELS[expanded-1].factor*100).toFixed(0)}% of expenses)
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function SimuladorUS({ user, totals }) {
  const ingresos = user?.ingresos || [];
  const gastos   = user?.gastos   || {};
  const deudas   = user?.deudas   || [];

  // Build slider maps with base values
  const baseIncome = useMemo(() => {
    const map = {};
    ingresos.forEach((ing, i) => {
      const monthly = (ing.mensual||0) * (ing.moneda==="USD" ? 1 : 1/(user?.trm||1));
      map[`ing_${i}`] = { label: ing.nombre||`Income ${i+1}`, base: monthly, cat: ing.categoria };
    });
    return map;
  }, [ingresos, user?.trm]);

  const baseExpenses = useMemo(() => {
    const map = {};
    Object.entries(gastos).forEach(([cat, items]) => {
      (items||[]).forEach((g, j) => {
        if (g.sim === false) return;
        map[`gf_${cat}_${j}`] = { label: g.c||cat, base: g.m||0, cat };
      });
    });
    return map;
  }, [gastos]);

  const baseDebt = useMemo(() => {
    const map = {};
    deudas.forEach((d, i) => {
      if (d.sim === false) return;
      map[`deu_${i}`] = { label: d.n||`Loan ${i+1}`, base: d.pg||0 };
    });
    return map;
  }, [deudas]);

  // Slider state
  const [incomeVals,  setIncomeVals]  = useState({});
  const [expenseVals, setExpenseVals] = useState({});
  const [debtVals,    setDebtVals]    = useState({});

  const getInc = (k) => incomeVals[k]  ?? baseIncome[k]?.base  ?? 0;
  const getExp = (k) => expenseVals[k] ?? baseExpenses[k]?.base ?? 0;
  const getDbt = (k) => debtVals[k]    ?? baseDebt[k]?.base    ?? 0;

  // Simulated totals
  const simT = useMemo(() => {
    const ni  = Object.keys(baseIncome).reduce((s,k)  => s + getInc(k), 0);
    const gfm = Object.keys(baseExpenses).reduce((s,k) => s + getExp(k), 0);
    const tc  = Object.keys(baseDebt).reduce((s,k)    => s + getDbt(k), 0);
    const te  = gfm + tc;
    const cf  = ni - te;
    const ind = te > 0 ? (ni / te) * 100 : 0;
    return { ni, gfm, tc, te, cf, ind };
  }, [incomeVals, expenseVals, debtVals, baseIncome, baseExpenses, baseDebt]);

  const base = totals || {};
  const fireNumber = (simT.te * 12) / 0.04;
  const fireProgress = fireNumber > 0 ? Math.min(((base.nw||0) / fireNumber) * 100, 100) : 0;

  // Scenario selector
  const [scenario, setScenario] = useState("actual");
  const SCENARIOS = [
    { id:"actual",      l:"📊 Actual",       income:1,    expenses:1 },
    { id:"conservador", l:"😟 Bear Case",     income:0.80, expenses:1.05 },
    { id:"optimista",   l:"🚀 Bull Case",     income:1.30, expenses:0.90 },
    { id:"crisis",      l:"🔴 Crisis",        income:0.60, expenses:1.10 },
  ];
  const applyScenario = (s) => {
    setScenario(s.id);
    if (s.id === "actual") { setIncomeVals({}); setExpenseVals({}); setDebtVals({}); return; }
    const newInc = {}, newExp = {};
    Object.keys(baseIncome).forEach(k  => newInc[k] = Math.round((baseIncome[k].base||0)  * s.income));
    Object.keys(baseExpenses).forEach(k => newExp[k] = Math.round((baseExpenses[k].base||0) * s.expenses));
    setIncomeVals(newInc); setExpenseVals(newExp);
  };

  // 5-year projection
  const projection = useMemo(() => {
    const points = [];
    const nw = base.nw || 0;
    const monthly = simT.cf;
    const r = 0.07 / 12;
    let bal = nw;
    for (let m = 0; m <= 60; m++) {
      if (m % 12 === 0) points.push({ year: `Y${m/12}`, value: Math.round(bal) });
      bal = bal * (1 + r) + monthly;
    }
    return points;
  }, [simT.cf, base.nw]);

  const noData = ingresos.length === 0 && Object.keys(gastos).length === 0;

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🖥️ Financial Freedom Simulator</h2>
        <p style={{color:T.tx3,fontSize:12,margin:0}}>
          Move the sliders to see how changes affect your financial independence in real time
        </p>
      </div>

      {noData && (
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:14,padding:48,textAlign:"center",color:T.tx3,marginBottom:20}}>
          <div style={{fontSize:32,marginBottom:12}}>📊</div>
          <div style={{fontSize:15,fontWeight:700,color:T.tx2,marginBottom:8}}>No data yet</div>
          <div style={{fontSize:13}}>Add your income and expenses first, then come back here to simulate scenarios.</div>
        </div>
      )}

      {/* Scenario buttons */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {SCENARIOS.map(s=>(
          <button key={s.id} onClick={()=>applyScenario(s)}
            style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${scenario===s.id?T.gn:T.border}`,
              background:scenario===s.id?`${T.gn}12`:T.card,color:scenario===s.id?T.gn:T.tx2,
              cursor:"pointer",fontSize:12,fontWeight:scenario===s.id?700:400}}>
            {s.l}
          </button>
        ))}
        <button onClick={()=>{setIncomeVals({});setExpenseVals({});setDebtVals({});setScenario("actual");}}
          style={{padding:"8px 16px",borderRadius:10,border:"1px solid "+T.border,
            background:"transparent",color:T.tx3,cursor:"pointer",fontSize:12,marginLeft:"auto"}}>
          ↺ Reset
        </button>
      </div>

      {/* Freedom index */}
      <FreedomBar ni={simT.ni} te={simT.te} />

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {[
          {l:"Monthly Income",   v:fm(simT.ni),  c:T.gn,  d:fm(simT.ni-(base.ti||0))},
          {l:"Monthly Expenses", v:fm(simT.te),  c:T.rd,  d:fm(simT.te-(base.te||0))},
          {l:"Cash Flow",        v:fm(simT.cf),  c:simT.cf>=0?T.gn:T.rd, d:fm(simT.cf-(base.cf||0))},
          {l:"Independence",     v:(simT.ind).toFixed(0)+"%", c:simT.ind>=100?T.gn:T.or},
          {l:"FIRE Progress",    v:fireProgress.toFixed(0)+"%", c:fireProgress>=100?T.gn:T.or,
           sub:`of ${fm(fireNumber)}`},
        ].map(k=>(
          <div key={k.l} style={{background:T.card,border:"1px solid "+T.border,borderRadius:12,padding:"14px 16px"}}>
            <div style={{fontSize:9,color:T.tx3,textTransform:"uppercase",letterSpacing:1}}>{k.l}</div>
            <div style={{fontSize:18,fontWeight:800,color:k.c,marginTop:4,fontFamily:"monospace"}}>{k.v}</div>
            {k.d && k.d !== "$0" && (
              <div style={{fontSize:10,color:parseFloat(k.d)>0?T.gn:T.rd,marginTop:2}}>
                {parseFloat(k.d)>0?"+":""}{k.d} vs actual
              </div>
            )}
            {k.sub && <div style={{fontSize:9,color:T.tx3,marginTop:2}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Sliders grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>

        {/* Income sliders */}
        {ingresos.length > 0 && (
          <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:14,padding:18}}>
            <div style={{fontSize:13,fontWeight:700,color:T.gn,marginBottom:12}}>
              💰 Income Sources
              <span style={{fontSize:10,color:T.tx3,fontWeight:400,marginLeft:8}}>
                Total: {fm(simT.ni)}/mo
              </span>
            </div>
            {Object.entries(baseIncome).map(([k, info]) => (
              <Slider key={k}
                label={info.label}
                value={getInc(k)}
                base={info.base}
                max={Math.round(info.base * 2.5) || 10000}
                color={T.gn}
                onChange={v => setIncomeVals(p=>({...p,[k]:v}))}
                sub={info.cat}
              />
            ))}
            {ingresos.length === 0 && (
              <div style={{fontSize:12,color:T.tx3,textAlign:"center",padding:"16px 0"}}>
                No income sources added yet
              </div>
            )}
          </div>
        )}

        {/* Expense + Debt sliders */}
        <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:14,padding:18}}>
          <div style={{fontSize:13,fontWeight:700,color:T.rd,marginBottom:12}}>
            💳 Expenses & Debt Payments
            <span style={{fontSize:10,color:T.tx3,fontWeight:400,marginLeft:8}}>
              Total: {fm(simT.te)}/mo
            </span>
          </div>

          {/* Expenses by category */}
          {Object.entries(
            Object.entries(baseExpenses).reduce((acc, [k, info]) => {
              if (!acc[info.cat]) acc[info.cat] = [];
              acc[info.cat].push([k, info]);
              return acc;
            }, {})
          ).map(([cat, items]) => (
            <div key={cat} style={{marginBottom:8}}>
              <div style={{fontSize:10,color:T.tx3,fontWeight:600,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{cat}</div>
              {items.map(([k, info]) => (
                <Slider key={k}
                  label={info.label}
                  value={getExp(k)}
                  base={info.base}
                  max={Math.round(info.base * 2.5) || 2000}
                  color={T.rd}
                  onChange={v => setExpenseVals(p=>({...p,[k]:v}))}
                />
              ))}
            </div>
          ))}

          {/* Debt payments */}
          {Object.keys(baseDebt).length > 0 && (
            <div style={{marginTop:8}}>
              <div style={{fontSize:10,color:T.tx3,fontWeight:600,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>Debt Payments</div>
              {Object.entries(baseDebt).map(([k, info]) => (
                <Slider key={k}
                  label={info.label}
                  value={getDbt(k)}
                  base={info.base}
                  max={Math.round(info.base * 2) || 2000}
                  color={T.or}
                  onChange={v => setDebtVals(p=>({...p,[k]:v}))}
                />
              ))}
            </div>
          )}

          {Object.keys(baseExpenses).length === 0 && Object.keys(baseDebt).length === 0 && (
            <div style={{fontSize:12,color:T.tx3,textAlign:"center",padding:"16px 0"}}>
              No expenses added yet
            </div>
          )}
        </div>
      </div>

      {/* 5-year projection */}
      <div style={{background:T.card,border:"1px solid "+T.border,borderRadius:14,padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:T.tx2,marginBottom:4}}>
          📈 5-Year Net Worth Projection
        </div>
        <div style={{fontSize:11,color:T.tx3,marginBottom:14}}>
          Based on {fm(simT.cf)}/month cash flow + 7% annual return on existing portfolio
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={projection}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="year" tick={{fill:T.tx3,fontSize:11}} axisLine={false}/>
            <YAxis tick={{fill:T.tx3,fontSize:10}} axisLine={false}
              tickFormatter={v=>v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${(v/1000).toFixed(0)}K`:`$${v}`}/>
            <Tooltip
              contentStyle={{background:T.bg2,border:"1px solid "+T.border,borderRadius:10,color:T.tx,fontSize:12}}
              formatter={v=>["$"+Math.round(v).toLocaleString(),"Net Worth"]}/>
            <Area type="monotone" dataKey="value"
              stroke={simT.cf>=0?T.gn:T.rd}
              fill={(simT.cf>=0?T.gn:T.rd)+"20"}
              strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
