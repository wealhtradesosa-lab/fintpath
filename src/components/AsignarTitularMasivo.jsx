// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · AsignarTitularMasivo.jsx (v2)
//
// PROPÓSITO:
//   Modal con 3 modos de operación para items huérfanos detectados por
//   el auditor:
//
//   1. 👤 ASIGNAR A UN TITULAR FISCAL
//      Para items que SÍ deben tributar en Colombia bajo un owner.
//      Soporta crear owner nuevo inline.
//
//   2. 🌎 MARCAR COMO EXTERIOR (no declara en Colombia)
//      Para items que tributan en otra jurisdicción (ej: inversiones
//      en USA). Los marca con excluirDeclaracion=true. El auditor no
//      los vuelve a marcar como huérfanos. El motor no los procesa.
//
//   3. 🗑️ ELIMINAR ITEMS
//      Para duplicados o items viejos que ya no aplican. Por ejemplo:
//      cargué un arriendo $6.2M que era basura, luego el correcto fue
//      cargado como $6.4M; el viejo es duplicado eliminable.
//
//   Cada item muestra TODA su info identificable (id, fuente, fecha,
//   código fiscal, moneda, origen) para que el user pueda distinguir
//   items que parecen iguales.
//
//   El user puede SELECCIONAR cuáles items aplicar (no necesariamente
//   todos). Útil cuando algunos van a un titular y otros son basura.
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
  redBg: "rgba(248,113,113,0.10)",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

function infoItem(item, tipo) {
  const partes = [];
  if (item.id) {
    const corto = String(item.id).length > 16 ? String(item.id).slice(-12) : item.id;
    partes.push(`id:${corto}`);
  }
  if (item.fuente) partes.push(item.fuente);
  if (item.fiscalCode && !item.fuente) partes.push(item.fiscalCode);
  if (item.tipo && tipo === "asignar_owner_inversiones") partes.push(item.tipo);
  if (item.subtipo) partes.push(item.subtipo);
  if (item.moneda && item.moneda !== "COP") partes.push(item.moneda);
  if (item._wizard) partes.push("⚡ wizard");
  if (item._opportunity) partes.push("⚡ aplicada");
  return partes.join(" · ");
}

export default function AsignarTitularMasivo({ hallazgo, user, onUpdateUser, onClose }) {
  const [modo, setModo] = useState("asignar");
  const [ownerDestinoId, setOwnerDestinoId] = useState("");
  const [crearNuevo, setCrearNuevo] = useState(false);
  const [nuevoName, setNuevoName] = useState("");
  const [nuevoType, setNuevoType] = useState("natural");
  const [nuevoNit, setNuevoNit] = useState("");
  const [jurisdiccion, setJurisdiccion] = useState("USA");
  const [seleccionados, setSeleccionados] = useState(() => new Set(hallazgo?.accion?.ids || []));

  const tipo = hallazgo?.accion?.tipo;
  const itemIds = hallazgo?.accion?.ids || [];
  const categoriaGasto = hallazgo?.accion?.categoria;

  const itemsAfectados = useMemo(() => {
    if (!user || !tipo) return [];
    const idSet = new Set(itemIds);
    const mapear = (raw, tipoLabel, getMonto, getMontoLabel) => raw
      .filter(it => idSet.has(it.id))
      .map(it => ({
        id: it.id,
        label: it.nombre || it.categoria || it.fiscalCode || tipoLabel,
        infoExtra: infoItem(it, tipo),
        monto: getMonto(it),
        montoLabel: getMontoLabel(it),
        owner: it.owner,
      }));
    switch (tipo) {
      case "asignar_owner_ingresos":
        return mapear(user.ingresos || [], "Ingreso",
          i => i.mensual,
          i => i.mensual ? fm(i.mensual) + "/mes · " + fm(i.mensual * 12) + "/año" : "");
      case "asignar_owner_deudas":
        return mapear(user.deu || [], "Deuda",
          d => d.mt,
          d => d.mt ? "Saldo " + fm(d.mt) : "");
      case "asignar_owner_inversiones":
        return mapear(user.inv || [], "Inversión",
          i => i.valor || i.va || i.ubi || i.vc || 0,
          i => fm(i.valor || i.va || i.ubi || i.vc || 0));
      case "asignar_owner_gastos": {
        const items = (user.gas?.[categoriaGasto] || []).filter(g => idSet.has(g.id));
        return items.map(g => ({
          id: g.id,
          label: categoriaGasto,
          infoExtra: infoItem(g, tipo),
          monto: g.m,
          montoLabel: g.m ? fm(g.m) + "/mes · " + fm(g.m * 12) + "/año" : "",
          owner: g.owner,
        }));
      }
      default:
        return [];
    }
  }, [user, tipo, itemIds, categoriaGasto]);

  const tipoLabel = useMemo(() => {
    switch (tipo) {
      case "asignar_owner_ingresos": return { sing: "ingreso", plur: "ingresos", emoji: "💰" };
      case "asignar_owner_deudas": return { sing: "deuda", plur: "deudas", emoji: "📉" };
      case "asignar_owner_inversiones": return { sing: "inversión", plur: "inversiones", emoji: "📊" };
      case "asignar_owner_gastos": return { sing: "gasto", plur: "gastos", emoji: "🧾" };
      default: return { sing: "item", plur: "items", emoji: "📄" };
    }
  }, [tipo]);

  const owners = user?.owners || [];
  const itemsSeleccionados = itemsAfectados.filter(it => seleccionados.has(it.id));
  const totalMonto = itemsSeleccionados.reduce((s, it) => s + (Number(it.monto) || 0), 0);

  const toggleItem = (id) => {
    setSeleccionados(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };
  const selectAll = () => setSeleccionados(new Set(itemsAfectados.map(it => it.id)));
  const deselectAll = () => setSeleccionados(new Set());

  const handleAplicar = () => {
    if (!user) return;
    if (seleccionados.size === 0) { alert("Seleccioná al menos un item."); return; }
    const idSet = seleccionados;
    let newUser = JSON.parse(JSON.stringify(user));

    if (modo === "asignar") {
      let targetOwnerId = ownerDestinoId;
      if (crearNuevo) {
        if (!nuevoName.trim()) { alert("Poné un nombre para el nuevo titular fiscal."); return; }
        const nuevoId = "own_" + Date.now();
        newUser.owners = [...(newUser.owners || []), {
          id: nuevoId,
          name: nuevoName.trim(),
          type: nuevoType,
          ...(nuevoNit.trim() ? { nit: nuevoNit.trim() } : {}),
          fiscalProfile: {},
        }];
        targetOwnerId = nuevoId;
      }
      if (!targetOwnerId) { alert("Seleccioná a quién asignar los items."); return; }
      aplicarCambioBatch(newUser, tipo, categoriaGasto, idSet, (it) => ({ ...it, owner: targetOwnerId }));
    }
    else if (modo === "exterior") {
      aplicarCambioBatch(newUser, tipo, categoriaGasto, idSet, (it) => ({
        ...it,
        excluirDeclaracion: true,
        jurisdiccion: jurisdiccion || "exterior",
      }));
    }
    else if (modo === "eliminar") {
      const ok = confirm(`¿Eliminar definitivamente ${idSet.size} ${idSet.size === 1 ? tipoLabel.sing : tipoLabel.plur}? Esta acción NO se puede deshacer.`);
      if (!ok) return;
      eliminarBatch(newUser, tipo, categoriaGasto, idSet);
    }

    onUpdateUser(newUser);
    onClose();
  };

  if (!hallazgo || itemsAfectados.length === 0) return null;

  const puedeAplicar = (() => {
    if (seleccionados.size === 0) return false;
    if (modo === "asignar") return (crearNuevo && nuevoName.trim()) || (!crearNuevo && ownerDestinoId);
    if (modo === "exterior") return jurisdiccion.trim();
    if (modo === "eliminar") return true;
    return false;
  })();

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.75)", zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bg2, border: `1px solid ${C.border}`,
          borderRadius: 14, maxWidth: 720, width: "100%",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "flex-start", gap: 14,
          position: "sticky", top: 0, background: C.bg2, zIndex: 1,
        }}>
          <span style={{ fontSize: 28 }}>{tipoLabel.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
              {itemsAfectados.length} {itemsAfectados.length === 1 ? tipoLabel.sing : tipoLabel.plur} sin titular fiscal
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.3 }}>
              ¿Qué querés hacer con {itemsAfectados.length === 1 ? "este " + tipoLabel.sing : "estos " + tipoLabel.plur}?
            </h2>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar">✕</button>
        </div>

        {/* Tabs de modo */}
        <div style={{
          padding: "12px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", gap: 8, flexWrap: "wrap",
        }}>
          <TabBtn activo={modo === "asignar"} onClick={() => setModo("asignar")} color={C.green}>
            👤 Asignar a un titular
          </TabBtn>
          <TabBtn activo={modo === "exterior"} onClick={() => setModo("exterior")} color={C.blue}>
            🌎 Marcar como exterior
          </TabBtn>
          <TabBtn activo={modo === "eliminar"} onClick={() => setModo("eliminar")} color={C.red}>
            🗑️ Eliminar (duplicados/viejos)
          </TabBtn>
        </div>

        {/* Items con checkbox + info detallada */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.txt3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Seleccioná los items
              {seleccionados.size > 0 && <span style={{ color: C.green, marginLeft: 6 }}>· {seleccionados.size} de {itemsAfectados.length}</span>}
              {totalMonto > 0 && <span style={{ color: C.green, marginLeft: 6 }}>· Total {fm(totalMonto)}</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={selectAll} style={miniBtn}>Todos</button>
              <button onClick={deselectAll} style={miniBtn}>Ninguno</button>
            </div>
          </div>
          <div style={{
            background: C.bg3, borderRadius: 8, border: `1px solid ${C.border}`,
            maxHeight: 240, overflowY: "auto",
          }}>
            {itemsAfectados.map((it, i) => {
              const sel = seleccionados.has(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => toggleItem(it.id)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderBottom: i < itemsAfectados.length - 1 ? `1px solid ${C.border}` : "none",
                    background: sel ? "rgba(74,222,128,0.06)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, flexShrink: 0,
                    borderRadius: 4,
                    border: `1.5px solid ${sel ? C.green : C.border}`,
                    background: sel ? C.green : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#000", fontSize: 12, fontWeight: 800, marginTop: 1,
                  }}>{sel && "✓"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.txt, fontWeight: 700, fontSize: 13 }}>{it.label}</div>
                    {it.infoExtra && (
                      <div style={{ fontSize: 10, color: C.txt3, marginTop: 2, fontFamily: "ui-monospace, monospace", overflowWrap: "break-word" }}>
                        {it.infoExtra}
                      </div>
                    )}
                  </div>
                  {it.montoLabel && (
                    <div style={{ color: C.txt2, fontSize: 12, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
                      {it.montoLabel}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido específico del modo */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          {modo === "asignar" && (
            <ContenidoAsignar
              owners={owners}
              ownerDestinoId={ownerDestinoId} setOwnerDestinoId={setOwnerDestinoId}
              crearNuevo={crearNuevo} setCrearNuevo={setCrearNuevo}
              nuevoName={nuevoName} setNuevoName={setNuevoName}
              nuevoType={nuevoType} setNuevoType={setNuevoType}
              nuevoNit={nuevoNit} setNuevoNit={setNuevoNit}
            />
          )}
          {modo === "exterior" && (
            <ContenidoExterior jurisdiccion={jurisdiccion} setJurisdiccion={setJurisdiccion} tipoLabel={tipoLabel} />
          )}
          {modo === "eliminar" && (
            <ContenidoEliminar tipoLabel={tipoLabel} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", display: "flex", gap: 10, justifyContent: "flex-end",
          position: "sticky", bottom: 0, background: C.bg2, borderTop: `1px solid ${C.border}`,
        }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={handleAplicar} disabled={!puedeAplicar} style={{
            ...btnPrimary,
            background: !puedeAplicar ? C.bg3 : (modo === "eliminar" ? C.red : modo === "exterior" ? C.blue : C.green),
            color: !puedeAplicar ? C.txt3 : (modo === "eliminar" || modo === "exterior" ? "#fff" : "#000"),
            cursor: !puedeAplicar ? "not-allowed" : "pointer",
            opacity: !puedeAplicar ? 0.5 : 1,
          }}>
            {modo === "asignar" && `✓ Asignar ${seleccionados.size} ${seleccionados.size === 1 ? tipoLabel.sing : tipoLabel.plur}`}
            {modo === "exterior" && `🌎 Marcar ${seleccionados.size} como exterior`}
            {modo === "eliminar" && `🗑️ Eliminar ${seleccionados.size} ${seleccionados.size === 1 ? tipoLabel.sing : tipoLabel.plur}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de batch update
// ─────────────────────────────────────────────────────────────────────────

function aplicarCambioBatch(newUser, tipo, categoriaGasto, idSet, transformer) {
  switch (tipo) {
    case "asignar_owner_ingresos":
      newUser.ingresos = (newUser.ingresos || []).map(i => idSet.has(i.id) ? transformer(i) : i);
      break;
    case "asignar_owner_deudas":
      newUser.deu = (newUser.deu || []).map(d => idSet.has(d.id) ? transformer(d) : d);
      break;
    case "asignar_owner_inversiones":
      newUser.inv = (newUser.inv || []).map(i => idSet.has(i.id) ? transformer(i) : i);
      break;
    case "asignar_owner_gastos":
      newUser.gas = { ...(newUser.gas || {}) };
      if (categoriaGasto && newUser.gas[categoriaGasto]) {
        newUser.gas[categoriaGasto] = newUser.gas[categoriaGasto].map(g => idSet.has(g.id) ? transformer(g) : g);
      }
      break;
  }
}

function eliminarBatch(newUser, tipo, categoriaGasto, idSet) {
  switch (tipo) {
    case "asignar_owner_ingresos":
      newUser.ingresos = (newUser.ingresos || []).filter(i => !idSet.has(i.id));
      break;
    case "asignar_owner_deudas":
      newUser.deu = (newUser.deu || []).filter(d => !idSet.has(d.id));
      break;
    case "asignar_owner_inversiones":
      newUser.inv = (newUser.inv || []).filter(i => !idSet.has(i.id));
      break;
    case "asignar_owner_gastos":
      newUser.gas = { ...(newUser.gas || {}) };
      if (categoriaGasto && newUser.gas[categoriaGasto]) {
        newUser.gas[categoriaGasto] = newUser.gas[categoriaGasto].filter(g => !idSet.has(g.id));
      }
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponentes por modo
// ─────────────────────────────────────────────────────────────────────────

function ContenidoAsignar({ owners, ownerDestinoId, setOwnerDestinoId, crearNuevo, setCrearNuevo, nuevoName, setNuevoName, nuevoType, setNuevoType, nuevoNit, setNuevoNit }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 12 }}>Asignar a:</div>
      {!crearNuevo && (
        <>
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
                    textAlign: "left", padding: "12px 14px",
                    background: ownerDestinoId === o.id ? C.greenBg : C.bg3,
                    border: `1.5px solid ${ownerDestinoId === o.id ? C.green : C.border}`,
                    borderRadius: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
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
          <button
            onClick={() => { setCrearNuevo(true); setOwnerDestinoId(""); }}
            style={{
              width: "100%", padding: "10px 14px",
              background: "transparent", border: `1.5px dashed ${C.border}`,
              borderRadius: 8, color: C.blue, cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >+ Crear nueva persona fiscal</button>
        </>
      )}
      {crearNuevo && (
        <div style={{ background: C.bg3, padding: 16, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Nueva persona fiscal</div>
          <div style={{ marginBottom: 12 }}>
            <label style={lblStyle}>Tipo</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setNuevoType("natural")} style={pillBtn(nuevoType === "natural")}>👤 Persona natural</button>
              <button onClick={() => setNuevoType("juridica")} style={pillBtn(nuevoType === "juridica")}>🏢 Persona jurídica</button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lblStyle}>Nombre</label>
            <input type="text" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)}
              placeholder={nuevoType === "juridica" ? "Ej: Sosa USA Corp" : "Ej: Santiago Sosa"}
              style={inputStyle} />
          </div>
          <div>
            <label style={lblStyle}>NIT / Cédula <span style={{ fontWeight: 400, textTransform: "none" }}>(opcional)</span></label>
            <input type="text" value={nuevoNit} onChange={(e) => setNuevoNit(e.target.value)}
              placeholder={nuevoType === "juridica" ? "Ej: 901502952" : "Ej: 79123456"}
              style={inputStyle} />
          </div>
          <button onClick={() => { setCrearNuevo(false); setNuevoName(""); }}
            style={{ background: "transparent", border: "none", color: C.txt3, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 12 }}
          >← Volver a la lista</button>
        </div>
      )}
    </div>
  );
}

function ContenidoExterior({ jurisdiccion, setJurisdiccion, tipoLabel }) {
  return (
    <div>
      <div style={{
        padding: "14px 16px", background: C.blueBg, border: `1px solid ${C.blue}40`,
        borderLeft: `3px solid ${C.blue}`, borderRadius: 8, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
          🌎 Marcar como exterior
        </div>
        <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.55 }}>
          Estos {tipoLabel.plur} <strong style={{ color: C.txt }}>tributan en otra jurisdicción</strong> (ej: USA) y no aplican a la declaración de renta colombiana.
        </div>
        <div style={{ fontSize: 12, color: C.txt3, lineHeight: 1.5, marginTop: 8 }}>
          ✓ El auditor deja de marcarlos como huérfanos<br />
          ✓ El motor de impuestos colombiano no los procesa<br />
          ✓ Quedan archivados con etiqueta de jurisdicción para tu referencia
        </div>
      </div>
      <div>
        <label style={lblStyle}>Jurisdicción donde tributan</label>
        <input type="text" value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)}
          placeholder="Ej: USA, España, Panamá" style={inputStyle} />
        <div style={{ fontSize: 11, color: C.txt3, marginTop: 6, lineHeight: 1.4 }}>
          Solo se usa como etiqueta interna para que sepas dónde están reportados estos {tipoLabel.plur}.
        </div>
      </div>
      <div style={{
        marginTop: 16, padding: "10px 14px",
        background: C.orangeBg, border: `1px solid ${C.orange}40`, borderRadius: 8,
      }}>
        <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
          ⚠ Recordatorio fiscal
        </div>
        <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
          Si sos residente fiscal colombiano (&gt;183 días en el país), Colombia te grava por <strong>renta mundial</strong> con descuento por impuestos pagados afuera (Art. 254 ET). Marcar como exterior es válido si NO sos residente fiscal o si vas a manejar el cruce con tu contador. <strong>No exime de declarar.</strong>
        </div>
      </div>
    </div>
  );
}

function ContenidoEliminar({ tipoLabel }) {
  return (
    <div style={{
      padding: "14px 16px", background: C.redBg, border: `1px solid ${C.red}40`,
      borderLeft: `3px solid ${C.red}`, borderRadius: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.red, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        🗑️ Eliminar definitivamente
      </div>
      <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.55, marginBottom: 8 }}>
        Usá esto si los {tipoLabel.plur} de arriba son:
      </div>
      <ul style={{ margin: 0, paddingLeft: 22, color: C.txt2, fontSize: 12, lineHeight: 1.7 }}>
        <li><strong style={{ color: C.txt }}>Duplicados</strong> de items que ya están bien cargados con otro monto</li>
        <li><strong style={{ color: C.txt }}>Items viejos</strong> de pruebas o años anteriores</li>
        <li><strong style={{ color: C.txt }}>Datos basura</strong> que llegaron por error</li>
      </ul>
      <div style={{ fontSize: 12, color: C.red, marginTop: 12, fontWeight: 700 }}>
        ⚠ Esta acción NO se puede deshacer.
      </div>
    </div>
  );
}

// Mini componentes
function TabBtn({ activo, onClick, color, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "8px 14px",
        background: activo ? `${color}20` : "transparent",
        border: `1.5px solid ${activo ? color : C.border}`,
        borderRadius: 8,
        color: activo ? color : C.txt2,
        fontSize: 12, fontWeight: 700, cursor: "pointer",
        flex: "1 1 auto",
      }}
    >{children}</button>
  );
}

const btnPrimary = { padding: "10px 20px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800 };
const btnSec = { padding: "10px 18px", background: "transparent", border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.txt2, cursor: "pointer", fontSize: 13, fontWeight: 700 };
const closeBtn = { background: "transparent", border: "none", color: C.txt3, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 };
const miniBtn = { padding: "4px 10px", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 5, color: C.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer" };
const lblStyle = { display: "block", fontSize: 11, fontWeight: 700, color: C.txt3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };
const inputStyle = { width: "100%", padding: "10px 12px", background: C.bg3, border: `1.5px solid ${C.border}`, borderRadius: 6, color: C.txt, fontSize: 14, outline: "none", boxSizing: "border-box" };
function pillBtn(activo) {
  return { flex: 1, padding: "10px", background: activo ? C.greenBg : C.bg3, border: `1.5px solid ${activo ? C.green : C.border}`, borderRadius: 6, color: C.txt, cursor: "pointer", fontSize: 13, fontWeight: 700 };
}
