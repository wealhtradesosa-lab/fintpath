import { useState } from "react";
import NumberInput from "./NumberInput";
import { C } from "../lib/designTokens.js";
import SimToggleInfo from "./SimToggleInfo";
import PageHeader from "./PageHeader";
import { exportGastosExcel } from "../lib/excelExport.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import { getFiscalWarnings } from "../lib/normalize.js";

const T = {
  bg2: C.surface, bg3: "#1e1e24",
  card: "#111113", border: C.border,
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316",
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("en-US");

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

// Commit 14 Tarea 3 (BUG REPORTADO):
// 'clasifique el soat del deepal como de vehiculo en una parte me dice no
//  deducible pero en la tabla de egresos sale dian 50% NO ENTIENDO'
//
// Problema: la tabla DIAN_REGLAS legacy estaba hardcoded por CATEGORÍA
// (ej: "Seguros" → "📊 50%") cuando la realidad fiscal depende del
// fiscalCode REAL del item, no de la categoría visual. Resultado:
//   - Item con fiscalCode SEG_VEHICULO (NO deducible) mostraba "50%" ❌
//   - Item con fiscalCode AP_TRIB_PV (detracción fiscal) mostraba "50%" ❌
//   - Item con GAS_HON_VEHICULO (sí 50% Art. 107) mostraba "50%" ✅ por casualidad
//
// Solución: leer el fiscalCode del item y mapear a la regla legal real.
// Fallback al comportamiento legacy si no hay fiscalCode (items pre-1.5).
const REGLA_POR_FISCAL_CODE = {
  // Aporte tributario (detracción de la base, Arts. 126-1, 126-4, 387)
  "AP_TRIB_PV":                 { txt: "✅ Detracción fiscal", color: "#22c55e", help: "Pensión voluntaria — detrae base hasta tope conjunto Art. 126-1 ET" },
  "AP_TRIB_AFC":                { txt: "✅ Detracción fiscal", color: "#22c55e", help: "AFC — detrae base hasta tope conjunto Art. 126-4 ET" },
  "AP_TRIB_SALUD_PREPAGADA":    { txt: "✅ Hasta 16 UVT/mes", color: "#22c55e", help: "Salud prepagada — Art. 387 #2 ET, tope 16 UVT mensuales" },
  // Vivienda
  "DEU_NAT_VIVIENDA_HABITACIONAL": { txt: "✅ Intereses 1.200 UVT", color: "#22c55e", help: "Intereses vivienda habitacional — Art. 119 ET, tope 1.200 UVT/año" },
  // Inmueble (depende del uso)
  "GAS_INMUEBLE_ADMINISTRACION":   { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Gasto del inmueble arrendado — deducible 100% de la renta de capital" },
  "GAS_INMUEBLE_SERVICIOS":        { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Servicios del inmueble arrendado" },
  "GAS_INMUEBLE_REPARACION":       { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Reparación del inmueble arrendado" },
  "GAS_INMUEBLE_MANTENIMIENTO":    { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Mantenimiento del inmueble arrendado" },
  "GAS_INMUEBLE_PREDIAL":          { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Predial del inmueble arrendado" },
  "GAS_INMUEBLE_SEGUROS":          { txt: "✅ 100% (renta capital)", color: "#22c55e", help: "Seguros del inmueble arrendado" },
  // Commit 15 Tarea 3: impuesto vehicular (rodamiento)
  "IMP_VEHICULAR_PERSONAL":        { txt: "❌ No deducible", color: "#71717a", help: "Rodamiento vehículo personal — no cumple Art. 107 ET" },
  "IMP_VEHICULAR_PROFESIONAL":     { txt: "📊 50% Art. 107", color: "#eab308", help: "Rodamiento vehículo profesional — 50% conservador (uso mixto), máx 1" },
  // Honorarios (Art. 107 ET — actividad independiente)
  "GAS_HON_SEG_SOCIAL":          { txt: "✅ 100% Art. 126-1", color: "#22c55e", help: "Seguridad social independiente — deducible 100%" },
  "GAS_HON_NOMINA_TERCEROS":     { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Nómina/honorarios a terceros — deducible 100%" },
  "GAS_HON_OFICINA":             { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Arriendo oficina — deducible 100%" },
  "GAS_HON_SERVICIOS_OFICINA":   { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Servicios oficina — deducible 100%" },
  "GAS_HON_INTERNET_TELEFONIA":  { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Internet/telefonía profesional" },
  "GAS_HON_MATERIALES":          { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Materiales y suministros profesionales" },
  "GAS_HON_VEHICULO":            { txt: "📊 50% Art. 107", color: "#eab308", help: "Vehículo profesional — 50% conservador (uso mixto), máx 1" },
  "GAS_HON_VIAJES":              { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Viajes con propósito profesional documentado" },
  "GAS_HON_REPRESENTACION":      { txt: "📊 Tope 10%", color: "#eab308", help: "Representación — tope 10% Art. 107-1 ET" },
  "GAS_HON_CAPACITACION":        { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Capacitación profesional" },
  "GAS_HON_OTROS":               { txt: "✅ Con causalidad", color: "#22c55e", help: "Otros con causalidad documentada" },
  // Seguros (persona natural — la mayoría NO deducibles)
  "SEG_SALUD":                   { txt: "✅ Hasta 16 UVT/mes", color: "#22c55e", help: "Seguro de salud — Art. 387 #2 ET, tope 16 UVT mensuales" },
  "SEG_VIDA":                    { txt: "❌ No deducible", color: "#71717a", help: "Seguro de vida personal — no cumple Art. 107 ET" },
  "SEG_VEHICULO":                { txt: "❌ No deducible", color: "#71717a", help: "Seguro de vehículo personal — no cumple Art. 107 ET" },
  "SEG_HOGAR":                   { txt: "❌ No deducible", color: "#71717a", help: "Seguro de hogar personal — no cumple Art. 107 ET" },
  // Gastos juridica
  "GAS_JUR_DEDUCIBLE":           { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Gasto deducible con causalidad" },
  "GAS_JUR_NO_DEDUCIBLE":        { txt: "❌ No deducible", color: "#71717a", help: "Gasto sin causalidad probada" },
  // Commit 17 Tarea 3: fiscalCodes de juridica con sus reglas reales
  "GAS_JUR_NOMINA":              { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Nómina + prestaciones de empleados — deducible 100%" },
  "GAS_JUR_PARAFISCALES":        { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Parafiscales (SENA, ICBF, Cajas) — deducible 100%" },
  "GAS_JUR_HONORARIOS_PROF":     { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Honorarios profesionales (contador, abogado, etc.) — deducible 100%" },
  "GAS_JUR_OPERATIVO":           { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Gasto operativo con causalidad — deducible 100%" },
  "GAS_JUR_PREDIAL":             { txt: "✅ 100% Art. 115", color: "#22c55e", help: "Predial pagado por la empresa — deducible 100% (Art. 115 ET)" },
  "GAS_JUR_DEPRECIACION":        { txt: "✅ 100% Art. 128-141", color: "#22c55e", help: "Depreciación de activos productivos — deducible según vida útil fiscal" },
  "GAS_JUR_CAPACITACION":        { txt: "✅ 100% Art. 107", color: "#22c55e", help: "Capacitación de empleados — deducible 100%" },
  // Personal
  "GAS_NAT_PERSONAL":            { txt: "❌ No deducible", color: "#71717a", help: "Gasto personal — no cumple Art. 107 ET" },
};

function reglaItem(item, owners) {
  if (!item.owner || item.owner === "" || item.owner === "na") return null;
  const ow = (owners || []).find(o => o.id === item.owner);
  // Prioridad 1: leer fiscalCode REAL del item
  let fc = item.fiscalCode;
  // Commit 16 Tarea 3: items legacy sin fiscalCode → derivar de la categoria
  // usando defaultFiscalCode (asume natural por defecto si no hay owner).
  // Esto evita que la tabla muestre "— sin clasificar" para items que tienen
  // categoria valida pero fueron creados antes del Commit 14 que persistia
  // fiscalCode al guardar.
  if (!fc && item.cat) {
    const ownerType = ow?.type === "juridica" ? "juridica" : "natural";
    fc = defaultFiscalCode(ownerType, item.cat);
  }
  if (fc && REGLA_POR_FISCAL_CODE[fc]) return REGLA_POR_FISCAL_CODE[fc];
  // Fallback final: solo cuando no hay forma de derivar
  return { txt: "— sin clasificar", color: "#71717a", help: "Edita este item y elegí la clasificación fiscal correspondiente" };
}

// Sub-opciones de fiscalCode según (owner type, categoría). Si la combinación
// no aparece aquí, no hay ambigüedad y el fiscalCode se infiere automático.
// Devuelve null si no hay sub-selector.
function fiscalSubOptions(ownerType, cat) {
  // Commit 1.6: "Aporte tributario" es agnóstico al ownerType a nivel UI.
  // El motor sólo procesa estos fiscalCodes en el cálculo de persona natural;
  // si se asigna a jurídica, no genera deducción (tampoco daña).
  if (cat === "Aporte tributario") {
    return {
      question: "🛡️ ¿Qué tipo de aporte tributario?",
      help: "PV y AFC comparten tope 25% del neto laboral y 2500 UVT anuales (Arts. 126-1 y 126-4 ET). Salud prepagada entra al tope de 16 UVT mensuales junto con gastos médicos (Art. 387 #2 ET). Reducen la base gravable del impuesto de renta de persona natural.",
      options: [
        { v: "AP_TRIB_PV", l: "Pensión Voluntaria (Art. 126-1 ET)" },
        { v: "AP_TRIB_AFC", l: "AFC — Ahorro Fomento Construcción (Art. 126-4 ET)" },
        { v: "AP_TRIB_SALUD_PREPAGADA", l: "Salud prepagada (Art. 387 #2 ET)" },
      ],
    };
  }
  if (ownerType === "natural") {
    // Commit 15 Tarea 3: categoría Impuesto (legacy: "Predial") cubre TODOS los
    // impuestos territoriales (predial inmuebles + rodamiento vehículos + ICA).
    // Sub-selector con 5 opciones que mapean al fiscalCode correcto.
    // Compat legacy: gastos viejos guardados como "Predial" siguen funcionando.
    if (cat === "Impuesto" || cat === "Predial") {
      return {
        question: "🏛️ ¿Qué tipo de impuesto?",
        help: "El predial de tu vivienda personal y el rodamiento de tu vehículo personal NO son deducibles para persona natural (no cumplen Art. 107 ET). Los relacionados con inmuebles arrendados o actividad profesional sí.",
        options: [
          { v: "GAS_NAT_PERSONAL",            l: "Predial vivienda personal (no deducible)" },
          { v: "GAS_INMUEBLE_PREDIAL",        l: "Predial inmueble arrendado (100% renta capital)" },
          { v: "IMP_VEHICULAR_PERSONAL",      l: "Impuesto vehicular personal — rodamiento (no deducible)" },
          { v: "IMP_VEHICULAR_PROFESIONAL",   l: "Impuesto vehicular profesional — actividad independiente (50% Art. 107)" },
          { v: "GAS_NAT_PERSONAL",            l: "Otro impuesto local sin causalidad (no deducible)" },
        ],
      };
    }
    // Gastos que pueden ser del inmueble arrendado o personales
    if (["Vivienda", "Mantenimiento", "Servicios", "Seguros", "Arrendamiento"].includes(cat)) {
      return {
        question: "🏠 ¿Es del inmueble arrendado o de tu vivienda personal?",
        help: "Si es del inmueble que arrendás a terceros, se deduce 100% de la renta no laboral (Art. 107 ET). Si es personal, no deduce.",
        options: [
          { v: "GAS_NAT_PERSONAL", l: "Personal — mi vivienda (no deducible)" },
          { v: cat === "Mantenimiento" ? "GAS_INMUEBLE_MANTENIMIENTO"
              : cat === "Servicios" ? "GAS_INMUEBLE_SERVICIOS"
              : cat === "Seguros" ? "GAS_INMUEBLE_SEGUROS"
              : "GAS_INMUEBLE_ADMINISTRACION", l: "Del inmueble arrendado (deducible 100%)" },
        ],
      };
    }
    return null;
  }
  if (ownerType === "juridica") {
    // Gastos donde la causalidad con la actividad productora de renta (Art. 107) es clave
    if (["Educación", "Vivienda", "Alimentación", "Entretenimiento", "Transporte", "Representación"].includes(cat)) {
      const opDeducible = cat === "Educación" ? "GAS_JUR_CAPACITACION" : "GAS_JUR_OPERATIVO";
      return {
        question: "🧾 ¿Está relacionado con la actividad productora de renta? (Art. 107 ET)",
        help: "Art. 107 ET exige causalidad, necesidad y proporcionalidad con la actividad. Ej. Educación de empleados sí deduce; colegio de hijos del socio no.",
        options: [
          { v: opDeducible, l: "Sí — relacionado con la actividad (deducible)" },
          { v: "GAS_JUR_NO_DEDUCIBLE", l: "No — gasto personal o sin nexo (NO deducible)" },
        ],
      };
    }
    return null;
  }
  return null;
}

// Default fiscalCode conservador según (owner type, categoría) — replica el
// normalizer cuando el usuario no ha elegido explícitamente.
function defaultFiscalCode(ownerType, cat) {
  // Commit 1.6: default para "Aporte tributario" es PV (más común en usuarios
  // de clase media-alta asalariada). El usuario ajusta al subtipo real en el sub-selector.
  if (cat === "Aporte tributario") return "AP_TRIB_PV";
  if (ownerType === "juridica") {
    if (cat === "Nómina") return "GAS_JUR_NOMINA";
    if (cat === "Honorarios") return "GAS_JUR_HONORARIOS_PROF";
    if (cat === "Impuesto" || cat === "Predial") return "GAS_JUR_PREDIAL";
    if (cat === "Depreciación") return "GAS_JUR_DEPRECIACION";
    if (["Educación"].includes(cat)) return "GAS_JUR_CAPACITACION";
    if (["Alimentación", "Entretenimiento", "Personal", "Vestimenta", "Mascotas", "Deporte", "Ahorro"].includes(cat)) return "GAS_JUR_NO_DEDUCIBLE";
    return "GAS_JUR_OPERATIVO";
  }
  // natural
  if (cat === "Salud") return "GAS_NAT_SALUD_MEDICINA";
  // Commit 16 Tarea 3 (BUG REPORTADO): default conservador para gastos que pueden
  // ser personales O del inmueble arrendado. Antes el default asumia "del inmueble"
  // (deducible 100%) lo cual es DEMASIADO OPTIMISTA — la mayoria de usuarios
  // categoriza "Vivienda" o "Arrendamiento" para SU vivienda donde viven (no
  // deducible), no para administrar un inmueble arrendado a terceros. El usuario
  // que SI tiene inmueble arrendado puede cambiarlo en el sub-selector.
  if (cat === "Vivienda" || cat === "Arrendamiento") return "GAS_NAT_PERSONAL";
  if (cat === "Mantenimiento") return "GAS_NAT_PERSONAL";
  if (cat === "Servicios") return "GAS_NAT_PERSONAL";
  if (cat === "Seguros") return "SEG_GENERICO"; // sin clasificar el subtipo
  // Impuesto (legacy: Predial) sigue mostrando sub-selector (tiene 5 opciones), default conservador
  if (cat === "Impuesto" || cat === "Predial") return "GAS_NAT_PERSONAL";
  if (cat === "Depreciación") return "GAS_INMUEBLE_DEPRECIACION";
  if (cat === "Ahorro") return "GAS_NAT_AHORRO";
  return "GAS_NAT_PERSONAL";
}

export default function GastosModule({ gastos, onUpdate, fmt, onImport, owners, ingresos, plan, onUpgrade, user}) {
  // Fase 3 commit 6: gating reader. Mismo patrón que IngresosModule.
  const { role } = useRole();
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
            body: JSON.stringify({ image: base64, type: "gasto", mediaType })
          });
          const data = await res.json();
          if (data.success && data.data) {
            const d = data.data;
            setForm(p => ({
              ...p,
              c: d.concepto || p.c,
              m: d.monto || p.m,
              cat: d.categoria || p.cat,
              t: d.tipo === "variable" ? "v" : "f",
              freq: d.frecuencia === "año" ? "año" : "mes",
            }));
            setShowForm(true);
            alert("✅ Factura leída" + (d.confianza === "alta" ? "" : " (revisa los datos)") + "\n\n" + (d.concepto || "") + ": $" + (d.monto || 0).toLocaleString() + " — " + (d.categoria || ""));
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
  const fm = fmt || _fm;
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState(null); // "cat|idx"
  const [form, setForm] = useState({ cat: "", c: "", m: "", t: "f", freq: "mes", owner: "", fiscalCode: "", causalidad: "", montoModo: "fijo", capital: "", tasa: "", tasaModo: "mensual" });
  const [selected, setSelected] = useState(new Set()); // "cat|idx"

  const gas = gastos || {};
  const cats = Object.entries(gas);
  const allItems = [];
  cats.forEach(([cat, its]) => its.forEach((g, i) => allItems.push({ ...g, cat, idx: i, key: cat + "|" + i })));
  const activos = allItems.filter((g) => g.sim !== false);
  const totalMes = activos.reduce((s, g) => s + (g.m || 0), 0);

  const toggleSel = (key) => setSelected((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAll = () => setSelected(selected.size === allItems.length ? new Set() : new Set(allItems.map((g) => g.key)));

  const deleteSelected = () => {
    if (!guardEdit(role)) return;
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} gasto(s)?`)) return;
    const newGas = {};
    cats.forEach(([cat, its]) => {
      const kept = its.filter((_, i) => !selected.has(cat + "|" + i));
      if (kept.length > 0) newGas[cat] = kept;
    });
    onUpdate(newGas);
    setSelected(new Set());
  };

  const handleSave = () => {
    if (!guardEdit(role)) return;
    const newGas = { ...gas };
    const buildItem = () => {
      const base = { c: form.c || "", m: form.freq==="año"?Math.round((+form.m||0)/12):(+form.m||0), t: form.t || "f", freq: form.freq||"mes", owner: form.owner||"", fiscalCode: form.fiscalCode || undefined, causalidad: form.causalidad || undefined };
      if (form.montoModo === "tasa") {
        base.montoModo = "tasa";
        base.capital = Number(form.capital) || 0;
        base.tasa = Number(form.tasa) || 0;
        base.tasaModo = form.tasaModo || "mensual";
      }
      return base;
    };
    if (editKey) {
      const [eCat, eIdx] = editKey.split("|");
      const idx = parseInt(eIdx);
      if (form.cat !== eCat) {
        // Category changed: remove from old, add to new
        newGas[eCat] = newGas[eCat].filter((_, i) => i !== idx);
        if (newGas[eCat].length === 0) delete newGas[eCat];
        if (!newGas[form.cat]) newGas[form.cat] = [];
        newGas[form.cat].push(buildItem());
      } else {
        newGas[eCat][idx] = buildItem();
      }
    } else {
      const cat = form.cat || "Otro";
      if (!newGas[cat]) newGas[cat] = [];
      newGas[cat].push(buildItem());
    }
    onUpdate(newGas);
    setShowForm(false);
    setEditKey(null);
    setForm({ cat: "", c: "", m: "", t: "f", freq: "mes", owner: "", fiscalCode: "", causalidad: "", montoModo: "fijo", capital: "", tasa: "", tasaModo: "mensual" });
  };

  const openEdit = (item) => {
    setForm({ cat: item.cat, c: item.c, m: item.freq==="año"?(item.m*12):item.m, t: item.t, freq: item.freq||"mes", owner: item.owner||"", fiscalCode: item.fiscalCode || "", causalidad: item.causalidad || "", montoModo: item.montoModo || "fijo", capital: item.capital ? String(item.capital) : "", tasa: item.tasa ? String(item.tasa) : "", tasaModo: item.tasaModo || "mensual" });
    setEditKey(item.key);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ cat: "", c: "", m: "", t: "f", freq: "mes", owner: "", fiscalCode: "", causalidad: "", montoModo: "fijo", capital: "", tasa: "", tasaModo: "mensual" });
    setEditKey(null);
    setShowForm(true);
  };

  const delCat = (cat) => {
    if (!guardEdit(role)) return;
    if (!confirm("¿Eliminar categoría " + cat + "?")) return;
    const newGas = { ...gas };
    delete newGas[cat];
    onUpdate(newGas);
  };

  

  // Banner contextual: warnings fiscales de gastos. Cada warning tiene
  // itemGastoCat e itemGastoIdx que reconstruyen el `key` que usa openEdit.
  const _rawWarnings = user ? getFiscalWarnings(user) : [];
  const fiscalWarnings = _rawWarnings.filter(w => w.itemType === "gasto" && w.itemId);
  // Map para badges en rows: itemKey (cat|idx) → array de warnings
  const warningsByItemKey = new Map();
  fiscalWarnings.forEach(w => {
    const key = w.itemGastoCat + "|" + w.itemGastoIdx;
    if (!warningsByItemKey.has(key)) warningsByItemKey.set(key, []);
    warningsByItemKey.get(key).push(w);
  });

  return (
    <div>
      <PageHeader
        label="Egresos"
        title="Tus gastos"
        subtitle={`${activos.length}${activos.length !== allItems.length ? ` de ${allItems.length}` : ""} gasto${activos.length !== 1 ? "s" : ""} en ${cats.length} categorías · Total: ${fm(totalMes)}/mes · ${fm(totalMes * 12)}/año`}
        rightSlot={<>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={() => exportGastosExcel(gastos)}
            title="Descarga XLSX con detalle + resumen por categoría (Fijos vs Variables)"
            style={{ background: "#059669", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            📊 Excel
          </button>
          <button onClick={openAdd} style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 22px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </>}
      />

      {/* Banner contextual: warnings fiscales de gastos */}
      {fiscalWarnings.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
              {fiscalWarnings.length} egreso{fiscalWarnings.length !== 1 ? "s" : ""} con clasificación fiscal pendiente
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
            Estos items requieren confirmación de causalidad o tipo fiscal. Afectan tu cálculo de Impuestos.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fiscalWarnings.slice(0, 6).map((w, idx) => {
              // Reconstruir key del item: cat|idx (mismo patrón que línea 269)
              const key = w.itemGastoCat + "|" + w.itemGastoIdx;
              const item = allItems.find(it => it.key === key);
              if (!item) return null;
              const colorBySev = w.severity === "error" ? "#ef4444" : (w.severity === "warning" ? "#f59e0b" : "#3b82f6");
              return (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: colorBySev, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.c || w.itemConcepto || w.itemCategoria || "(sin descripción)"} <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· {fm(item.m || 0)}/mes · {item.cat}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>{w.message || w.accionSugerida}</div>
                  </div>
                  <button onClick={() => openEdit(item)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: "#22c55e", cursor: "pointer", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
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
      <SimToggleInfo total={allItems.length} activos={activos.length} moduloNombre="un gasto" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Total Mensual", v: fm(totalMes), c: T.red },
          { l: "Total Anual", v: fm(totalMes * 12), c: T.orange },
          { l: "Fijos", v: fm(activos.filter((g) => g.t === "f").reduce((s, g) => s + g.m, 0)), c: T.blue },
          { l: "Variables", v: fm(activos.filter((g) => g.t !== "f").reduce((s, g) => s + g.m, 0)), c: T.orange },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Table with checkboxes */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                <input type="checkbox" checked={allItems.length > 0 && selected.size === allItems.length} onChange={toggleAll}
                  style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
              </th>
              {["Concepto", "Categoría", "DIAN", "Monto/mes", "On/Off", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: h === "Monto/mes" ? "right" : "left", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 0 }}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}>💳</div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"#fafafa"}}>Registra tus gastos mensuales</h3>
                      <p style={{fontSize:13,color:"#71717a",maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>Vivienda, alimentación, transporte, educación, seguros, entretenimiento. <strong style={{color:"#a1a1aa"}}>Solo gastos — no incluyas cuotas de créditos ni hipotecas</strong>, esas van en la sección Deudas.</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={()=>setShowForm(true)} style={{background:"#22c55e",color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar gasto</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>📥 Importar tabla Excel de gastos</button>}
                      </div>
                      <div style={{background:"#1e1e24",borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#71717a",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Ejemplo de Excel para importar</div>
                        <table style={{width:"100%",fontSize:11,color:"#a1a1aa"}}>
                          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"4px 8px",textAlign:"left",color:"#71717a"}}>Concepto</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Monto/mes</th><th style={{padding:"4px 8px",color:"#71717a"}}>Categoría</th></tr></thead>
                          <tbody>
                            <tr><td style={{padding:"4px 8px"}}>Arriendo vivienda</td><td style={{textAlign:"right",padding:"4px 8px"}}>$4,500,000</td><td style={{padding:"4px 8px"}}>Vivienda</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Mercado semanal</td><td style={{textAlign:"right",padding:"4px 8px"}}>$1,800,000</td><td style={{padding:"4px 8px"}}>Alimentación</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Colegio hijo</td><td style={{textAlign:"right",padding:"4px 8px"}}>$2,300,000</td><td style={{padding:"4px 8px"}}>Educación</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
            ) : allItems.map((item) => (
              <tr key={item.key} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(item.key) ? T.redDim : "transparent" }}>
                <td style={{ padding: "10px 12px" }}>
                  <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSel(item.key)}
                    style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{fontWeight: 600, display: "flex", alignItems: "center", gap: 6}}>
                    {warningsByItemKey.has(item.key) && (() => {
                      const ws = warningsByItemKey.get(item.key);
                      const hasError = ws.some(w => w.severity === "error");
                      return (
                        <span
                          onClick={() => openEdit(item)}
                          title={ws.map(w => "• " + (w.message || w.accionSugerida)).join("\n")}
                          style={{ fontSize: 13, cursor: "pointer", color: hasError ? "#ef4444" : "#f59e0b", flexShrink: 0 }}
                        >⚠️</span>
                      );
                    })()}
                    <span>{item.c || "—"}</span>
                  </div>
                  {(()=>{
                    if(!item.owner || item.owner==="") return null;
                    if(item.owner==="na") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>🌐 N/A</div>;
                    if(item.owner==="own_1") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>👤 Personal</div>;
                    const ow=(owners||[]).find(o=>o.id===item.owner);
                    return ow ? <div style={{fontSize:9,color:"#71717a",marginTop:2}}>{ow.type==="juridica"?"🏢":"👤"} {ow.name}</div> : null;
                  })()}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: T.redDim, color: T.red, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.cat}</span>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 10 }}>
                  {(()=>{
                    if(!item.owner || item.owner==="" || item.owner==="na") return <span style={{color:"#71717a"}}>—</span>;
                    // Commit 17 Tarea 3: jurídica también usa reglaItem para coherencia
                    // total. La migración silenciosa interna deriva fiscalCode si falta.
                    const r = reglaItem(item, owners);
                    if (!r) return <span style={{color:"#71717a"}}>—</span>;
                    return <span style={{color: r.color, fontWeight: 600}} title={r.help}>{r.txt}</span>;
                  })()}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: (item.t === "f" ? T.blue : T.orange) + "15", color: item.t === "f" ? T.blue : T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.t === "f" ? "fijo" : "variable"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.red, fontFamily: "monospace" }}>{fm(item.m)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <button onClick={() => { if (!guardEdit(role)) return; const upd = {...gastos}; upd[item.cat] = upd[item.cat].map((g,i) => i===item.idx ? {...g, sim: !(item.sim!==false)} : g); onUpdate(upd); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={item.sim===false?"Mostrar":"Ocultar"}>{item.sim===false?"⬜":"✅"}</button>
                  <button onClick={() => openEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                  <button onClick={() => { if (!guardEdit(role)) return; const g = { ...gas }; g[item.cat] = g[item.cat].filter((_, i) => i !== item.idx); if (g[item.cat].length === 0) delete g[item.cat]; onUpdate(g); }}
                    style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editKey ? "Editar Gasto" : "Agregar Gasto"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Photo scan option — Básico+ */}
              {plan==="free" ? (
                <div style={{background:"rgba(234,179,8,0.06)",border:"1px dashed rgba(234,179,8,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={()=>onUpgrade&&onUpgrade()}>
                  <div style={{fontSize:12,fontWeight:600,color:"#eab308"}}>🔒 📸 Lectura de facturas con IA</div>
                  <div style={{fontSize:10,color:"#71717a",marginTop:2}}>Disponible desde el plan Básico · click para ver planes</div>
                </div>
              ) : (
                <div style={{background:"rgba(139,92,246,0.06)",border:"1px dashed rgba(139,92,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={()=>{if(!scanning)scanImage()}}>
                  {scanning ? <div style={{fontSize:12,color:"#a78bfa"}}>🔄 Leyendo factura...</div> : <>
                    <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>📸 ¿Tienes la factura o recibo?</div>
                    <div style={{fontSize:10,color:"#71717a",marginTop:2}}>Sube una foto o PDF y los campos se llenan automáticamente</div>
                  </>}
                </div>
              )}
              <In l="Categoría" value={form.cat} onChange={(v) => {
                const ow = (owners || []).find(o => o.id === form.owner);
                const ownerType = ow ? ow.type : "natural";
                setForm((p) => ({ ...p, cat: v, fiscalCode: defaultFiscalCode(ownerType, v) }));
              }} options={[{v:"Aporte tributario",l:"🛡️ Aporte tributario (PV, AFC, Salud prepagada)"},{v:"Nómina",l:"👥 Nómina y empleados"},{v:"Honorarios",l:"📋 Honorarios profesionales (contador, abogado)"},{v:"Vivienda",l:"🏠 Vivienda / Arriendo oficina"},{v:"Servicios",l:"💡 Servicios (luz, agua, internet, gas)"},{v:"Mantenimiento",l:"🔧 Mantenimiento y reparaciones"},{v:"Seguros",l:"🛡️ Seguros y pólizas"},{v:"Transporte",l:"🚗 Transporte y combustible"},{v:"Arrendamiento",l:"📄 Arrendamiento operativo (renting, leasing)"},{v:"Impuesto",l:"🏛️ Impuesto (predial, rodamiento, ICA, otros)"},{v:"Representación",l:"🤝 Gastos de representación"},{v:"Tecnología",l:"💻 Tecnología y software"},{v:"Depreciación",l:"🏗️ Depreciación (Art. 128-141 ET, solo jurídica)"},{v:"Alimentación",l:"🛒 Alimentación y mercado"},{v:"Educación",l:"📚 Educación y capacitación"},{v:"Salud",l:"🏥 Salud / Medicina prepagada"},{v:"Seguridad Social",l:"🏛️ Seguridad social (pensión, EPS, ARL) — se deduce automáticamente"},{v:"Entretenimiento",l:"🎬 Entretenimiento y ocio"},{v:"Vestimenta",l:"👔 Vestimenta"},{v:"Mascotas",l:"🐾 Mascotas"},{v:"Deporte",l:"⚽ Deporte y bienestar"},{v:"Personal",l:"👤 Gastos personales"},{v:"Ahorro",l:"💰 Ahorro e inversión"},{v:"Otro",l:"📝 Otro"}]} />
              <In l="Concepto" value={form.c} onChange={(v) => setForm((p) => ({ ...p, c: v }))} placeholder="Arriendo" />

              {/* Commit 1.6: sub-selector para Aporte tributario (PV, AFC, Salud prepagada) */}
              {form.cat === "Aporte tributario" && (() => {
                const opts = fiscalSubOptions(null, "Aporte tributario");
                const currentFC = form.fiscalCode || "AP_TRIB_PV";
                return (
                  <div style={{gridColumn:"1/-1",background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"14px 16px",marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#a855f7",marginBottom:8}}>{opts.question}</div>
                    <select value={currentFC} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                      style={{width:"100%",background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",color:"#fafafa",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",cursor:"pointer"}}>
                      {opts.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <div style={{fontSize:10,color:"#a1a1aa",marginTop:8,lineHeight:1.5}}>{opts.help}</div>
                    <div style={{fontSize:10,color:"#71717a",marginTop:6,lineHeight:1.5,fontStyle:"italic"}}>
                      ℹ️ Esta categoría sólo reduce impuestos si la asignás a un propietario fiscal de tipo <strong>persona natural</strong> con ingresos laborales.
                    </div>
                  </div>
                );
              })()}

              {/* Commit B2: sub-selector cuando categoría = "Seguros". Discrimina tipos
                  de seguro porque NO todos son deducibles (Art. 387 #2 ET salud y vida sí;
                  vehículo y hogar NO para persona natural). */}
              {form.cat === "Seguros" && (() => {
                const currentFC = form.fiscalCode || "SEG_GENERICO";
                const opts = [
                  { v: "SEG_SALUD", l: "🏥 Seguro de salud — deducible (Art. 387 #2)" },
                  { v: "SEG_VIDA", l: "❤️ Seguro de vida — deducible (Art. 387 #2)" },
                  { v: "GAS_INMUEBLE_SEGUROS", l: "🏘️ Seguro del inmueble arrendado — deducible si tenés arriendos" },
                  { v: "SEG_VEHICULO", l: "🚗 Seguro de vehículo — NO deducible (persona natural)" },
                  { v: "SEG_HOGAR", l: "🏠 Seguro de hogar — NO deducible (persona natural)" },
                  { v: "SEG_GENERICO", l: "❓ Otro / Sin clasificar — NO deducible por defecto" },
                ];
                const help = currentFC === "SEG_SALUD" || currentFC === "SEG_VIDA"
                  ? "Entra al tope de 16 UVT/mes (~$839K) compartido con medicina prepagada y gastos médicos."
                  : currentFC === "GAS_INMUEBLE_SEGUROS"
                  ? "Solo se deduce si el owner tiene ingresos por arriendo de inmueble. Cae al 100% sobre la renta no laboral."
                  : currentFC === "SEG_VEHICULO" || currentFC === "SEG_HOGAR"
                  ? "Para persona natural NO es deducible. Sólo en jurídica con causalidad probada (Art. 107 ET)."
                  : "Default conservador. Si tenés un seguro deducible, especificá el tipo correcto.";
                return (
                  <div style={{gridColumn:"1/-1",background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"14px 16px",marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:8}}>🛡️ ¿Qué tipo de seguro es?</div>
                    <select value={currentFC} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                      style={{width:"100%",background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",color:"#fafafa",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",cursor:"pointer"}}>
                      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <div style={{fontSize:10,color:"#a1a1aa",marginTop:8,lineHeight:1.5}}>{help}</div>
                  </div>
                );
              })()}

              {/* Toggle modo: valor fijo vs capital × tasa */}
              <div style={{ gridColumn: "1/-1", background: T.bg3, borderRadius: 10, padding: "8px", display: "flex", gap: 6, marginTop: 4, marginBottom: 4 }}>
                <button type="button" onClick={() => setForm(p => ({ ...p, montoModo: "fijo" }))}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: form.montoModo !== "tasa" ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.06)", background: form.montoModo !== "tasa" ? "rgba(34,197,94,0.08)" : "transparent", color: form.montoModo !== "tasa" ? "#22c55e" : T.txt3, fontSize: 12, fontWeight: form.montoModo !== "tasa" ? 700 : 500, cursor: "pointer" }}>
                  💵 Valor fijo
                </button>
                <button type="button" onClick={() => setForm(p => ({ ...p, montoModo: "tasa" }))}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: form.montoModo === "tasa" ? "1.5px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)", background: form.montoModo === "tasa" ? "rgba(59,130,246,0.08)" : "transparent", color: form.montoModo === "tasa" ? "#3b82f6" : T.txt3, fontSize: 12, fontWeight: form.montoModo === "tasa" ? 700 : 500, cursor: "pointer" }}>
                  📊 Capital × tasa
                </button>
              </div>

              {form.montoModo !== "tasa" ? (
                <div style={{display:"flex",gap:8,gridColumn:"1/-1"}}>
                  <div style={{flex:1}}><In l="Monto" value={form.m} onChange={(v) => setForm((p) => ({ ...p, m: v }))} type="number" placeholder="0" /></div>
                  <div style={{flex:1}}><In l="Frecuencia" value={form.freq} onChange={(v) => setForm((p) => ({ ...p, freq: v }))} options={[{ v: "mes", l: "Mensual" }, { v: "año", l: "Anual" }]} /></div>
                </div>
              ) : (
                <div style={{ gridColumn: "1/-1", background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#3b82f6", marginBottom: 8, fontWeight: 600 }}>📊 Cálculo automático: capital × tasa = monto mensual</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <In l="💼 Capital" value={form.capital} onChange={(v) => {
                      const cap = Number(v) || 0;
                      const tas = Number(form.tasa) || 0;
                      const tm = form.tasaModo || "mensual";
                      const mensual = tm === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100);
                      setForm(p => ({ ...p, capital: v, m: (cap > 0 && tas > 0) ? String(mensual) : p.m, freq: "mes" }));
                    }} type="number" placeholder="500000000" />
                    <In l="📈 Tasa %" value={form.tasa} onChange={(v) => {
                      const tas = Number(v) || 0;
                      const cap = Number(form.capital) || 0;
                      const tm = form.tasaModo || "mensual";
                      const mensual = tm === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100);
                      setForm(p => ({ ...p, tasa: v, m: (cap > 0 && tas > 0) ? String(mensual) : p.m, freq: "mes" }));
                    }} type="number" placeholder="1" />
                  </div>
                  <In l="Periodicidad de la tasa" value={form.tasaModo} onChange={(v) => {
                    const cap = Number(form.capital) || 0;
                    const tas = Number(form.tasa) || 0;
                    const mensual = v === "anual" ? Math.round((cap * tas / 100) / 12) : Math.round(cap * tas / 100);
                    setForm(p => ({ ...p, tasaModo: v, m: (cap > 0 && tas > 0) ? String(mensual) : p.m, freq: "mes" }));
                  }} options={[{ v: "mensual", l: "📅 Mensual (ej: 1% mensual)" }, { v: "anual", l: "📅 Anual (ej: 12% anual)" }]} />
                  {Number(form.capital) > 0 && Number(form.tasa) > 0 && (
                    <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                      💰 Monto calculado: {fm(form.tasaModo === "anual" ? (Number(form.capital) * Number(form.tasa) / 100) / 12 : Number(form.capital) * Number(form.tasa) / 100)} / mes
                    </div>
                  )}
                  {/* Commit E: warning si capital muy bajo (<$10K) */}
                  {Number(form.capital) > 0 && Number(form.capital) < 10_000 && (
                    <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 11, color: T.red, lineHeight: 1.5 }}>
                      ⚠️ El capital es muy bajo ({"$" + Math.round(Number(form.capital)).toLocaleString()}). ¿Faltan ceros? Si el valor es correcto, ignorá este aviso.
                    </div>
                  )}
                  {/* Commit E: validacion de tasa absurda */}
                  {(() => {
                    const tas = Number(form.tasa) || 0;
                    if (tas <= 0) return null;
                    const tm = form.tasaModo || "mensual";
                    const altoRojo = tm === "mensual" ? tas > 10 : tas > 100;
                    const altoNaranja = tm === "mensual" ? tas > 5 : tas > 50;
                    if (altoRojo) {
                      return (
                        <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 11, color: T.red, lineHeight: 1.5 }}>
                          ⚠️ Tasa muy alta: {tas}% {tm}. {tm === "mensual" ? "10% mensual ya es ~214% anual." : "100% anual es excepcional."} ¿Querias decir {tm === "anual" ? "tasa mensual" : "tasa anual"}? Cambia la periodicidad arriba si es el caso.
                        </div>
                      );
                    }
                    if (altoNaranja) {
                      return (
                        <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 8, fontSize: 11, color: "#f97316", lineHeight: 1.5 }}>
                          🟠 Tasa alta: {tas}% {tm}. Verificá que la periodicidad ({tm}) sea correcta.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              <In l="Propietario fiscal (opcional)" value={form.owner} onChange={(v) => {
                const ow = (owners || []).find(o => o.id === v);
                const ownerType = ow ? ow.type : "natural";
                setForm((p) => ({ ...p, owner: v, fiscalCode: defaultFiscalCode(ownerType, p.cat) }));
              }} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} />
              <div style={{fontSize:10,color:"#71717a",marginTop:-8,marginBottom:8,padding:"0 4px"}}>Si asignas propietario, se incluirá en el cálculo de impuestos. Si no, se omite.</div>
              {(() => {
                const ow = (owners || []).find(o => o.id === form.owner);
                if (!ow || ow.type !== "juridica") return null;
                // Sub-selector solo para categorías ambiguas en jurídica donde
                // la causalidad Art. 107 ET no es obvia por la categoría sola.
                const ambiguous = ["Educación", "Vivienda", "Alimentación", "Entretenimiento", "Vestimenta", "Personal", "Salud", "Transporte", "Representación"];
                if (!ambiguous.includes(form.cat)) return null;
                // Default basado en la regla conservadora: para categorías de consumo
                // personal típico (Alimentación, Entretenimiento, Personal) default es
                // NO deducible. Para educación/vivienda default es operativo/capacitación.
                const currentFC = form.fiscalCode || defaultFiscalCode("juridica", form.cat);
                const isDeductible = currentFC !== "GAS_JUR_NO_DEDUCIBLE";
                const deductibleCode = form.cat === "Educación" ? "GAS_JUR_CAPACITACION" : "GAS_JUR_OPERATIVO";
                return (
                  <div style={{background:"rgba(249,115,22,0.04)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:10,padding:"12px 14px",marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#f97316",marginBottom:8}}>🧾 ¿Este gasto cumple causalidad con la actividad de la empresa? (Art. 107 ET)</div>
                    <select value={currentFC} onChange={(e) => setForm((p) => ({ ...p, fiscalCode: e.target.value }))}
                      style={{width:"100%",background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",color:"#fafafa",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",cursor:"pointer"}}>
                      <option value={deductibleCode}>✅ Sí — relacionado con la actividad productora de renta (DEDUCIBLE)</option>
                      <option value="GAS_JUR_NO_DEDUCIBLE">❌ No — gasto personal o sin nexo con la actividad (NO deducible)</option>
                    </select>
                    <div style={{fontSize:10,color:"#a1a1aa",marginTop:6,lineHeight:1.5}}>Art. 107 ET exige causalidad, necesidad y proporcionalidad. <strong>Ejemplos</strong>: colegio de hijos del socio = NO deducible aunque lo pague la SAS. Cursos de contabilidad para empleados = SÍ deducible. Arriendo de oficina operativa = SÍ. Arriendo de vivienda del socio = NO.</div>
                    <div style={{fontSize:10,fontWeight:600,marginTop:6,color:isDeductible?"#22c55e":"#ef4444"}}>{isDeductible ? "✅ Este gasto bajará el impuesto de renta de la empresa" : "⚠️ Este gasto NO bajará el impuesto de renta (pero sí se registra en tu cash flow)"}</div>
                  </div>
                );
              })()}

              {/* Commit A Fase 2: toggle "gasto de actividad por honorarios" para naturales */}
              {(() => {
                const ow = (owners || []).find(o => o.id === form.owner);
                if (!ow || ow.type !== "natural") return null;
                // ¿El owner tiene ingresos por honorarios?
                const tieneHonorarios = (ingresos || []).some(i =>
                  i.owner === ow.id &&
                  (i.fiscalCode === "LAB_HONORARIOS_CON_EMPLEADOS" ||
                   i.fiscalCode === "LAB_HONORARIOS_SIN_EMPLEADOS" ||
                   i.fiscalCode === "NOL_HONORARIOS_INDEP")
                );
                if (!tieneHonorarios) return null;

                // Categorías que típicamente pueden ser de actividad por honorarios
                const catsApp = ["Vivienda", "Servicios", "Mantenimiento", "Transporte", "Representación",
                                 "Tecnología", "Educación", "Honorarios", "Nómina", "Arrendamiento",
                                 "Seguridad Social", "Otro"];
                if (!catsApp.includes(form.cat)) return null;

                const isHon = String(form.fiscalCode || "").startsWith("GAS_HON_");
                // Mapping de categoría → fiscalCode honorarios sugerido
                const sugeridoPorCat = {
                  "Seguridad Social": "GAS_HON_SEG_SOCIAL",
                  "Nómina": "GAS_HON_NOMINA_TERCEROS",
                  "Honorarios": "GAS_HON_NOMINA_TERCEROS",
                  "Vivienda": "GAS_HON_OFICINA",
                  "Arrendamiento": "GAS_HON_OFICINA",
                  "Servicios": "GAS_HON_SERVICIOS_OFICINA",
                  "Mantenimiento": "GAS_HON_OFICINA",
                  "Tecnología": "GAS_HON_INTERNET_TELEFONIA",
                  "Transporte": "GAS_HON_VEHICULO",
                  "Representación": "GAS_HON_REPRESENTACION",
                  "Educación": "GAS_HON_CAPACITACION",
                  "Otro": "GAS_HON_OTROS",
                };

                return (
                  <div style={{gridColumn:"1/-1",background:"rgba(99,102,241,0.04)",border:`1px solid ${isHon?"#6366f1":"rgba(99,102,241,0.2)"}`,borderRadius:10,padding:"12px 14px",marginTop:4}}>
                    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                      <input
                        type="checkbox"
                        checked={isHon}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const fc = sugeridoPorCat[form.cat] || "GAS_HON_OTROS";
                            setForm(p => ({ ...p, fiscalCode: fc }));
                          } else {
                            // volver al default según owner type + categoría
                            setForm(p => ({ ...p, fiscalCode: defaultFiscalCode("natural", p.cat), causalidad: "" }));
                          }
                        }}
                        style={{width:16,height:16,accentColor:"#6366f1",cursor:"pointer"}}
                      />
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:isHon?"#6366f1":T.txt}}>
                          🧾 ¿Es gasto de tu actividad por honorarios? (Art. 107 ET)
                        </div>
                        <div style={{fontSize:10,color:T.txt3,marginTop:2,lineHeight:1.4}}>
                          Marcalo si este gasto cumple causalidad, necesidad y proporcionalidad con tu actividad independiente. Reduce la base gravable de tus honorarios antes de aplicar la cédula laboral.
                        </div>
                      </div>
                    </label>

                    {isHon && (
                      <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(99,102,241,0.15)"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#6366f1",marginBottom:6}}>Tipo de gasto deducible</div>
                        <select
                          value={form.fiscalCode}
                          onChange={(e) => setForm(p => ({ ...p, fiscalCode: e.target.value }))}
                          style={{width:"100%",background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",color:"#fafafa",padding:"10px 12px",borderRadius:8,fontSize:13,outline:"none",cursor:"pointer"}}
                        >
                          <option value="GAS_HON_SEG_SOCIAL">🏛️ Seguridad social independiente (100%, Art. 126-1)</option>
                          <option value="GAS_HON_NOMINA_TERCEROS">👥 Nómina/honorarios a terceros (con retención)</option>
                          <option value="GAS_HON_OFICINA">🏢 Arriendo oficina/coworking</option>
                          <option value="GAS_HON_SERVICIOS_OFICINA">💡 Servicios públicos del lugar de trabajo</option>
                          <option value="GAS_HON_INTERNET_TELEFONIA">📞 Internet/telefonía profesional</option>
                          <option value="GAS_HON_MATERIALES">📦 Materiales y suministros profesionales</option>
                          <option value="GAS_HON_VEHICULO">🚗 Vehículo (50% conservador, máx 1)</option>
                          <option value="GAS_HON_VIAJES">✈️ Viajes con propósito documentado</option>
                          <option value="GAS_HON_REPRESENTACION">🤝 Representación (tope 10% Art. 107-1)</option>
                          <option value="GAS_HON_CAPACITACION">📚 Capacitación profesional</option>
                          <option value="GAS_HON_OTROS">📝 Otros con causalidad documentada</option>
                        </select>

                        <div style={{marginTop:10}}>
                          <label style={{fontSize:11,fontWeight:700,color:"#6366f1",display:"block",marginBottom:4}}>
                            Nota de causalidad (opcional pero recomendado)
                          </label>
                          <input
                            type="text"
                            value={form.causalidad || ""}
                            onChange={(e) => setForm(p => ({ ...p, causalidad: e.target.value }))}
                            placeholder="Ej: Internet de oficina usado para reuniones con clientes"
                            style={{width:"100%",background:"#1e1e24",border:"1px solid rgba(255,255,255,0.06)",color:"#fafafa",padding:"10px 12px",borderRadius:8,fontSize:12,outline:"none"}}
                          />
                          <div style={{fontSize:10,color:T.txt3,marginTop:4,lineHeight:1.4}}>
                            Si la DIAN cuestiona la deducción, esta nota ayuda a justificar la causalidad. No es obligatorio.
                          </div>
                        </div>

                        {form.fiscalCode === "GAS_HON_VEHICULO" && (
                          <div style={{marginTop:10,padding:"8px 10px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:6,fontSize:10,color:T.orange,lineHeight:1.4}}>
                            ⚠️ El motor aplica solo el 50% del gasto del vehículo (uso mixto). Solo se permite UN vehículo deducible por persona.
                          </div>
                        )}
                        {form.fiscalCode === "GAS_HON_REPRESENTACION" && (
                          <div style={{marginTop:10,padding:"8px 10px",background:"rgba(249,115,22,0.06)",border:"1px solid rgba(249,115,22,0.2)",borderRadius:6,fontSize:10,color:T.orange,lineHeight:1.4}}>
                            ⚠️ Los gastos de representación tienen tope rígido del 10% del honorario bruto (Art. 107-1 ET). El motor lo aplica automáticamente.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <In l="Tipo" value={form.t} onChange={(v) => setForm((p) => ({ ...p, t: v }))} options={[{ v: "f", l: "Fijo" }, { v: "v", l: "Variable" }]} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editKey ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
