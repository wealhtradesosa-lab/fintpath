import { useState } from "react";
import SimToggleInfo from "./SimToggleInfo";

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
};

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />}
    </div>
  );

export default function IngresosModule({ ingresos, owners, onUpdate, trm, fmt, onImport}) {
  const fm = fmt || _fm;
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
            body: JSON.stringify({ image: base64, type: "ingreso", mediaType })
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
            alert("✅ Documento leído" + (d.confianza === "alta" ? "" : " (revisa los datos)") + "\n\n" + (d.nombre || "") + ": $" + (d.mensual || 0).toLocaleString() + " — " + (d.categoria || ""));
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
  const [selected, setSelected] = useState(new Set());

  const items = ingresos || [];
  
  const allItems = items;
  const activos = allItems.filter((i) => i.sim !== false);

  const totalMes = activos.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const fijos = activos.filter((i) => i.tipo === "fijo").reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const variables = totalMes - fijos;

  const toggleSelect = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === allItems.length ? new Set() : new Set(allItems.map((i) => i.id)));
  const deleteSelected = () => {
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} ingreso(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id))); // only deletes standalone, not inv-derived
    setSelected(new Set());
  };
  const handleSave = () => {
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
    let updated;
    if (editId) { updated = items.map((i) => (i.id === editId ? { ...item, id: editId } : i)); }
    else { item.id = "ing_" + Date.now(); updated = [...items, item]; }
    onUpdate(updated);
    setShowForm(false); setEditId(null);
    setForm(INITIAL_FORM);
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
    });
    setEditId(item.id); setShowForm(true);
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ingresos</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>{activos.length}{activos.length !== allItems.length ? ` de ${allItems.length}` : ""} fuente{activos.length !== 1 ? "s" : ""} de ingreso{activos.length !== allItems.length ? " activa" + (activos.length !== 1 ? "s" : "") : ""} • Total: <span style={{ color: T.green, fontWeight: 700 }}>{fm(totalMes)}/mes</span></p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={() => { setEditId(null); setForm(INITIAL_FORM); setShowForm(true); }}
            style={{ background: T.green, color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            + Agregar
          </button>
        </div>
      </div>

      {/* Banner explicando toggle sim (Commit 8.8) */}
      <SimToggleInfo total={allItems.length} activos={activos.length} moduloNombre="un ingreso" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[{ l: "Total Mensual", v: fm(totalMes), c: T.green }, { l: "Total Anual", v: fm(totalMes * 12), c: T.blue }, { l: "Fijos", v: fm(fijos), c: T.blue }, { l: "Variables", v: fm(variables), c: T.orange }].map((m) => (
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
                        <button onClick={()=>setShowForm(true)} style={{background:T.green,color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar ingreso</button>
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
                ) : allItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(item.id) ? T.greenDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                        style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{fontWeight: 600}}>{item.nombre}</div>
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
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.green, fontFamily: "monospace" }}>{fm(item.moneda==="USD" ? (item.mensual||0)*(trm||4200) : (item.mensual||0))}{item.moneda==="USD" && <span style={{fontSize:9,color:T.txt3,marginLeft:4}}>USD ${Math.round(item.mensual).toLocaleString()}</span>}</td>
                    <td style={{ padding: "10px 14px", color: T.txt3, fontSize: 12 }}>{item.capital > 0 ? "$" + Math.round(item.capital).toLocaleString() + (item.tasa ? " • " + item.tasa + "%" : "") : item.fuente || "—"}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}><div style={{display:"flex",alignItems:"center",gap:4}}>
                      <button onClick={() => { const upd = items.map(x => x.id === item.id ? {...x, sim: !(item.sim!==false)} : x); onUpdate(upd); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={item.sim===false?"Mostrar en simulador":"Ocultar del simulador"}>{item.sim===false?"⬜":"✅"}</button>
                      <button onClick={() => handleEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (confirm("¿Eliminar este registro?")) onUpdate(items.filter((i) => i.id !== item.id)); }} style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Ingreso" : "Agregar Ingreso"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Photo scan option */}
              <div style={{gridColumn:"1/-1",background:"rgba(139,92,246,0.06)",border:"1px dashed rgba(139,92,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:4,textAlign:"center",cursor:"pointer"}} onClick={()=>{if(!scanning)scanImage()}}>
                {scanning ? <div style={{fontSize:12,color:"#a78bfa"}}>🔄 Leyendo documento...</div> : <>
                  <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>📸 ¿Tienes un extracto, certificado o recibo?</div>
                  <div style={{fontSize:10,color:"#71717a",marginTop:2}}>Sube una foto o PDF y los campos se llenan automáticamente</div>
                </>}
              </div>
              <div style={{ gridColumn: "1/-1" }}><In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Rapicredit fondeo, Salario, Arriendo casa" /></div>
              <In l={["Salario","Honorarios"].includes(form.categoria) ? "💵 Monto BRUTO mensual (antes de descuentos)" : "💵 Monto mensual"} value={form.mensual} onChange={(v) => {
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
              }} type="number" placeholder={["Salario","Honorarios"].includes(form.categoria) ? "Monto en contrato, antes de retención y aportes" : "¿Cuánto recibes al mes?"} />
              {["Salario","Honorarios"].includes(form.categoria) && <div style={{gridColumn:"1/-1",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:8,padding:"10px 12px",marginTop:-4,marginBottom:4}}>
                <div style={{fontSize:11,fontWeight:700,color:"#3b82f6",marginBottom:3}}>ℹ️ Ingresá el monto BRUTO</div>
                <div style={{fontSize:10,color:"#71717a",lineHeight:1.5}}>El monto que aparece en tu contrato o factura, <strong>antes</strong> de retención en la fuente y aportes obligatorios (salud+pensión). El sistema calcula automáticamente tu impuesto de renta aplicando la tabla progresiva de la DIAN 2026.</div>
              </div>}

              {/* Commit 1.5 + Commit IBC: aportes obligatorios con opción $ valor o # SMMLV */}
              {form.categoria === "Salario" && (
                <div style={{gridColumn:"1/-1",background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"14px 16px",marginTop:4,marginBottom:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#a855f7",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    🛡️ Aportes obligatorios mensuales
                  </div>
                  <div style={{fontSize:10,color:T.txt3,lineHeight:1.5,marginBottom:12}}>
                    Por defecto se calculan en 4%+4% del bruto. Si cotizás sobre un IBC distinto (ej: 25 SMMLV para maximizar pensión), elegí "📊 # SMMLV" y el sistema aplica las tasas legales completas, incluyendo Fondo de Solidaridad Pensional (Art. 27 Ley 100).
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
              <div style={{ gridColumn: "1/-1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 4 }}>
                <div style={{fontSize:11,fontWeight:600,color:"#a1a1aa",marginBottom:8}}>🧾 Clasificación tributaria (opcional)</div>
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
              <div style={{fontSize:10,color:"#71717a",marginTop:-8,marginBottom:4,padding:"0 4px",gridColumn:"1/-1"}}>Si asignas propietario, este ingreso se incluirá en el cálculo de impuestos de esa persona o empresa.</div>

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


              {["Rendimiento","Dividendos","Arriendo","Inversión"].includes(form.categoria) && (
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
                      💰 Capital {"$" + Math.round(Number(form.capital)).toLocaleString()} × {form.tasa}% {form.tasaModo === "mensual" ? "mensual" : "anual"} = {"$" + Math.round(form.tasaModo === "mensual" ? Number(form.capital) * Number(form.tasa) / 100 : Number(form.capital) * Number(form.tasa) / 100 / 12).toLocaleString()}/mes
                    </div>
                  )}
                  {/* Fix: warning si el capital guardado es sospechosamente bajo (<$10K) */}
                  {Number(form.capital) > 0 && Number(form.capital) < 10_000 && (
                    <div style={{marginTop:10,padding:"10px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,fontSize:11,color:T.red,lineHeight:1.5}}>
                      ⚠️ El capital invertido es muy bajo ({"$" + Math.round(Number(form.capital)).toLocaleString()}). ¿Faltan ceros? Un capital típico de inversión es &gt;$100.000. Si el valor es correcto, ignorá este aviso.
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
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: T.green, color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
