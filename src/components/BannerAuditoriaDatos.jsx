// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BannerAuditoriaDatos.jsx
//
// PROPÓSITO:
//   Componente que muestra al user los hallazgos del auditor de datos en un
//   formato accesible. Cada hallazgo es una tarjeta con:
//   - Severidad visual (error rojo, warning naranja, info azul)
//   - Título humano + mensaje + sugerencia
//   - Botón de acción concreto para resolver el problema
//
// FILOSOFÍA:
//   - El user nunca debe sentirse perdido: siempre hay un botón claro
//   - Mensajes en lenguaje humano (no jerga)
//   - Colapsado por default si todo está OK; expandido si hay problemas
//   - Cada categoría se puede colapsar individualmente
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { auditarDatos } from "../lib/auditoriaDatos.js";

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
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.10)",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
};

const SEVERIDAD = {
  error: { color: C.red, bg: C.redBg, icon: "❌", label: "Error" },
  warning: { color: C.orange, bg: C.orangeBg, icon: "⚠️", label: "Atención" },
  info: { color: C.blue, bg: C.blueBg, icon: "💡", label: "Sugerencia" },
};

/**
 * Banner inline que muestra hallazgos del auditor de datos.
 *
 * @param {object} user - User completo
 * @param {function} onAccion - Callback (accion) => void para resolver hallazgos
 * @param {function} onAbrirWizard - Callback para abrir el wizard
 */
export default function BannerAuditoriaDatos({ user, onAccion, onAbrirWizard }) {
  const [expandido, setExpandido] = useState(true);
  const [seccionExpandida, setSeccionExpandida] = useState({ errores: true, faltantes: true, advertencias: false, oportunidades: false });

  const auditoria = useMemo(() => auditarDatos(user), [user]);
  const { errores, advertencias, oportunidadesData, faltantes, resumen, total } = auditoria;

  // Si todo está OK, mostrar banner verde compacto
  if (total === 0) {
    return (
      <div style={{
        marginBottom: 16,
        padding: "14px 18px",
        background: C.greenBg,
        border: `1px solid ${C.green}40`,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>Auditoría: todo en orden</div>
          <div style={{ fontSize: 12, color: C.txt2, marginTop: 2 }}>
            Tu data está completa y consistente. Listo para calcular impuestos.
          </div>
        </div>
      </div>
    );
  }

  // Color del header según severidad máxima
  const headerColor = errores.length > 0 ? C.red : (advertencias.length > 0 || faltantes.length > 0) ? C.orange : C.blue;
  const headerBg = errores.length > 0 ? C.redBg : (advertencias.length > 0 || faltantes.length > 0) ? C.orangeBg : C.blueBg;

  return (
    <div style={{
      marginBottom: 20,
      background: C.bg2,
      border: `1.5px solid ${headerColor}40`,
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpandido(!expandido)}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: headerBg,
          border: "none",
          borderBottom: expandido ? `1px solid ${C.border}` : "none",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24 }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: headerColor, letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>
            Auditoría del Contador IA
          </div>
          <div style={{ fontSize: 14, color: C.txt, fontWeight: 700, lineHeight: 1.4 }}>
            {resumen.mensaje}
          </div>
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
            {errores.length > 0 && <span style={{ color: C.red, marginRight: 12 }}>{errores.length} error{errores.length > 1 ? "es" : ""}</span>}
            {(advertencias.length + faltantes.length) > 0 && <span style={{ color: C.orange, marginRight: 12 }}>{advertencias.length + faltantes.length} para revisar</span>}
            {oportunidadesData.length > 0 && <span style={{ color: C.blue }}>{oportunidadesData.length} oportunidad{oportunidadesData.length > 1 ? "es" : ""}</span>}
          </div>
        </div>
        <span style={{ fontSize: 18, color: C.txt2, transform: expandido ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {/* Contenido expandido */}
      {expandido && (
        <div style={{ padding: "16px 20px" }}>
          {/* Errores críticos primero */}
          {errores.length > 0 && (
            <Seccion
              titulo="Errores que impiden el cálculo"
              color={C.red}
              icon="🚨"
              hallazgos={errores}
              expandido={seccionExpandida.errores}
              onToggle={() => setSeccionExpandida(s => ({ ...s, errores: !s.errores }))}
              onAccion={onAccion}
              onAbrirWizard={onAbrirWizard}
            />
          )}

          {/* Faltantes */}
          {faltantes.length > 0 && (
            <Seccion
              titulo="Datos importantes que faltan"
              color={C.orange}
              icon="📋"
              hallazgos={faltantes}
              expandido={seccionExpandida.faltantes}
              onToggle={() => setSeccionExpandida(s => ({ ...s, faltantes: !s.faltantes }))}
              onAccion={onAccion}
              onAbrirWizard={onAbrirWizard}
            />
          )}

          {/* Advertencias */}
          {advertencias.length > 0 && (
            <Seccion
              titulo="Inconsistencias para revisar"
              color={C.orange}
              icon="⚠️"
              hallazgos={advertencias}
              expandido={seccionExpandida.advertencias}
              onToggle={() => setSeccionExpandida(s => ({ ...s, advertencias: !s.advertencias }))}
              onAccion={onAccion}
              onAbrirWizard={onAbrirWizard}
            />
          )}

          {/* Oportunidades de mejorar la data */}
          {oportunidadesData.length > 0 && (
            <Seccion
              titulo="Oportunidades de optimización (necesitan más data)"
              color={C.blue}
              icon="💡"
              hallazgos={oportunidadesData}
              expandido={seccionExpandida.oportunidades}
              onToggle={() => setSeccionExpandida(s => ({ ...s, oportunidades: !s.oportunidades }))}
              onAccion={onAccion}
              onAbrirWizard={onAbrirWizard}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sección colapsable de hallazgos
// ─────────────────────────────────────────────────────────────────────────

function Seccion({ titulo, color, icon, hallazgos, expandido, onToggle, onAccion, onAbrirWizard }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${C.border}`,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, flex: 1 }}>
          {titulo} ({hallazgos.length})
        </span>
        <span style={{ fontSize: 14, color: C.txt2 }}>{expandido ? "▾" : "▸"}</span>
      </button>
      {expandido && (
        <div style={{ paddingTop: 10 }}>
          {hallazgos.map(h => <Hallazgo key={h.id} hallazgo={h} onAccion={onAccion} onAbrirWizard={onAbrirWizard} />)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tarjeta individual de hallazgo
// ─────────────────────────────────────────────────────────────────────────

function Hallazgo({ hallazgo, onAccion, onAbrirWizard }) {
  const sev = SEVERIDAD[hallazgo.severidad] || SEVERIDAD.info;

  // Texto del botón de acción según el tipo
  const textoBoton = (() => {
    switch (hallazgo.accion?.tipo) {
      case "asignar_owner_ingresos":
      case "asignar_owner_deudas":
      case "asignar_owner_inversiones":
      case "asignar_owner_gastos":
        return "Asignar titular fiscal";
      case "abrir_wizard":
        return "Resolver en wizard paso a paso";
      case "editar_owner":
        return "Editar persona fiscal";
      case "editar_deuda":
        return "Editar deuda";
      case "agregar_gasto":
        return "Agregar gasto";
      default:
        return null;
    }
  })();

  const handleClick = () => {
    if (hallazgo.accion?.tipo === "abrir_wizard") {
      onAbrirWizard?.();
    } else if (onAccion) {
      onAccion(hallazgo);
    }
  };

  return (
    <div style={{
      padding: "12px 14px",
      background: sev.bg,
      border: `1px solid ${sev.color}30`,
      borderLeft: `3px solid ${sev.color}`,
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{sev.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
            {hallazgo.titulo}
          </div>
          <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5, marginBottom: 6 }}>
            {hallazgo.mensaje}
          </div>
          {hallazgo.sugerencia && (
            <div style={{ fontSize: 11, color: C.txt3, lineHeight: 1.5, fontStyle: "italic", marginBottom: hallazgo.items || textoBoton ? 8 : 0 }}>
              💬 {hallazgo.sugerencia}
            </div>
          )}

          {/* Lista de items afectados (compacta) */}
          {hallazgo.items && hallazgo.items.length > 0 && (
            <div style={{ marginBottom: 8, padding: "6px 10px", background: C.bg3, borderRadius: 6, fontSize: 11, color: C.txt2 }}>
              {hallazgo.items.slice(0, 3).map((it, i) => (
                <div key={i} style={{ marginBottom: i < Math.min(hallazgo.items.length, 3) - 1 ? 2 : 0 }}>
                  • {it.label}{it.mensual ? ` ($${Number(it.mensual).toLocaleString()}/mes)` : ""}{it.monto ? ` ($${Number(it.monto).toLocaleString()})` : ""}{it.valor ? ` ($${Number(it.valor).toLocaleString()})` : ""}
                </div>
              ))}
              {hallazgo.items.length > 3 && (
                <div style={{ color: C.txt3, marginTop: 2 }}>... y {hallazgo.items.length - 3} más</div>
              )}
            </div>
          )}

          {textoBoton && (
            <button
              onClick={handleClick}
              style={{
                padding: "6px 12px",
                background: sev.color,
                border: "none",
                borderRadius: 6,
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {textoBoton} →
            </button>
          )}

          {hallazgo.ahorroEstimado && (
            <div style={{ marginTop: 6, fontSize: 11, color: C.green, fontWeight: 600 }}>
              💰 Ahorro potencial: hasta ${Number(hallazgo.ahorroEstimado).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
