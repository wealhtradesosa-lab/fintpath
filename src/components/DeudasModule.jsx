import { useState } from "react";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
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
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function DeudasModule({ deudas, owners, inversiones, onUpdate, fmt, onImport}) {
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
            body: JSON.stringify({ image: base64, type: "deuda", mediaType })
          });
          const data = await res.json();
          if (data.success && data.data) {
            const d = data.data;
            setForm(p => ({
              ...p,
              n: d.nombre || p.n,
              mt: d.saldo || p.mt,
              pg: d.cuota || p.pg,
              ts: d.tasa || p.ts,
              tp: d.tipo || p.tp,
            }));
            setShowForm(true);
            alert("✅ Documento leído" + (d.confianza === "alta" ? "" : " (revisa los datos)") + "\n\n" + (d.nombre || "") + ": Saldo $" + (d.saldo || 0).toLocaleString() + " — Cuota $" + (d.cuota || 0).toLocaleString());
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
  const [form, setForm] = useState({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "" });
  const [selected, setSelected] = useState(new Set());

  const items = deudas || [];
  const activos = items.filter((d) => d.sim !== false);
  const totalDeuda = activos.reduce((s, d) => s + (d.mt || 0), 0);
  const totalCuotas = activos.reduce((s, d) => s + (d.pg || 0), 0);

  const toggleSel = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const deleteSelected = () => {
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} deuda(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const handleSave = () => {
    const item = { n: form.n || "", tp: form.tp || "loan", mt: +form.mt || 0, pg: +form.pg || 0, ts: +form.ts || 0, la: form.la || null, owner: form.owner || "" };
    if (editId) {
      onUpdate(items.map((i) => (i.id === editId ? { ...i, ...item } : i)));
    } else {
      item.id = "d_" + Date.now();
      onUpdate([...items, item]);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "" });
  };

  const openEdit = (d) => {
    setForm({ n: d.n, tp: d.tp, fiscalCode: d.fiscalCode || (d.tp === "mortgage" ? "DEU_NAT_VIVIENDA_HABITACIONAL" : "DEU_NAT_CONSUMO"), mt: d.mt, pg: d.pg, ts: d.ts, la: d.la || "", owner: d.owner || "" });
    setEditId(d.id);
    setShowForm(true);
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Obligaciones Financieras</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>{activos.length}{activos.length !== items.length ? ` de ${items.length}` : ""} deuda{activos.length !== 1 ? "s" : ""}{activos.length !== items.length ? " activa" + (activos.length !== 1 ? "s" : "") : ""} • Saldo: <span style={{ color: T.red, fontWeight: 700 }}>{fm(totalDeuda)}</span> • Cuotas: {fm(totalCuotas)}/mes</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>🗑️ Eliminar ({selected.size})</button>
          )}
          <button onClick={() => { setEditId(null); setForm({ n: "", tp: "loan", fiscalCode: "DEU_NAT_CONSUMO", mt: "", pg: "", ts: "", la: "", owner: "" }); setShowForm(true); }}
            style={{ background: "#22c55e", color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Deuda Total", v: fm(totalDeuda), c: T.red },
          { l: "Cuotas/mes", v: fm(totalCuotas), c: T.orange },
          { l: "Cuotas/año", v: fm(totalCuotas * 12), c: T.purple },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

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
                {["Deuda", "Tipo", "Saldo", "Cuota", "Tasa", "Activo", "Sim", ""].map((h) => (
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
              ) : items.map((d) => {
                const lk = d.la ? (inversiones || []).find((i) => i.id === d.la) : null;
                return (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(d.id) ? T.redDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSel(d.id)}
                        style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{fontWeight: 600}}>{d.n}</div>
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
                    <td style={{ padding: "10px 14px" }}>{lk ? <span style={{ background: T.blue + "15", color: T.blue, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{lk.n || lk.nombre || lk.name || "—"}</span> : <span style={{ color: T.txt3 }}>—</span>}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => { onUpdate(deudas.map(x => x.id===d.id ? {...x, sim: !(d.sim!==false)} : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={d.sim===false?"Mostrar":"Ocultar"}>{d.sim===false?"⬜":"✅"}</button>
                      <button onClick={() => openEdit(d)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (confirm("¿Eliminar este registro?")) onUpdate(items.filter((i) => i.id !== d.id)); }}
                        style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 32 }}>
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
              <In l="Cuota/mes ($)" value={form.pg} onChange={(v) => {
                const mt=parseFloat(form.mt)||0;
                const newTs=mt>0&&v?((parseFloat(v)*12/mt)*100).toFixed(1):"";
                setForm((p) => ({ ...p, pg: v, ts: newTs }));
              }} type="number" placeholder="0" />
              <In l="Tasa anual %" value={form.ts} onChange={(v) => {
                const mt=parseFloat(form.mt)||0;
                const newPg=mt>0&&v?Math.round(mt*parseFloat(v)/100/12):"";
                setForm((p) => ({ ...p, ts: v, pg: String(newPg) }));
              }} type="number" placeholder="Ej: 12" />
              {form.mt&&form.pg&&form.ts&&<div style={{gridColumn:"1/-1",fontSize:11,color:"#a1a1aa",background:"#1e1e24",borderRadius:8,padding:"8px 12px"}}>Saldo {fmt(+form.mt||0)} al {form.ts}% anual = cuota estimada {fmt(+form.pg||0)}/mes. Ingresa uno y el otro se calcula.</div>}
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
