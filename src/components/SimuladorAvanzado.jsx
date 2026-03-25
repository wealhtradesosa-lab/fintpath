import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const T = {
  bg2: "#18181b", bg3: "#27272a", bg4: "#2a2a32",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  rd: "#ef4444", rdD: "rgba(239,68,68,0.08)",
  bl: "#3b82f6", pr: "#a78bfa", or: "#f97316", gd: "#eab308", cy: "#22d3ee",
};
const fm = (n) => "$" + Math.round(n).toLocaleString("en-US");
const pc = (n) => (n || 0).toFixed(1) + "%";
const TT = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 12 };

// ─── Tony Robbins 5 Levels ───
const LEVELS = [
  { id: 1, name: "Seguridad", icon: "🛡️", color: "#3b82f6", factor: 0.65, desc: "Pasivos cubren necesidades básicas" },
  { id: 2, name: "Vitalidad", icon: "⚡", color: "#22d3ee", factor: 0.825, desc: "Seguridad + mitad estilo de vida" },
  { id: 3, name: "Independencia", icon: "🏆", color: "#22c55e", factor: 1.0, desc: "Pasivos cubren 100% gastos" },
  { id: 4, name: "Libertad", icon: "🚀", color: "#f97316", factor: 1.5, desc: "Independencia + lujos" },
  { id: 5, name: "Absoluta", icon: "👑", color: "#eab308", factor: 2.5, desc: "Sin límites" },
];

function Slider({ label, value, base, max, color, onChange, sub }) {
  const perc = base > 0 ? Math.round((value / base) * 100) : 100;
  const diff = value - base;
  return (
    <div style={{ marginBottom: 4, background: color + "08", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid " + color }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: T.txt2, fontWeight: 500 }}>
          {label} {sub && <span style={{ fontSize: 10, color: T.txt3 }}>{sub}</span>}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {diff !== 0 && <span style={{ fontSize: 10, color: diff > 0 ? T.gn : T.rd, fontWeight: 600 }}>{diff > 0 ? "+" : ""}{fm(diff)}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{fm(value)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="range" min="0" max={max} step={Math.max(Math.round(max * 0.01), 5)} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color, height: 4, cursor: "pointer" }} />
        <span style={{ fontSize: 10, color: T.txt3, minWidth: 32, textAlign: "right" }}>{perc}%</span>
      </div>
    </div>
  );
}

// ─── FREEDOM BAR (inline, reactive) ───
function FreedomBarLive({ ni, te, cf }) {
  const ratio = te > 0 ? ni / te : 0;
  let currentLevel = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (ratio >= LEVELS[i].factor) currentLevel = i + 1;
  }
  const overallProg = Math.min((ratio / LEVELS[4].factor) * 100, 100);
  const currentData = currentLevel > 0 ? LEVELS[currentLevel - 1] : null;
  const nextData = currentLevel < 5 ? LEVELS[currentLevel] : null;
  const monthlyGap = nextData ? Math.max(0, nextData.factor * te - ni) : 0;

  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 20, padding: 24, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tu Nivel de Libertad Financiera</h3>
          <p style={{ fontSize: 12, color: T.txt3, margin: "3px 0 0" }}>Tony Robbins — 5 niveles • Reacciona en tiempo real</p>
        </div>
        {currentData && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: currentData.color + "15", border: "1px solid " + currentData.color + "25", borderRadius: 12, padding: "8px 16px" }}>
            <span style={{ fontSize: 20 }}>{currentData.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: currentData.color }}>{currentData.name}</div>
              <div style={{ fontSize: 10, color: T.txt3 }}>Nivel {currentLevel}/5</div>
            </div>
          </div>
        )}
        {!currentData && (
          <div style={{ background: T.bg3, borderRadius: 12, padding: "8px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.txt3 }}>Sin nivel aún</div>
            <div style={{ fontSize: 10, color: T.txt3 }}>Agrega ingresos</div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 36, background: T.bg3, borderRadius: 18, overflow: "hidden", position: "relative" }}>
          {/* Level markers */}
          {LEVELS.map((l, i) => {
            const pos = (l.factor / LEVELS[4].factor) * 100;
            return (
              <div key={i} style={{ position: "absolute", left: pos + "%", top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.1)", zIndex: 2 }}>
                <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 16 }}>{l.icon}</div>
              </div>
            );
          })}
          {/* Fill bar */}
          <div style={{
            width: overallProg + "%", height: "100%",
            background: "linear-gradient(90deg, #3b82f6 0%, #22d3ee 20%, #22c55e 40%, #f97316 70%, #eab308 100%)",
            borderRadius: 18, transition: "width 0.3s ease",
            display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 14,
            minWidth: overallProg > 3 ? 50 : 0,
          }}>
            {overallProg > 8 && (
              <span style={{ fontSize: 13, fontWeight: 800, color: "#000" }}>{Math.round(ratio * 100)}%</span>
            )}
          </div>
        </div>

        {/* Level labels */}
        <div style={{ display: "flex", position: "relative", height: 20, marginTop: 6 }}>
          {LEVELS.map((l) => {
            const pos = (l.factor / LEVELS[4].factor) * 100;
            const reached = currentLevel >= l.id;
            return (
              <div key={l.id} style={{ position: "absolute", left: pos + "%", transform: "translateX(-50%)", textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: reached ? 700 : 500, color: reached ? l.color : T.txt3 }}>{l.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Level mini-cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 16 }}>
        {LEVELS.map((l) => {
          const reached = currentLevel >= l.id;
          const current = currentLevel === l.id;
          const needed = l.factor * te;
          return (
            <div key={l.id} style={{
              background: current ? l.color + "12" : reached ? "rgba(255,255,255,0.02)" : T.bg3,
              border: "1px solid " + (current ? l.color + "40" : reached ? l.color + "20" : T.border),
              borderRadius: 12, padding: "10px 8px", textAlign: "center", position: "relative",
              opacity: reached || current ? 1 : 0.4,
            }}>
              {reached && <div style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: l.color }} />}
              <div style={{ fontSize: 18, marginBottom: 4 }}>{l.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: reached ? l.color : T.txt3, lineHeight: 1.2 }}>{l.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? l.color : T.txt2, fontFamily: "monospace", marginTop: 4 }}>
                {fm(needed)}<span style={{ fontSize: 8 }}>/m</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next level info */}
      {nextData && (
        <div style={{ background: nextData.color + "08", border: "1px solid " + nextData.color + "20", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: nextData.color }}>{nextData.icon} Siguiente: {nextData.name}</span>
            <span style={{ fontSize: 12, color: T.txt3, marginLeft: 8 }}>{nextData.desc}</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.txt3 }}>Te faltan</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: nextData.color }}>{fm(monthlyGap)}<span style={{ fontSize: 10 }}>/mes</span></div>
            </div>
          </div>
        </div>
      )}
      {currentLevel >= 5 && (
        <div style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.04))", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.gd }}>¡Libertad Absoluta!</div>
          <div style={{ fontSize: 13, color: T.txt2 }}>Pasivos = {Math.round(ratio * 100)}% de gastos</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN SIMULATOR
// ═══════════════════════════════════════
export default function SimuladorAvanzado({ user, totals }) {
  const [simVals, setSimVals] = useState({});
  const [scenario, setScenario] = useState("actual");

  const setVal = useCallback((key, val) => {
    setSimVals((prev) => ({ ...prev, [key]: val }));
  }, []);

  const getVal = useCallback((key, def) => {
    return simVals[key] !== undefined ? simVals[key] : def;
  }, [simVals]);

  const applyScenario = (id) => {
    setScenario(id);
    if (id === "actual") { setSimVals({}); return; }
    const f = { conservador: { i: 0.8, g: 1.1 }, optimista: { i: 1.3, g: 0.85 }, crisis: { i: 0.6, g: 1.05 } }[id] || { i: 1, g: 1 };
    const nv = {};
    (user.inv || []).forEach((inv) => {
      const items = (inv.unidades||inv.un)
        ? (inv.unidades||inv.un).flatMap((u, ui) => [
            ...((u.ingresos||u.ig||[])).map((ig, ii) => ({ key: `i_${inv.id}_u${ui}_${ii}`, base: ig.m, isI: true })),
            ...((u.gastos||u.gs||[])).map((g, gi) => ({ key: `g_${inv.id}_u${ui}_${gi}`, base: g.m, isI: false })),
          ])
        : [
            ...((inv.ingresos||inv.ig||[])).map((ig, ii) => ({ key: `i_${inv.id}_${ii}`, base: ig.m, isI: true })),
            ...((inv.gastos||inv.gs||[])).map((g, gi) => ({ key: `g_${inv.id}_${gi}`, base: g.m, isI: false })),
          ];
      items.forEach((it) => { nv[it.key] = Math.round(it.base * (it.isI ? f.i : f.g)); });
    });
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g, gi) => { nv[`gf_${cat}_${gi}`] = Math.round(g.m * f.g); });
    });
    (user.ingresos || []).forEach((ing, ii) => { nv[`ing_${ii}`] = Math.round((ing.mensual || 0) * f.i); });
    (user.deudas || []).forEach((d, di) => { nv[`debt_${di}`] = (d.pago||d.pg||0); });
    // Standalone ingresos
    (user.ingresos || []).forEach((ing, ii) => { nv[`ing_${ii}`] = Math.round((ing.mensual || 0) * f.i); });
    setSimVals(nv);
  };

  // ── Simulated totals (reactive) ──
  const simT = useMemo(() => {
    let tI = 0, tG = 0;
    (user.inv || []).forEach((inv) => {
      if (inv.unidades||inv.un) {
        (inv.unidades||inv.un).forEach((u, ui) => {
          ((u.ingresos||u.ig||[])).forEach((ig, ii) => { tI += getVal(`i_${inv.id}_u${ui}_${ii}`, ig.m); });
          ((u.gastos||u.gs||[])).forEach((g, gi) => { tG += getVal(`g_${inv.id}_u${ui}_${gi}`, g.m); });
        });
      } else {
        ((inv.ingresos||inv.ig||[])).forEach((ig, ii) => { tI += getVal(`i_${inv.id}_${ii}`, ig.m); });
        ((inv.gastos||inv.gs||[])).forEach((g, gi) => { tG += getVal(`g_${inv.id}_${gi}`, g.m); });
      }
    });
    // Standalone ingresos
    let tIng = 0;
    (user.ingresos || []).forEach((ing, ii) => {
      tIng += getVal(`ing_${ii}`, ing.mensual || 0);
    });
    tI += tIng;

    let tGF = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g, gi) => { tGF += getVal(`gf_${cat}_${gi}`, g.m); });
    });
    let tD = 0;
    (user.deudas || []).forEach((d, di) => { tD += getVal(`debt_${di}`, (d.pago||d.pg||0)); });
    const ni = tI - tG, te = tGF + tD, cf = ni - te;
    return { tI, tG, ni, tGF, tD, te, cf, ind: te > 0 ? (ni / te) * 100 : 0 };
  }, [user, simVals, getVal]);

  const proj = useMemo(() => {
    const nw = totals.nw || 0;
    return Array.from({ length: 13 }, (_, i) => ({
      m: "M" + i,
      actual: nw + (totals.cf || 0) * i,
      simulado: nw + simT.cf * i,
    }));
  }, [totals, simT]);

  const scs = [
    { id: "actual", i: "📋", l: "Actual", d: "Valores reales", c: T.bl },
    { id: "conservador", i: "🐢", l: "Conservador", d: "Ing -20%, gas +10%", c: T.txt2 },
    { id: "optimista", i: "🚀", l: "Optimista", d: "Ing +30%, gas -15%", c: T.gn },
    { id: "crisis", i: "⚠️", l: "Crisis", d: "Ing -40%", c: T.rd },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Simulador Financiero</h2><button onClick={()=>window.print()} style={{background:"#22c55e",color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,marginLeft:12}}>📄 PDF</button>
      <p style={{ color: T.txt3, fontSize: 13, marginBottom: 20 }}>Ajusta cada ingreso y gasto — la barra de libertad reacciona en tiempo real</p>

      {/* ═══ FREEDOM BAR — reacts to simulated values ═══ */}
      <FreedomBarLive ni={simT.ni} te={simT.te} cf={simT.cf} />

      {/* Scenario presets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        {scs.map((sc) => {
          const a = scenario === sc.id;
          return (
            <button key={sc.id} onClick={() => applyScenario(sc.id)} style={{
              padding: 14, borderRadius: 14, border: "2px solid " + (a ? sc.c : T.border),
              background: a ? sc.c + "10" : T.card, cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontSize: 20 }}>{sc.i}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: a ? sc.c : T.txt2 }}>{sc.l}</div>
              <div style={{ fontSize: 9, color: T.txt3 }}>{sc.d}</div>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Ingreso Neto", v: fm(simT.ni), c: T.gn, d: fm(simT.ni - (totals.ni || 0)) },
          { l: "Gastos Total", v: fm(simT.te), c: T.rd, d: fm(simT.te - (totals.te || 0)) },
          { l: "Cash Flow", v: fm(simT.cf), c: simT.cf >= 0 ? T.gn : T.rd, d: fm(simT.cf - (totals.cf || 0)) },
          { l: "Independencia", v: pc(simT.ind), c: simT.ind >= 100 ? T.gn : T.txt2 },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
            {m.d && <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>Δ {m.d}</div>}
          </div>
        ))}
      </div>

      {/* Sliders + Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* LEFT: Sliders */}
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 8 }}>
          {/* Investment sliders */}
          <h4 style={{ fontSize: 13, color: T.gn, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>📈 Activos — Ingresos & Gastos</h4>
          {(user.inv || []).map((inv) => {
            const items = (inv.unidades||inv.un)
              ? (inv.unidades||inv.un).flatMap((u, ui) => [
                  ...((u.ingresos||u.ig||[])).map((ig, ii) => ({ key: `i_${inv.id}_u${ui}_${ii}`, label: (u.nombre||u.n) + ": " + ig.c, base: ig.m, tp: "i" })),
                  ...((u.gastos||u.gs||[])).map((g, gi) => ({ key: `g_${inv.id}_u${ui}_${gi}`, label: (u.nombre||u.n) + ": " + g.c, base: g.m, tp: "g" })),
                ])
              : [
                  ...((inv.ingresos||inv.ig||[])).map((ig, ii) => ({ key: `i_${inv.id}_${ii}`, label: ig.c, base: ig.m, tp: "i" })),
                  ...((inv.gastos||inv.gs||[])).map((g, gi) => ({ key: `g_${inv.id}_${gi}`, label: g.c, base: g.m, tp: "g" })),
                ];
            if (!items.length) return null;
            const sI = items.filter((x) => x.tp === "i").reduce((s, x) => s + getVal(x.key, x.base), 0);
            const sG = items.filter((x) => x.tp === "g").reduce((s, x) => s + getVal(x.key, x.base), 0);
            const sNOI = sI - sG;
            return (
              <div key={inv.id} style={{ marginBottom: 10, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid " + T.gn + "20", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: T.bg2, borderBottom: "1px solid " + T.gn + "15", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{inv.nombre||inv.n||"Sin nombre"}</span>
                    <span style={{ fontSize: 10, color: T.txt3, marginLeft: 6 }}>{(inv.ubi||inv.ub||"")}{inv.tasa ? " • " + inv.tasa + "% anual" : ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {sI > 0 && <span style={{ fontSize: 11, color: T.gn, fontWeight: 600 }}>↑{fm(sI)}</span>}
                    {sG > 0 && <span style={{ fontSize: 11, color: T.txt2, fontWeight: 600 }}>↓{fm(sG)}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: sNOI >= 0 ? T.gn : T.rd, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 6 }}>
                      NOI: {fm(sNOI)}
                    </span>
                    {(inv.va||inv.valor_actual||0) > 0 && <span style={{ fontSize: 10, color: T.txt3 }}>Capital: {fm(inv.va||inv.valor_actual||0)}</span>}
                    {inv.tasa > 0 && sI > 0 && <span style={{ fontSize: 10, color: T.txt3 }}>Necesitas: {fm(Math.round(sI * 12 / (inv.tasa/100)))} al {inv.tasa}%</span>}
                  </div>
                </div>
                <div style={{ padding: "6px 8px" }}>
                  {items.map((it) => (
                    <Slider key={it.key} label={it.label} value={getVal(it.key, it.base)} base={it.base}
                      max={Math.max(it.base * 3, 500)} color={it.tp === "i" ? T.gn : T.rd}
                      onChange={(v) => setVal(it.key, v)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Standalone income sliders */}
          {(user.ingresos || []).length > 0 && (
            <>
              <h4 style={{ fontSize: 13, color: "#22d3ee", fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>💰 Ingresos Personales</h4>
              {(user.ingresos || []).map((ing, ii) => (
                <Slider key={`ing_${ii}`} label={ing.nombre || "Ingreso"} value={getVal(`ing_${ii}`, ing.mensual || 0)} base={ing.mensual || 0}
                  max={Math.max((ing.mensual || 0) * 3, 1000)} color="#22d3ee"
                  onChange={(v) => setVal(`ing_${ii}`, v)} sub={ing.categoria || ing.tipo || ""} />
              ))}
            </>
          )}

          {/* Family expense sliders */}
          <h4 style={{ fontSize: 13, color: T.rd, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>💳 Gastos Familiares</h4>
          {Object.entries(user.gastos || {}).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 700, margin: "8px 0 4px", paddingTop: 4, borderTop: "1px solid " + T.border }}>{cat}</div>
              {items.map((g, gi) => (
                <Slider key={`gf_${cat}_${gi}`} label={g.c} value={getVal(`gf_${cat}_${gi}`, g.m)} base={g.m}
                  max={Math.max(g.m * 3, 500)} color={T.rd}
                  onChange={(v) => setVal(`gf_${cat}_${gi}`, v)} sub={g.t === "fijo" || g.t === "f" ? "fijo" : "var"} />
              ))}
            </div>
          ))}

          {/* Debt payment sliders */}
          <h4 style={{ fontSize: 13, color: T.pr, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>📋 Cuotas de Deudas</h4>
          {(user.deudas || []).map((d, di) => {
            const lk = (user.inv || []).find((i) => i.id === ((d.link||d.la)));
            return (
              <Slider key={`debt_${di}`} label={(d.nombre||d.n||"")||d.n} value={getVal(`debt_${di}`, (d.pago||d.pg||0)||d.pg)} base={(d.pago||d.pg||0)||d.pg}
                max={Math.max(((d.pago||d.pg||0)||d.pg) * 3, 500)} color={T.pr}
                onChange={(v) => setVal(`debt_${di}`, v)}
                sub={lk ? "→ " + ((lk.nombre||lk.n||"")||lk.n) : ((d.tasa||d.ts||0)) > 0 ? ((d.tasa||d.ts||0)) + "%" : ""} />
            );
          })}

          {/* Standalone Ingresos */}
          {(user.ingresos || []).length > 0 && <>
          <h4 style={{ fontSize: 13, color: T.gn, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>💰 Ingresos Independientes</h4>
          {(user.ingresos || []).map((ing, ii) => (
            <Slider key={`ing_${ii}`} label={ing.nombre || "Ingreso"} value={getVal(`ing_${ii}`, ing.mensual || 0)} base={ing.mensual || 0}
              max={Math.max((ing.mensual || 0) * 3, 1000)} color={T.gn}
              onChange={(v) => setVal(`ing_${ii}`, v)} sub={ing.categoria || ing.tipo || ""} />
          ))}
          </>}

          <button onClick={() => { setSimVals({}); setScenario("actual"); }}
            style={{ padding: "10px 20px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12, width: "100%" }}>
            🔄 Reset Todo
          </button>
        </div>

        {/* RIGHT: Chart + Summary */}
        <div>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 14 }}>Proyección 12 Meses</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={proj}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="m" tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickFormatter={(v) => "$" + (v / 1e3).toFixed(0) + "k"} />
                <Tooltip contentStyle={TT} formatter={(v) => fm(v)} />
                <Area type="monotone" dataKey="actual" stroke={T.txt3} fill={T.txt3 + "08"} strokeDasharray="5 5" name="Actual" />
                <defs>
                  <linearGradient id="gsim2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.gn} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={T.gn} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="simulado" stroke={T.gn} fill="url(#gsim2)" strokeWidth={2} name="Simulado" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>CF Actual</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: (totals.cf || 0) >= 0 ? T.gn : T.rd }}>{fm(totals.cf || 0)}</div>
              </div>
              <div style={{ background: simT.cf >= 0 ? T.gnD : T.rdD, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>CF Simulado</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: simT.cf >= 0 ? T.gn : T.rd }}>{fm(simT.cf)}</div>
              </div>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Impacto Anual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: (simT.cf - (totals.cf || 0)) >= 0 ? T.gn : T.rd }}>
                  {(simT.cf - (totals.cf || 0)) >= 0 ? "+" : ""}{fm((simT.cf - (totals.cf || 0)) * 12)}/año
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
