import { useState } from "react";
import BuscadorLista, { filtrarPorTexto } from "./BuscadorLista";
import BarraComposicion from "./BarraComposicion";
import { separarPorLimite } from "../lib/limitePlan.js";
import BloqueadosPorPlan from "./BloqueadosPorPlan";
import NumberInput from "./NumberInput";
import SimToggleInfo from "./SimToggleInfo";
import PageHeader from "./PageHeader";
import { exportIngresosExcel } from "../lib/excelExport.js";
import FrecuenciaSelector, { labelMontoSegunFrecuencia } from "./FrecuenciaSelector";
import TemplateSelector, { detectarTemplate } from "./TemplateSelector";
import TablaMensual from "./TablaMensual";
import { togglePagado, getFrecuencia, estaPagadoEnAño, factorDeFrecuencia, labelVigenciaBadge, totalAnualItem, getMontosMensuales, promedioMesActivo, mesesVaciosFuturos, montoPromedioMensual, montoDelMes } from "../lib/flowHelpers.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import { getFiscalWarnings } from "../lib/normalize.js";
import { obtenerInfoRetencion } from "../lib/retencionesTax.js";

import { C } from "../lib/designTokens.js";

// ─── Aportes obligatorios por SMMLV (Colombia, Ley 100) ────────────────────
// SMMLV 2026 = $1.750.905. Tope IBC = 25 SMMLV (Art. 18 Ley 100).
// Fondo de Solidaridad Pensional adicional al 4% trabajador (Art. 27 Ley 100):
//   IBC < 4 SMMLV     → +0%
//   IBC 4-16 SMMLV    → +1%
//   IBC 16-17 SMMLV   → +1.2%
//   IBC 17-18 SMMLV   → +1.4%
//   IBC 18-19 SMMLV   → +1.6%
//   IBC 19-20 SMMLV   → +1.8%
//   IBC ≥ 20 SMMLV    → +2.0%
const SMMLV_2026 = 1_750_905;
const TOPE_IBC_SMMLV = 25;
function fondoSolidaridadPct(nSmmlv) {
  if (nSmmlv < 4) return 0;
  if (nSmmlv < 16) return 0.01;
  if (nSmmlv < 17) return 0.012;
  if (nSmmlv < 18) return 0.014;
  if (nSmmlv < 19) return 0.016;
  if (nSmmlv < 20) return 0.018;
  return 0.02;
}
function aportePensionPorSmmlv(nSmmlv) {
  if (!nSmmlv || nSmmlv <= 0) return 0;
  const ibc = nSmmlv * SMMLV_2026;
  const tasa = 0.04 + fondoSolidaridadPct(nSmmlv);
  return Math.round(ibc * tasa);
}
function aporteSaludPorSmmlv(nSmmlv) {
  if (!nSmmlv || nSmmlv <= 0) return 0;
  return Math.round(nSmmlv * SMMLV_2026 * 0.04);
}

// Commit 9.9: tokens unificados. Antes bg2 era #18181b (distinto del resto del app
// que usa #141418). Esa diferencia de 4 pixeles en luminosidad creaba la sensación
// de "diseño inconsistente" entre módulos.
const T = {
  bg2: C.surface, bg3: C.raised,
  card: "#111113", border: C.border,
  txt: C.text, txt2: C.muted, txt3: C.subtle,
  green: C.ok, greenDim: "rgba(34,197,94,0.1)",
  red: C.danger, redDim: "rgba(239,68,68,0.08)",
  blue: C.accent, orange: C.warn,
  ch: [C.ok, C.accent, C.warn, C.purple, "#ec4899", "#22d3ee", "#eab308"],
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("en-US");
const CATS = [{v:"Salario",l:"💼 Salario / Nómina"},{v:"Cesantías",l:"💵 Cesantías / Intereses cesantías"},{v:"Honorarios",l:"📋 Honorarios / Servicios"},{v:"Arriendo",l:"🏠 Arrendamiento"},{v:"Intereses bancarios",l:"🏦 Intereses bancarios / CDT"},{v:"Utilidad FIC",l:"📈 Utilidad de fondo (FIC)"},{v:"Rendimiento",l:"💰 Rendimientos financieros (otros)"},{v:"Dividendos",l:"📊 Dividendos"},{v:"Inversión",l:"🏦 Inversión / Venta activos"},{v:"Pensión",l:"🏛️ Pensión"},{v:"Negocio",l:"🏢 Ingresos de negocio"},{v:"Otro",l:"📝 Otros ingresos"}];

// Sub-opciones de fiscalCode por categoría ambigua. Si la categoría no está
// aquí, el fiscalCode se deriva automáticamente vía normalize.js (no pregunta).
const FISCAL_SUBOPTIONS = {
  "Honorarios": {
    question: "🧾 ¿Tenés 2+ empleados contratados ≥ 83% del año? (Art. 206 #10 ET)",
    help: "Define si aplica renta exenta 25%. Consultá con tu contador si tenés duda.",
    options: [
      { v: "LAB_HONORARIOS_SIN_EMPLEADOS", l: "No — tributo como cédula de trabajo SIN exenta 25%" },
      { v: "LAB_HONORARIOS_CON_EMPLEADOS", l: "Sí — aplico renta exenta 25% (Art. 206 #10)" },
    ],
  },
  "Arriendo": {
    question: "🏠 ¿Qué arrendás?",
    help: "Inmueble (casa, bodega, local) va a cédula NO laboral con gastos deducibles. Mueble (equipos, maquinaria) va a cédula de capital.",
    options: [
      { v: "NOL_ARRIENDO_INMUEBLE", l: "Inmueble (casa, bodega, local, oficina)" },
      { v: "CAP_ARRIENDO_MUEBLE", l: "Mueble o equipo (maquinaria, vehículo, etc.)" },
    ],
  },
  "Dividendos": {
    question: "📊 ¿Qué tipo de dividendos?",
    help: "Cada tipo tributa diferente según Art. 48/49/242/254 ET.",
    options: [
      { v: "DIV_ART49_GRAVADOS", l: "Sociedad nacional — parte gravada (Art. 49)" },
      { v: "DIV_ART49_NO_GRAVADOS", l: "Sociedad nacional — parte no gravada (Art. 49)" },
      { v: "DIV_EXTERIOR", l: "Sociedad extranjera (Art. 254)" },
      { v: "DIV_INTERSOCIETARIOS", l: "Inter-societario (Art. 48, solo persona jurídica)" },
    ],
  },
  "Inversión": {
    question: "🏦 ¿La venta del activo cumple >2 años de tenencia?",
    help: "Activos >2 años van a ganancia ocasional (tarifa 15%). <2 años son renta ordinaria.",
    options: [
      { v: "CAP_VENTA_ACTIVOS", l: "No, <2 años — renta ordinaria" },
      { v: "GO_VENTA_ACTIVO_MAS_2A", l: "Sí, >2 años — ganancia ocasional 15%" },
    ],
  },
};

// Default fiscalCode por categoría para items nuevos (antes de que el usuario
// aclare en el sub-select). Replica el comportamiento conservador del normalizer.
const DEFAULT_FISCAL_CODE = {
  "Salario": "LAB_SALARIO",
  "Cesantías": "LAB_PRESTACIONES_CESANTIAS",
  "Honorarios": "LAB_HONORARIOS_SIN_EMPLEADOS",
  "Arriendo": "NOL_ARRIENDO_INMUEBLE",
  "Intereses bancarios": "CAP_INTERESES_BANCARIOS",
  "Utilidad FIC": "CAP_FIC",
  "Rendimiento": "CAP_RENDIMIENTO_GENERICO",
  "Dividendos": "DIV_ART49_GRAVADOS",
  "Inversión": "CAP_VENTA_ACTIVOS",
  "Pensión": "PEN_JUBILACION",
  "Negocio": "NOL_NEGOCIO",
  "Otro": "NOL_OTROS",
};

// Estado inicial del form (centralizado para evitar repetición y drift)
const INITIAL_FORM = {
  nombre: "", categoria: "Salario", fiscalCode: "LAB_SALARIO",
  mensual: "", tipo: "fijo", fuente: "",
  capital: "", tasa: "", tasaModo: "anual", moneda: "COP", owner: "",
  // Commit 1.5: aportes obligatorios (sólo aplican a Salario)
  aportePension: "", aporteSalud: "",
  // Commit IBC: modo y # SMMLV (alternativa al valor en pesos)
  aportePensionModo: "valor", aportePensionSmmlv: "",
  aporteSaludModo: "valor", aporteSaludSmmlv: "",
  // Commit 4 Tarea 3: tipo de vinculación (define si auto-crear cesantías)
  // "ordinario" = salario regular con cesantías por separado (default)
  // "integral"  = salario integral Art. 132 CST (cesantías ya incluidas)
  // "no_aplica" = honorarios, pensión, etc. (no hay cesantías)
  tipoVinculacion: "ordinario",
  // Sesión 28-abr-2026 noche: configuración de retención en la fuente.
  // - retencionAplica: true (default) → motor estima vía tabla retencionesTax.js
  //                    false → user marca "no aplica" (ej: inquilino persona natural)
  // - retencionTasaCustom: "" (default) → usa tasa de la tabla
  //                        "0.05" → user override (5% custom)
  retencionAplica: true,
  retencionTasaCustom: "",
  // NUEVO (18-jul-2026): Frecuencia y mes de pago para flujo anual.
  // Default "mensual" mantiene comportamiento actual. Retrocompat total.
  frecuencia: "mensual",
  mesPago: 1,
  // Fase 4 flujo anual (18-jul-2026): rango de vigencia (solo mensual).
  // Ej: Rapicredit paga cada mes desde julio a diciembre → desdeMes=7, hastaMes=12
  desdeMes: 1,
  hastaMes: 12,
  // Fase Variable (18-jul-2026 noche): array de 12 montos mensuales.
  // Solo se usa cuando frecuencia === "variable". Cada posición corresponde
  // a un mes (0=enero, 11=diciembre). Default: 12 ceros.
  montosMensuales: new Array(12).fill(0),
};

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />}
    </div>
  );

export default function IngresosModule({ ingresos, owners, onUpdate, trm, fmt, onImport, user, plan, onUpgrade}) {
  const fm = fmt || _fm;
  // Fase 3 commit 5 — gating reader: si role==='reader', los handlers
  // de escritura abortan vía guardEdit() y emiten 'fp3-reader-blocked'.
  // App.jsx muestra el toast unificado. Los readers pueden ver y abrir
  // los modales pero no persisten cambios (RLS también bloquea en BD).
  const { role } = useRole();
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);

  const scanImage = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setScanning(true);
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = ev.target.result.split(",")[1];
          const mediaType = file.type || "image/jpeg";
          const res = await fetch("/.netlify/functions/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64, type: "ingreso", mediaType, userId: user?.id })
          });
          const data = await res.json();
          if (data.success && data.data) {
            const d = data.data;
            setForm(p => ({
              ...p,
              nombre: d.nombre || p.nombre,
              mensual: d.mensual || p.mensual,
              categoria: d.categoria || p.categoria,
              fuente: d.fuente || p.fuente,
              capital: d.capital ? String(d.capital) : p.capital,
              tasa: d.tasa ? String(d.tasa) : p.tasa,
            }));
            setShowForm(true);
            alert("✅ Documento leído" + (d.confianza === "alta" ? "" : " (revisa los datos)") + "\n\n" + (d.nombre || "") + ": $" + (d.mensual || 0).toLocaleString("es-CO") + " — " + (d.categoria || ""));
          } else {
            alert("⚠️ No se pudo leer la imagen. Intenta con una foto más clara.");
          }
          setScanning(false);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        alert("Error: " + err.message);
        setScanning(false);
      }
    };
    input.click();
  };
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  // UX flujo anual (18-jul-2026): modo de captura del monto.
  // 'porPago' = user ingresa el monto de cada pago (semestre, trimestre, etc)
  // 'anual'   = user ingresa el total anual, sistema divide por N
  const [modoIngreso, setModoIngreso] = useState("porPago");
  // UX simplificación: plantilla elegida.
  const [templateElegido, setTemplateElegido] = useState(null);

  // Helper: decide si un campo se muestra según el template elegido.
  // UX iter 4 (18-jul-2026 noche): al editar, respetar el template DETECTADO
  // del item existente. Antes forzaba mostrar todo, causando redundancia con
  // los chips de frecuencia. Ahora si es un ingreso mensual todo el año,
  // NO se muestran los chips (no aporta valor). Si es un caso complejo
  // (trimestral, semestral, único), el template detectado será "avanzado"
  // y se mostrará todo.
  const mostrarCampo = (campo) => {
    if (!templateElegido) return false;
    return templateElegido.camposVisibles.includes(campo);
  };
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(new Set());
  // Commit 11 Tarea 3: feedback visible para el usuario sobre lo que paso
  // con la auto-creacion de cesantias (creada / saltada / no aplica). El silencio
  // del Commit 4 confundia a usuarios que no veian si el sistema actuo o no.
  // Estructura: { tipo: "creada"|"saltada"|null, mensaje: "..." }
  const [cesantiasNotif, setCesantiasNotif] = useState(null);

  const items = ingresos || [];
  
  // 26-jul-2026 (Santiago): buscador por nombre y categoría.
  // `activos` y los totales usan la lista COMPLETA: el buscador filtra lo que
  // se ve, no lo que se calcula. Si al buscar cambiaran los totales, el
  // usuario podría leer un total parcial como si fuera el suyo.
  const allItems = filtrarPorTexto(items, busqueda, ["nombre", "tipo", "categoria"]);
  const activos = items.filter((i) => i.sim !== false);

  // 26-jul-2026 — AUDITORÍA DE VARIABLES. "Total mensual" y "Total anual" —los
  // indicadores que se ven al abrir la sección— sumaban `mensual` CRUDO: un
  // ingreso con vigencia oct-dic contaba su valor pleno los 12 meses, y uno
  // con tabla variable ignoraba la tabla. El dashboard sí usaba el promedio
  // correcto, así que las dos pantallas mostraban totales distintos del mismo
  // dato. Mismo criterio que el resto del motor: montoPromedioMensual.
  const totalMes = activos.reduce((s, i) => s + (montoPromedioMensual(i) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  // 26-jul-2026 (Santiago: "si uno pone ingreso de octubre a dic, el ingreso
  // mensual en esos meses no es promedio, es el valor completo, para uno ver la
  // realidad de ese mes").
  // Tenía razón en la lectura: el rótulo decía "Total Mensual" y mostraba un
  // PROMEDIO ANUAL, lo que invita a leerlo como "lo que entra este mes". Son
  // dos preguntas distintas y ahora se muestran las dos, cada una con su nombre.
  const _mesHoy = new Date().getMonth() + 1;
  const _añoHoy = new Date().getFullYear();
  const totalEsteMes = activos.reduce((s, i) => s + (montoDelMes(i, _añoHoy, _mesHoy) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const _MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fijos = activos.filter((i) => i.tipo === "fijo").reduce((s, i) => s + (montoPromedioMensual(i) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const variables = totalMes - fijos;

  const toggleSelect = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === allItems.length ? new Set() : new Set(allItems.map((i) => i.id)));

  // Fase 2 flujo anual (18-jul-2026): toggle pagado/pendiente por año.
  const añoActual = new Date().getFullYear();
  const togglePagoItem = (item) => {
    if (!guardEdit(role)) return;
    onUpdate(items.map(i => i.id === item.id ? togglePagado(i, añoActual) : i));
  };

  const deleteSelected = () => {
    if (!guardEdit(role)) return;
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} ingreso(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id))); // only deletes standalone, not inv-derived
    setSelected(new Set());
  };
  const handleSave = () => {
    if (!guardEdit(role)) return;
    const isSalario = form.categoria === "Salario";
    // Fix: derivar mensual desde capital × tasa si mensual quedó en 0 pero hay capital y tasa.
    // Cubre el caso donde el usuario edita un ingreso, actualiza la tasa, pero los
    // onChange encadenados no recalcularon mensual por race condition o porque mensual
    // estaba vacío al cargar. Net de seguridad final antes de persistir.
    let mensualFinal = Number(form.mensual) || 0;
    const capitalFinal = Number(form.capital) || 0;
    const tasaFinal = Number(form.tasa) || 0;
    if (mensualFinal === 0 && capitalFinal > 0 && tasaFinal > 0) {
      const tm = form.tasaModo || "anual";
      mensualFinal = tm === "anual" ? Math.round((capitalFinal * tasaFinal / 100) / 12) : Math.round(capitalFinal * tasaFinal / 100);
    }
    // UX flujo anual (18-jul-2026): si modoIngreso === 'anual', el user ingresó
    // el TOTAL ANUAL. Convertir a "monto por período" según el caso:
    //   - Frecuencia NO mensual: dividir por factor (trimestral=4, semestral=2, anual=1)
    //   - Frecuencia mensual (con o sin vigencia limitada): dividir por # meses activos
    // Para salarios y honorarios este flag no aplica (siempre bruto mensual).
    const frecuenciaFinal = form.frecuencia || "mensual";
    // Fase Variable (18-jul-2026 noche): si el ingreso es variable, el
    // `mensual` guardado es el PROMEDIO de los 12 meses (para retrocompat
    // con lugares que usan item.mensual como métrica global).
    if (frecuenciaFinal === "variable") {
      const montos = Array.isArray(form.montosMensuales) ? form.montosMensuales : new Array(12).fill(0);
      const total = montos.reduce((s, m) => s + (Number(m) || 0), 0);
      mensualFinal = Math.round(total / 12);
    }
    if (!isSalario && modoIngreso === "anual") {
      if (frecuenciaFinal !== "mensual") {
        const factor = factorDeFrecuencia(frecuenciaFinal);
        mensualFinal = Math.round(mensualFinal / factor);
      } else {
        // Mensual: dividir por # meses activos
        const activos = (Number(form.hastaMes) || 12) - (Number(form.desdeMes) || 1) + 1;
        mensualFinal = Math.round(mensualFinal / Math.max(1, activos));
      }
    }
    const item = { ...form, mensual: mensualFinal, capital: capitalFinal, tasa: tasaFinal };
    // Commit 1.5: persistir aportes obligatorios en shape anidado, sólo para Salario
    if (isSalario) {
      item.aportes = {
        pension: Number(form.aportePension) || 0,
        salud: Number(form.aporteSalud) || 0,
        // Commit IBC: persistir modo y # SMMLV para reconstruir UI al editar
        pensionModo: form.aportePensionModo || "valor",
        pensionSmmlv: Number(form.aportePensionSmmlv) || 0,
        saludModo: form.aporteSaludModo || "valor",
        saludSmmlv: Number(form.aporteSaludSmmlv) || 0,
      };
    }
    // Los campos del form no se persisten como top-level (viven dentro de item.aportes)
    delete item.aportePension;
    delete item.aporteSalud;
    delete item.aportePensionModo;
    delete item.aportePensionSmmlv;
    delete item.aporteSaludModo;
    delete item.aporteSaludSmmlv;

    // Commit 4 Tarea 3 (REVISADO Commit 11): persistir tipoVinculacion en el item del salario.
    // Solo si es Salario. Si NO es salario, NO debe existir tipoVinculacion en el item.
    if (isSalario) {
      item.tipoVinculacion = form.tipoVinculacion || "ordinario";
    } else {
      // Para no-salario: limpiar el campo si vino del spread de form
      delete item.tipoVinculacion;
    }

    // Sesión 28-abr-2026 noche: persistir retencionConfig si difiere del default.
    // Si está en default (aplica=true + sin tasaCustom), NO guardamos nada para
    // mantener limpio el item. El motor usa default automáticamente.
    const retencionAplica = form.retencionAplica !== false; // default true
    const retencionTasaCustom = form.retencionTasaCustom !== "" && form.retencionTasaCustom != null
      ? Number(form.retencionTasaCustom) / 100  // user pone 7 → guardamos 0.07
      : null;
    if (!retencionAplica || retencionTasaCustom != null) {
      item.retencionConfig = {
        ...(retencionAplica ? {} : { aplica: false }),
        ...(retencionTasaCustom != null ? { tasaCustom: retencionTasaCustom } : {}),
      };
    } else {
      delete item.retencionConfig;
    }
    // Limpiar campos del form que no se persisten como top-level
    delete item.retencionAplica;
    delete item.retencionTasaCustom;

    let updated;
    if (editId) {
      updated = items.map((i) => (i.id === editId ? { ...item, id: editId } : i));
    } else {
      item.id = "ing_" + Date.now();
      updated = [...items, item];

      // Commit 4 Tarea 3 (mejorado en Commit 11): AUTO-CREACIÓN DE CESANTÍAS.
      // Solo en CREACIÓN (no en edición) y solo si:
      //   - categoría = "Salario"
      //   - tipoVinculacion = "ordinario"
      //   - hay un monto mensual válido
      //   - el owner aún NO tiene cesantías cargadas (evitar duplicar)
      // Commit 11: agregar feedback visible al usuario sobre lo que paso.
      const debeAutoCrearCesantias =
        isSalario &&
        form.tipoVinculacion === "ordinario" &&
        mensualFinal > 0 &&
        item.owner;
      if (debeAutoCrearCesantias) {
        const yaTieneCesantias = items.some(
          (i) => i.owner === item.owner && i.fiscalCode === "LAB_PRESTACIONES_CESANTIAS"
        );
        if (!yaTieneCesantias) {
          // Cesantías + intereses: ~1 mes de salario al año + 12% sobre cesantías
          // = 1.12 meses de salario al año = mensual × 1.12 / 12 (porque el motor multiplica × 12)
          const cesantiasMensual = Math.round((mensualFinal * 1.12) / 12);
          const cesantiasItem = {
            id: "ing_" + (Date.now() + 1),
            nombre: `Cesantías + intereses (estimadas, ${item.nombre || "salario"})`,
            categoria: "Cesantías",
            fiscalCode: "LAB_PRESTACIONES_CESANTIAS",
            mensual: cesantiasMensual,
            tipo: "fijo",
            fuente: "Auto-generado al crear salario ordinario",
            moneda: "COP",
            owner: item.owner,
            // Flags de trazabilidad
            autoGenerado: true,
            salarioOrigenId: item.id,
          };
          updated = [...updated, cesantiasItem];
          // Feedback visible: confirmar al usuario que se creo
          setCesantiasNotif({
            tipo: "creada",
            mensaje: `✅ Se creó automáticamente "Cesantías + intereses (estimadas)" por ${fm(cesantiasMensual)}/mes para que la exenta del Art. 206 #4 ET se aplique.`
          });
        } else {
          // Feedback visible: explicar por que NO se creo (evita confusion del usuario)
          setCesantiasNotif({
            tipo: "saltada",
            mensaje: `ℹ️ No se creó cesantía nueva: el owner ya tiene una cargada. Si querés actualizar el monto, editá manualmente el item de cesantías existente.`
          });
        }
      } else if (isSalario && form.tipoVinculacion === "integral") {
        setCesantiasNotif({
          tipo: "saltada",
          mensaje: `ℹ️ Salario integral: no se cargan cesantías por separado (Art. 132 CST — ya están incluidas en el monto pactado).`
        });
      } else if (isSalario && form.tipoVinculacion === "no_aplica") {
        setCesantiasNotif({
          tipo: "saltada",
          mensaje: `ℹ️ Sin cesantías: este caso no genera prestaciones laborales. Recordá que si tu vinculación cambia, podés agregar cesantías manualmente como ingreso aparte.`
        });
      }
    }

    onUpdate(updated);
    setShowForm(false); setEditId(null);
    setForm(INITIAL_FORM);
    setModoIngreso("porPago");
    setTemplateElegido(null); // reset para próxima creación
  };
  const handleEdit = (item) => {
    // Commit 1.5: migración silenciosa para salarios viejos sin item.aportes:
    //   si categoria=Salario y no hay aportes guardados, prefill 4%+4% sobre el bruto.
    //   Nunca mutamos item directamente; sólo el form. El usuario decide si guardar.
    const isSalario = item.categoria === "Salario";
    const mensualNum = Number(item.mensual) || 0;
    const aportePensionGuardado = item.aportes?.pension;
    const aporteSaludGuardado   = item.aportes?.salud;
    const aportePensionForm =
      aportePensionGuardado != null ? String(aportePensionGuardado)
      : (isSalario && mensualNum > 0) ? String(Math.round(mensualNum * 0.04))
      : "";
    const aporteSaludForm =
      aporteSaludGuardado != null ? String(aporteSaludGuardado)
      : (isSalario && mensualNum > 0) ? String(Math.round(mensualNum * 0.04))
      : "";
    setForm({
      nombre: item.nombre,
      categoria: item.categoria,
      fiscalCode: item.fiscalCode || DEFAULT_FISCAL_CODE[item.categoria] || "NOL_OTROS",
      mensual: item.mensual,
      tipo: item.tipo,
      fuente: item.fuente || "",
      capital: item.capital || "",
      tasa: item.tasa || "",
      tasaModo: item.tasaModo || "anual",
      moneda: item.moneda || "COP",
      owner: item.owner || "",
      aportePension: aportePensionForm,
      aporteSalud: aporteSaludForm,
      // Commit IBC: leer modo persistido (default "valor" para items legacy)
      aportePensionModo: item.aportes?.pensionModo || "valor",
      aportePensionSmmlv: item.aportes?.pensionSmmlv ? String(item.aportes.pensionSmmlv) : "",
      aporteSaludModo: item.aportes?.saludModo || "valor",
      aporteSaludSmmlv: item.aportes?.saludSmmlv ? String(item.aportes.saludSmmlv) : "",
      // Commit 4 Tarea 3: leer tipoVinculacion (default "ordinario" para items legacy
      // que no tenían el campo). Solo aplica a Salario.
      tipoVinculacion: item.tipoVinculacion || "ordinario",
      // Sesión 28-abr-2026: leer retencionConfig (default = aplica:true sin tasa custom)
      retencionAplica: item.retencionConfig?.aplica !== false,
      retencionTasaCustom: item.retencionConfig?.tasaCustom != null
        ? String(item.retencionConfig.tasaCustom * 100)  // 0.07 → "7"
        : "",
      // Fase 2 flujo anual (18-jul-2026): preservar frecuencia y mes de pago
      frecuencia: item.frecuencia || "mensual",
      mesPago: Number(item.mesPago) || 1,
      // Fase 4 flujo anual (18-jul-2026): preservar rango de vigencia
      desdeMes: Number(item.desdeMes) || 1,
      hastaMes: Number(item.hastaMes) || 12,
      // UX FIX 2 (19-jul-2026): flag persistido del modo de vigencia
      vigenciaModo: item.vigenciaModo,
      // Fase Variable (18-jul-2026 noche): preservar array de montos mensuales
      montosMensuales: getMontosMensuales(item),
    });
    setEditId(item.id); setShowForm(true);
    // UX iter 4 (18-jul-2026 noche): detectar el template correcto según el
    // tipo del item existente. Antes forzaba modo "avanzado" que mostraba
    // TODOS los chips redundantes. Ahora respeta el tipo original.
    const tplDetectado = detectarTemplate(item);
    setTemplateElegido(tplDetectado);
    // UX iter 5 (18-jul-2026 noche): estado inicial de los accordions al editar:
    //   • Aportes: abierto para Salarios (donde suelen personalizar), cerrado para el resto
    //   • Tributaria: abierto si el user tiene propietario fiscal o categoría no-default
    // Si es un salario/honorarios, mantener modo simple para no confundir
    // (ellos siempre son mensuales, sin modoIngreso ni vigencia).
  };

  

  // Banner contextual de warnings fiscales para esta sección.
  // Lista los items específicos sin clasificación o con problemas, con CTA "Editar →"
  // que abre el modal del item directamente.
  const _rawWarnings = user ? getFiscalWarnings(user) : [];
  const _itemWarnings = _rawWarnings.filter(w => w.itemType === "ingreso" && w.itemId);
  // INGRESO_SIN_PROPIETARIO viene como warning agregado sin itemId — lo expandimos
  // a un warning por item para que cada ingreso sin owner aparezca en la lista.
  const _ingresosSinOwner = (ingresos || []).filter(i => !i.owner || i.owner === "");
  const _sinOwnerWarnings = _ingresosSinOwner.map(i => ({
    itemId: i.id,
    itemConcepto: i.nombre,
    severity: "error",
    code: "INGRESO_SIN_PROPIETARIO",
    message: "Ingreso sin propietario asignado — no se incluye en el cálculo de Impuestos",
    accionSugerida: "Asigná un propietario",
  }));
  const fiscalWarnings = [..._sinOwnerWarnings, ..._itemWarnings];
  const ingresoItemsById = Object.fromEntries((ingresos || []).map(i => [i.id, i]));
  // Map para badges en rows: itemId → array de warnings (color por max severity)
  const warningsByItemId = new Map();
  fiscalWarnings.forEach(w => {
    if (!w.itemId) return;
    if (!warningsByItemId.has(w.itemId)) warningsByItemId.set(w.itemId, []);
    warningsByItemId.get(w.itemId).push(w);
  });

  return (
    <div>
      <PageHeader
        label="Ingresos"
        title="Tus fuentes"
        subtitle={`${activos.length}${activos.length !== allItems.length ? ` de ${allItems.length}` : ""} fuente${activos.length !== 1 ? "s" : ""} activa${activos.length !== 1 ? "s" : ""} · Total: ${fm(totalMes)}/mes`}
        rightSlot={<>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={() => exportIngresosExcel(activos, owners)}
            title="Descarga XLSX con detalle + resumen por categoría"
            style={{ background: "#059669", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            📊 Excel
          </button>
          <button onClick={() => { setEditId(null); setForm(INITIAL_FORM); setModoIngreso("porPago"); setTemplateElegido(null); setShowForm(true); }}
            style={{ background: T.green, color: "#000", border: "none", padding: "10px 22px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            + Agregar
          </button>
        </>}
      />

      {/* Banner contextual: warnings fiscales de esta sección con lista navegable */}
      {fiscalWarnings.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
              {fiscalWarnings.length} ingreso{fiscalWarnings.length !== 1 ? "s" : ""} con clasificación fiscal pendiente
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
            Estos items afectan el cálculo de Impuestos. Revisalos y editalos para mayor precisión.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fiscalWarnings.slice(0, 6).map((w, idx) => {
              const item = ingresoItemsById[w.itemId];
              if (!item) return null;
              const colorBySev = w.severity === "error" ? "#ef4444" : (w.severity === "warning" ? "#f59e0b" : "#3b82f6");
              return (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: colorBySev, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.nombre || w.itemConcepto || "(sin nombre)"} {item.mensual > 0 && <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· {fm(item.mensual)}/mes</span>}
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>{w.message || w.accionSugerida}</div>
                  </div>
                  <button onClick={() => handleEdit(item)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: T.green, cursor: "pointer", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    Editar →
                  </button>
                </div>
              );
            })}
            {fiscalWarnings.length > 6 && (
              <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", padding: "4px 0" }}>
                + {fiscalWarnings.length - 6} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banner explicando toggle sim (Commit 8.8) */}
      <SimToggleInfo total={allItems.length} activos={activos.length} moduloNombre="un ingreso" />

      {/* Commit 11 Tarea 3: Notificacion visible sobre auto-creacion de cesantias.
          Aparece despues de guardar un salario y se cierra con la X. Resuelve el
          reporte: 'agrego un salario y no agrego cesantias por defecto' — el sistema
          si actua, pero el usuario no veia feedback. Ahora el feedback es explicito. */}
      {cesantiasNotif && (
        <div style={{
          background: cesantiasNotif.tipo === "creada" ? "rgba(34,197,94,0.08)" : "rgba(99,102,241,0.06)",
          border: `1.5px solid ${cesantiasNotif.tipo === "creada" ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.25)"}`,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 16,
          position: "relative",
          fontSize: 12,
          color: cesantiasNotif.tipo === "creada" ? T.green : T.txt2,
          lineHeight: 1.5,
        }}>
          <button onClick={() => setCesantiasNotif(null)} aria-label="Cerrar"
            style={{ position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: T.txt3, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
          <div style={{ paddingRight: 24 }}>{cesantiasNotif.mensaje}</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[{ l: `Entra en ${_MESES_L[_mesHoy - 1]}`, v: fm(totalEsteMes), c: T.green },
          { l: "Promedio mensual del año", v: fm(totalMes), c: T.blue },
          { l: "Total del año", v: fm(totalMes * 12), c: T.blue },
          { l: "Fijos", v: fm(fijos), c: T.txt }].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Table with checkboxes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            {/* 26-jul-2026 (Santiago): misma barra del dashboard, agrupando por
                categoría DIAN — que es como el motor fiscal ya piensa los
                ingresos, y lo que determina cómo tributan. */}
            {(() => {
              const grupos = {};
              activos.forEach(i => {
                const k = i.categoria || i.tipo || "Sin categoría";
                grupos[k] = (grupos[k] || 0) + montoPromedioMensual(i) * (i.moneda === "USD" ? (trm || 4200) : 1);
              });
              const datos = Object.entries(grupos).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
              if (datos.length < 2) return null;
              const tot = datos.reduce((s, d) => s + d.value, 0);
              const PAL = ["#22c55e","#3b82f6","#f59e0b","#a78bfa","#ec4899","#06b6d4","#eab308","#f97316"];
              return (
                <div style={{ marginBottom: 16 }}>
                  <BarraComposicion datos={datos} total={tot} paleta={PAL} T={T} altura={38} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8 }}>
                    {[...datos].sort((a,b)=>b.value-a.value).map((d, i) => (
                      <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.txt3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: PAL[i % PAL.length], flexShrink: 0 }} />
                        {d.name} <strong style={{ color: T.txt2, fontFamily: "monospace" }}>{((d.value/tot)*100).toFixed(0)}%</strong>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <BuscadorLista valor={busqueda} onChange={setBusqueda} T={T}
              total={items.length} filtrados={allItems.length} />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                  <input type="checkbox" checked={allItems.length > 0 && selected.size === allItems.length} onChange={toggleAll}
                    style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                </th>
                {["Nombre", "Categoría", "Tipo", "Mensual", "Capital / Fuente", "On/Off", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: h === "Mensual" ? "right" : "left", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allItems.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 0 }}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}>💰</div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:T.txt}}>Agrega tus ingresos mensuales</h3>
                      <p style={{fontSize:13,color:T.txt3,maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>Registra todo lo que recibes cada mes: salario, arriendos, rendimientos, dividendos, freelance. <strong style={{color:T.txt2}}>No incluyas cuotas de créditos</strong> — esas van en Deudas.</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={()=>{setEditId(null); setForm(INITIAL_FORM); setModoIngreso("porPago"); setTemplateElegido(null); setShowForm(true);}} style={{background:T.green,color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar ingreso</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>📥 Importar tabla Excel de ingresos</button>}
                      </div>
                      <div style={{background:T.bg3,borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.txt3,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Ejemplo de Excel para importar</div>
                        <table style={{width:"100%",fontSize:11,color:T.txt2}}>
                          <thead><tr style={{borderBottom:"1px solid "+T.border}}><th style={{padding:"4px 8px",textAlign:"left",color:T.txt3}}>Nombre</th><th style={{textAlign:"right",padding:"4px 8px",color:T.txt3}}>Monto/mes</th><th style={{padding:"4px 8px",color:T.txt3}}>Categoría</th></tr></thead>
                          <tbody>
                            <tr><td style={{padding:"4px 8px"}}>Salario empresa</td><td style={{textAlign:"right",padding:"4px 8px"}}>$8,500,000</td><td style={{padding:"4px 8px"}}>Salario</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Arriendo apto</td><td style={{textAlign:"right",padding:"4px 8px"}}>$3,200,000</td><td style={{padding:"4px 8px"}}>Arriendo</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Dividendos ETF</td><td style={{textAlign:"right",padding:"4px 8px"}}>$850,000</td><td style={{padding:"4px 8px"}}>Dividendos</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
                ) : separarPorLimite(allItems, plan).visibles.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(item.id) ? T.greenDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                        style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap"}}>
                        {warningsByItemId.has(item.id) && (() => {
                          const ws = warningsByItemId.get(item.id);
                          const hasError = ws.some(w => w.severity === "error");
                          return (
                            <span
                              onClick={() => handleEdit(item)}
                              title={ws.map(w => "• " + (w.message || w.accionSugerida)).join("\n")}
                              style={{ fontSize: 13, cursor: "pointer", color: hasError ? "#ef4444" : "#f59e0b", flexShrink: 0 }}
                            >⚠️</span>
                          );
                        })()}
                        <span>{item.nombre}</span>
                        {/* Badge de vigencia/frecuencia (18-jul-2026): visible cuando NO es mensual todo el año */}
                        {(() => {
                          const badge = labelVigenciaBadge(item);
                          if (!badge) return null;
                          return (
                            <span
                              title={`${badge.label} — ${badge.sub}`}
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: badge.color + "20",
                                color: badge.color,
                                letterSpacing: 0.3,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              {badge.emoji} {badge.label}
                              <span style={{ opacity: 0.7, fontWeight: 500 }}>· {badge.sub}</span>
                            </span>
                          );
                        })()}
                        {/* Chip Recibido/Pendiente: SOLO para pagos puntuales
                            (anual, único, semestral, trimestral). Los mensuales
                            son recurrentes y los VARIABLES se gestionan mes a
                            mes en su tabla (18-jul-2026 noche, Santiago: el
                            chip en variables confundía y no hacía nada). */}
                        {getFrecuencia(item) !== "mensual" && getFrecuencia(item) !== "variable" && (
                          <span
                            onClick={(e) => { e.stopPropagation(); togglePagoItem(item); }}
                            title={estaPagadoEnAño(item, añoActual) ? `Ya recibido en ${añoActual} — click para desmarcar` : `Aún no recibido en ${añoActual} — click para marcar como recibido`}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: "pointer",
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: estaPagadoEnAño(item, añoActual) ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                              color: estaPagadoEnAño(item, añoActual) ? "#22c55e" : "#f97316",
                              letterSpacing: 0.3,
                              userSelect: "none",
                            }}
                          >
                            {estaPagadoEnAño(item, añoActual) ? `✅ Recibido ${añoActual}` : `⏳ Pendiente ${añoActual}`}
                          </span>
                        )}
                      </div>
                      {(()=>{
                        if(!item.owner || item.owner==="") return null;
                        if(item.owner==="na") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>🌐 N/A</div>;
                        if(item.owner==="own_1") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>👤 Personal</div>;
                        const ow=(owners||[]).find(o=>o.id===item.owner);
                        return ow ? <div style={{fontSize:9,color:"#71717a",marginTop:2}}>{ow.type==="juridica"?"🏢":"👤"} {ow.name}</div> : null;
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.categoria}</span></td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: (item.tipo === "fijo" ? T.blue : T.orange) + "15", color: item.tipo === "fijo" ? T.blue : T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.tipo}</span></td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace" }}>
                      <div style={{ fontWeight: 700, color: T.green }}>
                        {/* 25-jul-2026: en variables usamos el promedio de meses
                            ACTIVOS, no item.mensual (que el motor ignora para
                            esa frecuencia y confundía la lectura). */}
                        {fm(item.moneda==="USD" ? promedioMesActivo(item)*(trm||4200) : promedioMesActivo(item))}
                        {item.moneda==="USD" && <span style={{fontSize:9,color:T.txt3,marginLeft:4}}>USD ${Math.round(promedioMesActivo(item)).toLocaleString("es-CO")}</span>}
                      </div>
                      {/* Subtítulo con total anual solo si NO es mensual todo el año */}
                      {(() => {
                        const badge = labelVigenciaBadge(item);
                        if (!badge) return null;
                        const total = totalAnualItem(item);
                        const vacios = mesesVaciosFuturos(item);
                        const totalCop = item.moneda === "USD" ? total * (trm || 4200) : total;
                        return (
                          <div style={{ fontSize: 9, color: T.txt3, fontWeight: 500, marginTop: 2 }}>
                            {fm(totalCop)}/año
                            {/* 25-jul-2026: antes el motor rellenaba solo los meses
                                futuros vacíos con un promedio inventado. Ahora van
                                en $0 — y se avisa, para que sea decisión y no sorpresa. */}
                            {vacios > 0 && (
                              <div style={{ color: "#eab308", marginTop: 1 }}>
                                ⚠ {vacios} {vacios === 1 ? "mes sin monto va" : "meses sin monto van"} en $0
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px", color: T.txt3, fontSize: 12 }}>{item.capital > 0 ? "$" + Math.round(item.capital).toLocaleString("es-CO") + (item.tasa ? " • " + item.tasa + "%" : "") : item.fuente || "—"}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><div style={{display:"flex",alignItems:"center",gap:4}}>
                      <button onClick={() => { if (!guardEdit(role)) return; const upd = items.map(x => x.id === item.id ? {...x, sim: !(item.sim!==false)} : x); onUpdate(upd); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={item.sim===false?"Mostrar en simulador":"Ocultar del simulador"}>{item.sim===false?"⬜":"✅"}</button>
                      <button onClick={() => handleEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (!guardEdit(role)) return; if (confirm("¿Eliminar este registro?")) onUpdate(items.filter((i) => i.id !== item.id)); }} style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          {/* 26-jul-2026 — Límite del plan gratuito (10 por sección).
              Los bloqueados NO se excluyen de ningún total: se quita el acceso al
              detalle, no se falsea el número. Ver src/lib/limitePlan.js. */}
          {(() => {
            const b = separarPorLimite(allItems, plan).bloqueados;
            if (!b.length) return null;
            return <BloqueadosPorPlan cantidad={b.length} monto={b.reduce((s,i)=>s+((i.mensual)||0),0)}
              fmt={fm} T={T} onUpgrade={onUpgrade} que="ingresos" />;
          })()}
          </div>
        </div>

      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Ingreso" : "Agregar Ingreso"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {/* Mostrar selector cuando NO hay template elegido — aplica tanto
                a items nuevos como a edición (click en "Cambiar" tipo). */}
            {!templateElegido ? (
              <TemplateSelector
                tipo="ingreso"
                tokens={T}
                onSelect={(tpl) => {
                  // UX FIX crítico (18-jul-2026 noche): al cambiar template,
                  // NO perder datos que el user ya llenó. Casos especiales:
                  //   • Al ir a "variable-mensual": pre-cargar la tabla con
                  //     el monto mensual actual en los 12 meses (el user
                  //     luego ajusta los que sean diferentes).
                  //   • Al SALIR de "variable-mensual": derivar mensual como
                  //     el PROMEDIO de los meses cargados (evita perder info).
                  setForm(p => {
                    const nuevoForm = { ...p, ...tpl.preset };

                    // Caso especial 1: cambiar A "variable-mensual"
                    if (tpl.id === "variable-mensual") {
                      const montoActual = Number(p.mensual) || 0;
                      if (montoActual > 0) {
                        // Pre-llenar los 12 meses con el monto actual
                        nuevoForm.montosMensuales = new Array(12).fill(montoActual);
                      }
                    }

                    // Caso especial 2: salir DE "variable-mensual" a otro tipo
                    if (p.frecuencia === "variable" && tpl.id !== "variable-mensual") {
                      const montos = Array.isArray(p.montosMensuales) ? p.montosMensuales : [];
                      const cargados = montos.filter(m => Number(m) > 0);
                      if (cargados.length > 0) {
                        // Derivar mensual como promedio de meses cargados
                        const promedio = cargados.reduce((s, m) => s + Number(m), 0) / cargados.length;
                        nuevoForm.mensual = String(Math.round(promedio));
                      }
                    }

                    return nuevoForm;
                  });
                  setModoIngreso(tpl.modoIngresoDefault || "porPago");
                  setTemplateElegido(tpl);
                }}
                onCancel={() => setShowForm(false)}
              />
            ) : (
              <>
                {/* Badge del template elegido + link para cambiar */}
                {/* UX iter 4: badge del template visible también al editar
                    (para que el user pueda cambiar el tipo si quiere). */}
                {templateElegido && templateElegido.id !== "avanzado" && (
                  <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 20 }}>{templateElegido.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Tipo elegido</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginTop: 1 }}>{templateElegido.titulo("ingreso")}</div>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => { setTemplateElegido(null); }}
                      style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", color: T.txt3, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Cambiar
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Photo scan option */}
              <div style={{gridColumn:"1/-1",background:"rgba(139,92,246,0.06)",border:"1px dashed rgba(139,92,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:4,textAlign:"center",cursor:"pointer"}} onClick={()=>{if(!scanning)scanImage()}}>
                {scanning ? <div style={{fontSize:12,color:"#a78bfa"}}>🔄 Leyendo documento...</div> : <>
                  <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>📸 ¿Tienes un extracto, certificado o recibo?</div>
                  <div style={{fontSize:10,color:"#71717a",marginTop:2}}>Sube una foto o PDF y los campos se llenan automáticamente</div>
                </>}
              </div>
              <div style={{ gridColumn: "1/-1" }}><In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Rapicredit fondeo, Salario, Arriendo casa" /></div>

              {/* Fase Variable (18-jul-2026 noche): tabla de 12 meses cuando el
                  template es "Cambia mes a mes". Reemplaza al input MONTO normal. */}
              {mostrarCampo("tablaMensual") && (
                <div style={{gridColumn:"1/-1"}}>
                  <TablaMensual
                    values={form.montosMensuales}
                    onChange={(nuevoArray) => setForm(p => ({ ...p, montosMensuales: nuevoArray, frecuencia: "variable" }))}
                    tokens={T}
                    desdeMes={Number(form.desdeMes) || 1}
                    hastaMes={Number(form.hastaMes) || 12}
                  />
                </div>
              )}

              {/* UX iter 2 (18-jul-2026 tarde): toggle simple "El monto es"
                  para templates mensuales. Reformulación clara del modoIngreso:
                  "Mensual" = lo que llega cada mes / "Total del año" = suma anual.
                  Solo aparece si el template pide 'modoIngresoSimple' Y no es Salario. */}
              {mostrarCampo("modoIngresoSimple") && !["Salario","Honorarios"].includes(form.categoria) && (
                <div style={{gridColumn:"1/-1", marginBottom: 4}}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                    💵 ¿El monto que vas a poner es...?
                  </label>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 5, display: "flex", gap: 5 }}>
                    <button type="button"
                      onClick={() => {
                        // Si viene de anual, dividir por meses activos para volver a mensual
                        if (modoIngreso === "anual") {
                          const activos = (form.hastaMes || 12) - (form.desdeMes || 1) + 1;
                          const nuevoM = Math.round((+form.mensual || 0) / activos);
                          setForm(p => ({ ...p, mensual: String(nuevoM) }));
                        }
                        setModoIngreso("porPago");
                      }}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 7, border: modoIngreso === "porPago" ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.06)", background: modoIngreso === "porPago" ? "rgba(34,197,94,0.08)" : "transparent", color: modoIngreso === "porPago" ? "#22c55e" : T.txt3, fontSize: 12, fontWeight: modoIngreso === "porPago" ? 700 : 500, cursor: "pointer", lineHeight: 1.3 }}>
                      💵 Mensual<br/>
                      <span style={{fontSize:10,opacity:0.7,fontWeight:500}}>Lo que llega cada mes</span>
                    </button>
                    <button type="button"
                      onClick={() => {
                        // Si viene de porPago, multiplicar por meses activos
                        if (modoIngreso === "porPago") {
                          const activos = (form.hastaMes || 12) - (form.desdeMes || 1) + 1;
                          const nuevoM = Math.round((+form.mensual || 0) * activos);
                          setForm(p => ({ ...p, mensual: String(nuevoM) }));
                        }
                        setModoIngreso("anual");
                      }}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 7, border: modoIngreso === "anual" ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.06)", background: modoIngreso === "anual" ? "rgba(34,197,94,0.08)" : "transparent", color: modoIngreso === "anual" ? "#22c55e" : T.txt3, fontSize: 12, fontWeight: modoIngreso === "anual" ? 700 : 500, cursor: "pointer", lineHeight: 1.3 }}>
                      📊 Total del año<br/>
                      <span style={{fontSize:10,opacity:0.7,fontWeight:500}}>La suma anual</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Toggle avanzado (por pago vs anual) — solo cuando el template es "avanzado" con frecuencia distinta a mensual */}
              {mostrarCampo("modoIngreso") && form.frecuencia !== "mensual" && !["Salario","Honorarios"].includes(form.categoria) && (
                <div style={{gridColumn:"1/-1", marginBottom: 4}}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                    💵 ¿Cómo conocés el monto?
                  </label>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 5, display: "flex", gap: 5 }}>
                    <button type="button"
                      onClick={() => {
                        if (modoIngreso === "anual") {
                          const factor = factorDeFrecuencia(form.frecuencia);
                          const nuevoM = Math.round((+form.mensual || 0) / factor);
                          setForm(p => ({ ...p, mensual: String(nuevoM) }));
                        }
                        setModoIngreso("porPago");
                      }}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: modoIngreso === "porPago" ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.06)", background: modoIngreso === "porPago" ? "rgba(34,197,94,0.08)" : "transparent", color: modoIngreso === "porPago" ? "#22c55e" : T.txt3, fontSize: 11.5, fontWeight: modoIngreso === "porPago" ? 700 : 500, cursor: "pointer", lineHeight: 1.3 }}>
                      Por pago<br/>
                      <span style={{fontSize:9,opacity:0.7,fontWeight:500}}>(lo que llega cada vez)</span>
                    </button>
                    <button type="button"
                      onClick={() => {
                        if (modoIngreso === "porPago") {
                          const factor = factorDeFrecuencia(form.frecuencia);
                          const nuevoM = Math.round((+form.mensual || 0) * factor);
                          setForm(p => ({ ...p, mensual: String(nuevoM) }));
                        }
                        setModoIngreso("anual");
                      }}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: modoIngreso === "anual" ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.06)", background: modoIngreso === "anual" ? "rgba(34,197,94,0.08)" : "transparent", color: modoIngreso === "anual" ? "#22c55e" : T.txt3, fontSize: 11.5, fontWeight: modoIngreso === "anual" ? 700 : 500, cursor: "pointer", lineHeight: 1.3 }}>
                      Total anual<br/>
                      <span style={{fontSize:9,opacity:0.7,fontWeight:500}}>(ingreso del año)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Ocultar input MONTO cuando el template es variable (la tabla lo reemplaza) */}
              {!mostrarCampo("tablaMensual") && (
              <In l={(() => {
                // Label del input MONTO simplificado (18-jul-2026 noche):
                // Santiago: "deberia decir monto no monto mensual?" — tiene razón,
                // el template + toggle ya explican el modo. El label solo dice "Monto".
                // Excepciones:
                //  - Salario/Honorarios: preserva label BRUTO (fiscal crítico)
                //  - Modo avanzado con freq no-mensual: mantiene labelMontoSegunFrecuencia
                const isSalarioLike = ["Salario","Honorarios"].includes(form.categoria);
                if (isSalarioLike) return "💵 Monto BRUTO mensual (antes de descuentos)";
                const freq = form.frecuencia || "mensual";
                // Modo avanzado con freq no-mensual: mostrar label específico
                const esAvanzado = templateElegido?.id === "avanzado";
                if (esAvanzado && freq !== "mensual") {
                  if (modoIngreso === "anual") return "💵 🎯 Total del año";
                  return `💵 ${labelMontoSegunFrecuencia(freq)}`;
                }
                // Templates simples: solo "Monto" (el toggle explica el modo)
                return "💵 Monto";
              })()} value={form.mensual} onChange={(v) => {
                const nf = { mensual: v };
                const m = Number(v) || 0;
                const cap = Number(form.capital) || 0;
                const tas = Number(form.tasa) || 0;
                if (m > 0 && cap > 0) nf.tasa = String(Math.round((m * 12 / cap) * 1000) / 10);
                else if (m > 0 && tas > 0) {
                  // Fix: solo derivar capital si el resultado es razonable (> $10K).
                  // Si mensual es tan pequeño que el capital calculado sale < $10K,
                  // probablemente el usuario está tipeando y no quiere derivar nada.
                  const capCalc = Math.round((m * 12) / (tas / 100));
                  if (capCalc >= 10_000) nf.capital = String(capCalc);
                }
                // Commit 1.5: auto-prefill aportes obligatorios (4%+4%) para Salario.
                // Sólo rellena si el campo está vacío → no pisa valores editados por el usuario.
                if (form.categoria === "Salario" && m > 0) {
                  if (!form.aportePension) nf.aportePension = String(Math.round(m * 0.04));
                  if (!form.aporteSalud)   nf.aporteSalud   = String(Math.round(m * 0.04));
                }
                setForm(p => ({ ...p, ...nf }));
              }} type="number" placeholder={(() => {
                if (["Salario","Honorarios"].includes(form.categoria)) return "Monto en contrato, antes de retención y aportes";
                const freq = form.frecuencia || "mensual";
                if (freq === "mensual") return "¿Cuánto recibes al mes?";
                if (freq === "trimestral") return "¿Cuánto en cada trimestre?";
                if (freq === "semestral") return "¿Cuánto en cada semestre?";
                if (freq === "anual") return "¿Cuánto en total al año?";
                return "¿Monto del pago único?";
              })()} />
              )}

              {/* UX iter 5 (18-jul-2026 noche): eliminado el bloque azul redundante
                  "Ingresá el monto BRUTO" — el label del input ya dice "BRUTO mensual
                  (antes de descuentos)". Repetirlo era innecesario. */}

              {/* UX iter 3 (18-jul-2026 noche): FrecuenciaSelector con props
                  específicas según template. Elimina redundancia — si el user
                  ya eligió "Cada mes durante todo el año", NO le mostramos
                  chips de frecuencia otra vez. Solo lo esencial. */}
              {(mostrarCampo("frecuencia") || mostrarCampo("vigencia") || mostrarCampo("mesPago")) && (
              <div style={{gridColumn:"1/-1"}}>
                <FrecuenciaSelector
                  frecuencia={form.frecuencia}
                  mesPago={form.mesPago}
                  desdeMes={form.desdeMes}
                  hastaMes={form.hastaMes}
                  vigenciaModo={form.vigenciaModo}
                  onChange={(patch) => setForm(p => ({ ...p, ...patch }))}
                  monto={form.mensual}
                  montosMensuales={form.montosMensuales}
                  tokens={T}
                  // Solo mostrar chips de frecuencia en modo AVANZADO
                  mostrarChipsFrecuencia={mostrarCampo("frecuencia")}
                  // Selector de mes: solo si el template lo pide (Anual, Único, Avanzado)
                  mostrarSelectorMes={mostrarCampo("mesPago") || mostrarCampo("frecuencia")}
                  // Vigencia: solo si el template lo pide (Mensual limitado, Avanzado)
                  mostrarVigencia={mostrarCampo("vigencia")}
                />
              </div>
              )}

              {/* Commit 4 Tarea 3: selector de tipo de vinculación. Solo aparece para Salario.
                  Define si auto-creamos cesantías al guardar (caso ordinario) o no (integral/no aplica).
                  CRÍTICO: cesantías son renta exenta Art. 206 #4 ET — los usuarios suelen olvidarlas. */}
              {form.categoria === "Salario" && !editId && (
                <div style={{gridColumn:"1/-1",background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"14px 16px",marginTop:4,marginBottom:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    💵 ¿Tu vinculación incluye cesantías por separado?
                  </div>
                  <div style={{fontSize:10,color:T.txt3,lineHeight:1.5,marginBottom:10}}>
                    Las cesantías son <strong>renta exenta Art. 206 #4 ET</strong> con tope variable según salario. Muchos usuarios las olvidan y pagan más impuesto del que deben.
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:form.tipoVinculacion==="ordinario"?"rgba(34,197,94,0.08)":"transparent",border:`1.5px solid ${form.tipoVinculacion==="ordinario"?"#22c55e":T.border}`,borderRadius:8,cursor:"pointer"}}>
                      <input type="radio" name="tipoVinc" value="ordinario" checked={form.tipoVinculacion==="ordinario"} onChange={() => setForm(p => ({ ...p, tipoVinculacion: "ordinario" }))} style={{marginTop:3,flexShrink:0}} />
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:form.tipoVinculacion==="ordinario"?"#22c55e":T.txt2}}>Sí — salario ordinario</div>
                        <div style={{fontSize:10,color:T.txt3,marginTop:2,lineHeight:1.4}}>Tu empresa consigna ~1 mes de salario al año al Fondo de Cesantías. <strong style={{color:T.txt2}}>El sistema te creará automáticamente un ingreso de "Cesantías + intereses" estimado para que la exenta del Art. 206 #4 se aplique.</strong></div>
                      </div>
                    </label>
                    <label style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:form.tipoVinculacion==="integral"?"rgba(168,85,247,0.08)":"transparent",border:`1.5px solid ${form.tipoVinculacion==="integral"?"#a855f7":T.border}`,borderRadius:8,cursor:"pointer"}}>
                      <input type="radio" name="tipoVinc" value="integral" checked={form.tipoVinculacion==="integral"} onChange={() => setForm(p => ({ ...p, tipoVinculacion: "integral" }))} style={{marginTop:3,flexShrink:0}} />
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:form.tipoVinculacion==="integral"?"#a855f7":T.txt2}}>No — salario integral (Art. 132 CST)</div>
                        <div style={{fontSize:10,color:T.txt3,marginTop:2,lineHeight:1.4}}>Aplica a salarios pactados ≥ 13 SMMLV. Cesantías y prestaciones <strong style={{color:T.txt2}}>ya están incluidas</strong> en el monto. NO se cargan por separado.</div>
                      </div>
                    </label>
                    <label style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:form.tipoVinculacion==="no_aplica"?"rgba(99,102,241,0.08)":"transparent",border:`1.5px solid ${form.tipoVinculacion==="no_aplica"?"#6366f1":T.border}`,borderRadius:8,cursor:"pointer"}}>
                      <input type="radio" name="tipoVinc" value="no_aplica" checked={form.tipoVinculacion==="no_aplica"} onChange={() => setForm(p => ({ ...p, tipoVinculacion: "no_aplica" }))} style={{marginTop:3,flexShrink:0}} />
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:form.tipoVinculacion==="no_aplica"?"#6366f1":T.txt2}}>No aplica</div>
                        <div style={{fontSize:10,color:T.txt3,marginTop:2,lineHeight:1.4}}>Caso atípico: contrato de prestación de servicios, exterior, o que no genera cesantías. No se cargan.</div>
                      </div>
                    </label>
                  </div>
                  {form.tipoVinculacion === "ordinario" && Number(form.mensual) > 0 && (() => {
                    const mens = Number(form.mensual);
                    const cesAnual = mens * 1.12;
                    return (
                      <div style={{marginTop:10,padding:"8px 10px",background:T.bg2,borderRadius:6,fontSize:10,color:T.txt2,lineHeight:1.5}}>
                        Al guardar se creará: <strong style={{color:"#22c55e"}}>"Cesantías + intereses (estimadas)"</strong> = {fm(Math.round(mens * 1.12 / 12))}/mes (≈ {fm(Math.round(cesAnual))}/año, equivalente a 1.12 sueldos). Podés modificar o eliminar el item después.
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* UX Opción A (18-jul-2026 noche): Aportes obligatorios PLANOS
                  y compactos. Sin accordion, sin explicación larga, todo visible. */}
              {form.categoria === "Salario" && (
                <div style={{gridColumn:"1/-1",background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"12px 14px",marginTop:4,marginBottom:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#a855f7",marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                    🛡️ Aportes obligatorios · Pensión y Salud
                  </div>
                  <div style={{fontSize:10,color:T.txt3,lineHeight:1.4,marginBottom:10}}>
                    Por defecto 4%+4% del bruto. Cambia a "# SMMLV" si cotizás sobre IBC distinto.
                  </div>

                  {/* Pensión: toggle + input */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:600,color:T.txt3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Aporte pensión / mes</div>
                    <div style={{background:T.bg3,borderRadius:8,padding:6,display:"flex",gap:4,marginBottom:8}}>
                      <button type="button" onClick={() => setForm(p => ({ ...p, aportePensionModo: "valor" }))}
                        style={{flex:1,padding:"6px 8px",borderRadius:6,border:form.aportePensionModo!=="smmlv"?"1.5px solid #a855f7":"1px solid transparent",background:form.aportePensionModo!=="smmlv"?"rgba(168,85,247,0.1)":"transparent",color:form.aportePensionModo!=="smmlv"?"#a855f7":T.txt3,fontSize:11,fontWeight:form.aportePensionModo!=="smmlv"?700:500,cursor:"pointer"}}>
                        💵 Valor fijo
                      </button>
                      <button type="button" onClick={() => {
                        // Al cambiar a SMMLV: si no hay # cargado, sugiere uno equivalente al valor actual
                        setForm(p => {
                          const next = { ...p, aportePensionModo: "smmlv" };
                          if (!p.aportePensionSmmlv) {
                            const ap = Number(p.aportePension) || 0;
                            const ibc = ap > 0 ? ap / 0.04 : 0;
                            const nApprox = ibc > 0 ? Math.round(ibc / SMMLV_2026) : 0;
                            if (nApprox >= 1 && nApprox <= TOPE_IBC_SMMLV) next.aportePensionSmmlv = String(nApprox);
                          }
                          return next;
                        });
                      }}
                        style={{flex:1,padding:"6px 8px",borderRadius:6,border:form.aportePensionModo==="smmlv"?"1.5px solid #a855f7":"1px solid transparent",background:form.aportePensionModo==="smmlv"?"rgba(168,85,247,0.1)":"transparent",color:form.aportePensionModo==="smmlv"?"#a855f7":T.txt3,fontSize:11,fontWeight:form.aportePensionModo==="smmlv"?700:500,cursor:"pointer"}}>
                        📊 # SMMLV
                      </button>
                    </div>
                    {form.aportePensionModo === "smmlv" ? (
                      <>
                        <input type="number" min="1" max="25" step="0.5" value={form.aportePensionSmmlv}
                          onChange={(e) => {
                            const n = e.target.value;
                            const nNum = Number(n) || 0;
                            const valor = aportePensionPorSmmlv(nNum);
                            setForm(p => ({ ...p, aportePensionSmmlv: n, aportePension: valor > 0 ? String(valor) : "" }));
                          }}
                          placeholder="Ej: 25 (tope IBC)"
                          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.txt,fontSize:14,outline:"none"}} />
                        {Number(form.aportePensionSmmlv) > 0 && (() => {
                          const n = Number(form.aportePensionSmmlv);
                          const ibc = n * SMMLV_2026;
                          const fs = fondoSolidaridadPct(n);
                          const valor = aportePensionPorSmmlv(n);
                          const supera = n > TOPE_IBC_SMMLV;
                          return (
                            <div style={{marginTop:6,padding:"8px 10px",background:supera?"rgba(239,68,68,0.06)":"rgba(168,85,247,0.06)",borderRadius:6,fontSize:10,color:supera?T.red:T.txt2,lineHeight:1.5}}>
                              {supera ? <strong>⚠️ Excede tope IBC (25 SMMLV — Art. 18 Ley 100). El sistema lo cuenta como ingresaste pero verificá que sea correcto.</strong> : <>
                                {n} SMMLV × {fm(SMMLV_2026)} = IBC <strong>{fm(ibc)}</strong>/mes<br/>
                                Aporte: 4% {fs > 0 && `+ ${(fs*100).toFixed(1)}% (Fondo Solidaridad)`} = <strong style={{color:"#a855f7"}}>{fm(valor)}</strong>/mes
                              </>}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <In l="" value={form.aportePension} onChange={(v) => setForm(p => ({ ...p, aportePension: v }))} type="number" placeholder="4% del bruto" />
                    )}
                  </div>

                  {/* Salud: toggle + input */}
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:600,color:T.txt3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Aporte salud / mes</div>
                    <div style={{background:T.bg3,borderRadius:8,padding:6,display:"flex",gap:4,marginBottom:8}}>
                      <button type="button" onClick={() => setForm(p => ({ ...p, aporteSaludModo: "valor" }))}
                        style={{flex:1,padding:"6px 8px",borderRadius:6,border:form.aporteSaludModo!=="smmlv"?"1.5px solid #a855f7":"1px solid transparent",background:form.aporteSaludModo!=="smmlv"?"rgba(168,85,247,0.1)":"transparent",color:form.aporteSaludModo!=="smmlv"?"#a855f7":T.txt3,fontSize:11,fontWeight:form.aporteSaludModo!=="smmlv"?700:500,cursor:"pointer"}}>
                        💵 Valor fijo
                      </button>
                      <button type="button" onClick={() => {
                        setForm(p => {
                          const next = { ...p, aporteSaludModo: "smmlv" };
                          if (!p.aporteSaludSmmlv) {
                            const asl = Number(p.aporteSalud) || 0;
                            const ibc = asl > 0 ? asl / 0.04 : 0;
                            const nApprox = ibc > 0 ? Math.round(ibc / SMMLV_2026) : 0;
                            if (nApprox >= 1 && nApprox <= TOPE_IBC_SMMLV) next.aporteSaludSmmlv = String(nApprox);
                          }
                          return next;
                        });
                      }}
                        style={{flex:1,padding:"6px 8px",borderRadius:6,border:form.aporteSaludModo==="smmlv"?"1.5px solid #a855f7":"1px solid transparent",background:form.aporteSaludModo==="smmlv"?"rgba(168,85,247,0.1)":"transparent",color:form.aporteSaludModo==="smmlv"?"#a855f7":T.txt3,fontSize:11,fontWeight:form.aporteSaludModo==="smmlv"?700:500,cursor:"pointer"}}>
                        📊 # SMMLV
                      </button>
                    </div>
                    {form.aporteSaludModo === "smmlv" ? (
                      <>
                        <input type="number" min="1" max="25" step="0.5" value={form.aporteSaludSmmlv}
                          onChange={(e) => {
                            const n = e.target.value;
                            const nNum = Number(n) || 0;
                            const valor = aporteSaludPorSmmlv(nNum);
                            setForm(p => ({ ...p, aporteSaludSmmlv: n, aporteSalud: valor > 0 ? String(valor) : "" }));
                          }}
                          placeholder="Ej: 25 (tope IBC)"
                          style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.txt,fontSize:14,outline:"none"}} />
                        {Number(form.aporteSaludSmmlv) > 0 && (() => {
                          const n = Number(form.aporteSaludSmmlv);
                          const ibc = n * SMMLV_2026;
                          const valor = aporteSaludPorSmmlv(n);
                          const supera = n > TOPE_IBC_SMMLV;
                          return (
                            <div style={{marginTop:6,padding:"8px 10px",background:supera?"rgba(239,68,68,0.06)":"rgba(168,85,247,0.06)",borderRadius:6,fontSize:10,color:supera?T.red:T.txt2,lineHeight:1.5}}>
                              {supera ? <strong>⚠️ Excede tope IBC (25 SMMLV — Art. 18 Ley 100).</strong> : <>
                                {n} SMMLV × {fm(SMMLV_2026)} = IBC <strong>{fm(ibc)}</strong>/mes<br/>
                                Aporte: 4% = <strong style={{color:"#a855f7"}}>{fm(valor)}</strong>/mes
                              </>}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <In l="" value={form.aporteSalud} onChange={(v) => setForm(p => ({ ...p, aporteSalud: v }))} type="number" placeholder="4% del bruto" />
                    )}
                  </div>

                  {/* Resumen salario gravable */}
                  {(() => {
                    const bruto = Number(form.mensual) || 0;
                    const ap = Number(form.aportePension) || 0;
                    const asl = Number(form.aporteSalud) || 0;
                    if (bruto <= 0) return null;
                    const gravable = Math.max(0, bruto - ap - asl);
                    return (
                      <div style={{marginTop:10,padding:"10px 12px",background:"rgba(34,197,94,0.06)",borderRadius:8,fontSize:12,color:T.green,lineHeight:1.5}}>
                        💰 Salario gravable = <strong>{fm(gravable)}</strong> / mes · <span style={{color:T.txt2}}>{fm(gravable * 12)}</span> anual
                        <div style={{fontSize:10,color:T.txt3,marginTop:4,fontWeight:400}}>
                          Bruto {fm(bruto)} − aportes {fm(ap + asl)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <In l="Fuente" value={form.fuente} onChange={(v) => setForm((p) => ({ ...p, fuente: v }))} placeholder="Empresa, propiedad, fondo..." />

              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))} options={["fijo", "variable"]} />
              <In l="Moneda" value={form.moneda} onChange={(v)=>setForm(p=>({...p,moneda:v}))} options={["COP","USD"]} />

              {/* UX Opción A (18-jul-2026 noche): Clasificación tributaria PLANA
                  y compacta al pie. Sin accordion, separador discreto arriba,
                  campos directos, sin explicación redundante. */}
              <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 6 }}>
                <div style={{fontSize:11,fontWeight:600,color:T.txt3,marginBottom:8,letterSpacing:"0.03em"}}>
                  🧾 Clasificación tributaria <span style={{color:T.txt3,fontWeight:400,opacity:0.7}}>(opcional)</span>
                </div>
              </div>
              <div style={{ gridColumn: "1/-1" }}><In l="Propietario fiscal" value={form.owner} onChange={(v) => setForm((p) => ({ ...p, owner: v }))} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} /></div>
              <div style={{ gridColumn: "1/-1" }}><In l="Categoría DIAN" value={form.categoria} onChange={(v) => setForm((p) => {
                const nf = { ...p, categoria: v, fiscalCode: DEFAULT_FISCAL_CODE[v] || "NOL_OTROS" };
                // Commit 1.5: si cambia a Salario y ya hay bruto pero no aportes, prefill 4%+4%
                const m = Number(p.mensual) || 0;
                if (v === "Salario" && m > 0) {
                  if (!p.aportePension) nf.aportePension = String(Math.round(m * 0.04));
                  if (!p.aporteSalud)   nf.aporteSalud   = String(Math.round(m * 0.04));
                }
                return nf;
              })} options={CATS} /></div>

              {FISCAL_SUBOPTIONS[form.categoria] && (
                <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", marginBottom: 8 }}>{FISCAL_SUBOPTIONS[form.categoria].question}</div>
                  <select
                    value={form.fiscalCode}
                    onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                    style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer" }}
                  >
                    {FISCAL_SUBOPTIONS[form.categoria].options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 6, lineHeight: 1.5 }}>{FISCAL_SUBOPTIONS[form.categoria].help}</div>
                </div>
              )}


              {/* Fix 25-may-2026: el campo Capital invertido aparecía solo para
                  Rendimiento/Dividendos/Arriendo/Inversión. Pero CDT (Intereses
                  bancarios) y fondos FIC TAMBIÉN tienen capital invertido —
                  Santiago no podía editarlo. Lista ampliada a las 6 categorías
                  de inversión que generan renta sobre un capital. */}
              {["Rendimiento","Dividendos","Arriendo","Inversión","Intereses bancarios","Utilidad FIC"].includes(form.categoria) && (
                <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:T.txt3,marginBottom:10}}>📊 Con 2 de 3 valores se calcula el tercero automáticamente</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <In l="💼 Capital invertido" value={form.capital} onChange={(v) => {
                      const nf = { capital: v };
                      const cap = Number(v) || 0;
                      const m = Number(form.mensual) || 0;
                      const tas = Number(form.tasa) || 0;
                      const tm = form.tasaModo || "anual";
                      // Fix: si hay tasa, SIEMPRE recalcular mensual al cambiar capital.
                      // Sin tasa pero con mensual, derivar tasa.
                      if (cap > 0 && tas > 0) {
                        nf.mensual = String(tm === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100));
                      } else if (cap > 0 && m > 0 && tas === 0) {
                        // derivar tasa: si modo mensual, m/cap*100; si anual, m*12/cap*100
                        nf.tasa = String(tm === "anual" ? Math.round((m * 12 / cap) * 1000) / 10 : Math.round((m / cap) * 1000) / 10);
                      }
                      setForm(p => ({ ...p, ...nf }));
                    }} type="number" placeholder="Valor del activo" />
                    <In l={form.tasaModo === "mensual" ? "📈 % Rentabilidad mensual" : "📈 % Rentabilidad anual"} value={form.tasa} onChange={(v) => {
                      const nf = { tasa: v };
                      const tas = Number(v) || 0;
                      const cap = Number(form.capital) || 0;
                      const m = Number(form.mensual) || 0;
                      const tm = form.tasaModo || "anual";
                      if (tas > 0 && cap > 0) {
                        nf.mensual = String(tm === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100));
                      } else if (tas > 0 && m > 0 && cap === 0) {
                        const capCalc = tm === "anual" ? Math.round((m * 12) / (tas / 100)) : Math.round(m / (tas / 100));
                        if (capCalc >= 10_000) nf.capital = String(capCalc);
                      } else if (tas === 0) {
                        // Si limpia la tasa, dejar mensual y capital como estaban (no pisar).
                      }
                      setForm(p => ({ ...p, ...nf }));
                    }} type="number" placeholder={form.tasaModo === "mensual" ? "Ej: 1" : "Ej: 24"} />
                  </div>
                  <In l="Periodicidad de la tasa" value={form.tasaModo || "anual"} onChange={(v) => {
                    // Al cambiar la periodicidad, recalculamos mensual en base a la nueva interpretación
                    const cap = Number(form.capital) || 0;
                    const tas = Number(form.tasa) || 0;
                    const nf = { tasaModo: v };
                    if (cap > 0 && tas > 0) {
                      nf.mensual = String(v === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100));
                    }
                    setForm(p => ({ ...p, ...nf }));
                  }} options={[{ v: "anual", l: "📅 Anual (ej: 24% al año)" }, { v: "mensual", l: "📅 Mensual (ej: 1% al mes)" }]} />
                  {Number(form.capital) > 0 && Number(form.tasa) > 0 && Number(form.mensual) > 0 && (
                    <div style={{marginTop:4,padding:"10px 12px",background:"rgba(34,197,94,0.06)",borderRadius:8,fontSize:12,color:T.green,lineHeight:1.6}}>
                      💰 Capital {"$" + Math.round(Number(form.capital)).toLocaleString("es-CO")} × {form.tasa}% {form.tasaModo === "mensual" ? "mensual" : "anual"} = {"$" + Math.round(form.tasaModo === "mensual" ? Number(form.capital) * Number(form.tasa) / 100 : Number(form.capital) * Number(form.tasa) / 100 / 12).toLocaleString("es-CO")}/mes
                    </div>
                  )}
                  {/* Fix: warning si el capital guardado es sospechosamente bajo (<$10K) */}
                  {Number(form.capital) > 0 && Number(form.capital) < 10_000 && (
                    <div style={{marginTop:10,padding:"10px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,fontSize:11,color:T.red,lineHeight:1.5}}>
                      ⚠️ El capital invertido es muy bajo ({"$" + Math.round(Number(form.capital)).toLocaleString("es-CO")}). ¿Faltan ceros? Un capital típico de inversión es &gt;$100.000. Si el valor es correcto, ignorá este aviso.
                    </div>
                  )}
                  {/* Commit E: validacion de tasa absurda (warning, no bloqueo) */}
                  {(() => {
                    const tas = Number(form.tasa) || 0;
                    if (tas <= 0) return null;
                    const tm = form.tasaModo || "anual";
                    // Umbrales: anual > 100% o mensual > 10% = error probable (rojo)
                    //          anual > 50%  o mensual > 5%  = revisar (naranja)
                    const altoRojo = tm === "mensual" ? tas > 10 : tas > 100;
                    const altoNaranja = tm === "mensual" ? tas > 5 : tas > 50;
                    if (altoRojo) {
                      return (
                        <div style={{marginTop:10,padding:"10px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,fontSize:11,color:T.red,lineHeight:1.5}}>
                          ⚠️ Tasa muy alta: {tas}% {tm}. {tm === "mensual" ? "10% mensual ya es ~214% anual." : "100% anual es excepcional."} ¿Querias decir {tm === "anual" ? "tasa mensual" : "tasa anual"}? Cambiá la periodicidad arriba si es el caso.
                        </div>
                      );
                    }
                    if (altoNaranja) {
                      return (
                        <div style={{marginTop:10,padding:"10px 12px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.25)",borderRadius:8,fontSize:11,color:T.orange,lineHeight:1.5}}>
                          🟠 Rentabilidad alta: {tas}% {tm}. Verificá que la periodicidad ({tm}) sea correcta. Rentabilidades de mercado típicas: 8-20% anual.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Sesión 28-abr-2026: Bloque de configuración de retención en
                  la fuente. Aparece SIEMPRE (excepto Salario que usa tabla
                  progresiva separada). Por default: estimación automática vía
                  tabla retencionesTax.js. El user puede:
                  - Marcar "no aplica" (toggle)
                  - Override con tasa custom (input %) */}
              {form.categoria !== "Salario" && form.categoria !== "Pensión" && form.fiscalCode && (() => {
                // Buscar info de la retención default según fiscalCode + tipo de owner
                const ownerObj = (owners || []).find(o => o.id === form.owner);
                const ownerType = ownerObj?.type || "natural";
                const info = obtenerInfoRetencion(form.fiscalCode, ownerType);
                const monto = Number(form.mensual) || 0;
                const tasaUsada = form.retencionAplica === false ? 0
                  : (form.retencionTasaCustom !== "" && form.retencionTasaCustom != null)
                    ? Number(form.retencionTasaCustom) / 100
                    : (info?.tasa || 0);
                const retencionAnual = monto * 12 * tasaUsada;
                return (
                  <div style={{ gridColumn: "1/-1", marginTop: 4, padding: "14px 16px", background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.18)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      🏦 Retención en la fuente
                    </div>
                    {!info ? (
                      <div style={{ fontSize: 12, color: T.txt3, lineHeight: 1.5 }}>
                        No hay retención automática configurada para este tipo de ingreso{ownerType === "juridica" ? "" : " a personas naturales"}.
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6, marginBottom: 10 }}>
                          <strong style={{ color: T.txt }}>Tasa default: {(info.tasa * 100).toFixed(1)}%</strong> ({info.articulo})
                          {info.retenedor && <span style={{ color: T.txt3 }}> · Retiene: {info.retenedor}</span>}
                        </div>
                        {info.advertencia && (
                          <div style={{ fontSize: 11, color: "#f97316", marginBottom: 10, lineHeight: 1.5 }}>
                            ⚠️ {info.advertencia}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.txt2, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={form.retencionAplica !== false}
                              onChange={(e) => setForm(p => ({ ...p, retencionAplica: e.target.checked }))}
                              style={{ cursor: "pointer" }}
                            />
                            Aplicar retención automática
                          </label>
                          {form.retencionAplica !== false && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.txt3 }}>
                              <span>Tasa custom:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={form.retencionTasaCustom}
                                onChange={(e) => setForm(p => ({ ...p, retencionTasaCustom: e.target.value }))}
                                placeholder={(info.tasa * 100).toFixed(1)}
                                style={{ width: 70, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", color: T.txt, fontSize: 12 }}
                              />
                              <span>%</span>
                              {form.retencionTasaCustom !== "" && (
                                <button
                                  type="button"
                                  onClick={() => setForm(p => ({ ...p, retencionTasaCustom: "" }))}
                                  style={{ background: "transparent", border: "none", color: T.txt3, cursor: "pointer", fontSize: 11, textDecoration: "underline" }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {monto > 0 && (
                          <div style={{ fontSize: 12, color: form.retencionAplica === false ? T.txt3 : "#22c55e", fontWeight: 600, marginTop: 4 }}>
                            {form.retencionAplica === false
                              ? "🚫 No se calculará retención para este ingreso."
                              : `💰 Retención estimada: ${"$" + Math.round(retencionAnual).toLocaleString("es-CO")}/año (${(tasaUsada * 100).toFixed(1)}% de ${"$" + Math.round(monto * 12).toLocaleString("es-CO")})`}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: T.txt3, marginTop: 8, lineHeight: 1.4, fontStyle: "italic" }}>
                          ℹ️ Marcá "No aplicar" si quien te paga NO retiene (ej: inquilino persona natural no declarante). Usá tasa custom si tu certificado de retención muestra una tasa distinta.
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: T.green, color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
