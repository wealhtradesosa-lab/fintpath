import { useState } from "react";
import { separarPorLimite } from "../lib/limitePlan.js";
import BloqueadosPorPlan from "./BloqueadosPorPlan";
import NumberInput from "./NumberInput";
import { C } from "../lib/designTokens.js";
import SimToggleInfo from "./SimToggleInfo";
import PageHeader from "./PageHeader";
import { exportDeudasExcel } from "../lib/excelExport.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import FrecuenciaSelector from "./FrecuenciaSelector";
import TablaMensual from "./TablaMensual";
import BarraComposicion from "./BarraComposicion";
import { MESES, costoCredito, montoPromedioMensual, cuotaFija, tasaDesdeCuota } from "../lib/flowHelpers.js";

const T = {
  bg2: C.surface, bg3: "#1e1e24",
  card: "#111113", border: C.border,
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316", purple: "#a78bfa",
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("en-US");
const pc = (n) => (n || 0).toFixed(1) + "%";

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}</select>
        : type === "number"
          ? <NumberInput value={value} onChange={(v) => onChange(v === "" ? "" : String(v))} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
          : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function DeudasModule({ deudas, owners, inversiones, onUpdate, fmt, onImport, user, plan, onUpgrade}) {
  const fm = fmt || _fm;
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
          const res = await fetch("/.netlify/functions/analyze-image", {
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
            const cop = (v) => "$" + Number(v).toLocaleString("es-CO");
            const ok = [];
            const falta = [];
            leido.n  ? ok.push("Nombre: " + leido.n)        : falta.push("nombre");
            leido.mt ? ok.push("Saldo: " + cop(leido.mt))   : falta.push("saldo");
            leido.pg ? ok.push("Cuota: " + cop(leido.pg))   : falta.push("cuota");
            leido.ts ? ok.push("Tasa: " + leido.ts + "% E.A.") : falta.push("tasa");
            alert(
              "✅ Documento leído" + (d.confianza === "alta" ? "" : " (confianza " + (d.confianza || "media") + " — revisá los datos)") +
              "\n\n" + ok.join("\n") +
              (falta.length ? "\n\n⚠️ No pude leer: " + falta.join(", ") + ".\nEsos campos conservan el valor que ya tenías — revisalos a mano." : "")
            );
          } else {
            const det = data.error || data.errorMessage || "";
            const esTimeout = /timed out|timeout/i.test(det);
            alert(esTimeout
              ? "⏱️ El documento tardó demasiado en procesarse. Probá de nuevo, o subí una foto/captura de la página del extracto (pesa menos y se lee más rápido)."
              : "⚠️ No se pudo leer el documento." + (det ? "\n\nDetalle: " + det : "") + "\n\nSi es una foto, probá una más clara; si es un PDF, que no supere ~4 MB y no esté protegido con contraseña.");
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
  const [form, setForm] = useState({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "", capExt: "", intExt: "", frecuencia: "mensual", montosMensuales: new Array(12).fill(0) });
  const [selected, setSelected] = useState(new Set());
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
  const activos = items.filter((d) => d.sim !== false);
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

  const toggleSel = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const deleteSelected = () => {
    if (!guardEdit(role)) return;
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} deuda(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const handleSave = () => {
    if (!guardEdit(role)) return;
    // Commit 5 Tarea 3 (bugfix): persistir fiscalCode al guardar. Antes el campo
    // se omitía y el motor caía al default vía normalizer, ignorando la elección
    // del usuario en el sub-selector "¿Para qué usaste esta deuda?".
    const item = { n: form.n || "", tp: form.tp || "loan", fiscalCode: form.fiscalCode || "DEU_NAT_CONSUMO", mt: +form.mt || 0, pg: +form.pg || 0, ts: +form.ts || 0, tipoInteres: form.tipoInteres || undefined, plazoMeses: form.plazoMeses ? Number(form.plazoMeses) : undefined, moneda: form.moneda || undefined, la: form.la || null, owner: form.owner || "",
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
    setForm({ n: d.n, tp: d.tp, fiscalCode: d.fiscalCode || (d.tp === "mortgage" ? "DEU_NAT_VIVIENDA_HABITACIONAL" : "DEU_NAT_CONSUMO"), mt: d.mt, pg: d.pg, ts: d.ts, tipoInteres: d.tipoInteres || "compuesto", plazoMeses: d.plazoMeses || "", moneda: d.moneda || "COP", la: d.la || "", owner: d.owner || "", capExt: "", intExt: "", desdeMes: Number(d.desdeMes) || 1, hastaMes: Number(d.hastaMes) || 12, vigenciaModo: d.vigenciaModo , frecuencia: d.frecuencia || "mensual", montosMensuales: Array.isArray(d.montosMensuales) ? d.montosMensuales : new Array(12).fill(0)});
    setEditId(d.id);
    setShowForm(true);
  };

  // Set de IDs de deudas sin propietario asignado, para badges en rows.
  const deudasSinOwnerIds = new Set((deudas || []).filter(d => !d.owner || d.owner === "").map(d => d.id));

  return (
    <div>
      <PageHeader
        label="Deudas"
        title="Lo que debes"
        subtitle={`${activos.length}${activos.length !== items.length ? ` de ${items.length}` : ""} deuda${activos.length !== 1 ? "s" : ""} · Saldo: ${fm(totalDeuda)} · Cuotas: ${fm(totalCuotas)}/mes`}
        rightSlot={<>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>🗑️ Eliminar ({selected.size})</button>
          )}
          <button onClick={() => exportDeudasExcel(activos, inversiones, owners)}
            title="Descarga XLSX con detalle de deudas + vinculación con activos"
            style={{ background: "#059669", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            📊 Excel
          </button>
          <button onClick={() => { setEditId(null); setForm({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "", capExt: "", intExt: "", desdeMes: 1, hastaMes: 12, vigenciaModo: undefined }); setShowForm(true); }}
            style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 22px", borderRadius: 100, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </>}
      />

      {/* Banner contextual: deudas sin propietario o sin clasificación fiscal explícita.
          Items sin owner no se atribuyen a una persona/empresa para el cálculo de
          intereses deducibles, lo que afecta el cálculo de Impuestos. */}
      {(() => {
        if (!user) return null;
        const sinOwner = (deudas || []).filter(d => !d.owner || d.owner === "");
        if (sinOwner.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", flex: 1 }}>
                {sinOwner.length} deuda{sinOwner.length !== 1 ? "s" : ""} sin propietario asignado
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
              Sin propietario, los intereses no se deducen de ningún owner en el cálculo de Impuestos.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sinOwner.slice(0, 6).map((d, idx) => (
                <div key={"fw_" + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid " + T.border, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: "#ef4444", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.n || "(sin nombre)"} <span style={{ color: T.txt3, fontWeight: 400, fontFamily: "monospace" }}>· saldo {fm(d.mt || 0)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginTop: 2 }}>Asignale un propietario para que los intereses se deduzcan correctamente</div>
                  </div>
                  <button onClick={() => openEdit(d)} style={{ padding: "5px 10px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, color: "#22c55e", cursor: "pointer", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
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
      />

      {/* Gancho (23-jul-2026, idea Santiago): cuánto sangran los intereses al año.
          Solo si hay deuda con tasa. Ver el número anual mueve más que el saldo. */}
      {totalInteresAnual > 0 && (
        <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: T.txt2 }}>Estás pagando en intereses, al ritmo de hoy</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.red, fontFamily: "monospace", lineHeight: 1.2 }}>{fm(totalInteresAnual)}<span style={{ fontSize: 13, color: T.txt3, fontWeight: 600 }}> /año</span></div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>≈ {fm(Math.round(totalInteresAnual / 12))}/mes que se van solo en interés, sin bajar deuda. Pagar primero la de mayor tasa (avalancha) es lo que más ahorra.</div>
          </div>
        </div>
      )}

      <SimToggleInfo total={items.length} activos={activos.length} moduloNombre="una deuda" />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Deuda Total", v: fm(totalDeuda), c: T.red },
          { l: "Cuotas/mes", v: fm(totalCuotas), c: T.orange },
          { l: "Cuotas/año", v: fm(totalCuotas * 12), c: T.purple },
          { l: "Intereses/año", v: interesAnual > 0 ? fm(interesAnual) : "—", c: "#ef4444" },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 26-jul-2026 (Santiago): barra por tipo de crédito. En deudas la
          proporción que importa es del SALDO, no de la cuota: es lo que dice
          dónde está concentrado el pasivo. */}
      {(() => {
        const NOM = { mortgage: "Hipoteca", loan: "Préstamo", personal: "Personal", tarjeta: "Tarjeta", card: "Tarjeta" };
        const grupos = {};
        (items || []).filter(d => d.sim !== false && (d.mt || 0) > 0).forEach(d => {
          const k = NOM[d.tp] || "Otro";
          grupos[k] = (grupos[k] || 0) + (d.mt || 0) * (d.moneda === "USD" ? (trm || 4200) : 1);
        });
        const datos = Object.entries(grupos).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
        if (datos.length < 2) return null;
        const tot = datos.reduce((s, d) => s + d.value, 0);
        const PAL = ["#ef4444","#f97316","#a78bfa","#3b82f6","#ec4899","#06b6d4"];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 6, fontWeight: 600 }}>DÓNDE ESTÁ TU DEUDA</div>
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
      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll}
                    style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                </th>
                {["Deuda", "Tipo", "Saldo", "Cuota", "Tasa", "Interés/año", "Activo", "On/Off", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: ["Deuda", "Activo", ""].includes(h) ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 0 }}>
                    <div style={{padding:"40px 32px",textAlign:"center"}}>
                      <div style={{fontSize:40,marginBottom:12}}>📋</div>
                      <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"#fafafa"}}>Registra tus deudas y créditos</h3>
                      <p style={{fontSize:13,color:"#71717a",maxWidth:420,margin:"0 auto 20px",lineHeight:1.6}}>Hipotecas, préstamos, tarjetas de crédito, leasing. Incluye <strong style={{color:"#a1a1aa"}}>saldo pendiente, cuota mensual y tasa de interés</strong>. Puedes vincular cada deuda al activo que financia.</p>
                      <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:24}}>
                        <button onClick={()=>setShowForm(true)} style={{background:"#22c55e",color:"#000",border:"none",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>+ Agregar deuda</button>
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>📥 Importar tabla Excel de deudas</button>}
                      </div>
                      <div style={{background:"#1e1e24",borderRadius:12,padding:"16px 20px",maxWidth:400,margin:"0 auto",textAlign:"left"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#71717a",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Ejemplo de Excel para importar</div>
                        <table style={{width:"100%",fontSize:11,color:"#a1a1aa"}}>
                          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"4px 8px",textAlign:"left",color:"#71717a"}}>Deuda</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Saldo</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Cuota/mes</th><th style={{textAlign:"right",padding:"4px 8px",color:"#71717a"}}>Tasa</th></tr></thead>
                          <tbody>
                            <tr><td style={{padding:"4px 8px"}}>Hipoteca apto</td><td style={{textAlign:"right",padding:"4px 8px"}}>$380M</td><td style={{textAlign:"right",padding:"4px 8px"}}>$4,800,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>12%</td></tr>
                            <tr><td style={{padding:"4px 8px"}}>Préstamo vehículo</td><td style={{textAlign:"right",padding:"4px 8px"}}>$45M</td><td style={{textAlign:"right",padding:"4px 8px"}}>$1,200,000</td><td style={{textAlign:"right",padding:"4px 8px"}}>18%</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td></tr>
              ) : separarPorLimite(items, plan).visibles.map((d) => {
                const lk = d.la ? (inversiones || []).find((i) => i.id === d.la) : null;
                return (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(d.id) ? T.redDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)}
                        style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{fontWeight: 600, display: "flex", alignItems: "center", gap: 6}}>
                        {deudasSinOwnerIds.has(d.id) && (
                          <span
                            onClick={() => openEdit(d)}
                            title="Sin propietario asignado — los intereses no se deducen del cálculo de Impuestos"
                            style={{ fontSize: 13, cursor: "pointer", color: "#ef4444", flexShrink: 0 }}
                          >⚠️</span>
                        )}
                        <span>{d.n}</span>
                        {/* Badge vigencia (20-jul-2026): deuda con rango limitado */}
                        {((Number(d.desdeMes) || 1) !== 1 || (Number(d.hastaMes) || 12) !== 12) && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "2px 8px", borderRadius: 10, marginLeft: 6 }}>
                            📅 {MESES.find(m => m.v === (Number(d.desdeMes) || 1))?.l.slice(0,3)}–{MESES.find(m => m.v === (Number(d.hastaMes) || 12))?.l.slice(0,3)} · {(Number(d.hastaMes) || 12) - (Number(d.desdeMes) || 1) + 1} meses
                          </span>
                        )}
                      </div>
                      {(()=>{
                        if(!d.owner || d.owner==="") return null;
                        if(d.owner==="na") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>🌐 N/A</div>;
                        if(d.owner==="own_1") return <div style={{fontSize:9,color:"#71717a",marginTop:2}}>👤 Personal</div>;
                        const ow=(owners||[]).find(o=>o.id===d.owner);
                        return ow ? <div style={{fontSize:9,color:"#71717a",marginTop:2}}>{ow.type==="juridica"?"🏢":"👤"} {ow.name}</div> : null;
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{ background: T.orange + "15", color: T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{d.tp}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.red, fontFamily: "monospace" }}>{fm(d.mt)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace" }}>{fm(d.pg)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{d.ts}%</td>
                    {(() => {
                      const cc = costoCredito(d);
                      return (
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.orange }}>{fm(cc.interesAnual)}</div>
                          {cc.noAmortiza ? (
                            <div style={{ fontSize: 9.5, color: T.red, marginTop: 2 }}>⚠ la cuota no cubre el interés</div>
                          ) : cc.meses != null ? (
                            <div style={{ fontSize: 9.5, color: T.txt3, marginTop: 2 }}>
                              termina en {Math.floor(cc.meses / 12)}a {cc.meses % 12}m
                              {cc.interesTotal > 0 && <> · <span title="Interés restante hasta pagarla toda">interés total {fm(cc.interesTotal)}</span></>}
                              <div style={{ marginTop: 2 }}>
                                cuota: <strong style={{ color: T.orange }}>{fm(cc.interesMes)}</strong> interés · <strong style={{ color: T.green }}>{fm(cc.capitalMes)}</strong> capital
                                {" "}(<strong style={{ color: cc.pctCapital < 25 ? T.red : cc.pctCapital < 50 ? T.orange : T.green }}>{Math.round(cc.pctCapital)}%</strong> baja deuda)
                              </div>
                            </div>
                          ) : null}
                        </td>
                      );
                    })()}
                    <td style={{ padding: "10px 14px" }}>{lk ? <span style={{ background: T.blue + "15", color: T.blue, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{lk.n || lk.nombre || lk.name || "—"}</span> : <span style={{ color: T.txt3 }}>—</span>}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => { if (!guardEdit(role)) return; onUpdate(deudas.map(x => x.id===d.id ? {...x, sim: !(d.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={d.sim===false?"Mostrar":"Ocultar"}>{d.sim===false?"⬜":"✅"}</button>
                      <button onClick={() => openEdit(d)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (!guardEdit(role)) return; if (confirm("¿Eliminar este registro?")) onUpdate(items.filter((i) => i.id !== d.id)); }}
                        style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
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
            fmt={fm} T={T} onUpgrade={onUpgrade} que="deudas" />;
        })()}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Deuda" : "Agregar Deuda"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Photo scan option */}
              <div style={{background:"rgba(139,92,246,0.06)",border:"1px dashed rgba(139,92,246,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:12,textAlign:"center",cursor:"pointer"}} onClick={()=>{if(!scanning)scanImage()}}>
                {scanning ? <div style={{fontSize:12,color:"#a78bfa"}}>🔄 Leyendo extracto...</div> : <>
                  <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>📸 ¿Tienes el extracto o estado de cuenta?</div>
                  <div style={{fontSize:10,color:"#71717a",marginTop:2}}>Sube una foto o PDF y los campos se llenan automáticamente</div>
                </>}
              </div>
              <In l="Nombre" value={form.n} onChange={(v) => setForm((p) => ({ ...p, n: v }))} placeholder="Hipoteca casa" />
              <In l="Tipo" value={form.tp} onChange={(v) => setForm((p) => ({ ...p, tp: v }))} options={[{ v: "mortgage", l: "Hipoteca" }, { v: "loan", l: "Préstamo" }, { v: "personal", l: "Personal" }, { v: "credit_card", l: "Tarjeta" }]} />
              <In l="Saldo" value={form.mt} onChange={(v) => setForm((p) => ({ ...p, mt: v }))} type="number" placeholder="0" />
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
            {(form.tipoInteres || "compuesto") !== "simple" && (
              <div style={{gridColumn:"1/-1",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:11.5,fontWeight:700,color:T.txt2,marginBottom:8}}>🧮 ¿No sabés la cuota o la tasa? Poné el plazo</div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div style={{flex:"1 1 130px"}}>
                    <div style={{fontSize:10,color:T.txt3,marginBottom:4,fontWeight:600}}>PLAZO (MESES)</div>
                    <NumberInput value={form.plazoMeses} onChange={(v)=>setForm(p=>({...p,plazoMeses:v===""?"":String(v)}))}
                      placeholder="240" style={{width:"100%",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 11px",color:T.txt,fontSize:13}} />
                  </div>
                  {(() => {
                    const B=Number(form.mt)||0, n=Number(form.plazoMeses)||0, ts=Number(form.ts)||0, pg=Number(form.pg)||0;
                    if (B<=0 || n<=0) return <div style={{fontSize:11,color:T.txt3,flex:"2 1 200px"}}>Con el saldo y el plazo puedo calcular la cuota o la tasa.</div>;
                    const acciones=[];
                    if (ts>0) {
                      const q=cuotaFija(B,ts,n);
                      if (q) acciones.push(
                        <button key="q" type="button" onClick={()=>setForm(p=>({...p,pg:String(Math.round(q))}))}
                          style={{background:"#3b82f6",color:"#fff",border:"none",padding:"9px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11.5}}>
                          Cuota = {fm(Math.round(q))}
                        </button>);
                    }
                    if (pg>0) {
                      const t=tasaDesdeCuota(B,pg,n);
                      if (t!==null && t>0) acciones.push(
                        <button key="t" type="button" onClick={()=>setForm(p=>({...p,ts:String(Number(t.toFixed(2)))}))}
                          style={{background:T.bg2,color:T.txt,border:`1px solid ${T.border}`,padding:"9px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11.5}}>
                          Tasa = {t.toFixed(2)}%
                        </button>);
                    }
                    return acciones.length ? <div style={{display:"flex",gap:8,flexWrap:"wrap",flex:"2 1 200px"}}>{acciones}</div>
                      : <div style={{fontSize:11,color:T.txt3,flex:"2 1 200px"}}>Cargá la tasa o la cuota y calculo la otra.</div>;
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
                    💡 Interés mensual de este préstamo: <span style={{fontFamily:"monospace",color:T.green,fontWeight:800}}>{fm(Math.round(interesMes))}</span>
                  </div>
                  <div style={{fontSize:10.5,color:T.txt3,lineHeight:1.5,marginBottom:yaEsIgual?0:8}}>
                    {esSimple
                      ? <>{fm(Number(form.mt))} × {form.ts}% ÷ 12. Si solo pagás intereses, esa es tu cuota.</>
                      : <>Interés del primer mes con tasa {form.ts}% E.A. Tu cuota debe superarlo para que la deuda baje.</>}
                  </div>
                  {/* 26-jul-2026: si la cuota está VACÍA se llena sola —no hay
                      nada que pisar, así que es ayuda pura. Con un valor ya
                      escrito queda el botón: la lección del "40,6%" fue que la
                      app no debe sobrescribir un dato del usuario, no que no
                      deba ayudar. */}
                  {!yaEsIgual && (esSimple ? (
                      <button type="button" onClick={() => setForm(p => ({...p, pg: String(Math.round(interesMes))}))}
                        style={{background:"#3b82f6",color:"#fff",border:"none",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11.5}}>
                        Usar {fm(Math.round(interesMes))} como cuota
                      </button>
                    ) : (Number(form.pg) > 0 && Number(form.pg) <= interesMes && (
                      // Aviso, no botón: en un crédito bancario no existe "la
                      // cuota correcta" derivable del saldo y la tasa — depende
                      // del plazo pactado. Lo que sí se puede afirmar es que
                      // una cuota menor al interés nunca amortiza.
                      <div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>
                        ⚠️ Esa cuota no cubre el interés: la deuda nunca baja.
                      </div>
                    )))}
                </div>
              );
            })()}
            <div style={{fontSize:11,color:T.txt3,marginBottom:6,fontWeight:600}}>¿Cómo se cobran los intereses?</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[{v:"compuesto",l:"Como un banco",d:"Interés sobre el saldo, que va bajando. Tasa E.A."},
                  {v:"simple",l:"Interés simple",d:"Siempre sobre el monto original. Préstamos entre personas."}].map(o=>
                  <button key={o.v} type="button" onClick={()=>setForm(p=>({...p,tipoInteres:o.v}))}
                    style={{flex:"1 1 220px",textAlign:"left",background:(form.tipoInteres||"compuesto")===o.v?"rgba(34,197,94,0.10)":T.bg3,
                      border:"1px solid "+((form.tipoInteres||"compuesto")===o.v?T.green:T.border),borderRadius:10,padding:"10px 12px",cursor:"pointer",color:T.txt}}>
                    <div style={{fontSize:12.5,fontWeight:700}}>{o.l}</div>
                    <div style={{fontSize:10.5,color:T.txt3,marginTop:2,lineHeight:1.4}}>{o.d}</div>
                  </button>)}
              </div>
            </div>
            <In l="Moneda" value={form.moneda || "COP"} onChange={(v) => setForm((p) => ({ ...p, moneda: v }))} options={[{v:"COP",l:"🇨🇴 COP (pesos)"},{v:"USD",l:"🇺🇸 USD (se convierte a la TRM)"}]} />
              <In l="Cuota/mes ($)" value={form.pg} onChange={(v) => setForm((p) => ({ ...p, pg: v, cuotaManual: true }))} type="number" placeholder="0" />
              <In l="Tasa anual % (E.A.)" value={form.ts} onChange={(v) => setForm((p) => ({ ...p, ts: v }))} type="number" placeholder="Ej: 22,99" />
            {/* 26-jul-2026 (Santiago cargó 13,7 y quedó 137 por el bug de la
                coma, ya corregido). Una tasa de tres cifras casi siempre es un
                decimal perdido, y el motor la daría por buena: con 137% E.A.
                una hipoteca de $1.700M mostraría $126M de interés mensual en
                vez de $18M. El dato es del usuario, así que no se corrige solo
                —se avisa y se ofrece la lectura probable. */}
            {Number(form.ts) >= 100 && (
              <div style={{gridColumn:"1/-1",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.35)",borderRadius:10,padding:"11px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:3}}>⚠️ Revisá esta tasa: {form.ts}% anual</div>
                <div style={{fontSize:11,color:T.txt3,lineHeight:1.5,marginBottom:8}}>
                  Es inusualmente alta. ¿Quisiste escribir {String(form.ts).slice(0,-1)},{String(form.ts).slice(-1)}%?
                </div>
                <button type="button" onClick={() => setForm(p => ({...p, ts: String(Number(form.ts) / 10)}))}
                  style={{background:"#ef4444",color:"#fff",border:"none",padding:"6px 13px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:11.5}}>
                  Corregir a {Number(form.ts) / 10}%
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
              <div style={{ gridColumn: "1/-1", background: "#17171c", border: `1px dashed ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.txt2, marginBottom: 2 }}>📄 Desglose del extracto <span style={{ fontWeight: 400, color: T.txt3 }}>(opcional)</span></div>
                <div style={{ fontSize: 10, color: T.txt3, marginBottom: 10 }}>Copiá los dos renglones tal cual salen en tu extracto. Con eso se arma la cuota y se verifica la tasa.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <In l="Abono a capital" value={form.capExt || ""} onChange={(v) => setForm((p) => {
                    const n = { ...p, capExt: v };
                    const c = parseFloat(v) || 0, i = parseFloat(p.intExt) || 0;
                    if (c > 0 && i > 0) n.pg = String(Math.round(c + i));
                    return n;
                  })} type="number" placeholder="0" />
                  <In l="Intereses del mes" value={form.intExt || ""} onChange={(v) => setForm((p) => {
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
                    <div style={{ marginTop: 10, fontSize: 11, color: T.txt2 }}>
                      Cuota = {fmt(c)} + {fmt(i)} = <strong style={{ color: "#fafafa" }}>{fmt(c + i)}/mes</strong>
                      {previo > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10.5, color: dif == null ? T.txt3 : dif <= 1.5 ? "#4ade80" : "#fca5a5" }}>
                          {dif == null
                            ? <>Tasa implícita de este extracto: <strong>{eaImp.toFixed(2)}% E.A.</strong> — podés usarla arriba.</>
                            : dif <= 1.5
                              ? <>✅ Cuadra: el interés cobrado equivale a {eaImp.toFixed(2)}% E.A., consistente con el {tsForm}% que pusiste.</>
                              : <>⚠️ No cuadra: el interés cobrado equivale a <strong>{eaImp.toFixed(2)}% E.A.</strong>, pero arriba pusiste {tsForm}%. Revisá la tasa o el saldo.</>}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* Vigencia de la deuda (20-jul-2026): "¿se paga todo el año o
                  hasta X mes?" — reusa el selector de Ingresos/Gastos. */}
              <div style={{ gridColumn: "1/-1" }}>
                <FrecuenciaSelector
                  frecuencia={form.frecuencia || "mensual"}
                  mesPago={1}
                  desdeMes={Number(form.desdeMes) || 1}
                  hastaMes={Number(form.hastaMes) || 12}
                  vigenciaModo={form.vigenciaModo}
                  monto={parseFloat(form.pg) || 0}
                  montosMensuales={form.montosMensuales}
                  onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
                  tokens={{ gn: "#22c55e", rd: "#ef4444", txt: "#fafafa", txt2: "#d4d4d8", txt3: "#71717a", bg3: "#27272a", border: "rgba(255,255,255,0.08)" }}
                  mostrarChipsFrecuencia={true}
                  mostrarSelectorMes={false}
                  mostrarVigencia={true}
                />
              </div>
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
                    tokens={{ gn: "#22c55e", rd: "#ef4444", txt: "#fafafa", txt2: "#d4d4d8", txt3: "#71717a", bg3: "#27272a", border: "#3f3f46" }}
                    desdeMes={Number(form.desdeMes) || 1}
                    hastaMes={Number(form.hastaMes) || 12}
                  />
                </div>
              )}
              {form.mt&&form.pg&&form.ts&&(()=>{
                const cc=costoCredito({mt:+form.mt||0,pg:+form.pg||0,ts:+form.ts||0});
                if(cc.noAmortiza) return (
                  <div style={{gridColumn:"1/-1",fontSize:11,color:"#fca5a5",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"8px 12px"}}>
                    ⚠️ La cuota no alcanza a cubrir el interés mensual (~{fmt(Math.round((+form.mt||0)*(Math.pow(1+(+form.ts||0)/100,1/12)-1)))}). A este ritmo la deuda no baja. Revisá la cuota o la tasa.
                  </div>
                );
                return (
                  <div style={{gridColumn:"1/-1",fontSize:11,color:"#a1a1aa",background:"#1e1e24",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",gap:"4px 14px",marginBottom:8}}>
                      <span style={{color:"#fafafa",fontWeight:700,fontSize:12}}>Cuota mes {fmt(+form.pg||0)}</span>
                      <span>Interés <strong style={{color:"#f59e0b"}}>{fmt(Math.round(cc.interesMes))}</strong></span>
                      <span>Capital <strong style={{color:"#22c55e"}}>{fmt(Math.round(cc.capitalMes))}</strong></span>
                    </div>
                    <div style={{display:"flex",height:8,borderRadius:99,overflow:"hidden",background:"#0f0f13",marginBottom:6}}>
                      <div style={{width:(100-cc.pctCapital)+"%",background:"#f59e0b"}} title="Intereses" />
                      <div style={{width:cc.pctCapital+"%",background:"#22c55e"}} title="Abono a capital" />
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#71717a",marginBottom:8}}>
                      <span>🔶 Interés {Math.round(100-cc.pctCapital)}% — se lo queda el banco</span>
                      <span style={{color:"#4ade80"}}>🟩 Capital {Math.round(cc.pctCapital)}% — baja tu deuda</span>
                    </div>
                    <div style={{borderTop:"1px solid #2a2a32",paddingTop:6}}>
                      Se paga en <strong style={{color:"#fafafa"}}>{cc.meses!=null?Math.floor(cc.meses/12)+"a "+cc.meses%12+"m":"—"}</strong> · interés <strong style={{color:"#f59e0b"}}>{fmt(Math.round(cc.interesAnual))}/año</strong>
                      {cc.interesTotal>0&&<> · interés total restante <strong style={{color:"#f59e0b"}}>{fmt(Math.round(cc.interesTotal))}</strong></>}
                    </div>
                  </div>
                );
              })()}
              <In l="Propietario fiscal" value={form.owner} onChange={(v) => {
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
              }} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} />
              {form.owner && form.owner !== "na" && (() => {
                const ow = (owners || []).find(o => o.id === form.owner) || { type: "natural" };
                const isJ = ow.type === "juridica";
                const options = isJ
                  ? [
                      { v: "DEU_JUR_PRODUCTIVA", l: "Productiva — para actividad generadora de renta (intereses deducibles, Art. 117)" },
                      { v: "DEU_JUR_NO_PRODUCTIVA", l: "No productiva — sin relación con la actividad (intereses NO deducibles)" },
                    ]
                  : [
                      { v: "DEU_NAT_VIVIENDA_HABITACIONAL", l: "Vivienda habitacional — donde vivo (Art. 119, intereses hasta 1.200 UVT)" },
                      { v: "DEU_NAT_INVERSION", l: "Inversión — inmueble arrendado, negocio (intereses deducibles renta no laboral)" },
                      { v: "DEU_NAT_CONSUMO", l: "Consumo personal — tarjeta, libre inversión (intereses NO deducibles)" },
                    ];
                return (
                  <div style={{ gridColumn: "1/-1", background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", marginBottom: 8 }}>🧾 ¿Para qué usaste esta deuda? (define deducibilidad de los intereses)</div>
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
                      const alertColor = todasOk ? "#22c55e" : "#ef4444";
                      const alertBg = todasOk ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)";
                      const alertBorder = todasOk ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.30)";
                      return (
                        <div style={{ marginTop: 12, padding: "12px 14px", background: alertBg, border: `1.5px solid ${alertBorder}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: alertColor, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            🛡️ Confirmá los 3 requisitos del Art. 119 ET
                          </div>
                          <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.5, marginBottom: 10 }}>
                            Los intereses solo son deducibles (hasta 1.200 UVT/año) si TODAS estas condiciones se cumplen. Si alguna falla, los intereses NO son deducibles como vivienda — reclasificá según corresponda.
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 11, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.esHabitacion} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, esHabitacion: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>Es para mi vivienda DE HABITACIÓN</strong> (donde efectivamente vivo, no segunda vivienda ni inversión).</span>
                            </label>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 11, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.esTitular} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, esTitular: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>Soy titular del crédito</strong> (figuro como deudor en la escritura/pagaré). Si la deuda es solo de mi pareja sin que yo figure, no aplica.</span>
                            </label>
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 11, color: T.txt2 }}>
                              <input type="checkbox" checked={viviendaConfirmaciones.noArrendado} onChange={(e) => setViviendaConfirmaciones(p => ({ ...p, noArrendado: e.target.checked }))} style={{ marginTop: 2, flexShrink: 0 }} />
                              <span><strong>El inmueble NO está arrendado</strong> a terceros (si recibo arriendo de él, es renta de capital, no vivienda).</span>
                            </label>
                          </div>
                          {!todasOk && (
                            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>⚠️ El Art. 119 ET NO aplica</div>
                              <div style={{ fontSize: 10, color: T.txt2, lineHeight: 1.5, marginBottom: 8 }}>
                                Sin las 3 condiciones, los intereses no son deducibles como vivienda. Reclasificá:
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" onClick={() => { setForm(p => ({ ...p, fiscalCode: "DEU_NAT_INVERSION" })); setViviendaConfirmaciones({ esHabitacion: true, esTitular: true, noArrendado: true }); }}
                                  style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7", padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                  → Reclasificar como Inversión
                                </button>
                                <button type="button" onClick={() => { setForm(p => ({ ...p, fiscalCode: "DEU_NAT_CONSUMO" })); setViviendaConfirmaciones({ esHabitacion: true, esTitular: true, noArrendado: true }); }}
                                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#6366f1", padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                  → Reclasificar como Consumo
                                </button>
                              </div>
                            </div>
                          )}
                          {todasOk && (
                            <div style={{ marginTop: 10, fontSize: 10, color: "#22c55e", fontStyle: "italic", lineHeight: 1.4 }}>
                              ✅ Cumplís el Art. 119 ET. Los intereses serán deducibles hasta 1.200 UVT/año.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              <In l="Activo Vinculado" value={form.la} onChange={(v) => setForm((p) => ({ ...p, la: v }))} options={[{ v: "", l: "Ninguno" }, ...(inversiones || []).filter(i => i).map((i) => ({ v: i.id || "", l: i.n || i.nombre || i.name || "Sin nombre" }))]} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
