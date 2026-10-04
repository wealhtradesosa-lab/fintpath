// 4-oct-2026 — "Hay una versión nueva". Santiago vio un bug ya corregido
// porque su pestaña seguía ejecutando el bundle anterior al deploy: la app es
// de una sola página y no se entera de que Netlify publicó otra versión.
// Cada 5 minutos (y al volver a la pestaña) se pide index.html sin caché y se
// compara el nombre del bundle principal (lleva hash). Si cambió, se muestra
// un aviso fijo con el botón de recargar. No recarga solo: podría estar en
// medio de un formulario.
import { useEffect, useState } from "react";
import { C, Cα, R } from "../lib/designTokens";

const bundleActual = () => {
  const s = Array.from(document.scripts).find((x) => /\/assets\/main-[^/]+\.js/.test(x.src || ""));
  return s ? s.src.replace(/^.*\/assets\//, "") : null;
};

export default function AvisoVersion() {
  const [nueva, setNueva] = useState(false);
  useEffect(() => {
    const propio = bundleActual();
    if (!propio) return;
    let vivo = true;
    const revisar = async () => {
      try {
        const html = await (await fetch("/?v=" + Date.now(), { cache: "no-store" })).text();
        const m = html.match(/\/assets\/(main-[^"']+\.js)/);
        if (vivo && m && m[1] !== propio) setNueva(true);
      } catch {}
    };
    const t = setInterval(revisar, 5 * 60 * 1000);
    const onFocus = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", onFocus);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", onFocus); };
  }, []);
  if (!nueva) return null;
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      background: C.surface, border: `1px solid ${Cα.accent25}`, borderRadius: R.lg, padding: "10px 14px",
      display: "flex", gap: 12, alignItems: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontSize: 13, color: C.text }}>
      <span>Hay una versión nueva de FINPATHIA.</span>
      <button onClick={() => window.location.reload()}
        style={{ background: C.accent, color: "#fff", border: "none", borderRadius: R.md, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
        Recargar
      </button>
    </div>
  );
}
