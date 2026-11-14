import { useState } from "react";
import NumberInput from "./NumberInput";
import { MESES, getMesActual } from "../lib/flowHelpers.js";
import { tx, nombreMes } from "../lib/region.js";
import {
  registrarExtraIngreso, crearIngresoConExtra, eliminarExtraIngreso, editarExtraIngreso,
  extraIngresoEnPesos, convertirEnUnicoIngreso, montoDeUnPago,
} from "../lib/ingresosExtra.js";

// ════════════════════════════════════════════════════════════════════════
// 14-nov-2026 — Un solo ingreso (no se repite).
// Santiago: "no es claro, es enredado este formulario, y en el caso de este
// ingreso es peor porque no queda claro qué mes entró"; "necesito que sean
// lógicos, intuitivos, fáciles de entender".
//
// Cuatro preguntas, en el orden en que uno lo piensa:
//   ¿Qué fue? → ¿De quién es? → ¿Cuánto entró? → ¿En qué mes?
// y un resumen que dice en palabras qué pasa con la plata.
//
// Modos:
//   nuevo      desde «+ Agregar»
//   corregir   «Editar» en un ingreso que solo existe por su ingreso único
//   convertir  un ingreso que se registró como recurrente y era de una sola vez
//   deIngreso  los ingresos únicos de un ingreso recurrente (p. ej. un bono del
//              salario): lista con Corregir / Quitar y para agregar otro
// ════════════════════════════════════════════════════════════════════════

const TIPOS = [
  { v: "Herencia o donación", l: "Herencia o donación", nombre: "Herencia" },
  { v: "Venta de activo", l: "Venta de un activo", nombre: "" },
  { v: "Prima/Bono", l: "Bono o prima", nombre: "Bono" },
  { v: "Honorarios", l: "Honorarios", nombre: "Honorarios" },
  { v: "Otro", l: "Otro", nombre: "" },
];
const ASOCIABLES = new Set(["Prima/Bono", "Honorarios", "Otro"]);
const tipoDe = (cat) => (TIPOS.some((t) => t.v === cat) ? cat
  : /herencia|donaci/i.test(cat || "") ? "Herencia o donación"
  : /venta/i.test(cat || "") ? "Venta de activo"
  : /prima|bono/i.test(cat || "") ? "Prima/Bono"
  : /honorario/i.test(cat || "") ? "Honorarios" : "Otro");

export default function ExtraIngresoModal({ ingresos, inicialId, convertirId, fm, T, monedaVista = "COP", trm, owners = [], onGuardar, onCerrar }) {
  const { año, mes: mesHoy } = getMesActual();
  const lista = (ingresos || []).filter((i) => i && i.id);
  const recurrentes = lista.filter((i) => !i.soloExtras).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));

  const conv = convertirId ? lista.find((i) => i.id === convertirId) : null;
  const ini = !conv && inicialId ? lista.find((i) => i.id === inicialId) : null;
  const iniEx = ini?.soloExtras && (ini.extras || []).length === 1 ? ini.extras[0] : null;
  const modo = conv ? "convertir" : iniEx ? "corregir" : ini ? "deIngreso" : "nuevo";
  const fuente = conv || (iniEx ? ini : null);

  const [tipo, setTipo] = useState(fuente ? tipoDe(fuente.categoria) : "");
  const [nombre, setNombre] = useState(fuente?.nombre || "");
  const [owner, setOwner] = useState(fuente?.owner || owners[0]?.id || "");
  const [asociarA, setAsociarA] = useState("");
  const [editId, setEditId] = useState(iniEx?.id || null);
  const [monto, setMonto] = useState(iniEx ? String(iniEx.monto || "") : conv ? String(montoDeUnPago(conv) || "") : "");
  const [moneda, setMoneda] = useState(iniEx ? (iniEx.moneda || "COP") : conv ? (conv.moneda || "COP") : (monedaVista === "USD" ? "USD" : "COP"));
  const [mes, setMes] = useState(iniEx ? Number(iniEx.mes) || mesHoy : mesHoy);
  const [nota, setNota] = useState(iniEx?.nota || "");

  const m = Number(monto) || 0;
  const enPesos = extraIngresoEnPesos({ monto: m, moneda }, null, trm);
  const deUnIngreso = modo === "deIngreso" || !!asociarA; // hereda nombre y dueño
  const verAsociar = modo === "nuevo" && ASOCIABLES.has(tipo) && recurrentes.length > 0;
  const listo = m > 0 && (deUnIngreso || !!tipo);
  const extrasAct = ini ? (ini.extras || []).filter((x) => Number(x.año) === año) : [];
  const padre = ini || lista.find((i) => i.id === asociarA);
  const dueño = (owners.find((o) => o.id === (deUnIngreso ? padre?.owner : owner)) || null)?.name;
  const mesL = (x) => (MESES[x - 1]?.l || "").toLowerCase();
  const num = (n) => (deUnIngreso ? "" : `${n}. `);

  const elegirTipo = (v) => {
    const antes = TIPOS.find((t) => t.v === tipo)?.nombre || "";
    if (!nombre.trim() || nombre === antes) setNombre(TIPOS.find((t) => t.v === v)?.nombre || "");
    if (!ASOCIABLES.has(v)) setAsociarA("");
    setTipo(v);
  };
  const cargar = (x) => { setEditId(x.id); setMonto(String(x.monto || "")); setMoneda(x.moneda || "COP"); setMes(Number(x.mes) || mesHoy); setNota(x.nota || ""); };
  const limpiar = () => { setEditId(null); setMonto(""); setNota(""); setMes(mesHoy); };

  const guardar = () => {
    if (!listo) return;
    const datos = { año, mes, monto: m, moneda, nota };
    const campos = { nombre, categoria: tipo, owner };
    let out;
    if (modo === "convertir") out = convertirEnUnicoIngreso(ingresos, conv.id, campos, datos);
    else if (modo === "corregir") out = editarExtraIngreso(ingresos, ini.id, editId, datos, campos);
    else if (modo === "deIngreso") out = editId ? editarExtraIngreso(ingresos, ini.id, editId, datos, null) : registrarExtraIngreso(ingresos, ini.id, datos);
    else if (asociarA) out = registrarExtraIngreso(ingresos, asociarA, datos);
    else out = crearIngresoConExtra(ingresos, { ...campos, fiscalCode: tipo === "Herencia o donación" ? "GO_HERENCIA" : undefined }, datos);
    onGuardar(out);
  };

  const titulo = modo === "convertir" ? tx("Pasarlo a ingreso único", "Make it one-time")
    : modo === "corregir" ? tx("Corregir ingreso único", "Edit one-time income")
    : modo === "deIngreso" ? tx(`Ingresos únicos de ${ini?.nombre || "este ingreso"}`, "One-time incomes")
    : tx("Un solo ingreso (no se repite)", "One-time income");
  const subtitulo = modo === "convertir"
    ? tx(`«${conv?.nombre || "Este ingreso"}» estaba como un ingreso que se repite. Al guardarlo queda una sola vez, en el mes que elijas, y deja de contar en el promedio y en los años siguientes.`, "It will count once, in the month you choose.")
    : modo === "deIngreso"
      ? tx("Lo que entró una vez además de lo de siempre: un bono, una prima, un pago extra.", "Something extra that came in once.")
      : tx("Entra una sola vez: cuenta en su mes y en el total del año, no en tu promedio mensual ni en tu nivel de libertad.", "Counts once, in its month.");

  const lbl = { fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 8, display: "block" };
  const inp = { width: "100%", boxSizing: "border-box", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 15 };
  const chip = (on) => ({ padding: "8px 13px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? T.green : T.border}`, background: on ? "rgba(34,197,94,0.14)" : "transparent", color: on ? T.txt : T.txt2 });
  const paso = { marginBottom: 18 };
  const link = { background: "none", border: "none", padding: 0, color: T.txt3, fontSize: 12, cursor: "pointer", textDecoration: "underline" };
  const aviso = { fontSize: 12, color: T.orange, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 10px", marginTop: 8, lineHeight: 1.5 };
  const mostrarResto = !!tipo || deUnIngreso;

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "22px 24px", width: "min(500px, 100%)", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>{titulo}</div>
        <div style={{ fontSize: 13, color: T.txt3, marginTop: 4, marginBottom: 18, lineHeight: 1.5 }}>{subtitulo}</div>

        {/* Los ingresos únicos que ya tiene este ingreso */}
        {modo === "deIngreso" && extrasAct.length > 0 && (
          <div style={{ ...paso, border: `1px solid ${T.border}`, borderRadius: 10, padding: "2px 12px" }}>
            {extrasAct.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 14 }}>
                <span style={{ color: x.id === editId ? T.txt : T.txt2, fontWeight: x.id === editId ? 700 : 500 }}>
                  {MESES[x.mes - 1]?.l} · {fm(extraIngresoEnPesos(x, ini, trm))}{x.nota ? ` · ${x.nota}` : ""}{x.id === editId ? tx(" · corrigiendo", " · editing") : ""}
                </span>
                <span style={{ display: "flex", gap: 14 }}>
                  {x.id !== editId && <button type="button" onClick={() => cargar(x)} style={link}>{tx("Corregir", "Edit")}</button>}
                  <button type="button" style={link} onClick={() => {
                    if (!confirm(tx("¿Quitar este ingreso único?", "Remove?"))) return;
                    if (x.id === editId) limpiar();
                    onGuardar(eliminarExtraIngreso(ingresos, ini.id, x.id), true);
                  }}>{tx("Quitar", "Remove")}</button>
                </span>
              </div>
            ))}
            <div style={{ padding: "9px 0", fontSize: 12, color: T.txt3 }}>
              {editId ? <button type="button" onClick={limpiar} style={link}>{tx("Mejor agregar otro", "Add another instead")}</button> : tx("Abajo puedes agregar otro.", "Add another below.")}
            </div>
          </div>
        )}

        {/* 1. ¿Qué fue? */}
        {modo !== "deIngreso" && (
          <div style={paso}>
            <label style={lbl}>{tx("1. ¿Qué fue?", "1. What was it?")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TIPOS.map((t) => <button key={t.v} type="button" onClick={() => elegirTipo(t.v)} style={chip(tipo === t.v)}>{t.l}</button>)}
            </div>
            {verAsociar && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, color: T.txt2, marginBottom: 6, display: "block" }}>{tx("¿Es parte de un ingreso que ya tienes? (opcional)", "Part of an income you already have? (optional)")}</label>
                <select value={asociarA} onChange={(e) => setAsociarA(e.target.value)} style={inp}>
                  <option value="">{tx("No, va aparte", "No, separate")}</option>
                  {recurrentes.map((i) => <option key={i.id} value={i.id}>{tx("Sí, de ", "Yes, of ")}{i.nombre || i.categoria}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* 2. Nombre y de quién es */}
        {!deUnIngreso && tipo && (
          <div style={paso}>
            <label style={lbl}>{owners.length > 1 ? tx("2. ¿Cómo se llama y de quién es?", "2. Name and owner") : tx("2. ¿Cómo se llama?", "2. Name")}</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === "Venta de activo" ? tx("Venta del carro", "Car sale") : tx("Ej: Bono de fin de año", "Name")} style={inp} />
            {owners.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {owners.map((o) => <button key={o.id} type="button" onClick={() => setOwner(o.id)} style={chip(owner === o.id)}>{o.name}</button>)}
              </div>
            )}
          </div>
        )}

        {/* 3. ¿Cuánto entró? */}
        {mostrarResto && (
          <div style={paso}>
            <label style={lbl}>{num(3)}{tx("¿Cuánto entró?", "How much?")}</label>
            <NumberInput value={monto} onChange={setMonto} placeholder="0" style={{ ...inp, fontSize: 17, fontWeight: 600 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: T.txt3 }}>{tx("Lo escribiste en:", "Currency:")}</span>
              <button type="button" onClick={() => setMoneda("COP")} style={chip(moneda === "COP")}>{tx("Pesos (COP)", "COP")}</button>
              <button type="button" onClick={() => setMoneda("USD")} style={chip(moneda === "USD")}>{tx("Dólares (USD)", "USD")}</button>
            </div>
            {m > 0 && moneda === "COP" && m < 100000 && (
              <div style={aviso}>{tx(`$${Math.round(m).toLocaleString("es-CO")} pesos es muy poco. ¿Lo escribiste en dólares?`, "Very small in pesos. Dollars?")}{" "}
                <button type="button" onClick={() => setMoneda("USD")} style={{ ...link, color: "#3b82f6", fontWeight: 700 }}>{tx(`Sí, son US$${Math.round(m).toLocaleString("es-CO")}`, "Yes")}</button></div>
            )}
            {m >= 1000000 && moneda === "USD" && (
              <div style={aviso}>{tx(`US$${Math.round(m).toLocaleString("es-CO")} son ${fm(enPesos)} en pesos. ¿Lo escribiste en pesos?`, "That is a lot of dollars. Pesos?")}{" "}
                <button type="button" onClick={() => setMoneda("COP")} style={{ ...link, color: "#3b82f6", fontWeight: 700 }}>{tx(`Sí, son $${Math.round(m).toLocaleString("es-CO")} pesos`, "Yes")}</button></div>
            )}
          </div>
        )}

        {/* 4. ¿En qué mes? */}
        {mostrarResto && (
          <div style={paso}>
            <label style={lbl}>{num(4)}{tx(`¿En qué mes entró? (${año})`, "Which month?")}</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={inp}>
              {MESES.map((x) => <option key={x.v} value={x.v}>{tx(x.l, nombreMes(x.v))}{x.v === mesHoy ? tx(" (este mes)", " (this month)") : ""}</option>)}
            </select>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={tx("Nota (opcional): de quién, por qué…", "Note (optional)")} style={{ ...inp, fontSize: 13, marginTop: 10 }} />
          </div>
        )}

        {/* Resumen en palabras */}
        {m > 0 && mostrarResto && (
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 14, lineHeight: 1.55 }}>
            <div style={{ color: T.txt }}>{tx(`Entra una sola vez, en ${mesL(mes)} de ${año}:`, "Comes in once:")} <strong>{fm(enPesos)}</strong>{dueño ? <span style={{ color: T.txt3 }}>{tx(` · de ${dueño}`, "")}</span> : null}</div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{tx("No se repite: no suma a tu promedio mensual ni a tu nivel de libertad.", "Not recurring.")}</div>
            {!deUnIngreso && tipo === "Herencia o donación" ? (
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{tx(`Impuestos: una herencia se declara como ganancia ocasional${dueño ? ` en la renta de ${dueño}` : ""}. Todavía no se pasa sola al cálculo: regístrala también en Impuestos → «Eventos del año gravable».`, "Inheritance: add it in Taxes too.")}</div>
            ) : (
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{tx("Impuestos todavía no toma este ingreso automáticamente.", "Taxes don't include it automatically yet.")}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCerrar} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>{tx("Cancelar", "Cancel")}</button>
          <button type="button" disabled={!listo} onClick={guardar}
            style={{ background: T.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: listo ? "pointer" : "not-allowed", opacity: listo ? 1 : 0.5 }}>
            {modo === "convertir" ? tx("Guardar como ingreso único", "Save") : tx("Guardar", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
