import { useState } from "react";

// Aviso de una sola vez: el cálculo de ingreso pasivo dejó de contar bonos y
// primas (laborales). Solo guarda un flag en localStorage; sin montos ni IDs.
export const AVISO_NIVEL_KEY = "fp3_aviso_bonos_primas_v1";
export const AVISO_NIVEL_TEXTO =
  "Ajustamos el cálculo: los bonos y primas ya no cuentan como ingreso pasivo. Por eso tu nivel puede cambiar.";

export function marcarAvisoNivelVisto() {
  try { localStorage.setItem(AVISO_NIVEL_KEY, "1"); } catch { /* modo privado */ }
}

export function yaVisto() {
  try { return localStorage.getItem(AVISO_NIVEL_KEY) === "1"; } catch { return false; }
}

export default function AvisoCambioNivel({ T = {} }) {
  const [visible, setVisible] = useState(() => !yaVisto());
  if (!visible) return null;
  const cerrar = () => {
    marcarAvisoNivelVisto();
    setVisible(false);
  };
  return (
    <div role="status" data-testid="aviso-cambio-nivel" style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, lineHeight: 1.5, color: T.tx2 || "var(--fp-txt)" }}>
      <span style={{ flex: 1 }}>{AVISO_NIVEL_TEXTO}</span>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
    </div>
  );
}
