import { useState } from "react";

const it = {
  bg2: "#18181b", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", orange: "#f97316",
};
const fm = (n) => "$" + Math.round(n).toLocaleString("en-US");

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: it.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: it.bg3, border: `1px solid ${it.border}`, borderRadius: 8, padding: "10px 12px", color: it.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}</select>
        : <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: it.bg3, border: `1px solid ${it.border}`, borderRadius: 8, padding: "10px 12px", color: it.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function GastosModule({ gastos, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState(null); // "cat|idx"
  const [form, setForm] = useState({ cat: "", c: "", m: "", t: "f" });
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
        newGas[form.cat].push({ c: form.c || "", m: +form.m || 0, t: form.t || "f" });
      } else {
        newGas[eCat][idx] = { c: form.c || "", m: +form.m || 0, t: form.t || "f" };
      }
    } else {
      const cat = form.cat || "Otro";
      if (!newGas[cat]) newGas[cat] = [];
      newGas[cat].push({ c: form.c || "", m: +form.m || 0, t: form.t || "f" });
    }
    onUpdate(newGas);
    setShowForm(false);
    setEditKey(null);
    setForm({ cat: "", c: "", m: "", t: "f" });
  };

  const openEdit = (item) => {
    setForm({ cat: item.cat, c: item.c, m: item.m, t: item.t });
    setEditKey(item.key);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ cat: "", c: "", m: "", t: "f" });
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
          <p style={{ color: it.txt3, fontSize: 13, margin: "3px 0 0" }}>
            {allItems.length} gastos en {cats.length} categorías • Total: <span style={{ color: it.red, fontWeight: 700 }}>{fm(totalMes)}/mes</span> • {fm(totalMes * 12)}/año
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: it.redDim, border: `1px solid ${it.red}30`, color: it.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={openAdd} style={{ background: "#22c55e", color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Total Mensual", v: fm(totalMes), c: it.red },
          { l: "Total Anual", v: fm(totalMes * 12), c: it.orange },
          { l: "Fijos", v: fm(allItems.filter((g) => g.t === "f").reduce((s, g) => s + g.m, 0)), c: it.blue },
          { l: "Variables", v: fm(allItems.filter((g) => g.t !== "f").reduce((s, g) => s + g.m, 0)), c: it.orange },
        ].map((m) => (
          <div key={m.l} style={{ background: it.card, border: `1px solid ${it.border}`, borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: it.txt3, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Table with checkboxes */}
      <div style={{ background: it.card, border: `1px solid ${it.border}`, borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${it.border}` }}>
                <input type="checkbox" checked={allItems.length > 0 && selected.size === allItems.length} onChange={toggleAll}
                  style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
              </th>
              {["Concepto", "Categoría", "Tipo", "Monto/mes", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: h === "Monto/mes" ? "right" : "left", color: it.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${it.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: it.txt3 }}>No hay gastos. Agrega o importa desde Excel.</td></tr>
            ) : allItems.map((item) => (
              <tr key={item.key} style={{ borderBottom: `1px solid ${it.border}`, background: selected.has(item.key) ? it.redDim : "transparent" }}>
                <td style={{ padding: "10px 12px" }}>
                  <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSel(item.key)}
                    style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                </td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.c || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: it.redDim, color: it.red, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.cat}</span>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: (item.t === "f" ? it.blue : it.orange) + "15", color: item.t === "f" ? it.blue : it.orange, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.t === "f" ? "fijo" : "variable"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: it.red, fontFamily: "monospace" }}>{fm(item.m)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <button onClick={() => openEdit(item)} style={{ background: it.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: it.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                  <button onClick={() => { const g = { ...gas }; g[item.cat] = g[item.cat].filter((_, i) => i !== item.idx); if (g[item.cat].length === 0) delete g[item.cat]; onUpdate(g); }}
                    style={{ background: it.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: it.red, fontSize: 11 }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: it.bg2, border: `1px solid ${it.border}`, borderRadius: 20, width: "100%", maxWidth: 520, padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editKey ? "Editar Gasto" : "Agregar Gasto"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: it.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <In l="Categoría" value={form.cat} onChange={(v) => setForm((p) => ({ ...p, cat: v }))} placeholder="Vivienda" />
              <In l="Concepto" value={form.c} onChange={(v) => setForm((p) => ({ ...p, c: v }))} placeholder="Arriendo" />
              <In l="Monto Mensual" value={form.m} onChange={(v) => setForm((p) => ({ ...p, m: v }))} type="number" placeholder="0" />
              <In l="Tipo" value={form.t} onChange={(v) => setForm((p) => ({ ...p, t: v }))} options={[{ v: "f", l: "Fijo" }, { v: "v", l: "Variable" }]} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${it.border}`, color: it.txt2, padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editKey ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
