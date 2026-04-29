// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · TerminoTributario.jsx
//
// PROPÓSITO:
//   Componente inline que muestra un término técnico tributario con un
//   ícono ❓ que despliega su explicación al hover/click.
//
// USO:
//   <TerminoTributario clave="uvt">UVT</TerminoTributario>
//   <TerminoTributario clave="rentaExenta">renta exenta</TerminoTributario>
//
// COMPORTAMIENTO:
//   - Texto base subrayado punteado (indica que es interactivo)
//   - Click o hover → despliega tooltip con explicación + ejemplo
//   - El tooltip se posiciona automáticamente arriba o abajo según espacio
//   - Click fuera → cierra el tooltip
//   - Esc → cierra el tooltip
//
// FILOSOFÍA DE DISEÑO:
//   - Discreto pero descubrible (no abruma al user experto)
//   - Alto contraste cuando se abre (no se confunde con el texto)
//   - Mobile-friendly (tap-to-show)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";
import { obtenerTermino } from "../lib/glosario.js";

const STYLES = {
  trigger: {
    color: "#a78bfa",
    cursor: "help",
    borderBottom: "1px dotted #a78bfa",
    paddingBottom: 1,
    background: "transparent",
    border: "none",
    padding: 0,
    font: "inherit",
    display: "inline",
  },
  tooltip: {
    position: "absolute",
    background: "#1f1f24",
    border: "1.5px solid rgba(196,181,253,0.40)",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 1.55,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)",
    zIndex: 10000,
    minWidth: 280,
    maxWidth: 360,
    fontWeight: 400,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  termino: {
    fontSize: 14,
    fontWeight: 700,
    color: "#c4b5fd",
  },
  nombreCompleto: {
    fontSize: 11,
    color: "#a1a1aa",
    fontStyle: "italic",
  },
  explicacion: {
    color: "#e4e4e7",
    fontSize: 13,
    marginBottom: 6,
  },
  ejemplo: {
    background: "rgba(74,222,128,0.10)",
    border: "1px solid rgba(74,222,128,0.25)",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    color: "#d4d4d8",
    marginTop: 8,
  },
  ejemploLabel: {
    color: "#4ade80",
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  closeBtn: {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    color: "#a1a1aa",
    cursor: "pointer",
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
  },
};

/**
 * Componente inline que muestra un término tributario con tooltip.
 *
 * @param {string} clave - Clave del término en glosario.js (ej: "uvt", "afc")
 * @param {ReactNode} children - El texto visible (puede ser distinto del término)
 * @param {string} placement - "top" | "bottom" (auto si no se especifica)
 */
export default function TerminoTributario({ clave, children, placement }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, place: "bottom" });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const data = obtenerTermino(clave);

  // Calcular posición cuando se abre
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipH = 180; // estimación
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const place = placement || (spaceBelow >= tooltipH || spaceBelow > spaceAbove ? "bottom" : "top");

    let top = place === "bottom" ? rect.bottom + 8 : rect.top - 8;
    let left = rect.left;

    // Si se sale por la derecha, ajustar
    const tooltipW = 340;
    if (left + tooltipW > window.innerWidth - 16) {
      left = window.innerWidth - tooltipW - 16;
    }
    if (left < 16) left = 16;

    setCoords({ top, left, place });
  }, [open, placement]);

  // Click fuera cierra
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (tooltipRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  // Si no encontramos el término en el glosario, renderizar children sin tooltip
  if (!data) {
    return <span>{children}</span>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={(e) => {
          // No cerrar si el mouse va hacia el tooltip
          const related = e.relatedTarget;
          if (related && tooltipRef.current?.contains(related)) return;
          setTimeout(() => {
            // Verificar si el mouse no está sobre el tooltip
            if (tooltipRef.current && !tooltipRef.current.matches(":hover")) {
              setOpen(false);
            }
          }, 100);
        }}
        style={STYLES.trigger}
        aria-label={`Definición de ${data.termino || clave}`}
      >
        {children}
        <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>ⓘ</span>
      </button>

      {open && (
        <div
          ref={tooltipRef}
          style={{
            ...STYLES.tooltip,
            top: coords.top,
            left: coords.left,
            transform: coords.place === "top" ? "translateY(-100%)" : "none",
          }}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={STYLES.header}>
            <span style={STYLES.termino}>{data.termino || clave}</span>
            {data.nombreCompleto && (
              <span style={STYLES.nombreCompleto}>{data.nombreCompleto}</span>
            )}
            <button
              onClick={() => setOpen(false)}
              style={STYLES.closeBtn}
              aria-label="Cerrar"
              title="Cerrar (Esc)"
            >
              ✕
            </button>
          </div>
          <div style={STYLES.explicacion}>{data.explicacion}</div>
          {data.ejemplo && (
            <div style={STYLES.ejemplo}>
              <div style={STYLES.ejemploLabel}>Ejemplo</div>
              {data.ejemplo}
            </div>
          )}
        </div>
      )}
    </>
  );
}
