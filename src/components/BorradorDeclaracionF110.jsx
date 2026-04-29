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
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
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
          mostrándote escenarios y oportunidades específicas para tu caso. Cada renglón del formulario{" "}
          <strong style={{ color: T.txt }}>{formulario}</strong>{" "}
          es <strong style={{ color: T.txt }}>editable</strong>: tú o tu contador pueden ajustar los valores
          y los totales recalculan en vivo.{" "}
          {!isJuridica && (
            <span style={{ color: T.purple, fontWeight: 600 }}>
              Pasá el cursor sobre cualquier renglón para ver tips contextuales que te orientan paso a paso.
            </span>
          )}
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

      {/* Mini-guía contextual según tipo de owner */}
      {!isJuridica ? (
        <div style={{ marginBottom: 20, padding: "16px 20px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: T.green, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            👤 Cómo leer este borrador F-210 (persona natural)
          </div>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
            El F-210 trabaja con <strong style={{ color: T.txt }}>cédulas</strong>: cada tipo de ingreso
            tributa por separado. Vas a ver:
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
              <li><strong style={{ color: T.green }}>💼 Cédula General (Trabajo):</strong> tu salario y honorarios. Acá aplican deducciones (dependientes, vivienda, medicina, AFC).</li>
              <li><strong style={{ color: T.gold }}>📈 Cédula de Capital:</strong> intereses CDT, fondos. Tip: el componente inflacionario te exime ~50% de los intereses.</li>
              <li><strong style={{ color: "#06b6d4" }}>🏠 Cédula No Laboral:</strong> arriendos. Tributan a parte sin las deducciones del trabajo.</li>
              <li><strong style={{ color: "#eab308" }}>📊 Cédula Dividendos:</strong> dividendos recibidos. Tarifa especial.</li>
            </ul>
            <div style={{ marginTop: 8, color: T.txt3, fontSize: 11 }}>
              💡 Click en el botón <span style={{ background: "rgba(168,85,247,0.15)", padding: "1px 5px", borderRadius: 3, color: T.purple, fontWeight: 700 }}>💡</span> de cualquier renglón para ver tips específicos.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, padding: "16px 20px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: T.purple, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            🏢 Cómo leer este borrador F-110 (persona jurídica)
          </div>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
            El F-110 calcula utilidad fiscal: <strong style={{ color: T.txt }}>Ingresos − Costos − Gastos = Renta líquida</strong>,
            que se grava al 35% (ordinario). Las palancas legales para reducir el impuesto incluyen:
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 20 }}>
              <li><strong>Provisión cartera</strong> (Art. 145 ET): hasta 33% deducible</li>
              <li><strong>Capacitación 175%</strong> (Art. 158-1): si está certificada SENA</li>
              <li><strong>IVA activos productivos</strong> (Art. 258-2): descuento del impuesto</li>
              <li><strong>Depreciación inmuebles arrendados</strong> (Art. 128-141): vida útil 45 años</li>
            </ul>
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
