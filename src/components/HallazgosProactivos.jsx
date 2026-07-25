import { useState, useEffect } from "react";

/**
 * HallazgosProactivos — El asesor habla primero.
 *
 * Hasta hoy FINPATHIA mostraba números y el trabajo de interpretarlos era del
 * usuario. Este bloque invierte la carga: al abrir el dashboard, lo que el
 * motor encontró ya está dicho, ordenado por plata y con su respaldo.
 *
 * Silencio deliberado: si no hay hallazgos, no renderiza nada. Un asesor que
 * habla todos los días aunque no pase nada se vuelve ruido y deja de leerse.
 */
export default function HallazgosProactivos({ hallazgos = [], fmt, T, onIr, onDescartar }) {
  const [abierto, setAbierto] = useState(null);

  if (!hallazgos.length) return null;

  const colorTono = (t) => (t === "riesgo" ? "#eab308" : "#22c55e");

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {/* 25-jul-2026 (Santiago): "Lo que veo en tus números" era tibio y no
            decía quién habla. "Tu family office" nombra al que analiza y usa
            "tu" —no "nuestro"—: el asesor trabaja para el usuario, no es una
            función de la que la empresa es dueña. */}
        <span style={{ fontSize: 16 }}>🤖</span>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: T.tx }}>
          Tu family office analizó tus números
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.tx3, marginBottom: 14 }}>
        Lo que encontró, ordenado por impacto
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {hallazgos.map((h, i) => {
          const esta = abierto === h.id;
          return (
            <div key={h.id} style={{
              background: T.bg3,
              borderRadius: 10,
              padding: "12px 14px",
              borderLeft: `3px solid ${colorTono(h.tono)}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, lineHeight: 1.4 }}>
                    {i + 1}. {h.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: T.tx2, marginTop: 4, lineHeight: 1.55 }}>
                    {h.detalle}
                  </div>

                  {h.impactoAnual > 0 && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: colorTono(h.tono), marginTop: 6 }}>
                      {fmt(h.impactoAnual)} al año
                    </div>
                  )}

                  {/* El respaldo: sin esto sería una opinión, no un hallazgo */}
                  {esta && (
                    <div style={{ fontSize: 11, color: T.tx3, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}`, lineHeight: 1.5 }}>
                      <strong style={{ color: T.tx2 }}>De dónde sale:</strong> {h.base}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                    {h.accion && (
                      <button onClick={() => onIr && onIr(h.accion.pagina)} style={{
                        background: "transparent", border: "none", padding: 0,
                        color: colorTono(h.tono), fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}>
                        {h.accion.label} →
                      </button>
                    )}
                    <button onClick={() => setAbierto(esta ? null : h.id)} style={{
                      background: "transparent", border: "none", padding: 0,
                      color: T.tx3, fontSize: 12, cursor: "pointer",
                    }}>
                      {esta ? "Ocultar respaldo" : "¿De dónde sale?"}
                    </button>
                    <button onClick={() => onDescartar && onDescartar(h.id)} style={{
                      background: "transparent", border: "none", padding: 0,
                      color: T.tx3, fontSize: 12, cursor: "pointer",
                    }}>
                      Ya lo sé
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
