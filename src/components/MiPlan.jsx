// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · MiPlan — "¿Por qué camino llego, y se cumple?"
//
// 21-oct-2026, Santiago: "quiero una metodología: 5 caminos a 10 años, los
// mismos puntos para compararlos lado a lado, y que cada camino tenga
// condiciones: nada hago en llamarme conservador si muevo eso como me dé la
// gana. Aplicar mucho la teoría de las canastas."
//
// Esta pantalla reemplaza Simulador futuro, Tu Norte, Flujo Anual y Metas
// (las rutas viejas siguen vivas; nada se borra). Orden de lectura:
//
//   HOY         tu patrimonio por canastas (Protección · Rentas · Crecimiento · Uso)
//   CAMINOS     tres por defecto + los tuyos; cada uno dice qué cambia hoy
//   LADO A LADO los mismos puntos y la curva de patrimonio superpuesta
//   TU CAMINO   el elegido en detalle: año a año, movimientos, si se cumple
//   SUPUESTOS   inflación, tasas, pensiones: una vez, para todos los caminos
//
// El motor (lib/planes.js) calcula; lib/caminos.js traduce tus datos a
// posiciones y vigila que cada camino cumpla sus condiciones.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F } from "../lib/designTokens";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import { baseDesdeUsuario, CAMINOS_BASE, compararCaminos, medirCanastas, nuevoCamino, canastaDe, CANASTA_LABEL, CONDICION_LABEL, PERFIL_DEFAULT } from "../lib/caminos.js";

const fmM = (n) => { const v = Number(n) || 0; const a = Math.abs(v); if (a >= 1e9) return (v < 0 ? "−" : "") + "$" + (a / 1e9).toFixed(1).replace(".0", "").replace(".", ",") + " mil M"; return (v < 0 ? "−" : "") + "$" + Math.round(a / 1e6).toLocaleString("es-CO") + " M"; };
const fmMes = (n) => { const v = Number(n) || 0; const a = Math.abs(v); return (v < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(1).replace(".0", "").replace(".", ",") + " M" : Math.round(a / 1e3) + " K"); };
const pct = (n) => `${Math.round(Number(n) || 0)}%`;
const CANASTA_COLOR = { proteccion: C.accent, rentas: C.ok, crecimiento: C.warn, uso: C.subtle };
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, minWidth: 0 };
const sub = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, minWidth: 0 };
const inputS = { background: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };
const btn = (primary) => ({ background: primary ? C.accent : "transparent", color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.accent : C.borderStrong}`, borderRadius: 999, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
const chip = (color) => ({ display: "inline-block", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: `${color}20`, border: `1px solid ${color}40` });
const Num = ({ value, onChange, step = 1, min, max, suffix }) => (
  <div style={{ position: "relative" }}>
    <input type="number" step={step} min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} style={inputS} />
    {suffix && <span style={{ position: "absolute", right: 10, top: 9, fontSize: 11, color: C.subtle }}>{suffix}</span>}
  </div>
);
const Campo = ({ l, children }) => (<label style={{ display: "block" }}><div style={{ ...F.label, marginBottom: 4 }}>{l}</div>{children}</label>);

// ─── HOY: canastas ───────────────────────────────────────────────────────────
function BarraCanastas({ c, alto = 14 }) {
  const total = c.total || 1;
  return (
    <div>
      <div style={{ display: "flex", height: alto, borderRadius: 999, overflow: "hidden", background: C.raised }}>
        {["proteccion", "rentas", "crecimiento", "uso"].map((k) => c[k] > 0 && <div key={k} title={`${CANASTA_LABEL[k]} ${fmM(c[k])}`} style={{ width: `${(c[k] / total) * 100}%`, background: CANASTA_COLOR[k] }} />)}
      </div>
    </div>
  );
}
function Hoy({ base }) {
  const c = base.canastasHoy;
  const meses = base.gastosMes > 0 ? c.colchon / base.gastosMes : 0;
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={F.h2}>Hoy: tu patrimonio por canastas</div>
        <div style={{ ...F.caption }}>Patrimonio bruto <b style={{ color: C.text }}>{fmM(c.total)}</b> · gastos del mes <b style={{ color: C.text }}>{fmMes(base.gastosMes)}</b></div>
      </div>
      <div style={{ marginTop: 14 }}><BarraCanastas c={c} alto={18} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}>
        {[
          ["proteccion", "Vivienda y colchón", `${Math.round(meses)} meses de gastos líquidos`],
          ["rentas", "Pagan la vida cada mes", `${pct(c.rentasPct)} de lo invertible`],
          ["crecimiento", "Se multiplican", `${pct(c.crecimientoPct)} de lo invertible`],
          ["uso", "Ni rentan ni crecen", "carro, lotes quietos"],
        ].map(([k, l, d]) => (
          <div key={k} style={sub}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: CANASTA_COLOR[k] }} /><span style={F.label}>{CANASTA_LABEL[k]}</span></div>
            <div style={{ ...F.monoLg, color: C.text, marginTop: 4 }}>{fmM(c[k])}</div>
            <div style={{ ...F.caption, marginTop: 2 }}>{l} · {d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tarjeta de camino ───────────────────────────────────────────────────────
function TarjetaCamino({ r, elegido, activo, onVer, onElegir }) {
  const p = r.puntos, ok = r.vigilancia.cumple;
  return (
    <div onClick={onVer} style={{ ...card, cursor: "pointer", borderColor: activo ? r.color : C.border, boxShadow: activo ? `0 0 0 1px ${r.color}` : "none", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }} /><span style={F.h2}>{r.nombre}</span>{r.propio && <span style={chip(C.purple)}>tuyo</span>}</div>
        <div style={{ display: "flex", gap: 6 }}>{elegido && <span style={chip(C.accent)}>Tu camino</span>}<span style={chip(ok ? C.ok : C.danger)}>{ok ? "se cumple" : `se rompe · año ${r.vigilancia.roturas[0].anio}`}</span></div>
      </div>
      <div style={{ ...F.body, minHeight: 36 }}>{r.tesis}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><div style={F.label}>Patrimonio año 10</div><div style={{ ...F.monoLg, color: C.text }}>{fmM(p.patrimonioFinal)}</div><div style={F.caption}>{fmM(p.patrimonioFinalReal)} en plata de hoy</div></div>
        <div><div style={F.label}>Mes del año 10</div><div style={{ ...F.monoLg, color: C.text }}>{fmMes(p.quedaMes)}</div><div style={F.caption}>entra {fmMes(p.entraMes)} · cobertura {pct(p.cobertura)}</div></div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
        <div style={F.label}>Qué cambia hoy</div>
        {r.ajuste.notas.length ? r.ajuste.notas.slice(0, 2).map((n, i) => <div key={i} style={{ ...F.caption, color: C.muted, marginTop: 3 }}>· {n}</div>) : <div style={{ ...F.caption, marginTop: 3 }}>· Nada: ya estás dentro de los rangos de este camino.</div>}
        {r.ajuste.notas.length > 2 && <div style={{ ...F.caption, marginTop: 3 }}>+{r.ajuste.notas.length - 2} más</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button style={btn(false)} onClick={(e) => { e.stopPropagation(); onVer(); }}>Ver en detalle</button>
        {!elegido && <button style={btn(true)} onClick={(e) => { e.stopPropagation(); onElegir(); }}>Elegir este camino</button>}
      </div>
    </div>
  );
}

// ─── Lado a lado ─────────────────────────────────────────────────────────────
function LadoALado({ res, activoId, onVer }) {
  const data = useMemo(() => {
    const H = Math.max(...res.map((r) => r.resultado.anual.length));
    return Array.from({ length: H + 1 }, (_, a) => { const row = { anio: a }; res.forEach((r) => { row[r.id] = a === 0 ? r.puntos.patrimonioInicial : r.resultado.anual[a - 1]?.patrimonioFin; }); return row; });
  }, [res]);
  const filas = [
    ["Patrimonio año 10", (p) => fmM(p.patrimonioFinal)],
    ["En plata de hoy", (p) => fmM(p.patrimonioFinalReal)],
    ["Crece al año (real)", (p) => (p.crecimientoRealAnual == null ? "—" : p.crecimientoRealAnual.toFixed(1).replace(".", ",") + "%")],
    ["Entra al mes (año 10)", (p) => fmMes(p.entraMes)],
    ["Sale al mes (año 10)", (p) => fmMes(p.saleMes)],
    ["Cobertura", (p) => pct(p.cobertura)],
    ["Produce al mes (recibido + reinvertido)", (p) => fmMes(p.produceMes)],
    ["Mes más apretado", (p) => (p.mesApretado ? `año ${Math.floor(p.mesApretado.mes / 12) + 1} · ${pct(p.mesApretado.cobertura)}` : "—")],
    ["Si crecimiento rinde menos", (p) => fmM(p.estres.patrimonioFinal)],
    ["Sin la mayor renta", (p) => (p.sinMayorFuente ? `${pct(p.sinMayorFuente.cobertura)} · ${p.sinMayorFuente.seSostiene ? "aguanta" : "no aguanta"}` : "—")],
  ];
  return (
    <div style={card}>
      <div style={F.h2}>Lado a lado</div>
      <div style={{ ...F.caption, marginTop: 2 }}>Los mismos puntos para cada camino. Patrimonio neto al cierre de cada año.</div>
      <div style={{ height: 240, marginTop: 14 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="anio" {...axisProps} tickFormatter={(a) => (a === 0 ? "hoy" : `año ${a}`)} />
            <YAxis {...axisProps} width={56} tickFormatter={(v) => fmM(v).replace("$", "")} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} labelFormatter={(a) => (a === 0 ? "Hoy" : `Año ${a}`)} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: CHART.txt2 }} />
            {res.map((r) => <Line key={r.id} type="monotone" dataKey={r.id} name={r.nombre} stroke={r.color} strokeWidth={r.id === activoId ? 3 : 1.5} dot={false} strokeOpacity={activoId && r.id !== activoId ? 0.5 : 1} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
          <thead><tr><th style={{ textAlign: "left", padding: "8px 6px", ...F.label }}>Punto</th>{res.map((r) => <th key={r.id} onClick={() => onVer(r.id)} style={{ textAlign: "right", padding: "8px 6px", cursor: "pointer", color: r.color, fontWeight: 700, borderBottom: r.id === activoId ? `2px solid ${r.color}` : "none" }}>{r.nombre}</th>)}</tr></thead>
          <tbody>
            {filas.map(([l, f]) => <tr key={l} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: "7px 6px", color: C.muted }}>{l}</td>{res.map((r) => <td key={r.id} style={{ padding: "7px 6px", textAlign: "right", color: C.text, fontFamily: F.mono.fontFamily }}>{f(r.puntos)}</td>)}</tr>)}
            <tr style={{ borderTop: `1px solid ${C.border}` }}><td style={{ padding: "7px 6px", color: C.muted }}>Se cumple</td>{res.map((r) => <td key={r.id} style={{ padding: "7px 6px", textAlign: "right" }}><span style={chip(r.vigilancia.cumple ? C.ok : C.danger)}>{r.vigilancia.cumple ? "sí" : `no · año ${r.vigilancia.roturas[0].anio}`}</span></td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Movimientos propios ─────────────────────────────────────────────────────
const TIPOS_MOV = [
  { v: "vender", l: "Vender un activo" }, { v: "comprar", l: "Comprar un activo" }, { v: "aportar", l: "Mover capital a" },
  { v: "flujo_inicia_ingreso", l: "Entra un ingreso nuevo" }, { v: "flujo_inicia_gasto", l: "Entra un gasto nuevo" }, { v: "flujo_termina", l: "Termina un ingreso o gasto" },
];
function describirMov(m, posiciones, flujos) {
  const p = posiciones.find((x) => x.id === m.posicionId)?.nombre || m.posicionId;
  const anio = Math.floor((Number(m.mes) || 0) / 12) + 1;
  switch (m.tipo) {
    case "vender": return `Año ${anio}: vender ${p}`;
    case "comprar": return `Año ${anio}: comprar ${m.nombre} por ${fmM(m.costo)} (${m.bolsillo === "uso" ? "uso" : m.bolsillo === "crecimiento" ? "crecimiento" : "renta"})${m.renta ? ` que renta ${fmMes(m.renta)}` : ""}`;
    case "aportar": return `Año ${anio}: mover ${fmM(m.monto)} a ${p}`;
    case "flujo_inicia": return `Año ${anio}: ${m.flujo?.tipo === "gasto" ? "nuevo gasto" : "nuevo ingreso"} ${m.flujo?.nombre} de ${fmMes(m.flujo?.monto)}/mes`;
    case "flujo_termina": return `Año ${anio}: termina ${flujos.find((f) => f.id === m.flujoId)?.nombre || m.flujoId}`;
    default: return `${m.tipo}`;
  }
}
function EditorMovimiento({ posiciones, flujos, onAgregar, onCerrar }) {
  const [f, setF] = useState({ tipo: "vender", anio: 2, posicionId: posiciones[0]?.id || "", nombre: "", monto: "", bolsillo: "sustento", renta: "", flujoId: flujos[0]?.id || "", origenId: posiciones[0]?.id || "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const mes = (Math.max(1, Number(f.anio) || 1) - 1) * 12;
  const guardar = () => {
    const base = { id: "mv_" + Math.random().toString(36).slice(2, 8), mes };
    let m = null;
    if (f.tipo === "vender") m = { ...base, tipo: "vender", posicionId: f.posicionId };
    if (f.tipo === "comprar" && f.nombre && Number(f.monto) > 0) m = { ...base, tipo: "comprar", nombre: f.nombre, costo: Number(f.monto) * 1e6, bolsillo: f.bolsillo, pagaPct: f.bolsillo === "sustento" ? 100 : 0, valorizacion: f.bolsillo === "crecimiento" ? 0 : 5, origen: [{ posicionId: f.origenId }], renta: Number(f.renta) > 0 ? Number(f.renta) * 1e6 : undefined };
    if (f.tipo === "aportar" && Number(f.monto) > 0) m = { ...base, tipo: "aportar", posicionId: f.posicionId, monto: Number(f.monto) * 1e6, origen: [{ posicionId: f.origenId }] };
    if ((f.tipo === "flujo_inicia_ingreso" || f.tipo === "flujo_inicia_gasto") && f.nombre && Number(f.monto) > 0) m = { ...base, tipo: "flujo_inicia", flujo: { id: base.id + "_f", nombre: f.nombre, tipo: f.tipo.endsWith("gasto") ? "gasto" : "ingreso", monto: Number(f.monto) * 1e6, indexa: true } };
    if (f.tipo === "flujo_termina") m = { ...base, tipo: "flujo_termina", flujoId: f.flujoId };
    if (m) { onAgregar(m); onCerrar(); }
  };
  const selPos = (k) => <select value={f[k]} onChange={(e) => set(k, e.target.value)} style={inputS}>{posiciones.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {fmM(p.capital)}</option>)}</select>;
  return (
    <div style={{ ...sub, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
      <Campo l="Qué pasa"><select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputS}>{TIPOS_MOV.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></Campo>
      <Campo l="En el año"><Num value={f.anio} min={1} max={10} onChange={(v) => set("anio", v)} /></Campo>
      {(f.tipo === "vender" || f.tipo === "aportar") && <Campo l={f.tipo === "vender" ? "Activo" : "Destino"}>{selPos("posicionId")}</Campo>}
      {(f.tipo === "comprar" || f.tipo.startsWith("flujo_inicia")) && <Campo l="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} style={inputS} placeholder={f.tipo === "comprar" ? "Finca, apartamento…" : "Pensión, colegio…"} /></Campo>}
      {f.tipo !== "vender" && f.tipo !== "flujo_termina" && <Campo l={f.tipo.startsWith("flujo") ? "Monto al mes (millones)" : "Monto (millones)"}><Num value={f.monto} step={f.tipo.startsWith("flujo") ? 0.1 : 1} onChange={(v) => set("monto", v)} suffix="M" /></Campo>}
      {f.tipo === "comprar" && <Campo l="Papel"><select value={f.bolsillo} onChange={(e) => set("bolsillo", e.target.value)} style={inputS}><option value="uso">Uso (vivienda, finca)</option><option value="sustento">Renta (paga cada mes)</option><option value="crecimiento">Crecimiento</option></select></Campo>}
      {f.tipo === "comprar" && f.bolsillo === "sustento" && <Campo l="Renta al mes (millones)"><Num value={f.renta} step={0.1} onChange={(v) => set("renta", v)} suffix="M" /></Campo>}
      {(f.tipo === "comprar" || f.tipo === "aportar") && <Campo l="Con plata de">{selPos("origenId")}</Campo>}
      {f.tipo === "flujo_termina" && <Campo l="Cuál"><select value={f.flujoId} onChange={(e) => set("flujoId", e.target.value)} style={inputS}>{flujos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {fmMes(x.monto)}</option>)}</select></Campo>}
      <div style={{ display: "flex", gap: 8 }}><button style={btn(true)} onClick={guardar}>Agregar</button><button style={btn(false)} onClick={onCerrar}>Cancelar</button></div>
    </div>
  );
}

// ─── Editor de camino propio ─────────────────────────────────────────────────
function EditorCamino({ camino, onChange, onBorrar }) {
  const c = camino.canastas || {};
  const setC = (k, v) => onChange({ ...camino, canastas: { ...c, [k]: v } });
  const rango = (k, campo, v) => setC(k, { ...(c[k] || {}), [campo]: v === "" ? undefined : v });
  const crecPct = (camino.excedente || []).find((e) => e.canasta === "crecimiento")?.pct ?? 50;
  const toggleCond = (id) => { const s = new Set(camino.condiciones || []); s.has(id) ? s.delete(id) : s.add(id); onChange({ ...camino, condiciones: [...s] }); };
  return (
    <div style={{ ...sub, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Campo l="Nombre"><input value={camino.nombre} onChange={(e) => onChange({ ...camino, nombre: e.target.value })} style={inputS} /></Campo>
        <Campo l="Tesis (una frase)"><input value={camino.tesis} onChange={(e) => onChange({ ...camino, tesis: e.target.value })} style={inputS} placeholder="Qué persigue este camino" /></Campo>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <Campo l="Rentas mín."><Num value={c.rentas?.min ?? ""} onChange={(v) => rango("rentas", "min", v)} suffix="%" /></Campo>
        <Campo l="Rentas máx."><Num value={c.rentas?.max ?? ""} onChange={(v) => rango("rentas", "max", v)} suffix="%" /></Campo>
        <Campo l="Crecimiento mín."><Num value={c.crecimiento?.min ?? ""} onChange={(v) => rango("crecimiento", "min", v)} suffix="%" /></Campo>
        <Campo l="Crecimiento máx."><Num value={c.crecimiento?.max ?? ""} onChange={(v) => rango("crecimiento", "max", v)} suffix="%" /></Campo>
        <Campo l="Colchón (meses)"><Num value={c.colchonMeses ?? ""} onChange={(v) => setC("colchonMeses", v)} /></Campo>
        <Campo l="Vivienda"><select value={c.vivienda || "indiferente"} onChange={(e) => setC("vivienda", e.target.value)} style={inputS}><option value="propia">Propia, no se vende</option><option value="indiferente">Como esté</option><option value="arrendado">Vivir arrendado</option></select></Campo>
      </div>
      <div>
        <div style={F.label}>Lo que sobra cada mes · {100 - crecPct}% a rentas, {crecPct}% a crecimiento</div>
        <input type="range" min={0} max={100} step={5} value={crecPct} onChange={(e) => { const v = Number(e.target.value); onChange({ ...camino, excedente: [{ canasta: "rentas", pct: 100 - v }, { canasta: "crecimiento", pct: v }] }); }} style={{ width: "100%" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(CONDICION_LABEL).map(([id, l]) => <label key={id} style={{ ...F.caption, color: C.muted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={(camino.condiciones || []).includes(id)} onChange={() => toggleCond(id)} />{l}</label>)}
      </div>
      <div><button style={{ ...btn(false), color: C.danger, borderColor: C.danger }} onClick={onBorrar}>Borrar este camino</button></div>
    </div>
  );
}

// ─── Detalle del camino ──────────────────────────────────────────────────────
function Detalle({ r, base, elegido, onElegir, onCambiarCamino, onBorrarCamino }) {
  const [verMov, setVerMov] = useState(false);
  const [editar, setEditar] = useState(false);
  const movs = r.movimientos || [];
  const posiciones = r.cfg.posiciones.filter((p) => !p.nuevo || p.capital > 0);
  const flujos = r.cfg.flujos;
  const setMovs = (lista) => onCambiarCamino({ ...r, movimientos: lista });
  return (
    <div style={{ ...card, borderColor: r.color }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }} /><span style={F.h1}>{r.nombre}</span>{elegido && <span style={chip(C.accent)}>Tu camino</span>}</div>
        <div style={{ display: "flex", gap: 8 }}>{r.propio && <button style={btn(false)} onClick={() => setEditar((v) => !v)}>{editar ? "Cerrar" : "Editar rangos"}</button>}{!elegido && <button style={btn(true)} onClick={onElegir}>Elegir este camino</button>}</div>
      </div>
      <div style={{ ...F.body, marginTop: 6 }}>{r.tesis}</div>
      {editar && r.propio && <div style={{ marginTop: 12 }}><EditorCamino camino={r} onChange={onCambiarCamino} onBorrar={onBorrarCamino} /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 14, marginTop: 16 }}>
        <div style={sub}>
          <div style={F.h3}>Canastas: hoy → año 10</div>
          <div style={{ marginTop: 10 }}><div style={F.caption}>Hoy</div><BarraCanastas c={r.canastasHoy} /></div>
          <div style={{ marginTop: 10 }}><div style={F.caption}>Año 10</div><BarraCanastas c={r.canastasFin} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
            {["proteccion", "rentas", "crecimiento"].map((k) => <div key={k}><div style={{ ...F.label, color: CANASTA_COLOR[k] }}>{CANASTA_LABEL[k]}</div><div style={{ ...F.caption, color: C.text }}>{fmM(r.canastasHoy[k])} → {fmM(r.canastasFin[k])}</div></div>)}
          </div>
          <div style={{ ...F.caption, marginTop: 10 }}>Rangos: {r.canastas?.rentas?.min != null && `rentas ≥ ${r.canastas.rentas.min}% · `}{r.canastas?.rentas?.max != null && `rentas ≤ ${r.canastas.rentas.max}% · `}{r.canastas?.crecimiento?.min != null && `crecimiento ≥ ${r.canastas.crecimiento.min}% · `}{r.canastas?.crecimiento?.max != null && `crecimiento ≤ ${r.canastas.crecimiento.max}% · `}colchón {r.canastas?.colchonMeses} meses · vivienda {r.canastas?.vivienda === "propia" ? "propia" : r.canastas?.vivienda === "arrendado" ? "arrendado" : "como esté"}</div>
          {(r.condiciones || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{r.condiciones.map((id) => <span key={id} style={chip(C.muted)}>{CONDICION_LABEL[id] || id}</span>)}</div>}
        </div>
        <div style={sub}>
          <div style={F.h3}>Qué cambia hoy</div>
          {r.ajuste.notas.length ? r.ajuste.notas.map((n, i) => <div key={i} style={{ ...F.body, marginTop: 6 }}>· {n}</div>) : <div style={{ ...F.body, marginTop: 6 }}>Nada: ya estás dentro de los rangos.</div>}
          <div style={{ ...F.h3, marginTop: 14 }}>¿Se cumple?</div>
          {r.vigilancia.cumple ? <div style={{ ...F.body, color: C.ok, marginTop: 6 }}>Sí: los 10 años dentro de rango y sin romper condiciones.</div> : r.vigilancia.roturas.slice(0, 5).map((x, i) => <div key={i} style={{ ...F.body, color: C.danger, marginTop: 6 }}>· Año {x.anio}: {x.detalle}</div>)}
          {r.vigilancia.roturas.length > 5 && <div style={F.caption}>+{r.vigilancia.roturas.length - 5} más</div>}
        </div>
      </div>

      <div style={{ ...sub, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div><div style={F.h3}>Tus movimientos en este camino</div><div style={F.caption}>Lo que decides hacer y cuándo. El camino te dice si lo respeta.</div></div>
          {!verMov && <button style={btn(false)} onClick={() => setVerMov(true)}>+ Agregar movimiento</button>}
        </div>
        {verMov && <div style={{ marginTop: 10 }}><EditorMovimiento posiciones={posiciones} flujos={flujos} onAgregar={(m) => setMovs([...movs, m])} onCerrar={() => setVerMov(false)} /></div>}
        {movs.length > 0 && <div style={{ marginTop: 10, display: "grid", gap: 6 }}>{movs.map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, ...F.body, color: C.text }}><span>· {describirMov(m, r.cfg.posiciones, flujos)}</span><button style={{ ...btn(false), padding: "3px 10px", color: C.subtle }} onClick={() => setMovs(movs.filter((x) => x.id !== m.id))}>quitar</button></div>)}</div>}
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
          <thead><tr>{["Año", "Entra/mes", "Sale/mes", "Queda/mes", "Cobertura", "Patrimonio", "Qué pasa"].map((h, i) => <th key={h} style={{ ...F.label, textAlign: i === 6 ? "left" : "right", padding: "8px 6px" }}>{h}</th>)}</tr></thead>
          <tbody>{r.resultado.anual.map((a) => <tr key={a.anio} style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: "7px 6px", textAlign: "right", color: C.muted }}>{a.anio}</td>
            <td style={{ padding: "7px 6px", textAlign: "right", color: C.text, fontFamily: F.mono.fontFamily }}>{fmMes(a.entraMes)}</td>
            <td style={{ padding: "7px 6px", textAlign: "right", color: C.text, fontFamily: F.mono.fontFamily }}>{fmMes(a.saleMes)}</td>
            <td style={{ padding: "7px 6px", textAlign: "right", color: a.quedaMes >= 0 ? C.ok : C.danger, fontFamily: F.mono.fontFamily }}>{fmMes(a.quedaMes)}</td>
            <td style={{ padding: "7px 6px", textAlign: "right", color: C.text }}>{a.cobertura == null ? "—" : pct(a.cobertura)}</td>
            <td style={{ padding: "7px 6px", textAlign: "right", color: C.text, fontFamily: F.mono.fontFamily }}>{fmM(a.patrimonioFin)}</td>
            <td style={{ padding: "7px 6px", color: C.muted, maxWidth: 320 }}>{a.cambios.slice(0, 3).map((t) => t.replace(/(\d{6,})\/mes/g, (_, n) => fmMes(Number(n)) + "/mes").replace(/\b(\d{6,})\b/g, (_, n) => fmM(Number(n)))).join(" · ") || ""}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Fichas: tus activos en canastas ─────────────────────────────────────────
function Fichas({ base, fichas, onFichas }) {
  const [abierto, setAbierto] = useState(false);
  const set = (id, k, v) => onFichas({ ...fichas, [id]: { ...(fichas[id] || {}), [k]: v } });
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div><div style={F.h2}>Tus activos, por canasta</div><div style={F.caption}>El papel de cada activo lo propone FINPATHIA según su tipo; corrígelo si no es así.</div></div>
        <button style={btn(false)} onClick={() => setAbierto((v) => !v)}>{abierto ? "Cerrar" : "Revisar"}</button>
      </div>
      {abierto && <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
          <thead><tr>{["Activo", "Valor", "Canasta", "Papel", "Rinde al año", "Recibe", "Valoriza al año", "Vivienda"].map((h) => <th key={h} style={{ ...F.label, textAlign: "left", padding: "6px" }}>{h}</th>)}</tr></thead>
          <tbody>{base.posiciones.map((p) => <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: 6, color: C.text }}>{p.nombre}<div style={F.caption}>{p.tipo}{p.renta > 0 ? ` · renta ${fmMes(p.renta)}` : ""}</div></td>
            <td style={{ padding: 6, color: C.text, fontFamily: F.mono.fontFamily }}>{fmM(p.capital)}</td>
            <td style={{ padding: 6 }}><span style={chip(CANASTA_COLOR[canastaDe(p)])}>{CANASTA_LABEL[canastaDe(p)]}</span></td>
            <td style={{ padding: 6 }}><select value={p.bolsillo} onChange={(e) => set(p.id, "bolsillo", e.target.value)} style={{ ...inputS, padding: "5px 8px", width: 130 }}><option value="sustento">Renta (recibo)</option><option value="crecimiento">Crecimiento (reinvierte)</option><option value="uso">Uso</option></select></td>
            <td style={{ padding: 6 }}><input type="number" step={0.5} value={p.tasa} onChange={(e) => set(p.id, "tasa", Number(e.target.value))} style={{ ...inputS, padding: "5px 8px", width: 70 }} /></td>
            <td style={{ padding: 6 }}><input type="number" step={10} min={0} max={100} value={p.pagaPct} onChange={(e) => set(p.id, "pagaPct", Number(e.target.value))} style={{ ...inputS, padding: "5px 8px", width: 64 }} /></td>
            <td style={{ padding: 6 }}><input type="number" step={0.5} value={p.valorizacion} onChange={(e) => set(p.id, "valorizacion", Number(e.target.value))} style={{ ...inputS, padding: "5px 8px", width: 70 }} /></td>
            <td style={{ padding: 6 }}>{p.inmueble && <input type="checkbox" checked={!!p.vivienda} onChange={(e) => set(p.id, "vivienda", e.target.checked)} />}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  );
}

// ─── Supuestos del perfil ────────────────────────────────────────────────────
function Supuestos({ perfil, onPerfil }) {
  const [abierto, setAbierto] = useState(false);
  const set = (k, v) => onPerfil({ ...perfil, [k]: v });
  const pens = perfil.pensiones || [];
  const setPens = (lista) => set("pensiones", lista);
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div><div style={F.h2}>Supuestos</div><div style={F.caption}>Inflación {perfil.inflacion}% · crecimiento {perfil.tasaCrecimiento}% · renta estable {perfil.tasaRentaEstable}% · BTC {perfil.tasaBtc}% · {pens.length ? `${pens.length} pensión${pens.length > 1 ? "es" : ""}` : "sin pensiones"}. Aplican a todos los caminos.</div></div>
        <button style={btn(false)} onClick={() => setAbierto((v) => !v)}>{abierto ? "Cerrar" : "Cambiar"}</button>
      </div>
      {abierto && <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Campo l="Inflación anual"><Num value={perfil.inflacion} step={0.5} onChange={(v) => set("inflacion", v)} suffix="%" /></Campo>
          <Campo l="Crecimiento (bolsa, ETF)"><Num value={perfil.tasaCrecimiento} step={0.5} onChange={(v) => set("tasaCrecimiento", v)} suffix="%" /></Campo>
          <Campo l="Renta estable (CDT)"><Num value={perfil.tasaRentaEstable} step={0.5} onChange={(v) => set("tasaRentaEstable", v)} suffix="%" /></Campo>
          <Campo l="Bitcoin"><Num value={perfil.tasaBtc} step={1} onChange={(v) => set("tasaBtc", v)} suffix="%" /></Campo>
          <Campo l="Valorización inmuebles"><Num value={perfil.valorizacionInmueble} step={0.5} onChange={(v) => set("valorizacionInmueble", v)} suffix="%" /></Campo>
          <Campo l="Valorización lotes"><Num value={perfil.valorizacionLote} step={0.5} onChange={(v) => set("valorizacionLote", v)} suffix="%" /></Campo>
          <Campo l="Arriendo si vives arrendado (% del valor al mes)"><Num value={perfil.arriendoPctMensual} step={0.1} onChange={(v) => set("arriendoPctMensual", v)} suffix="%" /></Campo>
          <Campo l="Cobertura mínima"><Num value={perfil.coberturaMin} step={5} onChange={(v) => set("coberturaMin", v)} suffix="%" /></Campo>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={F.h3}>Pensiones que entran</div><button style={btn(false)} onClick={() => setPens([...pens, { nombre: "Pensión", mes: 60, monto: 3e6 }])}>+ Pensión</button></div>
          {pens.map((p, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginTop: 8, alignItems: "end" }}>
            <Campo l="Nombre"><input value={p.nombre} onChange={(e) => setPens(pens.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} style={inputS} /></Campo>
            <Campo l="Desde el año"><Num value={Math.floor((p.mes || 0) / 12) + 1} min={1} max={10} onChange={(v) => setPens(pens.map((x, k) => (k === i ? { ...x, mes: (Math.max(1, v || 1) - 1) * 12 } : x)))} /></Campo>
            <Campo l="Al mes (millones)"><Num value={Math.round((p.monto || 0) / 1e5) / 10} step={0.1} onChange={(v) => setPens(pens.map((x, k) => (k === i ? { ...x, monto: (v || 0) * 1e6 } : x)))} suffix="M" /></Campo>
            <button style={{ ...btn(false), color: C.subtle }} onClick={() => setPens(pens.filter((_, k) => k !== i))}>quitar</button>
          </div>)}
          <div style={{ ...F.caption, marginTop: 8 }}>Las edades y tasas que dejes en el ejercicio de Pensiones también llegan aquí.</div>
        </div>
      </div>}
    </div>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────
export default function MiPlan({ user, perfil: perfilGuardado, fichas = {}, caminos: propios = [], caminoElegido, onPerfil, onFichas, onCaminos, onElegir, onNavigate }) {
  const perfil = { ...PERFIL_DEFAULT, ...(perfilGuardado || {}) };
  const [activoId, setActivoId] = useState(caminoElegido || "balance");
  const base = useMemo(() => { const b = baseDesdeUsuario(user, perfil, fichas); return { ...b, canastasHoy: medirCanastas(b.posiciones, b.caja) }; }, [user, perfilGuardado, fichas]);
  const todos = useMemo(() => [...CAMINOS_BASE, ...propios.map((c) => ({ ...c, propio: true }))], [propios]);
  const res = useMemo(() => compararCaminos(todos, base, perfil), [todos, base, perfilGuardado]);
  const activo = res.find((r) => r.id === activoId) || res[0];
  const sinDatos = base.posiciones.length === 0 && base.flujos.filter((f) => f.tipo === "ingreso").length === 0;

  const crear = () => { const c = nuevoCamino({ nombre: `Mi camino ${propios.length + 1}` }); onCaminos([...propios, c]); setActivoId(c.id); };
  const cambiar = (c) => onCaminos(propios.map((x) => (x.id === c.id ? { id: c.id, nombre: c.nombre, tesis: c.tesis, color: c.color, canastas: c.canastas, excedente: c.excedente, condiciones: c.condiciones, movimientos: c.movimientos || [] } : x)));
  const borrar = (id) => { onCaminos(propios.filter((x) => x.id !== id)); if (caminoElegido === id) onElegir(null); setActivoId("balance"); };
  // Los caminos base también aceptan movimientos propios: se guardan como camino propio derivado
  const cambiarCualquiera = (c) => { if (c.propio) return cambiar(c); const copia = nuevoCamino({ ...c, id: `${c.id}_mio`, nombre: `${c.nombre} (con mis movimientos)`, movimientos: c.movimientos || [] }); onCaminos([...propios.filter((x) => x.id !== copia.id), copia]); setActivoId(copia.id); };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <PageHeader label="—— Mi plan" title="Tu patrimonio a 10 años, por caminos" accent="caminos" subtitle="Tres caminos con condiciones que se cumplen, los mismos puntos para compararlos, y el tuyo con tus propios movimientos." />
      {sinDatos ? (
        <div style={card}><div style={F.h2}>Para trazar caminos hace falta tu punto de partida</div><div style={{ ...F.body, marginTop: 6 }}>Carga tus activos, ingresos, gastos y deudas: con eso FINPATHIA arma las canastas y los tres caminos solos.</div><div style={{ marginTop: 12, display: "flex", gap: 8 }}><button style={btn(true)} onClick={() => onNavigate?.("inv")}>Ir a Patrimonio</button><button style={btn(false)} onClick={() => onNavigate?.("ing")}>Ir a Ingresos</button></div></div>
      ) : (<>
        <Hoy base={base} />
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <div><div style={F.h2}>Los caminos</div><div style={F.caption}>Cada uno es un juego de rangos por canasta y condiciones. Un camino que no se cumple te lo dice.</div></div>
            <button style={btn(false)} onClick={crear}>+ Crear mi camino</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 12 }}>
            {res.map((r) => <TarjetaCamino key={r.id} r={r} elegido={caminoElegido === r.id} activo={activo?.id === r.id} onVer={() => setActivoId(r.id)} onElegir={() => onElegir(r.id)} />)}
          </div>
        </div>
        <LadoALado res={res} activoId={activo?.id} onVer={setActivoId} />
        {activo && <Detalle r={activo} base={base} elegido={caminoElegido === activo.id} onElegir={() => onElegir(activo.id)} onCambiarCamino={cambiarCualquiera} onBorrarCamino={() => borrar(activo.id)} />}
        <Fichas base={base} fichas={fichas} onFichas={onFichas} />
        <Supuestos perfil={perfil} onPerfil={onPerfil} />
        <div style={{ ...F.caption, textAlign: "center" }}>Lo que simulas aquí no toca tus datos reales. Los ejercicios (Pensiones, Ahorro BTC, Comprar o arrendar) alimentan los supuestos, no las decisiones.</div>
      </>)}
    </div>
  );
}
