import { useState } from "react";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", purple: "#a78bfa", orange: "#f97316",
  gold: "#eab308", cyan: "#22d3ee",
  ch: ["#22c55e","#3b82f6","#f97316","#a78bfa","#22d3ee","#eab308","#ef4444","#ec4899"],
};
const fm = (n) => { if (Math.abs(n) >= 1e9) return "$" + (n/1e9).toFixed(1) + "B"; if (Math.abs(n) >= 1e6) return "$" + (n/1e6).toFixed(1) + "M"; return "$" + Math.round(n).toLocaleString(); };
const ICONS = ["🏠","🚗","🎓","✈️","💼","🏖️","💰","🏥","👶","📱","🎯","🏆"];
const CATS = ["Propiedad","Vehículo","Educación","Viaje","Negocio","Retiro","Ahorro","Salud","Familia","Otro"];

export default function MetasModule({ metas, onUpdate, cashFlow }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", categoria: "Ahorro", monto: "", fechaMeta: "", ahorrado: "", icono: "🎯", prioridad: "media" });
  const items = metas || [];

  const handleSave = () => {
    const item = {
      ...form,
      monto: Number(form.monto) || 0,
      ahorrado: Number(form.ahorrado) || 0,
    };
    let updated;
    if (editId) { updated = items.map(i => i.id === editId ? { ...item, id: editId } : i); }
    else { item.id = "meta_" + Date.now(); updated = [...items, item]; }
    onUpdate(updated);
    setEditId(null); setShowForm(false);
    setForm({ nombre: "", categoria: "Ahorro", monto: "", fechaMeta: "", ahorrado: "", icono: "🎯", prioridad: "media" });
  };

  const handleEdit = (item) => {
    setForm({ nombre: item.nombre, categoria: item.categoria, monto: item.monto, fechaMeta: item.fechaMeta, ahorrado: item.ahorrado, icono: item.icono || "🎯", prioridad: item.prioridad || "media" });
    setEditId(item.id); setShowForm(true);
  };

  const totalNeeded = items.reduce((s, m) => s + Math.max(0, (m.monto||0) - (m.ahorrado||0)), 0);
  const totalAhorrado = items.reduce((s, m) => s + (m.ahorrado||0), 0);
  const totalMeta = items.reduce((s, m) => s + (m.monto||0), 0);
  const cfMensual = cashFlow || 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>🎯 Metas Financieras</h2>
          <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>{items.length} metas • Necesitas: {fm(totalNeeded)}</p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ nombre: "", categoria: "Ahorro", monto: "", fechaMeta: "", ahorrado: "", icono: "🎯", prioridad: "media" }); setShowForm(true); }}
          style={{ background: T.green, color: "#000", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Nueva Meta</button>
      </div>

      {/* Resumen */}
      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>TOTAL METAS</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.blue, marginTop: 4 }}>{fm(totalMeta)}</div>
          </div>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>AHORRADO</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.green, marginTop: 4 }}>{fm(totalAhorrado)}</div>
          </div>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>FALTA</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.orange, marginTop: 4 }}>{fm(totalNeeded)}</div>
          </div>
          <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>CASH FLOW DISPONIBLE</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cfMensual >= 0 ? T.green : T.red, marginTop: 4 }}>{fm(cfMensual)}/mes</div>
          </div>
        </div>
      )}

      {/* Metas cards */}
      {items.length === 0 ? (
        <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <p style={{ color: T.txt2, fontSize: 14 }}>No tienes metas. Agrega tu primera meta financiera.</p>
          <p style={{ color: T.txt3, fontSize: 12 }}>Ejemplos: comprar casa, carro nuevo, fondo universidad, viaje familiar, retiro anticipado.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {items.sort((a, b) => new Date(a.fechaMeta || "2099-01-01") - new Date(b.fechaMeta || "2099-01-01")).map((meta) => {
            const monto = meta.monto || 0;
            const ahorrado = meta.ahorrado || 0;
            const falta = Math.max(0, monto - ahorrado);
            const progreso = monto > 0 ? Math.min((ahorrado / monto) * 100, 100) : 0;
            const done = progreso >= 100;
            const fechaObj = meta.fechaMeta ? new Date(meta.fechaMeta) : null;
            const hoy = new Date();
            const mesesFalta = fechaObj ? Math.max(0, Math.round((fechaObj - hoy) / (1000 * 60 * 60 * 24 * 30.44))) : null;
            const ahorroPorMes = mesesFalta && mesesFalta > 0 ? Math.round(falta / mesesFalta) : null;
            const alcanzable = cfMensual > 0 && ahorroPorMes && cfMensual >= ahorroPorMes;
            const mesesConCF = cfMensual > 0 && falta > 0 ? Math.ceil(falta / cfMensual) : null;
            const priColor = meta.prioridad === "alta" ? T.red : meta.prioridad === "media" ? T.orange : T.green;

            return (
              <div key={meta.id} style={{ background: T.card, border: "1px solid " + (done ? T.green + "30" : T.border), borderRadius: 16, padding: "20px 24px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 28 }}>{meta.icono || "🎯"}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: done ? T.green : T.txt }}>{meta.nombre || "Meta"}</div>
                      <div style={{ fontSize: 11, color: T.txt3 }}>
                        {meta.categoria}
                        <span style={{ marginLeft: 8, color: priColor, fontWeight: 600 }}>● {meta.prioridad || "media"}</span>
                        {fechaObj && <span style={{ marginLeft: 8 }}>📅 {fechaObj.toLocaleDateString("es-CO", { month: "short", year: "numeric" })}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleEdit(meta)} style={{ background: T.bg3, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.txt2, fontSize: 11 }}>✏️</button>
                    <button onClick={() => { if (confirm("¿Eliminar?")) onUpdate(items.filter(i => i.id !== meta.id)); }} style={{ background: T.redDim, border: "none", padding: "5px 8px", borderRadius: 6, cursor: "pointer", color: T.red, fontSize: 11 }}>🗑️</button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: T.txt3 }}>Progreso</span>
                    <span style={{ color: done ? T.green : T.txt2, fontWeight: 700 }}>{progreso.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 10, background: T.bg3, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: progreso + "%", background: done ? T.green : progreso > 50 ? T.blue : T.orange, borderRadius: 5, transition: "width 0.3s" }} />
                  </div>
                </div>

                {/* Numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.txt3 }}>Meta</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>{fm(monto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.txt3 }}>Ahorrado</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>{fm(ahorrado)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.txt3 }}>Falta</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: done ? T.green : T.orange }}>{done ? "✅ Logrado" : fm(falta)}</div>
                  </div>
                </div>

                {/* Plan */}
                {!done && (
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 12, fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
                    {ahorroPorMes && <div>📅 Para llegar a tiempo: ahorra <strong style={{ color: T.cyan }}>{fm(ahorroPorMes)}/mes</strong> por {mesesFalta} meses</div>}
                    {mesesConCF && <div>📊 Con tu cash flow actual ({fm(cfMensual)}/mes): llegas en <strong style={{ color: alcanzable ? T.green : T.orange }}>{mesesConCF} meses ({(mesesConCF / 12).toFixed(1)} años)</strong></div>}
                    {ahorroPorMes && !alcanzable && cfMensual > 0 && <div style={{ color: T.orange }}>⚠ Tu cash flow no alcanza para llegar a la fecha. Necesitas {fm(ahorroPorMes - cfMensual)}/mes adicionales.</div>}
                    {cfMensual <= 0 && <div style={{ color: T.red }}>⚠ Sin cash flow positivo no puedes ahorrar. Revisa ingresos y gastos.</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editId ? "Editar Meta" : "Nueva Meta"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nombre de la meta</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Casa en la playa, Carro nuevo, Fondo universidad" style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none" }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: e.target.value }))} style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none" }}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Monto necesario</label>
                <input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="500000000" style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Ya ahorrado</label>
                <input type="number" value={form.ahorrado} onChange={e => setForm(p => ({ ...p, ahorrado: e.target.value }))} placeholder="100000000" style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Fecha meta</label>
                <input type="date" value={form.fechaMeta} onChange={e => setForm(p => ({ ...p, fechaMeta: e.target.value }))} style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: "10px 14px", color: T.txt, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Ícono</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => setForm(p => ({ ...p, icono: ic }))} style={{ width: 36, height: 36, borderRadius: 8, border: form.icono === ic ? "2px solid " + T.blue : "1px solid " + T.border, background: form.icono === ic ? T.blue + "15" : T.bg3, cursor: "pointer", fontSize: 18 }}>{ic}</button>
                  ))}
                </div>
              </div>
            </div>
            {form.monto && form.fechaMeta && Number(form.monto) > 0 && (() => {
              const falta = Math.max(0, Number(form.monto) - (Number(form.ahorrado) || 0));
              const meses = Math.max(1, Math.round((new Date(form.fechaMeta) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)));
              const mensual = Math.round(falta / meses);
              return (
                <div style={{ marginTop: 16, background: T.greenDim, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>📊 Plan de ahorro:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.green, marginTop: 4 }}>Ahorrar {fm(mensual)}/mes por {meses} meses</div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                    {cfMensual >= mensual ? "✅ Tu cash flow actual (" + fm(cfMensual) + "/mes) cubre esta meta" : "⚠ Necesitas " + fm(mensual - cfMensual) + "/mes adicionales — tu cash flow actual es " + fm(cfMensual) + "/mes"}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid " + T.border, color: T.txt2, padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: T.green, color: "#000", border: "none", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>{editId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
