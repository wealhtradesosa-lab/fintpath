// Envoltura de las calculadoras con el botón "Exportar PDF" (5-nov-2026).
// Santiago: "las secciones de las calculadoras deberían poder exportarse en PDF".
import { useRef } from "react";
import { FileDown } from "lucide-react";
import { exportarCalculadoraPDF } from "../lib/exportarCalculadoraPDF.js";

export default function CalculadoraPDF({ titulo, subtitulo, en = false, children }) {
  const ref = useRef(null);
  return (
    <div>
      <div data-no-print style={{ display: "flex", justifyContent: "flex-end", maxWidth: 1100, margin: "0 auto 8px" }}>
        <button
          type="button"
          onClick={() => exportarCalculadoraPDF(ref.current, { titulo, subtitulo })}
          title={en ? "Opens the print dialog: choose “Save as PDF”" : "Abre el diálogo de impresión: elige «Guardar como PDF»"}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", color: "var(--fp-txt)", border: "1px solid rgba(var(--fp-ink),0.15)", padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
        >
          <FileDown size={16} aria-hidden="true" /> {en ? "Export PDF" : "Exportar PDF"}
        </button>
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}
