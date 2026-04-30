// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · AsignarTitularMasivo.jsx
//
// PROPÓSITO:
//   Modal que permite asignar masivamente el titular fiscal (owner) a items
//   huérfanos detectados por el auditor. Resuelve en un solo click lo que
//   antes requería ir a Configuración item por item.
//
//   Casos de uso:
//   - "8 inversiones sin titular fiscal" → click "Asignar titular" →
//     selector de owner → "Asignar todas a Lagoon" → done
//   - Si el owner correcto NO existe, hay opción de crear uno inline
//     (ej: "Sosa USA" para activos del exterior)
//
// PROPS:
//   - hallazgo: el hallazgo con accion.tipo === "asignar_owner_*"
//   - user: user actual
//   - onUpdateUser: callback para persistir
//   - onClose: callback al cancelar/finalizar
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  red: "#f87171",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function AsignarTitularMasivo({ hallazgo, user, onUpdateUser, onClose }) {
  // Estado: owner destino, modo crear nuevo, datos del nuevo owner
  const [ownerDestinoId, setOwnerDestinoId] = useState("");
  const [crearNuevo, setCrearNuevo] = useState(false);
  const [nuevoName, setNuevoName] = useState("");
  const [nuevoType, setNuevoType] = useState("natural");
  const [nuevoNit, setNuevoNit] = useState("");

  const tipo = hallazgo?.accion?.tipo;
  const itemIds = hallazgo?.accion?.ids || [];
  const categoriaGasto = hallazgo?.accion?.categoria; // solo para gastos

  // Recolectar los items reales del user según el tipo
  const itemsAfectados = useMemo(() => {
    if (!user || !tipo) return [];
    const idSet = new Set(itemIds);

    switch (tipo) {
      case "asignar_owner_ingresos":
        return (user.ingresos || []).filter(i => idSet.has(i.id)).map(i => ({
          id: i.id,
          label: i.categoria || i.fiscalCode || "Ingreso",
          detalle: i.fuente || i.fiscalCode,
          monto: i.mensual,
          montoLabel: i.mensual ? fm(i.mensual) + "/mes" : "",
        }));
      case "asignar_owner_deudas":
        return (user.deu || []).filter(d => idSet.has(d.id)).map(d => ({
          id: d.id,
          label: d.nombre || d.fiscalCode || "Deuda",
          detalle: d.fiscalCode,
          monto: d.mt,
          montoLabel: d.mt ? "Saldo: " + fm(d.mt) : "",
        }));
      case "asignar_owner_inversiones":
        return (user.inv || []).filter(i => idSet.has(i.id)).map(i => ({
          id: i.id,
          label: i.nombre || i.tipo || "Inversión",
          detalle: i.tipo,
          monto: i.valor || i.va || i.ubi || i.vc || 0,
          montoLabel: (i.valor || i.va) ? fm(i.valor || i.va) : "",
        }));
      case "asignar_owner_gastos": {
        const items = (user.gas?.[categoriaGasto] || []).filter(g => idSet.has(g.id));
        return items.map(g => ({
          id: g.id,
          label: categoriaGasto,
          detalle: g.subtipo || "",
          monto: g.m,
          montoLabel: g.m ? fm(g.m) + "/mes" : "",
        }));
      }
      default:
        return [];
    }
  }, [user, tipo, itemIds, categoriaGasto]);

  // Tipo de item para el copy del modal
  const tipoLabel = useMemo(() => {
    switch (tipo) {
      case "asignar_owner_ingresos": return { sing: "ingreso", plur: "ingresos", emoji: "💰" };
      case "asignar_owner_deudas": return { sing: "deuda", plur: "deudas", emoji: "📉" };
      case "asignar_owner_inversiones": return { sing: "inversión", plur: "inversiones", emoji: "📊" };
      case "asignar_owner_gastos": return { sing: "gasto", plur: "gastos", emoji: "🧾" };
      default: return { sing: "item", plur: "items", emoji: "📄" };
    }
  }, [tipo]);

  // Suma total para mostrar magnitud
  const totalMonto = useMemo(() => {
    return itemsAfectados.reduce((s, it) => s + (Number(it.monto) || 0), 0);
  }, [itemsAfectados]);

  const owners = user?.owners || [];

  // ── Handler: aplicar la asignación ─────────────────────────────────────
  const handleAsignar = () => {
    if (!user) return;

    // Determinar el owner destino: existente o nuevo
    let targetOwnerId = ownerDestinoId;
    let newUser = { ...user };

    if (crearNuevo) {
      if (!nuevoName.trim()) {
        alert("Poné un nombre para el nuevo titular fiscal.");
        return;
      }
      // Crear el owner nuevo
      const nuevoId = "own_" + Date.now();
      const nuevoOwner = {
        id: nuevoId,
        name: nuevoName.trim(),
        type: nuevoType,
        ...(nuevoNit.trim() ? { nit: nuevoNit.trim() } : {}),
        fiscalProfile: {},
      };
      newUser.owners = [...owners, nuevoOwner];
      targetOwnerId = nuevoId;
    }

    if (!targetOwnerId) {
      alert("Seleccioná a quién asignar los items.");
      return;
    }

    const idSet = new Set(itemIds);

    // Aplicar la asignación según el tipo
    switch (tipo) {
      case "asignar_owner_ingresos":
        newUser.ingresos = (newUser.ingresos || []).map(i =>
          idSet.has(i.id) ? { ...i, owner: targetOwnerId } : i
        );
        break;
      case "asignar_owner_deudas":
        newUser.deu = (newUser.deu || []).map(d =>
          idSet.has(d.id) ? { ...d, owner: targetOwnerId } : d
        );
        break;
      case "asignar_owner_inversiones":
        newUser.inv = (newUser.inv || []).map(i =>
          idSet.has(i.id) ? { ...i, owner: targetOwnerId } : i
        );
        break;
      case "asignar_owner_gastos":
        newUser.gas = { ...(newUser.gas || {}) };
        if (categoriaGasto && newUser.gas[categoriaGasto]) {
          newUser.gas[categoriaGasto] = newUser.gas[categoriaGasto].map(g =>
            idSet.has(g.id) ? { ...g, owner: targetOwnerId } : g
          );
        }
        break;
    }

    onUpdateUser(newUser);
    onClose();
  };

  if (!hallazgo || itemsAfectados.length === 0) {
    return null;
  }

  const puedeAsignar = (crearNuevo && nuevoName.trim()) || (!crearNuevo && ownerDestinoId);

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.75)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      overflowY: "auto",
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}>
          <span style={{ fontSize: 28 }}>{tipoLabel.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
              Asignación masiva de titular fiscal
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.3 }}>
              ¿A quién pertenecen estos {itemsAfectados.length} {itemsAfectados.length === 1 ? tipoLabel.sing : tipoLabel.plur}?
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.txt3,
              fontSize: 22,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Items afectados */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            {tipoLabel.plur} a asignar {totalMonto > 0 && <span style={{ color: C.green, marginLeft: 8 }}>· Total: {fm(totalMonto)}</span>}
          </div>
          <div style={{
            background: C.bg3,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            maxHeight: 200,
            overflowY: "auto",
          }}>
            {itemsAfectados.map((it, i) => (
              <div
                key={it.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < itemsAfectados.length - 1 ? `1px solid ${C.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span style={{ color: C.green, fontSize: 12 }}>•</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.txt, fontWeight: 600 }}>{it.label}</div>
                  {it.detalle && it.detalle !== it.label && (
                    <div style={{ fontSize: 11, color: C.txt3, marginTop: 1 }}>{it.detalle}</div>
                  )}
                </div>
                {it.montoLabel && (
                  <div style={{ color: C.txt2, fontSize: 12, fontWeight: 600 }}>
                    {it.montoLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selector de owner destino */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 12 }}>
            Asignar a:
          </div>

          {!crearNuevo && (
            <>
              {/* Lista de owners existentes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {owners.length === 0 ? (
                  <div style={{ padding: "12px 14px", background: C.bg3, borderRadius: 8, fontSize: 13, color: C.txt3 }}>
                    No tenés personas fiscales cargadas. Creá una abajo.
                  </div>
                ) : (
                  owners.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setOwnerDestinoId(o.id)}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        background: ownerDestinoId === o.id ? C.greenBg : C.bg3,
                        border: `1.5px solid ${ownerDestinoId === o.id ? C.green : C.border}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{o.type === "juridica" ? "🏢" : "👤"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.txt, fontWeight: 700, fontSize: 14 }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: C.txt3, marginTop: 1 }}>
                          {o.type === "juridica" ? "Persona jurídica" : "Persona natural"}
                          {o.nit && ` · NIT/CC ${o.nit}`}
                          {o.regimen && ` · ${o.regimen}`}
                        </div>
                      </div>
                      {ownerDestinoId === o.id && <span style={{ color: C.green, fontSize: 18 }}>✓</span>}
                    </button>
                  ))
                )}
              </div>

              {/* Opción crear nuevo */}
              <button
                onClick={() => { setCrearNuevo(true); setOwnerDestinoId(""); }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "transparent",
                  border: `1.5px dashed ${C.border}`,
                  borderRadius: 8,
                  color: C.blue,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                + Crear nueva persona fiscal
              </button>
            </>
          )}

          {crearNuevo && (
            <div style={{ background: C.bg3, padding: 16, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Nueva persona fiscal
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.txt3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Tipo
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setNuevoType("natural")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: nuevoType === "natural" ? C.greenBg : C.bg2,
                      border: `1.5px solid ${nuevoType === "natural" ? C.green : C.border}`,
                      borderRadius: 6,
                      color: C.txt,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    👤 Persona natural
                  </button>
                  <button
                    onClick={() => setNuevoType("juridica")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: nuevoType === "juridica" ? C.greenBg : C.bg2,
                      border: `1.5px solid ${nuevoType === "juridica" ? C.green : C.border}`,
                      borderRadius: 6,
                      color: C.txt,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    🏢 Persona jurídica
                  </button>
                </div>
              </div>

              {/* Nombre */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.txt3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={nuevoName}
                  onChange={(e) => setNuevoName(e.target.value)}
                  placeholder={nuevoType === "juridica" ? "Ej: Sosa USA Corp" : "Ej: Santiago Sosa"}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: C.bg2,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* NIT/Cédula opcional */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.txt3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  NIT / Cédula <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span>
                </label>
                <input
                  type="text"
                  value={nuevoNit}
                  onChange={(e) => setNuevoNit(e.target.value)}
                  placeholder={nuevoType === "juridica" ? "Ej: 901502952" : "Ej: 79123456"}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: C.bg2,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={() => { setCrearNuevo(false); setNuevoName(""); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.txt3,
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  marginTop: 4,
                }}
              >
                ← Volver a la lista
              </button>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div style={{
          padding: "16px 24px",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: `1.5px solid ${C.border}`,
              borderRadius: 8,
              color: C.txt2,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleAsignar}
            disabled={!puedeAsignar}
            style={{
              padding: "10px 20px",
              background: puedeAsignar ? C.green : C.bg3,
              border: "none",
              borderRadius: 8,
              color: puedeAsignar ? "#000" : C.txt3,
              cursor: puedeAsignar ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 800,
              opacity: puedeAsignar ? 1 : 0.5,
            }}
          >
            ✓ Asignar {itemsAfectados.length} {itemsAfectados.length === 1 ? tipoLabel.sing : tipoLabel.plur}
          </button>
        </div>
      </div>
    </div>
  );
}
