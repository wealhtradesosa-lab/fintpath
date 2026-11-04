import { useState } from "react";
import { Interruptor, Pencil, Trash2, MenuFila } from "./Iconos.jsx";
import FiltroListado from "./FiltroListado";
import BuscadorLista, { filtrarPorTexto as filtrarDeudas } from "./BuscadorLista";
import { esDelTitular } from "../lib/clasesListado.js";
import { fmtTasaEs } from "../lib/formato.js";
import { fetchAuth } from "../lib/apiFetch";
import Disclaimer from "./Disclaimer";
import { separarPorLimite } from "../lib/limitePlan.js";
import BloqueadosPorPlan from "./BloqueadosPorPlan";
import NumberInput from "./NumberInput";
import { C } from "../lib/designTokens.js";
import SimToggleInfo from "./SimToggleInfo";
import PlanDeudasACero from "./PlanDeudasACero";
import PageHeader from "./PageHeader";
import { exportDeudasExcel } from "../lib/excelExport.js";
import { exportDeudasPDF } from "../lib/pdfSectionExport.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import FrecuenciaSelector from "./FrecuenciaSelector";
import TablaMensual from "./TablaMensual";
import BarraComposicion from "./BarraComposicion";
import { MESES, costoCredito, montoPromedioMensual, cuotaFija, tasaDesdeCuota } from "../lib/flowHelpers.js";
import { tx, esUS, plata, pct as pctR, monedaBase, nombreMes } from "../lib/region.js";

const T = {
  bg2: C.surface, bg3: "var(--fp-raised)",
  card: "var(--fp-card)", border: C.border,
  txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)",
  green: "#00c805", greenDim: "rgba(0,200,5,0.1)",
  red: "#ff5000", redDim: "rgba(255,80,0,0.08)",
  blue: "#3b82f6", orange: "#f59e0b", purple: "#3b82f6",
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("es-CO");
// 3-nov-2026: tasas y porcentajes con el formato del país de la sesión (region.js).
// En Colombia quedan idénticos (es-CO).
const tasaFmt = (v) => (esUS() ? (v === "" || v == null ? "" : Number.isFinite(Number(v)) ? Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%" : String(v) + "%") : fmtTasaEs(v));
// Etiqueta de la tasa: E.A. (efectiva anual) en Colombia, APR en EE. UU.
const etqTasa = () => (esUS() ? "APR" : "E.A.");

// 3-nov-2026 — Tipos de deuda por país. Las claves guardadas no cambian: las de
// Colombia (loan, vehiculo, leasing…) y las que ya guardó la pantalla vieja de
// EE. UU. (heloc, student_loan, auto, other_debt…) se reconocen en las dos.
const TIPO_CO = {
  mortgage: ["Hipoteca", "Mortgage"], loan: ["Libre inversión", "Consumer loan"], vehiculo: ["Vehículo", "Auto loan"],
  leasing: ["Leasing", "Leasing"], personal: ["Préstamo personal", "Loan from family or friends"],
  credit_card: ["Tarjeta", "Credit card"], tarjeta: ["Tarjeta", "Credit card"], card: ["Tarjeta", "Credit card"],
  saldo_pendiente: ["Saldo pendiente", "Outstanding balance"],
};
const TIPO_US = {
  mortgage: ["Hipoteca", "Mortgage"], heloc: ["HELOC", "HELOC"], student_loan: ["Crédito estudiantil", "Student loan"],
  auto: ["Crédito de vehículo", "Auto loan"], vehiculo: ["Crédito de vehículo", "Auto loan"],
  credit_card: ["Tarjeta de crédito", "Credit card"], tarjeta: ["Tarjeta de crédito", "Credit card"], card: ["Tarjeta de crédito", "Credit card"],
  loan: ["Préstamo personal", "Personal loan"], personal: ["Préstamo de familia o amigos", "Loan from family or friends"],
  business_loan: ["Crédito de negocio", "Business loan"], investment_margin: ["Préstamo de margen", "Margin loan"],
  other_debt: ["Otra deuda", "Other debt"], leasing: ["Leasing", "Lease"], saldo_pendiente: ["Saldo pendiente", "Outstanding balance"],
};
const nombreTipo = (tp) => { const t = (esUS() ? TIPO_US : TIPO_CO)[tp] || (esUS() ? null : TIPO_US[tp]); return t ? tx(t[0], t[1]) : null; };
const OTRO = () => tx("Otro", "Other");
const opcionesTipo = () => esUS() ? [
  { v: "mortgage", l: tx("Hipoteca — vivienda o inmueble", "Mortgage — home or property") },
  { v: "heloc", l: tx("HELOC — crédito sobre el valor de tu casa", "HELOC / home equity loan") },
  { v: "auto", l: tx("Crédito de vehículo", "Auto loan") },
  { v: "student_loan", l: tx("Crédito estudiantil", "Student loan") },
  { v: "credit_card", l: tx("Tarjeta de crédito", "Credit card") },
  { v: "loan", l: tx("Préstamo personal — banco o prestamista", "Personal loan — bank or online lender") },
  { v: "personal", l: tx("Préstamo de familia, socio o conocido", "Loan from family, a partner or a friend") },
  { v: "business_loan", l: tx("Crédito de negocio", "Business loan") },
  { v: "investment_margin", l: tx("Préstamo de margen (bróker)", "Margin loan (brokerage)") },
  { v: "other_debt", l: tx("Otra deuda", "Other debt") },
  { v: "saldo_pendiente", l: tx("Saldo pendiente — sin intereses, un solo pago", "Outstanding balance — no interest, one payment") },
] : [
  { v: "mortgage", l: tx("Hipoteca — vivienda o inmueble", "Mortgage — home or property") },
  { v: "loan", l: tx("Libre inversión — crédito de consumo", "Consumer loan") },
  { v: "vehiculo", l: tx("Vehículo", "Auto loan") },
  { v: "leasing", l: tx("Leasing", "Leasing") },
  { v: "personal", l: tx("Préstamo personal — familiar, socio, conocido", "Loan from family, a partner or a friend") },
  { v: "credit_card", l: tx("Tarjeta de crédito", "Credit card") },
  { v: "saldo_pendiente", l: tx("Saldo pendiente — sin intereses, un solo pago", "Outstanding balance — no interest, one payment") },
];

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.txt3, letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function DeudasModule({ deudas, owners, inversiones, onUpdate, fmt, onImport, user, plan, onUpgrade, trm, cashFlow = 0, onExtraADeudasChange }) {
  const MESES_NOM = Array.from({ length: 12 }, (_, i) => tx(nombreMes(i + 1).toLowerCase(), nombreMes(i + 1)));

  // 3-nov-2026: en EE. UU. la cifra sale en dólares con formato de EE. UU. (region.js);
  // en Colombia sigue el formateador que pasa App.
  const fm = esUS() ? plata : (fmt || _fm);
  // Fase 3 commit 6: gating reader.
  const { role } = useRole();
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);

  const scanImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setScanning(true);
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = ev.target.result.split(",")[1];
          const mediaType = file.type || "image/jpeg";
          const res = await fetchAuth("/.netlify/functions/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64, type: "deuda", mediaType, userId: user?.id })
          });
          const data = await res.json();
          if (data.success && data.data) {
            const d = data.data;
            const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
            const leido = { n: d.nombre || null, mt: num(d.saldo), pg: num(d.cuota), ts: num(d.tasa), tp: d.tipo || null };
            const cap = num(d.abonoCapital), int = num(d.interesesMes);
            setForm(p => ({
              ...p,
              n: leido.n ?? p.n,
              mt: leido.mt ?? p.mt,
              pg: leido.pg ?? p.pg,
              ts: leido.ts ?? p.ts,
              tp: leido.tp ?? p.tp,
              capExt: cap != null ? String(cap) : (p.capExt || ""),
              intExt: int != null ? String(int) : (p.intExt || ""),
            }));
            setShowForm(true);
            // Mostrar QUÉ se leyó y qué NO. Sin esto, los campos que la IA no
            // pudo leer conservan el valor anterior y parece que los llenó el
            // escaneo (reportado por Santiago: tasa vieja 40,6 que no estaba
            // en el extracto).
            const cop = (v) => (esUS() ? plata(v) : "$" + Number(v).toLocaleString("es-CO"));
            const ok = [];
            const falta = [];
            leido.n  ? ok.push(tx("Nombre: ", "Name: ") + leido.n)        : falta.push(tx("nombre", "name"));
            leido.mt ? ok.push(tx("Saldo: ", "Balance: ") + cop(leido.mt))   : falta.push(tx("saldo", "balance"));
            leido.pg ? ok.push(tx("Cuota: ", "Payment: ") + cop(leido.pg))   : falta.push(tx("cuota", "payment"));
            leido.ts ? ok.push(tx("Tasa: ", "Rate: ") +tasaFmt(leido.ts)+" "+etqTasa()) : falta.push(tx("tasa", "rate"));
            alert(
              tx("Documento leído", "Document read") + (d.confianza === "alta" ? "" : tx(" (confianza " + (d.confianza || "media") + " — revisa los datos)", " (" + ({ media: "medium", baja: "low" }[d.confianza] || d.confianza || "medium") + " confidence — check the fields)")) +
              "\n\n" + ok.join("\n") +
              (falta.length ? tx("\n\nNo pude leer: ", "\n\nCouldn't read: ") + falta.join(", ") + tx(".\nEsos campos conservan el valor que ya tenías — revísalos a mano.", ".\nThose fields keep their previous value — check them by hand.") : "")
            );
          } else {
            const det = data.error || data.errorMessage || "";
            const esTimeout = /timed out|timeout/i.test(det);
            alert(esTimeout
              ? tx("El documento tardó demasiado en procesarse. Prueba de nuevo, o sube una foto/captura de la página del extracto (pesa menos y se lee más rápido).", "The document took too long to process. Try again, or upload a photo/screenshot of the statement page (smaller and faster to read).")
              : tx("No se pudo leer el documento.", "Couldn't read the document.") + (det ? tx("\n\nDetalle: ", "\n\nDetails: ") + det : "") + tx("\n\nSi es una foto, prueba una más clara; si es un PDF, que no supere ~4 MB y no esté protegido con contraseña.", "\n\nIf it's a photo, try a sharper one; if it's a PDF, keep it under ~4 MB and without a password."));
          }
          setScanning(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        alert(tx("Error: ", "Error: ") + err.message);
        setScanning(false);
      }
    };
    input.click();
  };
  const [editId, setEditId] = useState(null);
  const [cerrados, setCerrados] = useState({}); // 31-oct-2026: grupos colapsables
  const [busqueda, setBusqueda] = useState("");
  const [titularFiltro, setTitularFiltro] = useState("");
  const [form, setForm] = useState({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "", capExt: "", intExt: "", frecuencia: "mensual", montosMensuales: new Array(12).fill(0) });
  // Commit 5 Tarea 3: confirmaciones del Art. 119 ET cuando el usuario marca
  // una deuda como vivienda habitacional. Es solo UI — no se persiste al item
  // ni se envía al motor. Sirve para alertar al usuario si está clasificando
  // mal una deuda (uno de los errores fiscales más comunes).
  const [viviendaConfirmaciones, setViviendaConfirmaciones] = useState({
    esHabitacion: true,
    esTitular: true,
    noArrendado: true,
  });

  const items = deudas || [];
  // Una deuda pagada no es una deuda: sale de los totales igual que una
  // apagada, pero conserva su registro y su histórico del año.
  const activos = items.filter((d) => d.sim !== false && d.pagada !== true);
  // 26-jul-2026 (Santiago): mismo agrupamiento que Gastos e Ingresos. Acá el
  // criterio es el TIPO de crédito y el subtotal es el SALDO, no la cuota:
  // la pregunta en deudas es dónde está concentrado el pasivo.
  // 3-nov-2026: nombre del tipo según país e idioma (TIPO_CO / TIPO_US arriba).
  const NOM_TP = Object.fromEntries(Object.keys({ ...TIPO_CO, ...TIPO_US }).map((k) => [k, nombreTipo(k)]).filter(([, v]) => v));
  const conEncabezados = (lista) => {
    const porTipo = {};
    lista.filter((d) => esDelTitular(d, titularFiltro, owners)).forEach(d => { const k = NOM_TP[d.tp] || OTRO(); (porTipo[k] = porTipo[k] || []).push(d); });
    const grupos = Object.entries(porTipo)
      .map(([tipo, its]) => ({ tipo, items: its,
        sub: its.filter(d => d.sim !== false)
               .reduce((s, d) => s + (d.mt || 0) * (d.moneda === "USD" ? (trm || 4200) : 1), 0) }))
      .sort((a, b) => b.sub - a.sub);
    const tot = grupos.reduce((s, g) => s + g.sub, 0);
    return grupos.flatMap(gr => [
      { __cat: `${({ Hipoteca: "", "Vehículo": "", "Libre inversión": "", Leasing: "", "Préstamo personal": "", Tarjeta: "", "Saldo pendiente": "" })[gr.tipo] || ""} ${gr.tipo}`, __sub: gr.sub, __n: gr.items.length,
        __pct: tot > 0 ? (gr.sub / tot) * 100 : 0, id: "__h_" + gr.tipo },
      ...((!!busqueda.trim()) || !cerrados["__h_" + (gr.cat ?? gr.tipo)] ? [...gr.items].sort((a, b) => (b.mt || 0) - (a.mt || 0)) : []),
    ]);
  };
  const totalDeuda = activos.reduce((s, d) => s + (d.mt || 0), 0);
  const totalCuotas = activos.reduce((s, d) => s + montoPromedioMensual({ ...d, mensual: d.pg || 0 }), 0)
  // 26-jul-2026 (Santiago: "deudas: valor total, valor pago mensual y valor de
  // intereses anuales"). Los intereses son EL costo real de la deuda y no se
  // mostraban en ninguna parte del módulo: se veía el saldo y la cuota, pero
  // no cuánto se paga por tener ese dinero prestado.
  // Se calcula sobre el saldo con la tasa E.A. de cada crédito. Es el interés
  // del PRIMER año: como el saldo baja con cada abono a capital, en años
  // siguientes será menor. Se declara así en el pie para no dar por exacto un
  // número que es una referencia.
  const interesAnual = activos.reduce((s, d) => s + (d.mt || 0) * ((Number(d.ts) || 0) / 100), 0);
  const totalInteresAnual = activos.reduce((s, d) => s + costoCredito(d).interesAnual, 0);

  // 27-sep-2026 (Santiago: "no le veo uso a seleccionar todos los items").
  // Se quitó la selección múltiple: servía solo para borrar en lote, la app
  // no tiene deshacer ni papelera, y marcar todo de un clic pegado a un botón
  // de eliminar era riesgo sin beneficio. Queda el borrado fila por fila.

  const handleSave = () => {
    if (!guardEdit(role)) return;
    // Commit 5 Tarea 3 (bugfix): persistir fiscalCode al guardar. Antes el campo
    // se omitía y el motor caía al default vía normalizer, ignorando la elección
    // del usuario en el sub-selector "¿Para qué usaste esta deuda?".
    const item = { n: form.n || "", tp: form.tp || "loan", fiscalCode: form.fiscalCode || "DEU_NAT_CONSUMO", mt: +form.mt || 0, pg: form.tipoInteres === "sin_interes" ? 0 : +form.pg || 0, ts: form.tipoInteres === "sin_interes" ? 0 : +form.ts || 0, tipoInteres: form.tipoInteres || undefined, pagoUnicoAnio: form.tipoInteres === "sin_interes" && form.pagoUnicoAnio ? Number(form.pagoUnicoAnio) : undefined, plazoMeses: form.plazoMeses ? Number(form.plazoMeses) : undefined, moneda: form.moneda || undefined, la: form.la || null, owner: form.owner || "",
      // Vigencia de la deuda (20-jul-2026, Santiago): "las deudas también
      // pueden ser hasta X mes" — cuotas solo pesan dentro del rango.
      // 25-jul-2026 (Santiago: "he modificado meses o todo el año y no guarda
      // el cambio"). BUG: estos campos se incluían con spread condicional, así
      // que al volver al valor por defecto NO entraban en el objeto. Y como al
      // editar se hace {...deudaVieja, ...item}, el valor anterior sobrevivía:
      // una vez puesta una vigencia era IMPOSIBLE quitarla desde la interfaz.
      // Ahora las claves van SIEMPRE. `undefined` las borra al serializar a
      // JSON, así que el dato queda limpio igual que antes, pero el cambio a
      // "todo el año" ahora sí pisa el valor viejo.
      desdeMes: (Number(form.desdeMes) || 1) !== 1 ? Number(form.desdeMes) : undefined,
      hastaMes: (Number(form.hastaMes) || 12) !== 12 ? Number(form.hastaMes) : undefined,
      vigenciaModo: form.vigenciaModo || undefined,
      frecuencia: (form.frecuencia && form.frecuencia !== "mensual") ? form.frecuencia : undefined,
      montosMensuales: form.frecuencia === "variable" ? form.montosMensuales : undefined,
    };
    if (editId) {
      onUpdate(items.map((i) => (i.id === editId ? { ...i, ...item } : i)));
    } else {
      item.id = "d_" + Date.now();
      onUpdate([...items, item]);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "", capExt: "", intExt: "", frecuencia: "mensual", montosMensuales: new Array(12).fill(0), desdeMes: 1, hastaMes: 12, vigenciaModo: undefined });
    setViviendaConfirmaciones({ esHabitacion: true, esTitular: true, noArrendado: true });
  };

  const openEdit = (d) => {
    setForm({ n: d.n, tp: d.tp, fiscalCode: d.fiscalCode || (d.tp === "mortgage" ? "DEU_NAT_VIVIENDA_HABITACIONAL" : "DEU_NAT_CONSUMO"), mt: d.mt, pg: d.pg, ts: d.ts, tipoInteres: d.tipoInteres || "compuesto", pagoUnicoAnio: d.pagoUnicoAnio || "", plazoMeses: d.plazoMeses || "", moneda: d.moneda || (esUS() ? monedaBase() : "COP"), la: d.la || "", owner: d.owner || "", capExt: "", intExt: "", desdeMes: Number(d.desdeMes) || 1, hastaMes: Number(d.hastaMes) || 12, vigenciaModo: d.vigenciaModo , frecuencia: d.frecuencia || "mensual", montosMensuales: Array.isArray(d.montosMensuales) ? d.montosMensuales : new Array(12).fill(0)});
    setEditId(d.id);
    setShowForm(true);
  };

  // Set de IDs de deudas sin propietario asignado, para badges en rows.
  const deudasSinOwnerIds = new Set((deudas || []).filter(d => !d.owner || d.owner === "").map(d => d.id));

  return (
    <div>
      <PageHeader
        label={tx("Deudas", "Debts")}
        title={tx("Lo que debes", "What you owe")}
        subtitle={`${activos.length}${activos.length !== items.length ? tx(` de ${items.length}`, ` of ${items.length}`) : ""} ${tx("deuda", "debt")}${activos.length !== 1 ? "s" : ""} · ${tx("Saldo", "Balance")}: ${fm(totalDeuda)} · ${tx("Cuotas", "Payments")}: ${fm(totalCuotas)}${tx("/mes", "/mo")}`}
        rightSlot={<>
          {onImport && <button onClick={onImport}
            title={tx("Cargar deudas desde una tabla de Excel", "Load debts from an Excel sheet")}
            style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            {tx("Subir Excel", "Upload Excel")}
          </button>}
          <button onClick={() => exportDeudasExcel(activos, inversiones, owners, trm)}
            title={tx("Bajar Excel: detalle de deudas + vinculación con activos", "Download Excel: debt detail + linked assets")}
            style={{ background: "transparent", color: "var(--fp-txt)", border: "1px solid rgba(var(--fp-ink),0.15)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            {tx("Bajar Excel", "Download Excel")}
          </button>
          <button onClick={() => exportDeudasPDF(activos, inversiones, owners, trm)}
            title={tx("Bajar PDF: saldos, tasas y orden sugerido de pago", "Download PDF: balances, rates and suggested payoff order")}
            style={{ background: "transparent", color: "var(--fp-txt)", border: "1px solid rgba(var(--fp-ink),0.15)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            {tx("Bajar PDF", "Download PDF")}
          </button>
          <button onClick={() => { setEditId(null); setForm({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "", capExt: "", intExt: "", desdeMes: 1, hastaMes: 12, vigenciaModo: undefined }); setShowForm(true); }}
            style={{ background: "#00c805", color: "#000", border: "none", padding: "10px 22px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{tx("+ Agregar", "+ Add")}</button>
        </>}
      />

      {/* Banner contextual: deudas sin propietario o sin clasificación fiscal explícita.
          Items sin owner no se atribuyen a una persona/empresa para el cálculo de
          intereses deducibles, lo que afecta el cálculo de Impuestos. */}
      {(() => {
        if (!user) return null;
        // 3-nov-2026: en EE. UU. el propietario no cambia el impuesto (el motor de
        // EE. UU. no deduce intereses), así que el aviso no aplica.
        if (esUS()) return null;
        const sinOwner = (deudas || []).filter(d => !d.owner || d.owner === "");
        if (sinOwner.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}></span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
                {sinOwner.length} {tx("deuda", "debt")}{sinOwner.length !== 1 ? "s" : ""} {tx("sin propietario asignado", "without an owner")}
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
              {tx("Sin propietario, los intereses no se deducen de ningún owner en el cálculo de Impuestos.", "Without an owner, the interest isn't deducted for anyone in the tax estimate.")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sinOwner.slice(0, 6).map((d, idx) => (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(var(--fp-hundir),0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#ff5000", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.n || tx("(sin nombre)", "(no name)")} <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· {tx("saldo", "balance")} {fm(d.mt || 0)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>{tx("Asígnale un propietario para que los intereses se deduzcan correctamente", "Assign an owner so the interest is deducted correctly")}</div>
                  </div>
                  <button onClick={() => openEdit(d)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: "#00c805", cursor: "pointer", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    {tx("Editar →", "Edit →")}
                  </button>
                </div>
              ))}
              {sinOwner.length > 6 && (
                <div style={{ fontSize: 11, color: T.txt3, textAlign: "center", padding: "4px 0" }}>+ {sinOwner.length - 6} {tx("más", "more")}</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner explicando toggle sim (Commit 8.8) — SimToggleInfo más abajo */}

      {/* Gancho (23-jul-2026, idea Santiago): cuánto sangran los intereses al año.
          Solo si hay deuda con tasa. Ver el número anual mueve más que el saldo. */}
      {totalInteresAnual > 0 && (
        <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(255,80,0,0.06)", border: "1px solid rgba(255,80,0,0.22)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22 }}></span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: T.txt2 }}>{tx("Estás pagando en intereses, al ritmo de hoy", "You're paying in interest, at today's pace")}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.red, fontFamily: "monospace", lineHeight: 1.2 }}>{fm(totalInteresAnual)}<span style={{ fontSize: 13, color: T.txt3, fontWeight: 600 }}>{tx(" /año", " /yr")}</span></div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>≈ {fm(Math.round(totalInteresAnual / 12))}{tx("/mes que se van solo en interés, sin bajar deuda. Pagar primero la de mayor tasa (avalancha) es lo que más ahorra.", "/mo goes to interest alone, without lowering the debt. Paying the highest rate first (avalanche) saves the most.")}</div>
          </div>
        </div>
      )}

      <SimToggleInfo total={items.length} activos={activos.length} moduloNombre={tx("una deuda", "a debt")} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: tx("Deuda total", "Total debt"), v: fm(totalDeuda), c: T.txt },
          { l: tx("Cuotas al mes", "Monthly payments"), v: fm(totalCuotas), c: T.txt },
          { l: tx("Cuotas al año", "Yearly payments"), v: fm(totalCuotas * 12), c: T.txt },
          { l: tx("Intereses al año", "Interest per year"), v: interesAnual > 0 ? fm(interesAnual) : "—", c: "#ff5000" },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: T.txt3, fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 26-jul-2026 (Santiago): barra por tipo de crédito. En deudas la
          proporción que importa es del SALDO, no de la cuota: es lo que dice
          dónde está concentrado el pasivo. */}
      {(() => {
        // 26-jul-2026 (Santiago: "las deudas también puede clasificarlas por libre
        // inversión, hipotecas, leasing o préstamos personales según el tipo").
        // "Préstamo" no decía nada cuando las cuatro opciones eran préstamos, y
        // "Personal" era ambiguo: podía leerse "para uso personal" o "me lo
        // prestó una persona". Los nombres nuevos dicen QUIÉN prestó y bajo qué
        // figura, que es lo único que este campo necesita distinguir.
        // Los valores viejos se mantienen para no romper lo ya cargado.
        const NOM = NOM_TP;
        const grupos = {};
        (items || []).filter(d => d.sim !== false && (d.mt || 0) > 0).forEach(d => {
          const k = NOM[d.tp] || OTRO();
          grupos[k] = (grupos[k] || 0) + (d.mt || 0) * (d.moneda === "USD" ? (trm || 4200) : 1);
        });
        const datos = Object.entries(grupos).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
        // 26-jul-2026 — ANTES: si había un solo tipo, la barra no aparecía y
        // parecía que la función no existía. Santiago reportó tres veces que
        // "deudas no está organizada" teniendo el código desplegado: sus
        // deudas están todas cargadas con el mismo tp, así que se formaba un
        // único grupo y no había nada que comparar.
        // Una función que solo se ve si los datos están bien clasificados es
        // invisible para quien no los clasificó. Ahora, en ese caso, se
        // explica QUÉ FALTA en vez de no mostrar nada.
        if (datos.length < 2) return (
          <div style={{ marginBottom: 16, background: "rgba(245,158,11,0.07)", border: "1px dashed rgba(245,158,11,0.35)",
                        borderRadius: 10, padding: "12px 14px", fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
            <strong>{tx("Asigna el tipo a cada deuda", "Set the type of each debt")}</strong>{tx(" para ver cómo se reparte tu pasivo.", " to see how your debt is split.")}
            <span style={{ color: T.txt3 }}>{esUS()
              ? tx(" Edita cada una y elige Hipoteca, Crédito de vehículo, Crédito estudiantil, Tarjeta de crédito o Préstamo personal. Con dos o más tipos aparece la barra de distribución.", " Edit each one and choose Mortgage, Auto loan, Student loan, Credit card or Personal loan. With two or more types the breakdown bar appears.")
              : tx(` Edita cada una y elige Hipoteca, Libre inversión, Vehículo, Leasing,
            Préstamo personal o Tarjeta. Con dos o más tipos aparece la barra de distribución.`, " Edit each one and choose Mortgage, Consumer loan, Auto loan, Leasing, Loan from family or friends, or Credit card. With two or more types the breakdown bar appears.")}</span>
          </div>
        );
        const tot = datos.reduce((s, d) => s + d.value, 0);
        const PAL = ["#ff5000","#f59e0b","#64748b","#94a3b8","#475569","#b4bfcc"];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>{tx("DÓNDE ESTÁ TU DEUDA", "WHERE YOUR DEBT IS")}</div>
            <BarraComposicion datos={datos} total={tot} paleta={PAL} T={T} altura={44} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
              {[...datos].sort((a,b)=>b.value-a.value).map((d, i) => (
                <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: T.txt2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: PAL[i % PAL.length], flexShrink: 0 }} />
                  {d.name} <strong style={{ color: T.txt2, fontFamily: "monospace" }}>{pctR(((d.value/tot)*100), 0)}</strong>
                </span>
              ))}
            </div>
          </div>
        );
      })()}
      {items.length > 0 && <BuscadorLista valor={busqueda} onChange={setBusqueda} T={T} total={items.length} filtrados={filtrarDeudas(items, busqueda, ["n", "nombre"]).length} placeholder={tx("Buscar deuda…", "Search debts…")} />}
      {items.length > 0 && <FiltroListado owners={owners || []} titular={titularFiltro} onTitular={setTitularFiltro} T={T}
        hayCerrados={Object.values(cerrados).some(Boolean)} onAlternar={() => setCerrados(Object.values(cerrados).some(Boolean) ? {} : Object.fromEntries([...new Set(Object.values(NOM_TP)), OTRO()].map((k) => ["__h_" + k, true])))} />}
      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: T.txt }}>
            <thead>
              <tr>
                {["Deuda", "Tipo", "Saldo", "Cuota", "Tasa", "Interés/año", "Activo", "On/Off", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: ["Deuda", "Activo", ""].includes(h) ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${T.border}` }}>{tx(h, { Deuda: "Debt", Tipo: "Type", Saldo: "Balance", Cuota: "Payment", Tasa: esUS() ? "APR" : "Rate", "Interés/año": "Interest/yr", Activo: "Asset", "On/Off": "On/Off", "": "" }[h])}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 0 }}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}></div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"var(--fp-txt)"}}>{tx("Registra tus deudas y créditos", "Add your debts and loans")}</h3>
                      <p style={{fontSize:13,color:"var(--fp-txt3)",maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>{esUS() ? tx("Hipotecas, préstamos, tarjetas de crédito, créditos estudiantiles. Incluye ", "Mortgages, loans, credit cards, student loans. Include ") : tx("Hipotecas, préstamos, tarjetas de crédito, leasing. Incluye ", "Mortgages, loans, credit cards, leasing. Include ")}<strong style={{color:"var(--fp-txt2)"}}>{tx("saldo pendiente, cuota mensual y tasa de interés", "balance, monthly payment and interest rate")}</strong>{tx(". Puedes vincular cada deuda al activo que financia.", ". You can link each debt to the asset it finances.")}</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={()=>setShowForm(true)} style={{background:"#00c805",color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>{tx("+ Agregar deuda", "+ Add debt")}</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>{tx("Subir tabla Excel de deudas", "Upload a debts Excel sheet")}</button>}
                      </div>
                      <div style={{background:"var(--fp-raised)",borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--fp-txt3)",marginBottom:8,letterSpacing:1}}>{tx("Ejemplo de Excel para importar", "Sample Excel to import")}</div>
                        <table style={{width:"100%",fontSize:12,color:"var(--fp-txt2)"}}>
                          <thead><tr style={{borderBottom:"1px solid rgba(var(--fp-ink),0.06)"}}><th style={{padding:"4px 8px",textAlign:"left",color:"var(--fp-txt3)"}}>{tx("Deuda", "Debt")}</th><th style={{textAlign:"right",padding:"4px 8px",color:"var(--fp-txt3)"}}>{tx("Saldo", "Balance")}</th><th style={{textAlign:"right",padding:"4px 8px",color:"var(--fp-txt3)"}}>{tx("Cuota/mes", "Payment/mo")}</th><th style={{textAlign:"right",padding:"4px 8px",color:"var(--fp-txt3)"}}>{tx("Tasa", esUS() ? "APR" : "Rate")}</th></tr></thead>
                          <tbody>
                            {esUS() ? <>
                            <tr><td style={{padding:"4px 8px"}}>{tx("Hipoteca casa", "Home mortgage")}</td><td style={{textAlign:"right",padding:"4px 8px"}}>$320,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>$2,100</td><td style={{textAlign:"right",padding:"4px 8px"}}>6.5%</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>{tx("Crédito de vehículo", "Auto loan")}</td><td style={{textAlign:"right",padding:"4px 8px"}}>$24,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>$520</td><td style={{textAlign:"right",padding:"4px 8px"}}>7.9%</td></tr>
                            </> : <>
                            <tr><td style={{padding:"4px 8px"}}>{tx("Hipoteca apto", "Apartment mortgage")}</td><td style={{textAlign:"right",padding:"4px 8px"}}>$380M</td><td style={{textAlign:"right",padding:"4px 8px"}}>$4,800,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>12%</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>{tx("Préstamo vehículo", "Auto loan")}</td><td style={{textAlign:"right",padding:"4px 8px"}}>$45M</td><td style={{textAlign:"right",padding:"4px 8px"}}>$1,200,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>18%</td></tr>
                            </>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
              ) : conEncabezados(filtrarDeudas(separarPorLimite(items, plan).visibles, busqueda, ["n", "nombre"])).map((d) => {
                  if (d.__cat) return (
                    <tr key={d.id} onClick={() => setCerrados((c) => ({ ...c, [d.id]: !c[d.id] }))} title={cerrados[d.id] ? tx("Ver los ítems", "Show items") : tx("Ocultar los ítems", "Hide items")} style={{ background: T.bg3, cursor: "pointer" }}>
                      <td colSpan={10} style={{ padding: "9px 14px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>
                            <span style={{ color: T.txt3, marginRight: 6, display: "inline-block", width: 10 }}>{cerrados[d.id] ? "▸" : "▾"}</span>{d.__cat} <span style={{ color: T.txt3, fontWeight: 500 }}>· {d.__n}</span>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.red, fontFamily: "monospace" }}>
                            {fm(d.__sub)}
                            <span style={{ color: T.txt3, fontWeight: 500, marginLeft: 6 }}>{pctR(d.__pct, 0)}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                const lk = d.la ? (inversiones || []).find((i) => i.id === d.la) : null;
                return (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, background: "transparent" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{fontWeight: 600, display: "flex", alignItems: "center", gap: 6}}>
                        {!esUS() && deudasSinOwnerIds.has(d.id) && (
                          <span
                            onClick={() => openEdit(d)}
                            title={tx("Sin propietario asignado — los intereses no se deducen del cálculo de Impuestos", "No owner assigned — the interest isn't deducted in the tax estimate")}
                            style={{ fontSize: 13, cursor: "pointer", color: "#ff5000", flexShrink: 0 }}
                          ></span>
                        )}
                        <span style={d.pagada ? { textDecoration: "line-through", opacity: 0.65 } : undefined}>{d.n}</span>
                        {d.pagada && (
                          <span title={d.pagadaEl ? tx(`Saldada el ${d.pagadaEl}`, `Paid off on ${d.pagadaEl}`) : tx("Saldada", "Paid off")}
                            style={{ marginLeft: 7, background: "rgba(0,200,5,0.15)", color: T.green,
                              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                              whiteSpace: "nowrap" }}>
                            {tx("✓ PAGADA", "✓ PAID")}{d.pagadaMes ? ` · ${MESES_NOM[d.pagadaMes - 1]}` : ""}
                          </span>
                        )}
                        {/* Badge vigencia (20-jul-2026): deuda con rango limitado */}
                        {((Number(d.desdeMes) || 1) !== 1 || (Number(d.hastaMes) || 12) !== 12) && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "2px 8px", borderRadius: 10, marginLeft: 6 }}>
                            {tx(MESES.find(m => m.v === (Number(d.desdeMes) || 1))?.l.slice(0,3), nombreMes(Number(d.desdeMes) || 1, true))}–{tx(MESES.find(m => m.v === (Number(d.hastaMes) || 12))?.l.slice(0,3), nombreMes(Number(d.hastaMes) || 12, true))} · {(Number(d.hastaMes) || 12) - (Number(d.desdeMes) || 1) + 1} {tx("meses", "months")}
                          </span>
                        )}
                      </div>
                      {(()=>{
                        if(!d.owner || d.owner==="") return null;
                        if(d.owner==="na") return <div style={{fontSize:11,color:"var(--fp-txt3)",marginTop:2}}>N/A</div>;
                        if(d.owner==="own_1") return <div style={{fontSize:11,color:"var(--fp-txt3)",marginTop:2}}>Personal</div>;
                        const ow=(owners||[]).find(o=>o.id===d.owner);
                        return ow ? <div style={{fontSize:11,color:"var(--fp-txt3)",marginTop:2}}>{ow.type==="juridica"?"":""} {ow.name}</div> : null;
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{ background: T.orange + "15", color: T.orange, fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }}>{esUS() ? (nombreTipo(d.tp) || d.tp) : (tx({ mortgage: "Hipoteca", vehiculo: "Vehículo", loan: "Libre inversión", card: "Tarjeta", tarjeta: "Tarjeta", leasing: "Leasing" }[d.tp], nombreTipo(d.tp)) || d.tp)}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: T.txt, whiteSpace: "nowrap" }}>{fm(d.mt)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>{fm(d.pg)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{tasaFmt(d.ts)}</td>
                    {(() => {
                      const cc = costoCredito(d);
                      return (
                        <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}
                          title={cc.meses != null && !cc.noAmortiza ? tx(`Cuota: ${fm(cc.interesMes)} de interés y ${fm(cc.capitalMes)} de capital (${Math.round(cc.pctCapital)}% baja la deuda).${cc.interesTotal > 0 ? ` Interés que falta pagar: ${fm(cc.interesTotal)}.` : ""}`, `Payment: ${fm(cc.interesMes)} interest and ${fm(cc.capitalMes)} principal (${Math.round(cc.pctCapital)}% lowers the debt).${cc.interesTotal > 0 ? ` Interest left to pay: ${fm(cc.interesTotal)}.` : ""}`) : undefined}>
                          {/* 31-oct-2026 (crítica de diseño): una cifra y una línea; el desglose, al pasar el mouse. */}
                          <div style={{ fontWeight: 600, color: "#ff5000" }}>{fm(cc.interesAnual)}</div>
                          {cc.noAmortiza
                            ? <div style={{ fontSize: 12, color: "#ff5000", marginTop: 2 }}>{tx("la cuota no cubre el interés", "payment doesn't cover the interest")}</div>
                            : cc.meses != null && <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{tx("termina en ", "ends in ")}{cc.meses >= 12 ? tx(`${Math.floor(cc.meses / 12)} a ${cc.meses % 12} m`, `${Math.floor(cc.meses / 12)} y ${cc.meses % 12} m`) : `${cc.meses} m`}</div>}
                        </td>
                      );
                    })()}
                    <td style={{ padding: "10px 14px" }}>{lk ? <span style={{ background: T.blue + "15", color: T.blue, fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999 }}>{lk.n || lk.nombre || lk.name || "—"}</span> : <span style={{ color: T.txt3 }}>—</span>}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => { if (!guardEdit(role)) return; onUpdate(deudas.map(x => x.id===d.id ? {...x, sim: !(d.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={d.sim===false?tx("Mostrar", "Show"):tx("Ocultar", "Hide")}><Interruptor on={d.sim!==false} /></button>
                      {/* 15-sep-2026 (Santiago: "ya pagué una deuda que era un
                          crédito de Bancolombia, ¿debería borrarla o que quede
                          ahí para uno ver el año cómo quedó?" y después "no
                          queda muy claro qué hacer cuando se paga un crédito").
                          El modelo solo ofrecía apagar el toggle o borrar, y
                          ninguna de las dos dice "la pagué". Son tres estados
                          distintos: activa, PAGADA -- que es historia y buena
                          noticia -- y borrada, que es un error de captura.
                          Al marcarla pagada se cierra la vigencia en el mes
                          actual, así el histórico del año se conserva (las
                          cuotas que sí pagó siguen contando de enero a ese mes)
                          y deja de restar hacia adelante. Borrarla haría que la
                          plataforma dijera que tuvo más plata disponible en
                          meses donde realmente estaba pagando. */}
                      {/* 16-sep-2026 (Santiago, viendo la lista: "el botón
                          pagada no es cuando ya se pagó todo?"). Estaba en lo
                          cierto al confundirse: el botón se dibujaba como un
                          chip verde con ✓ y la palabra "Pagada", que es
                          exactamente el lenguaje visual de un ESTADO. Aparecía
                          en todas las deudas activas, así que la lista entera
                          parecía saldada.
                          Ahora dice "Marcar pagada" -- un verbo, no un estado --
                          y usa estilo neutro de acción. El verde con ✓ queda
                          reservado para el chip que sí indica estado, junto al
                          nombre de la deuda. */}
                      {d.pagada !== true && (d.sim !== false) && (
                        <button
                          onClick={() => {
                            if (!guardEdit(role)) return;
                            const mesHoy = new Date().getMonth() + 1;
                            const cuota = Number(d.pg || d.pago || 0);
                            // 15-sep-2026 (Santiago: "uno debería poner que quedó
                            // en cero o hasta el mes que se pagó?"). La primera
                            // versión asumía que el mes en curso ya no se pagaba
                            // (hastaMes = mes - 1). Es la suposición equivocada
                            // para el caso más común: uno paga la última cuota y
                            // con esa queda saldado, así que ese mes SÍ cuenta.
                            // Ninguna de las dos se puede deducir del dato, así
                            // que se pregunta. Un mes de cuota mal contado
                            // desplaza el flujo de todo el año.
                            const resp = prompt(
                              tx(`¿Cuál fue el ÚLTIMO mes que pagaste cuota de "${d.n || "esta deuda"}"?\n\n`, `What was the LAST month you made a payment on "${d.n || "this debt"}"?\n\n`) +
                              MESES_NOM.map((m, i) => `${i + 1} = ${m}`).join("   ") +
                              tx(`\n\nEse mes y los anteriores siguen contando en tu flujo; desde el siguiente deja de descontarse.`, `\n\nThat month and earlier still count in your cash flow; from the next one it stops being deducted.`),
                              String(mesHoy)
                            );
                            if (resp === null) return;
                            const ultimoMes = Math.min(12, Math.max(1, parseInt(resp, 10) || mesHoy));
                            onUpdate(deudas.map(x => x.id === d.id
                              ? { ...x, pagada: true, pagadaMes: ultimoMes, pagadaEl: new Date().toISOString().slice(0, 10), hastaMes: ultimoMes, mt: 0 }
                              : x));
                            if (cuota > 0) {
                              const mesesRestantes = 12 - ultimoMes;
                              const pl = (v) => (esUS() ? plata(v) : "$" + Math.round(v).toLocaleString("es-CO"));
                              alert(
                                tx(`Deuda saldada en ${MESES_NOM[ultimoMes - 1]}.\n\n`, `Debt paid off in ${MESES_NOM[ultimoMes - 1]}.\n\n`) +
                                tx(`Liberas ${pl(cuota)} al mes.\n`, `You free up ${pl(cuota)} a month.\n`) +
                                (mesesRestantes > 0
                                  ? tx(`Quedan ${mesesRestantes} ${mesesRestantes === 1 ? "mes" : "meses"} del año sin esa cuota: ${pl(cuota * mesesRestantes)}.`, `${mesesRestantes} ${mesesRestantes === 1 ? "month" : "months"} left this year without that payment: ${pl(cuota * mesesRestantes)}.`)
                                  : tx(`El año ya estaba cubierto; el alivio se ve completo el año entrante.`, `This year was already covered; you'll see the full relief next year.`)) +
                                tx(`\nEn un año completo son ${pl(cuota * 12)}.`, `\nOver a full year that's ${pl(cuota * 12)}.`)
                              );
                            }
                          }}
                          title={tx("Marcar como pagada: ya la terminé de pagar", "Mark as paid off: I finished paying it")}
                          style={{ background: T.bg3, border: "1px solid " + T.border,
                            padding: "5px 8px", borderRadius: 6, cursor: "pointer",
                            color: T.txt2, fontSize: 12, fontWeight: 600,
                            whiteSpace: "nowrap" }}>{tx("Marcar pagada", "Mark paid")}</button>
                      )}
                      <MenuFila onEditar={() => openEdit(d)} onEliminar={() => { if (!guardEdit(role)) return; if (confirm(tx("¿Eliminar este registro?", "Delete this record?"))) onUpdate(items.filter((i) => i.id !== d.id)); }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        {/* 26-jul-2026 — Límite del plan gratuito (10 por sección).
            Los bloqueados NO se excluyen de ningún total: se quita el acceso al
            detalle, no se falsea el número. Ver src/lib/limitePlan.js. */}
        {(() => {
          const b = separarPorLimite(items, plan).bloqueados;
          if (!b.length) return null;
          return <BloqueadosPorPlan cantidad={b.length} monto={b.reduce((s,d)=>s+((d.mt)||0),0)}
            fmt={fm} T={T} onUpgrade={onUpgrade} que={tx("deudas", "debts")} />;
        })()}
        </div>
      </div>

      {/* 16-sep-2026 (Santiago: "plan a cero debería estar debajo de las
          deudas"). Estaba arriba del todo, antes incluso de la lista. Eso
          invierte el orden en que uno piensa: primero se mira qué se debe y
          después qué hacer al respecto. Un plan de pago mostrado antes de las
          deudas es una respuesta sin pregunta. */}
      <PlanDeudasACero
        deudas={deudas}
        user={user}
        trm={trm || user?.trm || 4200}
        cashFlow={cashFlow}
        fmt={fm}
        onExtraADeudasChange={onExtraADeudasChange}
      />

      {/* Form */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? tx("Editar Deuda", "Edit debt") : tx("Agregar Deuda", "Add debt")}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Photo scan option */}
              <div style={{background:"rgba(59,130,246,0.06)",border:"1px dashed rgba(59,130,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={()=>{if(!scanning)scanImage()}}>
                {scanning ? <div style={{fontSize:12,color:"#3b82f6"}}>{tx("Leyendo extracto...", "Reading statement...")}</div> : <>
                  <div style={{fontSize:12,fontWeight:600,color:"#3b82f6"}}>{tx("¿Tienes el extracto o estado de cuenta?", "Have your loan or card statement?")}</div>
                  <div style={{fontSize:11,color:"var(--fp-txt3)",marginTop:2}}>{tx("Sube una foto o PDF y los campos se llenan automáticamente", "Upload a photo or PDF and the fields fill in automatically")}</div>
                </>}
              </div>
              <In l={tx("Nombre", "Name")} value={form.n} onChange={(v) => setForm((p) => ({ ...p, n: v }))} placeholder={tx("Hipoteca casa", "Home mortgage")} />
              <In l={tx("Tipo", "Type")} value={form.tp} onChange={(v) => setForm((p) => ({ ...p, tp: v,
                // El tipo «saldo pendiente» es un pago único sin intereses; al salir de él se vuelve a cuota con interés.
                tipoInteres: v === "saldo_pendiente" ? "sin_interes" : (p.tipoInteres === "sin_interes" ? "compuesto" : p.tipoInteres) }))} options={[
                ...opcionesTipo(),
                // Una deuda guardada con un tipo que la lista de este país no tiene, se conserva.
                ...(form.tp && !opcionesTipo().some((o) => o.v === form.tp) ? [{ v: form.tp, l: nombreTipo(form.tp) || form.tp }] : []),
              ]} />
            {/* 3-nov-2026: en EE. UU. todo va en dólares (la app no convierte pesos con TRM
                para una cuenta de EE. UU.), así que el selector de moneda no aplica. */}
            {!esUS() && <In l={tx("Moneda", "Currency")} value={form.moneda || "COP"} onChange={(v) => setForm((p) => ({ ...p, moneda: v }))} options={[{v:"COP",l:tx("COP (pesos)", "COP (pesos)")},{v:"USD",l:tx("USD (se convierte a la TRM)", "USD (converted at the TRM rate)")}]} />}
              <In l={tx("Saldo", "Balance")} value={form.mt} onChange={(v) => setForm((p) => ({ ...p, mt: v }))} type="number" placeholder="0" />
              {/* 24-jul-2026 — CAUSA RAÍZ del "40,6%" y del "$2.486.712" que
                  reportó Santiago: estos dos campos se auto-calculaban entre sí
                  con cuota = saldo × tasa / 12 (y su inversa). Esa identidad
                  solo vale para un crédito que paga SOLO intereses y nunca
                  amortiza. En un crédito real es falsa en ambos sentidos:
                  con cuota 4.408.755 y saldo 130.308.044 devolvía "tasa 40,6%",
                  y al corregir la tasa a 22,99 pisaba la cuota con 2.486.712.
                  Además pisaba lo que acababa de extraer el escaneo del extracto.
                  Cuota y tasa son datos INDEPENDIENTES del extracto: se capturan,
                  no se deducen. Abajo se muestra lo que sí se puede derivar de
                  verdad (plazo e interés), con amortización correcta. */}
              {/* 26-jul-2026 (Santiago): "que pueda poner la inversión o gasto en la
              moneda que quiera". Deudas ya se convertía en el motor —lee
              d.moneda— pero el formulario nunca lo ofreció, así que el campo
              existía y nadie podía llenarlo. */}
              {/* 26-jul-2026 (Santiago): el tipo de interés SÍ cambia las cuentas, a
              diferencia del selector hipoteca/préstamo/personal, que solo era una
              etiqueta. Se describe en lenguaje llano porque "simple vs compuesto"
              no le dice nada a quien no es financiero — lo que sí reconoce es
              "me lo prestó un familiar". */}
            <div style={{gridColumn:"1/-1"}}>
              {/* 26-jul-2026 (Santiago: "está muy poco inteligente el formulario
                de deuda de interés simple, si uno pone el valor del préstamo y
                el % de tasa no pone solo el valor del interés").
                Tiene razón, y el formulario de Egresos ya hacía exactamente
                esto con "Capital × tasa". Acá el dato está —saldo y tasa— y la
                cuota de un préstamo a interés simple ES saldo × tasa / 12.
                Pedirle al usuario que haga esa cuenta a mano es pedirle que
                repita lo que la app ya sabe.
                Solo SUGIERE: si escribe una cuota propia (cuotaManual) no se
                vuelve a tocar. Muchos préstamos entre personas pagan una cuota
                distinta al interés puro. */}
            {/* 26-jul-2026 (Santiago: "antes eran inteligentes estos
                formularios" · "si uno cambia el valor del crédito pues que
                cambie el valor de la cuota").
                Vuelve el cálculo cruzado, pero con PLAZO. El autocálculo que se
                eliminó el 23-jul usaba cuota = saldo × tasa / 12, identidad que
                solo vale si la deuda nunca amortiza: con el Sufi devolvía 40,6%
                en vez de 22,99%. Con saldo, tasa y plazo la cuota es exacta.
                Sigue siendo BOTÓN y no autocompletado: la app propone, el
                usuario decide. Esa fue la lección de aquel bug. */}
            {!["simple","sin_interes"].includes(form.tipoInteres || "compuesto") && (
              <div style={{gridColumn:"1/-1",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.txt2,marginBottom:8}}>{tx("¿No sabes la cuota o la tasa? Pon el plazo", "Don't know the payment or the rate? Enter the term")}</div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div style={{flex:"1 1 130px"}}>
                    <div style={{fontSize:11,color:T.txt3,marginBottom:4,fontWeight:600}}>{tx("PLAZO (MESES)", "TERM (MONTHS)")}</div>
                    <NumberInput value={form.plazoMeses} onChange={(v)=>setForm(p=>({...p,plazoMeses:v===""?"":String(v)}))}
                      placeholder="240" style={{width:"100%",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 11px",color:T.txt,fontSize:13}} />
                  </div>
                  {(() => {
                    const B=Number(form.mt)||0, n=Number(form.plazoMeses)||0, ts=Number(form.ts)||0, pg=Number(form.pg)||0;
                    if (B<=0 || n<=0) return <div style={{fontSize:12,color:T.txt3,flex:"2 1 200px"}}>{tx("Con el saldo y el plazo puedo calcular la cuota o la tasa.", "With the balance and the term I can work out the payment or the rate.")}</div>;
                    const acciones=[];
                    if (ts>0) {
                      const q=cuotaFija(B,ts,n);
                      if (q) acciones.push(
                        <button key="q" type="button" onClick={()=>setForm(p=>({...p,pg:String(Math.round(q))}))}
                          style={{background:"#3b82f6",color:"#fff",border:"none",padding:"9px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
                          {tx("Cuota", "Payment")} = {fm(Math.round(q))}
                        </button>);
                    }
                    if (pg>0) {
                      const t=tasaDesdeCuota(B,pg,n);
                      if (t!==null && t>0) acciones.push(
                        <button key="t" type="button" onClick={()=>setForm(p=>({...p,ts:String(Number(t.toFixed(2)))}))}
                          style={{background:T.bg2,color:T.txt,border:`1px solid ${T.border}`,padding:"9px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
                          {tx("Tasa", "Rate")} = {pctR(t, 2)}
                        </button>);
                    }
                    return acciones.length ? <div style={{display:"flex",gap:8,flexWrap:"wrap",flex:"2 1 200px"}}>{acciones}</div>
                      : <div style={{fontSize:12,color:T.txt3,flex:"2 1 200px"}}>{tx("Carga la tasa o la cuota y calculo la otra.", "Enter the rate or the payment and I'll work out the other.")}</div>;
                  })()}
                </div>
              </div>
            )}

            {Number(form.mt) > 0 && Number(form.ts) > 0 && (() => {
              // 26-jul-2026 — la ayuda aparecía SOLO con interés simple. Pero
              // con tasa E.A. bancaria el interés del primer mes también se
              // puede calcular, y es el dato que dice si la cuota alcanza a
              // amortizar. Se muestra en ambos casos, con la fórmula que
              // corresponde a cada uno:
              //   simple    → tasa/12 (no hay capitalización)
              //   compuesto → raíz doceava de la E.A.
              const esSimple = form.tipoInteres === "simple";
              const rMes = esSimple
                ? (Number(form.ts) / 100) / 12
                : Math.pow(1 + Number(form.ts) / 100, 1 / 12) - 1;
              const interesMes = Number(form.mt) * rMes;
              // Autollenado SOLO si la cuota está en cero y es interés simple,
              // donde cuota = interés es la lectura correcta por defecto.
              if (esSimple && !Number(form.pg) && !form.cuotaManual && interesMes > 0) {
                setTimeout(() => setForm(p => (!Number(p.pg) && !p.cuotaManual)
                  ? { ...p, pg: String(Math.round(interesMes)) } : p), 0);
              }
              const yaEsIgual = Math.abs(Number(form.pg || 0) - interesMes) < 1;
              return (
                <div style={{gridColumn:"1/-1",background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:4}}>
                  <div style={{fontSize:12,color:T.txt2,fontWeight:600,marginBottom:4}}>
                    {tx("Interés mensual de este préstamo: ", "Monthly interest on this loan: ")}<span style={{fontFamily:"monospace",color:T.green,fontWeight:700}}>{fm(Math.round(interesMes))}</span>
                  </div>
                  <div style={{fontSize:12,color:T.txt3,lineHeight:1.5,marginBottom:yaEsIgual?0:8}}>
                    {esSimple
                      ? <>{fm(Number(form.mt))} × {tasaFmt(form.ts)} ÷ 12. {tx("Si solo pagas intereses, esa es tu cuota.", "If you only pay interest, that's your payment.")}</>
                      : <>{tx("Interés del primer mes con tasa ", "First month's interest at a ")}{tasaFmt(form.ts)} {etqTasa()}{tx(". Tu cuota debe superarlo para que la deuda baje.", " rate. Your payment must be higher for the debt to go down.")}</>}
                  </div>
                  {/* 26-jul-2026: si la cuota está VACÍA se llena sola —no hay
                      nada que pisar, así que es ayuda pura. Con un valor ya
                      escrito queda el botón: la lección del "40,6%" fue que la
                      app no debe sobrescribir un dato del usuario, no que no
                      deba ayudar. */}
                  {!yaEsIgual && (esSimple ? (
                      <button type="button" onClick={() => setForm(p => ({...p, pg: String(Math.round(interesMes))}))}
                        style={{background:"#3b82f6",color:"#fff",border:"none",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
                        {tx("Usar ", "Use ")}{fm(Math.round(interesMes))}{tx(" como cuota", " as the payment")}
                      </button>
                    ) : (Number(form.pg) > 0 && Number(form.pg) <= interesMes && (
                      // Aviso, no botón: en un crédito bancario no existe "la
                      // cuota correcta" derivable del saldo y la tasa — depende
                      // del plazo pactado. Lo que sí se puede afirmar es que
                      // una cuota menor al interés nunca amortiza.
                      <div style={{fontSize:12,color:"#ff5000",fontWeight:600}}>
                        {tx("Esa cuota no cubre el interés: la deuda nunca baja.", "That payment doesn't cover the interest: the debt never goes down.")}
                      </div>
                    )))}
                </div>
              );
            })()}
            <div style={{fontSize:12,color:T.txt3,marginBottom:6,fontWeight:600}}>{tx("¿Cómo se cobran los intereses?", "How is interest charged?")}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[{v:"compuesto",l:tx("Como un banco", "Like a bank"),d:esUS() ? tx("Interés sobre el saldo, que va bajando. Tasa APR.", "Interest on the balance, which goes down. APR rate.") : tx("Interés sobre el saldo, que va bajando. Tasa E.A.", "Interest on the balance, which goes down. Effective annual rate.")},
                  {v:"simple",l:tx("Interés simple", "Simple interest"),d:tx("Siempre sobre el monto original. Préstamos entre personas.", "Always on the original amount. Loans between people.")},
                  // 24-oct-2026 (Santiago: "debo 437 M de un local… pueden existir
                  // deudas sin interés que se pagan de una sola vez, por ejemplo
                  // al vender un activo").
                  {v:"sin_interes",l:tx("Un solo pago, sin intereses", "One payment, no interest"),d:tx("Un saldo que pagas de una vez: al vender algo o en una fecha.", "A balance you pay all at once: when you sell something or on a date.")}].map(o=>
                  <button key={o.v} type="button" onClick={()=>setForm(p=>({...p,tipoInteres:o.v}))}
                    style={{flex:"1 1 220px",textAlign:"left",background:(form.tipoInteres||"compuesto")===o.v?"rgba(0,200,5,0.10)":T.bg3,
                      border:"1px solid "+((form.tipoInteres||"compuesto")===o.v?T.green:T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",color:T.txt}}>
                    <div style={{fontSize:13,fontWeight:700}}>{o.l}</div>
                    <div style={{fontSize:12,color:T.txt3,marginTop:2,lineHeight:1.4}}>{o.d}</div>
                  </button>)}
              </div>
            </div>
              {form.tipoInteres === "sin_interes" ? (
                <div style={{ gridColumn: "1/-1", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>{tx("¿Cuándo lo pagas?", "When do you pay it?")}</div>
                  <select value={form.pagoUnicoAnio || ""} onChange={(e) => setForm((p) => ({ ...p, pagoUnicoAnio: e.target.value ? Number(e.target.value) : "" }))}
                    style={{ width: "100%", background: T.bg2 || T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
                    <option value="">{tx("Cuando venda algo (lo eliges en Mi futuro a 10 años)", "When I sell something (you choose it in My 10-year future)")}</option>
                    {Array.from({ length: 11 }, (_, k) => new Date().getFullYear() + k).map((y) => <option key={y} value={y}>{tx("En", "In")} {y}</option>)}
                  </select>
                  <div style={{ fontSize: 12, color: T.txt3, marginTop: 6, lineHeight: 1.5 }}>{tx("No hay cuota ni intereses: el saldo se resta de tu patrimonio hasta que lo pagas. En Mi futuro a 10 años puedes pagarlo con la venta de un activo (Tu plata → Pagar deudas).", "No payment and no interest: the balance is subtracted from your net worth until you pay it. In My 10-year future you can pay it with the sale of an asset (Your money → Pay off debts).")}</div>
                </div>
              ) : <>
              <In l={tx("Cuota/mes ($)", "Payment/mo ($)")} value={form.pg} onChange={(v) => setForm((p) => ({ ...p, pg: v, cuotaManual: true }))} type="number" placeholder="0" />
              <In l={esUS() ? tx("Tasa anual % (APR)", "Annual rate % (APR)") : tx("Tasa anual % (E.A.)", "Annual rate % (effective)")} value={form.ts} onChange={(v) => setForm((p) => ({ ...p, ts: v }))} type="number" placeholder={esUS() ? tx("Ej: 22.99", "e.g. 22.99") : tx("Ej: 22,99", "e.g. 22.99")} />
              </>}
            {/* 26-jul-2026 (Santiago cargó 13,7 y quedó 137 por el bug de la
                coma, ya corregido). Una tasa de tres cifras casi siempre es un
                decimal perdido, y el motor la daría por buena: con 137% E.A.
                una hipoteca de $1.700M mostraría $126M de interés mensual en
                vez de $18M. El dato es del usuario, así que no se corrige solo
                —se avisa y se ofrece la lectura probable. */}
            {Number(form.ts) >= 100 && (
              <div style={{gridColumn:"1/-1",background:"rgba(255,80,0,0.08)",border:"1px solid rgba(255,80,0,0.35)",borderRadius:10,padding:"11px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#ff5000",marginBottom:3}}>{tx("Revisa esta tasa: ", "Check this rate: ")}{tasaFmt(form.ts)}{tx(" anual", " a year")}</div>
                <div style={{fontSize:12,color:T.txt3,lineHeight:1.5,marginBottom:8}}>
                  {tx("Es inusualmente alta. ¿Quisiste escribir ", "It's unusually high. Did you mean ")}{String(form.ts).slice(0,-1)}{esUS() ? "." : ","}{String(form.ts).slice(-1)}%?
                </div>
                <button type="button" onClick={() => setForm(p => ({...p, ts: String(Number(form.ts) / 10)}))}
                  style={{background:"#ff5000",color:"#fff",border:"none",padding:"6px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12}}>
                  {tx("Corregir a ", "Change to ")}{tasaFmt(Number(form.ts) / 10)}
                </button>
              </div>
            )}

              {/* Desglose del extracto (24-jul-2026, pedido de Santiago: "el
                  formulario debe agarrar interés y capital como en el extracto").
                  Los extractos colombianos imprimen ambos renglones con nombre
                  propio. Capturarlos elimina la ambigüedad de "cuál cuota"
                  (próximo pago distorsionado por abonos vs cuota habitual) y
                  permite VERIFICAR la tasa contra el interés realmente cobrado.
                  La cuota se arma por SUMA (capital + interés), que es un dato,
                  no una identidad inventada como el auto-cálculo anterior. */}
              <div style={{ gridColumn: "1/-1", background: "var(--fp-card)", border: `1px dashed ${T.border}`, borderRadius: 10, padding: "12px 14px", display: form.tipoInteres === "sin_interes" ? "none" : undefined }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.txt2, marginBottom: 2 }}>{tx("Desglose del extracto ", "Statement breakdown ")}<span style={{ fontWeight: 400, color: T.txt3 }}>{tx("(opcional)", "(optional)")}</span></div>
                <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10 }}>{tx("Copia los dos renglones tal cual salen en tu extracto. Con eso se arma la cuota y se verifica la tasa.", "Copy both lines exactly as they appear on your statement. That builds the payment and checks the rate.")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <In l={tx("Abono a capital", "Principal paid")} value={form.capExt || ""} onChange={(v) => setForm((p) => {
                    const n = { ...p, capExt: v };
                    const c = parseFloat(v) || 0, i = parseFloat(p.intExt) || 0;
                    if (c > 0 && i > 0) n.pg = String(Math.round(c + i));
                    return n;
                  })} type="number" placeholder="0" />
                  <In l={tx("Intereses del mes", "Interest this month")} value={form.intExt || ""} onChange={(v) => setForm((p) => {
                    const n = { ...p, intExt: v };
                    const i = parseFloat(v) || 0, c = parseFloat(p.capExt) || 0;
                    if (c > 0 && i > 0) n.pg = String(Math.round(c + i));
                    return n;
                  })} type="number" placeholder="0" />
                </div>
                {(() => {
                  const c = parseFloat(form.capExt) || 0, i = parseFloat(form.intExt) || 0, s = parseFloat(form.mt) || 0;
                  if (!(c > 0 && i > 0)) return null;
                  const previo = s + c; // el interés se cobra sobre el saldo ANTES del abono
                  const eaImp = previo > 0 ? (Math.pow(1 + i / previo, 12) - 1) * 100 : 0;
                  const tsForm = parseFloat(form.ts) || 0;
                  const dif = tsForm > 0 ? Math.abs(eaImp - tsForm) : null;
                  return (
                    <div style={{ marginTop: 10, fontSize: 12, color: T.txt2 }}>
                      {tx("Cuota", "Payment")} = {fm(c)} + {fm(i)} = <strong style={{ color: "var(--fp-txt)" }}>{fm(c + i)}{tx("/mes", "/mo")}</strong>
                      {previo > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: dif == null ? T.txt3 : dif <= 1.5 ? "#3ddc45" : "#fca5a5" }}>
                          {dif == null
                            ? <>{tx("Tasa implícita de este extracto: ", "Rate implied by this statement: ")}<strong>{pctR(eaImp, 2)} {tx("E.A.", "effective")}</strong>{tx(" — puedes usarla arriba.", " — you can use it above.")}</>
                            : dif <= 1.5
                              ? <>{tx("Cuadra: el interés cobrado equivale a ", "It matches: the interest charged equals ")}{pctR(eaImp, 2)} {tx("E.A., consistente con el ", "effective, consistent with the ")}{tasaFmt(tsForm)}{tx(" que pusiste.", " you entered.")}</>
                              : <>{tx("No cuadra: el interés cobrado equivale a ", "It doesn't match: the interest charged equals ")}<strong>{pctR(eaImp, 2)} {tx("E.A.", "effective")}</strong>{tx(", pero arriba pusiste ", ", but above you entered ")}{tasaFmt(tsForm)}{tx(". Revisa la tasa o el saldo.", ". Check the rate or the balance.")}</>}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* Vigencia de la deuda (20-jul-2026): "¿se paga todo el año o
                  hasta X mes?" — reusa el selector de Ingresos/Gastos. */}
              {form.tipoInteres !== "sin_interes" && <div style={{ gridColumn: "1/-1" }}>
                <FrecuenciaSelector
                  frecuencia={form.frecuencia || "mensual"}
                  mesPago={1}
                  desdeMes={Number(form.desdeMes) || 1}
                  hastaMes={Number(form.hastaMes) || 12}
                  vigenciaModo={form.vigenciaModo}
                  monto={parseFloat(form.pg) || 0}
                  montosMensuales={form.montosMensuales}
                  onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
                  tokens={{ gn: "#00c805", rd: "#ff5000", txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", bg3: "var(--fp-raised)", border: "rgba(var(--fp-ink),0.08)" }}
                  mostrarChipsFrecuencia={true}
                  mostrarSelectorMes={false}
                  mostrarVigencia={true}
                />
              </div>}
              {/* 25-jul-2026 (Santiago: "las deudas también pueden ser una vez
                  al año, variables o fijas, pues uno hace abonos o la paga" ·
                  "me gustó el abordaje de ingresos, uno puede cambiar los
                  valores"). Ingresos y gastos tenían la grilla de 12 meses;
                  deudas no. Se podía marcar una cuota como variable pero no
                  había dónde cargar los abonos, así que la opción no servía
                  para nada. Ahora es el mismo control en los tres módulos. */}
              {form.frecuencia === "variable" && (
                <div style={{ gridColumn: "1/-1" }}>
                  <TablaMensual
                    values={form.montosMensuales}
                    onChange={(arr) => setForm(p => ({ ...p, montosMensuales: arr, frecuencia: "variable" }))}
                    tokens={{ gn: "#00c805", rd: "#ff5000", txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", bg3: "var(--fp-raised)", border: "var(--fp-line)" }}
                    desdeMes={Number(form.desdeMes) || 1}
                    hastaMes={Number(form.hastaMes) || 12}
                  />
                </div>
              )}
              {form.mt&&form.pg&&form.ts&&(()=>{
                const cc=costoCredito({mt:+form.mt||0,pg:+form.pg||0,ts:+form.ts||0});
                if(cc.noAmortiza) return (
                  <div style={{gridColumn:"1/-1",fontSize:12,color:"#fca5a5",background:"rgba(255,80,0,0.08)",border:"1px solid rgba(255,80,0,0.25)",borderRadius:8,padding:"8px 12px"}}>
                    {tx("La cuota no alcanza a cubrir el interés mensual (~", "The payment doesn't cover the monthly interest (~")}{fm(Math.round((+form.mt||0)*(Math.pow(1+(+form.ts||0)/100,1/12)-1)))}{tx("). A este ritmo la deuda no baja. Revisa la cuota o la tasa.", "). At this pace the debt doesn't go down. Check the payment or the rate.")}
                  </div>
                );
                return (
                  <div style={{gridColumn:"1/-1",fontSize:12,color:"var(--fp-txt2)",background:"var(--fp-raised)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",gap:"4px 14px",marginBottom:8}}>
                      <span style={{color:"var(--fp-txt)",fontWeight:700,fontSize:12}}>{tx("Cuota mes ", "Monthly payment ")}{fm(+form.pg||0)}</span>
                      <span>{tx("Interés ", "Interest ")}<strong style={{color:"#f59e0b"}}>{fm(Math.round(cc.interesMes))}</strong></span>
                      <span>{tx("Capital ", "Principal ")}<strong style={{color:"#00c805"}}>{fm(Math.round(cc.capitalMes))}</strong></span>
                    </div>
                    <div style={{display:"flex",height:8,borderRadius:999,overflow:"hidden",background:"var(--fp-bg)",marginBottom:6}}>
                      <div style={{width:(100-cc.pctCapital)+"%",background:"#f59e0b"}} title={tx("Intereses", "Interest")} />
                      <div style={{width:cc.pctCapital+"%",background:"#00c805"}} title={tx("Abono a capital", "Principal paid")} />
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--fp-txt3)",marginBottom:8}}>
                      <span>{tx("Interés ", "Interest ")}{Math.round(100-cc.pctCapital)}{tx("% — se lo queda el banco", "% — the lender keeps it")}</span>
                      <span style={{color:"#3ddc45"}}>{tx("Capital ", "Principal ")}{Math.round(cc.pctCapital)}{tx("% — baja tu deuda", "% — lowers your debt")}</span>
                    </div>
                    <div style={{borderTop:"1px solid var(--fp-raised)",paddingTop:6}}>
                      {tx("Se paga en ", "Paid off in ")}<strong style={{color:"var(--fp-txt)"}}>{cc.meses!=null?Math.floor(cc.meses/12)+tx("a ", "y ")+cc.meses%12+"m":"—"}</strong>{tx(" · interés ", " · interest ")}<strong style={{color:"#f59e0b"}}>{fm(Math.round(cc.interesAnual))}{tx("/año", "/yr")}</strong>
                      {cc.interesTotal>0&&<>{tx(" · interés total restante ", " · total interest left ")}<strong style={{color:"#f59e0b"}}>{fm(Math.round(cc.interesTotal))}</strong></>}
                    </div>
                  </div>
                );
              })()}
              <In l={esUS() ? tx("Propietario", "Owner") : tx("Propietario fiscal", "Tax owner")} value={form.owner} onChange={(v) => {
                // Al cambiar owner, re-sugerir fiscalCode si tipo no es compatible con owner nuevo
                const newOwner = (owners || []).find(o => o.id === v);
                let newFC = form.fiscalCode;
                if (newOwner) {
                  const isJ = newOwner.type === "juridica";
                  if (isJ && form.fiscalCode.startsWith("DEU_NAT_")) newFC = "DEU_JUR_PRODUCTIVA";
                  if (!isJ && form.fiscalCode.startsWith("DEU_JUR_")) {
                    newFC = form.tp === "mortgage" ? "DEU_NAT_VIVIENDA_HABITACIONAL" : "DEU_NAT_CONSUMO";
                  }
                }
                setForm((p) => ({ ...p, owner: v, fiscalCode: newFC }));
              }} options={[{v:"",l:esUS() ? tx("— Sin asignar", "— Not assigned") : tx("— Sin asignar (no calcula impuesto)", "— Not assigned (no tax calculation)")},{v:"own_1",l:tx("Personal", "Personal")},{v:"na",l:esUS() ? tx("N/A — No aplica", "N/A — Not applicable") : tx("N/A — No aplica (exterior)", "N/A — Not applicable (abroad)")},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"":"")+o.name}))]} />
              {/* 3-nov-2026: la deducibilidad de intereses (Arts. 117 y 119 ET, UVT) es colombiana; en EE. UU. no se muestra. */}
              {!esUS() && form.owner && form.owner !== "na" && (() => {
                const ow = (owners || []).find(o => o.id === form.owner) || { type: "natural" };
                const isJ = ow.type === "juridica";
                const options = isJ
                  ? [
                      { v: "DEU_JUR_PRODUCTIVA", l: tx("Productiva — para actividad generadora de renta (intereses deducibles, Art. 117)", "Productive — for income-generating activity (interest deductible, Art. 117)") },
                      { v: "DEU_JUR_NO_PRODUCTIVA", l: tx("No productiva — sin relación con la actividad (intereses NO deducibles)", "Non-productive — unrelated to the business (interest NOT deductible)") },
                    ]
                  : [
                      { v: "DEU_NAT_VIVIENDA_HABITACIONAL", l: tx("Vivienda habitacional — donde vivo (Art. 119, intereses hasta 1.200 UVT)", "Primary home — where I live (Art. 119, interest up to 1,200 UVT)") },
                      { v: "DEU_NAT_INVERSION", l: tx("Inversión — inmueble arrendado, negocio (intereses deducibles renta no laboral)", "Investment — rented property, business (interest deductible against non-wage income)") },
                      { v: "DEU_NAT_CONSUMO", l: tx("Consumo personal — tarjeta, libre inversión (intereses NO deducibles)", "Personal consumption — card, consumer loan (interest NOT deductible)") },
                    ];
                return (
                  <div style={{ gridColumn: "1/-1", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>{tx("¿Para qué usaste esta deuda? (define deducibilidad de los intereses)", "What did you use this debt for? (sets whether interest is deductible)")}</div>
                    <select value={form.fiscalCode} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                      style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer" }}>
                      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>

                    {/* Commit 5 Tarea 3: confirmación legal Art. 119 ET cuando se elige
                        vivienda habitacional. Solo aplica a personas naturales. Las 3
                        condiciones son acumulativas — si alguna falla, el Art. 119 NO
                        aplica y los intereses NO son deducibles como vivienda. Es uno
                        de los errores fiscales más comunes (clasificar como vivienda
                        habitacional una deuda de inversión o segunda vivienda). */}
                    {!isJ && form.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL" && (() => {
                      const todasOk = viviendaConfirmaciones.esHabitacion && viviendaConfirmaciones.esTitular && viviendaConfirmaciones.noArrendado;
                      const alertColor = todasOk ? "#00c805" : "#ff5000";
                      const alertBg = todasOk ? "rgba(0,200,5,0.06)" : "rgba(255,80,0,0.06)";
                      const alertBorder = todasOk ? "rgba(0,200,5,0.25)" : "rgba(255,80,0,0.30)";
                      return (
                        <div style={{ marginTop: 12, padding: "12px 14px", background: alertBg, border: `1.5px solid ${alertBorder}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: alertColor, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            {tx("Confirma los 3 requisitos del Art. 119 ET", "Confirm the 3 requirements of Art. 119 ET")}
                          </div>
                          <div style={{ fontSize: 11, color: T.txt3, lineHeight: 1.5, marginBottom: 10 }}>
                            {tx("Los intereses solo son deducibles (hasta 1.200 UVT/año) si TODAS estas condiciones se cumplen. Si alguna falla, los intereses NO son deducibles como vivienda — reclasifica según corresponda.", "Interest is only deductible (up to 1,200 UVT/year) if ALL these conditions are met. If any fails, the interest is NOT deductible as housing — reclassify it.")}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.esHabitacion} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, esHabitacion: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>{tx("Es para mi vivienda DE HABITACIÓN", "It's for my PRIMARY home")}</strong>{tx(" (donde efectivamente vivo, no segunda vivienda ni inversión).", " (where I actually live, not a second home or an investment).")}</span>
                            </label>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.esTitular} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, esTitular: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>{tx("Soy titular del crédito", "I'm the borrower")}</strong>{tx(" (figuro como deudor en la escritura/pagaré). Si la deuda es solo de mi pareja sin que yo figure, no aplica.", " (I'm named as debtor on the deed/note). If the debt is only my partner's and I'm not on it, it doesn't apply.")}</span>
                            </label>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.noArrendado} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, noArrendado: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>{tx("El inmueble NO está arrendado", "The property is NOT rented out")}</strong>{tx(" a terceros (si recibo arriendo de él, es renta de capital, no vivienda).", " to others (if I collect rent from it, it's capital income, not housing).")}</span>
                            </label>
                          </div>
                          {!todasOk && (
                            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255,80,0,0.08)", border: "1px solid rgba(255,80,0,0.25)", borderRadius: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#ff5000", marginBottom: 6 }}>{tx("El Art. 119 ET NO aplica", "Art. 119 ET does NOT apply")}</div>
                              <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, marginBottom: 8 }}>
                                {tx("Sin las 3 condiciones, los intereses no son deducibles como vivienda. Reclasifica:", "Without all 3 conditions, the interest isn't deductible as housing. Reclassify:")}
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" onClick={() => { setForm(p => ({ ...p, fiscalCode: "DEU_NAT_INVERSION" })); setViviendaConfirmaciones({ esHabitacion: true, esTitular: true, noArrendado: true }); }}
                                  style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {tx("→ Reclasificar como Inversión", "→ Reclassify as Investment")}
                                </button>
                                <button type="button" onClick={() => { setForm(p => ({ ...p, fiscalCode: "DEU_NAT_CONSUMO" })); setViviendaConfirmaciones({ esHabitacion: true, esTitular: true, noArrendado: true }); }}
                                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {tx("→ Reclasificar como Consumo", "→ Reclassify as Consumption")}
                                </button>
                              </div>
                            </div>
                          )}
                          {todasOk && (
                            <div style={{ marginTop: 10, fontSize: 11, color: "#00c805", fontStyle: "italic", lineHeight: 1.4 }}>
                              {tx("Cumples el Art. 119 ET. Los intereses serán deducibles hasta 1.200 UVT/año.", "You meet Art. 119 ET. The interest will be deductible up to 1,200 UVT/year.")}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              <In l={tx("Activo Vinculado", "Linked asset")} value={form.la} onChange={(v) => setForm((p) => ({ ...p, la: v }))} options={[{ v: "", l: tx("Ninguno", "None") }, ...(inversiones || []).filter(i => i).map((i) => ({ v: i.id || "", l: i.n || i.nombre || i.name || tx("Sin nombre", "No name") }))]} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>{tx("Cancelar", "Cancel")}</button>
              <button onClick={handleSave} style={{ background: "#00c805", color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? tx("Guardar", "Save") : tx("Agregar", "Add")}</button>
            </div>
          </div>
        </div>
      )}
    
    <Disclaimer variante="general" idioma={tx("es", "en")} T={T} compacto />
  </div>
  );
}
