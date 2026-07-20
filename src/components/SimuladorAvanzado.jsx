import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { estimarImpuesto } from "../lib/taxCO";
import { montoPromedioMensual, montoDelMes, MESES, getMesActual, getFrecuencia, estaPagadoEnAño, FRECUENCIAS } from "../lib/flowHelpers.js";
import PageHeader from "./PageHeader";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";

const T = {
  bg2: "#18181b", bg3: "#27272a", bg4: "#2a2a32",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  rd: "#ef4444", rdD: "rgba(239,68,68,0.08)",
  bl: "#3b82f6", pr: "#a78bfa", or: "#f97316", gd: "#eab308", cy: "#22d3ee",
};
const fm = (n) => "$" + Math.round(n||0).toLocaleString("es-CO");
const pc = (n) => (n || 0).toFixed(1) + "%";
const TT = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 12 };

// ─── 5 Levels of Financial Freedom ───
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
  // Commit 7 Tarea 3 (BUG FIX reportado): cuando base=0 (escenario tipico:
  // owner cuyo Optimizado real es \$0 porque el cap 40% Art. 336 satura
  // todas las palancas), el codigo legacy forzaba perc=100, sugiriendo
  // visualmente que "el slider sigue cobrando como el actual" cuando en
  // realidad value=0 era correcto. Ahora:
  //   - base > 0: porcentaje relativo al baseline (caso normal)
  //   - base = 0 y value = 0: 0% (slider esta en cero, mostrar cero)
  //   - base = 0 y value > 0: porcentaje relativo a max (excedente sobre cero)
  const perc = base > 0
    ? Math.round((value / base) * 100)
    : (value === 0 ? 0 : (max > 0 ? Math.round((value / max) * 100) : 0));
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
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 20, padding: 24, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tu Nivel de Libertad Financiera</h3>
          <p style={{ fontSize: 12, color: T.txt3, margin: "3px 0 0" }}>5 niveles de libertad • Reacciona en tiempo real</p>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 6, marginBottom: 16 }}>
        {LEVELS.map((l) => {
          const reached = currentLevel >= l.id;
          const current = currentLevel === l.id;
          const needed = l.factor * te;
          return (
            <div key={l.id} onClick={() => setExpandedLvl(expandedLvl === l.id ? null : l.id)} style={{
              background: current ? l.color + "12" : reached ? "rgba(255,255,255,0.02)" : T.bg3,
              border: "1px solid " + (current ? l.color + "40" : reached ? l.color + "20" : T.border),
              borderRadius: 12, padding: "10px 8px", textAlign: "center", position: "relative",
              opacity: reached || current ? 1 : 0.5, cursor: "pointer", transition: "all 0.2s",
            }}>
              {reached && <div style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: l.color }} />}
              <div style={{ fontSize: 18, marginBottom: 4 }}>{l.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: reached ? l.color : T.txt3, lineHeight: 1.2 }}>{l.name}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: reached ? l.color : T.txt2, fontFamily: "monospace", marginTop: 4 }}>
                {fm(needed)}<span style={{ fontSize: 8 }}>/m</span>
              </div>
              <div style={{ fontSize: 8, color: T.txt3, marginTop: 3 }}>click para info ▾</div>
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
                  <div style={{ fontSize: 11, color: T.txt3 }}>Nivel {l.id}/5 — Necesitas {fm(needed)}/mes de ingresos</div>
                </div>
              </div>
              <button onClick={() => setExpandedLvl(null)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.7 }}>{l.detail}</div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12 }}>
              {reached
                ? <span style={{ color: l.color, fontWeight: 700 }}>✅ ¡Ya alcanzaste este nivel! Tus ingresos ({fm(ni)}/mes) superan los {fm(needed)}/mes necesarios.</span>
                : <span style={{ color: T.txt3 }}>📊 Te faltan <strong style={{ color: l.color }}>{fm(needed - ni)}/mes</strong> para alcanzar este nivel. Tus ingresos actuales: {fm(ni)}/mes.</span>
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
export default function SimuladorAvanzado({ user, impuestoData, totals, fmt, onNavigate}) {

  const [simVals, setSimVals] = useState({});
  // Per-owner toggle: { "<ti>": true/false } keyed by tax detail index.
  // A missing key means "Actual" (default) for that owner.
  const [taxOptimizado, setTaxOptimizado] = useState({});

  // Reset sliders when underlying data changes
  const dataHash = JSON.stringify([
    (user.ingresos||[]).map(i=>i.mensual),
    Object.values(user.gastos||{}).flat().map(g=>g.m),
    (user.deudas||[]).map(d=>d.pg||d.pago)
  ]);
  const [lastHash, setLastHash] = useState(dataHash);
  if(dataHash !== lastHash) { setSimVals({}); setLastHash(dataHash); }
  const [scenario, setScenario] = useState("actual");
  const [simName, setSimName] = useState("");
  // Descripción libre del escenario para que el user detalle contexto ("Que
  // pasa si en 6 meses vendo el AP de Chapinero y bajo la deuda 30%?"). Se
  // exporta tanto al PDF como al Excel para poder compartir con contador o
  // socios de negocio con full contexto del planteo.
  const [simDescripcion, setSimDescripcion] = useState("");
  // Fase 5 flujo anual (18-jul-2026): mes que el user está visualizando en el
  // simulador. Default = mes actual del sistema. Le permite explorar qué
  // pasa en meses futuros con picos de gastos (impuestos, colegios, primas).
  const [mesVisualizado, setMesVisualizado] = useState(() => getMesActual().mes);

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
      const base = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? 4200 : 1);
      nv[`ing_${ii}`] = Math.round(base * f.i);
    });
    (user.deudas || []).forEach((d, di) => { if ((d.mt||0) > 0) nv[`debt_${di}`] = (d.pago||d.pg||0); });
    // Tax per owner - NOT initialized here, uses getVal fallback to stay fresh
    // Standalone ingresos
    // Dedup ingresos in scenario too
    setSimVals(nv);
  };

  // ── Simulated totals (reactive) ──
  // Tax se recalcula DINÁMICAMENTE usando estimarImpuesto(userSim) donde
  // userSim refleja los overrides de sliders (ingresos/gastos/deudas) +
  // el flag sim=false respetado. Si el usuario sube ingresos con el slider,
  // el impuesto estimado también sube.
  // Toggle Actual/Optimizado por owner (keyed by td.name) elige entre
  // td.impuesto y td.impOptimizado del detalle dinámico.
  // ═══════════════════════════════════════════════════════════════════════════
  // MOTOR DE CÁLCULO — Modelo family office (rediseño 4-jul-2026)
  //
  // Contrato explícito del nuevo modelo mental de FINPATHIA:
  //
  //   INGRESOS:
  //     brutoTotal          = suma de ingresos activos (COP)
  //     retencionMensual    = suma de retenciones (crédito recuperable)
  //     disponibleCuenta    = brutoTotal − retencionMensual
  //                           ← lo que efectivamente entra al banco
  //
  //   EGRESOS (desglose 4-líneas):
  //     A. aportesObligatorios = categoría "Seguridad Social" del gasto
  //     B. gastosFamiliares    = resto de gastos activos
  //     C. cuotasDeudas        = pagos mensuales de deudas
  //     D. impuestoNeto        = max(0, bruto anual − retención) / 12
  //                              ← saldo a pagar en declaración
  //     egresosTotales = A + B + C + D
  //
  //   CASH FLOW:
  //     cashFlow = disponibleCuenta − egresosTotales
  //     independencia = (disponibleCuenta / egresosTotales) × 100
  //
  // Verificación matemática: el nuevo cashFlow es idéntico al viejo
  // (solo estamos reorganizando cómo se muestra, no cambiando la aritmética).
  //   Caso A (bruto≥retención): CF_nuevo = tI − retención − aportes − gastos
  //                             − cuotas − (bruto − retención) = tI − te_viejo ✓
  //   Caso B (bruto<retención): CF_nuevo = tI − retención − aportes − gastos
  //                             − cuotas − 0 = tI − te_viejo ✓ (retención=max)
  //
  // Aliases legacy: ni/tI/gfm/te/cf/ind/tTax preservados para no romper
  // el resto del código que aún los consume. El significado de `ni` cambia
  // de "Bruto" a "Disponible" — intencional, es lo que el user pidió ver.
  // ═══════════════════════════════════════════════════════════════════════════
  const simT = useMemo(() => {
    const trm = 4200;

    // ─── PASO 1: Ingresos con overrides de sliders + moneda ──────────────
    const ingSim = (user.ingresos || []).map((ing, ii) => {
      if (ing.sim === false) return ing;
      const baseCop = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
      const overrideCop = getVal(`ing_${ii}`, baseCop);
      const newMensual = ing.moneda === "USD" ? (overrideCop / trm) : overrideCop;
      return { ...ing, mensual: newMensual };
    });
    let brutoTotal = 0;
    ingSim.forEach(ing => {
      if (ing.sim === false) return;
      // NUEVO (18-jul-2026): usa promedio mensualizado según frecuencia
      // Ej: dividendo trimestral $3M → cuenta como $1M/mes en el promedio
      // Retrocompat: ing sin `frecuencia` se asume "mensual" (idéntico al viejo)
      const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
      brutoTotal += montoPromedioMensual({ ...ing, mensual: montoBase });
    });

    // ─── PASO 2: Gastos separados en aportes obligatorios vs familiares ──
    // Los aportes obligatorios (pensión, EPS, ARL) van en la categoría
    // "Seguridad Social" — se muestran en su propia línea del desglose.
    // El independiente los paga de su bolsillo → quedan en Egresos.
    const gasSim = {};
    let aportesObligatorios = 0;
    let gastosFamiliares = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      gasSim[cat] = (items || []).map((g, gi) => {
        if (g.sim === false) return g;
        const newM = getVal(`gf_${cat}_${gi}`, g.m || 0);
        return { ...g, m: newM };
      });
      gasSim[cat].forEach(g => {
        if (g.sim === false) return;
        // NUEVO: promedio mensualizado según frecuencia
        // Ej: impuesto anual $12M → cuenta como $1M/mes en el promedio
        const monto = montoPromedioMensual(g);
        if (cat === "Seguridad Social") aportesObligatorios += monto;
        else gastosFamiliares += monto;
      });
    });
    const tGF = aportesObligatorios + gastosFamiliares; // legacy alias

    // ─── PASO 3: Cuotas de deudas ───────────────────────────────────────
    const deuSim = (user.deudas || []).map((d, di) => {
      if (d.sim === false) return d;
      if ((d.mt || 0) > 0) {
        const newPago = getVal(`debt_${di}`, (d.pago || d.pg || 0));
        return { ...d, pago: newPago, pg: newPago };
      }
      return d;
    });
    let cuotasDeudas = 0;
    deuSim.forEach(d => {
      if (d.sim === false) return;
      if ((d.mt || 0) > 0) cuotasDeudas += (d.pago || d.pg || 0);
    });

    // ─── PASO 4: Impuesto + Retención (por owner fiscal) ────────────────
    // impuestoBrutoAnual = lo que la DIAN calcula sobre tu renta gravable
    // retencionAnual     = lo que ya te descontaron del flujo mensual
    // impuestoNeto       = saldo a pagar en la declaración (max 0)
    const userSim = {
      owners: user.owners || [],
      ingresos: ingSim,
      gas: gasSim,
      deu: deuSim,
      inv: user.inv || [],
      trm,
    };
    const dynTax = estimarImpuesto(userSim);

    let impuestoBrutoAnual = 0;
    let retencionAnual = 0;
    (dynTax.detalle || []).forEach(td => {
      const isOpt = !!taxOptimizado[td.name];
      const anualBase = isOpt
        ? (td.impOptBruto != null ? td.impOptBruto : (td.impBruto || 0))
        : (td.impBruto != null ? td.impBruto : (td.impuesto || 0));
      const mesBase = Math.round(anualBase / 12);
      const simImpBrutoMes = getVal(`tax_${td.name}`, mesBase);
      impuestoBrutoAnual += simImpBrutoMes * 12;
      retencionAnual += (td.reteN || 0);
    });

    const retencionMensual = Math.round(retencionAnual / 12);
    const impuestoBrutoMensual = Math.round(impuestoBrutoAnual / 12);
    const impuestoNeto = Math.max(0, Math.round((impuestoBrutoAnual - retencionAnual) / 12));

    // ─── PASO 5: Consolidación (Disponible → Cash Flow) ─────────────────
    const disponibleCuenta = brutoTotal - retencionMensual;
    const egresosTotales = aportesObligatorios + gastosFamiliares + cuotasDeudas + impuestoNeto;
    const cashFlow = disponibleCuenta - egresosTotales;
    const independencia = egresosTotales > 0 ? (disponibleCuenta / egresosTotales) * 100 : 0;

    return {
      // ═══ NUEVO MODELO EXPLÍCITO ═══
      brutoTotal,
      retencionMensual,
      disponibleCuenta,
      aportesObligatorios,
      gastosFamiliares,
      cuotasDeudas,
      impuestoBrutoMensual,
      impuestoNeto,
      egresosTotales,
      cashFlow,
      independencia,

      // ═══ ALIASES LEGACY (compatibilidad — no romper resto del código) ═══
      // ⚠ Nota: `ni` ahora significa Disponible (no Bruto). Intencional —
      //  el user pidió ver lo que efectivamente entra a la cuenta.
      tI: brutoTotal,
      ni: disponibleCuenta,
      tGF,
      gfm: tGF,
      tD: cuotasDeudas + impuestoNeto,
      te: egresosTotales,
      cf: cashFlow,
      ind: independencia,
      tTax: impuestoNeto,
      dynTax,
    };
  }, [user, simVals, getVal, taxOptimizado]);

  // ═══════════════════════════════════════════════════════════════════════
  // FASE 5 (18-jul-2026): simTMes — motor del cash flow DEL MES visualizado.
  //
  // A diferencia de simT (que promedia todo en 12 meses), este motor calcula
  // exactamente lo que pesa el mes seleccionado, considerando:
  //   • Ingresos: mensuales siempre + no-mensuales solo si cae en este mes
  //     (respetando estado pagado/pendiente por año)
  //   • Aportes obligatorios: siempre pesan (son mensuales por diseño)
  //   • Gastos familiares: mensuales siempre + no-mensuales solo si toca
  //   • Cuotas deudas: siempre (mensuales por diseño)
  //   • Impuesto neto y retención: siempre (anualizado ÷ 12, prorrateado)
  //
  // Reutiliza los overrides de sliders y toggles del simT (mismo estado).
  // ═══════════════════════════════════════════════════════════════════════
  const simTMes = useMemo(() => {
    const trm = 4200;
    const { año: añoActual } = getMesActual();
    const mes = mesVisualizado;

    // Ingresos del mes: aplicar overrides de sliders y frecuencia
    const ingSim = (user.ingresos || []).map((ing, ii) => {
      if (ing.sim === false) return ing;
      const baseCop = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
      const overrideCop = getVal(`ing_${ii}`, baseCop);
      const newMensual = ing.moneda === "USD" ? (overrideCop / trm) : overrideCop;
      return { ...ing, mensual: newMensual };
    });
    let brutoDelMes = 0;
    ingSim.forEach(ing => {
      if (ing.sim === false) return;
      const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
      brutoDelMes += montoDelMes({ ...ing, mensual: montoBase }, añoActual, mes);
    });

    // Gastos del mes: aportes obligatorios vs familiares
    let aportesObligatoriosMes = 0;
    let gastosFamiliaresMes = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      const gasWithOverrides = (items || []).map((g, gi) => {
        if (g.sim === false) return g;
        const newM = getVal(`gf_${cat}_${gi}`, g.m || 0);
        return { ...g, m: newM };
      });
      gasWithOverrides.forEach(g => {
        if (g.sim === false) return;
        const monto = montoDelMes(g, añoActual, mes);
        if (cat === "Seguridad Social") aportesObligatoriosMes += monto;
        else gastosFamiliaresMes += monto;
      });
    });

    // Cuotas deudas: siempre mensuales por diseño (retrocompat con simT)
    const cuotasDeudasMes = simT.cuotasDeudas || 0;

    // Impuesto neto y retención: anualizado ÷ 12 (constantes cada mes)
    const retencionMes = simT.retencionMensual || 0;
    const impuestoNetoMes = simT.impuestoNeto || 0;

    // Consolidación
    const disponibleMes = brutoDelMes - retencionMes;
    const egresosMes = aportesObligatoriosMes + gastosFamiliaresMes + cuotasDeudasMes + impuestoNetoMes;
    const cashFlowMes = disponibleMes - egresosMes;

    return {
      mes,
      añoActual,
      brutoDelMes,
      retencionMes,
      disponibleMes,
      aportesObligatoriosMes,
      gastosFamiliaresMes,
      cuotasDeudasMes,
      impuestoNetoMes,
      egresosMes,
      cashFlowMes,
      // Delta vs promedio (para mostrar en color)
      deltaVsPromedio: cashFlowMes - (simT.cashFlow || 0),
    };
  }, [user, simVals, mesVisualizado, getVal, simT.cuotasDeudas, simT.retencionMensual, simT.impuestoNeto, simT.cashFlow]);

  // ═══════════════════════════════════════════════════════════════════════
  // Widget mini de flujo anual (Fase 3 - 18-jul-2026).
  // Calcula cash flow por cada uno de los 12 meses del año actual usando
  // el mismo motor que simTMes pero iterando 12 veces. Solo produce el
  // resumen visual — el módulo /flujo tiene el detalle completo.
  // ═══════════════════════════════════════════════════════════════════════
  const cashFlowPorMes = useMemo(() => {
    const trm = 4200;
    const { año } = getMesActual();
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      let ingresosMes = 0;
      (user.ingresos || []).forEach(ing => {
        if (ing.sim === false) return;
        const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trm : 1);
        ingresosMes += montoDelMes({ ...ing, mensual: montoBase }, año, mes);
      });
      let aportesObl = 0, gastosFam = 0;
      Object.entries(user.gastos || {}).forEach(([cat, items]) => {
        (items || []).forEach(g => {
          if (g.sim === false) return;
          const monto = montoDelMes(g, año, mes);
          if (cat === "Seguridad Social") aportesObl += monto;
          else gastosFam += monto;
        });
      });
      const cuotas = simT.cuotasDeudas || 0;
      const retencion = simT.retencionMensual || 0;
      const impNeto = simT.impuestoNeto || 0;
      const cf = (ingresosMes - retencion) - (aportesObl + gastosFam + cuotas + impNeto);
      return { mes, mesLabel: MESES.find(m => m.v === mes)?.l.slice(0, 3) || "", cashFlow: cf };
    });
  }, [user, simT.cuotasDeudas, simT.retencionMensual, simT.impuestoNeto]);

  // ── Baseline (sin overrides de simVals, sin toggle Optimizado) ──
  // Reproduce la misma fórmula de simT pero usando los valores de la data
  // tal cual. Esto permite comparar simulado vs. base apples-to-apples.
  // Salida sigue el mismo contrato Bruto → Disponible → Cash Flow.
  const baseT = useMemo(() => {
    // Ingresos brutos
    let brutoTotal = 0;
    (user.ingresos || []).forEach((ing) => {
      if (ing.sim === false) return;
      brutoTotal += (ing.mensual || 0) * (ing.moneda === "USD" ? 4200 : 1);
    });

    // Gastos: aportes obligatorios vs familiares
    let aportesObligatorios = 0;
    let gastosFamiliares = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g) => {
        if (g.sim === false) return;
        const monto = g.m || 0;
        if (cat === "Seguridad Social") aportesObligatorios += monto;
        else gastosFamiliares += monto;
      });
    });
    const tGF = aportesObligatorios + gastosFamiliares;

    // Cuotas de deudas
    let cuotasDeudas = 0;
    (user.deudas || []).forEach((d) => {
      if ((d.mt || 0) > 0 && d.sim !== false) cuotasDeudas += (d.pago || d.pg || 0);
    });

    // Impuesto y retención
    let impuestoBrutoAnual = 0;
    let retencionAnual = 0;
    ((impuestoData && impuestoData.detalle) || []).forEach((td) => {
      const anual = td.impBruto != null ? td.impBruto : (td.impuesto || 0);
      impuestoBrutoAnual += anual;
      retencionAnual += (td.reteN || 0);
    });
    const retencionMensual = Math.round(retencionAnual / 12);
    const impuestoNeto = Math.max(0, Math.round((impuestoBrutoAnual - retencionAnual) / 12));

    // Consolidación
    const disponibleCuenta = brutoTotal - retencionMensual;
    const egresosTotales = tGF + cuotasDeudas + impuestoNeto;
    const cashFlow = disponibleCuenta - egresosTotales;

    return {
      brutoTotal, retencionMensual, disponibleCuenta,
      aportesObligatorios, gastosFamiliares, cuotasDeudas, impuestoNeto,
      egresosTotales, cashFlow,
      // Aliases legacy
      ni: disponibleCuenta, te: egresosTotales, cf: cashFlow,
      tTax: impuestoNeto, tGF,
    };
  }, [user, impuestoData]);

  const proj = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => ({
      m: "M" + i,
      actual: baseT.cf * i,
      simulado: simT.cf * i,
    }));
  }, [baseT, simT]);

  const scs = [
    { id: "actual", i: "📋", l: "Actual", d: "Valores reales", c: T.bl },
    { id: "conservador", i: "🐢", l: "Conservador", d: "Ing -20%, gas +10%", c: T.txt2 },
    { id: "optimista", i: "🚀", l: "Optimista", d: "Ing +30%, gas -15%", c: T.gn },
    { id: "crisis", i: "⚠️", l: "Crisis", d: "Ing -40%", c: T.rd },
  ];

  return (
    <div style={{overflowX:"hidden"}}>
      <PageHeader label="Simulador" title="Bienestar financiero" subtitle="Ajusta variables en tiempo real y proyecta tu camino a la independencia."/>

      {/* ═══ Card de escenario ═══
          Agrupa nombre + descripción + export en una card sutil bajo el header,
          alineada con la jerarquía visual del resto de la página. Antes esto
          flotaba alineado a la derecha del PageHeader lo que rompía la
          diagramación (screenshot Santiago 4-jul-2026). */}
      <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
              📋 Escenario
            </div>
            <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
              Nómbralo y descríbelo para exportarlo en PDF o Excel y compartirlo con tu contador o socios.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
            <button onClick={()=>{
              const w = window.open("","_blank");
              const fecha = new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
              const scenarioName = simName || "Simulación";
              const scenarioDesc = simDescripcion || "";
              const niveles = ["Seguridad","Vitalidad","Independencia","Libertad","Absoluta"];
              const nivel = simT.ind >= 250 ? 4 : simT.ind >= 150 ? 3 : simT.ind >= 100 ? 2 : simT.ind >= 75 ? 1 : 0;
              
              // Build income rows
              // BUG FIX 4-jul-2026: sesión anterior solo se arregló el PDF del
              // Dashboard (App.jsx generatePDF). Este PDF del Simulador tenía
              // el mismo bug — mostraba y sumaba items con sim===false. Los
              // KPIs de arriba (simT.ni/te/cf/ind) ya filtraban bien vía el
              // useMemo simT línea 291 pero las tablas del cuerpo del PDF
              // NO. Ahora aplican el mismo filtro sim!==false que el resto
              // del sistema (patrón DeudasModule:93 GastosModule:272 etc).
              const ingRows = (user.ingresos||[]).filter(i=>i.sim!==false).sort((a,b)=>(b.mensual||0)-(a.mensual||0)).map(i => {
                const cap = i.capital && i.tasa ? `<span style="color:#888;font-size:10px">Capital: $${(i.capital/1e6).toFixed(0)}M × ${i.tasa}%</span>` : "";
                return `<tr><td>${i.nombre||""}</td><td style="color:#888">${i.categoria||""}</td><td style="text-align:right;font-weight:600;color:#16a34a">$${Math.round(i.mensual||0).toLocaleString("es-CO")}</td><td>${cap}</td></tr>`;
              }).join("");
              
              // Build expense rows by category — filtra items apagados dentro
              // de cada categoría y elimina categorías que quedaron vacías
              // (por si todos los items estaban apagados).
              const gasCats = Object.entries(user.gastos||{}).map(([cat,items])=>{
                const active = (items||[]).filter(g=>g.sim!==false);
                return {cat,total:active.reduce((s,g)=>s+(g.m||0),0),items:active};
              }).filter(g=>g.total>0).sort((a,b)=>b.total-a.total);
              const gasRows = gasCats.map(g => {
                const detail = g.items.slice(0,3).map(i=>i.c).join(", ");
                return `<tr><td>${g.cat}</td><td style="color:#888;font-size:10px">${detail}</td><td style="text-align:right;font-weight:600;color:#dc2626">$${Math.round(g.total).toLocaleString("es-CO")}</td></tr>`;
              }).join("");
              
              // Build debt rows — filtra apagadas y las que no tienen saldo
              const deuRows = (user.deudas||[]).filter(d=>d.sim!==false && (d.mt||0)>0).map(d => 
                `<tr><td>${d.n||d.nombre||""}</td><td style="text-align:right">$${Math.round(d.mt||0).toLocaleString("es-CO")}</td><td style="text-align:right">$${Math.round(d.pg||0).toLocaleString("es-CO")}/mes</td><td style="text-align:right">${d.ts||0}%</td></tr>`
              ).join("");
              
              const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FINPATHIA — ${scenarioName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,system-ui,sans-serif;font-size:11px;color:#222;padding:20px 28px;max-width:800px;margin:0 auto}
h1{font-size:18px;font-weight:800;color:#16a34a;margin:0 0 2px}
h2{font-size:13px;font-weight:700;color:#333;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
.sub{font-size:10px;color:#888;margin-bottom:12px}
.desc{background:#f9fafb;border-left:3px solid #16a34a;padding:10px 14px;margin:0 0 14px;font-size:11px;color:#374151;line-height:1.5;border-radius:0 6px 6px 0}
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
<h1>FINPATHIA — ${scenarioName}</h1>
<div class="sub">${scenarioName} • ${fecha}</div>
${scenarioDesc ? `<div class="desc">${scenarioDesc.replace(/</g,"&lt;").replace(/\n/g,"<br>")}</div>` : ""}

<!-- Fase 4 PDF: bloque de desglose family office reemplaza los KPIs planos.
     Muestra Bruto → Retención → Disponible del lado ingresos y las 4 líneas
     del desglose de egresos. Es el bloque protagonista del PDF. -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0 20px">

  <!-- Card Ingresos -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px">
    <div style="font-size:9px;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:10px">💰 Ingresos Mensuales</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
      <span style="color:#374151">Bruto Total <span style="color:#9ca3af;font-size:9px">(genera activos)</span></span>
      <span style="font-weight:500">$${Math.round(simT.brutoTotal||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;padding-left:8px;border-left:2px solid #e5e7eb">
      <span style="color:#8b5cf6">− Retención <span style="color:#9ca3af;font-size:9px">(recuperable)</span></span>
      <span style="color:#8b5cf6;font-weight:500">−$${Math.round(simT.retencionMensual||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;padding-top:8px;border-top:1px solid #d1d5db">
      <span style="color:#16a34a">= DISPONIBLE</span>
      <span style="color:#16a34a">$${Math.round(simT.disponibleCuenta||0).toLocaleString("es-CO")}</span>
    </div>
  </div>

  <!-- Card Egresos -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px">
    <div style="font-size:9px;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:10px">💸 Egresos Mensuales</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
      <span style="color:#f59e0b">A. Aportes obligatorios</span>
      <span style="color:#f59e0b">$${Math.round(simT.aportesObligatorios||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
      <span style="color:#374151">B. Gastos familiares</span>
      <span>$${Math.round(simT.gastosFamiliares||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
      <span style="color:#374151">C. Cuotas de deudas</span>
      <span>$${Math.round(simT.cuotasDeudas||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px">
      <span style="color:#8b5cf6">D. Impuesto neto</span>
      <span style="color:#8b5cf6">$${Math.round(simT.impuestoNeto||0).toLocaleString("es-CO")}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;padding-top:8px;border-top:1px solid #d1d5db">
      <span style="color:#dc2626">= EGRESOS TOTALES</span>
      <span style="color:#dc2626">$${Math.round(simT.egresosTotales||simT.te||0).toLocaleString("es-CO")}</span>
    </div>
  </div>
</div>

<!-- Cash Flow protagonista -->
<div style="background:${simT.cf>=0?'#f0fdf4':'#fef2f2'};border:2px solid ${simT.cf>=0?'#16a34a':'#dc2626'};border-radius:10px;padding:14px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:10px;color:${simT.cf>=0?'#16a34a':'#dc2626'};font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${simT.cf>=0?'💰 CASH FLOW · Para ahorrar / invertir':'⚠️ CASH FLOW NEGATIVO'}</div>
    <div style="font-size:26px;font-weight:800;color:${simT.cf>=0?'#16a34a':'#dc2626'};margin-top:4px">$${Math.round(simT.cf).toLocaleString("es-CO")}<span style="font-size:11px;color:#9ca3af;font-weight:400">/mes</span></div>
    <div style="font-size:10px;color:#6b7280;margin-top:3px">Disponible $${Math.round(simT.disponibleCuenta||0).toLocaleString("es-CO")} − Egresos $${Math.round(simT.egresosTotales||simT.te||0).toLocaleString("es-CO")}</div>
  </div>
  <div style="display:flex;gap:22px;text-align:center">
    <div><div style="font-size:9px;color:#6b7280;letter-spacing:0.6px">AL AÑO</div><div style="font-size:17px;font-weight:700;color:${simT.cf>=0?'#16a34a':'#dc2626'}">$${Math.round(simT.cf*12).toLocaleString("es-CO")}</div></div>
    <div style="border-left:1px solid #d1d5db;padding-left:22px"><div style="font-size:9px;color:#6b7280;letter-spacing:0.6px">INDEPENDENCIA</div><div style="font-size:17px;font-weight:700;color:${simT.ind>=100?'#16a34a':'#eab308'}">${(simT.ind||0).toFixed(0)}%</div></div>
    <div style="border-left:1px solid #d1d5db;padding-left:22px"><div style="font-size:9px;color:#6b7280;letter-spacing:0.6px">NIVEL</div><div style="font-size:13px;font-weight:700;color:#3b82f6">${niveles[nivel]} (${nivel+1}/5)</div></div>
  </div>
</div>

<h2>💰 Ingresos Mensuales</h2>
<table><thead><tr><th>Fuente</th><th>Categoría</th><th style="text-align:right">Monto</th><th>Detalle</th></tr></thead>
<tbody>${ingRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #16a34a"><td colspan="2">TOTAL BRUTO</td><td style="text-align:right;color:#16a34a">$${Math.round(simT.brutoTotal||simT.ni||0).toLocaleString("es-CO")}</td><td></td></tr></tfoot>
</table>

<h2>💳 Gastos Familiares</h2>
<table><thead><tr><th>Categoría</th><th>Principales</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${gasRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #dc2626"><td colspan="2">TOTAL GASTOS</td><td style="text-align:right;color:#dc2626">$${Math.round(simT.gfm).toLocaleString("es-CO")}</td></tr></tfoot>
</table>

${deuRows ? `<h2>📋 Cuotas de Deudas</h2>
<table><thead><tr><th>Deuda</th><th style="text-align:right">Saldo</th><th style="text-align:right">Cuota</th><th style="text-align:right">Tasa</th></tr></thead>
<tbody>${deuRows}</tbody>
<tfoot><tr style="font-weight:700;border-top:2px solid #dc2626"><td>TOTAL CUOTAS</td><td></td><td style="text-align:right;color:#dc2626">$${Math.round((user.deudas||[]).filter(d=>d.sim!==false && (d.mt||0)>0).reduce((s,d)=>s+(d.pg||0),0)).toLocaleString("es-CO")}/mes</td><td></td></tr></tfoot>
</table>` : ""}

<h2>📊 Resumen</h2>
<div class="grid2">
  <div>
    <div class="bar-container"><div class="bar-fill" style="width:${Math.min(simT.ind,100)}%;background:${simT.ind>=100?"#16a34a":"#eab308"}"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#888"><span>0%</span><span>Independencia: ${(simT.ind||0).toFixed(0)}%</span><span>100%</span></div>
  </div>
  <div class="diag">
    ${simT.ind>=100?"✅ Independencia financiera alcanzada":"⚠ Falta $"+Math.round(simT.te-simT.ni).toLocaleString("es-CO")+"/mes"}<br>
    ${simT.cf>=0?"✅ Cash flow positivo: $"+Math.round(simT.cf).toLocaleString("es-CO")+"/mes":"❌ Cash flow negativo"}<br>
    📅 Disponible al día: $${Math.round(simT.cf/30).toLocaleString("es-CO")}
  </div>
</div>

<div class="footer">FINPATHIA — Informe generado el ${fecha} • finpathia.netlify.app</div>
</body></html>`;
              w.document.write(html);
              w.document.close();
              setTimeout(()=>w.print(), 500);
            }} style={{background:"#22c55e",color:"#000",border:"none",padding:"9px 16px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,flexShrink:0,display:"flex",alignItems:"center",gap:6}}>📄 PDF</button>
          <button onClick={async()=>{
              // Dynamic import de SheetJS para no cargar 500KB en el bundle
              // inicial — solo se descarga cuando el user hace click en Excel.
              const XLSX = await import("xlsx");
              const fecha = new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
              const scenarioName = simName || "Simulacion";
              const scenarioDesc = simDescripcion || "";
              const niveles = ["Seguridad","Vitalidad","Independencia","Libertad","Absoluta"];
              const nivel = simT.ind >= 250 ? 4 : simT.ind >= 150 ? 3 : simT.ind >= 100 ? 2 : simT.ind >= 75 ? 1 : 0;

              const wb = XLSX.utils.book_new();

              // ── HOJA 1: Resumen ejecutivo ──
              const resumenData = [
                ["FINPATHIA — Simulación de Escenario"],
                [],
                ["Escenario:", scenarioName],
                ["Fecha:", fecha],
                ...(scenarioDesc ? [["Descripción:", scenarioDesc]] : []),
                [],
                ["═══ INGRESOS (Bruto → Retención → Disponible) ═══"],
                ["Bruto Total mensual", Math.round(simT.brutoTotal || 0)],
                ["Bruto Total anual", Math.round((simT.brutoTotal || 0) * 12)],
                ["Retención en la fuente mensual (recuperable)", Math.round(simT.retencionMensual || 0)],
                ["Retención anual (crédito tributario)", Math.round((simT.retencionMensual || 0) * 12)],
                ["DISPONIBLE EN CUENTA mensual", Math.round(simT.disponibleCuenta || 0)],
                ["DISPONIBLE EN CUENTA anual", Math.round((simT.disponibleCuenta || 0) * 12)],
                [],
                ["═══ EGRESOS (desglose 4 líneas) ═══"],
                ["A. Aportes obligatorios (pensión + salud)", Math.round(simT.aportesObligatorios || 0)],
                ["B. Gastos familiares (vivienda, educación, etc.)", Math.round(simT.gastosFamiliares || 0)],
                ["C. Cuotas de deudas mensuales", Math.round(simT.cuotasDeudas || 0)],
                ["D. Impuesto neto (saldo tras retención)", Math.round(simT.impuestoNeto || 0)],
                ["EGRESOS TOTALES", Math.round(simT.egresosTotales || simT.te || 0)],
                [],
                ["═══ CASH FLOW ═══"],
                ["Cash flow mensual", Math.round(simT.cf)],
                ["Cash flow anual", Math.round(simT.cf*12)],
                ["Cash flow diario", Math.round(simT.cf/30)],
                [],
                ["═══ NIVEL DE LIBERTAD ═══"],
                ["Índice de independencia (%)", Number((simT.ind||0).toFixed(2))],
                ["Nivel de libertad", `${niveles[nivel]} (${nivel+1}/5)`],
                ["Estado independencia", simT.ind>=100?"Alcanzada":"En construcción"],
                ["Estado cash flow", simT.cf>=0?"Positivo":"Negativo"],
                ["Falta para independencia (mensual)", Math.max(0, Math.round((simT.egresosTotales || simT.te) - (simT.disponibleCuenta || simT.ni)))],
              ];
              const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
              wsResumen["!cols"] = [{wch:48},{wch:22}];
              XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

              // ── HOJA 2: Ingresos ──
              const ingresosData = [["Fuente","Categoría","Monto Mensual","Moneda","Capital","Tasa Anual %","Anual"]];
              (user.ingresos||[]).filter(i=>i.sim!==false).sort((a,b)=>(b.mensual||0)-(a.mensual||0)).forEach(i => {
                ingresosData.push([
                  i.nombre || "",
                  i.categoria || "",
                  Math.round(i.mensual || 0),
                  i.moneda || "COP",
                  i.capital || 0,
                  i.tasa || 0,
                  Math.round((i.mensual || 0) * 12),
                ]);
              });
              ingresosData.push([]);
              ingresosData.push(["TOTAL BRUTO","",Math.round(simT.brutoTotal||simT.ni||0),"","","",Math.round((simT.brutoTotal||simT.ni||0)*12)]);
              const wsIng = XLSX.utils.aoa_to_sheet(ingresosData);
              wsIng["!cols"] = [{wch:30},{wch:20},{wch:16},{wch:8},{wch:18},{wch:12},{wch:16}];
              XLSX.utils.book_append_sheet(wb, wsIng, "Ingresos");

              // ── HOJA 3: Gastos ──
              const gastosData = [["Categoría","Ítem","Monto","Tipo"]];
              Object.entries(user.gastos||{}).forEach(([cat, items]) => {
                (items||[]).filter(g=>g.sim!==false).forEach(g => {
                  gastosData.push([cat, g.c || "", Math.round(g.m || 0), g.t === "f" ? "Fijo" : "Variable"]);
                });
              });
              gastosData.push([]);
              gastosData.push(["TOTAL","",Math.round(simT.gfm),""]);
              const wsGas = XLSX.utils.aoa_to_sheet(gastosData);
              wsGas["!cols"] = [{wch:24},{wch:32},{wch:16},{wch:12}];
              XLSX.utils.book_append_sheet(wb, wsGas, "Gastos");

              // ── HOJA 4: Deudas ──
              const deudasData = [["Deuda","Saldo","Cuota Mensual","Tasa %","Meses Restantes"]];
              (user.deudas||[]).filter(d=>d.sim!==false && (d.mt||0)>0).forEach(d => {
                deudasData.push([
                  d.n || d.nombre || "",
                  Math.round(d.mt || 0),
                  Math.round(d.pg || 0),
                  d.ts || 0,
                  d.meses || d.n_cuotas || "",
                ]);
              });
              const totalDeudas = (user.deudas||[]).filter(d=>d.sim!==false && (d.mt||0)>0).reduce((s,d)=>s+(d.mt||0),0);
              const totalCuotas = (user.deudas||[]).filter(d=>d.sim!==false && (d.mt||0)>0).reduce((s,d)=>s+(d.pg||0),0);
              deudasData.push([]);
              deudasData.push(["TOTAL", Math.round(totalDeudas), Math.round(totalCuotas), "", ""]);
              const wsDeu = XLSX.utils.aoa_to_sheet(deudasData);
              wsDeu["!cols"] = [{wch:30},{wch:18},{wch:16},{wch:10},{wch:16}];
              XLSX.utils.book_append_sheet(wb, wsDeu, "Deudas");

              // Nombre de archivo limpio (sin caracteres raros para el filesystem)
              const safeName = scenarioName.replace(/[^\w\s-]/g,"").replace(/\s+/g,"_").slice(0,40) || "simulacion";
              const fileDate = new Date().toISOString().slice(0,10);
              XLSX.writeFile(wb, `FINPATHIA_${safeName}_${fileDate}.xlsx`);
            }} style={{background:"#059669",color:"#fff",border:"none",padding:"9px 16px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:13,flexShrink:0,display:"flex",alignItems:"center",gap:6}}>📊 Excel</button>
          </div>
        </div>

        {/* Inputs: nombre + descripción del escenario. Grid responsivo que en
            desktop pone el nombre y la descripción en 2 columnas y en mobile
            los apila (auto-fit + minmax). */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 10 }}>
          <input
            type="text"
            value={simName}
            onChange={e=>setSimName(e.target.value)}
            placeholder="Nombre del escenario…"
            style={{ background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 13, outline: "none", width: "100%" }}
          />
          <textarea
            value={simDescripcion}
            onChange={e=>setSimDescripcion(e.target.value)}
            placeholder="Descripción (opcional): contexto, supuestos, decisiones a evaluar…"
            rows={1}
            style={{ background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, minHeight: 42, width: "100%" }}
          />
        </div>
      </div>

      {/* ═══ FREEDOM BAR — reacts to simulated values ═══ */}
      <FreedomBarLive ni={simT.ni} te={simT.te} cf={simT.cf} />

      {/* Scenario presets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 20 }}>
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

      {/* ═══════════════════════════════════════════════════════════════════
          Widget mini de Flujo Anual (Fase 3 - 18-jul-2026).
          Muestra los 12 meses del año actual como micro-barras del cash flow
          con la línea de promedio. Click en cualquier parte lleva al módulo
          /flujo-anual completo con detalle mes a mes.
          ═══════════════════════════════════════════════════════════════════ */}
      {onNavigate && (() => {
        const maxAbs = Math.max(...cashFlowPorMes.map(m => Math.abs(m.cashFlow)), 1);
        const mesActualNum = getMesActual().mes;
        return (
          <div
            onClick={() => onNavigate("flujo")}
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 14,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gd + "60"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, letterSpacing: 1.2, textTransform: "uppercase" }}>📅 Cómo se comporta tu año</div>
                <div style={{ fontSize: 12, color: T.txt2, marginTop: 2 }}>Cash flow mes a mes · picos y valles del año {getMesActual().año}</div>
              </div>
              <div style={{ fontSize: 11, color: T.gd, fontWeight: 700, whiteSpace: "nowrap" }}>Ver detalle completo →</div>
            </div>
            {/* Mini barras del cash flow por mes */}
            <div style={{ display: "flex", alignItems: "flex-end", height: 60, gap: 4, marginTop: 8 }}>
              {cashFlowPorMes.map((m) => {
                const heightPct = (Math.abs(m.cashFlow) / maxAbs) * 100;
                const positivo = m.cashFlow >= 0;
                const esActual = m.mes === mesActualNum;
                return (
                  <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{
                      width: "100%",
                      height: `${Math.max(heightPct, 2)}%`,
                      background: positivo ? T.gn : T.rd,
                      opacity: esActual ? 1 : 0.65,
                      borderRadius: "3px 3px 0 0",
                      border: esActual ? `1.5px solid ${T.gd}` : "none",
                    }} title={`${m.mesLabel}: ${fm(m.cashFlow)}`} />
                    <div style={{ fontSize: 9, color: esActual ? T.gd : T.txt3, marginTop: 3, fontWeight: esActual ? 700 : 500 }}>{m.mesLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          FASE 2 (4-jul-2026): rediseño family office del bloque de KPIs.
          Antes: 5 KPI cards horizontales sin desglose.
          Ahora: 2 cards estructuradas (INGRESOS y EGRESOS) con el desglose
          del contrato Bruto→Retención→Disponible y Aportes/Gastos/Deudas/Imp.
          Más el Hero Cash Flow (rediseñado). Todo con delta vs baseline.
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 14, marginBottom: 16 }}>

        {/* ─────────── CARD INGRESOS (Bruto → Retención → Disponible) ─────────── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
            💰 Ingresos mensuales
          </div>

          {/* Fila 1: Bruto Total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: T.txt2 }}>Bruto Total</div>
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 1 }}>Lo que generan tus activos</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.txt, fontFamily: "'Plus Jakarta Sans',ui-monospace" }}>
              {fm(simT.brutoTotal || 0)}
            </div>
          </div>

          {/* Fila 2: Retención (crédito recuperable) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingLeft: 12, borderLeft: `2px solid ${T.txt3}20` }}>
            <div>
              <div style={{ fontSize: 12, color: T.txt3 }}>− Retención en la fuente</div>
              <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 1 }}>💳 Crédito recuperable en declaración</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#a78bfa", fontFamily: "'Plus Jakarta Sans',ui-monospace" }}>
              −{fm(simT.retencionMensual || 0)}
            </div>
          </div>

          {/* Divisor + Fila 3: Disponible en Cuenta (protagonista) */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.gn, letterSpacing: 0.5 }}>= DISPONIBLE EN CUENTA</div>
                <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>Lo que efectivamente entra al banco</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.gn, fontFamily: "'Plus Jakarta Sans',ui-monospace", letterSpacing: "-0.02em" }}>
                {fm(simT.disponibleCuenta || 0)}
              </div>
            </div>
            {baseT.disponibleCuenta != null && Math.abs((simT.disponibleCuenta || 0) - (baseT.disponibleCuenta || 0)) > 1 && (
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, textAlign: "right" }}>
                Δ vs base: {(simT.disponibleCuenta || 0) - (baseT.disponibleCuenta || 0) >= 0 ? "+" : ""}{fm((simT.disponibleCuenta || 0) - (baseT.disponibleCuenta || 0))}
              </div>
            )}
          </div>
        </div>

        {/* ─────────── CARD EGRESOS (4 líneas del desglose) ─────────── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>
            💸 Egresos mensuales
          </div>

          {/* Las 4 líneas del desglose */}
          {[
            { label: "A. Aportes obligatorios", sub: "Pensión + salud (independiente)", value: simT.aportesObligatorios || 0, color: "#f59e0b" },
            { label: "B. Gastos familiares", sub: "Vivienda, educación, transporte…", value: simT.gastosFamiliares || 0, color: T.txt2 },
            { label: "C. Cuotas de deudas", sub: "Hipotecas, préstamos, TC", value: simT.cuotasDeudas || 0, color: T.txt2 },
            { label: "D. Impuesto neto", sub: "Saldo a pagar tras retención", value: simT.impuestoNeto || 0, color: "#a78bfa" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, opacity: row.value > 0 ? 1 : 0.5 }}>
              <div>
                <div style={{ fontSize: 12, color: T.txt2 }}>{row.label}</div>
                <div style={{ fontSize: 9.5, color: T.txt3, marginTop: 1 }}>{row.sub}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: row.color, fontFamily: "'Plus Jakarta Sans',ui-monospace" }}>
                {fm(row.value)}
              </div>
            </div>
          ))}

          {/* Divisor + Total */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.rd, letterSpacing: 0.5 }}>= EGRESOS TOTALES</div>
                <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>Todo lo que sale cada mes</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.rd, fontFamily: "'Plus Jakarta Sans',ui-monospace", letterSpacing: "-0.02em" }}>
                {fm(simT.egresosTotales || 0)}
              </div>
            </div>
            {baseT.egresosTotales != null && Math.abs((simT.egresosTotales || 0) - (baseT.egresosTotales || 0)) > 1 && (
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, textAlign: "right" }}>
                Δ vs base: {(simT.egresosTotales || 0) - (baseT.egresosTotales || 0) >= 0 ? "+" : ""}{fm((simT.egresosTotales || 0) - (baseT.egresosTotales || 0))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FASE 5 (18-jul-2026): CASH FLOW HERO con vista dual promedio + mes.
          Patrón Robinhood/Bloomberg: número grande = métrica estratégica
          (promedio), subtítulo = contexto del mes actual con delta color.
          Dropdown discreto arriba-derecha permite explorar cualquier mes.
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: simT.cf >= 0 ? "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.02))" : "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.02))", border: "1px solid " + (simT.cf >= 0 ? T.gn : T.rd) + "30", borderRadius: 16, padding: "22px 28px", marginBottom: 16 }}>
        {/* Fila superior: label izquierda + dropdown mes derecha */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: simT.cf >= 0 ? T.gn : T.rd, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {simT.cf >= 0 ? "💰 Cash Flow · Promedio del año" : "⚠️ Cash Flow · Déficit promedio"}
          </div>
          {/* Dropdown de mes para ver la REALIDAD de ese mes específico */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: T.txt3, letterSpacing: 0.5, textTransform: "uppercase" }}>📅 Ver mes real:</span>
            <select
              value={mesVisualizado}
              onChange={(e) => setMesVisualizado(Number(e.target.value))}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", color: T.txt, fontSize: 12, fontWeight: 600, outline: "none", cursor: "pointer" }}
            >
              {MESES.map(m => (
                <option key={m.v} value={m.v}>
                  {m.l} {simTMes.añoActual}{m.v === getMesActual().mes ? " (actual)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cuerpo: 2 columnas — izquierda números principales, derecha metricas */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            {/* Número GRANDE del promedio (estratégico) */}
            <div style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontWeight: 800, color: simT.cf >= 0 ? T.gn : T.rd, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {fm(simT.cf)}<span style={{ fontSize: 14, fontWeight: 400, color: T.txt3, marginLeft: 4 }}>/mes promedio</span>
            </div>
            {/* Subtítulo: LA REALIDAD del mes visualizado (usa montoDelMes que
                respeta items pagados, vigencia, y variable mes a mes) */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: T.txt3, fontWeight: 500 }}>
                📅 Realidad de {MESES.find(m => m.v === mesVisualizado)?.l}:
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: simTMes.cashFlowMes >= 0 ? T.gn : T.rd }}>
                {fm(simTMes.cashFlowMes)}
              </span>
              {/* Delta con color (verde si mes > promedio, naranja si mes < promedio) */}
              {Math.abs(simTMes.deltaVsPromedio) > 100 && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: simTMes.deltaVsPromedio >= 0 ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                  color: simTMes.deltaVsPromedio >= 0 ? T.gn : "#f97316",
                  letterSpacing: 0.3,
                }}>
                  {simTMes.deltaVsPromedio >= 0 ? "▲" : "▼"} {simTMes.deltaVsPromedio >= 0 ? "+" : ""}{fm(simTMes.deltaVsPromedio)} vs promedio
                </span>
              )}
            </div>
            {/* Micro-explicación de la fórmula del promedio */}
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 6 }}>
              Disponible <span style={{ color: T.txt2 }}>{fm(simT.disponibleCuenta || 0)}</span> − Egresos <span style={{ color: T.txt2 }}>{fm(simT.egresosTotales || 0)}</span>
            </div>
          </div>

          {/* Columna derecha: métricas secundarias */}
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1 }}>Al año</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: simT.cf >= 0 ? T.gn : T.rd, marginTop: 2 }}>{fm(simT.cf * 12)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1 }}>Al día</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.txt2, marginTop: 2 }}>{fm(Math.round(simT.cf / 30))}</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: `1px solid ${T.border}`, paddingLeft: 24 }}>
              <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1 }}>Independencia</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: simT.ind >= 100 ? T.gn : "#eab308", marginTop: 2 }}>{pc(simT.ind)}</div>
            </div>
          </div>
        </div>
      </div>
      {/* fin bloque de KPIs Fase 5 */}

      {/* Sliders + Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {/* LEFT: Sliders */}
        <div style={{ paddingRight: 8 }}>
          {/* ═══ SLIDERS POR PROPIETARIO ═══ */}
          {(()=>{
            const owners = (user.owners || [{id:"own_1",name:"Personal",type:"natural"}]);
            const allIng = (user.ingresos || []).map((ing, i) => ({...ing, _idx: i}));
            const allGas = user.gastos || {};
            const allDeu = ((user&&user.deudas) || []).map((d, i) => ({...d, _idx: i}));
            const gasFlat = [];
            Object.entries(allGas).forEach(([cat, items]) => (items||[]).forEach((g, gi) => gasFlat.push({...g, cat, _gkey: "gf_"+cat+"_"+gi})));
            
            // Group by owner + "sin asignar"
            const groups = [];
            owners.forEach(ow => {
              const oIng = allIng.filter(i => i.owner === ow.id);
              const oGas = gasFlat.filter(g => g.owner === ow.id);
              const oDeu = allDeu.filter(d => d.owner === ow.id);
              const taxDetail = ((simT.dynTax && simT.dynTax.detalle) || []).find(td => td.name === ow.name);
              if (oIng.length > 0 || oGas.length > 0 || oDeu.length > 0) {
                groups.push({ owner: ow, ing: oIng, gas: oGas, deu: oDeu, tax: taxDetail });
              }
            });
            // Sin asignar
            const saIng = allIng.filter(i => !i.owner || i.owner === "" || i.owner === "na");
            const saGas = gasFlat.filter(g => !g.owner || g.owner === "" || g.owner === "na");
            const saDeu = allDeu.filter(d => !d.owner || d.owner === "" || d.owner === "na");
            if (saIng.length > 0 || saGas.length > 0 || saDeu.length > 0) {
              groups.push({ owner: { id: "na", name: "Sin asignar / Exterior", type: "na" }, ing: saIng, gas: saGas, deu: saDeu, tax: null });
            }
            
            return groups.map((grp, gi) => {
              const ow = grp.owner;
              const isJ = ow.type === "juridica";
              const icon = ow.type === "juridica" ? "🏢" : ow.type === "na" ? "🌐" : "👤";
              const color = ow.type === "juridica" ? "#3b82f6" : ow.type === "na" ? "#71717a" : "#22c55e";
              
              return (
                <div key={ow.id} style={{ marginBottom: 20, background: color + "06", borderRadius: 14, border: "1px solid " + color + "15", overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid " + color + "15", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{icon} {ow.name}</div>
                    <div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica" : ow.type === "na" ? "No calcula impuesto" : "Persona Natural"}</div>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {/* Ingresos */}
                    {grp.ing.length > 0 && <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#22d3ee", margin: "4px 0 6px", textTransform: "uppercase" }}>💰 Ingresos ({grp.ing.length})</div>
                      {grp.ing.map((ing, ii) => {
                        if (ing.sim === false) return null;
                        const safeIdx = ing._idx != null ? ing._idx : ii;
                        const baseRenta = (Number(ing.mensual)||0) * (ing.moneda==="USD"?4200:1);
                        const baseCap = Number(ing.capital) || 0;
                        // FIX conceptual 25-may-2026 (reportado por Santiago):
                        // El capital invertido es un HECHO — ya está invertido y
                        // sigue valiendo lo mismo. NO debe moverse con el slider.
                        // La RENTA es la protagonista: es lo que varía (vacancia,
                        // aumento de canon, cambio de rendimiento). El slider mueve
                        // la renta directamente; la tasa de retorno se recalcula
                        // como CONSECUENCIA de la renta sobre el capital fijo.
                        const simCap = baseCap; // capital fijo, dato de referencia
                        const baseTasa = Number(ing.tasa) || 0;
                        const isInvType = ["Rendimiento","Dividendos","Arriendo","Inversión","Intereses bancarios","Utilidad FIC"].some(t => (ing.categoria||"").includes(t));
                        const hasCap = simCap > 0; // tiene capital registrado → es inversión
                        // La renta la controla el slider directamente
                        const simRenta = getVal("ing_"+safeIdx, baseRenta);
                        // Tasa de retorno = consecuencia (renta anual / capital)
                        const simTasa = simCap > 0
                          ? Math.round((simRenta*12/simCap)*1000)/10
                          : baseTasa;
                        const rentDiff = simRenta - baseRenta;
                        
                        return (
                          <div key={"ing_"+safeIdx} style={{marginBottom:10, background:"rgba(34,211,238,0.04)", borderRadius:10, padding:"10px 14px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                              <div>
                                <div style={{fontSize:13,fontWeight:700}}>{ing.nombre||"Ingreso"}</div>
                                <div style={{fontSize:10,color:T.txt3}}>{ing.categoria||""}{simTasa>0?" • "+simTasa+"% anual":""}</div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:16,fontWeight:800,color:"#22d3ee"}}>{fm(simRenta)}<span style={{fontSize:10,fontWeight:400,color:T.txt3}}>/mes</span></div>
                                {rentDiff!==0&&<div style={{fontSize:10,color:rentDiff>0?T.gn:T.rd,fontWeight:600}}>{rentDiff>0?"+":""}{fm(rentDiff)}</div>}
                              </div>
                            </div>
                            
                            {hasCap ? (<>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
                                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"6px 10px"}}>
                                  <div style={{fontSize:9,color:T.txt3}}>Capital invertido</div>
                                  <div style={{fontSize:14,fontWeight:700}}>{fm(simCap)}</div>
                                </div>
                                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"6px 10px"}}>
                                  <div style={{fontSize:9,color:T.txt3}}>Renta mensual ({simTasa}% anual)</div>
                                  <div style={{fontSize:14,fontWeight:700,color:"#22d3ee"}}>{fm(simRenta)}</div>
                                </div>
                              </div>
                              <Slider label="Renta mensual" value={simRenta} base={baseRenta}
                                max={Math.max(Math.round(baseRenta*2),1000)} color={"#22d3ee"}
                                onChange={(v)=>setVal("ing_"+safeIdx,v)}
                                sub="el capital invertido se mantiene fijo" />
                            </>) : (
                              <Slider label={ing.nombre||"Ingreso"} value={simRenta} base={baseRenta}
                                max={Math.max(baseRenta*3,1000)} color={"#22d3ee"}
                                onChange={(v)=>setVal("ing_"+safeIdx,v)}
                                sub={isInvType?"💡 Agrega Capital y Tasa para simular inversión":""} />
                            )}
                          </div>
                        );
                      })}
                    </>}
                    
                    {/* Gastos */}
                    {grp.gas.length > 0 && <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.rd, margin: "10px 0 6px", textTransform: "uppercase" }}>💳 Gastos ({grp.gas.length})</div>
                      {grp.gas.map((g, gi) => {
                        if (g.sim === false) return null;
                        const key = g._gkey || ("gf_"+g.cat+"_"+gi);
                        // UX FIX 2 (20-jul-2026, Santiago): el sub es SENSIBLE
                        // AL MES visualizado — "si ese mes se pagó el seguro,
                        // carga completo ese mes; el siguiente ya pagado → $0".
                        // montoDelMes ya respeta mesPago, pagados, vigencia y
                        // variable; acá solo lo mostramos por item.
                        const freqG = getFrecuencia(g);
                        const { año: añoNow } = getMesActual();
                        const pagadoYa = freqG !== "mensual" && freqG !== "variable" && estaPagadoEnAño(g, añoNow);
                        const promG = montoPromedioMensual(g);
                        const enMesVis = montoDelMes(g, añoNow, mesVisualizado);
                        const mesVisL = (MESES.find(m => m.v === mesVisualizado)?.l || "").slice(0, 3);
                        const rangoLtd = (Number(g.desdeMes) || 1) !== 1 || (Number(g.hastaMes) || 12) !== 12;
                        let subG = g.cat;
                        if (freqG === "variable") {
                          subG = `${g.cat} · 📊 Var · ${mesVisL}: ${fm(enMesVis)} · prom ${fm(promG)}/mes`;
                        } else if (freqG !== "mensual") {
                          const fLabel = FRECUENCIAS.find(f => f.v === freqG)?.l || freqG;
                          subG = pagadoYa
                            ? `${g.cat} · 🎯 ${fLabel} · ✅ pagado ${añoNow} · ${mesVisL}: $0`
                            : `${g.cat} · 🎯 ${fLabel} · ${mesVisL}: ${fm(enMesVis)} · prom ${fm(promG)}/mes`;
                        } else if (rangoLtd) {
                          subG = `${g.cat} · 📅 vigencia · ${mesVisL}: ${fm(enMesVis)}`;
                        }
                        return <Slider key={key} label={g.c||g.cat} value={getVal(key, g.m)} base={g.m}
                          max={Math.max(g.m*3,500)} color={pagadoYa ? T.txt3 : T.rd}
                          onChange={(v)=>setVal(key,v)}
                          sub={subG} />;
                      })}
                    </>}
                    
                    {/* Deudas */}
                    {grp.deu.length > 0 && <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.pr, margin: "10px 0 6px", textTransform: "uppercase" }}>📋 Deudas ({grp.deu.length})</div>
                      {grp.deu.map((d, di) => {
                        if (d.sim === false) return null;
                        const idx = allDeu.findIndex(x=>x.id===d.id||(x.n===d.n&&x.mt===d.mt));
                        const cuota = d.pago||d.pg||0;
                        const saldo = d.mt||0;
                        const safeDebtIdx = idx >= 0 ? idx : "d"+gi+"_"+di;
                        const simCuota = getVal("debt_"+safeDebtIdx, cuota);
                        return (
                          <div key={"d_"+idx} style={{marginBottom:6}}>
                            <Slider label={d.nombre||d.n||""} value={simCuota} base={cuota}
                              max={Math.max(cuota*3,500)} color={T.pr}
                              onChange={(v)=>setVal("debt_"+safeDebtIdx,v)} sub="" />
                            <div style={{display:"flex",gap:8,paddingLeft:4,fontSize:10,color:T.txt3}}>
                              <span>Saldo: {fm(saldo)}</span>
                              <span>Cuota: {fm(simCuota)}/mes</span>
                            </div>
                          </div>
                        );
                      })}
                    </>}
                    
                    {/* Impuestos */}
                    {grp.tax && <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 6px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>🧾 Impuesto de renta (cálculo dinámico)</div>
                      </div>
                      {(()=>{
                        const nameKey = grp.tax.name;
                        const isOpt = !!taxOptimizado[nameKey];
                        // Valores brutos (total por tabla, antes de retención)
                        const impBrutoActualMes = Math.round((grp.tax.impBruto != null ? grp.tax.impBruto : (grp.tax.impuesto||0))/12);
                        const impBrutoOptMes = Math.round((grp.tax.impOptBruto != null ? grp.tax.impOptBruto : (grp.tax.impOptimizado||grp.tax.impuesto||0))/12);
                        const reteNMes = Math.round((grp.tax.reteN || 0) / 12);
                        const baseMes = isOpt ? impBrutoOptMes : impBrutoActualMes;
                        // Slider override opera sobre el BRUTO (total)
                        const simImp = getVal(`tax_${nameKey}`, baseMes);
                        const simImpAnual = simImp * 12;
                        // Saldo en declaración = simulado bruto - retención pagada
                        const saldoMes = Math.max(0, simImp - reteNMes);
                        const saldoAnual = saldoMes * 12;
                        const ingresoAnual = grp.tax.ingreso || 0;
                        const tasaEfectiva = ingresoAnual > 0 ? (simImpAnual / ingresoAnual * 100) : 0;
                        const ahorroOpt = (impBrutoActualMes - impBrutoOptMes) * 12;
                        const ajusteExtra = baseMes - simImp;
                        const sliderMax = Math.max(Math.max(impBrutoActualMes, impBrutoOptMes) * 2, 100000);
                        const toggleActual = () => { setTaxOptimizado(p => ({ ...p, [nameKey]: false })); setSimVals(p => { const n = { ...p }; delete n[`tax_${nameKey}`]; return n; }); };
                        const toggleOpt = () => { setTaxOptimizado(p => ({ ...p, [nameKey]: true })); setSimVals(p => { const n = { ...p }; delete n[`tax_${nameKey}`]; return n; }); };
                        const isJuridica = grp.tax.type === "juridica";
                        const saldoActualAnualToggle = Math.max(0, impBrutoActualMes - reteNMes) * 12;
                        const saldoOptAnualToggle = Math.max(0, impBrutoOptMes - reteNMes) * 12;
                        // Commit 9 Tarea 3: aplicar Camino A al simulador.
                        // El motor ya aplica TODAS las deducciones legales automaticas (Art. 119,
                        // 387, 206, 336, etc). El "Optimizado" solo agrega palancas hipoteticas
                        // (PV/AFC adicional). Cuando el ahorro real entre Actual y Optimizado es
                        // <= \$100K, mostrar UN SOLO numero es mas honesto que toggles que sugieren
                        // "2 escenarios" cuando en realidad solo hay 1 escenario real (Actual) +
                        // un escenario hipotetico que no aporta nada.
                        //
                        // Coincide con la decision tomada en CalculadoraWizard.jsx (Commit 14
                        // "Camino A"). Aplicar misma logica al simulador es coherencia UX.
                        const ahorroOptAnual = (impBrutoActualMes - impBrutoOptMes) * 12;
                        const mostrarComparativo = ahorroOptAnual > 100_000;
                        // Si NO hay ahorro real, forzar modo Actual (no Optimizado) para evitar
                        // estado inconsistente. El usuario nunca ve el toggle pero internamente
                        // estamos en modo Actual = el unico escenario real.
                        const isOptEffectivo = mostrarComparativo ? isOpt : false;
                        const baseMesEffectivo = isOptEffectivo ? impBrutoOptMes : impBrutoActualMes;
                        const simImpEffectivo = mostrarComparativo ? simImp : (getVal(`tax_${nameKey}`, impBrutoActualMes));
                        const simImpAnualEffectivo = simImpEffectivo * 12;
                        const saldoMesEffectivo = Math.max(0, simImpEffectivo - reteNMes);
                        const saldoAnualEffectivo = saldoMesEffectivo * 12;
                        const tasaEfectivaEff = ingresoAnual > 0 ? (simImpAnualEffectivo / ingresoAnual * 100) : 0;
                        return <div>
                          {/* Modo COMPARATIVO: solo cuando hay ahorro real > \$100K via PV/AFC */}
                          {mostrarComparativo && (
                            <div style={{display:"flex",gap:6,marginBottom:8}}>
                              <button onClick={toggleActual} style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid "+(isOpt?"rgba(255,255,255,0.06)":"#a78bfa"),background:isOpt?"transparent":"rgba(167,139,250,0.1)",color:isOpt?T.txt3:"#a78bfa",cursor:"pointer",fontSize:10,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                                <span>Tu impuesto hoy</span>
                                <span style={{fontWeight:700,fontSize:11}}>Saldo: {fm(saldoActualAnualToggle)}/año</span>
                                <span style={{fontSize:9,opacity:0.7,fontWeight:400}}>Bruto: {fm(impBrutoActualMes*12)}/año</span>
                              </button>
                              <button onClick={toggleOpt} style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid "+(isOpt?"#22c55e":"rgba(255,255,255,0.06)"),background:isOpt?"rgba(34,197,94,0.1)":"transparent",color:isOpt?T.gn:T.txt3,cursor:"pointer",fontSize:10,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                                <span>Si aplicás PV/AFC</span>
                                <span style={{fontWeight:700,fontSize:11}}>Saldo: {fm(saldoOptAnualToggle)}/año</span>
                                <span style={{fontSize:9,opacity:0.7,fontWeight:400}}>Bruto: {fm(impBrutoOptMes*12)}/año</span>
                              </button>
                            </div>
                          )}
                          {/* Modo UNIFICADO: cuando no hay ahorro real adicional, mostrar SOLO
                              el escenario actual con texto explicativo de que ya esta optimizado. */}
                          {!mostrarComparativo && (
                            <div style={{marginBottom:8,padding:"10px 12px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.15)",borderRadius:8,fontSize:10,color:T.txt2,lineHeight:1.5}}>
                              <div style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:4}}>📋 Tu impuesto estimado</div>
                              <div style={{lineHeight:1.5}}>Ya con todas las deducciones automáticas que el motor pudo aplicar de tus datos {isJuridica ? "(35% utilidad, ICA, retenciones)" : "(Art. 119, 206, 387, 336 ET)"}. Las palancas estándar (PV/AFC) no aportan ahorro adicional en tu caso. Si querés simular estrategias por fuera del modelo, usá el slider manual abajo.</div>
                            </div>
                          )}
                          <div style={{background:isOptEffectivo?"rgba(34,197,94,0.06)":"rgba(167,139,250,0.06)",borderRadius:10,padding:"12px 14px",border:"1px solid "+(isOptEffectivo?"rgba(34,197,94,0.15)":"rgba(167,139,250,0.15)"),marginBottom:8}}>
                            {/* 3 líneas transparentes: Total / Retención / Saldo */}
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                                <div>
                                  <div style={{fontSize:10,color:T.txt2,fontWeight:600}}>{isJuridica ? "🧾 Impuesto corporativo bruto (35% × utilidad)" : "🧾 Impuesto total (tabla progresiva DIAN)"}</div>
                                  <div style={{fontSize:9,color:T.txt3,marginTop:1}}>{isJuridica ? "Tasa efectiva sobre ingresos: " : "Tasa efectiva sobre ingreso bruto: "}{tasaEfectivaEff.toFixed(1)}%{isJuridica && grp.tax.baseGravable > 0 && grp.tax.ingreso > 0 && <span> · Utilidad/ingreso: {((grp.tax.baseGravable / grp.tax.ingreso) * 100).toFixed(0)}%</span>}</div>
                                </div>
                                <div style={{fontSize:17,fontWeight:800,color:isOptEffectivo?T.gn:"#a78bfa"}}>{fm(simImpAnualEffectivo)}<span style={{fontSize:10,color:T.txt3,fontWeight:400}}>/año</span></div>
                              </div>
                              {reteNMes > 0 && <>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:6,borderTop:"1px dashed rgba(255,255,255,0.06)"}}>
                                  <div style={{fontSize:10,color:T.txt2}}>{isJuridica ? "🏛️ ICA + retenciones descontables" : "🏛️ Retención en la fuente (ya pagada)"}</div>
                                  <div style={{fontSize:14,fontWeight:600,color:T.txt2}}>−{fm(reteNMes*12)}<span style={{fontSize:10,color:T.txt3,fontWeight:400}}>/año</span></div>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:6,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                                  <div style={{fontSize:11,color:T.txt,fontWeight:700}}>📋 Saldo a pagar en declaración</div>
                                  <div style={{fontSize:16,fontWeight:800,color:saldoAnualEffectivo===0?T.gn:T.txt}}>{fm(saldoAnualEffectivo)}<span style={{fontSize:10,color:T.txt3,fontWeight:400}}>/año</span></div>
                                </div>
                                {saldoAnualEffectivo === 0 && simImpAnualEffectivo > 0 && <div style={{fontSize:10,color:T.gn,fontWeight:600,marginTop:2}}>✅ Los descuentos ya cubren tu impuesto. Incluso podrías recibir devolución.</div>}
                              </>}
                            </div>
                            {/* Hint solo aplica en modo comparativo cuando el usuario esta en Actual y hay ahorro real disponible */}
                            {mostrarComparativo && ahorroOpt > 0 && !isOpt && <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:10,color:T.gn,fontWeight:600}}>💡 Aplicar PV/AFC ahorra {fm(ahorroOpt)}/año → activá el toggle para ver el impacto en cash flow</div>}
                          </div>
                          {/* Commit 10 Tarea 3: el slider ahora opera sobre el SALDO A PAGAR
                              (lo que el usuario efectivamente desembolsa), no sobre el impuesto
                              bruto. Razon: el usuario piensa en lo que paga, no en lo que la
                              tabla DIAN dice. Si su saldo es \$0, el slider arranca en \$0. Si
                              quiere subir el slider para simular un escenario peor, esta en su
                              libertad. Cualquier "ajuste manual" que haga sobre el saldo se
                              traduce internamente a un ajuste equivalente sobre el bruto
                              (saldoSimulado + retencion = brutoSimulado).
                           */}
                          {(() => {
                            // Valor que muestra el slider: SALDO mensual (lo relevante)
                            const saldoMesEff = saldoMesEffectivo;
                            const saldoMesBase = Math.max(0, baseMesEffectivo - reteNMes);
                            const saldoMesMax = Math.max(saldoMesBase * 2, baseMesEffectivo + reteNMes); // permite explorar hasta el bruto si quiere
                            // Cuando el usuario mueve el slider de saldo, se traduce a bruto
                            const onChangeSaldo = (saldoNuevo) => {
                              // bruto = saldo + retencion (manteniendo retencion fija)
                              const brutoEquivalente = Math.max(0, saldoNuevo + reteNMes);
                              setVal(`tax_${nameKey}`, brutoEquivalente);
                            };
                            return (
                              <div style={{background:(isOptEffectivo?T.gn:"#a78bfa")+"08",border:"1px solid "+(isOptEffectivo?T.gn:"#a78bfa")+"20",borderRadius:10,padding:"10px 12px"}}>
                                <div style={{fontSize:10,fontWeight:700,color:isOptEffectivo?T.gn:"#a78bfa",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>🎛️ Ajuste manual — saldo a pagar</div>
                                <div style={{fontSize:10,color:T.txt3,marginBottom:8,lineHeight:1.5}}>
                                  El slider arranca en tu <strong>saldo real</strong>. Movelo hacia arriba para simular escenarios más conservadores, o si lográs <strong>estrategias adicionales</strong> que el sistema no modela (donaciones, depreciación agresiva, créditos fiscales especiales) que cambien el saldo final.
                                </div>
                                <Slider label="" value={saldoMesEff} base={saldoMesBase}
                                  max={saldoMesMax} color={isOptEffectivo ? T.gn : "#a78bfa"}
                                  onChange={onChangeSaldo}
                                  sub="" />
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:4,fontSize:11}}>
                                  <span style={{color:T.txt3}}>Saldo anual ajustado:</span>
                                  <span style={{fontWeight:700,color:isOptEffectivo?T.gn:"#a78bfa"}}>{fm(saldoMesEff*12)}<span style={{fontSize:9,color:T.txt3,fontWeight:400}}> · {fm(saldoMesEff)}/mes</span></span>
                                </div>
                                {/* Diferencia respecto al saldo real (no al bruto) */}
                                {(() => {
                                  const diffSaldoMes = saldoMesEff - saldoMesBase;
                                  if (Math.abs(diffSaldoMes) < 100) return null;
                                  return (
                                    <div style={{marginTop:6,fontSize:10,color:diffSaldoMes>0?T.or:T.gn,fontWeight:600}}>
                                      {diffSaldoMes > 0
                                        ? `⚠️ Escenario más conservador: +${fm(diffSaldoMes*12)}/año de saldo`
                                        : `🎯 Ahorro adicional: ${fm(Math.abs(diffSaldoMes)*12)}/año menos de saldo`}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                          <div style={{marginTop:6,fontSize:9,color:T.txt3,fontStyle:"italic",paddingLeft:4,lineHeight:1.5}}>
                            {saldoAnualEffectivo === 0 && simImpAnualEffectivo > 0
                              ? "ℹ️ Tu saldo es $0 porque la retención ya cubre tu impuesto. Si subís el slider, simulás un escenario con menos retenciones del año (ej: cambio de empleador, freelance) o más impuesto causado."
                              : isJuridica
                                ? "El saldo a pagar es el desembolso real al presentar la declaración: impuesto bruto menos retenciones recibidas."
                                : "El saldo a pagar es lo que efectivamente desembolsás al presentar la declaración (impuesto causado menos retención del año)."}
                          </div>
                        </div>;
                      })()}
                    </>}
                  </div>
                </div>
              );
            });
          })()}

          <button onClick={() => { setSimVals({}); setScenario("actual"); setTaxOptimizado({}); }}
            style={{ padding: "10px 20px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12, width: "100%" }}>
            🔄 Reset Todo
          </button>
        </div>

        {/* RIGHT: Chart + Summary */}
        <div>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 20, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 14 }}>Acumulación Cash Flow — 12 Meses</div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={proj}>
                <ChartGradients/>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="m" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => {if(Math.abs(v)>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(Math.abs(v)>=1e6)return"$"+(v/1e6).toFixed(0)+"M";if(Math.abs(v)>=1e3)return"$"+(v/1e3).toFixed(0)+"K";return"$"+v}} />
                <Tooltip content={<ChartTooltip formatter={(v) => fm(v)}/>} />
                <Area type="monotone" dataKey="actual" stroke={CHART.txt3} fill="transparent" strokeDasharray="5 5" strokeWidth={1.5} name="Actual" />
                <Area type="monotone" dataKey="simulado" stroke={CHART.green} fill="url(#gradGreen)" strokeWidth={2.5} name="Simulado" />
                <Legend wrapperStyle={{fontSize:12,paddingTop:8}} iconType="circle"/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>CF Actual</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: baseT.cf >= 0 ? T.gn : T.rd }}>{fm(baseT.cf)}</div>
              </div>
              <div style={{ background: simT.cf >= 0 ? T.gnD : T.rdD, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>CF Simulado</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: simT.cf >= 0 ? T.gn : T.rd }}>{fm(simT.cf)}</div>
              </div>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Impacto Anual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: (simT.cf - baseT.cf) >= 0 ? T.gn : T.rd }}>
                  {(simT.cf - baseT.cf) >= 0 ? "+" : ""}{fm((simT.cf - baseT.cf) * 12)}/año
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
