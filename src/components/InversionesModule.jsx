import { useState, useMemo } from "react";

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

// Get name from item (handles multiple field formats)
const getName = (i) => i.n || i.nombre || i.name || "Sin nombre";
const getLoc = (i) => i.ub || i.ubicacion || i.location || "";
const getType = (i) => i.tp || i.tipo || i.type || "Other";
const getVA = (i) => Number(i.va || i.valor_actual || i.valor || 0);
const getVC = (i) => Number(i.vc || i.valor_compra || i.costo || 0);

function calcMetrics(inv, deudas) {
  let ig = 0, gs = 0;
  if (inv.unidades || inv.un) {
    (inv.unidades || inv.un || []).forEach((u) => {
      (u.ingresos || u.ig || []).forEach((i) => { ig += i.m || 0; });
      (u.gastos || u.gs || []).forEach((g) => { gs += g.m || 0; });
    });
  } else {
    (inv.ingresos || inv.ig || []).forEach((i) => { ig += i.m || 0; });
    (inv.gastos || inv.gs || []).forEach((g) => { gs += g.m || 0; });
  }
  const va = getVA(inv), vc = getVC(inv);
  const noi = ig - gs;
  const linkedDebt = (deudas || []).filter((d) => (d.la || d.link) === inv.id);
  const debtTotal = linkedDebt.reduce((s, d) => s + (d.mt || d.monto || 0), 0);
  const debtPayment = linkedDebt.reduce((s, d) => s + (d.pg || d.pago || 0), 0);
  const equity = va - debtTotal;
  const roi = vc > 0 ? ((va - vc) / vc) * 100 : 0;
  const cap = va > 0 ? ((noi * 12) / va) * 100 : 0;
  const coc = equity > 0 ? (((noi - debtPayment) * 12) / equity) * 100 : 0;
  return { ig, gs, noi, roi, cap, coc, debtTotal, debtPayment, equity };
}

const In = ({ l, value, onChange, type, placeholder, options }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{l}</label>
      {options
        ? <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}>{options.map((o) => <option key={o.v!=null?o.v:o} value={o.v!=null?o.v:o}>{o.l!=null?o.l:o}</option>)}</select>
        : <input type={type || "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }} />
      }
    </div>
  );

export default function InversionesModule({ inversiones, deudas, onUpdate, fmt}) {
  const fm = fmt || _fm;
  // V4.9 - edit fix
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", ubicacion: "", tipo: "Real Estate", va: "", vc: "", tasa: "" });
  const [selected, setSelected] = useState(new Set());

  const items = inversiones || [];
  const totalValor = items.reduce((s, i) => s + getVA(i), 0);
  const totalIncome = items.reduce((s, i) => {
    const m = calcMetrics(i, deudas);
    return s + m.ig;
  }, 0);

  const toggleSel = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const deleteSelected = () => {
    if (!selected.size || !confirm(`¿Eliminar ${selected.size} activo(s)?`)) return;
    onUpdate(items.filter((i) => !selected.has(i.id)));
    setSelected(new Set());
  };

  const openEdit = (inv) => {
    setForm({
      nombre: String(getName(inv) || ""),
      ubicacion: String(getLoc(inv) || ""),
      tipo: String(getType(inv) || "Real Estate"),
      va: String(getVA(inv) || ""),
      vc: String(getVC(inv) || ""),
      tasa: String(inv.tasa || ""),
    });
    setEditId(inv.id);
    setShowForm(true);
  };

  const openAdd = () => {
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", va: "", vc: "", tasa: "" });
    setEditId(null);
    setShowForm(true);
  };

  const handleSave = () => {
    const va = Math.abs(parseFloat(form.va)) || 0;
    const tasa = parseFloat(form.tasa) || 0;
    const ingresoCalc = tasa > 0 ? Math.round((va * tasa / 100) / 12) : 0;
    const updated = {
      n: String(form.nombre || "").trim(),
      nombre: String(form.nombre || "").trim(),
      name: String(form.nombre || "").trim(),
      ub: String(form.ubicacion || "").trim(),
      ubicacion: String(form.ubicacion || "").trim(),
      tp: form.tipo || "Other",
      tipo: form.tipo || "Other",
      va,
      vc: Math.abs(parseFloat(form.vc)) || 0,
      tasa,
    };
    // tasa is stored for display only - actual income goes in Ingresos module
    if (editId) {
      onUpdate(items.map((i) => {
        if (i.id !== editId) return i;
        return { ...i, ...updated };
      }));
    } else {
      updated.id = "i_" + Date.now();
      updated.ig = [];
      updated.gs = [];
      onUpdate([...items, updated]);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: "", ubicacion: "", tipo: "Real Estate", va: "", vc: "", tasa: "" });
  };

  

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Portfolio de Inversiones</h2>
          <p style={{ color: T.txt3, fontSize: 13, margin: "3px 0 0" }}>
            {items.length} activos • Valor total: <span style={{ color: T.green, fontWeight: 700 }}>{fm(totalValor)}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button onClick={deleteSelected} style={{ background: T.redDim, border: `1px solid ${T.red}30`, color: T.red, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              🗑️ Eliminar ({selected.size})
            </button>
          )}
          <button onClick={openAdd} style={{ background: T.green, color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Agregar</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Patrimonio Total", v: fm(totalValor), c: T.green },
          { l: "Renta Mensual", v: fm(totalIncome) + "/mes", c: T.blue },
          { l: "Activos", v: items.length, c: T.txt },
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
                    style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                </th>
                {["Inversión", "Valor", "ROI", "NOI/mes", "Deuda", "Cap", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: h === "Inversión" || h === "" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: "center", color: T.txt3 }}>No hay activos. Agrega propiedades, fondos, acciones, crypto, etc.</td></tr>
              ) : items.map((inv) => {
                const m = calcMetrics(inv, deudas);
                const name = getName(inv);
                const loc = getLoc(inv);
                const tipo = getType(inv);
                const va = getVA(inv);
                return (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(inv.id) ? T.greenDim : "transparent" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSel(inv.id)}
                        style={{ accentColor: T.green, cursor: "pointer", width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 11, color: T.txt3 }}>{[loc, tipo, inv.tasa ? inv.tasa + "% anual" : ""].filter(Boolean).join(" • ")}</div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>{fm(va)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: m.roi >= 0 ? T.green : T.red }}>{pc(m.roi)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", color: m.noi >= 0 ? T.green : T.red }}>{fm(m.noi)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", color: m.debtTotal > 0 ? T.red : T.txt3 }}>{fm(m.debtTotal)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", color: T.blue }}>{pc(m.cap)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => openEdit(inv)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11, marginRight: 4 }}>✏️</button>
                      <button onClick={() => { if (confirm("¿Eliminar?")) onUpdate(items.filter((i) => i.id !== inv.id)); }}
                        style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 560, padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Activo" : "Agregar Activo"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <In l="Nombre" value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} placeholder="Ej: Apartamento, Fondo, Acciones, Terreno" />
              </div>
              <In l="Ubicación" value={form.ubicacion} onChange={(v) => setForm((p) => ({ ...p, ubicacion: v }))} placeholder="Miami, FL" />
              <In l="Tipo" value={form.tipo} onChange={(v) => setForm((p) => ({ ...p, tipo: v }))} options={["Real Estate", "Fondo de Inversión", "CDT", "Acciones", "Crypto", "Bodega", "Lote", "Vehículo", "Local Comercial", "Renta Fija", "Negocio", "Cash", "Otro"]} />
              <In l="Valor Actual" value={form.va} onChange={(v) => setForm((p) => ({ ...p, va: v }))} type="number" placeholder="0" />
              <In l="Valor Compra" value={form.vc} onChange={(v) => setForm((p) => ({ ...p, vc: v }))} type="number" placeholder="0" />
              <In l="% Rendimiento Anual (si genera renta)" value={form.tasa} onChange={(v) => setForm((p) => ({ ...p, tasa: v }))} type="number" placeholder="Ej: 24 para 24% anual" />
              {!form.tasa && <div style={{ gridColumn: "1/-1", background: T.blue + "10", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.blue }}>💡 Si este activo genera renta mensual (arriendo, dividendos, rendimientos), ponla en el módulo de <strong>Ingresos</strong>. Aquí solo va el valor del activo.</div>
              </div>}
              {form.tasa && parseFloat(form.tasa) > 0 && parseFloat(form.va) > 0 && (
                <div style={{ gridColumn: "1/-1", background: T.greenDim, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>💰 Este activo generaría:</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.green, marginTop: 4 }}>
                    {"$" + Math.round((parseFloat(form.va) * parseFloat(form.tasa) / 100) / 12).toLocaleString() + "/mes"}
                  </div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                    = {"$" + Math.round(parseFloat(form.va) * parseFloat(form.tasa) / 100).toLocaleString() + "/año"} ({form.tasa}% de {"$" + Math.round(parseFloat(form.va)).toLocaleString()})
                  </div>
                  <div style={{ fontSize: 11, color: T.blue, marginTop: 6, fontWeight: 600 }}>
                    👉 Agrega este ingreso en el módulo de Ingresos con categoría "Rendimiento"
                  </div>
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
