import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const T = {
  bg2: "#18181b", bg3: "#27272a",
  card: "#111113", cardBorder: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", purple: "#a78bfa", orange: "#f59e0b",
  grad1: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
};
const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const pct = (n) => (n || 0).toFixed(1) + "%";
const TT = { background: "#18181b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#fafafa", fontSize: 12 };

function Slider({ label, value, base, max, color, onChange, sub }) {
  const perc = base > 0 ? Math.round((value / base) * 100) : 100;
  const diff = value - base;
  return (
    <div style={{ marginBottom: 4, background: `${color}08`, padding: "8px 12px", borderRadius: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: T.txt2, fontWeight: 500 }}>{label} {sub && <span style={{ fontSize: 10, color: T.txt3 }}>{sub}</span>}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {diff !== 0 && <span style={{ fontSize: 10, color: diff > 0 ? T.green : T.red, fontWeight: 600 }}>{diff > 0 ? "+" : ""}{fmt(diff)}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmt(value)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="range" min="0" max={max} step={Math.max(Math.round(max * 0.01), 5)} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: color, height: 4, cursor: "pointer" }} />
        <span style={{ fontSize: 10, color: T.txt3, minWidth: 32, textAlign: "right" }}>{perc}%</span>
      </div>
    </div>
  );
}

export default function SimuladorAvanzado({ user, totals }) {
  const [simVals, setSimVals] = useState({});
  const [scenario, setScenario] = useState("actual");

  const setVal = useCallback((key, val) => {
    setSimVals((prev) => ({ ...prev, [key]: val }));
  }, []);

  const getVal = useCallback((key, def) => {
    return simVals[key] !== undefined ? simVals[key] : def;
  }, [simVals]);

  // Apply scenario presets
  const applyScenario = (id) => {
    setScenario(id);
    if (id === "actual") { setSimVals({}); return; }
    const factors = { conservador: { ing: 0.8, gas: 1.1 }, optimista: { ing: 1.3, gas: 0.85 }, crisis: { ing: 0.6, gas: 1.05 } };
    const f = factors[id] || { ing: 1, gas: 1 };
    const newVals = {};

    // Apply to all income items
    (user.inv || []).forEach((inv) => {
      const items = inv.unidades
        ? inv.unidades.flatMap((u, ui) => [...(u.ingresos || []).map((ig, ii) => ({ key: `i_${inv.id}_u${ui}_${ii}`, base: ig.m })), ...(u.gastos || []).map((g, gi) => ({ key: `g_${inv.id}_u${ui}_${gi}`, base: g.m }))])
        : [...(inv.ingresos || []).map((ig, ii) => ({ key: `i_${inv.id}_${ii}`, base: ig.m })), ...(inv.gastos || []).map((g, gi) => ({ key: `g_${inv.id}_${gi}`, base: g.m }))];
      items.forEach((it) => {
        const isIncome = it.key.startsWith("i_");
        newVals[it.key] = Math.round(it.base * (isIncome ? f.ing : f.gas));
      });
    });

    // Apply to family expenses
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g, gi) => {
        newVals[`gf_${cat}_${gi}`] = Math.round(g.m * f.gas);
      });
    });

    // Apply to debt payments
    (user.deudas || []).forEach((d, di) => {
      newVals[`debt_${di}`] = d.pago; // keep debts unchanged
    });

    setSimVals(newVals);
  };

  // ── Calculate simulated totals ──
  const simTotals = useMemo(() => {
    let totalIng = 0, totalGasOp = 0;

    (user.inv || []).forEach((inv) => {
      if (inv.unidades) {
        inv.unidades.forEach((u, ui) => {
          (u.ingresos || []).forEach((ig, ii) => { totalIng += getVal(`i_${inv.id}_u${ui}_${ii}`, ig.m); });
          (u.gastos || []).forEach((g, gi) => { totalGasOp += getVal(`g_${inv.id}_u${ui}_${gi}`, g.m); });
        });
      } else {
        (inv.ingresos || []).forEach((ig, ii) => { totalIng += getVal(`i_${inv.id}_${ii}`, ig.m); });
        (inv.gastos || []).forEach((g, gi) => { totalGasOp += getVal(`g_${inv.id}_${gi}`, g.m); });
      }
    });

    let totalGasFam = 0;
    Object.entries(user.gastos || {}).forEach(([cat, items]) => {
      items.forEach((g, gi) => { totalGasFam += getVal(`gf_${cat}_${gi}`, g.m); });
    });

    let totalDebt = 0;
    (user.deudas || []).forEach((d, di) => { totalDebt += getVal(`debt_${di}`, d.pago); });

    const ingNetos = totalIng - totalGasOp;
    const totalEgresos = totalGasFam + totalDebt;
    const cashFlow = ingNetos - totalEgresos;
    const independencia = totalEgresos > 0 ? (ingNetos / totalEgresos) * 100 : 0;

    return { totalIng, totalGasOp, ingNetos, totalGasFam, totalDebt, totalEgresos, cashFlow, independencia };
  }, [user, simVals, getVal]);

  const proj = useMemo(() => {
    const nw = totals.nw || 0;
    return Array.from({ length: 13 }, (_, i) => ({
      m: "M" + i,
      actual: nw + (totals.cf || 0) * i,
      simulado: nw + simTotals.cashFlow * i,
    }));
  }, [totals, simTotals]);

  const scenarios = [
    { id: "actual", i: "📋", l: "Actual", d: "Valores reales", c: T.blue },
    { id: "conservador", i: "🐢", l: "Conservador", d: "Ing -20%, gas +10%", c: T.txt2 },
    { id: "optimista", i: "🚀", l: "Optimista", d: "Ing +30%, gas -15%", c: T.green },
    { id: "crisis", i: "⚠️", l: "Crisis", d: "Ing -40%", c: T.red },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Simulador Financiero</h2>
      <p style={{ color: T.txt3, fontSize: 13, marginBottom: 20 }}>Ajusta cada ingreso y gasto con sliders para ver el impacto en tiempo real</p>

      {/* Scenario Presets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
        {scenarios.map((sc) => {
          const active = scenario === sc.id;
          return (
            <button key={sc.id} onClick={() => applyScenario(sc.id)} style={{ padding: 14, borderRadius: 14, border: `2px solid ${active ? sc.c : T.cardBorder}`, background: active ? sc.c + "10" : T.card, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 20 }}>{sc.i}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? sc.c : T.txt2 }}>{sc.l}</div>
              <div style={{ fontSize: 9, color: T.txt3 }}>{sc.d}</div>
            </button>
          );
        })}
      </div>

      {/* Results Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Ingreso Neto", v: fmt(simTotals.ingNetos), c: T.green, d: fmt(simTotals.ingNetos - totals.ni) },
          { l: "Gastos Total", v: fmt(simTotals.totalEgresos), c: T.red, d: fmt(simTotals.totalEgresos - totals.te) },
          { l: "Cash Flow", v: fmt(simTotals.cashFlow), c: simTotals.cashFlow >= 0 ? T.green : T.red, d: fmt(simTotals.cashFlow - totals.cf) },
          { l: "Independencia", v: pct(simTotals.independencia), c: simTotals.independencia >= 100 ? T.green : T.txt2 },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
            {m.d && <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>Δ {m.d}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* LEFT: Sliders */}
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 8 }}>
          {/* INVESTMENTS */}
          <h4 style={{ fontSize: 13, color: T.green, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>📈 Activos — Ingresos & Gastos</h4>
          {(user.inv || []).map((inv) => {
            const items = inv.unidades
              ? inv.unidades.flatMap((u, ui) => [
                  ...(u.ingresos || []).map((ig, ii) => ({ key: `i_${inv.id}_u${ui}_${ii}`, label: `${u.nombre}: ${ig.c}`, base: ig.m, type: "ing" })),
                  ...(u.gastos || []).map((g, gi) => ({ key: `g_${inv.id}_u${ui}_${gi}`, label: `${u.nombre}: ${g.c}`, base: g.m, type: "gas" })),
                ])
              : [
                  ...(inv.ingresos || []).map((ig, ii) => ({ key: `i_${inv.id}_${ii}`, label: ig.c, base: ig.m, type: "ing" })),
                  ...(inv.gastos || []).map((g, gi) => ({ key: `g_${inv.id}_${gi}`, label: g.c, base: g.m, type: "gas" })),
                ];
            if (items.length === 0) return null;

            // Calculate simulated NOI for this asset
            const simIng = items.filter((it) => it.type === "ing").reduce((s, it) => s + getVal(it.key, it.base), 0);
            const simGas = items.filter((it) => it.type === "gas").reduce((s, it) => s + getVal(it.key, it.base), 0);
            const simNOI = simIng - simGas;

            return (
              <div key={inv.id} style={{ marginBottom: 10, background: `rgba(255,255,255,0.02)`, borderRadius: 10, border: `1px solid ${T.green}20`, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: T.bg2, borderBottom: `1px solid ${T.green}15`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{inv.nombre}</span>
                    <span style={{ fontSize: 10, color: T.txt3, marginLeft: 6 }}>{inv.ubi}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {simIng > 0 && <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>↑{fmt(simIng)}</span>}
                    {simGas > 0 && <span style={{ fontSize: 11, color: T.txt2, fontWeight: 600 }}>↓{fmt(simGas)}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: simNOI >= 0 ? T.green : T.red, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 6 }}>
                      NOI: {fmt(simNOI)}
                    </span>
                  </div>
                </div>
                <div style={{ padding: "6px 8px" }}>
                  {items.map((it) => (
                    <Slider key={it.key} label={it.label} value={getVal(it.key, it.base)} base={it.base}
                      max={Math.max(it.base * 3, 500)} color={it.type === "ing" ? T.green : T.red}
                      onChange={(v) => setVal(it.key, v)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* FAMILY EXPENSES */}
          <h4 style={{ fontSize: 13, color: T.red, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>💳 Gastos Familiares</h4>
          {Object.entries(user.gastos || {}).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "8px 0 4px", paddingTop: 4, borderTop: `1px solid ${T.cardBorder}` }}>{cat}</div>
              {items.map((g, gi) => {
                const key = `gf_${cat}_${gi}`;
                return (
                  <Slider key={key} label={g.c} value={getVal(key, g.m)} base={g.m}
                    max={Math.max(g.m * 3, 500)} color={T.red}
                    onChange={(v) => setVal(key, v)} sub={g.t} />
                );
              })}
            </div>
          ))}

          {/* DEBT PAYMENTS */}
          <h4 style={{ fontSize: 13, color: T.purple, fontWeight: 700, margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>📋 Cuotas de Deudas</h4>
          {(user.deudas || []).map((d, di) => {
            const key = `debt_${di}`;
            const linked = (user.inv || []).find((i) => i.id === d.link);
            return (
              <Slider key={key} label={d.nombre} value={getVal(key, d.pago)} base={d.pago}
                max={Math.max(d.pago * 3, 500)} color={T.purple}
                onChange={(v) => setVal(key, v)} sub={linked ? `→ ${linked.nombre}` : d.tasa > 0 ? `${d.tasa}%` : ""} />
            );
          })}

          <button onClick={() => { setSimVals({}); setScenario("actual"); }} style={{ padding: "10px 20px", background: T.bg3, border: `1px solid ${T.cardBorder}`, color: T.txt2, borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12, width: "100%" }}>
            🔄 Reset Todo
          </button>
        </div>

        {/* RIGHT: Chart */}
        <div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 14 }}>Proyección 12 Meses</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={proj}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                <XAxis dataKey="m" tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickFormatter={(v) => "$" + (v / 1e3).toFixed(0) + "k"} />
                <Tooltip contentStyle={TT} formatter={(v) => fmt(v)} />
                <Area type="monotone" dataKey="actual" stroke={T.txt3} fill={T.txt3 + "08"} strokeDasharray="5 5" name="Actual" />
                <defs><linearGradient id="gsim" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.green} stopOpacity={0.3} /><stop offset="100%" stopColor={T.green} stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey="simulado" stroke={T.green} fill="url(#gsim)" strokeWidth={2} name="Simulado" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>

            {/* Summary */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Cash Flow Actual</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: totals.cf >= 0 ? T.green : T.red }}>{fmt(totals.cf)}</div>
              </div>
              <div style={{ background: simTotals.cashFlow >= 0 ? T.greenDim : T.redDim, padding: 12, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Cash Flow Simulado</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: simTotals.cashFlow >= 0 ? T.green : T.red }}>{fmt(simTotals.cashFlow)}</div>
              </div>
              <div style={{ background: T.bg2, padding: 12, borderRadius: 10, textAlign: "center", gridColumn: "1/-1" }}>
                <div style={{ fontSize: 10, color: T.txt3 }}>Impacto Anual</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: (simTotals.cashFlow - totals.cf) >= 0 ? T.green : T.red }}>
                  {(simTotals.cashFlow - totals.cf) >= 0 ? "+" : ""}{fmt((simTotals.cashFlow - totals.cf) * 12)}/año
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
