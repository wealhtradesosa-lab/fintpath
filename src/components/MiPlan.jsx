// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · MiPlan — el plan patrimonial a 10 años, paso a paso
//
// 21-oct-2026, Santiago: "esto debería ser un proceso guiado que lo lleva a
// uno paso a paso, considerando lo que se tiene, lo que se va a transformar o
// vender para reinvertir, lo que viene por ingresos adicionales —la bodega
// empieza en 2 años, la pensión en 4— y todo esto entonces le muestra a uno y
// le modela el escenario; además los puede uno revisar cada uno y compararlos."
//
//   1 · HOY            qué tienes y qué produce cada peso
//   2 · LO QUE VIENE   lo seguro, en todos los escenarios: pensión, obra, contrato
//   3 · TU ESCENARIO   qué vendes, qué pagas, a dónde va la plata y con qué regla
//   4 · EL RESULTADO   el escenario modelado y contado, año a año
//   5 · COMPARA        todos lado a lado, estrés y $100 M en cada inversión
//
// Seguridad, Balance y Crecimiento son plantillas: llenan el paso 3 con un
// despliegue concreto que se puede editar. El motor es lib/planes.js; la
// traducción de datos y plantillas es lib/caminos.js. Se guarda en
// user.caminos (escenarios), perfilPlan (supuestos y lo que viene),
// fichasPlan (canasta por activo) y caminoElegido.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState, useEffect } from "react";
import PageHeader from "./PageHeader";
import { C, F } from "../lib/designTokens";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import { baseDesdeUsuario, CAMINOS_BASE, compararCaminos, medirCanastas, canastaDe, CANASTA_LABEL, CONDICION_LABEL, PERFIL_DEFAULT, escenarioDesdeCamino, escenarioVacio, liquidezEscenario, narrar, cienEnCada } from "../lib/caminos.js";

const fmM = (n) => { const v = Number(n) || 0; const a = Math.abs(v); if (a >= 1e9) return (v < 0 ? "−" : "") + "$" + (a / 1e9).toFixed(1).replace(".0", "").replace(".", ",") + " mil M"; return (v < 0 ? "−" : "") + "$" + Math.round(a / 1e6).toLocaleString("es-CO") + " M"; };
const fmMes = (n) => { const v = Number(n) || 0; const a = Math.abs(v); return (v < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(1).replace(".0", "").replace(".", ",") + " M" : Math.round(a / 1e3) + " K"); };
const pct = (n) => `${Math.round(Number(n) || 0)}%`;
const CANASTA_COLOR = { proteccion: C.accent, rentas: C.ok, crecimiento: C.warn, uso: C.subtle };
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, minWidth: 0 };
const sub = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, minWidth: 0 };
const inputS = { background: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };
const btn = (primary) => ({ background: primary ? C.accent : "transparent", color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.accent : C.borderStrong}`, borderRadius: 999, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
const chip = (color) => ({ display: "inline-block", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: `${color}20`, border: `1px solid ${color}40`, whiteSpace: "nowrap" });
const th = { ...F.label, textAlign: "left", padding: "8px 6px", whiteSpace: "nowrap" };
const td = { padding: "7px 6px", color: C.text, fontSize: 12, verticalAlign: "middle" };
const tdNum = { ...td, textAlign: "right", fontFamily: F.mono.fontFamily, whiteSpace: "nowrap" };
const Num = ({ value, onChange, step = 1, min, max, suffix, w }) => (
  <div style={{ position: "relative", width: w }}>
    <input type="number" step={step} min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} style={{ ...inputS, paddingRight: suffix ? 26 : 10 }} />
    {suffix && <span style={{ position: "absolute", right: 8, top: 9, fontSize: 11, color: C.subtle }}>{suffix}</span>}
  </div>
);
// Pesos completos con separador de miles (22.000.000). Guarda el número; muestra el formato.
const NumPesos = ({ value, onChange, w, placeholder }) => {
  const txt = value == null || value === "" ? "" : Math.round(Number(value)).toLocaleString("es-CO");
  return <input type="text" inputMode="numeric" value={txt} placeholder={placeholder || "0"} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); onChange(d === "" ? "" : Number(d)); }} style={{ ...inputS, width: w || "100%", textAlign: "right", fontFamily: F.mono.fontFamily, fontWeight: 500 }} />;
};
const Campo = ({ l, children, style }) => (<label style={{ display: "block", ...style }}><div style={{ ...F.label, marginBottom: 4 }}>{l}</div>{children}</label>);
const useAncho = () => { const [w, setW] = useState(typeof window === "undefined" ? 1200 : window.innerWidth); useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return w; };
const anioDe = (mes) => Math.floor((Number(mes) || 0) / 12) + 1;

// Producción mensual de una posición hoy: lo que recibes y lo que crece
const produce = (p) => {
  const recibe = p.capital * (Number(p.tasa) || 0) / 100 / 12 * ((p.pagaPct ?? 0) / 100) + (p.renta || 0);
  const crece = p.capital * (Math.pow(1 + (Number(p.tasa) || 0) / 100, 1 / 12) - 1) * (1 - (p.pagaPct ?? 0) / 100) + p.capital * (Math.pow(1 + (Number(p.valorizacion) || 0) / 100, 1 / 12) - 1);
  return { recibe, crece };
};
const notaDe = (p) => p.vivienda ? "Tu vivienda: protege, no produce" : p.renta > 0 ? `Renta ${fmMes(p.renta)} al mes${p.valorizacion ? ` · valoriza ${p.valorizacion}%` : ""}` : p.bolsillo === "crecimiento" ? `Reinvierte al ${p.tasa}%` : p.tasa > 0 ? `Paga el ${p.pagaPct}% de ${p.tasa}% cada mes` : p.vehiculo ? "Pierde valor" : p.valorizacion > 0 ? `Solo valoriza ${p.valorizacion}%` : "Quieto";

// ─── Barra de canastas ───────────────────────────────────────────────────────
function BarraCanastas({ c, alto = 14 }) {
  const total = c.total || 1;
  return <div style={{ display: "flex", height: alto, borderRadius: 999, overflow: "hidden", background: C.raised }}>{["proteccion", "rentas", "crecimiento", "uso"].map((k) => c[k] > 0 && <div key={k} title={`${CANASTA_LABEL[k]} ${fmM(c[k])}`} style={{ width: `${(c[k] / total) * 100}%`, background: CANASTA_COLOR[k] }} />)}</div>;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
const PASOS = [["Hoy", "Qué tienes"], ["Lo que viene", "Lo seguro"], ["Tu escenario", "Qué mueves"], ["El resultado", "Modelado"], ["Compara", "Lado a lado"]];
function Stepper({ paso, setPaso }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
      {PASOS.map(([t, s], i) => { const n = i + 1, on = paso === n, done = paso > n; return (
        <button key={t} onClick={() => setPaso(n)} style={{ background: on ? C.accent : C.surface, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 12, padding: "10px 8px", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
          <div style={{ ...F.label, color: on ? "#fff" : done ? C.ok : C.subtle }}>{done ? "✓" : n} · {s}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#fff" : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
        </button>); })}
    </div>
  );
}
const Siguiente = ({ onClick, children }) => <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={btn(true)} onClick={onClick}>{children} →</button></div>;

// ─── Paso 1 · Hoy ────────────────────────────────────────────────────────────
function PasoHoy({ base, fichas, onFichas, onNext }) {
  const c = base.canastasHoy, b = base.base, hoy = base.hoy || {};
  const entra = (b?.ia || 0) + (b?.ip || 0), sale = base.gastosMes, queda = entra - sale, cob = sale > 0 ? (entra / sale) * 100 : 0;
  const meses = sale > 0 ? c.colchon / sale : 0;
  const setF = (id, patch) => onFichas({ ...fichas, [id]: { ...(fichas[id] || {}), ...patch } });
  const tiles = [["Entra al mes", fmMes(entra), "trabajo + rentas"], ["Sale al mes", fmMes(sale), "gastos + cuotas"], ["Queda", fmMes(queda), queda >= 0 ? "excedente" : "déficit"], ["Cobertura", pct(cob), "entra ÷ sale"], ["Patrimonio neto", fmM(b?.patrimonioNeto ?? c.total), `${fmM(c.total)} bruto`], ["Colchón", `${Math.round(meses)} meses`, "líquido ÷ gastos"]];
  const vivos = base.posiciones.filter((p) => !p.sale);
  const tot = vivos.reduce((s, p) => { const x = produce(p); return { recibe: s.recibe + x.recibe, crece: s.crece + x.crece }; }, { recibe: 0, crece: 0 });
  const salen = base.posiciones.filter((p) => p.sale);
  const inp = { ...inputS, padding: "4px 6px", fontSize: 12, width: 64, textAlign: "right" };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>1 · Hoy: qué tienes, qué produce y qué sigue en el plan</div>
        <div style={{ ...F.body, marginTop: 4 }}>Este es tu punto de partida. Para cada activo decide dos cosas: en qué <b style={{ color: C.text }}>canasta</b> está, y si <b style={{ color: C.text }}>continúa</b> en el futuro o <b style={{ color: C.text }}>sale del plan</b> (se vende hoy). Lo que sale libera plata que vas a desplegar en cada escenario; las deudas que marques se pagan con eso. Lo que decidas aquí vale para todos los escenarios.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 14 }}>
          {tiles.map(([l, v, d]) => <div key={l} style={sub}><div style={F.label}>{l}</div><div style={{ ...F.monoLg, color: C.text, marginTop: 2 }}>{v}</div><div style={F.caption}>{d}</div></div>)}
        </div>
        <div style={{ marginTop: 14 }}><BarraCanastas c={c} alto={16} /></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>{["proteccion", "rentas", "crecimiento", "uso"].map((k) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption }}><span style={{ width: 8, height: 8, borderRadius: 999, background: CANASTA_COLOR[k] }} /><b style={{ color: C.text }}>{CANASTA_LABEL[k]}</b> {fmM(c[k])}</div>)}</div>
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><div style={F.h3}>Producción por activo</div><div style={F.caption}>Rinde = % anual sobre el capital · Recibes = qué parte del rendimiento te llega cada mes (el resto se reinvierte) · Valoriza = % anual del valor</div></div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr><th style={th}>Activo</th><th style={{ ...th, textAlign: "right" }}>Capital</th><th style={{ ...th, textAlign: "right" }}>Recibes / mes</th><th style={{ ...th, textAlign: "right" }}>Crece / mes</th><th style={th}>Canasta</th><th style={{ ...th, textAlign: "right" }}>Rinde</th><th style={{ ...th, textAlign: "right" }}>Recibes</th><th style={{ ...th, textAlign: "right" }}>Valoriza</th><th style={th}>En el plan</th></tr></thead>
            <tbody>
              {[...base.posiciones].sort((a, b2) => b2.capital - a.capital).map((p) => { const x = produce(p); const k = canastaDe(p); const off = p.sale; return (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}`, opacity: off ? 0.55 : 1 }}>
                  <td style={td}>{p.nombre}<div style={F.caption}>{p.tipo} · {notaDe(p)}</div></td>
                  <td style={tdNum}>{fmM(p.capital)}</td>
                  <td style={{ ...tdNum, color: x.recibe > 0 ? C.ok : C.subtle }}>{x.recibe > 0 ? fmMes(x.recibe) : "—"}</td>
                  <td style={{ ...tdNum, color: x.crece > 0 ? C.warn : x.crece < 0 ? C.danger : C.subtle }}>{x.crece !== 0 ? fmMes(x.crece) : "—"}</td>
                  <td style={td}><select value={k} onChange={(e) => setF(p.id, { canasta: e.target.value })} style={{ ...inputS, padding: "4px 6px", fontSize: 11, width: 112, color: CANASTA_COLOR[k] }}>{["proteccion", "rentas", "crecimiento", "uso"].map((o) => <option key={o} value={o}>{CANASTA_LABEL[o]}</option>)}</select></td>
                  <td style={tdNum}><input type="number" step={0.5} value={p.tasa} onChange={(e) => setF(p.id, { tasa: Number(e.target.value) })} style={inp} />%</td>
                  <td style={tdNum}><input type="number" step={10} min={0} max={100} value={p.pagaPct} onChange={(e) => setF(p.id, { pagaPct: Number(e.target.value) })} style={inp} />%</td>
                  <td style={tdNum}><input type="number" step={0.5} value={p.valorizacion} onChange={(e) => setF(p.id, { valorizacion: Number(e.target.value) })} style={inp} />%</td>
                  <td style={td}><button onClick={() => setF(p.id, { estado: off ? "continua" : "sale" })} style={{ ...btn(false), padding: "4px 10px", color: off ? C.danger : C.ok, borderColor: off ? C.danger : C.ok, whiteSpace: "nowrap" }}>{off ? "Sale del plan" : "Continúa"}</button></td>
                </tr>); })}
              <tr style={{ borderTop: `2px solid ${C.borderStrong}` }}><td style={{ ...td, fontWeight: 700 }}>Lo que continúa</td><td style={{ ...tdNum, fontWeight: 700 }}>{fmM(vivos.reduce((s2, p) => s2 + p.capital, 0))}</td><td style={{ ...tdNum, fontWeight: 700, color: C.ok }}>{fmMes(tot.recibe)}</td><td style={{ ...tdNum, fontWeight: 700, color: C.warn }}>{fmMes(tot.crece)}</td><td colSpan={5} style={{ ...td, color: C.muted }}>Produce {fmMes(tot.recibe + tot.crece)} al mes en total</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 14 }}>
        {base.deudas.length > 0 && <div style={card}>
          <div style={F.h3}>Deudas</div>
          <div style={{ ...F.caption, marginBottom: 8 }}>Marca las que se pagan hoy con lo que sale del plan.</div>
          <div style={{ display: "grid", gap: 6 }}>{base.deudas.map((d) => <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderTop: `1px solid ${C.border}`, paddingTop: 6, flexWrap: "wrap" }}><input type="checkbox" checked={!!d.pagar} onChange={(e) => setF(`deu_${d.id}`, { pagar: e.target.checked })} /><span style={{ ...F.caption, color: C.text }}>{d.nombre}</span><span style={F.caption}>{fmM(d.saldo)} · {d.tasa}% · cuota {fmMes(d.cuota)}</span>{d.tasa >= 18 && <span style={chip(C.danger)}>cara</span>}{d.pagar && <span style={chip(C.ok)}>se paga hoy</span>}</label>)}</div>
        </div>}
        <div style={{ ...card, borderColor: salen.length ? C.accent : C.border }}>
          <div style={F.h3}>Lo decidido hoy, para todos los escenarios</div>
          {salen.length === 0 && !base.deudas.some((d) => d.pagar) ? <div style={{ ...F.body, marginTop: 6 }}>Todo continúa tal como está. Si algo va a salir del plan (un inmueble que vendes, un lote), márcalo arriba como <b style={{ color: C.text }}>Sale del plan</b>.</div> : (
            <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
              {salen.length > 0 && <div style={F.body}>Sale: <b style={{ color: C.text }}>{salen.map((p) => p.nombre).join(", ")}</b> → liberas <b style={{ color: C.text }}>{fmM(hoy.liberado)}</b>{hoy.costoVentaPct > 0 ? ` (neto de ${hoy.costoVentaPct}% de costos de venta)` : ""}.</div>}
              {hoy.pagado > 0 && <div style={F.body}>Se paga: <b style={{ color: C.text }}>{base.deudas.filter((d) => d.pagar).map((d) => d.nombre).join(", ")}</b> → <b style={{ color: C.text }}>{fmM(hoy.pagado)}</b>, y dejas de pagar {fmMes(hoy.cuotasQueSalen)} de cuotas al mes.</div>}
              <div style={{ ...F.body, color: hoy.porDesplegar >= 0 ? C.ok : C.danger }}>Quedan <b>{fmM(hoy.porDesplegar)}</b> por desplegar en cada escenario (paso 3).</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, ...F.caption }}>Costos de venta (comisión, impuestos)<input type="number" step={0.5} min={0} max={30} value={fichas.__costoVentaPct ?? 0} onChange={(e) => onFichas({ ...fichas, __costoVentaPct: Number(e.target.value) })} style={inp} />% de lo vendido</div>
        </div>
      </div>
      <Siguiente onClick={onNext}>Siguiente: lo que ya viene</Siguiente>
    </div>
  );
}

// ─── Editor de un movimiento (evento) ────────────────────────────────────────
const TIPOS_MOV = [
  { v: "flujo_inicia_ingreso", l: "Entra un ingreso nuevo (pensión, renta, contrato)" }, { v: "flujo_inicia_gasto", l: "Entra un gasto nuevo (colegio, arriendo)" }, { v: "flujo_termina", l: "Termina un ingreso o gasto" }, { v: "flujo_cambia", l: "Cambia el monto de un ingreso o gasto" },
  { v: "comprar", l: "Compras un activo (casa, bodega, lote)" }, { v: "vender", l: "Vendes un activo" }, { v: "aportar", l: "Mueves capital a una inversión" }, { v: "revaluar", l: "Un activo cambia de valor (obra terminada, avalúo)" },
];
function describirMov(m, posiciones, flujos) {
  const p = posiciones.find((x) => x.id === m.posicionId)?.nombre || m.posicionId;
  const a = `Año ${anioDe(m.mes)}${m.mes % 12 ? `, mes ${(m.mes % 12) + 1}` : ""}`;
  switch (m.tipo) {
    case "vender": return `${a}: vendes ${p}`;
    case "comprar": return `${a}: compras ${m.nombre} por ${fmM(m.costo)}${m.renta ? `, renta ${fmMes(m.renta)}/mes${m.rentaDesde ? ` desde ${m.rentaDesde} meses después` : ""}` : ""}`;
    case "aportar": return `${a}: mueves ${fmM(m.monto)} a ${p}`;
    case "revaluar": return `${a}: ${p} pasa a valer ${fmM(m.valor)}`;
    case "flujo_inicia": return `${a}: ${m.flujo?.tipo === "gasto" ? "entra el gasto" : "entra"} ${m.flujo?.nombre}, ${fmMes(m.flujo?.monto)}/mes`;
    case "flujo_termina": return `${a}: termina ${flujos.find((f) => f.id === m.flujoId)?.nombre || m.flujoId}`;
    case "flujo_cambia": return `${a}: ${flujos.find((f) => f.id === m.flujoId)?.nombre || m.flujoId} pasa a ${fmMes(m.monto)}/mes`;
    default: return `${a}: ${m.tipo}`;
  }
}
function EditorMovimiento({ posiciones, flujos, onAgregar, onCerrar, ejemplo }) {
  const [f, setF] = useState({ tipo: "flujo_inicia_ingreso", anio: 2, mes: 1, posicionId: posiciones[0]?.id || "", nombre: "", monto: "", canasta: "rentas", renta: "", rentaDesde: 0, flujoId: flujos[0]?.id || "", origenId: posiciones[0]?.id || "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const mes = (Math.max(1, Number(f.anio) || 1) - 1) * 12 + Math.min(11, Math.max(0, (Number(f.mes) || 1) - 1));
  const guardar = () => {
    const base = { id: "mv_" + Math.random().toString(36).slice(2, 8), mes };
    const monto = Number(f.monto) || 0; let m = null;
    if (f.tipo === "vender") m = { ...base, tipo: "vender", posicionId: f.posicionId };
    if (f.tipo === "comprar" && f.nombre && monto > 0) m = { ...base, tipo: "comprar", nombre: f.nombre, costo: monto, bolsillo: f.canasta === "crecimiento" ? "crecimiento" : f.canasta === "rentas" ? "sustento" : "uso", pagaPct: f.canasta === "rentas" ? 100 : 0, valorizacion: f.canasta === "crecimiento" ? 0 : 5, origen: [{ posicionId: f.origenId }], renta: Number(f.renta) > 0 ? Number(f.renta) : undefined, rentaDesde: Number(f.rentaDesde) || 0 };
    if (f.tipo === "aportar" && monto > 0) m = { ...base, tipo: "aportar", posicionId: f.posicionId, monto, origen: [{ posicionId: f.origenId }] };
    if (f.tipo === "revaluar" && monto > 0) m = { ...base, tipo: "revaluar", posicionId: f.posicionId, valor: monto };
    if ((f.tipo === "flujo_inicia_ingreso" || f.tipo === "flujo_inicia_gasto") && f.nombre && monto > 0) m = { ...base, tipo: "flujo_inicia", flujo: { id: base.id + "_f", nombre: f.nombre, tipo: f.tipo.endsWith("gasto") ? "gasto" : "ingreso", monto, indexa: true } };
    if (f.tipo === "flujo_termina") m = { ...base, tipo: "flujo_termina", flujoId: f.flujoId };
    if (f.tipo === "flujo_cambia" && monto >= 0) m = { ...base, tipo: "flujo_cambia", flujoId: f.flujoId, monto };
    if (m) { onAgregar(m); onCerrar(); }
  };
  const selPos = (k) => <select value={f[k]} onChange={(e) => set(k, e.target.value)} style={inputS}>{posiciones.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {fmM(p.capital)}</option>)}</select>;
  const esFlujo = f.tipo.startsWith("flujo_inicia") || f.tipo === "flujo_cambia";
  return (
    <div style={{ ...sub, display: "grid", gap: 10 }}>
      {ejemplo && <div style={F.caption}>{ejemplo}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}>
        <Campo l="Qué pasa" style={{ gridColumn: "1 / -1" }}><select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputS}>{TIPOS_MOV.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></Campo>
        <Campo l="En el año"><Num value={f.anio} min={1} max={10} onChange={(v) => set("anio", v)} /></Campo>
        <Campo l="Mes del año"><Num value={f.mes} min={1} max={12} onChange={(v) => set("mes", v)} /></Campo>
        {(f.tipo === "vender" || f.tipo === "aportar" || f.tipo === "revaluar") && <Campo l={f.tipo === "aportar" ? "Destino" : "Activo"}>{selPos("posicionId")}</Campo>}
        {(f.tipo === "comprar" || f.tipo.startsWith("flujo_inicia")) && <Campo l="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} style={inputS} placeholder={f.tipo === "comprar" ? "Bodega, finca, apartamento…" : "Pensión, arriendo bodega, colegio…"} /></Campo>}
        {(f.tipo === "flujo_termina" || f.tipo === "flujo_cambia") && <Campo l="Cuál"><select value={f.flujoId} onChange={(e) => set("flujoId", e.target.value)} style={inputS}>{flujos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {fmMes(x.monto)}</option>)}</select></Campo>}
        {f.tipo !== "vender" && f.tipo !== "flujo_termina" && <Campo l={esFlujo ? "Monto al mes (pesos)" : f.tipo === "revaluar" ? "Nuevo valor (pesos)" : "Monto (pesos)"}><NumPesos value={f.monto} onChange={(v) => set("monto", v)} /></Campo>}
        {f.tipo === "comprar" && <Campo l="Para qué"><select value={f.canasta} onChange={(e) => set("canasta", e.target.value)} style={inputS}><option value="rentas">Rentar (paga cada mes)</option><option value="proteccion">Vivir ahí</option><option value="crecimiento">Crecimiento</option><option value="uso">Uso</option></select></Campo>}
        {f.tipo === "comprar" && f.canasta === "rentas" && <><Campo l="Renta al mes (pesos)"><NumPesos value={f.renta} onChange={(v) => set("renta", v)} /></Campo><Campo l="Renta desde (meses después)"><Num value={f.rentaDesde} min={0} onChange={(v) => set("rentaDesde", v)} /></Campo></>}
        {(f.tipo === "comprar" || f.tipo === "aportar") && <Campo l="Con plata de">{selPos("origenId")}</Campo>}
      </div>
      <div style={{ display: "flex", gap: 8 }}><button style={btn(true)} onClick={guardar}>Agregar</button><button style={btn(false)} onClick={onCerrar}>Cancelar</button></div>
    </div>
  );
}
function ListaEventos({ eventos, posiciones, flujos, onChange, ejemplo, vacio }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      {eventos.length === 0 && !abierto && <div style={{ ...F.body, fontStyle: "italic" }}>{vacio}</div>}
      {eventos.length > 0 && <div style={{ display: "grid", gap: 6 }}>{[...eventos].sort((a, b) => a.mes - b.mes).map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, ...F.body, color: C.text }}><span>· {describirMov(m, posiciones, flujos)}{m.plantilla && <span style={{ ...chip(C.subtle), marginLeft: 6 }}>plantilla</span>}</span><button style={{ ...btn(false), padding: "3px 10px", color: C.subtle }} onClick={() => onChange(eventos.filter((x) => x.id !== m.id))}>quitar</button></div>)}</div>}
      {abierto ? <div style={{ marginTop: 10 }}><EditorMovimiento posiciones={posiciones} flujos={flujos} ejemplo={ejemplo} onAgregar={(m) => onChange([...eventos, m])} onCerrar={() => setAbierto(false)} /></div> : <div style={{ marginTop: 10 }}><button style={btn(false)} onClick={() => setAbierto(true)}>+ Agregar</button></div>}
    </div>
  );
}

// ─── Paso 2 · Lo que viene ───────────────────────────────────────────────────
// Una fila por ingreso o gasto de hoy: sigue igual · termina en… · cambia a… desde…
function FilaFlujo({ f, eventos, onChange }) {
  const ev = eventos.find((e) => e.flujoId === f.id && (e.tipo === "flujo_termina" || e.tipo === "flujo_cambia"));
  const estado = ev ? ev.tipo : "sigue";
  const anio = ev ? anioDe(ev.mes) : 2, mesDelAnio = ev ? (ev.mes % 12) + 1 : 1;
  const setEv = (patch) => {
    const otros = eventos.filter((e) => e !== ev);
    if (patch.estado === "sigue") return onChange(otros);
    const tipo = patch.estado || estado;
    const a = patch.anio ?? anio, m = patch.mes ?? mesDelAnio;
    const mes = (Math.max(1, Number(a) || 1) - 1) * 12 + Math.min(11, Math.max(0, (Number(m) || 1) - 1));
    const nuevo = { id: ev?.id || "fx_" + Math.random().toString(36).slice(2, 8), mes, tipo: tipo === "sigue" ? "flujo_termina" : tipo, flujoId: f.id, monto: tipo === "flujo_cambia" ? (patch.monto ?? ev?.monto ?? f.monto) : undefined };
    onChange([...otros, nuevo]);
  };
  const esIng = f.tipo === "ingreso";
  const selS = { ...inputS, padding: "4px 6px", fontSize: 11, width: 130, color: estado === "sigue" ? C.ok : estado === "flujo_termina" ? C.danger : C.warn };
  const inp = { ...inputS, padding: "4px 6px", fontSize: 12, width: 56, textAlign: "right" };
  return (
    <tr style={{ borderTop: `1px solid ${C.border}`, opacity: estado === "flujo_termina" ? 0.75 : 1 }}>
      <td style={td}>{f.nombre}<div style={F.caption}>{esIng ? (f.trabajo ? "ingreso de trabajo" : f.posicionId ? "renta de un activo" : "ingreso") : "gasto"}</div></td>
      <td style={{ ...tdNum, color: esIng ? C.ok : C.danger }}>{fmMes(f.monto)}</td>
      <td style={td}><select value={estado} onChange={(e) => setEv({ estado: e.target.value })} style={selS}><option value="sigue">Sigue igual</option><option value="flujo_termina">Termina en…</option><option value="flujo_cambia">Cambia a…</option></select></td>
      <td style={td}>{estado !== "sigue" && <div style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption, flexWrap: "wrap" }}>
        {estado === "flujo_cambia" && <><NumPesos value={ev?.monto ?? f.monto} onChange={(v) => setEv({ monto: v || 0 })} w={140} /><span>al mes, desde</span></>}
        <span>año</span><input type="number" min={1} max={10} value={anio} onChange={(e) => setEv({ anio: Number(e.target.value) })} style={inp} /><span>mes</span><input type="number" min={1} max={12} value={mesDelAnio} onChange={(e) => setEv({ mes: Number(e.target.value) })} style={inp} />
      </div>}</td>
    </tr>
  );
}

function PasoViene({ base, perfil, onPerfil, onNext }) {
  const set = (k, v) => onPerfil({ ...perfil, [k]: v });
  const pens = perfil.pensiones || [];
  const setPens = (lista) => set("pensiones", lista);
  const eventos = perfil.eventos || [];
  const [supuestos, setSupuestos] = useState(false);
  const ingresos = base.flujos.filter((f) => f.tipo === "ingreso").sort((a, b) => b.monto - a.monto);
  const gastos = base.flujos.filter((f) => f.tipo === "gasto").sort((a, b) => b.monto - a.monto);
  const nuevos = eventos.filter((e) => e.tipo !== "flujo_termina" && e.tipo !== "flujo_cambia");
  const setNuevos = (lista) => set("eventos", [...eventos.filter((e) => e.tipo === "flujo_termina" || e.tipo === "flujo_cambia"), ...lista]);
  const setCambios = (lista) => set("eventos", [...nuevos, ...lista]);
  const cambios = eventos.filter((e) => e.tipo === "flujo_termina" || e.tipo === "flujo_cambia");
  const deudasVivas = base.deudas.filter((d) => !d.pagar);
  const mesesDeuda = (d) => { const i = d.tasa / 100 / 12; if (d.cuota <= d.saldo * i) return null; return Math.ceil(Math.log(d.cuota / (d.cuota - d.saldo * i)) / Math.log(1 + i)); };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>2 · Lo que ya viene, pase lo que pase</div>
        <div style={{ ...F.body, marginTop: 4 }}>Aquí está listado lo que tienes hoy. Sobre cada cosa decide si <b style={{ color: C.text }}>sigue igual</b>, <b style={{ color: C.text }}>termina</b> (el contrato, el colegio) o <b style={{ color: C.text }}>cambia</b> de monto desde un año. Abajo agregas lo nuevo que llega seguro: la pensión en el año 4, la bodega que renta desde el año 2. Todo esto entra en todos los escenarios; lo opcional lo decides en cada uno.</div>
      </div>
      <div style={card}>
        <div style={F.h3}>Tus ingresos de hoy</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Ingreso</th><th style={{ ...th, textAlign: "right" }}>Hoy al mes</th><th style={th}>En el futuro</th><th style={th}>Cuándo / cuánto</th></tr></thead>
            <tbody>{ingresos.map((f) => <FilaFlujo key={f.id} f={f} eventos={cambios} onChange={setCambios} />)}
            {ingresos.length === 0 && <tr><td colSpan={4} style={{ ...td, color: C.subtle, fontStyle: "italic" }}>Sin ingresos cargados.</td></tr>}</tbody>
          </table>
        </div>
        <div style={{ ...F.caption, marginTop: 6 }}>Las rentas de los activos que salen del plan (paso 1) terminan solas al venderse.</div>
      </div>
      <div style={card}>
        <div style={F.h3}>Tus gastos de hoy</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Gasto</th><th style={{ ...th, textAlign: "right" }}>Hoy al mes</th><th style={th}>En el futuro</th><th style={th}>Cuándo / cuánto</th></tr></thead>
            <tbody>{gastos.map((f) => <FilaFlujo key={f.id} f={f} eventos={cambios} onChange={setCambios} />)}</tbody>
          </table>
        </div>
        {deudasVivas.length > 0 && <div style={{ marginTop: 12 }}>
          <div style={F.label}>Cuotas de deuda (terminan solas cuando se paga el saldo)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>{deudasVivas.map((d) => { const n = mesesDeuda(d); return <div key={d.id} style={{ ...sub, padding: "6px 10px", ...F.caption }}><b style={{ color: C.text }}>{d.nombre}</b> · {fmMes(d.cuota)}/mes · {n == null ? "la cuota no cubre el interés" : n > 120 ? "más de 10 años" : `termina en el año ${Math.ceil(n / 12)}`}</div>; })}</div>
        </div>}
      </div>
      <div style={card}>
        <div style={F.h3}>Lo nuevo que llega seguro</div>
        <div style={{ ...sub, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div><div style={F.h3}>Pensiones</div><div style={F.caption}>Cuándo llega cada una y de cuánto.</div></div><button style={btn(false)} onClick={() => setPens([...pens, { nombre: `Pensión ${pens.length + 1}`, mes: 48, monto: 3e6 }])}>+ Pensión</button></div>
          {pens.map((p, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginTop: 8, alignItems: "end" }}>
            <Campo l="De quién / cuál"><input value={p.nombre} onChange={(e) => setPens(pens.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} style={inputS} /></Campo>
            <Campo l="Desde el año"><Num value={anioDe(p.mes)} min={1} max={10} onChange={(v) => setPens(pens.map((x, k) => (k === i ? { ...x, mes: (Math.max(1, v || 1) - 1) * 12 } : x)))} /></Campo>
            <Campo l="Al mes (pesos)"><NumPesos value={p.monto} onChange={(v) => setPens(pens.map((x, k) => (k === i ? { ...x, monto: v || 0 } : x)))} /></Campo>
            <button style={{ ...btn(false), color: C.subtle }} onClick={() => setPens(pens.filter((_, k) => k !== i))}>quitar</button>
          </div>)}
          {pens.length === 0 && <div style={{ ...F.body, marginTop: 8, fontStyle: "italic" }}>Sin pensiones todavía.</div>}
        </div>
        <div style={{ ...sub, marginTop: 10 }}>
          <div style={F.h3}>Otros ingresos, gastos o compras ya decididas</div>
          <div style={{ ...F.caption, marginBottom: 8 }}>La bodega que empieza a rentar en el año 2, el gasto nuevo, la obra que se termina, la compra que ya está cerrada.</div>
          <ListaEventos eventos={nuevos} posiciones={base.posiciones} flujos={base.flujos} onChange={setNuevos} vacio="Nada nuevo todavía. Ejemplo: «Año 2: entra Arriendo bodega, $8.000.000/mes»." ejemplo="Ejemplo: la bodega empieza a rentar en el año 2 → «Entra un ingreso nuevo», año 2, Arriendo bodega, 8.000.000." />
        </div>
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div><div style={F.h3}>Supuestos</div><div style={F.caption}>Inflación {perfil.inflacion}% · crecimiento {perfil.tasaCrecimiento}% · renta estable {perfil.tasaRentaEstable}% · BTC {perfil.tasaBtc}% · inmuebles {perfil.valorizacionInmueble}% · cobertura mínima {perfil.coberturaMin}%</div></div><button style={btn(false)} onClick={() => setSupuestos((v) => !v)}>{supuestos ? "Cerrar" : "Cambiar"}</button></div>
        {supuestos && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          <Campo l="Inflación anual"><Num value={perfil.inflacion} step={0.5} onChange={(v) => set("inflacion", v)} suffix="%" /></Campo>
          <Campo l="Crecimiento (bolsa, ETF)"><Num value={perfil.tasaCrecimiento} step={0.5} onChange={(v) => set("tasaCrecimiento", v)} suffix="%" /></Campo>
          <Campo l="Renta estable (CDT)"><Num value={perfil.tasaRentaEstable} step={0.5} onChange={(v) => set("tasaRentaEstable", v)} suffix="%" /></Campo>
          <Campo l="Bitcoin"><Num value={perfil.tasaBtc} step={1} onChange={(v) => set("tasaBtc", v)} suffix="%" /></Campo>
          <Campo l="Valorización inmuebles"><Num value={perfil.valorizacionInmueble} step={0.5} onChange={(v) => set("valorizacionInmueble", v)} suffix="%" /></Campo>
          <Campo l="Valorización lotes"><Num value={perfil.valorizacionLote} step={0.5} onChange={(v) => set("valorizacionLote", v)} suffix="%" /></Campo>
          <Campo l="Arriendo si vives arrendado (% del valor al mes)"><Num value={perfil.arriendoPctMensual} step={0.1} onChange={(v) => set("arriendoPctMensual", v)} suffix="%" /></Campo>
          <Campo l="Cobertura mínima"><Num value={perfil.coberturaMin} step={5} onChange={(v) => set("coberturaMin", v)} suffix="%" /></Campo>
        </div>}
      </div>
      <Siguiente onClick={onNext}>Siguiente: construye tu escenario</Siguiente>
    </div>
  );
}

// ─── Paso 3 · Tu escenario ───────────────────────────────────────────────────
function ResultadoVivo({ r, base, onElegir, elegido, onVer, onComparar }) {
  const p = r.puntos, ok = r.vigilancia.cumple;
  const data = [{ a: 0, v: p.patrimonioInicial }, ...r.resultado.anual.map((x) => ({ a: x.anio, v: x.patrimonioFin }))];
  return (
    <div style={{ ...card, borderColor: r.color }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={F.h3}>Resultado en vivo</div><span style={chip(ok ? C.ok : C.danger)}>{ok ? "se cumple" : `se rompe · año ${r.vigilancia.roturas[0].anio}`}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div><div style={F.label}>Patrimonio año 10</div><div style={{ ...F.monoLg, color: C.text }}>{fmM(p.patrimonioFinal)}</div><div style={F.caption}>{fmM(p.patrimonioFinalReal)} de hoy</div></div>
        <div><div style={F.label}>Queda al mes · año 10</div><div style={{ ...F.monoLg, color: p.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(p.quedaMes)}</div><div style={F.caption}>cobertura {pct(p.cobertura)}</div></div>
        <div><div style={F.label}>Entra / sale · año 10</div><div style={{ ...F.caption, color: C.text }}>{fmMes(p.entraMes)} / {fmMes(p.saleMes)}</div></div>
        <div><div style={F.label}>Mes más apretado</div><div style={{ ...F.caption, color: p.seSostiene ? C.text : C.danger }}>{p.mesApretado ? `año ${anioDe(p.mesApretado.mes)} · ${pct(p.mesApretado.cobertura)}` : "—"}</div></div>
      </div>
      <div style={{ height: 110, marginTop: 10 }}>
        <ResponsiveContainer><LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}><XAxis dataKey="a" {...axisProps} tickFormatter={(a) => (a === 0 ? "hoy" : a)} /><YAxis hide domain={["auto", "auto"]} /><Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} labelFormatter={(a) => (a === 0 ? "Hoy" : `Año ${a}`)} />} /><Line type="monotone" dataKey="v" name="Patrimonio" stroke={r.color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 4 }}>{narrar(r, base).slice(1, 4).map((t, i) => <div key={i} style={{ ...F.caption, color: C.muted }}>{t}</div>)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button style={{ ...btn(false), flex: 1 }} onClick={onVer}>Ver completo →</button><button style={{ ...btn(false), flex: 1 }} onClick={onComparar}>Comparar →</button></div>
      {!elegido && <div style={{ marginTop: 8 }}><button style={{ ...btn(true), width: "100%" }} onClick={onElegir}>Elegir este camino</button></div>}
      {elegido && <div style={{ marginTop: 8, textAlign: "center" }}><span style={chip(C.accent)}>Tu camino</span></div>}
    </div>
  );
}
function PasoEscenario({ base, perfil, todos, res, activoId, setActivoId, onGuardar, onNuevo, onDuplicar, onRestablecer, onBorrar, caminoElegido, onElegir, onNext, onComparar }) {
  const ancho = useAncho();
  const esc = todos.find((e) => e.id === activoId) || todos[0];
  const r = res.find((x) => x.id === esc?.id);
  if (!esc || !r) return null;
  const upd = (patch) => onGuardar({ ...esc, ...patch });
  const liq = liquidezEscenario(base, esc);
  const ventaDe = (id) => (esc.ventas || []).find((v) => v.posicionId === id);
  const toggleVenta = (p) => { const v = ventaDe(p.id); upd({ ventas: v ? esc.ventas.filter((x) => x.posicionId !== p.id) : [...(esc.ventas || []), { posicionId: p.id, monto: null }] }); };
  const parcial = (p, monto) => upd({ ventas: esc.ventas.map((x) => (x.posicionId === p.id ? { ...x, monto: monto === "" || monto == null ? null : Math.min(monto, p.capital) } : x)) });
  const togglePago = (id) => upd({ pagos: (esc.pagos || []).includes(id) ? esc.pagos.filter((x) => x !== id) : [...(esc.pagos || []), id] });
  const setD = (id, patch) => upd({ despliegue: esc.despliegue.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const addD = (destinoId) => { const p = destinoId ? base.posiciones.find((x) => x.id === destinoId) : null; upd({ despliegue: [...(esc.despliegue || []), p ? { id: "d_" + Math.random().toString(36).slice(2, 8), destinoId: p.id, nombre: p.nombre, canasta: canastaDe(p), capital: Math.max(0, liq.porAsignar), tasa: p.tasa, pagaPct: p.pagaPct, valorizacion: p.valorizacion, regla: p.pagaPct === 100 ? "Paga el 100% del rendimiento cada mes" : "Todo se reinvierte" } : { id: "d_" + Math.random().toString(36).slice(2, 8), destinoId: null, nombre: "Nueva inversión", canasta: "rentas", capital: Math.max(0, liq.porAsignar), tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, regla: "Paga el 100% del rendimiento cada mes" }] }); };
  const crecPct = (esc.excedente || []).find((e) => e.canasta === "crecimiento")?.pct ?? 50;
  const destinosPosibles = base.posiciones.filter((p) => !p.vivienda && !p.vehiculo && !(ventaDe(p.id) && ventaDe(p.id).monto == null));
  const dos = ancho >= 980;
  const H = ({ n, t, d }) => <div style={{ marginBottom: 8 }}><div style={F.h3}><span style={{ color: esc.color }}>{n}</span> {t}</div>{d && <div style={F.caption}>{d}</div>}</div>;
  const Saldo = () => <div style={{ display: "flex", flexWrap: "wrap", gap: 12, ...F.caption, alignItems: "center" }}><span>Liberas <b style={{ color: C.text }}>{fmM(liq.liberado)}</b></span><span>− pagas <b style={{ color: C.text }}>{fmM(liq.pagado)}</b></span><span>− asignas <b style={{ color: C.text }}>{fmM(liq.asignado)}</b></span><span style={chip(Math.abs(liq.porAsignar) < 1e6 ? C.ok : liq.porAsignar > 0 ? C.warn : C.danger)}>{Math.abs(liq.porAsignar) < 1e6 ? "todo asignado" : liq.porAsignar > 0 ? `por asignar ${fmM(liq.porAsignar)}` : `falta ${fmM(-liq.porAsignar)}`}</span></div>;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>3 · Tu escenario: qué transformas y a dónde va la plata</div>
        <div style={{ ...F.body, marginTop: 4 }}>Parte de una plantilla o arma el tuyo. Un escenario es una decisión concreta: qué vendes, qué pagas, a dónde va cada peso y con qué regla, y qué haces después.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
          {todos.map((e) => { const rr = res.find((x) => x.id === e.id); return <button key={e.id} onClick={() => setActivoId(e.id)} style={{ ...btn(false), borderColor: e.id === esc.id ? e.color : C.borderStrong, background: e.id === esc.id ? `${e.color}20` : "transparent", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: e.color }} />{e.nombre}{caminoElegido === e.id && " ★"}{rr && !rr.vigilancia.cumple && <span style={{ color: C.danger }}>!</span>}</button>; })}
          <button style={btn(false)} onClick={onNuevo}>+ Nuevo desde cero</button>
          <button style={btn(false)} onClick={() => onDuplicar(esc)}>Duplicar este</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <span style={F.caption}>Estás editando <b style={{ color: esc.color }}>{esc.nombre}</b>. Cuando quieras:</span>
          <button style={btn(true)} onClick={onNext}>Ver este escenario modelado (paso 4) →</button>
          <button style={btn(false)} onClick={onComparar}>Comparar todos (paso 5) →</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: dos ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <H n="A" t="Nombre y tesis" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <Campo l="Nombre"><input value={esc.nombre} onChange={(e) => upd({ nombre: e.target.value })} style={inputS} /></Campo>
              <Campo l="Tesis (una frase)"><input value={esc.tesis || ""} onChange={(e) => upd({ tesis: e.target.value })} style={inputS} placeholder="Qué persigue este escenario" /></Campo>
            </div>
            {esc.plantilla && <div style={{ ...F.caption, marginTop: 8 }}>Plantilla {CAMINOS_BASE.find((c) => c.id === esc.plantilla)?.nombre}: {CAMINOS_BASE.find((c) => c.id === esc.plantilla)?.tesis} {esc.editado && <button style={{ ...btn(false), padding: "2px 8px", marginLeft: 6 }} onClick={() => onRestablecer(esc)}>Restablecer plantilla</button>}</div>}
          </div>
          <div style={card}>
            <H n="B" t="¿Qué vendes o transformas hoy?" d="Marca lo que sale. Puedes vender todo o solo una parte." />
            <div style={{ display: "grid", gap: 6 }}>
              {base.posiciones.filter((p) => p.sale).map((p) => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 6, opacity: 0.7 }}><input type="checkbox" checked disabled /><span style={{ ...F.caption, color: C.text }}>{p.nombre}</span><span style={F.caption}>{fmM(p.capital)}</span><span style={chip(C.accent)}>sale · decidido en Hoy</span></div>)}
              {base.posiciones.filter((p) => !p.sale).sort((a, b) => b.capital - a.capital).map((p) => { const v = ventaDe(p.id); return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 6, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, cursor: "pointer" }}><input type="checkbox" checked={!!v} onChange={() => toggleVenta(p)} /><span style={{ ...F.caption, color: C.text }}>{p.nombre}</span><span style={F.caption}>{fmM(p.capital)}{p.vivienda ? " · vivienda" : ""}{p.renta > 0 ? ` · renta ${fmMes(p.renta)}` : ""}</span></label>
                  {v && <div style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption }}><span>{v.monto == null ? "todo · o solo" : "solo"}</span><NumPesos value={v.monto == null ? "" : v.monto} onChange={(x) => parcial(p, x)} w={150} placeholder="una parte" /></div>}
                </div>); })}
            </div>
            <div style={{ marginTop: 10 }}><Saldo /></div>
          </div>
          {base.deudas.length > 0 && <div style={card}>
            <H n="C" t="¿Qué deudas pagas con eso?" d="Lo que pagues deja de costar cuota cada mes." />
            <div style={{ display: "grid", gap: 6 }}>{base.deudas.map((d) => <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: d.pagar ? "default" : "pointer", borderTop: `1px solid ${C.border}`, paddingTop: 6, opacity: d.pagar ? 0.7 : 1, flexWrap: "wrap" }}><input type="checkbox" checked={d.pagar || (esc.pagos || []).includes(d.id)} disabled={d.pagar} onChange={() => togglePago(d.id)} /><span style={{ ...F.caption, color: C.text }}>{d.nombre}</span><span style={F.caption}>{fmM(d.saldo)} · {d.tasa}% · cuota {fmMes(d.cuota)}</span>{d.tasa >= 18 && <span style={chip(C.danger)}>cara</span>}{d.pagar && <span style={chip(C.accent)}>se paga · decidido en Hoy</span>}</label>)}</div>
          </div>}
          <div style={card}>
            <H n="D" t="¿A dónde va la plata y con qué regla?" d="El despliegue: cada destino con su capital, su tasa y la regla con la que trabaja." />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead><tr><th style={th}>Destino</th><th style={th}>Canasta</th><th style={{ ...th, textAlign: "right" }}>Capital</th><th style={{ ...th, textAlign: "right" }}>Tasa</th><th style={{ ...th, textAlign: "right" }}>Recibes</th><th style={{ ...th, textAlign: "right" }}>Valoriza</th><th style={th}>Regla</th><th style={th} /></tr></thead>
                <tbody>
                  {(esc.despliegue || []).map((d) => <tr key={d.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, minWidth: 150 }}>{d.destinoId ? <span>{d.nombre}<div style={F.caption}>ya existe</div></span> : <input value={d.nombre} onChange={(e) => setD(d.id, { nombre: e.target.value })} style={{ ...inputS, padding: "4px 6px", fontSize: 12 }} />}</td>
                    <td style={td}>{d.destinoId ? <span style={chip(CANASTA_COLOR[d.canasta])}>{CANASTA_LABEL[d.canasta]}</span> : <select value={d.canasta} onChange={(e) => setD(d.id, { canasta: e.target.value, pagaPct: e.target.value === "rentas" ? 100 : 0, tasa: e.target.value === "crecimiento" ? perfil.tasaCrecimiento : e.target.value === "rentas" ? perfil.tasaRentaEstable : 0, regla: e.target.value === "rentas" ? "Paga el 100% del rendimiento cada mes" : e.target.value === "crecimiento" ? "Todo se reinvierte" : "" })} style={{ ...inputS, padding: "4px 6px", fontSize: 11, width: 112 }}>{["rentas", "crecimiento", "proteccion", "uso"].map((o) => <option key={o} value={o}>{CANASTA_LABEL[o]}</option>)}</select>}</td>
                    <td style={tdNum}><NumPesos value={d.capital} onChange={(v) => setD(d.id, { capital: v || 0 })} w={150} /></td>
                    <td style={tdNum}><Num value={d.tasa} step={0.5} onChange={(v) => setD(d.id, { tasa: v || 0 })} suffix="%" w={80} /></td>
                    <td style={tdNum}><Num value={d.pagaPct} step={10} min={0} max={100} onChange={(v) => setD(d.id, { pagaPct: v || 0, regla: v >= 100 ? "Paga el 100% del rendimiento cada mes" : v <= 0 ? "Todo se reinvierte" : `Recibe el ${v}%, reinvierte el resto` })} suffix="%" w={80} /></td>
                    <td style={tdNum}><Num value={d.valorizacion} step={0.5} onChange={(v) => setD(d.id, { valorizacion: v || 0 })} suffix="%" w={80} /></td>
                    <td style={{ ...td, minWidth: 180 }}><input value={d.regla || ""} onChange={(e) => setD(d.id, { regla: e.target.value })} style={{ ...inputS, padding: "4px 6px", fontSize: 11 }} placeholder="Regla" /></td>
                    <td style={td}><button style={{ ...btn(false), padding: "3px 8px", color: C.subtle }} onClick={() => upd({ despliegue: esc.despliegue.filter((x) => x.id !== d.id) })}>quitar</button></td>
                  </tr>)}
                  {(esc.despliegue || []).length === 0 && <tr><td colSpan={8} style={{ ...td, color: C.subtle, fontStyle: "italic" }}>Nada desplegado: lo liberado se quedaría en caja sin rendir.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
              <select value="" onChange={(e) => { if (e.target.value) addD(e.target.value === "__nueva" ? null : e.target.value); }} style={{ ...inputS, width: "auto", minWidth: 220 }}>
                <option value="">+ Agregar destino…</option>
                <option value="__nueva">Nueva inversión (la defines tú)</option>
                {destinosPosibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {CANASTA_LABEL[canastaDe(p)]} · {p.tasa > 0 ? `${p.tasa}%` : "sin tasa"}</option>)}
              </select>
              <Saldo />
            </div>
          </div>
          <div style={card}>
            <H n="E" t="¿Qué pasa después, en este escenario?" d="Lo que decides para los próximos años: compras, ventas, obras, gastos que entran. (Lo seguro ya está en el paso 2.)" />
            <ListaEventos eventos={esc.eventos || []} posiciones={[...base.posiciones, ...(esc.despliegue || []).filter((d) => !d.destinoId).map((d) => ({ id: d.id, nombre: d.nombre, capital: d.capital }))]} flujos={base.flujos} onChange={(l) => upd({ eventos: l })} vacio="Nada después todavía. Ejemplo: «Año 5: compras Casa finca por 900 M con plata del Fondo»." ejemplo="Ejemplo: en el año 5 compras una casa de 900 M con la plata del fondo." />
          </div>
          <div style={card}>
            <H n="F" t="Lo que sobra cada mes" d="A dónde va el excedente, y cuánto colchón líquido mantienes." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
              <div><div style={F.label}>{100 - crecPct}% a rentas · {crecPct}% a crecimiento</div><input type="range" min={0} max={100} step={5} value={crecPct} onChange={(e) => { const v = Number(e.target.value); upd({ excedente: [{ canasta: "rentas", pct: 100 - v }, { canasta: "crecimiento", pct: v }] }); }} style={{ width: "100%" }} /></div>
              <Campo l="Colchón líquido (meses de gastos)"><Num value={esc.colchonMeses} min={0} max={60} onChange={(v) => upd({ colchonMeses: v })} /></Campo>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ ...F.caption, cursor: "pointer" }}>Reglas que este escenario se obliga a cumplir (opcional)</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 10 }}>
                <Campo l="Rentas mín."><Num value={esc.canastas?.rentas?.min ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), rentas: { ...(esc.canastas?.rentas || {}), min: v === "" ? undefined : v } } })} suffix="%" /></Campo>
                <Campo l="Crecimiento mín."><Num value={esc.canastas?.crecimiento?.min ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), crecimiento: { ...(esc.canastas?.crecimiento || {}), min: v === "" ? undefined : v } } })} suffix="%" /></Campo>
                <Campo l="Crecimiento máx."><Num value={esc.canastas?.crecimiento?.max ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), crecimiento: { ...(esc.canastas?.crecimiento || {}), max: v === "" ? undefined : v } } })} suffix="%" /></Campo>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{Object.entries(CONDICION_LABEL).map(([id, l]) => <label key={id} style={{ ...F.caption, color: C.muted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={(esc.condiciones || []).includes(id)} onChange={() => { const s = new Set(esc.condiciones || []); s.has(id) ? s.delete(id) : s.add(id); upd({ condiciones: [...s] }); }} />{l}</label>)}</div>
            </details>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div>{esc.propio && <button style={{ ...btn(false), color: C.danger, borderColor: C.danger }} onClick={() => onBorrar(esc)}>Borrar escenario</button>}</div>
            <Siguiente onClick={onNext}>Ver el resultado completo</Siguiente>
          </div>
        </div>
        <div style={{ position: dos ? "sticky" : "static", top: 12 }}><ResultadoVivo r={r} base={base} elegido={caminoElegido === esc.id} onElegir={() => onElegir(esc.id)} onVer={onNext} onComparar={onComparar} /></div>
      </div>
    </div>
  );
}

// ─── Paso 4 · El resultado ───────────────────────────────────────────────────
function PasoResultado({ base, r, elegido, onElegir, onNext, onVolver }) {
  if (!r) return null;
  const p = r.puntos;
  const eventos = [...r.cfg.movimientos].filter((m) => m.mes > 0 || m.tipo === "flujo_inicia" || m.tipo === "comprar").sort((a, b) => a.mes - b.mes);
  const fmtCambio = (t) => t.replace(/(\d{6,})\/mes/g, (_, n) => fmMes(Number(n)) + "/mes").replace(/\b(\d{6,})\b/g, (_, n) => fmM(Number(n)));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...card, borderColor: r.color }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }} /><span style={F.h1}>{r.nombre}</span>{elegido && <span style={chip(C.accent)}>Tu camino</span>}<span style={chip(r.vigilancia.cumple ? C.ok : C.danger)}>{r.vigilancia.cumple ? "se cumple" : `se rompe · año ${r.vigilancia.roturas[0].anio}`}</span></div>
          <div style={{ display: "flex", gap: 8 }}><button style={btn(false)} onClick={onVolver}>← Editar</button>{!elegido && <button style={btn(true)} onClick={onElegir}>Elegir este camino</button>}</div>
        </div>
        {r.tesis && <div style={{ ...F.body, marginTop: 6, fontStyle: "italic" }}>{r.tesis}</div>}
        <div style={{ ...sub, marginTop: 12 }}><div style={F.h3}>4 · Así se cuenta este escenario</div>{narrar(r, base).map((t, i) => <div key={i} style={{ ...F.body, color: C.text, marginTop: 6 }}>{t}</div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 12 }}>
          {[["Patrimonio año 10", fmM(p.patrimonioFinal), `${fmM(p.patrimonioFinalReal)} de hoy`], ["Crece al año (real)", p.crecimientoRealAnual == null ? "—" : p.crecimientoRealAnual.toFixed(1).replace(".", ",") + "%", "descontando inflación"], ["Entra · año 10", fmMes(p.entraMes), "al mes"], ["Sale · año 10", fmMes(p.saleMes), "gastos + cuotas"], ["Cobertura · año 10", pct(p.cobertura), "entra ÷ sale"], ["Produce al mes", fmMes(p.produceMes), "recibido + reinvertido"], ["Mes más apretado", p.mesApretado ? `año ${anioDe(p.mesApretado.mes)}` : "—", p.mesApretado ? `cobertura ${pct(p.mesApretado.cobertura)}` : ""], ["Si crecimiento rinde menos", fmM(p.estres.patrimonioFinal), `al ${String(Math.round(p.estres.tasa * 10) / 10).replace(".", ",")}%`]].map(([l, v, d]) => <div key={l} style={sub}><div style={F.label}>{l}</div><div style={{ ...F.monoLg, color: C.text, marginTop: 2 }}>{v}</div><div style={F.caption}>{d}</div></div>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 14 }}>
        <div style={card}>
          <div style={F.h3}>El despliegue de hoy</div>
          {r.ajuste.notas.length ? r.ajuste.notas.map((n, i) => <div key={i} style={{ ...F.body, marginTop: 6 }}>· {n}</div>) : <div style={{ ...F.body, marginTop: 6 }}>Nada cambia hoy: el escenario parte tal como estás.</div>}
          <div style={{ marginTop: 12 }}><div style={F.caption}>Canastas hoy</div><BarraCanastas c={r.canastasHoy} /><div style={{ ...F.caption, marginTop: 8 }}>Canastas año 10</div><BarraCanastas c={r.canastasFin} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>{["proteccion", "rentas", "crecimiento"].map((k) => <div key={k}><div style={{ ...F.label, color: CANASTA_COLOR[k] }}>{CANASTA_LABEL[k]}</div><div style={{ ...F.caption, color: C.text }}>{fmM(r.canastasHoy[k])} → {fmM(r.canastasFin[k])}</div></div>)}</div>
        </div>
        <div style={card}>
          <div style={F.h3}>Lo que pasa en el tiempo</div>
          {eventos.length === 0 && <div style={{ ...F.body, marginTop: 6 }}>Nada programado después de hoy.</div>}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>{eventos.map((m, i) => <div key={i} style={{ display: "flex", gap: 10, ...F.body, color: C.text }}><span style={{ ...chip(r.color), minWidth: 56, textAlign: "center" }}>año {anioDe(m.mes)}</span><span>{describirMov(m, r.cfg.posiciones, r.cfg.flujos).replace(/^Año \d+(, mes \d+)?: /, "")}</span></div>)}</div>
          {!r.vigilancia.cumple && <div style={{ marginTop: 12 }}><div style={{ ...F.h3, color: C.danger }}>Dónde se rompe</div>{r.vigilancia.roturas.slice(0, 5).map((x, i) => <div key={i} style={{ ...F.body, color: C.danger, marginTop: 4 }}>· Año {x.anio}: {x.detalle}</div>)}</div>}
        </div>
      </div>
      <div style={card}>
        <div style={F.h3}>Año a año</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr>{["Año", "Entra/mes", "Sale/mes", "Queda/mes", "Cobertura", "Patrimonio", "Qué pasa"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 || i === 6 ? "left" : "right" }}>{h}</th>)}</tr></thead>
            <tbody>{r.resultado.anual.map((a) => <tr key={a.anio} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>{a.anio}</td><td style={tdNum}>{fmMes(a.entraMes)}</td><td style={tdNum}>{fmMes(a.saleMes)}</td><td style={{ ...tdNum, color: a.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(a.quedaMes)}</td><td style={tdNum}>{a.cobertura == null ? "—" : pct(a.cobertura)}</td><td style={tdNum}>{fmM(a.patrimonioFin)}</td><td style={{ ...td, color: C.muted, maxWidth: 360 }}>{a.cambios.slice(0, 3).map(fmtCambio).join(" · ")}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <Siguiente onClick={onNext}>Siguiente: compara todos los escenarios</Siguiente>
    </div>
  );
}

// ─── Paso 5 · Compara ────────────────────────────────────────────────────────
function PasoCompara({ res, base, perfil, activoId, onVer, caminoElegido, onElegir }) {
  const data = useMemo(() => { const H = Math.max(...res.map((r) => r.resultado.anual.length)); return Array.from({ length: H + 1 }, (_, a) => { const row = { anio: a }; res.forEach((r) => { row[r.id] = a === 0 ? r.puntos.patrimonioInicial : r.resultado.anual[a - 1]?.patrimonioFin; }); return row; }); }, [res]);
  const hoy = useMemo(() => { const entra = (base.base?.ia || 0) + (base.base?.ip || 0), sale = base.gastosMes; const crece = base.posiciones.reduce((s, p) => s + produce(p).crece, 0); return { entra, sale, queda: entra - sale, cobertura: sale > 0 ? (entra / sale) * 100 : 0, produce: entra + crece }; }, [base]);
  const fila = (l, f, hoyV) => [l, f, hoyV];
  const filas = [
    fila("Ingreso mensual (lo que recibes)", (r) => fmMes(r.puntos.entraMes), hoy && fmMes(hoy.entra)),
    fila("Egresos mensuales (gastos + cuotas)", (r) => fmMes(r.puntos.saleMes), hoy && fmMes(hoy.sale)),
    fila("Excedente mensual", (r) => fmMes(r.puntos.quedaMes), hoy && fmMes(hoy.queda)),
    fila("Cobertura", (r) => pct(r.puntos.cobertura), hoy && pct(hoy.cobertura)),
    fila("Produce al mes (recibido + reinvertido)", (r) => fmMes(r.puntos.produceMes), hoy && fmMes(hoy.produce)),
    fila("Patrimonio año 10", (r) => fmM(r.puntos.patrimonioFinal), fmM(res[0]?.puntos.patrimonioInicial)),
    fila("En plata de hoy", (r) => fmM(r.puntos.patrimonioFinalReal), "—"),
    fila("Crece al año (real)", (r) => (r.puntos.crecimientoRealAnual == null ? "—" : r.puntos.crecimientoRealAnual.toFixed(1).replace(".", ",") + "%"), "—"),
    fila("En rentas (año 10)", (r) => fmM(r.canastasFin.rentas), fmM(base.canastasHoy.rentas)),
    fila("En crecimiento (año 10)", (r) => fmM(r.canastasFin.crecimiento), fmM(base.canastasHoy.crecimiento)),
    fila("Vivienda y colchón (año 10)", (r) => fmM(r.canastasFin.proteccion), fmM(base.canastasHoy.proteccion)),
    fila("Colchón líquido (año 10)", (r) => fmM(r.canastasFin.colchon), fmM(base.canastasHoy.colchon)),
    fila("Mes más apretado", (r) => (r.puntos.mesApretado ? `año ${anioDe(r.puntos.mesApretado.mes)} · ${pct(r.puntos.mesApretado.cobertura)}` : "—"), "—"),
    fila("Meses en rojo", (r) => String(r.puntos.mesesNegativos), "—"),
    fila("Si crecimiento rinde menos", (r) => fmM(r.puntos.estres.patrimonioFinal), "—"),
    fila("Sin la mayor renta", (r) => (r.puntos.sinMayorFuente ? `${pct(r.puntos.sinMayorFuente.cobertura)} · ${r.puntos.sinMayorFuente.seSostiene ? "aguanta" : "no aguanta"}` : "—"), "—"),
    fila("Vendes hoy", (r) => (r.liquidez ? fmM(r.liquidez.liberado) : "—"), "—"),
    fila("Pagas deuda hoy", (r) => (r.liquidez ? fmM(r.liquidez.pagado) : "—"), "—"),
  ];
  const cien = useMemo(() => cienEnCada(base, perfil), [base, perfil]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>5 · Todos los escenarios, lado a lado</div>
        <div style={{ ...F.caption, marginTop: 2 }}>Los mismos indicadores para cada uno, con hoy como referencia. Toca un nombre para abrirlo.</div>
        <div style={{ height: 260, marginTop: 14 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} /><XAxis dataKey="anio" {...axisProps} tickFormatter={(a) => (a === 0 ? "hoy" : `año ${a}`)} /><YAxis {...axisProps} width={60} tickFormatter={(v) => fmM(v).replace("$", "")} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} labelFormatter={(a) => (a === 0 ? "Hoy" : `Año ${a}`)} />} /><Legend wrapperStyle={{ fontSize: 11, color: CHART.txt2 }} />
              {res.map((r) => <Line key={r.id} type="monotone" dataKey={r.id} name={r.nombre} stroke={r.color} strokeWidth={r.id === activoId ? 3 : 1.5} dot={false} strokeOpacity={activoId && r.id !== activoId ? 0.55 : 1} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Indicador</th><th style={{ ...th, textAlign: "right" }}>Hoy</th>{res.map((r) => <th key={r.id} onClick={() => onVer(r.id)} style={{ ...th, textAlign: "right", cursor: "pointer", color: r.color, fontSize: 12, textTransform: "none", letterSpacing: 0, borderBottom: r.id === activoId ? `2px solid ${r.color}` : "none" }}>{r.nombre}{caminoElegido === r.id ? " ★" : ""}</th>)}</tr></thead>
            <tbody>
              {filas.map(([l, f, h]) => <tr key={l} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>{l}</td><td style={{ ...tdNum, color: C.subtle }}>{h || "—"}</td>{res.map((r) => <td key={r.id} style={tdNum}>{f(r)}</td>)}</tr>)}
              <tr style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>Se cumple</td><td style={td} />{res.map((r) => <td key={r.id} style={{ ...td, textAlign: "right" }}><span style={chip(r.vigilancia.cumple ? C.ok : C.danger)}>{r.vigilancia.cumple ? "sí" : `no · año ${r.vigilancia.roturas[0].anio}`}</span></td>)}</tr>
              <tr style={{ borderTop: `1px solid ${C.border}` }}><td style={td} /><td style={td} />{res.map((r) => <td key={r.id} style={{ ...td, textAlign: "right" }}>{caminoElegido === r.id ? <span style={chip(C.accent)}>Tu camino</span> : <button style={{ ...btn(false), padding: "4px 10px" }} onClick={() => onElegir(r.id)}>Elegir</button>}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={card}>
        <div style={F.h3}>$100 M en cada inversión, en igualdad de condiciones</div>
        <div style={F.caption}>Qué serían $100 M a 3, 5 y 10 años en cada tipo de inversión que tienes o podrías tener, con todo reinvertido y neto de impuestos (35% sobre rendimiento pagado, 15% al vender).</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Inversión</th><th style={th}>Supuesto</th><th style={{ ...th, textAlign: "right" }}>3 años</th><th style={{ ...th, textAlign: "right" }}>5 años</th><th style={{ ...th, textAlign: "right" }}>10 años</th><th style={th}>Nota</th></tr></thead>
            <tbody>{cien.map((f) => <tr key={f.inversion} style={{ borderTop: `1px solid ${C.border}` }}><td style={td}>{f.inversion}<div style={F.caption}>{f.grupo}</div></td><td style={{ ...td, color: C.muted }}>{f.supuesto}</td><td style={tdNum}>${Math.round(f.a3)} M</td><td style={tdNum}>${Math.round(f.a5)} M</td><td style={{ ...tdNum, fontWeight: 700 }}>${Math.round(f.a10)} M</td><td style={{ ...td, color: C.muted }}>{f.nota}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────
export default function MiPlan({ user, perfil: perfilGuardado, fichas = {}, caminos: guardados = [], caminoElegido, onPerfil, onFichas, onCaminos, onElegir, onNavigate }) {
  const perfil = { ...PERFIL_DEFAULT, ...(perfilGuardado || {}) };
  const [paso, setPaso] = useState(1);
  const [activoId, setActivoId] = useState(caminoElegido || "balance");
  const base = useMemo(() => { const b = baseDesdeUsuario(user, perfil, fichas); return { ...b, canastasHoy: medirCanastas(b.posiciones, b.caja) }; }, [user, perfilGuardado, fichas]);
  // Plantillas (recalculadas con tus datos de hoy) + las que editaste + las tuyas
  const todos = useMemo(() => {
    const plantillas = CAMINOS_BASE.map((c) => escenarioDesdeCamino(base, c, perfil));
    const porId = Object.fromEntries(guardados.map((g) => [g.id, g]));
    return [...plantillas.map((p) => (porId[p.id] ? { ...p, ...porId[p.id], editado: true } : p)), ...guardados.filter((g) => !plantillas.some((p) => p.id === g.id))];
  }, [base, guardados, perfilGuardado]);
  const res = useMemo(() => compararCaminos(todos, base, perfil), [todos, base, perfilGuardado]);
  const sinDatos = base.posiciones.length === 0 && base.flujos.filter((f) => f.tipo === "ingreso").length === 0;
  const guardar = (esc) => { const limpio = { id: esc.id, nombre: esc.nombre, tesis: esc.tesis, color: esc.color, plantilla: esc.plantilla || null, propio: !!esc.propio, ventas: esc.ventas || [], pagos: esc.pagos || [], despliegue: esc.despliegue || [], eventos: esc.eventos || [], excedente: esc.excedente, colchonMeses: esc.colchonMeses, canastas: esc.canastas || null, condiciones: esc.condiciones || [] }; onCaminos(guardados.some((g) => g.id === esc.id) ? guardados.map((g) => (g.id === esc.id ? limpio : g)) : [...guardados, limpio]); };
  const colorNuevo = () => [CHART.purple, CHART.cyan, CHART.pink, CHART.gold][guardados.filter((g) => g.propio).length % 4];
  const nuevo = () => { const e = escenarioVacio({ nombre: `Mi escenario ${guardados.filter((g) => g.propio).length + 1}`, colchonMeses: 6, color: colorNuevo() }); guardar(e); setActivoId(e.id); };
  const duplicar = (esc) => { const e = { ...esc, id: "esc_" + Math.random().toString(36).slice(2, 8), nombre: `${esc.nombre} (copia)`, plantilla: null, propio: true, color: colorNuevo(), editado: false }; guardar(e); setActivoId(e.id); };
  const restablecer = (esc) => onCaminos(guardados.filter((g) => g.id !== esc.id));
  const borrar = (esc) => { onCaminos(guardados.filter((g) => g.id !== esc.id)); if (caminoElegido === esc.id) onElegir(null); setActivoId("balance"); };
  const rActivo = res.find((r) => r.id === activoId) || res[0];
  const ir = (n) => { setPaso(n); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <PageHeader label="—— Proyecta escenarios" title="Modela escenarios y mira cómo cambian tu patrimonio y tus ingresos en los próximos años" accent="próximos años" subtitle="Paso a paso: qué tienes hoy, qué viene seguro, qué vendes o transformas y a dónde va la plata. Cada escenario se modela a 10 años y se compara con los demás para decidir." compact />
      {sinDatos ? (
        <div style={card}><div style={F.h2}>Para proyectar escenarios hace falta tu punto de partida</div><div style={{ ...F.body, marginTop: 6 }}>Carga tus activos, ingresos, gastos y deudas: con eso FINPATHIA arma el paso 1 solo.</div><div style={{ marginTop: 12, display: "flex", gap: 8 }}><button style={btn(true)} onClick={() => onNavigate?.("inv")}>Ir a Patrimonio</button><button style={btn(false)} onClick={() => onNavigate?.("ing")}>Ir a Ingresos</button></div></div>
      ) : (<>
        <Stepper paso={paso} setPaso={ir} />
        {paso === 1 && <PasoHoy base={base} fichas={fichas} onFichas={onFichas} onNext={() => ir(2)} />}
        {paso === 2 && <PasoViene base={base} perfil={perfil} onPerfil={onPerfil} onNext={() => ir(3)} />}
        {paso === 3 && <PasoEscenario base={base} perfil={perfil} todos={todos} res={res} activoId={rActivo?.id} setActivoId={setActivoId} onGuardar={guardar} onNuevo={nuevo} onDuplicar={duplicar} onRestablecer={restablecer} onBorrar={borrar} caminoElegido={caminoElegido} onElegir={onElegir} onNext={() => ir(4)} onComparar={() => ir(5)} />}
        {paso === 4 && <PasoResultado base={base} r={rActivo} elegido={caminoElegido === rActivo?.id} onElegir={() => onElegir(rActivo.id)} onNext={() => ir(5)} onVolver={() => ir(3)} />}
        {paso === 5 && <PasoCompara res={res} base={base} perfil={perfil} activoId={rActivo?.id} onVer={(id) => { setActivoId(id); ir(4); }} caminoElegido={caminoElegido} onElegir={onElegir} />}
        <div style={{ ...F.caption, textAlign: "center" }}>Lo que simulas aquí no toca tus datos reales. Los ejercicios (Pensiones, Ahorro BTC, Comprar o arrendar) alimentan los supuestos, no las decisiones.</div>
      </>)}
    </div>
  );
}
