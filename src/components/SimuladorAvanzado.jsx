import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const pe = {
  bg2: "#18181b", bg3: "#27272a", bg4: "#2a2a32",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  rd: "#ef4444", rdD: "rgba(239,68,68,0.08)",
  bl: "#3b82f6", pr: "#a78bfa", or: "#f97316", gd: "#eab308", cy: "#22d3ee",
};
const fm = (n) => "$" + Math.round(n).toLocaleString("en-US");
const pc = (n) => (n || 0).toFixed(1) + "%";
const TT = { background: pe.bg2, border: `1px solid ${pe.border}`, borderRadius: 10, color: pe.txt, fontSize: 12 };

// ─── Tony Robbins 5 Levels ───
const LEVELS = [
  { id: 1, name: "Seguridad", icon: "🛡️", color: "#3b82f6", factor: 0.65,
    desc: "Pasivos cubren necesidades básicas",
    detail: "Tus ingresos cubren el 65% de tus gastos totales. Esto cubre vivienda, alimentación, servicios, transporte y seguros básicos. Si perdieras tu trabajo principal, podrías sobrevivir con lo que generan tus activos." },
  { id: 2, name: "Vitalidad", icon: "⚡", color: "#22d3ee", factor: 0.825,
    desc: "Seguridad + mitad de tu estilo de vida",
    detail: "Tus ingresos cubren el 82.5% de tus gastos. Además de las necesidades básicas, puedes mantener la mitad de tu estilo de vida actual: algo de entretenimiento, vacaciones modestas y educación." },
  { id: 3, name: "Independencia", icon: "🏆", color: "#22c55e", factor: 1.0,
    desc: "Tus ingresos cubren el 100% de tus gastos",
    detail: "¡El punto de quiebre! Tus ingresos pasivos y activos cubren TODOS tus gastos actuales. Ya no necesitas un empleo para mantener tu nivel de vida. Podrías dejar de trabajar mañana y seguir viviendo igual." },
  { id: 4, name: "Libertad", icon: "🚀", color: "#f97316", factor: 1.5,
    desc: "Independencia + 50% extra para lujos",
    detail: "Tus ingresos son 1.5 veces tus gastos. Tienes margen para lujos, viajes, hobbies costosos, donar a causas que te importan. Puedes mejorar tu estilo de vida sin preocuparte por el dinero." },
  { id: 5, name: "Absoluta", icon: "👑", color: "#eab308", factor: 2.5,
    desc: "Tus ingresos son 2.5 veces tus gastos",
    detail: "El nivel máximo. Tus ingresos son 2.5 veces tus gastos. Puedes hacer lo que quieras, cuando quieras, donde quieras. Puedes financiar los sueños de tu familia, invertir en negocios, impactar tu comunidad. El dinero dejó de ser una limitación." },
];

const fadeStyle = typeof document !== "undefined" ? (() => { const s = document.createElement("style"); s.textContent = "@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}"; if (!document.querySelector("[data-finpath-anim]")) { s.setAttribute("data-finpath-anim","1"); document.head.appendChild(s); } return null; })() : null;

function Slider({ label, value, base, max, color, onChange, sub }) {
  const perc = base > 0 ? Math.round((value / base) * 100) : 100;
  const diff = value - base;
  return (
    <div style={{ marginBottom: 4, background: color + "08", padding: "8px 12px", borderRadius: 8, borderLeft: "3px solid " + color }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: pe.txt2, fontWeight: 500 }}>
          {label} {sub && <span style={{ fontSize: 10, color: pe.txt3 }}>{sub}</span>}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {diff !== 0 && <span style={{ fontSize: 10, color: diff > 0 ? pe.gn : pe.rd, fontWeight: 600 }}>{diff > 0 ? "+" : ""}{fm(diff)}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{fm(value)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="range" min="0" max={max} step={Math.max(Math.round(max * 0.01), 5)} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color, height: 4, cursor: "pointer" }} />
        <span style={{ fontSize: 10, color: pe.txt3, minWidth: 32, textAlign: "right" }}>{perc}%</span>
      </div>
    </div>
  );
}

// ─── FREEDOM BAR (inline, reactive) ───
function FreedomBarLive({ ni, te, cf }) {
  const [expandedLvl, setExpandedLvl] = useState(null);
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
    <div style={{ background: pe.card, border: "1px solid " + pe.border, borderRadius: 20, padding: 24, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tu Nivel de Libertad Financiera</h3>
          <p style={{ fontSize: 12, color: pe.txt3, margin: "3px 0 0" }}>Tony Robbins — 5 niveles • Reacciona en tiempo real</p>
        </div>
        {currentData && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: currentData.color + "15", border: "1px solid " + currentData.color + "25", borderRadius: 12, padding: "8px 16px" }}>
            <span style={{ fontSize: 20 }}>{currentData.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: currentData.color }}>{currentData.name}</div>
              <div style={{ fontSize: 10, color: pe.txt3 }}>Nivel {currentLevel}/5</div>
            </div>
          </div>
        )}
        {!currentData && (
          <div style={{ background: pe.bg3, borderRadius: 12, padding: "8px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pe.txt3 }}>Sin nivel aún</div>
            <div style={{ fontSize: 10, color: pe.txt3 }}>Agrega ingresos</div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 36, background: pe.bg3, borderRadius: 18, overflow: "hidden", position: "relative" }}>
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
                <div style={{ fontSize: 9, fontWeight: reached ? 700 : 500, color: reached ? l.color : pe.txt3 }}>{l.name}</div>
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
            <div key={l.id} onClick={() => setExpandedLvl(expandedLvl === l.id ? null : l.id)} style={{
              background: current ? l.color + "12" : reached ? "rgba(255,255,255,0.02)" : pe.bg3,
              border: "1px solid " + (current ? l.color + "40" : reached ? l.color + "20" : pe.border),
              borderRadius: 12, padding: "10px 8px", textAlign: "center", position: "relative",
              opacity: reached || current ? 1 : 0.5, cursor: "pointer", transition: "all 0.2s",
            }}>
              {reached && <div style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: l.color }} />}
              <div style={{ fontSize: 18, marginBottom: 4 }}>{l.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: reached ? l.color : pe.txt3, lineHeight: 1.2 }}>{l.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? l.color : pe.txt2, fontFamily: "monospace", marginTop: 4 }}>
                {fm(needed)}<span style={{ fontSize: 8 }}>/m</span>
              </div>
              <div style={{ fontSize: 8, color: pe.txt3, marginTop: 3 }}>click para info ▾</div>
            </div>
          );
        })}
      </div>

      {/* Expanded level explanation */}
      {expandedLvl && (() => {
        const l = LEVELS.find(x => x.id === expandedLvl);
        if (!l) return null;
        const needed = l.factor * te;
        const reached = currentLevel >= l.id;
        return (
          <div style={{ background: l.color + "08", border: "1px solid " + l.color + "20", borderRadius: 14, padding: "16px 20px", marginBottom: 16, animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{l.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: l.color }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: pe.txt3 }}>Nivel {l.id}/5 — Necesitas {fm(needed)}/mes de ingresos</div>
                </div>
              </div>
              <button onClick={() => setExpandedLvl(null)} style={{ background: "none", border: "none", color: pe.txt3, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: pe.txt2, lineHeight: 1.7 }}>{l.detail}</div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12 }}>
              {reached
                ? <span style={{ color: l.color, fontWeight: 700 }}>✅ ¡Ya alcanzaste este nivel! Tus ingresos ({fm(ni)}/mes) superan los {fm(needed)}/mes necesarios.</span>
                : <span style={{ color: pe.txt3 }}>📊 Te faltan <strong style={{ color: l.color }}>{fm(needed - ni)}/mes</strong> para alcanzar este nivel. Tus ingresos actuales: {fm(ni)}/mes.</span>
              }
            </div>
          </div>
        );
      })()}

      {/* Next level info */}
      {nextData && (
        <div style={{ background: nextData.color + "08", border: "1px solid " + nextData.color + "20", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: nextData.color }}>{nextData.icon} Siguiente: {nextData.name}</span>
            <span style={{ fontSize: 12, color: pe.txt3, marginLeft: 8 }}>{nextData.desc}</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: pe.txt3 }}>Te faltan</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: nextData.color }}>{fm(monthlyGap)}<span style={{ fontSize: 10 }}>/mes</span></div>
            </div>
          </div>
        </div>
      )}
      {currentLevel >= 5 && (
        <div style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.04))", border: "1px solid rgba(234,179,8,0.25)", borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: pe.gd }}>¡Libertad Absoluta!</div>
          <div style={{ fontSize: 13, color: pe.txt2 }}>Pasivos = {Math.round(ratio * 100)}% de gastos</div>
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


    (user.ingresos || []).forEach((ing, ii) => {
      const baseCap = Number(ing.capital) || 0;
      const tasa = Number(ing.tasa) || 0;
      if (tasa > 0 && baseCap > 0) {
        nv[`cap_${ii}`] = Math.round(baseCap * f.i);
        nv[`ing_${ii}`] = Math.round((baseCap * f.i * tasa / 100) / 12);
      } else {
        nv[`ing_${ii}`] = Math.round((ing.mensual || 0) * f.i);
      }
    });
    (user.deudas || []).filter(d => (d.mt||0) > 0).forEach((d, di) => { nv[`debt_${di}`] = (d.pago||d.pg||0); });
    // Standalone ingresos
    // Dedup ingresos in scenario too
    setSimVals(nv);
  };

  // ── Simulated totals (reactive) ──
  const simT = useMemo(() => {
    let tI = 0, tG = 0;


    // Ingresos: funds use capital slider, others use rent slider
    let tIng = 0;
    (user.ingresos || []).forEach((ing, ii) => {
      const baseCap = Number(ing.capital) || 0;
      const tasa = Number(ing.tasa) || 0;
      if (tasa > 0 && baseCap > 0) {
        const simCap = getVal(`cap_${ii}`, baseCap);
        tIng += Math.round((simCap * tasa / 100) / 12);
      } else {
        tIng += getVal(`ing_${ii}`, ing.mensual || 0);
      }
    });
    tI += tIng;

    let tGF = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g, gi) => { tGF += getVal(`gf_${cat}_${gi}`, g.m); });
    });
    let tD = 0;
    (user.deudas || []).filter(d => (d.mt||0) > 0).forEach((d, di) => { tD += getVal(`debt_${di}`, (d.pago||d.pg||0)); });
    const ni = tI - tG, te = tGF + tD, cf = ni - te;
    return { tI, tG, ni, tGF, tD, te, cf, ind: te > 0 ? (ni / te) * 100 : 0 };
  }, [user, simVals, getVal]);

  const proj = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => ({
      m: "M" + i,
      actual: (totals.cf || 0) * i,
      simulado: simT.cf * i,
    }));
  }, [totals, simT]);

  const scs = [
    { id: "actual", i: "📋", l: "Actual", d: "Valores reales", c: pe.bl },
    { id: "conservador", i: "🐢", l: "Conservador", d: "Ing -20%, gas +10%", c: pe.txt2 },
    { id: "optimista", i: "🚀", l: "Optimista", d: "Ing +30%, gas -15%", c: pe.gn },
    { id: "crisis", i: "⚠️", l: "Crisis", d: "Ing -40%", c: pe.rd },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Simulador de Independencia Financiera</h2><button onClick={()=>{
              const w = window.open("","_blank");
              const fecha = new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
              const niveles = ["Seguridad","Vitalidad","Independencia","Libertad","Absoluta"];
              const nivel = simT.ind >= 250 ? 4 : simT.ind >= 150 ? 3 : simT.ind >= 100 ? 2 : simT.ind >= 75 ? 1 : 0;
              
              // Build income rows
              const ingRows = (user.ingresos||[]).sort((a,b)=>(b.mensual||0)-(a.mensual||0)).map(i => {
                const cap = i.capital && i.tasa ? `<span style="color:#888;font-size:10px">Capital: $${(i.capital/1e6).toFixed(0)}M × ${i.tasa}%</span>` : "";
                return `<tr><td>${i.nombre||""}</td><td style="color:#888">${i.categoria||""}</td><td style="text-align:right;font-weight:600;color:#16a34a">$${Math.round(i.mensual||0).toLocaleString()}</td><td>${cap}</td></tr>`;
              }).join("");
              
              // Build expense rows by category
              const gasCats = Object.entries(user.gastos||{}).map(([cat,items])=>({cat,total:items.reduce((s,g)=>s+(g.m||0),0),items})).sort((a,b)=>b.total-a.total);
              const gasRows = gasCats.map(g => {
                const detail = g.items.slice(0,3).map(i=>i.c).join(", ");
                return `<tr><td>${g.cat}</td><td style="color:#888;font-size:10px">${detail}</td><td style="text-align:right;font-weight:600;color:#dc2626">$${Math.round(g.total).toLocaleString()}</td></tr>`;
              }).join("");
              
              // Build debt rows
              const deuRows = (user.deudas||[]).filter(d=>(d.mt||0)>0).map(d => 
                `<tr><td>${d.n||d.nombre||""}</td><td style="text-align:right">$${Math.round(d.mt||0).toLocaleString()}</td><td style="text-align:right">$${Math.round(d.pg||0).toLocaleString()}/mes</td><td style="text-align:right">${d.ts||0}%</td></tr>`
              ).join("");
              
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FINPATH Simulador</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,sans-serif;font-size:11px;color:#222;padding:20px 28px;max-width:800px;margin:0 auto}
h1{font-size:18px;font-weight:800;color:#16a34a;margin:0 0 2px}
h2{font-size:13px;font-weight:700;color:#333;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
.sub{font-size:10px;color:#888;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:10px}
.kpi{background:#f8f8f8;border:1px solid #e5e5e5;border-radius:6px;padding:8px 10px;text-align:center}
.kpi .label{font-size:9px;color:#888;text-transform:uppercase;font-weight:600}
.kpi .val{font-size:18px;font-weight:800;margin-top:2px}
.gn{color:#16a34a}.rd{color:#dc2626}.bl{color:#2563eb}.or{color:#d97706}
table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
th{background:#f5f5f5;padding:4px 6px;text-align:left;font-size:9px;font-weight:600;color:#666;border-bottom:1px solid #ddd}
td{padding:4px 6px;border-bottom:1px solid #f0f0f0}
.bar-container{height:14px;background:#f0f0f0;border-radius:7px;margin:4px 0;overflow:hidden}
.bar-fill{height:100%;border-radius:7px}
.footer{margin-top:16px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#aaa;text-align:center}
.diag{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;font-size:11px;line-height:1.6}
@media print{@page{size:letter portrait;margin:12mm}}
</style></head><body>
<h1>FINPATH — Informe del Simulador</h1>
<div class="sub">${user.ingresos?.[0]?.fuente ? "" : ""}${fecha}</div>

<div class="grid4">
  <div class="kpi"><div class="label">Ingreso neto</div><div class="val gn">$${Math.round(simT.ni).toLocaleString()}</div></div>
  <div class="kpi"><div class="label">Egresos totales</div><div class="val rd">$${Math.round(simT.te).toLocaleString()}</div></div>
  <div class="kpi"><div class="label">Cash flow</div><div class="val ${simT.cf>=0?"gn":"rd"}">$${Math.round(simT.cf).toLocaleString()}</div></div>
  <div class="kpi"><div class="label">Independencia</div><div class="val ${simT.ind>=100?"gn":"or"}">${simT.ind.toFixed(0)}%</div></div>
</div>

<div class="grid3">
  <div class="kpi"><div class="label">Nivel</div><div class="val bl">${niveles[nivel]} (${nivel+1}/5)</div></div>
  <div class="kpi"><div class="label">Disponible/mes</div><div class="val gn">$${Math.round(simT.cf).toLocaleString()}</div></div>
  <div class="kpi"><div class="label">Disponible/año</div><div class="val gn">$${Math.round(simT.cf*12).toLocaleString()}</div></div>
</div>

<h2>💰 Ingresos Mensuales</h2>
<table><thead><tr><th>Fuente</th><th>Categoría</th><th style="text-align:right">Monto</th><th>Detalle</th></tr></thead>
<tbody>${ingRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #16a34a"><td colspan="2">TOTAL INGRESOS</td><td style="text-align:right;color:#16a34a">$${Math.round(simT.ni).toLocaleString()}</td><td></td></tr></tfoot>
</table>

<h2>💳 Gastos Familiares</h2>
<table><thead><tr><th>Categoría</th><th>Principales</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${gasRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #dc2626"><td colspan="2">TOTAL GASTOS</td><td style="text-align:right;color:#dc2626">$${Math.round(simT.gfm).toLocaleString()}</td></tr></tfoot>
</table>

${deuRows ? `<h2>📋 Cuotas de Deudas</h2>
<table><thead><tr><th>Deuda</th><th style="text-align:right">Saldo</th><th style="text-align:right">Cuota</th><th style="text-align:right">Tasa</th></tr></thead>
<tbody>${deuRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #dc2626"><td>TOTAL CUOTAS</td><td></td><td style="text-align:right;color:#dc2626">$${Math.round((user.deudas||[]).filter(d=>(d.mt||0)>0).reduce((s,d)=>s+(d.pg||0),0)).toLocaleString()}/mes</td><td></td></tr></tfoot>
</table>` : ""}

<h2>📊 Resumen</h2>
<div class="grid2">
  <div>
    <div class="bar-container"><div class="bar-fill" style="width:${Math.min(simT.ind,100)}%;background:${simT.ind>=100?"#16a34a":"#eab308"}"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#888"><span>0%</span><span>Independencia: ${simT.ind.toFixed(0)}%</span><span>100%</span></div>
  </div>
  <div class="diag">
    ${simT.ind>=100?"✅ Independencia financiera alcanzada":"⚠ Falta $"+Math.round(simT.te-simT.ni).toLocaleString()+"/mes"}<br>
    ${simT.cf>=0?"✅ Cash flow positivo: $"+Math.round(simT.cf).toLocaleString()+"/mes":"❌ Cash flow negativo"}<br>
    📅 Disponible al día: $${Math.round(simT.cf/30).toLocaleString()}
  </div>
</div>

<div class="footer">FINPATH — Informe generado el ${fecha} • finpathia.netlify.app</div>
</body></html>`;
              w.document.write(html);
              w.document.close();
              setTimeout(()=>w.print(), 500);
            }} style={{background:"#22c55e",color:"#000",border:"none",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,marginLeft:12}}>📄 Exportar PDF</button>
      <p style={{ color: pe.txt3, fontSize: 13, marginBottom: 20 }}>Ajusta cada ingreso y gasto — la barra de libertad reacciona en tiempo real</p>

      {/* ═══ FREEDOM BAR — reacts to simulated values ═══ */}
      <FreedomBarLive ni={simT.ni} te={simT.te} cf={simT.cf} />

      {/* Scenario presets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        {scs.map((sc) => {
          const a = scenario === sc.id;
          return (
            <button key={sc.id} onClick={() => applyScenario(sc.id)} style={{
              padding: 14, borderRadius: 14, border: "2px solid " + (a ? sc.c : pe.border),
              background: a ? sc.c + "10" : pe.card, cursor: "pointer", textAlign: "center",
            }}>
              <div style={{ fontSize: 20 }}>{sc.i}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: a ? sc.c : pe.txt2 }}>{sc.l}</div>
              <div style={{ fontSize: 9, color: pe.txt3 }}>{sc.d}</div>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Ingreso Neto", v: fm(simT.ni), c: pe.gn, d: fm(simT.ni - (totals.ni || 0)) },
          { l: "Egresos Totales", v: fm(simT.te), c: pe.rd, d: fm(simT.te - (totals.te || 0)), tip: "Gastos familiares + cuotas de deudas" },
          { l: "Cash Flow", v: fm(simT.cf), c: simT.cf >= 0 ? pe.gn : pe.rd, d: fm(simT.cf - (totals.cf || 0)), tip: "Dinero que te sobra (o falta) cada mes después de pagar todo" },
          { l: "Independencia", v: pc(simT.ind), c: simT.ind >= 100 ? pe.gn : pe.txt2, tip: "% de tus gastos que cubren tus ingresos. 100% = no necesitas empleo" },
        ].map((m) => (
          <div key={m.l} style={{ background: pe.card, border: "1px solid " + pe.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, color: pe.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
            {m.d && <div style={{ fontSize: 10, color: pe.txt3, marginTop: 2 }}>Δ {m.d}</div>}
            {m.tip && <div style={{ fontSize: 9, color: pe.txt3, marginTop: 4, lineHeight: 1.3, opacity: 0.7 }}>{m.tip}</div>}
          </div>
        ))}
      </div>

      {/* DISPONIBLE - Hero section */}
      <div style={{ background: simT.cf >= 0 ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))" : "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))", border: "1px solid " + (simT.cf >= 0 ? pe.gn : pe.rd) + "20", borderRadius: 16, padding: "20px 28px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: pe.txt3, fontWeight: 600, letterSpacing: 1 }}>{simT.cf >= 0 ? "💰 DISPONIBLE CADA MES" : "⚠️ DÉFICIT MENSUAL"}</div>
          <div style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, color: simT.cf >= 0 ? pe.gn : pe.rd, letterSpacing: "-0.03em", marginTop: 4 }}>{fm(simT.cf)}<span style={{ fontSize: 14, fontWeight: 400, color: pe.txt3 }}>/mes</span></div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: pe.txt3 }}>AL AÑO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: simT.cf >= 0 ? pe.gn : pe.rd }}>{fm(simT.cf * 12)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: pe.txt3 }}>AL DÍA</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: pe.txt2 }}>{fm(Math.round(simT.cf / 30))}</div>
          </div>
        </div>
      </div>

      {/* Sliders + Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* LEFT: Sliders */}
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 8 }}>
          <h4 style={{ fontSize: 13, color: "#22d3ee", fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase" }}>💰 Ingresos</h4>
          {(user.ingresos || []).map((ing, ii) => {
            const baseRenta = Number(ing.mensual) || 0;
            const baseCap = Number(ing.capital) || 0;
            const baseTasa = Number(ing.tasa) || 0;
            // Use simulated capital if set, otherwise base
            const simCap = getVal(`cap_${ii}`, baseCap);
            const simTasa = baseTasa || (simCap > 0 && baseRenta > 0 ? Math.round((baseRenta * 12 / simCap) * 1000) / 10 : 0);
            const hasCap = simCap > 0 && simTasa > 0;
            const simRenta = hasCap ? Math.round((simCap * simTasa / 100) / 12) : getVal(`ing_${ii}`, baseRenta);
            const rentDiff = simRenta - baseRenta;
            const capDiff = simCap - baseCap;
            // Detect if this looks like an investment income
            const isInvType = ["Inversión","Rendimiento","Dividendos","Arriendo","Fondo","CDT"].some(t => (ing.categoria||"").includes(t) || (ing.nombre||"").toLowerCase().includes(t.toLowerCase()));

            return (
              <div key={`ing_${ii}`} style={{ marginBottom: 8, background: "#22d3ee06", borderRadius: 12, border: "1px solid #22d3ee12", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px" }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: pe.txt }}>{ing.nombre || "Ingreso"}</div>
                      <div style={{ fontSize: 11, color: pe.txt3 }}>{ing.categoria || ""}{simTasa > 0 ? " • " + simTasa + "% anual" : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#22d3ee" }}>{fm(simRenta)}<span style={{ fontSize: 10, fontWeight: 400, color: pe.txt3 }}>/mes</span></div>
                      {rentDiff !== 0 && <div style={{ fontSize: 10, color: rentDiff > 0 ? pe.gn : pe.rd, fontWeight: 600 }}>{rentDiff > 0 ? "+" : ""}{fm(rentDiff)}</div>}
                    </div>
                  </div>

                  {hasCap ? (
                    <>
                      {/* FUND: capital + renta side by side */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                          <div style={{ fontSize: 10, color: pe.txt3 }}>Capital invertido</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: pe.txt }}>{fm(simCap)}</div>
                          {capDiff !== 0 && <div style={{ fontSize: 10, color: capDiff > 0 ? pe.gn : pe.rd }}>{capDiff > 0 ? "+" : ""}{fm(capDiff)}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                          <div style={{ fontSize: 10, color: pe.txt3 }}>Renta mensual ({simTasa}%)</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#22d3ee" }}>{fm(simRenta)}</div>
                          {rentDiff !== 0 && <div style={{ fontSize: 10, color: rentDiff > 0 ? pe.gn : pe.rd }}>{rentDiff > 0 ? "+" : ""}{fm(rentDiff)}</div>}
                        </div>
                      </div>
                      <div data-no-print="true" style={{ fontSize: 10, color: pe.txt3, marginBottom: 4 }}>↔ Capital invertido:</div>
                      <input type="range" min={0} max={Math.round(baseCap * 2)} step={Math.max(Math.round(baseCap * 0.002), 1000)} value={simCap}
                        onChange={(e) => { const c = Number(e.target.value); setVal(`cap_${ii}`, c); setVal(`ing_${ii}`, Math.round((c * simTasa / 100) / 12)); }}
                        style={{ width: "100%", accentColor: "#22d3ee", height: 6, cursor: "pointer" }} />
                    </>
                  ) : isInvType && !hasCap ? (
                    <>
                      {/* Investment-type but no capital yet: show prompt + slider */}
                      <div data-no-print="true" style={{ background: "rgba(34,211,238,0.06)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 11, color: "#22d3ee" }}>
                        💡 Edita este ingreso y agrega <strong>Capital invertido</strong> y <strong>% Tasa</strong> para simular cuánto invertir
                      </div>
                      <input type="range" min={0} max={Math.max(baseRenta * 3, 1000)} step={Math.max(Math.round(baseRenta * 0.01), 5)} value={simRenta}
                        onChange={(e) => setVal(`ing_${ii}`, Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#22d3ee", height: 4, cursor: "pointer" }} />
                    </>
                  ) : (
                    <>
                      {/* Simple income: just slider */}
                      <input type="range" min={0} max={Math.max(baseRenta * 3, 1000)} step={Math.max(Math.round(baseRenta * 0.01), 5)} value={simRenta}
                        onChange={(e) => setVal(`ing_${ii}`, Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#22d3ee", height: 4, cursor: "pointer" }} />
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Family expense sliders */}
          <h4 style={{ fontSize: 13, color: pe.rd, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>💳 Gastos Familiares</h4>
          {Object.entries(user.gastos || {}).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, color: pe.txt3, textTransform: "uppercase", fontWeight: 700, margin: "8px 0 4px", paddingTop: 4, borderTop: "1px solid " + pe.border }}>{cat}</div>
              {items.map((g, gi) => (
                <Slider key={`gf_${cat}_${gi}`} label={g.c} value={getVal(`gf_${cat}_${gi}`, g.m)} base={g.m}
                  max={Math.max(g.m * 3, 500)} color={pe.rd}
                  onChange={(v) => setVal(`gf_${cat}_${gi}`, v)} sub={g.t === "fijo" || g.t === "f" ? "fijo" : "var"} />
              ))}
            </div>
          ))}

          {/* Debt payment sliders */}
          <h4 style={{ fontSize: 13, color: pe.pr, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase" }}>📋 Cuotas de Deudas</h4>
          {(user.deudas || []).filter(d => (d.mt||0) > 0).map((d, di) => {
            const lk = (user.inv || []).find((i) => i.id === ((d.link||d.la)));
            return (
              <Slider key={`debt_${di}`} label={(d.nombre||d.n||"")||d.n} value={getVal(`debt_${di}`, (d.pago||d.pg||0)||d.pg)} base={(d.pago||d.pg||0)||d.pg}
                max={Math.max(((d.pago||d.pg||0)||d.pg) * 3, 500)} color={pe.pr}
                onChange={(v) => setVal(`debt_${di}`, v)}
                sub={lk ? "→ " + ((lk.nombre||lk.n||"")||lk.n) : ((d.tasa||d.ts||0)) > 0 ? ((d.tasa||d.ts||0)) + "%" : ""} />
            );
          })}


          <button onClick={() => { setSimVals({}); setScenario("actual"); }}
            style={{ padding: "10px 20px", background: pe.bg3, border: "1px solid " + pe.border, color: pe.txt2, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12, width: "100%" }}>
            🔄 Reset Todo
          </button>
        </div>

        {/* RIGHT: Chart + Summary */}
        <div>
          <div style={{ background: pe.card, border: "1px solid " + pe.border, borderRadius: 16, padding: 20, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: pe.txt2, marginBottom: 14 }}>Acumulación Cash Flow — 12 Meses</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={proj}>
                <CartesianGrid strokeDasharray="3 3" stroke={pe.border} />
                <XAxis dataKey="m" tick={{ fill: pe.txt3, fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: pe.txt3, fontSize: 10 }} axisLine={false} tickFormatter={(v) => {if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(0)+"M";if(Math.abs(v)>=1e3)return"$"+(v/1e3).toFixed(0)+"K";return"$"+v}} />
                <Tooltip contentStyle={TT} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={(v) => fm(v)} />
                <Area type="monotone" dataKey="actual" stroke={pe.txt3} fill={pe.txt3 + "08"} strokeDasharray="5 5" name="Actual" />
                <defs>
                  <linearGradient id="gsim2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={pe.gn} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={pe.gn} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="simulado" stroke={pe.gn} fill="url(#gsim2)" strokeWidth={2} name="Simulado" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: pe.bg2, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: pe.txt3 }}>CF Actual</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: (totals.cf || 0) >= 0 ? pe.gn : pe.rd }}>{fm(totals.cf || 0)}</div>
              </div>
              <div style={{ background: simT.cf >= 0 ? pe.gnD : pe.rdD, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: pe.txt3 }}>CF Simulado</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: simT.cf >= 0 ? pe.gn : pe.rd }}>{fm(simT.cf)}</div>
              </div>
              <div style={{ background: pe.bg2, padding: 12, borderRadius: 10, textAlign: "center", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 10, color: pe.txt3 }}>Impacto Anual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: (simT.cf - (totals.cf || 0)) >= 0 ? pe.gn : pe.rd }}>
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
