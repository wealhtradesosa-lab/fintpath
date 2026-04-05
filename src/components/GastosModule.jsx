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

export default function GastosModule({ gastos, onUpdate, fmt}) {
  const fm = fmt || _fm;
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "12px", width: 40, borderBottom: `1px solid ${T.border}` }}>
                <input type="checkbox" checked={allItems.length > 0 && selected.size === allItems.length} onChange={toggleAll}
                  style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
              </th>
              {["Concepto", "Categoría", "Tipo", "Monto/mes", "Sim", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: h === "Monto/mes" ? "right" : "left", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allItems.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: "center", color: T.txt3 }}>💳 Aquí van tus gastos fijos y variables del mes: vivienda, alimentación, transporte, educación, seguros, entretenimiento. Haz click en <strong>+ Agregar</strong> arriba o importa un Excel con tus gastos detallados usando el botón <strong>🧠 Importar Excel</strong> en la barra superior. Solo gastos — no incluyas cuotas de créditos ni deudas.</td></tr>
            ) : allItems.map((item) => (
              <tr key={item.key} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(item.key) ? T.redDim : "transparent" }}>
                <td style={{ padding: "10px 12px" }}>
                  <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSel(item.key)}
                    style={{ accentColor: "#22c55e", cursor: "pointer", width: 16, height: 16 }} />
                </td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.c || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: T.redDim, color: T.red, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99 }}>{item.cat}</span>
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
        </table>
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
              <In l="Categoría" value={form.cat} onChange={(v) => setForm((p) => ({ ...p, cat: v }))} placeholder="Vivienda" />
              <In l="Concepto" value={form.c} onChange={(v) => setForm((p) => ({ ...p, c: v }))} placeholder="Arriendo" />
              <In l="Monto Mensual" value={form.m} onChange={(v) => setForm((p) => ({ ...p, m: v }))} type="number" placeholder="0" />
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
