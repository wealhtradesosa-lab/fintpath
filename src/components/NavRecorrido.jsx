/**
 * 31-oct-2026 — Una sola barra arriba para pantallas que son pasos de un mismo
 * recorrido (Este año → Año entrante → 10 años; Asesor → Coaches). Las rutas
 * no cambian: cambia que se vean como un camino y no como secciones sueltas.
 */
export const RECORRIDOS = {
  horizonte: { titulo: "Tu plan en el tiempo", pasos: [
    { ids: ["flujo", "sim"], go: "flujo", l: "Este año", s: "mes a mes y simulador" },
    { ids: ["simf"], go: "simf", l: "Año entrante", s: "lo que viene en 2027" },
    { ids: ["f10"], go: "f10", l: "10 años", s: "tus escenarios" },
  ] },
  ia: { titulo: "Asesor IA", pasos: [
    { ids: ["asesor"], go: "asesor", l: "Pregúntale", s: "lo que quieras, en un chat" },
    { ids: ["coach"], go: "coach", l: "Tu equipo de asesores", s: "cinco miradas a tu plata" },
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
              border: `1px solid ${on ? "rgba(34,197,94,0.45)" : "rgba(var(--fp-ink),0.08)"}`, background: on ? "rgba(34,197,94,0.10)" : "rgba(var(--fp-ink),0.02)", color: "var(--fp-txt)" }}>
            <div style={{ fontSize: 10, color: on ? "#22c55e" : "var(--fp-txt3)", fontWeight: 700, letterSpacing: 0.5 }}>{k === "horizonte" ? `PASO ${i + 1}` : ""}{k === "horizonte" && i < r.pasos.length - 1 ? " →" : ""}</div>
            <div style={{ fontSize: mb ? 13 : 14, fontWeight: 700 }}>{p.l}</div>
            {!mb && <div style={{ fontSize: 11, color: "var(--fp-txt3)" }}>{p.s}</div>}
          </button>
        );
      })}
    </nav>
  );
}
