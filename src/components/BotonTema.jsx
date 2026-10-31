import { useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * 31-oct-2026 — Día / noche (Santiago lo pidió varias veces). Cambia el
 * atributo data-tema del <html>; los colores viven en src/tema.css. Se
 * recuerda en este navegador (fp3_tema) y index.html lo aplica antes de
 * pintar, para que no parpadee al abrir.
 */
export const temaActual = () => {
  try { return document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro"; } catch { return "oscuro"; }
};

export default function BotonTema() {
  const [tema, setTema] = useState(temaActual);
  const cambiar = () => {
    const nuevo = tema === "claro" ? "oscuro" : "claro";
    try {
      if (nuevo === "claro") document.documentElement.setAttribute("data-tema", "claro");
      else document.documentElement.removeAttribute("data-tema");
      localStorage.setItem("fp3_tema", nuevo);
    } catch { /* sin almacenamiento: igual cambia en esta visita */ }
    setTema(nuevo);
  };
  const claro = tema === "claro";
  return (
    <button type="button" onClick={cambiar} aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"} title={claro ? "Modo oscuro" : "Modo claro"}
      style={{ background: "rgba(var(--fp-ink),0.06)", border: "1px solid rgba(var(--fp-ink),0.12)", color: "var(--fp-txt)", padding: "5px 9px", borderRadius: 8, cursor: "pointer", fontSize: 14, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>
      {claro ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
    </button>
  );
}
