// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BorradorDeclaracionF110.jsx
//
// UI del borrador editable F-110 para personas jurídicas. Renderiza una
// tabla con los renglones DIAN, separados por sección (patrimonio, ingresos,
// costos, renta, impuesto, liquidación). Cada renglón editable tiene una
// celda con valor + botón [editar] que abre un mini-form inline. Los
// renglones de fórmula se recalculan automáticamente al cambiar dependencias.
//
// PROPS:
//   - user: user object completo
//   - estimacion: output de estimarImpuesto(user)
//   - onUpdateUser: callback (newUser) → persiste en supabase
//
// FILOSOFÍA:
//   - Cero ambigüedad: cada renglón muestra su número DIAN oficial
//   - Trazabilidad: hover muestra de dónde viene el valor automático
//   - Override visible: cuando el user/contador edita, se ve un badge "✏️"
//   - Reset disponible: siempre podés volver al valor automático
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { generarBorradorF110, SECCIONES_F110 } from "../lib/borradorDeclaracion.js";
import { generarBorradorF210, SECCIONES_F210 } from "../lib/borradorDeclaracionF210.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", blue: "#3b82f6", purple: "#c4b5fd",
  orange: "#f59e0b", red: "#ef4444", gold: "#eab308",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function BorradorDeclaracionF110({ user, estimacion, onUpdateUser }) {
  // Owners disponibles: jurídicas + naturales
  const ownersJur = useMemo(() => (user?.owners || []).filter(o => o.type === "juridica"), [user]);
  const ownersNat = useMemo(() => (user?.owners || []).filter(o => o.type === "natural"), [user]);
  const allOwners = useMemo(() => [...ownersJur, ...ownersNat], [ownersJur, ownersNat]);

  // Default: prioriza jurídica, fallback a natural
  const [selectedOwnerId, setSelectedOwnerId] = useState(allOwners[0]?.id || "");
  const [ano, setAno] = useState(2025);
  const [editingRenglon, setEditingRenglon] = useState(null);
  const [editValue, setEditValue] = useState("");
  // Sesión 28-abr-2026 noche: state para tips contextuales expandibles.
  // Cuando el user hace click en 💡 de un renglón, se expande su tip educativo.
  const [showTipFor, setShowTipFor] = useState(null);

  const selectedOwner = allOwners.find(o => o.id === selectedOwnerId);
  const isJuridica = selectedOwner?.type === "juridica";
  const formulario = isJuridica ? "F-110" : "F-210";

  // Generar renglones según tipo de owner
  const renglones = useMemo(() => {
    if (!selectedOwner) return null;
    return isJuridica
      ? generarBorradorF110(user, selectedOwner, estimacion, ano)
      : generarBorradorF210(user, selectedOwner, estimacion, ano);
  }, [user, selectedOwner, estimacion, ano, isJuridica]);

  // Secciones según tipo
  const SECCIONES = isJuridica ? SECCIONES_F110 : SECCIONES_F210;
  const seccionesOrden = isJuridica
    ? ["patrimonio", "ingresos", "costos", "renta", "impuesto", "liquidacion"]
    : ["patrimonio", "trabajo", "deducciones", "capital", "noLaboral", "dividendos", "rentaTotal", "impuesto", "liquidacion"];

  if (allOwners.length === 0) {
    return (
      <div style={{ padding: "24px 0" }}>
        {/* Header del Agente Tributario IA — alto contraste */}
        <div style={{ marginBottom: 20, padding: "24px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 36 }}>🤖</span>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
                Agente Tributario IA
              </h2>
              <div style={{ fontSize: 13, color: T.txt2, fontWeight: 500, marginTop: 4 }}>
                Tu copiloto fiscal — te explica y acompaña paso a paso
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "32px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.txt, marginBottom: 12 }}>
            Necesitamos tus datos para arrancar
          </h3>
          <p style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 20px" }}>
            Para generar tu borrador de declaración (F-110 jurídica o F-210 natural), primero tenés
            que tener al menos un <strong style={{ color: T.txt }}>owner fiscal</strong> creado:
          </p>
          <div style={{ padding: "16px 20px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, maxWidth: 520, margin: "0 auto", textAlign: "left" }}>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.7 }}>
              📍 Andá a <strong style={{ color: T.green }}>Configuración → Owners fiscales</strong> y agregá:
              <br />• <strong>👤 Persona natural</strong> (vos): para tu declaración personal F-210
              <br />• <strong>🏢 Persona jurídica</strong> (tu SAS/Ltda): para declaración F-110 de la sociedad
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!renglones) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.txt3 }}>
        Cargando borrador...
      </div>
    );
  }

  // Persistir override
  const persistirOverride = (numero, valor) => {
    const overrides = { ...(user?.borradorDeclaracion || {}) };
    if (!overrides[selectedOwnerId]) overrides[selectedOwnerId] = {};
    if (!overrides[selectedOwnerId][ano]) overrides[selectedOwnerId][ano] = {};

    if (valor === null || valor === "" || valor === undefined) {
      delete overrides[selectedOwnerId][ano][numero];
      // Limpiar año/owner si quedó vacío
      if (Object.keys(overrides[selectedOwnerId][ano]).length === 0) {
        delete overrides[selectedOwnerId][ano];
      }
      if (Object.keys(overrides[selectedOwnerId]).length === 0) {
        delete overrides[selectedOwnerId];
      }
    } else {
      overrides[selectedOwnerId][ano][numero] = Number(valor);
    }

    onUpdateUser({ ...user, borradorDeclaracion: overrides });
  };

  const handleEditar = (renglon) => {
    setEditingRenglon(renglon.numero);
    setEditValue(String(Math.round(renglon.valor || 0)));
  };

  const handleGuardarEdit = () => {
    persistirOverride(editingRenglon, editValue);
    setEditingRenglon(null);
    setEditValue("");
  };

  const handleResetear = (numero) => {
    persistirOverride(numero, null);
    setEditingRenglon(null);
  };

  const handleResetTodos = () => {
    if (!confirm("¿Resetear TODOS los overrides de este borrador? Los renglones volverán a calcularse desde tus datos cargados.")) return;
    const overrides = { ...(user?.borradorDeclaracion || {}) };
    if (overrides[selectedOwnerId]) {
      delete overrides[selectedOwnerId][ano];
      if (Object.keys(overrides[selectedOwnerId]).length === 0) {
        delete overrides[selectedOwnerId];
      }
    }
    onUpdateUser({ ...user, borradorDeclaracion: overrides });
  };

  // Conteo de overrides activos
  const overridesCount = Object.keys(user?.borradorDeclaracion?.[selectedOwnerId]?.[ano] || {}).length;

  // Saldo final destacado
  const saldoFinal = renglones.find(r => r.numero === 113)?.valor || 0;
  const totalRetenciones = renglones.find(r => r.numero === 107)?.valor || 0;
  const impuestoCargo = renglones.find(r => r.numero === 99)?.valor || 0;

  // Agrupar renglones por sección (usa seccionesOrden dinámico según tipo de owner)
  const renglonesPorSeccion = seccionesOrden.map(sec => ({
    seccion: sec,
    info: SECCIONES[sec],
    items: renglones.filter(r => r.seccion === sec),
  }));

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header con branding "Agente Tributario IA" — alto contraste para legibilidad */}
      <div style={{ marginBottom: 20, padding: "24px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 36 }}>🤖</span>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
              Agente Tributario IA
            </h2>
            <div style={{ fontSize: 13, color: T.txt2, fontWeight: 500, marginTop: 4 }}>
              Tu copiloto fiscal — te explica y acompaña paso a paso
            </div>
          </div>
        </div>
        <p style={{ fontSize: 15, color: T.txt, lineHeight: 1.6, marginTop: 0, marginBottom: 0 }}>
          Acá te ayudamos a <strong>entender y preparar tu declaración de renta</strong>. Tomamos los datos que
          ya cargaste, te explicamos en lenguaje simple cada parte, y al final tenés un borrador que{" "}
          <strong>tu contador puede revisar y ajustar</strong>. No tenés que ser experto: el agente te
          orienta en cada paso.
        </p>
      </div>

      {/* Disclaimer — claro pero no intimidatorio */}
      <div style={{ marginBottom: 20, padding: "16px 20px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.orange}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.6 }}>
            <strong style={{ color: T.orange, fontSize: 15, display: "block", marginBottom: 4 }}>
              Esto es un borrador, no la declaración final
            </strong>
            Te ayudamos a entender y proyectar tu declaración, pero <strong>tu contador siempre debe
            revisarla y firmarla antes de enviarla a la DIAN</strong>. FINPATHIA es una herramienta de
            apoyo, no reemplaza al asesor profesional.
          </div>
        </div>
      </div>

      {/* Mini-guía contextual según tipo de owner — alto contraste y lenguaje humano */}
      {!isJuridica ? (
        <div style={{ marginBottom: 20, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: 12 }}>
          <div style={{ fontSize: 16, color: T.txt, fontWeight: 700, marginBottom: 10 }}>
            👤 ¿Cómo funciona tu declaración?
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            En Colombia, las personas naturales pagamos impuesto según el tipo de plata que recibimos.
            La ley separa tus ingresos en <strong>"cédulas"</strong> (categorías) y cada una se calcula
            por separado:
          </div>
          <ul style={{ margin: "12px 0 0 0", paddingLeft: 22, color: T.txt, fontSize: 14, lineHeight: 1.8 }}>
            <li><strong>💼 Lo que ganaste con tu trabajo:</strong> sueldo, honorarios. Acá podés descontar cosas como medicina, vivienda, dependientes.</li>
            <li><strong>📈 Lo que ganaste con tu plata:</strong> intereses de CDT o cuentas. La ley te exime ~50% por inflación (es bastante).</li>
            <li><strong>🏠 Arriendos que cobraste:</strong> si tenés inmuebles arrendados.</li>
            <li><strong>📊 Dividendos:</strong> si te pagó plata una empresa donde sos socio.</li>
          </ul>
          <div style={{ marginTop: 14, padding: "10px 14px", background: T.bg3, borderRadius: 8, fontSize: 13, color: T.txt, lineHeight: 1.5 }}>
            💡 <strong>Tip:</strong> tocá el botón <span style={{ background: T.purple, padding: "2px 7px", borderRadius: 4, color: "#fff", fontWeight: 700, fontSize: 11 }}>💡</span> de cualquier fila para que te explique
            qué significa cada cosa, cuánto te conviene y por qué.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
          <div style={{ fontSize: 16, color: T.txt, fontWeight: 700, marginBottom: 10 }}>
            🏢 ¿Cómo funciona la declaración de tu empresa?
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            Las empresas pagan impuesto sobre la <strong>utilidad</strong> (lo que les sobra después de
            gastos). La fórmula simple es:
          </div>
          <div style={{ margin: "14px 0", padding: "12px 18px", background: T.bg3, borderRadius: 8, fontSize: 14, color: T.txt, fontWeight: 600, textAlign: "center" }}>
            Ingresos − Gastos = Utilidad &nbsp;→&nbsp; Impuesto = Utilidad × 35%
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            Hay <strong>palancas legales</strong> que la ley permite para reducir el impuesto. Las más
            comunes: provisión de cartera, capacitación certificada (descuenta 175%), IVA de activos
            productivos, depreciación de inmuebles arrendados. El agente las detecta automáticamente
            cuando aplican.
          </div>
        </div>
      )}

      {/* Selector owner + año */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Owner fiscal · Formulario {formulario}</label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, minWidth: 240 }}
            >
              {allOwners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.type === "juridica" ? "🏢" : "👤"} {o.name} · {o.type === "juridica" ? "F-110" : "F-210"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Año gravable</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13 }}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {overridesCount > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: T.purple, fontWeight: 600 }}>
                ✏️ {overridesCount} override{overridesCount > 1 ? "s" : ""} activo{overridesCount > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleResetTodos}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
              >
                ↺ Resetear todos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resumen final destacado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <ResumenCard label="Impuesto a cargo" value={impuestoCargo} color={T.red} />
        <ResumenCard label="Total retenciones" value={totalRetenciones} color={T.green} prefix="-" />
        <ResumenCard label="Saldo a pagar (mayo)" value={saldoFinal} color={T.blue} bold />
      </div>

      {/* Tabla de renglones por sección */}
      {renglonesPorSeccion.map(({ seccion, info, items }) => (
        <div key={seccion} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: info.color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>{info.icon}</span>
            <span>{info.label}</span>
          </div>
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {items.map((r, i) => {
              const isEditing = editingRenglon === r.numero;
              const isFormula = r.tipo === "formula";
              const hasOverride = !isFormula && Math.abs((r.valor || 0) - (r.auto || 0)) > 0.01;

              return (
                <div
                  key={r.numero}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto auto",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none",
                    background: r.destacado ? "rgba(59,130,246,0.04)" : "transparent",
                    gap: 12,
                  }}
                >
                  {/* Número renglón */}
                  <div style={{ fontSize: 11, color: T.txt3, fontWeight: 600, fontFamily: "monospace" }}>
                    {r.numero}
                  </div>

                  {/* Concepto */}
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: r.destacado ? T.txt : T.txt2,
                        fontWeight: r.destacado ? 700 : 500,
                        lineHeight: 1.4,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                      title={r.fuente ? "Viene de: " + r.fuente : ""}
                    >
                      <span>{r.concepto}</span>
                      {r.articulo && (
                        <span style={{ fontSize: 10, color: T.txt3, fontWeight: 500 }}>
                          ({r.articulo})
                        </span>
                      )}
                      {r.tip && (
                        <button
                          onClick={() => setShowTipFor(showTipFor === r.numero ? null : r.numero)}
                          style={{
                            background: showTipFor === r.numero ? "rgba(168,85,247,0.2)" : "transparent",
                            border: `1px solid ${showTipFor === r.numero ? T.purple : T.border}`,
                            color: T.purple,
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                          title="Ver tip educativo"
                        >
                          💡
                        </button>
                      )}
                    </div>
                    {r.fuente && !isFormula && (
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 2, fontStyle: "italic" }}>
                        ↳ {r.fuente}
                      </div>
                    )}
                    {/* Tip expandido */}
                    {r.tip && showTipFor === r.numero && (
                      <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
                        <span style={{ color: T.purple, fontWeight: 700, fontSize: 11, marginRight: 6 }}>💡 TIP:</span>
                        {r.tip}
                      </div>
                    )}
                  </div>

                  {/* Valor */}
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleGuardarEdit();
                          if (e.key === "Escape") setEditingRenglon(null);
                        }}
                        style={{ width: 160, background: T.bg3, border: `1px solid ${T.purple}`, borderRadius: 6, padding: "6px 10px", color: T.txt, fontSize: 13, textAlign: "right" }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      fontSize: r.destacado ? 15 : 13,
                      color: isFormula ? T.txt : (hasOverride ? T.purple : T.txt2),
                      fontWeight: r.destacado ? 800 : (hasOverride ? 700 : 500),
                      textAlign: "right",
                      fontFamily: "monospace",
                      minWidth: 160,
                    }}>
                      {hasOverride && <span style={{ fontSize: 11, marginRight: 4 }}>✏️</span>}
                      {fm(r.valor)}
                    </div>
                  )}

                  {/* Acción */}
                  <div style={{ minWidth: 90, textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={handleGuardarEdit}
                          style={{ background: T.green, color: "#000", border: "none", padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingRenglon(null)}
                          style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer" }}
                        >
                          ✕
                        </button>
                        {hasOverride && (
                          <button
                            onClick={() => handleResetear(r.numero)}
                            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "5px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer" }}
                            title="Volver a valor automático"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    ) : isFormula ? (
                      <span style={{ fontSize: 11, color: T.txt3, fontWeight: 600 }}>Σ</span>
                    ) : (
                      <button
                        onClick={() => handleEditar(r)}
                        style={{ background: "transparent", border: `1px solid ${T.border}`, color: hasOverride ? T.purple : T.txt2, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                      >
                        ✏️ {hasOverride ? "Editado" : "Editar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer info */}
      <div style={{ marginTop: 24, padding: 16, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
          <strong style={{ color: T.txt }}>💡 ¿Cómo usar este borrador?</strong>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, color: T.txt3 }}>
            <li>Los <strong style={{ color: T.txt2 }}>valores en gris</strong> vienen automáticamente de tus datos cargados (ingresos, gastos, inversiones, deudas)</li>
            <li>Los renglones <strong style={{ color: T.purple }}>en púrpura con ✏️</strong> son ediciones manuales tuyas o de tu contador</li>
            <li>Los <strong style={{ color: T.txt2 }}>totales (Σ)</strong> se recalculan automáticamente cuando cambia algún valor</li>
            <li>Tu contador puede ajustar cualquier renglón antes de presentar a DIAN (ej: gastos no cargados, sanciones, anticipos)</li>
            <li>El export PDF para enviar a tu contador llegará en próxima actualización</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResumenCard({ label, value, color, prefix = "", bold = false }) {
  return (
    <div style={{
      background: T.bg2,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "12px 16px",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: bold ? 22 : 18, fontWeight: bold ? 800 : 700, color, fontFamily: "monospace" }}>
        {prefix}{fm(value)}
      </div>
    </div>
  );
}
