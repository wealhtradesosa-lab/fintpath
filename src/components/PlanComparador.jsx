// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Comparador de escenarios (Mi futuro a 10 años · Escenarios)
//
// 24-oct-2026 (Santiago: "se crean los escenarios y deberían poder verse como
// se ven en este HTML, que uno los ve, los compara, elige cuál quiere ver en
// detalle y lo ve con todo"). Referencia: su "Plan Patrimonial SALEM":
//   · El patrimonio en el tiempo, plan por plan (curvas con su cifra al final)
//   · Tarjetas por plan (año 10, real al año) → abren el informe completo
//   · Hoy y los planes en seis números
//   · ¿Da para vivir todos los años?
//   · El patrimonio como empresa: cuánto factura y cuánto gana al año
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ChartTooltip } from "../lib/chartTheme.jsx";
import { INF, fmM, fmEje, fmPct } from "../lib/informeTheme.js";

const card = { background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const h3 = { margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: INF.tx };
const lead = { margin: "0 0 12px", fontSize: 12, color: INF.tx2, lineHeight: 1.5 };
const eje = { tick: { fill: INF.tx2, fontSize: 11 }, axisLine: { stroke: INF.eje }, tickLine: { stroke: INF.eje } };
const grid = { strokeDasharray: "0", stroke: INF.grid, vertical: false };
const th = { textAlign: "right", fontWeight: 600, color: INF.tx2, padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, whiteSpace: "nowrap" };
const td = { textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, color: INF.tx, whiteSpace: "nowrap" };
const anioTxt = (a) => (a === 0 ? "Hoy" : `Año ${a}`);

/** Métricas de un plan para comparar. */
function medir(r, inflacionPct) {
  const f = r.filas, f0 = f[0], f1 = f[1] || f0, fin = f[f.length - 1];
  const cagr = f0.patrimonio > 0 && fin.patrimonio > 0 ? (Math.pow(fin.patrimonio / f0.patrimonio, 1 / Math.max(1, fin.anio)) - 1) * 100 : null;
  const real = cagr == null ? null : ((1 + cagr / 100) / (1 + inflacionPct / 100) - 1) * 100;
  const peor = f.slice(1).reduce((m, x) => { const s = (x.ingresos - x.gastos) / 12; return m == null || s < m.s ? { s, x } : m; }, null);
  const prom = f.slice(1).reduce((s, x) => s + (x.produce || 0), 0) / Math.max(1, f.length - 1);
  const gastoProm = f.slice(1).reduce((s, x) => s + (x.gastos || 0), 0) / Math.max(1, f.length - 1);
  const patProm = f.slice(1).reduce((s, x) => s + (x.patrimonio || 0), 0) / Math.max(1, f.length - 1);
  return {
    fin, cagr, real, peor,
    seis: { Ingresos: f1.ingresos / 12, "Gastos y cuotas": f1.gastos / 12, Excedente: Math.max(0, (f1.ingresos - f1.gastos) / 12), "Crece invertido": (f1.crece || 0) / 12, "Produce en total": (f1.produce || 0) / 12 },
    coberturaFin: fin.gastos > 0 ? fin.ingresos / fin.gastos * 100 : null,
    empresa: { factura: prom, gasto: Math.min(prom, gastoProm), utilidad: Math.max(0, prom - gastoProm), pct: patProm > 0 ? prom / patProm * 100 : 0 },
  };
}

export default function PlanComparador({ planes, inflacionPct = 4, onVer }) {
  const [modo, setModo] = useState("nominal");
  const m = useMemo(() => planes.map((p, i) => ({ ...p, color: p.esHoy ? INF.gris : INF.serie[i % INF.serie.length], k: "p" + i, med: medir(p.r, inflacionPct) })), [planes, inflacionPct]);
  const d = (f) => (modo === "real" ? f.deflactor || 1 : 1);
  const curvas = (m[0]?.r.filas || []).map((_, i) => { const row = { anio: anioTxt(i) }; m.forEach((p) => { const f = p.r.filas[i]; if (f) row[p.k] = f.patrimonio / d(f); }); return row; });
  const orden = [...m].sort((a, b) => b.med.fin.patrimonio - a.med.fin.patrimonio);
  // Etiquetas al final de cada curva sin encimarse: se ordenan por la cifra
  // final y se separan al menos 14 px (en unidades del eje, aprox.).
  const ultimo = curvas[curvas.length - 1] || {};
  const vals = m.map((p) => ultimo[p.k] || 0), rango = Math.max(1, Math.max(...vals) - Math.min(0, ...vals));
  const desp = {}; let prevV = null, acum = 0;
  [...m].sort((a, b) => (ultimo[b.k] || 0) - (ultimo[a.k] || 0)).forEach((p) => { const v = ultimo[p.k] || 0; acum = prevV != null && (prevV - v) / rango < 0.05 ? acum + 14 : 0; desp[p.k] = acum; prevV = v; });
  const cats = ["Ingresos", "Gastos y cuotas", "Excedente", "Crece invertido", "Produce en total"];
  const seis = cats.map((c) => { const row = { c }; m.forEach((p) => { row[p.k] = p.med.seis[c]; }); return row; });
  const maxEmp = Math.max(1, ...m.map((p) => p.med.empresa.factura));

  return (
    <div style={{ color: INF.tx }}>
      <div style={card}>
        <h3 style={h3}>El patrimonio en el tiempo, plan por plan</h3>
        <p style={lead}>Patrimonio neto año a año. Todos parten del mismo punto: lo que tienes hoy. La línea gris es seguir como vas, sin cambiar nada.</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{[["nominal", "Pesos de cada año"], ["real", `En pesos de hoy (inflación ${fmPct(inflacionPct, 1)})`]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${modo === k ? INF.tx : INF.linea}`, background: modo === k ? INF.tx : "transparent", color: modo === k ? INF.panel : INF.tx2, fontSize: 12, cursor: "pointer" }}>{l}</button>)}</div>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={340}>
          <LineChart data={curvas} margin={{ top: 10, right: 150, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={74} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} />} />
            {m.map((p) => <Line key={p.k} type="monotone" dataKey={p.k} name={p.nombre} stroke={p.color} strokeWidth={p.esHoy ? 1.6 : 2.2} dot={false}
              label={(q) => (q.index === curvas.length - 1 ? <text x={q.x + 6} y={q.y + 4 + (desp[p.k] || 0)} fill={p.color} fontSize={11}>{`${p.nombre.slice(0, 18)} ${fmM(q.value)}`}</text> : null)} />)}
          </LineChart>
        </ResponsiveContainer></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
        {orden.map((p) => <button key={p.k} onClick={() => onVer && onVer(p)} style={{ textAlign: "left", background: INF.panel, border: `1px solid ${INF.linea}`, borderTop: `3px solid ${p.color}`, borderRadius: 12, padding: 12, color: INF.tx, cursor: onVer ? "pointer" : "default" }}>
          <div style={{ fontSize: 11, color: INF.tx2, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.esHoy ? "Si nada cambia" : "Escenario"}</div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 6px" }}>{p.nombre}</div>
          <div style={{ fontSize: 22, fontFamily: "Georgia, 'Times New Roman', serif" }}>{fmM(p.med.fin.patrimonio)}</div>
          <div style={{ fontSize: 11, color: INF.tx2 }}>año 10 · {p.med.real == null ? "—" : `${p.med.real >= 0 ? "+" : ""}${fmPct(p.med.real, 1)} real`}</div>
          {onVer && <div style={{ fontSize: 12, color: INF.azul, marginTop: 6 }}>Ver en detalle →</div>}
        </button>)}
      </div>

      <div style={card}>
        <h3 style={h3}>Hoy y los planes en cinco números</h3>
        <p style={lead}>Al mes, en el año 1. «Crece invertido» es lo que producen las inversiones que no recibes (se reinvierte); «Produce en total» suma la renta que llega y lo que crece.</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={280}>
          <BarChart data={seis} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="c" {...eje} interval={0} />
            <YAxis {...eje} tickFormatter={fmEje} width={70} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: INF.tx2 }} />
            {m.map((p) => <Bar key={p.k} dataKey={p.k} name={p.nombre} fill={p.color} />)}
          </BarChart>
        </ResponsiveContainer></div></div>
      </div>

      <div style={card}>
        <h3 style={h3}>¿Da para vivir todos los años?</h3>
        <p style={lead}>El año más apretado de cada plan, contando obras, pagos y cambios de renta. Cobertura = lo que entra ÷ lo que sale; la meta es 120 % o más.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Plan</th><th style={th}>Año más apretado</th><th style={th}>Ese año sobran al mes</th><th style={th}>Cobertura ese año</th><th style={th}>Cobertura año 10</th><th style={{ ...th, textAlign: "left" }}>¿Se sostiene?</th></tr></thead>
          <tbody>{m.map((p) => { const pe = p.med.peor, cob = pe && pe.x.gastos > 0 ? pe.x.ingresos / pe.x.gastos * 100 : null; return <tr key={p.k}>
            <td style={{ ...td, textAlign: "left", fontWeight: 600 }}><span style={{ display: "inline-block", width: 8, height: 8, background: p.color, marginRight: 6 }} />{p.nombre}</td>
            <td style={td}>{pe ? anioTxt(pe.x.anio) : "—"}</td>
            <td style={{ ...td, color: pe && pe.s < 0 ? INF.bad : INF.tx }}>{pe ? fmM(pe.s) : "—"}</td>
            <td style={{ ...td, fontWeight: 700, color: cob != null && cob < 100 ? INF.bad : INF.tx }}>{cob == null ? "—" : fmPct(cob, 0)}</td>
            <td style={td}>{p.med.coberturaFin == null ? "—" : fmPct(p.med.coberturaFin, 0)}</td>
            <td style={{ ...td, textAlign: "left", whiteSpace: "normal", color: INF.tx2 }}>{cob == null ? "—" : cob >= 120 ? "Sí: aun en el peor año sobra plata" : cob >= 100 ? "Justo: el peor año queda por debajo de la meta de 120 %" : "No: hay años en que sale más de lo que entra"}</td>
          </tr>; })}</tbody>
        </table></div>
      </div>

      <div style={card}>
        <h3 style={h3}>El patrimonio como empresa: cuánto factura y cuánto gana al año</h3>
        <p style={lead}>Cada barra es lo que produce el patrimonio en un año (rentas + lo que crece invertido), en promedio de los 10 años. La parte gris se gasta para vivir; la de color es la utilidad, lo que queda y hace crecer el patrimonio. El % es sobre el patrimonio.</p>
        {[...m].sort((a, b) => b.med.empresa.factura - a.med.empresa.factura).map((p) => <div key={p.k} style={{ display: "grid", gridTemplateColumns: "minmax(90px,26%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "5px 0" }}>
          <span style={{ textAlign: "right", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ display: "flex", width: `${Math.max(2, p.med.empresa.factura / maxEmp * 72)}%`, height: 16 }}><span style={{ flex: p.med.empresa.gasto, background: INF.gris }} /><span style={{ flex: p.med.empresa.utilidad, background: p.color }} /></span>
            <span style={{ whiteSpace: "nowrap" }}><b>{fmM(p.med.empresa.factura)}</b> <span style={{ color: INF.tx2, fontSize: 11 }}>{fmPct(p.med.empresa.pct, 1)} del patrimonio</span></span>
          </span>
        </div>)}
      </div>
    </div>
  );
}
