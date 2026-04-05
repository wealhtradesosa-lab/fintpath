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

export default function DeudasModule({ deudas, inversiones, onUpdate, fmt, onImport}) {
  const fm = fmt || _fm;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ n: "", tp: "loan", mt: "", pg: "", ts: "", la: "" });
  const [selected, setSelected] = useState(new Set());

  const items = deudas || [];
  const totalDeuda = items.reduce((s, d) => s + (d.mt || 0), 0);
  const totalCuotas = items.reduce((s, d) => s + (d.pg || 0), 0);

  const toggleSel = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const deleteSelected = () => {
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} deuda(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const handleSave = () => {
    const item = { n: form.n || "", tp: form.tp || "loan", mt: +form.mt || 0, pg: +form.pg || 0, ts: +form.ts || 0, la: form.la || null };
    if (editId) {
      onUpdate(items.map((i) => (i.id === editId ? { ...i, ...item } : i)));
    } else {
      item.id = "d_" + Date.now();
      onUpdate([...items, item]);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ n: "", tp: "loan", mt: "", pg: "", ts: "", la: "" });
  };

  const openEdit = (d) => {
    setForm({ n: d.n, tp: d.tp, mt: d.mt, pg: d.pg, ts: d.ts, la: d.la || "" });
    setEditId(d.id);
    setShowForm(true);
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Obligaciones Financieras</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>{items.length} deudas • Saldo: <span style={{ color: T.red, fontWeight: 700 }}>{fm(totalDeuda)}</span> • Cuotas: {fm(totalCuotas)}/mes</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>🗑️ Eliminar ({selected.size})</button>
          )}
          <button onClick={() => { setEditId(null); setForm({ n: "", tp: "loan", mt: "", pg: "", ts: "", la: "" }); setShowForm(true); }}
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
                        {onImport&&<button onClick={onImport} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.2)",padding:"12px 24px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>📥 Importar Excel</button>}
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
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.n}</td>
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
                      <button onClick={() => { if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== d.id)); }}
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
              <In l="Nombre" value={form.n} onChange={(v) => setForm((p) => ({ ...p, n: v }))} placeholder="Hipoteca casa" />
              <In l="Tipo" value={form.tp} onChange={(v) => setForm((p) => ({ ...p, tp: v }))} options={[{ v: "mortgage", l: "Hipoteca" }, { v: "loan", l: "Préstamo" }, { v: "personal", l: "Personal" }, { v: "credit_card", l: "Tarjeta" }]} />
              <In l="Saldo" value={form.mt} onChange={(v) => setForm((p) => ({ ...p, mt: v }))} type="number" placeholder="0" />
              <In l="Cuota/mes" value={form.pg} onChange={(v) => setForm((p) => ({ ...p, pg: v }))} type="number" placeholder="0" />
              <In l="Tasa %" value={form.ts} onChange={(v) => setForm((p) => ({ ...p, ts: v }))} type="number" placeholder="0" />
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
