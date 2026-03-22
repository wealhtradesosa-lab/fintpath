import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const T = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  blue: "#3b82f6", orange: "#f97316", purple: "#a78bfa",
  ch: ["#22c55e", "#3b82f6", "#f97316", "#a78bfa", "#ec4899", "#22d3ee", "#eab308"],
};
const fm = (n) => "$" + Math.round(n).toLocaleString("en-US");
const TT = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 12 };

const CATEGORIAS = ["Salario", "Freelance", "Arriendo", "Inversión", "Negocio", "Dividendos", "Pensión", "Otro"];

export default function IngresosModule({ ingresos, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", notas: "" });

  const items = ingresos || [];
  const totalMes = items.reduce((s, i) => s + (i.mensual || 0), 0);
  const totalAnual = totalMes * 12;

  // By category for pie
  const byCat = {};
  items.forEach((i) => { byCat[i.categoria] = (byCat[i.categoria] || 0) + i.mensual; });
  const pieData = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const fijos = items.filter((i) => i.tipo === "fijo").reduce((s, i) => s + i.mensual, 0);
  const variables = items.filter((i) => i.tipo !== "fijo").reduce((s, i) => s + i.mensual, 0);

  const handleSave = () => {
    const item = { ...form, mensual: Number(form.mensual) || 0 };
    let updated;
    if (editId) {
      updated = items.map((i) => (i.id === editId ? { ...item, id: editId } : i));
    } else {
      item.id = "ing_" + Date.now();
      updated = [...items, item];
    }
    onUpdate(updated);
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", notas: "" });
  };

  const handleEdit = (item) => {
    setForm({ nombre: item.nombre, categoria: item.categoria, mensual: item.mensual, tipo: item.tipo, fuente: item.fuente || "", notas: item.notas || "" });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("¿Eliminar este ingreso?")) onUpdate(items.filter((i) => i.id !== id));
  };

  const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ingresos</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>
            {items.length} fuentes • Total: <span style={{ color: T.green, fontWeight: 700 }}>{fm(totalMes)}/mes</span> • {fm(totalAnual)}/año
          </p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ nombre: "", categoria: "Salario", mensual: "", tipo: "fijo", fuente: "", notas: "" }); setShowForm(true); }}
          style={{ background: T.green, color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          + Agregar Ingreso
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Total Mensual", v: fm(totalMes), c: T.green, icon: "💰" },
          { l: "Total Anual", v: fm(totalAnual), c: T.blue, icon: "📅" },
          { l: "Fijos", v: fm(fijos), sub: items.filter((i) => i.tipo === "fijo").length + " fuentes", c: T.blue, icon: "🔒" },
          { l: "Variables", v: fm(variables), sub: items.filter((i) => i.tipo !== "fijo").length + " fuentes", c: T.orange, icon: "📊" },
        ].map((m) => (
          <div key={m.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>{m.l}</span>
              <span style={{ fontSize: 14 }}>{m.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c }}>{m.v}</div>
            {m.sub && <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: items.length > 0 && pieData.length > 1 ? "2fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
        {/* Table */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Nombre", "Categoría", "Tipo", "Mensual", "Anual", "Fuente", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: h === "Nombre" || h === "Fuente" || h === "" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: T.txt3 }}>No hay ingresos registrados. Agrega tu primer ingreso.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.nombre}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <span style={{ background: T.green + "15", color: T.green, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.categoria}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <span style={{ background: (item.tipo === "fijo" ? T.blue : T.orange) + "15", color: item.tipo === "fijo" ? T.blue : T.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.tipo}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: T.green, fontFamily: "monospace" }}>{fm(item.mensual)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: T.txt2, fontFamily: "monospace" }}>{fm(item.mensual * 12)}</td>
                    <td style={{ padding: "12px 16px", color: T.txt3 }}>{item.fuente || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => handleEdit(item)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11 }}>✏️</button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: "rgba(239,68,68,0.08)", border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.green === "#22c55e" ? "#ef4444" : T.txt3, fontSize: 11 }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie Chart */}
        {pieData.length > 1 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 12 }}>Por Categoría</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={T.ch[i % T.ch.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => fm(v)} />
                <Legend />
              </PieChart>
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
              <div style={{ gridColumn: "1/-1" }}><In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Salario mensual" /></div>
              <In l="Categoría" value={form.categoria} onChange={(v) => setForm((p) => ({ ...p, categoria: v }))} options={CATEGORIAS} />
              <In l="Monto Mensual (USD)" value={form.mensual} onChange={(v) => setForm((p) => ({ ...p, mensual: v }))} type="number" placeholder="0" />
              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))} options={["fijo", "variable"]} />
              <In l="Fuente" value={form.fuente} onChange={(v) => setForm((p) => ({ ...p, fuente: v }))} placeholder="Ej: Empresa ABC" />
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
