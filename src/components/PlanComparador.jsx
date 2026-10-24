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
import { resumenEscenario } from "../lib/futuro10.js";

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

// 24-oct-2026 (Santiago: "me falta esta gráfica que es muy buena" — «Cómo se
// reparte el patrimonio en cada camino» de su plan SALEM). Una franja por plan
// que suma 100 % de sus activos justo después de las decisiones (hoy). Las
// inversiones que pesan ≥ 5 % en algún plan van con su nombre; el resto se
// agrupa por tipo. Tocar un tramo lo resalta en todos los caminos.
const GRUPO_CLASE = { inmueble: "Otros inmuebles", liquido: "Efectivo y liquidez", acciones: "Bolsa", nueva: "Otras inversiones nuevas", otro: "Otros activos", vehiculo: "Vehículos", canasta: "Lo que sobra, reinvertido" };
function reparto(planes) {
  const filas = planes.map((p) => (p.esHoy ? p.r.filas[0] : p.r.filas[0]).porActivo || []);
  const totales = filas.map((l) => l.filter((a) => a.valor > 0).reduce((s, a) => s + a.valor, 0));
  const grande = new Set();
  filas.forEach((l, i) => l.forEach((a) => { if (a.valor > 0 && totales[i] > 0 && a.valor / totales[i] >= 0.05 && a.clase !== "canasta") grande.add(a.id); }));
  const grupoDe = (a) => (grande.has(a.id) ? { k: a.id, nombre: a.nombre } : { k: "g_" + (a.clase || "otro"), nombre: GRUPO_CLASE[a.clase] || "Otros activos" });
  const grupos = {}; const orden = [];
  const porPlan = filas.map((l) => { const m = {}; l.filter((a) => a.valor > 0).forEach((a) => { const g = grupoDe(a); if (!grupos[g.k]) { grupos[g.k] = { k: g.k, nombre: g.nombre }; orden.push(g.k); } (m[g.k] = m[g.k] || { valor: 0, items: [] }); m[g.k].valor += a.valor; m[g.k].items.push(a); }); return m; });
  // Orden estable: primero los grupos con nombre (por peso total), luego los agrupados.
  const peso = (k) => porPlan.reduce((s, m) => s + (m[k]?.valor || 0), 0);
  orden.sort((a, b) => (a.startsWith("g_") - b.startsWith("g_")) || peso(b) - peso(a));
  orden.forEach((k, i) => { grupos[k].color = k.startsWith("g_") ? (k === "g_canasta" ? INF.sobra : INF.gris) : INF.serie[i % INF.serie.length]; });
  return { orden, grupos, porPlan, totales };
}

function Reparto({ m }) {
  const [sel, setSel] = useState(null);
  const { orden, grupos, porPlan, totales } = useMemo(() => reparto(m), [m]);
  return (
    <div style={card}>
      <h3 style={h3}>Cómo se reparte el patrimonio en cada camino</h3>
      <p style={lead}>Cada franja suma 100 % de los activos de ese camino, justo después de sus decisiones. Toca un tramo: se resalta esa inversión en todos los caminos y abajo ves cuánto vale en cada uno.</p>
      {m.map((p, i) => <div key={p.k} style={{ display: "grid", gridTemplateColumns: "minmax(70px,18%) minmax(0,1fr)", gap: 10, alignItems: "center", margin: "8px 0" }}>
        <span style={{ textAlign: "right", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
        <div>
          <div style={{ display: "flex", height: 30, gap: 2, minWidth: 0, overflow: "hidden" }}>
            {orden.filter((k) => porPlan[i][k]).map((k) => { const v = porPlan[i][k].valor, pct = totales[i] > 0 ? v / totales[i] * 100 : 0; const g = grupos[k];
              return <button key={k} onClick={() => setSel(sel === k ? null : k)} title={`${g.nombre} ${fmPct(pct, 0)} · ${fmM(v)}`}
                style={{ flex: `${pct} 0 0`, minWidth: 3, background: g.color, opacity: sel && sel !== k ? 0.25 : 1, border: "none", borderRadius: 3, padding: 0, color: INF.sobreColor, fontSize: 12, fontWeight: 700, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "clip" }}>
                {pct >= 12 ? `${g.nombre.length > 14 ? g.nombre.slice(0, 13) + "…" : g.nombre} ${fmPct(pct, 0)}` : pct >= 4 ? fmPct(pct, 0) : ""}</button>; })}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: INF.tx2, marginTop: 2 }}>Total {fmM(totales[i])}</div>
        </div>
      </div>)}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12, color: INF.tx2, marginTop: 10 }}>
        {orden.map((k) => <button key={k} onClick={() => setSel(sel === k ? null : k)} style={{ background: "none", border: "none", padding: 0, color: sel === k ? INF.tx : INF.tx2, cursor: "pointer", fontSize: 12 }}><span style={{ display: "inline-block", width: 10, height: 10, background: grupos[k].color, marginRight: 5, borderRadius: 3 }} />{grupos[k].nombre}</button>)}
      </div>
      {sel && <div style={{ marginTop: 12, borderTop: `1px solid ${INF.linea}`, paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}><span style={{ display: "inline-block", width: 10, height: 10, background: grupos[sel].color, marginRight: 6, borderRadius: 3 }} />{grupos[sel].nombre}</div>
        {m.map((p, i) => { const g = porPlan[i][sel]; return <div key={p.k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
          <span>{p.nombre}{g && g.items.length > 1 ? <span style={{ color: INF.tx2, fontSize: 11 }}> · {g.items.map((a) => `${a.nombre} ${fmM(a.valor)}`).join(", ")}</span> : null}</span>
          <b style={{ whiteSpace: "nowrap" }}>{g ? `${fmM(g.valor)} · ${fmPct(totales[i] > 0 ? g.valor / totales[i] * 100 : 0, 0)}` : "—"}</b></div>; })}
      </div>}
    </div>
  );
}

export default function PlanComparador({ planes, inflacionPct = 4, onVer, onRecomendar, onEditar, onBorrar, onGuardarBorrador, onDescartarBorrador }) {
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
      {/* Tarjetas de los caminos (como el plan SALEM): de menor a mayor patrimonio en el año 10. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,210px),1fr))", gap: 10, marginBottom: 14 }}>
        {[...m].sort((a, b) => (b.esHoy - a.esHoy) || a.med.fin.patrimonio - b.med.fin.patrimonio).map((p, i, arr) => {
          const letra = p.esHoy ? null : String.fromCharCode(65 + arr.filter((x) => !x.esHoy).indexOf(p));
          return <div key={p.k} role="button" tabIndex={0} onClick={() => onVer && onVer(p)} onKeyDown={(e) => { if (e.key === "Enter" && onVer) onVer(p); }}
            style={{ position: "relative", textAlign: "left", background: INF.panel, border: `1px solid ${p.recomendado ? INF.teja : INF.linea}`, borderTop: `3px solid ${p.color}`, borderRadius: 12, padding: "14px 14px 12px", color: INF.tx, cursor: onVer ? "pointer" : "default", display: "flex", flexDirection: "column", minHeight: 170 }}>
            {p.recomendado && <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: INF.teja, color: INF.sobreColor, fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "1px 10px", whiteSpace: "nowrap" }}>Recomendado</span>}
            <div style={{ fontSize: 11, color: INF.tx2, textTransform: "uppercase", letterSpacing: 0.6 }}>{p.esHoy ? "Punto de partida" : `Camino ${letra}`}</div>
            <div style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 4px" }}>{p.nombre}</div>
            <div style={{ fontSize: 12, color: INF.tx2, lineHeight: 1.45, flex: 1 }}>{p.esHoy ? "Si nada cambia" : p.descripcion || resumenEscenario(p.r)}</div>
            <div style={{ fontSize: 24, fontFamily: "Georgia, 'Times New Roman', serif", marginTop: 10 }}>{fmM(p.med.fin.patrimonio)}</div>
            <div style={{ fontSize: 12, color: p.med.real != null && p.med.real >= 0 ? INF.ok : INF.bad }}>año 10 · {p.med.real == null ? "—" : `${p.med.real >= 0 ? "+" : ""}${fmPct(p.med.real, 1)} real`}</div>
            {!p.esHoy && p.id && onRecomendar && <button onClick={(e) => { e.stopPropagation(); onRecomendar(p.id); }} style={{ marginTop: 8, alignSelf: "flex-start", background: "none", border: `1px solid ${INF.linea}`, borderRadius: 999, color: p.recomendado ? INF.teja : INF.tx2, fontSize: 11, padding: "2px 8px", cursor: "pointer" }}>{p.recomendado ? "★ Recomendado" : "☆ Marcar como recomendado"}</button>}
            {/* 24-oct-2026 (Santiago: "cada tarjeta debería tener su borrar, editar"). */}
            {!p.esHoy && (p.id ? (onEditar || onBorrar) : (onGuardarBorrador || onDescartarBorrador)) && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {(p.id ? [["Editar", onEditar], ["Borrar", onBorrar]] : [["Guardar", onGuardarBorrador], ["Descartar", onDescartarBorrador]]).filter(([, fn]) => fn).map(([t, fn]) => (
                <button key={t} onClick={(e) => { e.stopPropagation(); if (t === "Borrar" && typeof window !== "undefined" && window.confirm && !window.confirm(`¿Borrar «${p.nombre}»?`)) return; fn(p.id); }}
                  style={{ background: "none", border: `1px solid ${t === "Borrar" || t === "Descartar" ? INF.teja : INF.linea}`, borderRadius: 999, color: t === "Borrar" || t === "Descartar" ? INF.teja : INF.tx, fontSize: 12, padding: "4px 12px", cursor: "pointer" }}>{t}</button>))}
            </div>}
          </div>;
        })}
      </div>

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
              label={(q) => (q.index === curvas.length - 1 ? <text x={q.x + 6} y={q.y + 4 + (desp[p.k] || 0)} fill={p.color} fontSize={11}>{`${p.nombre.length > 14 ? p.nombre.slice(0, 13) + "…" : p.nombre} ${fmM(q.value)}`}</text> : null)} />)}
          </LineChart>
        </ResponsiveContainer></div></div>
      </div>


      <Reparto m={m} />

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
