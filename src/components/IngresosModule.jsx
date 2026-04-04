import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316",
  ch: ["#22c55e", "#3b82f6", "#f97316", "#a78bfa", "#ec4899", "#22d3ee", "#eab308"],
};
const _fm = (n) => "$" + Math.round(n||0).toLocaleString("en-US");
const CATS = ["Salario", "Arriendo", "Rendimiento", "Dividendos", "Freelance", "Negocio", "Pensión", "Comisiones", "Otro"];

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />}
    </div>
  );

export default function IngresosModule({ ingresos, onUpdate, trm, fmt}) {
  const fm = fmt || _fm;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", capital: "", tasa: "", moneda: "COP" });
  const [selected, setSelected] = useState(new Set());

  const items = ingresos || [];
  
  const allItems = items;

  const totalMes = allItems.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const fijos = allItems.filter((i) => i.tipo === "fijo").reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0);
  const variables = totalMes - fijos;
  const byCat = {};
  allItems.forEach((i) => { byCat[i.categoria] = (byCat[i.categoria] || 0) + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)); });
  const pieData = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const toggleSelect = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === allItems.length ? new Set() : new Set(allItems.map((i) => i.id)));
  const deleteSelected = () => {
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} ingreso(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id))); // only deletes standalone, not inv-derived
    setSelected(new Set());
  };
  const handleSave = () => {
    const item = { ...form, mensual: Number(form.mensual) || 0, capital: Number(form.capital) || 0, tasa: Number(form.tasa) || 0 };
    let updated;
    if (editId) { updated = items.map((i) => (i.id === editId ? { ...item, id: editId } : i)); }
    else { item.id = "ing_" + Date.now(); updated = [...items, item]; }
    onUpdate(updated);
    setShowForm(false); setEditId(null);
    setForm({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", capital: "", tasa: "", moneda: "COP" });
  };
  const handleEdit = (item) => {
    setForm({ nombre: item.nombre, categoria: item.categoria, mensual: item.mensual, tipo: item.tipo, fuente: item.fuente || "", capital: item.capital || "", tasa: item.tasa || "", moneda: item.moneda || "COP" });
    setEditId(item.id); setShowForm(true);
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ingresos</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>{allItems.length} fuentes de ingreso • Total: <span style={{ color: T.green, fontWeight: 700 }}>{fm(totalMes)}/mes</span></p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={() => { setEditId(null); setForm({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", capital: "", tasa: "", moneda: "COP" }); setShowForm(true); }}
            style={{ background: T.green, color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            + Agregar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[{ l: "Total Mensual", v: fm(totalMes), c: T.green }, { l: "Total Anual", v: fm(totalMes * 12), c: T.blue }, { l: "Fijos", v: fm(fijos), c: T.blue }, { l: "Variables", v: fm(variables), c: T.orange }].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: pieData.length > 1 ? "2fr 1fr" : "1fr", gap: 16 }}>
        {/* Table with checkboxes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                  <input type="checkbox" checked={allItems.length > 0 && selected.size === allItems.length} onChange={toggleAll}
                    style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                </th>
                {["Nombre", "Categoría", "Tipo", "Mensual", "Capital / Fuente", "Sim", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: h === "Mensual" ? "right" : "left", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allItems.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: T.txt3 }}>No hay ingresos. Agrega TODO lo que recibes: salario, arriendos, rendimientos de fondos, dividendos, freelance, etc.</td></tr>
                ) : allItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(item.id) ? T.greenDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                        style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.nombre}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.categoria}</span></td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: (item.tipo === "fijo" ? T.blue : T.orange) + "15", color: item.tipo === "fijo" ? T.blue : T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.tipo}</span></td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.green, fontFamily: "monospace" }}>{fm(item.moneda==="USD" ? (item.mensual||0)*(trm||4200) : (item.mensual||0))}{item.moneda==="USD" && <span style={{fontSize:9,color:T.txt3,marginLeft:4}}>USD ${Math.round(item.mensual).toLocaleString()}</span>}</td>
                    <td style={{ padding: "10px 14px", color: T.txt3, fontSize: 12 }}>{item.capital > 0 ? "$" + Math.round(item.capital).toLocaleString() + (item.tasa ? " • " + item.tasa + "%" : "") : item.fuente || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => handleEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== item.id)); }} style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie */}
        {pieData.length > 1 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 12 }}>Por Categoría</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>{pieData.map((_, i) => <Cell key={i} fill={T.ch[i % T.ch.length]} />)}</Pie><Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fafafa", fontSize: 12 }} labelStyle={{ color: "#fafafa" }} itemStyle={{ color: "#fafafa" }} formatter={(v) => fm(v)} /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
        )}
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
              <div style={{ gridColumn: "1/-1" }}><In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Rapicredit fondeo, Salario, Arriendo casa" /></div>
              <In l="Categoría" value={form.categoria} onChange={(v) => setForm((p) => ({ ...p, categoria: v }))} options={CATS} />
              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))} options={["fijo", "variable"]} />
              <In l="Moneda" value={form.moneda} onChange={(v)=>setForm(p=>({...p,moneda:v}))} options={["COP","USD"]} />

              <In l="💵 Monto mensual" value={form.mensual} onChange={(v) => {
                const nf = { mensual: v };
                const m = Number(v) || 0;
                const cap = Number(form.capital) || 0;
                const tas = Number(form.tasa) || 0;
                if (m > 0 && cap > 0) nf.tasa = String(Math.round((m * 12 / cap) * 1000) / 10);
                else if (m > 0 && tas > 0) nf.capital = String(Math.round((m * 12) / (tas / 100)));
                setForm(p => ({ ...p, ...nf }));
              }} type="number" placeholder="¿Cuánto recibes al mes?" />
              <In l="Fuente" value={form.fuente} onChange={(v) => setForm((p) => ({ ...p, fuente: v }))} placeholder="Empresa, propiedad, fondo..." />
              {["Rendimiento","Dividendos","Arriendo","Inversión"].includes(form.categoria) && (
                <div style={{gridColumn:"1/-1",background:T.bg3,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:T.txt3,marginBottom:10}}>📊 Con 2 de 3 valores se calcula el tercero automáticamente</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <In l="💼 Capital invertido" value={form.capital} onChange={(v) => {
                      const nf = { capital: v };
                      const cap = Number(v) || 0;
                      const m = Number(form.mensual) || 0;
                      const tas = Number(form.tasa) || 0;
                      if (cap > 0 && tas > 0) nf.mensual = String(Math.round((cap * tas / 100) / 12));
                      else if (cap > 0 && m > 0) nf.tasa = String(Math.round((m * 12 / cap) * 1000) / 10);
                      setForm(p => ({ ...p, ...nf }));
                    }} type="number" placeholder="Valor del activo" />
                    <In l="📈 % Rentabilidad anual" value={form.tasa} onChange={(v) => {
                      const nf = { tasa: v };
                      const tas = Number(v) || 0;
                      const cap = Number(form.capital) || 0;
                      const m = Number(form.mensual) || 0;
                      if (tas > 0 && cap > 0) nf.mensual = String(Math.round((cap * tas / 100) / 12));
                      else if (tas > 0 && m > 0) nf.capital = String(Math.round((m * 12) / (tas / 100)));
                      setForm(p => ({ ...p, ...nf }));
                    }} type="number" placeholder="Ej: 24" />
                  </div>
                  {Number(form.capital) > 0 && Number(form.tasa) > 0 && Number(form.mensual) > 0 && (
                    <div style={{marginTop:10,padding:"10px 12px",background:"rgba(34,197,94,0.06)",borderRadius:8,fontSize:12,color:T.green,lineHeight:1.6}}>
                      💰 Capital {"$" + Math.round(Number(form.capital)).toLocaleString()} × {form.tasa}% anual = {"$" + Math.round(Number(form.capital) * Number(form.tasa) / 100 / 12).toLocaleString()}/mes
                    </div>
                  )}
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
