import { useState, useMemo, useEffect } from "react";
import { fmtTasaEs } from "../lib/formato.js";
import { fmtPctEs } from "../lib/metrics.js";
import Disclaimer from "./Disclaimer";
import { separarPorLimite } from "../lib/limitePlan.js";
import BloqueadosPorPlan from "./BloqueadosPorPlan";
import BarraComposicion from "./BarraComposicion";
import NumberInput from "./NumberInput";
import { C } from "../lib/designTokens.js";
import SimToggleInfo from "./SimToggleInfo";
import PageHeader from "./PageHeader";
import { fiscalCodeParaTipo } from "../lib/invFiscalCode.js";
import { exportInversionesExcel } from "../lib/excelExport.js";
import { exportPatrimonioPDF } from "../lib/pdfSectionExport.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import { vaCOP, vcCOP, totalAnualItem } from "../lib/flowHelpers.js";
import { gastosDelUsuario, columnasPortafolio, estiloEncabezadoGrupo, estiloTablaPortafolio, estiloSeccionPortafolio, estiloFilaPortafolio, estiloCeldaCompleta, deudasSinActivo, ANCHO_ANGOSTO } from "../lib/patrimonioUI.js";

const T = {
  bg2: C.surface, bg3: "#1e1e24",
  card: "#141418", border: C.border,
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316", purple: "#a78bfa",
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("es-CO");
const pc = (n) => fmtPctEs(n);

// Get name from item (handles multiple field formats)
const getName = (i) => i.n || i.nombre || i.name || "Sin nombre";
const getLoc = (i) => i.ub || i.ubicacion || i.location || "";
const getType = (i) => {
  let tp = String(i.tp || i.tipo || i.type || "").trim();
  if (!tp || !isNaN(Number(tp))) tp = "";
  const typeMap = {"Other":"Otro","Investment":"Fondo de Inversión","Income":"Otro","Trading":"Acciones","Renta Fija":"CDT","Lote":"Real Estate"};
  if (tp && typeMap[tp]) return typeMap[tp];
  const valid = ["Real Estate","Fondo de Inversión","CDT","Acciones","Crypto","Bodega","Vehículo","Local Comercial","Renta Fija","Negocio","Cash","Otro"];
  if (tp && valid.includes(tp)) return tp;
  const nm = ((i.n||i.nombre||"")+" "+(i.ub||"")).toLowerCase();
  if (/apart|apto|casa|lote|terreno|oficina|inmueble|propiedad|house|condo/i.test(nm)) return "Real Estate";
  if (/bodega/i.test(nm)) return "Bodega";
  if (/local/i.test(nm)) return "Local Comercial";
  if (/fondo|fiduci|fund/i.test(nm)) return "Fondo de Inversión";
  if (/cdt|renta fija|bonos/i.test(nm)) return "CDT";
  if (/accion|etf|portafolio|vti|spy|stock/i.test(nm)) return "Acciones";
  if (/btc|bitcoin|crypto|eth/i.test(nm)) return "Crypto";
  if (/vehic|carro|moto|auto/i.test(nm)) return "Vehículo";
  if (/negocio|empresa|sas/i.test(nm)) return "Negocio";
  if (/cash|ahorro|cuenta/i.test(nm)) return "Cash";
  if (/green|puerto|orlando|miami|backswing|district/i.test(nm)) return "Real Estate";
  return "Otro";
};
// 31-oct-2026 (Santiago: "el listado de patrimonio es difícil encontrar los ítems; ¿por qué
// no clasificar por tipo de inversión? inmobiliaria, acciones…"). Los tipos finos (Real
// Estate, Local, Bodega…) se agrupan en clases que se entienden de un vistazo.
const CLASES = [
  { id: "inmuebles", nombre: "Inmuebles", icono: "🏠", tipos: ["Real Estate", "Local Comercial", "Bodega"] },
  { id: "fondos", nombre: "Fondos y renta fija", icono: "💼", tipos: ["Fondo de Inversión", "CDT", "Renta Fija"] },
  { id: "bolsa", nombre: "Acciones y bolsa", icono: "📈", tipos: ["Acciones"] },
  { id: "cripto", nombre: "Cripto", icono: "₿", tipos: ["Crypto"] },
  { id: "liquidez", nombre: "Efectivo y cuentas", icono: "💵", tipos: ["Cash"] },
  { id: "negocios", nombre: "Negocios y participaciones", icono: "🏢", tipos: ["Negocio"] },
  { id: "vehiculos", nombre: "Vehículos", icono: "🚗", tipos: ["Vehículo"] },
  { id: "otros", nombre: "Otros", icono: "📦", tipos: [] },
];
const claseDe = (i) => CLASES.find((c) => c.tipos.includes(getType(i))) || CLASES[CLASES.length - 1];

// 26-jul-2026: getVA devolvía el valor CRUDO, sin convertir moneda. Un activo
// cargado en USD se mostraba y se sumaba como si fueran pesos: el portafolio
// de USD 33.266 aparecía como $33.266 COP junto a inmuebles de miles de
// millones. La conversión ahora usa el mismo helper que el resto del motor.
// 26-jul-2026 — CRASH EN PRODUCCIÓN. Al agregar la conversión de moneda,
// getVA quedó usando `trm`, que es una PROP del componente — pero esta
// función vive a nivel de módulo, fuera de él. En ejecución lanzaba
// "trm is not defined" y la página de Patrimonio no cargaba.
// El build no lo detecta: es un error de runtime, no de sintaxis.
// Ahora la TRM se pasa como argumento, que es lo correcto para una función
// que no está dentro del componente.
const getVA = (i, trm) => vaCOP({ ...i, va: i.va ?? i.valor_actual ?? i.valor ?? 0 }, trm || 4200);
// 12-ago-2026 (Santiago): "si uno pone valor en dólares lo pasa a pesos en
// valor actual pero no en el de compra". Exacto: el 26-jul se arregló getVA
// para convertir moneda y getVC quedó devolviendo el número crudo. En un
// activo en USD el valor actual salía ×TRM y el de compra en dólares, así que
// la ganancia era el disparate de restar dólares a pesos (un activo de
// 460k→575k USD mostraba una "ganancia" de ~2.415 millones de pesos).
const getVC = (i, trm) => vcCOP({ ...i, vc: i.vc ?? i.valor_compra ?? i.costo ?? 0 }, trm || 4200);

// Valores SIN convertir, en la moneda en que el usuario los cargó. Son los
// que van al formulario: el form tiene su propio selector de moneda, así que
// prellenarlo con pesos convertidos y dejar el selector en USD hacía que al
// guardar se escribiera el monto en pesos con moneda USD — y al volver a
// abrirlo se multiplicaba por la TRM otra vez. Cada edición inflaba el activo
// ~4.200×, de forma silenciosa y permanente.
const getVArw = (i) => Number(i.va ?? i.valor_actual ?? i.valor ?? 0);
const getVCrw = (i) => Number(i.vc ?? i.valor_compra ?? i.costo ?? 0);

// 14-sep-2026 — `rentaVinculadaMes` es el ingreso que llega desde la LISTA
// GLOBAL de ingresos vía activoId, en pesos y ya mensualizado.
// Hallazgo del día: la plataforma tenía DOS representaciones del mismo hecho
// -- ingreso anidado dentro del activo (15 activos lo usan) e ingreso en la
// lista global (160 registros) -- sin relación entre ellas. En vez de sumar
// una tercera, el vínculo nuevo alimenta este mismo cálculo: cap rate y
// cash-on-cash ya existían y se quedaban cortos porque solo veían una mitad.
function calcMetrics(inv, deudas, trm, rentaVinculadaMes = 0, gastoVinculadoMes = 0) {
  let ig = rentaVinculadaMes, gs = gastoVinculadoMes;
  if (inv.unidades || inv.un) {
    (inv.unidades || inv.un || []).forEach((u) => {
      (u.ingresos || u.ig || []).forEach((i) => { ig += i.m || 0; });
      (u.gastos || u.gs || []).forEach((g) => { gs += g.m || 0; });
    });
  } else {
    (inv.ingresos || inv.ig || []).forEach((i) => { ig += i.m || 0; });
    (inv.gastos || inv.gs || []).forEach((g) => { gs += g.m || 0; });
  }
  const va = getVA(inv, trm), vc = getVC(inv, trm);
  const noi = ig - gs;
  // 27-sep-2026 — Sin filtrar por saldo ni por sim, una deuda ya saldada
  // (mt: 0, que es lo que deja "Marcar pagada") o apagada seguia restando su
  // cuota vieja del cash-on-cash del activo. Mismo criterio que usa el resto
  // del motor para decidir si una deuda existe: activa y con saldo.
  const linkedDebt = (deudas || []).filter((d) =>
    (d.la || d.link) === inv.id && d.sim !== false && (Number(d.mt || d.monto) || 0) > 0);
  const debtTotal = linkedDebt.reduce((s, d) => s + (d.mt || d.monto || 0), 0);
  const debtPayment = linkedDebt.reduce((s, d) => s + (d.pg || d.pago || 0), 0);
  const equity = va - debtTotal;
  const roi = vc > 0 ? ((va - vc) / vc) * 100 : 0;
  const cap = va > 0 ? ((noi * 12) / va) * 100 : 0;
  const coc = equity > 0 ? (((noi - debtPayment) * 12) / equity) * 100 : 0;
  return { ig, gs, noi, roi, cap, coc, debtTotal, debtPayment, equity };
}

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value ?? ""} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function InversionesModule({ inversiones, owners, deudas, onUpdate, fmt, onImport, user, trm, plan, onUpgrade, onCrearIngreso, onSyncIngreso }) {
  // ── 14-sep-2026 · Rentabilidad por activo ────────────────────────────────
  // Primer uso del vínculo ingreso → activo. Antes un activo era solo un valor
  // de compra y uno actual: la plataforma no sabía si producía algo. Con el
  // vínculo se puede calcular el yield -- ingreso anual sobre valor actual --
  // y, más importante, señalar los activos que no generan ningún ingreso.
  // Un activo improductivo no es necesariamente un error (una casa de recreo,
  // un lote en valorización), pero el usuario debería verlo y decidirlo, no
  // ignorarlo por omisión del modelo.
  const rentaPorActivo = useMemo(() => {
    const mapa = {};
    const TRM = trm || 4200;
    (user?.ingresos || []).forEach((ing) => {
      const id = ing?.activoId;
      if (!id || ing.sim === false) return;
      // Se cuentan los meses de vigencia: un arriendo de 3 meses no rinde igual
      // que uno de 12, y anualizar el mensual los igualaría en falso.
      // 25-sep-2026 — totalAnualItem ya hace esa cuenta y además maneja los
      // ingresos variables, donde `mensual` queda residual.
      mapa[id] = (mapa[id] || 0) + totalAnualItem(ing) * (ing.moneda === "USD" ? TRM : 1);
    });
    return mapa;
  }, [user, trm]);

  // 14-sep-2026 — Simétrico del anterior: gastos que el usuario marcó como
  // pertenecientes a un activo. Sin esto el cap rate quedaría bruto (renta sin
  // descontar predial, administración ni seguros) y sobreestimaría todo.
  const gastoPorActivo = useMemo(() => {
    const mapa = {};
    const TRM = trm || 4200;
    // 11-oct-2026 (QA): los gastos viven en u.gas; u.gastos no existe, así que
    // este mapa quedaba siempre vacío.
    Object.values(gastosDelUsuario(user)).forEach((items) => {
      (items || []).forEach((g) => {
        const id = g?.activoId;
        if (!id || g.sim === false) return;
        // 25-sep-2026 — totalAnualItem respeta frecuencia y vigencia. Leer `m`
        // crudo sobreestimaba los gastos variables (su valor real vive en
        // montosMensuales) y hundía el cap rate del activo vinculado.
        mapa[id] = (mapa[id] || 0) + totalAnualItem(g) * (g.moneda === "USD" ? TRM : 1);
      });
    });
    return mapa;
  }, [user, trm]);

  const fm = fmt || _fm;
  // 11-oct-2026 (QA): en el móvil la tabla cortaba Valor y Deuda.
  const [angosto, setAngosto] = useState(() => typeof window !== "undefined" && window.innerWidth <= ANCHO_ANGOSTO);
  useEffect(() => {
    const c = () => setAngosto(window.innerWidth <= ANCHO_ANGOSTO);
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);
  const pad = angosto ? "10px 6px" : "12px 14px";
  // Fase 3 commit 6: gating reader.
  const { role } = useRole();
  // V4.9 - edit fix
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [titularFiltro, setTitularFiltro] = useState("");
  const [cerrados, setCerrados] = useState({});
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", ubicacion: "", tipo: "Real Estate", va: "", vc: "", tasa: "", valorizacionPct: "", owner: "", moneda: "COP" });

  const items = inversiones || [];
  const activos = items.filter((i) => i.sim !== false);
  // 21-oct-2026 — Ingresos manda aquí a editar el activo del que nace un ingreso.
  useEffect(() => {
    try { const id = sessionStorage.getItem("fp3_abrir_activo"); if (id) { sessionStorage.removeItem("fp3_abrir_activo"); const inv = items.find((i) => i.id === id); if (inv) openEdit(inv); } } catch { /* noop */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 26-jul-2026 — Límite del plan gratuito (7 por sección).
  // OJO: `activos` sigue completo, así que totalValor, rendimiento y todo lo
  // que alimenta al dashboard incluye los bloqueados. El límite quita ACCESO
  // al detalle, no falsea los números. Ver src/lib/limitePlan.js.
  const { visibles: itemsVisibles, bloqueados, hayLimite } = separarPorLimite(items, plan);
  const montoBloqueado = bloqueados.reduce((s, i) => s + getVA(i, trm), 0);
  // 26-jul-2026 (Santiago: "lo mismo pasa con patrimonio, organícelo por
  // tipologías"). Mismo patrón que Gastos, Ingresos y Deudas: marcadores
  // {__cat} intercalados en los datos, que el render dibuja como encabezado.
  // Acá el criterio es el TIPO DE ACTIVO y el subtotal es el VALOR: la
  // pregunta en patrimonio es en qué está puesta la plata — la misma que
  // responde la alerta de concentración del dashboard.
  const coincide = (i) => {
    if (titularFiltro && (i.owner || "") !== titularFiltro) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [getName(i), getLoc(i), getType(i), claseDe(i).nombre].join(" ").toLowerCase().includes(q);
  };
  const filtrando = !!busca.trim() || !!titularFiltro;
  const conEncabezados = (lista) => {
    const porClase = {};
    lista.filter(coincide).forEach(i => { const c = claseDe(i); (porClase[c.id] = porClase[c.id] || { c, items: [] }).items.push(i); });
    const grupos = Object.values(porClase)
      .map(({ c, items: its }) => ({ c, items: [...its].sort((a, b) => getVA(b, trm) - getVA(a, trm)),
        sub: its.filter(i => i.sim !== false).reduce((s, i) => s + getVA(i, trm), 0) }))
      .sort((a, b) => b.sub - a.sub);
    const tot = grupos.reduce((s, g) => s + g.sub, 0);
    return grupos.flatMap(gr => [
      { __cat: `${gr.c.icono} ${gr.c.nombre}`, __clase: gr.c.id, __sub: gr.sub, __n: gr.items.length,
        __pct: tot > 0 ? (gr.sub / tot) * 100 : 0, id: "__h_" + gr.c.id },
      // Buscando, todo abierto; si no, respeta lo que el usuario cerró.
      ...(!filtrando && cerrados[gr.c.id] ? [] : gr.items),
    ]);
  };
  const totalValor = activos.reduce((s, i) => s + getVA(i, trm), 0)
  // 26-jul-2026 (Santiago): mismo trío en los cuatro módulos de "Mi dinero" —
  // stock · flujo mensual · flujo anual — para que el ojo busque siempre en el
  // mismo lugar. Acá el flujo es lo que RINDE el patrimonio: se veía cuánto
  // vale, no cuánto produce, que es la otra mitad del dato.
  // Solo suma activos con tasa cargada: una propiedad sin rendimiento
  // declarado no rinde 0%, simplemente no se sabe, y no se inventa.
  const rendimientoAnual = activos.reduce((s, i) => s + getVA(i, trm) * ((Number(i.tasa) || 0) / 100), 0);


  // 27-sep-2026 (Santiago: "¿cuál es el objetivo de poder elegir todos los
  // items de patrimonio?"). Se quitó la selección múltiple de esta tabla.
  //
  // Servía para UNA sola cosa: borrar en lote. El checkbox de la cabecera
  // marcaba los N activos de un clic, pegado al botón de eliminar, y la app no
  // tiene deshacer, papelera ni restaurar. El riesgo era real y el beneficio
  // ninguno: la operación en lote que sí es útil —asignar titular— vive en
  // AsignarTitularMasivo, no acá.
  //
  // Queda el borrado fila por fila, que ya existía y pide confirmación.

  // 21-oct-2026 — El ingreso que nace del activo. Hay UNO principal, marcado
  // desdePatrimonio, que este formulario crea y mantiene; otros ingresos
  // vinculados (p. ej. dos arriendos del mismo inmueble) siguen en Ingresos.
  const ingresoPrincipalDe = (id) => (user?.ingresos || []).find((x) => x && x.activoId === id && x.desdePatrimonio) || null;
  // 26-oct-2026 (Santiago: "esta inversión no la tuve todo el año… arrancó en febrero y no con ese monto;
  // ¿cómo le digo al sistema que de tal mes a tal mes fue tanto?"). Tramos → 12 montos (frecuencia variable).
  const factorTasa = (f) => (parseFloat(f.tasa) || 0) / 100 / 12 * (Math.max(0, Math.min(100, parseFloat(f.recibePct) || 100)) / 100);
  const montosDeTramos = (f) => {
    const out = new Array(12).fill(0);
    (f.tramos || []).forEach((t) => {
      const d = Math.max(1, Math.min(12, parseInt(t.desde) || 1)), h = Math.max(d, Math.min(12, parseInt(t.hasta) || 12));
      const v = parseFloat(t.valor) || 0;
      const m = (f.modo || "fijo") === "tasa" ? Math.round(v * factorTasa(f)) : Math.round(v);
      for (let i = d; i <= h; i++) out[i - 1] = m;
    });
    return out;
  };
  const tramosDeMontos = (montos, f) => {
    const fac = (f.modo || "fijo") === "tasa" ? factorTasa(f) : 0;
    const res = [];
    (montos || []).forEach((m, i) => {
      const v = Number(m) || 0; if (v <= 0) return;
      const ult = res[res.length - 1];
      if (ult && ult.m === v && ult.hasta === i) ult.hasta = i + 1;
      else res.push({ desde: i + 1, hasta: i + 1, m: v });
    });
    return res.map((t) => ({ desde: String(t.desde), hasta: String(t.hasta), valor: String(fac > 0 ? Math.round(t.m / fac) : t.m) }));
  };
  const openEdit = (inv) => {
    const ing = ingresoPrincipalDe(inv.id);
    const rentaLegacy = Number(inv.renta) || 0, tasaLegacy = Number(inv.tasa) || 0;
    setForm({
      nombre: String(getName(inv) || ""),
      ubicacion: String(getLoc(inv) || ""),
      tipo: String(getType(inv) || "Real Estate"),
      fiscalCode: fiscalCodeParaTipo(getType(inv) || "Real Estate", inv.fiscalCode, (owners || []).find((o) => o.id === inv.owner)),
      pctTerreno: inv.pctTerreno != null ? String(inv.pctTerreno) : "",
      va: String(getVArw(inv) || ""),
      vc: String(getVCrw(inv) || ""),
      tasa: String(inv.tasa || ""),
      valorizacionPct: inv.valorizacionPct != null ? String(inv.valorizacionPct) : "",
      rentaOrigen: inv.rentaOrigen || "",
      tasaLegacy: !!inv.tasa && !inv.rentaOrigen,
      owner: inv.owner || "",
      moneda: inv.moneda || "COP",
      // ¿Genera ingreso? cómo y cuándo (desde el ingreso vinculado, o de los campos viejos como estimación)
      genera: ing ? "si" : (rentaLegacy > 0 || tasaLegacy > 0 ? "si" : "no"),
      modo: ing ? (Number(ing.capital) > 0 && Number(ing.tasa) > 0 ? "tasa" : "fijo") : (rentaLegacy > 0 ? "fijo" : "tasa"),
      renta: ing ? String(ing.mensual || "") : (rentaLegacy > 0 ? String(rentaLegacy) : ""),
      recibePct: ing && ing.recibePct != null ? String(ing.recibePct) : "100",
      vigencia: ing ? (ing.frecuencia === "variable" ? "tramos" : ing.frecuencia === "anual" ? "anual" : (ing.vigenciaModo === "limitada" || (ing.desdeMes && ing.hastaMes && !(Number(ing.desdeMes) === 1 && Number(ing.hastaMes) === 12)) ? "meses" : "todo")) : "todo",
      desdeMes: ing && ing.desdeMes ? String(ing.desdeMes) : "1",
      hastaMes: ing && ing.hastaMes ? String(ing.hastaMes) : "12",
      mesPago: ing && ing.mesPago ? String(ing.mesPago) : "12",
      ingresoNombre: ing ? (ing.nombre || "") : "",
    });
    if (ing && ing.frecuencia === "variable") setForm((p) => ({ ...p, tramos: tramosDeMontos(ing.montosMensuales, p) }));
    setEditId(inv.id);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", fiscalCode: "INV_INMUEBLE_HABITACIONAL", pctTerreno: "", va: "", vc: "", tasa: "", valorizacionPct: "", owner: "", moneda: "COP" });
    setEditId(null);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!guardEdit(role)) return;
    const va = Math.abs(parseFloat(form.va)) || 0;
    const tasa = parseFloat(form.tasa) || 0;
    // ALERTA ANTI-TYPO (20-jul-2026, Santiago): Puerto Madero quedó guardado
    // con $11.7M en vez de $11.7B → "ganancia" de −$4.5B. Si el valor actual
    // implica una pérdida >90% vs el costo, casi siempre faltan ceros.
    const vcCheck = Math.abs(parseFloat(form.vc)) || 0;
    if (va > 0 && vcCheck > 0 && va < vcCheck * 0.1) {
      const ok = window.confirm(
        `⚠️ REVISA LOS CEROS\n\nValor actual: $${va.toLocaleString("es-CO")}\nCosto de compra: $${vcCheck.toLocaleString("es-CO")}\n\nEsto implica una pérdida del ${fmtPctEs((100 - (va / vcCheck) * 100), 0)}. Si el activo vale MÁS de lo que costó, probablemente faltan ceros en el Valor Actual (tip: usa el shortcut "11700m" = $11.700.000.000).\n\n¿Guardar así de todas formas?`
      );
      if (!ok) return;
    }
    const ingresoCalc = tasa > 0 ? Math.round((va * tasa / 100) / 12) : 0;
    const updated = {
      n: String(form.nombre || "").trim(),
      nombre: String(form.nombre || "").trim(),
      name: String(form.nombre || "").trim(),
      ub: String(form.ubicacion || "").trim(),
      ubicacion: String(form.ubicacion || "").trim(),
      tp: form.tipo || "Other",
      owner: form.owner || "",
      tipo: form.tipo || "Other",
      va,
      vc: Math.abs(parseFloat(form.vc)) || 0,
      moneda: form.moneda || "COP",
      tasa,
      // Origen de la renta: manual (el usuario escribió el %, ya neta) | derivada (arriendo×12÷valor, bruta).
      // Un activo viejo sin indicador que se guarda sin tocar el % queda confirmado como bruta.
      rentaOrigen: tasa > 0 ? (form.rentaOrigen || "derivada") : undefined,
      valorizacionPct: form.valorizacionPct !== "" && form.valorizacionPct != null ? parseFloat(form.valorizacionPct) || 0 : undefined,
      fiscalCode: fiscalCodeParaTipo(form.tipo, form.fiscalCode, (owners || []).find((o) => o.id === form.owner)),
      revisarFiscal: undefined,
      pctTerreno: form.pctTerreno !== "" && form.pctTerreno != null ? Math.max(0, Math.min(100, parseFloat(form.pctTerreno))) : undefined,
    };
    // Store income directly on investment so coaches can read it
    let idActivo = editId;
    if (editId) {
      onUpdate(items.map((i) => {
        if (i.id !== editId) return i;
        return { ...i, ...updated };
      }));
    } else {
      updated.id = "i_" + Date.now();
      idActivo = updated.id;
      updated.ig = [];
      updated.gs = [];
      onUpdate([...items, updated]);
    }
    // 21-oct-2026 — El ingreso del activo nace aquí (Santiago: "uno al
    // ingresar algo en patrimonio debe el sistema preguntar si genera o no
    // ingreso, para que fluya bien"). Un solo origen: Patrimonio dice qué es,
    // cuánto vale, cuánto paga y cuándo; Ingresos lo refleja.
    if (onSyncIngreso) {
      if (form.genera === "si") {
        const esInmueble = ["Real Estate", "Local Comercial", "Bodega"].includes(form.tipo);
        const esParticipacion = form.tipo === "Acciones" || form.tipo === "Fondo de Inversión";
        const recibe = form.modo === "tasa" ? Math.max(0, Math.min(100, parseFloat(form.recibePct) || 100)) : 100;
        const vigencia = form.vigencia || "todo";
        const montosT = vigencia === "tramos" ? montosDeTramos(form) : null;
        const ultimoMes = montosT ? [...montosT].reverse().find((x) => x > 0) || 0 : 0;
        const mensual = montosT ? ultimoMes : form.modo === "tasa" ? Math.round(va * tasa / 100 / 12 * recibe / 100) : Math.round(parseFloat(form.renta) || 0);
        const desde = vigencia === "meses" ? Math.max(1, Math.min(12, parseInt(form.desdeMes) || 1)) : 1;
        const hasta = vigencia === "meses" ? Math.max(desde, Math.min(12, parseInt(form.hastaMes) || 12)) : 12;
        const nombre = form.ingresoNombre || `${esInmueble ? "Renta" : esParticipacion ? "Dividendos" : "Rendimiento"} — ${updated.n || "activo"}`;
        if (mensual > 0) onSyncIngreso(idActivo, {
          nombre, activoId: idActivo, desdePatrimonio: true, owner: form.owner || "", moneda: form.moneda || "COP", sim: true, tipo: "fijo",
          categoria: esInmueble ? "Arriendo" : esParticipacion ? "Dividendos" : "Rentas de capital",
          fiscalCode: esInmueble ? "NOL_ARRIENDO_INMUEBLE" : esParticipacion ? "DIV_ART49_GRAVADOS" : "CAP_RENDIMIENTO_GENERICO",
          mensual, capital: form.modo === "tasa" ? va : undefined, tasa: form.modo === "tasa" ? tasa : undefined, tasaModo: form.modo === "tasa" ? "anual" : undefined, recibePct: form.modo === "tasa" ? recibe : undefined,
          frecuencia: montosT ? "variable" : vigencia === "anual" ? "anual" : "mensual", mesPago: vigencia === "anual" ? Math.max(1, Math.min(12, parseInt(form.mesPago) || 12)) : 1,
          desdeMes: montosT ? (montosT.findIndex((x) => x > 0) + 1 || 1) : desde, hastaMes: montosT ? (montosT.some((x) => x > 0) ? 12 - [...montosT].reverse().findIndex((x) => x > 0) : 12) : hasta,
          vigenciaModo: vigencia === "meses" ? "limitada" : undefined, montosMensuales: montosT || undefined,
        });
        else onSyncIngreso(idActivo, null);
      } else {
        onSyncIngreso(idActivo, null);
      }
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", fiscalCode: "INV_INMUEBLE_HABITACIONAL", pctTerreno: "", va: "", vc: "", tasa: "", valorizacionPct: "", owner: "", moneda: "COP" });
  };

  // Set de IDs de inversiones sin propietario asignado, para badges en rows.
  const inversionesSinOwnerIds = new Set((inversiones || []).filter(i => !i.owner || i.owner === "").map(i => i.id));

  return (
    <div>
      <PageHeader
        label="Inversiones"
        title="Portafolio"
        subtitle={`${activos.length}${activos.length !== items.length ? ` de ${items.length}` : ""} activo${activos.length !== 1 ? "s" : ""} · Valor total: ${fm(totalValor)}`}
        rightSlot={<>
          {onImport && <button onClick={onImport}
            title="Cargar activos desde una tabla de Excel"
            style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            ⬆️ Subir Excel
          </button>}
          <button onClick={() => exportInversionesExcel(activos, owners, trm)}
            title="Descarga XLSX con activos + resumen por tipo + resumen por propietario fiscal"
            style={{ background: "transparent", color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.15)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ⬇️ Bajar Excel
          </button>
          <button onClick={() => exportPatrimonioPDF(activos, owners, trm)}
            title="Bajar PDF: valor, ganancia y concentración por tipo"
            style={{ background: "transparent", color: "#e4e4e7", border: "1px solid rgba(255,255,255,0.15)", padding: "10px 18px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            ⬇️ Bajar PDF
          </button>
          <button onClick={openAdd} style={{ background: T.green, color: "#000", border: "none", padding: "10px 22px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </>}
      />

      {/* Banner contextual: inversiones sin propietario asignado.
          Sin owner las rentas/dividendos no se atribuyen a un contribuyente
          específico para el cálculo de Impuestos. */}
      {(() => {
        if (!user) return null;
        const sinOwner = (inversiones || []).filter(i => !i.owner || i.owner === "");
        if (sinOwner.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
                {sinOwner.length} inversi{sinOwner.length !== 1 ? "ones" : "ón"} sin propietario asignado
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
              Sin propietario, los rendimientos y dividendos no se atribuyen a un contribuyente para el cálculo de Impuestos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sinOwner.slice(0, 6).map((inv, idx) => (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#ef4444", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {inv.n || "(sin nombre)"} <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· valor {fm(inv.v || 0)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>Asígnale un propietario para atribuir los rendimientos correctamente</div>
                  </div>
                  <button onClick={() => openEdit(inv)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: "#22c55e", cursor: "pointer", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    Editar →
                  </button>
                </div>
              ))}
              {sinOwner.length > 6 && (
                <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", padding: "4px 0" }}>+ {sinOwner.length - 6} más</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner explicando toggle sim (Commit 8.8) */}
      <SimToggleInfo total={items.length} activos={activos.length} moduloNombre="una inversión" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Patrimonio Total", v: fm(totalValor), c: T.green },
          { l: "Rendimiento bruto al mes", v: rendimientoAnual > 0 ? fm(rendimientoAnual / 12) : "—", c: T.blue },
          { l: "Rendimiento bruto al año", v: rendimientoAnual > 0 ? fm(rendimientoAnual) : "—", c: T.purple },
          
          { l: "Activos", v: activos.length, c: T.txt },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 26-jul-2026 (Santiago): barra de composición por tipo de activo,
          el mismo componente de las otras tres secciones. En patrimonio esta
          lectura es especialmente útil: es la misma que alimenta la alerta de
          concentración del dashboard, así que el usuario ve acá el porqué de
          esa advertencia. */}
      {(() => {
        const grupos = {};
        activos.forEach(i => { const c = claseDe(i); const k = c.nombre; grupos[k] = (grupos[k] || 0) + getVA(i, trm); });
        const datos = Object.entries(grupos).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
        if (datos.length < 2) return null;
        const tot = datos.reduce((s, d) => s + d.value, 0);
        const PAL = ["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308","#f97316"];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>EN QUÉ ESTÁ TU PATRIMONIO</div>
            <BarraComposicion datos={datos} total={tot} paleta={PAL} T={T} altura={44} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 8 }}>
              {[...datos].sort((a,b)=>b.value-a.value).map((d, i) => (
                <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: T.txt2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: PAL[i % PAL.length], flexShrink: 0 }} />
                  {d.name} <strong style={{ fontFamily: "monospace" }}>{fmtPctEs(((d.value/tot)*100), 0)}</strong>
                </span>
              ))}
            </div>
          </div>
        );
      })()}
      {(() => {
        const ds = deudasSinActivo(deudas, activos);
        if (ds.n === 0) return null;
        return (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
            Tienes {ds.n} {ds.n === 1 ? "deuda" : "deudas"} por <strong style={{ fontFamily: "monospace" }}>{fm(ds.total)}</strong> que {ds.n === 1 ? "no está vinculada" : "no están vinculadas"} a ningún activo. No aparece en la columna Deuda de la tabla, pero sí cuenta en tu deuda total. Si corresponde a un activo, vincúlala desde Deudas.
          </div>
        );
      })()}
      {/* 31-oct-2026: buscar y filtrar por titular para encontrar un activo rápido */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar activo, ciudad o tipo…"
            style={{ flex: "1 1 220px", minWidth: 0, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, padding: "9px 12px", fontSize: 13, outline: "none" }} />
          {(owners || []).length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[{ id: "", name: "Todos" }, ...(owners || [])].map((o) => {
                const on = titularFiltro === o.id;
                return <button key={o.id || "todos"} type="button" onClick={() => setTitularFiltro(o.id)} style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? T.green : T.border}`, background: on ? "rgba(34,197,94,0.12)" : "transparent", color: on ? T.green : T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{o.type === "juridica" ? "🏢 " : o.id ? "👤 " : ""}{o.name}</button>;
              })}
            </div>
          )}
          {!filtrando && (
            <button type="button" onClick={() => { const todos = Object.values(cerrados).filter(Boolean).length > 0; setCerrados(todos ? {} : Object.fromEntries(CLASES.map((c) => [c.id, true]))); }}
              style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.txt2, fontSize: 12, cursor: "pointer" }}>
              {Object.values(cerrados).filter(Boolean).length > 0 ? "Abrir todo" : "Ver solo totales"}
            </button>
          )}
        </div>
      )}
      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...estiloTablaPortafolio(angosto), color: T.txt }}>
            <thead style={estiloSeccionPortafolio(angosto)}>
              <tr style={estiloFilaPortafolio(angosto)}>
                {columnasPortafolio(angosto).map((h) => (
                  <th key={h} style={{ padding: pad, textAlign: h === "Inversión" || h === "" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={estiloSeccionPortafolio(angosto)}>
              {items.length === 0 ? (
                <tr style={estiloFilaPortafolio(angosto)}><td colSpan={7} style={estiloCeldaCompleta(angosto, { padding: 0 })}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}>🏦</div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"#fafafa"}}>Agrega tu patrimonio</h3>
                      <p style={{fontSize:13,color:"#71717a",maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>Propiedades, fondos de inversión, CDTs, acciones, crypto, vehículos, cuentas de ahorro. Incluye el <strong style={{color:"#a1a1aa"}}>valor actual</strong> de cada activo.</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={openAdd} style={{background:"#22c55e",color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar activo</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>⬆️ Subir tabla Excel de activos</button>}
                      </div>
                      <div style={{background:"#1e1e24",borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#71717a",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Ejemplo de Excel para importar</div>
                        <table style={{width:"100%",fontSize:11,color:"#a1a1aa"}}>
                          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"4px 8px",textAlign:"left",color:"#71717a"}}>Activo</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Valor actual</th><th style={{padding:"4px 8px",color:"#71717a"}}>Tipo</th></tr></thead>
                          <tbody>
                            <tr><td style={{padding:"4px 8px"}}>Apto Bogotá</td><td style={{textAlign:"right",padding:"4px 8px"}}>$850,000,000</td><td style={{padding:"4px 8px"}}>Real Estate</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Fondo Bancolombia</td><td style={{textAlign:"right",padding:"4px 8px"}}>$120,000,000</td><td style={{padding:"4px 8px"}}>Fondo</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>ETF VTI</td><td style={{textAlign:"right",padding:"4px 8px"}}>$45,000,000</td><td style={{padding:"4px 8px"}}>Acciones</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
              ) : conEncabezados(itemsVisibles).map((inv) => {
                if (inv.__cat) return (
                  <tr key={inv.id} onClick={() => !filtrando && setCerrados((c) => ({ ...c, [inv.__clase]: !c[inv.__clase] }))} style={estiloFilaPortafolio(angosto, { background: T.bg2, cursor: filtrando ? "default" : "pointer" })} title={filtrando ? "" : cerrados[inv.__clase] ? "Ver los activos" : "Ocultar los activos"}>
                    <td colSpan={columnasPortafolio(angosto).length} style={estiloCeldaCompleta(angosto, { padding: angosto ? "10px 6px" : "10px 14px", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` })}>
                      <div style={estiloEncabezadoGrupo()}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: T.txt }}>
                          {!filtrando && <span style={{ color: T.txt3, marginRight: 6, display: "inline-block", width: 10 }}>{cerrados[inv.__clase] ? "▸" : "▾"}</span>}
                          {inv.__cat} <span style={{ color: T.txt3, fontWeight: 500 }}>· {inv.__n}</span>
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>
                          {fm(inv.__sub)}
                          <span style={{ color: T.txt3, fontWeight: 500, marginLeft: 6 }}>{fmtPctEs(inv.__pct, 0)}</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
                // La renta vinculada viene anualizada; calcMetrics trabaja en
                // mensual (multiplica por 12 para el cap rate), así que se divide.
                const m = calcMetrics(inv, deudas, trm, (rentaPorActivo[inv.id] || 0) / 12, (gastoPorActivo[inv.id] || 0) / 12);
                const name = getName(inv);
                const loc = getLoc(inv);
                const tipo = getType(inv);
                const va = getVA(inv, trm);
                return (
                  <tr key={inv.id} style={estiloFilaPortafolio(angosto, { borderBottom: `1px solid ${T.border}`, background: "transparent" })}>
                    <td style={{ padding: pad, wordBreak: angosto ? "break-word" : undefined, overflowWrap: angosto ? "anywhere" : undefined, minWidth: angosto ? 0 : undefined }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {inversionesSinOwnerIds.has(inv.id) && (
                          <span
                            onClick={() => openEdit(inv)}
                            title="Sin propietario asignado — los rendimientos no se atribuyen al cálculo de Impuestos"
                            style={{ fontSize: 13, cursor: "pointer", color: "#ef4444", flexShrink: 0 }}
                          >⚠️</span>
                        )}
                        <span>{name}</span>
                      </div>
                      {inv.revisarFiscal && (
                        <div onClick={() => openEdit(inv)} style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", cursor: "pointer", marginBottom: 2 }}>Revisa: ¿qué tipo de inversión es? Elígelo para que tu renta quede bien calculada</div>
                      )}
                      <div style={{ fontSize: 11, color: T.txt3 }}>{[loc, tipo, inv.tasa ? "renta " +fmtTasaEs(inv.tasa)+" anual" : ""].filter(Boolean).join(" • ")}</div>
                      {(()=>{
                        if(!inv.owner || inv.owner==="") return null;
                        if(inv.owner==="na") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>🌐 N/A</div>;
                        if(inv.owner==="own_1") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>👤 Personal</div>;
                        const ow=(owners||[]).find(o=>o.id===inv.owner);
                        return ow ? <div style={{fontSize:9,color:"#71717a",marginTop:2}}>{ow.type==="juridica"?"🏢":"👤"} {ow.name}</div> : null;
                      })()}
                    </td>
                    {angosto ? (<>
                      <td style={{ padding: pad, textAlign: "right", whiteSpace: "nowrap", fontSize: 12 }}>
                        <div style={{ fontWeight: 700 }}>{fm(va)}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: (va-getVC(inv, trm)) >= 0 ? T.green : T.red }}>{fm(va-getVC(inv, trm))}</div>
                      </td>
                      <td style={{ padding: pad, textAlign: "right", whiteSpace: "nowrap", fontSize: 12, color: m.debtTotal > 0 ? T.red : T.txt3 }}>{m.debtTotal>0?fm(m.debtTotal):"-"}</td>
                      <td style={{ padding: pad }}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                      <button onClick={() => { if (!guardEdit(role)) return; onUpdate(items.map(x => x.id === inv.id ? {...x, sim: !(inv.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={inv.sim===false?"Mostrar en simulador":"Ocultar del simulador"}>{inv.sim===false?"⬜":"✅"}</button>
                      <button onClick={() => openEdit(inv)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11 }}>✏️</button>
                      <button onClick={() => { if (!guardEdit(role)) return; if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== inv.id)); }}
                        style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                    </div></td>
                    </>) : (<>
                      <td style={{ padding: "12px 14px", fontSize: 11, color: T.txt3 }}>{tipo}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>{fm(va)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: (va-getVC(inv, trm)) >= 0 ? T.green : T.red }}>{fm(va-getVC(inv, trm))}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: m.debtTotal > 0 ? T.red : T.txt3 }}>{m.debtTotal>0?fm(m.debtTotal):"-"}</td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <button onClick={() => { if (!guardEdit(role)) return; onUpdate(items.map(x => x.id === inv.id ? {...x, sim: !(inv.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={inv.sim===false?"Mostrar en simulador":"Ocultar del simulador"}>{inv.sim===false?"⬜":"✅"}</button>
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}><div style={{display:"flex",alignItems:"center",gap:4}}>
                        <button onClick={() => openEdit(inv)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11 }}>✏️</button>
                        <button onClick={() => { if (!guardEdit(role)) return; if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== inv.id)); }}
                          style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                      </div></td>
                    </>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 26-jul-2026: los bloqueados van DEBAJO de la tabla, con su monto
            visible. Que se vea cuánto hay del otro lado del candado es
            deliberado: un candado que no deja ver qué protege no motiva, y
            además el usuario merece saber que sus totales incluyen algo que
            no está viendo en detalle. */}
        {hayLimite && (
          <BloqueadosPorPlan
            cantidad={bloqueados.length}
            monto={montoBloqueado}
            fmt={fm}
            T={T}
            onUpgrade={onUpgrade}
            que="activos"
          />
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Activo" : "Agregar Activo"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Apartamento, Fondo, Acciones, Terreno" />
              </div>
              <In l="Ubicación" value={form.ubicacion} onChange={(v) => setForm((p) => ({ ...p, ubicacion: v }))} placeholder="Miami, FL" />
              <In l="Propietario fiscal (opcional)" value={form.owner} onChange={(v) => setForm((p) => ({ ...p, owner: v }))} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} />
              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v, fiscalCode: fiscalCodeParaTipo(v, p.fiscalCode, (owners || []).find((o) => o.id === p.owner)) }))} options={["Real Estate", "Fondo de Inversión", "CDT", "Acciones", "Crypto", "Bodega", "Lote", "Vehículo", "Local Comercial", "Renta Fija", "Negocio", "Cash", "Otro"]} />
              {["Real Estate", "Bodega", "Lote", "Local Comercial"].includes(form.tipo) && (
                <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", marginBottom: 8 }}>🏠 ¿Cómo usas este inmueble? (define si depreciación aplica)</div>
                  <select value={form.fiscalCode || "INV_INMUEBLE_HABITACIONAL"} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                    style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer", marginBottom: 10 }}>
                    <option value="INV_INMUEBLE_HABITACIONAL">Habitacional — donde vivo (no se deprecia)</option>
                    <option value="INV_INMUEBLE_ARRENDADO">Arrendado — genera renta (deprecia construcción 2,22%/año Art. 137)</option>
                    <option value="INV_INMUEBLE_COMERCIAL_PROPIO">Uso propio comercial (deprecia construcción)</option>
                    <option value="INV_INMUEBLE_VACANTE">Vacante — sin uso productivo (no deprecia)</option>
                  </select>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>% del valor que es terreno (no depreciable)</label>
                  <input type="number" min="0" max="100" value={form.pctTerreno ?? ""} onChange={(e) => setForm((p) => ({ ...p, pctTerreno: e.target.value }))} placeholder="Default: 30 (urbanos)"
                    style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "8px 10px", borderRadius: 6, fontSize: 12, outline: "none" }} />
                  <div style={{ fontSize: 10, color: "#71717a", marginTop: 4, lineHeight: 1.5 }}>Solo la construcción se deprecia fiscalmente (Art. 131 ET). El terreno no. Típico urbano: 30%. Si es una finca o lote con poca construcción, puede ser 80%+.</div>
                </div>
              )}
              <In l="Moneda del valor" value={form.moneda || "COP"} onChange={(v) => setForm((p) => ({ ...p, moneda: v }))} options={[{v:"COP",l:"🇨🇴 COP (pesos)"},{v:"USD",l:"🇺🇸 USD (se convierte a la TRM)"}]} />
              <In l="Valor Actual" value={form.va} onChange={(v) => setForm((p) => ({ ...p, va: v }))} type="number" placeholder="0" />
              <In l="Valor Compra" value={form.vc} onChange={(v) => setForm((p) => ({ ...p, vc: v }))} type="number" placeholder="0" />
              {/* ALERTA ANTI-TYPO (20-jul-2026, Santiago): Puerto Madero quedó
                  con valor $11.7M vs costo $4.5B → ganancia -$4.5B por ceros
                  faltantes. Si el valor actual es <10% del costo, avisamos. */}
              {(() => {
                const vaN = Math.abs(parseFloat(form.va)) || 0;
                const vcN = Math.abs(parseFloat(form.vc)) || 0;
                if (vaN > 0 && vcN > 0 && vaN < vcN * 0.1) {
                  const perdidaPct = ((1 - vaN / vcN) * 100).toFixed(0);
                  return (
                    <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.35)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#f97316", lineHeight: 1.5 }}>
                      ⚠️ <strong>Revisa los ceros:</strong> el valor actual (${vaN.toLocaleString("es-CO")}) es {perdidaPct}% menor que lo que costó (${vcN.toLocaleString("es-CO")}). Si es correcto, ignora este aviso — pero si el activo vale ${(vaN/1e6).toFixed(1)} millones y costó ${(vcN/1e9).toFixed(1)} mil millones, probablemente faltan ceros en el valor actual.
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
                {/* 21-oct-2026 — Aquí nace el ingreso del activo (un solo origen).
                    Santiago: "activo Puerto Madero: cuánto vale, cuánto renta, y esa
                    renta si es todo el año o unos meses; también cuánto se valoriza". */}
                <div style={{fontSize:11,fontWeight:700,color:T.txt2,marginBottom:10}}>💰 ¿Este activo te genera ingreso?</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[["no","No"],["si","Sí"]].map(([v,l]) => <button key={v} type="button" onClick={() => setForm((p) => ({ ...p, genera: v }))} style={{flex:1,padding:"9px 12px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,border:`1px solid ${(form.genera||"no")===v?T.green:T.border}`,background:(form.genera||"no")===v?"rgba(34,197,94,0.12)":"transparent",color:(form.genera||"no")===v?T.green:T.txt2}}>{l}</button>)}
                </div>
                {form.genera === "si" && (<>
                  <div style={{fontSize:11,fontWeight:600,color:T.txt3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>¿Cómo?</div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    {[["fijo","Renta fija: $ al mes"],["tasa","Rendimiento: % anual sobre el valor"]].map(([v,l]) => <button key={v} type="button" onClick={() => setForm((p) => ({ ...p, modo: v }))} style={{flex:1,padding:"8px 10px",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600,border:`1px solid ${(form.modo||"fijo")===v?T.blue:T.border}`,background:(form.modo||"fijo")===v?"rgba(59,130,246,0.12)":"transparent",color:(form.modo||"fijo")===v?T.blue:T.txt2}}>{l}</button>)}
                  </div>
                  {(form.modo||"fijo") === "fijo" ? (
                    <In l="Cuánto te paga al mes ($)" value={form.renta} onChange={(v) => { const va=parseFloat(form.va)||0; const newTasa=va>0&&v?((parseFloat(v)*12/va)*100).toFixed(1):""; setForm((p) => ({ ...p, renta: v, tasa: newTasa, rentaOrigen: "derivada", tasaLegacy: false })); }} type="number" placeholder="Ej: 4.200.000" />
                  ) : (
                    <div style={{display:"flex",gap:8}}>
                      <div style={{flex:1}}><In l="Tasa anual %" value={form.tasa} onChange={(v) => { const va=parseFloat(form.va)||0; const rec=Math.max(0,Math.min(100,parseFloat(form.recibePct)||100)); const newRenta=va>0&&v?Math.round(va*parseFloat(v)/100/12*rec/100):""; setForm((p) => ({ ...p, tasa: v, renta: String(newRenta), rentaOrigen: "manual", tasaLegacy: false })); }} type="number" placeholder="Ej: 21" /></div>
                      <div style={{flex:1}}><In l="Qué parte recibes (%)" value={form.recibePct ?? "100"} onChange={(v) => { const va=parseFloat(form.va)||0; const t=parseFloat(form.tasa)||0; const rec=Math.max(0,Math.min(100,parseFloat(v)||0)); setForm((p) => ({ ...p, recibePct: v, renta: va>0&&t>0?String(Math.round(va*t/100/12*rec/100)):p.renta })); }} type="number" placeholder="100" /></div>
                    </div>
                  )}
                  {(form.modo||"fijo") === "tasa" && parseFloat(form.va) > 0 && parseFloat(form.tasa) > 0 && (
                    <div style={{fontSize:12,color:T.green,marginTop:-4,marginBottom:10}}>≈ ${Math.round(parseFloat(form.va)*parseFloat(form.tasa)/100/12*(Math.max(0,Math.min(100,parseFloat(form.recibePct)||100))/100)).toLocaleString("es-CO")} al mes{(parseFloat(form.recibePct)||100) < 100 ? " · el resto se reinvierte" : ""}</div>
                  )}
                  <div style={{fontSize:11,fontWeight:600,color:T.txt3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>¿Cuándo?</div>
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    {[["todo","Todo el año"],["meses","Solo unos meses"],["tramos","Cambió durante el año"],["anual","Un pago al año"]].map(([v,l]) => <button key={v} type="button" onClick={() => setForm((p) => ({ ...p, vigencia: v, tramos: v === "tramos" && !(p.tramos && p.tramos.length) ? [{ desde: "1", hasta: "12", valor: (p.modo || "fijo") === "tasa" ? (p.va || "") : (p.renta || "") }] : p.tramos }))} style={{flex:1,minWidth:120,padding:"8px 10px",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:600,border:`1px solid ${(form.vigencia||"todo")===v?T.blue:T.border}`,background:(form.vigencia||"todo")===v?"rgba(59,130,246,0.12)":"transparent",color:(form.vigencia||"todo")===v?T.blue:T.txt2}}>{l}</button>)}
                  </div>
                  {(form.vigencia||"todo") === "meses" && <div style={{display:"flex",gap:8}}><div style={{flex:1}}><In l="Desde" value={form.desdeMes||"1"} onChange={(v) => setForm((p) => ({ ...p, desdeMes: v }))} options={[{v:1,l:"Enero"},{v:2,l:"Febrero"},{v:3,l:"Marzo"},{v:4,l:"Abril"},{v:5,l:"Mayo"},{v:6,l:"Junio"},{v:7,l:"Julio"},{v:8,l:"Agosto"},{v:9,l:"Septiembre"},{v:10,l:"Octubre"},{v:11,l:"Noviembre"},{v:12,l:"Diciembre"}].map((m) => ({ v: String(m.v), l: m.l }))} /></div><div style={{flex:1}}><In l="Hasta" value={form.hastaMes||"12"} onChange={(v) => setForm((p) => ({ ...p, hastaMes: v }))} options={[{v:1,l:"Enero"},{v:2,l:"Febrero"},{v:3,l:"Marzo"},{v:4,l:"Abril"},{v:5,l:"Mayo"},{v:6,l:"Junio"},{v:7,l:"Julio"},{v:8,l:"Agosto"},{v:9,l:"Septiembre"},{v:10,l:"Octubre"},{v:11,l:"Noviembre"},{v:12,l:"Diciembre"}].map((m) => ({ v: String(m.v), l: m.l }))} /></div></div>}
                  {(form.vigencia||"todo") === "tramos" && (() => {
                    const esTasa = (form.modo || "fijo") === "tasa";
                    const tr = form.tramos || [];
                    const setT = (i, k, v) => setForm((p) => ({ ...p, tramos: (p.tramos || []).map((t, j) => j === i ? { ...t, [k]: v } : t) }));
                    const montos = montosDeTramos(form);
                    const total = montos.reduce((a, b) => a + b, 0);
                    return <div style={{marginBottom:10}}>
                      <div style={{fontSize:12,color:T.txt2,lineHeight:1.5,marginBottom:8}}>Escribe cada periodo: de qué mes a qué mes y {esTasa ? "cuánto tenías invertido" : "cuánto te pagó al mes"}. Los meses que no pongas cuentan en cero.</div>
                      {tr.map((t, i) => <div key={i} style={{display:"flex",gap:6,alignItems:"flex-end",marginBottom:6,flexWrap:"wrap"}}>
                        <div style={{flex:"1 1 100px"}}><In l="Desde" value={t.desde} onChange={(v) => setT(i, "desde", v)} options={[{v:1,l:"Enero"},{v:2,l:"Febrero"},{v:3,l:"Marzo"},{v:4,l:"Abril"},{v:5,l:"Mayo"},{v:6,l:"Junio"},{v:7,l:"Julio"},{v:8,l:"Agosto"},{v:9,l:"Septiembre"},{v:10,l:"Octubre"},{v:11,l:"Noviembre"},{v:12,l:"Diciembre"}].map((m) => ({ v: String(m.v), l: m.l }))} /></div>
                        <div style={{flex:"1 1 100px"}}><In l="Hasta" value={t.hasta} onChange={(v) => setT(i, "hasta", v)} options={[{v:1,l:"Enero"},{v:2,l:"Febrero"},{v:3,l:"Marzo"},{v:4,l:"Abril"},{v:5,l:"Mayo"},{v:6,l:"Junio"},{v:7,l:"Julio"},{v:8,l:"Agosto"},{v:9,l:"Septiembre"},{v:10,l:"Octubre"},{v:11,l:"Noviembre"},{v:12,l:"Diciembre"}].map((m) => ({ v: String(m.v), l: m.l }))} /></div>
                        <div style={{flex:"2 1 150px"}}><In l={esTasa ? "Invertido ($)" : "Pago al mes ($)"} value={t.valor} onChange={(v) => setT(i, "valor", v)} type="number" placeholder={esTasa ? "Ej: 1.500.000.000" : "Ej: 20.000.000"} /></div>
                        {tr.length > 1 && <button type="button" onClick={() => setForm((p) => ({ ...p, tramos: (p.tramos || []).filter((_, j) => j !== i) }))} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.txt3,borderRadius:8,padding:"8px 10px",cursor:"pointer",marginBottom:12}}>✕</button>}
                      </div>)}
                      <button type="button" onClick={() => setForm((p) => { const ult = (p.tramos || [])[(p.tramos || []).length - 1]; const d = ult ? Math.min(12, (parseInt(ult.hasta) || 12) + 1) : 1; return { ...p, tramos: [...(p.tramos || []), { desde: String(d), hasta: "12", valor: "" }] }; })} style={{background:"transparent",border:`1px dashed ${T.blue}`,color:T.blue,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:8}}>+ Agregar otro periodo</button>
                      {esTasa && !(parseFloat(form.tasa) > 0) && <div style={{fontSize:11,color:T.txt2}}>Escribe arriba la tasa anual para calcular la renta de cada periodo.</div>}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,fontSize:10,color:T.txt3,marginTop:4}}>
                        {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => <div key={m} style={{background:T.bg2,borderRadius:6,padding:"4px 6px",textAlign:"center"}}>{m}<br/><span style={{color:montos[i]>0?T.green:T.txt3,fontWeight:700}}>{montos[i] > 0 ? "$" + (montos[i] >= 1e6 ? (montos[i] / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M" : montos[i].toLocaleString("es-CO")) : "—"}</span></div>)}
                      </div>
                      <div style={{fontSize:12,color:T.green,marginTop:6,fontWeight:600}}>Total del año: ${total.toLocaleString("es-CO")}</div>
                    </div>;
                  })()}
                  {(form.vigencia||"todo") === "anual" && <In l="En qué mes" value={form.mesPago||"12"} onChange={(v) => setForm((p) => ({ ...p, mesPago: v }))} options={[{v:1,l:"Enero"},{v:2,l:"Febrero"},{v:3,l:"Marzo"},{v:4,l:"Abril"},{v:5,l:"Mayo"},{v:6,l:"Junio"},{v:7,l:"Julio"},{v:8,l:"Agosto"},{v:9,l:"Septiembre"},{v:10,l:"Octubre"},{v:11,l:"Noviembre"},{v:12,l:"Diciembre"}].map((m) => ({ v: String(m.v), l: m.l }))} />}
                  <In l="Nombre del ingreso (opcional)" value={form.ingresoNombre||""} onChange={(v) => setForm((p) => ({ ...p, ingresoNombre: v }))} placeholder={`Renta — ${form.nombre || "activo"}`} />
                  <div style={{fontSize:10,color:T.txt3,marginTop:-6,marginBottom:8,lineHeight:1.5}}>Al guardar, este ingreso queda creado y vinculado al activo; en Ingresos aparece como "viene de Patrimonio" y se edita aquí.</div>
                  {(() => {
                    const otros = (user?.ingresos || []).filter((x) => x && x.activoId === editId && !x.desdePatrimonio && x.sim !== false);
                    if (!editId || !otros.length) return null;
                    return <div style={{fontSize:11,color:T.txt2,lineHeight:1.5,marginBottom:8}}>Además, en Ingresos hay {otros.length} ingreso{otros.length > 1 ? "s" : ""} vinculado{otros.length > 1 ? "s" : ""} a este activo: {otros.map((x) => `${x.nombre} ($${Math.round(x.mensual || 0).toLocaleString("es-CO")}/mes)`).join(", ")}.</div>;
                  })()}
                </>)}
                <div style={{marginTop:8}}>
                  <In l="📈 ¿Cuánto se valoriza al año? (%)" value={form.valorizacionPct} onChange={(v) => setForm((p) => ({ ...p, valorizacionPct: v }))} type="number" placeholder="Ej: 5" />
                  <div style={{fontSize:10,color:T.txt3,marginTop:-6,lineHeight:1.5}}>Cuánto sube el valor del activo al año. No es renta: se suma aparte al proyectar tu patrimonio.</div>
                </div>
                {/* 14-sep-2026 (Santiago: "poner en una sola casilla todos los
                    gastos que tiene esa propiedad es poco práctico").
                    Tenía razón, y los datos lo confirman: de 187 activos
                    cargados, UNO solo usaba este campo. Nadie puede meter
                    predial, administración, seguros y mantenimiento en una
                    casilla y después acordarse de qué se compone el número, ni
                    actualizar uno sin recalcular a mano los otros.
                    Los gastos ahora se cargan uno por uno en su sección y se
                    vinculan al activo. Acá solo se muestra el resultado. */}
                <div style={{ marginTop: 10, padding: "11px 13px", borderRadius: 10,
                      background: T.bg3, border: "1px solid " + T.border }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3,
                        letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
                    Gastos de este activo
                  </div>
                  {(() => {
                    const anual = (typeof gastoPorActivo !== "undefined" && editId)
                      ? (gastoPorActivo[editId] || 0) : 0;
                    // El valor viejo del campo único se sigue mostrando si
                    // existe: es dato real del usuario y borrarlo de la vista
                    // sin avisar sería peor que la duplicación que corregimos.
                    const legacy = Number(form.gastosMes) || 0;
                    if (!anual && !legacy) {
                      return (
                        <div style={{ fontSize: 11, color: T.txt3, lineHeight: 1.55 }}>
                          Sin gastos vinculados. Cárgalos en <strong style={{ color: T.txt2 }}>Gastos</strong>{" "}
                          y elige este activo en “Activo al que pertenece”: predial,
                          administración, seguros y mantenimiento como registros
                          separados, cada uno con su propia vigencia.
                        </div>
                      );
                    }
                    return (
                      <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
                        {anual > 0 && (
                          <div>
                            Vinculados desde Gastos:{" "}
                            <strong style={{ color: T.txt }}>
                              ${Math.round(anual / 12).toLocaleString("es-CO")}/mes
                            </strong>{" "}
                            <span style={{ color: T.txt3 }}>
                              (${Math.round(anual).toLocaleString("es-CO")} al año)
                            </span>
                          </div>
                        )}
                        {legacy > 0 && (
                          <div style={{ marginTop: 5, fontSize: 11, color: "#f97316" }}>
                            Además hay ${legacy.toLocaleString("es-CO")}/mes cargados en el
                            campo antiguo. Conviene pasarlos a Gastos como registros
                            separados para saber de qué se componen.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {false && <div style={{ gridColumn: "1/-1", background: T.blue + "10", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.blue }}>💡 Si este activo genera renta mensual (arriendo, dividendos, rendimientos), ponla en el módulo de <strong>Ingresos</strong>. Aquí solo va el valor del activo.</div>
              </div>}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: T.green, color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    
    <Disclaimer variante="general" idioma="es" T={T} compacto />
  </div>
  );
}
