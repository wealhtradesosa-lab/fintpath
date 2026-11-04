/**
 * 31-oct-2026 — Una sola barra arriba para pantallas que son pasos de un mismo
 * recorrido (Este año → Año entrante → 10 años; Asesor → Coaches). Las rutas
 * no cambian: cambia que se vean como un camino y no como secciones sueltas.
 */
import { tx } from "../lib/region.js";

// 3-nov-2026: los textos se leen al pintar (getters), en el idioma de la sesión.
// "Año entrante" decía 2027 fijo; ahora es el año siguiente al actual.
const paso = (ids, go, l, s) => ({ ids, go, get l() { return tx(l[0], l[1]); }, get s() { return tx(s[0], s[1]); } });
export const RECORRIDOS = {
  horizonte: { get titulo() { return tx("Tu plan en el tiempo", "Your plan over time"); }, pasos: [
    paso(["flujo", "sim"], "flujo", ["Este año", "This year"], ["mes a mes y simulador", "month by month and simulator"]),
    { ids: ["simf"], go: "simf", get l() { return tx("Año entrante", "Next year"); }, get s() { const y = new Date().getFullYear() + 1; return tx(`lo que viene en ${y}`, `what's coming in ${y}`); } },
    paso(["f10", "f10crear", "f10esc", "plan"], "f10", ["10 años", "10 years"], ["tus escenarios", "your scenarios"]),
  ] },
  ia: { get titulo() { return tx("Asesor IA", "AI Advisor"); }, pasos: [
    paso(["asesor"], "asesor", ["Pregúntale", "Ask it"], ["lo que quieras, en un chat", "anything, in a chat"]),
    paso(["coach"], "coach", ["Tu equipo de asesores", "Your advisory team"], ["cinco miradas a tu plata", "five takes on your money"]),
  ] },
};

export const recorridoDe = (pg) => Object.keys(RECORRIDOS).find((k) => RECORRIDOS[k].pasos.some((p) => p.ids.includes(pg))) || null;

export default function NavRecorrido({ pg, setPg, mb }) {
  const k = recorridoDe(pg);
  if (!k) return null;
  const r = RECORRIDOS[k];
  return (
    <nav aria-label={r.titulo} style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
      {r.pasos.map((p, i) => {
        const on = p.ids.includes(pg);
        return (
          <button key={p.go} type="button" onClick={() => setPg(p.go)} aria-current={on ? "page" : undefined}
            style={{ flex: "1 1 0", minWidth: mb ? 104 : 150, textAlign: "left", padding: mb ? "8px 10px" : "10px 14px", borderRadius: 12, cursor: "pointer",
              border: `1px solid ${on ? "rgba(0,200,5,0.45)" : "rgba(var(--fp-ink),0.08)"}`, background: on ? "rgba(0,200,5,0.10)" : "rgba(var(--fp-ink),0.02)", color: "var(--fp-txt)" }}>
            <div style={{ fontSize: 11, color: on ? "#00c805" : "var(--fp-txt3)", fontWeight: 700, letterSpacing: 0.5 }}>{k === "horizonte" ? tx(`PASO ${i + 1}`, `STEP ${i + 1}`) : ""}{k === "horizonte" && i < r.pasos.length - 1 ? " →" : ""}</div>
            <div style={{ fontSize: mb ? 13 : 14, fontWeight: 700 }}>{p.l}</div>
            {!mb && <div style={{ fontSize: 12, color: "var(--fp-txt3)" }}>{p.s}</div>}
          </button>
        );
      })}
    </nav>
  );
}
