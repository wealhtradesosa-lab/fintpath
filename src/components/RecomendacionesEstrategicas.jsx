// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · RecomendacionesEstrategicas.jsx · Sesión 1-may-2026
//
// UI del motor proactivo (recomendacionesEstrategicas.js).
//
// Renderiza cards de estrategias FUTURAS — la diferencia clave con las áreas
// del Plan de Optimización (que capturan lo que el user YA TIENE):
//
//   PLAN DE OPTIMIZACIÓN: "¿tenés gastos arriendo? cargalos" → ahorro hoy
//   RECOMENDACIONES:      "comprá bodega $500M, ahorrarás $103M/año" → mañana
//
// FILOSOFÍA UI:
//   - No hay botón "Aplicar" — son sugerencias para tu contador
//   - Cada card muestra inversión, ahorro, ROI, base legal
//   - Caveat siempre visible (ningún consejo sin "consultá con tu contador")
//   - Prioridad alta destaca en verde
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";

// Paleta consistente con DeclaracionFlow
const C = {
  bg: "#0a0a0a", bg2: "#141414", bg3: "#1a1a1a",
  txt: "#fff", txt2: "#a3a3a3", txt3: "#737373",
  border: "#262626",
  green: "#4ade80", greenBg: "rgba(74,222,128,0.1)",
  blue: "#60a5fa", blueBg: "rgba(96,165,250,0.1)",
  orange: "#fb923c", orangeBg: "rgba(251,146,60,0.1)",
  purple: "#a78bfa",
  red: "#f87171",
};

const PRIORIDAD_META = {
  alta:  { label: "Prioridad alta",  color: C.green,  bg: C.greenBg },
  media: { label: "Prioridad media", color: C.orange, bg: C.orangeBg },
  baja:  { label: "Prioridad baja",  color: C.txt3,   bg: C.bg3 },
};

function fmShort(n) {
  if (!n) return "$0";
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function fm(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Math.round(n).toLocaleString("es-CO");
}

// ─────────────────────────────────────────────────────────────────────────
// Card individual de una recomendación (expandible para ver detalle)
// ─────────────────────────────────────────────────────────────────────────

function RecomendacionCard({ rec, indice }) {
  const [expandida, setExpandida] = useState(false);
  const prio = PRIORIDAD_META[rec.prioridad] || PRIORIDAD_META.baja;
  const ahorroMonto = rec.ahorroAnual?.monto || 0;
  const inversionMonto = rec.inversion?.monto || 0;
  const roiPct = rec.roi?.porcentaje || 0;

  return (
    <div style={{
      background: C.bg2,
      border: `1.5px solid ${expandida ? prio.color : C.border}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Header clickeable */}
      <button
        onClick={() => setExpandida(!expandida)}
        style={{
          width: "100%", padding: "14px 16px", background: "transparent",
          border: "none", textAlign: "left", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: prio.bg, color: prio.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, flexShrink: 0,
        }}>
          {indice}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
            <span style={{ fontSize: 18 }}>{rec.icono}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>
              {rec.titulo}
            </span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 999,
              background: prio.bg, color: prio.color, fontWeight: 700,
            }}>
              {prio.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {ahorroMonto > 0 && (
              <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
                💚 Ahorro: {fmShort(ahorroMonto)}/año
              </span>
            )}
            {inversionMonto > 0 && (
              <span style={{ fontSize: 12, color: C.txt3 }}>
                · Inversión: {fmShort(inversionMonto)}
              </span>
            )}
            {roiPct > 0 && (
              <span style={{ fontSize: 12, color: C.blue }}>
                · ROI: {roiPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 14, color: C.txt3, transform: expandida ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          ▸
        </span>
      </button>

      {/* Detalle expandible */}
      {expandida && (
        <div style={{ padding: "0 16px 16px 60px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Descripción */}
          <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.5 }}>
            {rec.descripcion}
          </div>

          {/* Acción concreta */}
          {rec.accion && (
            <div style={{
              padding: "10px 12px", background: C.blueBg,
              border: `1px solid ${C.blue}40`, borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                🎯 Acción concreta
              </div>
              <div style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>
                {rec.accion}
              </div>
            </div>
          )}

          {/* Números */}
          {(inversionMonto > 0 || ahorroMonto > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {inversionMonto > 0 && (
                <div style={{ padding: "10px 12px", background: C.bg3, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Inversión necesaria
                  </div>
                  <div style={{ fontSize: 16, color: C.txt, fontWeight: 700, marginTop: 2 }}>
                    {fm(inversionMonto)}
                  </div>
                  {rec.inversion?.descripcion && (
                    <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
                      {rec.inversion.descripcion}
                    </div>
                  )}
                </div>
              )}
              {ahorroMonto > 0 && (
                <div style={{ padding: "10px 12px", background: C.greenBg, borderRadius: 8, border: `1px solid ${C.green}30` }}>
                  <div style={{ fontSize: 10, color: C.green, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Ahorro anual estimado
                  </div>
                  <div style={{ fontSize: 16, color: C.green, fontWeight: 700, marginTop: 2 }}>
                    {fm(ahorroMonto)}
                  </div>
                  {rec.ahorroAnual?.calculoDetallado && (
                    <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
                      {rec.ahorroAnual.calculoDetallado}
                    </div>
                  )}
                </div>
              )}
              {roiPct > 0 && (
                <div style={{ padding: "10px 12px", background: C.bg3, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    ROI fiscal
                  </div>
                  <div style={{ fontSize: 16, color: C.blue, fontWeight: 700, marginTop: 2 }}>
                    {roiPct.toFixed(1)}%
                  </div>
                  {rec.roi?.descripcion && (
                    <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
                      {rec.roi.descripcion}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Base legal */}
          <div style={{ fontSize: 11, color: C.txt3, fontStyle: "italic" }}>
            📚 Base legal: {rec.baseLegal}
          </div>

          {/* Caveat */}
          {rec.caveat && (
            <div style={{
              padding: "8px 12px", background: C.orangeBg,
              border: `1px solid ${C.orange}30`, borderRadius: 8,
              fontSize: 12, color: C.txt2, lineHeight: 1.5,
            }}>
              <strong style={{ color: C.orange }}>⚠️ Importante: </strong>
              {rec.caveat}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal: lista de recomendaciones para un owner
// ─────────────────────────────────────────────────────────────────────────

export default function RecomendacionesEstrategicas({ recomendaciones }) {
  if (!Array.isArray(recomendaciones) || recomendaciones.length === 0) {
    return null;
  }

  const ahorroTotal = recomendaciones.reduce((s, r) => s + (r.ahorroAnual?.monto || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Hero summary */}
      <div style={{
        padding: "14px 16px",
        background: `linear-gradient(135deg, ${C.greenBg}, ${C.blueBg})`,
        border: `1px solid ${C.green}40`,
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          💡 Estrategias del contador para vos
        </div>
        <div style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, marginBottom: 8 }}>
          Estas son <strong style={{ color: C.txt }}>acciones futuras</strong> que podés considerar para reducir tu impuesto.
          A diferencia de las palancas anteriores (que aprovechan lo que ya tenés),
          estas son <strong style={{ color: C.txt }}>movimientos estratégicos</strong> que un contador
          experto recomendaría para tu perfil.
        </div>
        {ahorroTotal > 0 && (
          <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
            Ahorro potencial combinado: {fm(ahorroTotal)}/año
          </div>
        )}
      </div>

      {/* Lista de recomendaciones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recomendaciones.map((rec, i) => (
          <RecomendacionCard key={rec.id || i} rec={rec} indice={i + 1} />
        ))}
      </div>

      {/* Footer disclaimer */}
      <div style={{
        padding: "10px 14px", background: C.bg3,
        border: `1px solid ${C.border}`, borderRadius: 8,
        fontSize: 11, color: C.txt3, lineHeight: 1.5,
      }}>
        <strong style={{ color: C.txt2 }}>Importante:</strong> Estas son sugerencias estratégicas
        basadas en tu perfil. La implementación real requiere asesoría profesional —
        cada caso tiene matices contables, legales y financieros que solo un contador
        con conocimiento integral de tu situación puede evaluar. FINPATHIA no reemplaza
        a tu contador, lo complementa.
      </div>
    </div>
  );
}
