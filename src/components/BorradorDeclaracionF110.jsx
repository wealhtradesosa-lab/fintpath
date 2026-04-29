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
import { generarBorradorF110, aplicarOverride, SECCIONES_F110 } from "../lib/borradorDeclaracion.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f59e0b", red: "#ef4444", gold: "#eab308",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function BorradorDeclaracionF110({ user, estimacion, onUpdateUser }) {
  // Owners jurídicas disponibles
  const ownersJur = useMemo(() => {
    return (user?.owners || []).filter(o => o.type === "juridica");
  }, [user]);

  const [selectedOwnerId, setSelectedOwnerId] = useState(ownersJur[0]?.id || "");
  const [ano, setAno] = useState(2025);
  const [editingRenglon, setEditingRenglon] = useState(null); // numero del renglón en edición
  const [editValue, setEditValue] = useState("");

  const selectedOwner = ownersJur.find(o => o.id === selectedOwnerId);

  // Generar renglones (recalculado automáticamente cuando user cambia)
  const renglones = useMemo(() => {
    if (!selectedOwner) return null;
    return generarBorradorF110(user, selectedOwner, estimacion, ano);
  }, [user, selectedOwner, estimacion, ano]);

  if (ownersJur.length === 0) {
    return (
      <div style={{ padding: "24px 0" }}>
        {/* Header del Agente Tributario IA */}
        <div style={{ marginBottom: 20, padding: "20px 24px", background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(59,130,246,0.06) 100%)", border: `1px solid ${T.purple}40`, borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>🤖</span>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
                Agente Tributario IA
              </h2>
              <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                Tu copiloto fiscal con IA
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje específico para personas naturales / sin sociedad */}
        <div style={{ padding: "32px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.txt, marginBottom: 12 }}>
            ¿Sos persona natural? Próximamente acá
          </h3>
          <p style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 20px" }}>
            El Agente Tributario IA hoy genera el <strong style={{ color: T.txt }}>borrador F-110</strong> para
            sociedades (SAS, Ltda, etc). El borrador <strong style={{ color: T.txt }}>F-210 para personas
            naturales</strong> con cédulas (laboral, pensión, capital, no laboral, dividendos) está en
            desarrollo y llega en próxima actualización.
          </p>
          <div style={{ padding: "16px 20px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, maxWidth: 520, margin: "0 auto" }}>
            <div style={{ fontSize: 13, color: T.txt, fontWeight: 700, marginBottom: 6 }}>
              💡 Mientras tanto, podés usar:
            </div>
            <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6, textAlign: "left" }}>
              <strong style={{ color: T.blue }}>📊 Calculadora</strong> — wizard paso a paso que te guía
              con preguntas, te explica cada concepto y calcula tu impuesto natural con base en tus datos
              cargados.
              <br /><br />
              <strong style={{ color: T.blue }}>🏛️ Declaraciones históricas</strong> — subí tus F-210
              anteriores y te detectamos diferencias, oportunidades y errores comunes.
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.txt3, marginTop: 16, fontStyle: "italic" }}>
            Si tenés una SAS o sociedad cargada, aparecerá automáticamente acá.
          </p>
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

  // Agrupar renglones por sección
  const seccionesOrden = ["patrimonio", "ingresos", "costos", "renta", "impuesto", "liquidacion"];
  const renglonesPorSeccion = seccionesOrden.map(sec => ({
    seccion: sec,
    info: SECCIONES_F110[sec],
    items: renglones.filter(r => r.seccion === sec),
  }));

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header con branding "Agente Tributario IA" */}
      <div style={{ marginBottom: 20, padding: "20px 24px", background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(59,130,246,0.06) 100%)", border: `1px solid ${T.purple}40`, borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🤖</span>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
              Agente Tributario IA
            </h2>
            <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
              Tu copiloto fiscal con IA
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
          Esta sección utiliza <strong style={{ color: T.txt }}>inteligencia artificial</strong> para
          proyectar y calcular tu declaración a partir de los datos que cargaste. Te ofrece{" "}
          <strong style={{ color: T.txt }}>estrategias y opciones para optimizar tus impuestos legalmente</strong>,
          mostrándote escenarios y oportunidades específicas para tu caso. Cada renglón del formulario F-110
          es <strong style={{ color: T.txt }}>editable</strong>: tú o tu contador pueden ajustar los valores
          y los totales recalculan en vivo.
        </p>
      </div>

      {/* Disclaimer destacado */}
      <div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.30)`, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
            <strong style={{ color: T.orange, fontSize: 13 }}>Importante — leé esto:</strong>
            <br />
            Este es un <strong style={{ color: T.txt }}>borrador proyectado por IA</strong>, NO es un
            resultado final ni una recomendación contable definitiva. <strong style={{ color: T.txt }}>Debe
            ser revisado y validado por tu contador</strong> antes de presentar a DIAN. FINPATHIA es una
            herramienta de apoyo: no reemplaza el asesoramiento profesional de un contador certificado, ni
            asume responsabilidad sobre decisiones fiscales tomadas con base en estas proyecciones.
          </div>
        </div>
      </div>

      {/* Selector owner + año */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Sociedad</label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, minWidth: 220 }}
            >
              {ownersJur.map(o => (
                <option key={o.id} value={o.id}>🏢 {o.name}</option>
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
                      }}
                      title={r.fuente ? "Viene de: " + r.fuente : ""}
                    >
                      {r.concepto}
                      {r.articulo && (
                        <span style={{ fontSize: 10, color: T.txt3, marginLeft: 6, fontWeight: 500 }}>
                          ({r.articulo})
                        </span>
                      )}
                    </div>
                    {r.fuente && !isFormula && (
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 2, fontStyle: "italic" }}>
                        ↳ {r.fuente}
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
