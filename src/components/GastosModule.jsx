import { useState } from "react";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
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
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

const DIAN_REGLAS = {
  natural: { "Salud": "✅ Deducible", "Vivienda": "✅ Deducible", "Seguros": "📊 50%", "Seguridad Social": "✅ Ya incluido", "Nómina": "❌", "Honorarios": "❌", "Mantenimiento": "❌", "Predial": "❌", "Representación": "❌", "Alimentación": "❌", "Transporte": "❌", "Arrendamiento": "❌", "Servicios": "❌", "Educación": "❌", "Entretenimiento": "❌", "Personal": "❌", "Vestimenta": "❌", "Tecnología": "❌", "Ahorro": "❌", "Otro": "❌" },
  juridica: { "Nómina": "✅ Deducible", "Honorarios": "✅ Deducible", "Vivienda": "✅ Deducible", "Servicios": "✅ Deducible", "Mantenimiento": "✅ Deducible", "Seguros": "✅ Deducible", "Transporte": "✅ Deducible", "Arrendamiento": "✅ Deducible", "Predial": "✅ Deducible", "Representación": "✅ Deducible", "Tecnología": "✅ Deducible", "Educación": "✅ Deducible", "Seguridad Social": "✅ Deducible", "Depreciación": "✅ Deducible", "Salud": "❌", "Alimentación": "❌", "Entretenimiento": "❌", "Personal": "❌", "Vestimenta": "❌", "Mascotas": "❌", "Deporte": "❌", "Ahorro": "❌", "Otro": "📊 50%" }
};

export default function GastosModule({ gastos, onUpdate, fmt, onImport, owners, plan, onUpgrade}) {
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
  const [form, setForm] = useState({ cat: "", c: "", m: "", t: "f", freq: "mes", owner: "" });
  const [selected, setSelected] = useState(new Set()); // "cat|idx"

  const gas = gastos || {};
  const cats = Object.entries(gas);
  const allItems = [];
  cats.forEach(([cat, its]) => its.forEach((g, i) => allItems.push({ ...g, cat, idx: i, key: cat + "|" + i })));
  const totalMes = allItems.reduce((s, g) => s + (g.m || 0), 0);

  const toggleSel = (key) => setSelected((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAll = () => setSelected(selected.size === allItems.length ? new Set() : new Set(allItems.map((g) => g.key)));

  const deleteSelected = () => {
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
    const newGas = { ...gas };
    if (editKey) {
      const [eCat, eIdx] = editKey.split("|");
      const idx = parseInt(eIdx);
      if (form.cat !== eCat) {
        // Category changed: remove from old, add to new
        newGas[eCat] = newGas[eCat].filter((_, i) => i !== idx);
        if (newGas[eCat].length === 0) delete newGas[eCat];
        if (!newGas[form.cat]) newGas[form.cat] = [];
        newGas[form.cat].push({ c: form.c || "", m: form.freq==="año"?Math.round((+form.m||0)/12):(+form.m||0), t: form.t || "f", freq: form.freq||"mes", owner: form.owner||"" });
      } else {
        newGas[eCat][idx] = { c: form.c || "", m: form.freq==="año"?Math.round((+form.m||0)/12):(+form.m||0), t: form.t || "f", freq: form.freq||"mes", owner: form.owner||"" };
      }
    } else {
      const cat = form.cat || "Otro";
      if (!newGas[cat]) newGas[cat] = [];
      newGas[cat].push({ c: form.c || "", m: form.freq==="año"?Math.round((+form.m||0)/12):(+form.m||0), t: form.t || "f", freq: form.freq||"mes", owner: form.owner||"" });
    }
    onUpdate(newGas);
    setShowForm(false);
    setEditKey(null);
    setForm({ cat: "", c: "", m: "", t: "f", freq: "mes", owner: "" });
  };

  const openEdit = (item) => {
    setForm({ cat: item.cat, c: item.c, m: item.freq==="año"?(item.m*12):item.m, t: item.t, freq: item.freq||"mes", owner: item.owner||"" });
    setEditKey(item.key);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ cat: "", c: "", m: "", t: "f", freq: "mes" });
    setEditKey(null);
    setShowForm(true);
  };

  const delCat = (cat) => {
    if (!confirm("¿Eliminar categoría " + cat + "?")) return;
    const newGas = { ...gas };
    delete newGas[cat];
    onUpdate(newGas);
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Gastos Familiares</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>
            {allItems.length} gastos en {cats.length} categorías • Total: <span style={{ color: T.red, fontWeight: 700 }}>{fm(totalMes)}/mes</span> • {fm(totalMes * 12)}/año
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={openAdd} style={{ background: "#22c55e", color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Total Mensual", v: fm(totalMes), c: T.red },
          { l: "Total Anual", v: fm(totalMes * 12), c: T.orange },
          { l: "Fijos", v: fm(allItems.filter((g) => g.t === "f").reduce((s, g) => s + g.m, 0)), c: T.blue },
          { l: "Variables", v: fm(allItems.filter((g) => g.t !== "f").reduce((s, g) => s + g.m, 0)), c: T.orange },
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
              {["Concepto", "Categoría", "DIAN", "Monto/mes", "Sim", ""].map((h) => (
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
                  <div style={{fontWeight: 600}}>{item.c || "—"}</div>
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
                    const ow = (owners||[]).find(o=>o.id===item.owner);
                    const tipo = ow?.type === "juridica" ? "juridica" : "natural";
                    const regla = DIAN_REGLAS[tipo]?.[item.cat] || "❌";
                    const color = regla.includes("✅") ? "#22c55e" : regla.includes("📊") ? "#eab308" : "#71717a";
                    return <span style={{color,fontWeight:600}}>{regla}</span>;
                  })()}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: (item.t === "f" ? T.blue : T.orange) + "15", color: item.t === "f" ? T.blue : T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.t === "f" ? "fijo" : "variable"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.red, fontFamily: "monospace" }}>{fm(item.m)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <button onClick={() => { const upd = {...gastos}; upd[item.cat] = upd[item.cat].map((g,i) => i===item.idx ? {...g, sim: !(item.sim!==false)} : g); onUpdate(upd); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }} title={item.sim===false?"Mostrar":"Ocultar"}>{item.sim===false?"⬜":"✅"}</button>
                  <button onClick={() => openEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                  <button onClick={() => { const g = { ...gas }; g[item.cat] = g[item.cat].filter((_, i) => i !== item.idx); if (g[item.cat].length === 0) delete g[item.cat]; onUpdate(g); }}
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 32 }}>
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
              <In l="Categoría" value={form.cat} onChange={(v) => setForm((p) => ({ ...p, cat: v }))} options={[{v:"Nómina",l:"👥 Nómina y empleados"},{v:"Honorarios",l:"📋 Honorarios profesionales (contador, abogado)"},{v:"Vivienda",l:"🏠 Vivienda / Arriendo oficina"},{v:"Servicios",l:"💡 Servicios (luz, agua, internet, gas)"},{v:"Mantenimiento",l:"🔧 Mantenimiento y reparaciones"},{v:"Seguros",l:"🛡️ Seguros y pólizas"},{v:"Transporte",l:"🚗 Transporte y combustible"},{v:"Arrendamiento",l:"📄 Arrendamiento operativo (renting, leasing)"},{v:"Predial",l:"🏛️ Predial e impuestos locales (ICA)"},{v:"Representación",l:"🤝 Gastos de representación"},{v:"Tecnología",l:"💻 Tecnología y software"},{v:"Depreciación",l:"🏗️ Depreciación (Art. 128-141 ET, solo jurídica)"},{v:"Alimentación",l:"🛒 Alimentación y mercado"},{v:"Educación",l:"📚 Educación y capacitación"},{v:"Salud",l:"🏥 Salud / Medicina prepagada"},{v:"Seguridad Social",l:"🏛️ Seguridad social (pensión, EPS, ARL) — se deduce automáticamente"},{v:"Entretenimiento",l:"🎬 Entretenimiento y ocio"},{v:"Vestimenta",l:"👔 Vestimenta"},{v:"Mascotas",l:"🐾 Mascotas"},{v:"Deporte",l:"⚽ Deporte y bienestar"},{v:"Personal",l:"👤 Gastos personales"},{v:"Ahorro",l:"💰 Ahorro e inversión"},{v:"Otro",l:"📝 Otro"}]} />
              <In l="Concepto" value={form.c} onChange={(v) => setForm((p) => ({ ...p, c: v }))} placeholder="Arriendo" />
              <div style={{display:"flex",gap:8}}><div style={{flex:1}}><In l="Monto" value={form.m} onChange={(v) => setForm((p) => ({ ...p, m: v }))} type="number" placeholder="0" /></div><div style={{flex:1}}>
              <In l="Frecuencia" value={form.freq} onChange={(v) => setForm((p) => ({ ...p, freq: v }))} options={[{ v: "mes", l: "Mensual" }, { v: "año", l: "Anual" }]} /></div></div>
              <In l="Propietario fiscal (opcional)" value={form.owner} onChange={(v) => setForm((p) => ({ ...p, owner: v }))} options={[{v:"",l:"— Sin asignar (no calcula impuesto)"},{v:"own_1",l:"👤 Personal"},{v:"na",l:"🌐 N/A — No aplica (exterior)"},...(owners||[]).filter(o=>o.id!=="own_1").map(o=>({v:o.id,l:(o.type==="juridica"?"🏢 ":"👤 ")+o.name}))]} />
              <div style={{fontSize:10,color:"#71717a",marginTop:-8,marginBottom:8,padding:"0 4px"}}>Si asignas propietario, se incluirá en el cálculo de impuestos. Si no, se omite.</div>
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
