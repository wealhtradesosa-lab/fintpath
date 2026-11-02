import { Check, Lock, Unlock, ArrowRight, X } from "lucide-react";
import { pasosAfinar } from "../lib/afinaNumero.js";

/**
 * 2-nov-2026 — Después del primer minuto: el camino para llenar la plataforma.
 * Cada paso dice qué herramienta abre; solo se marca hecho con datos reales.
 */
export default function AfinaTuNumero({ u, T, mb, irA, onCerrar }) {
  const pasos = pasosAfinar(u);
  const hechos = pasos.filter((p) => p.hecho).length;
  const todo = hechos === pasos.length;
  const verde = "#00c805";
  const siguiente = pasos.find((p) => !p.hecho && !p.opcional)?.id;
  const sec = { background: "transparent", border: "1px solid " + T.border, color: T.tx, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 };
  return (
    <div style={{ marginBottom: 24, border: "1px solid " + T.border, borderRadius: 12, padding: mb ? "18px 16px" : "22px 24px", background: T.bg2, position: "relative" }}>
      {onCerrar && todo && (
        <button type="button" aria-label="Cerrar" onClick={onCerrar} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: T.tx3, cursor: "pointer" }}><X size={18} /></button>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: verde }}>{todo ? "Tu número ya es exacto" : `Tu punto de partida · ${hechos} de ${pasos.length} listos`}</div>
      <div style={{ fontSize: mb ? 20 : 22, fontWeight: 700, color: T.tx, margin: "4px 0 6px", letterSpacing: "-0.01em" }}>
        {todo ? "Ahora mira hacia dónde va tu plata" : "Ahora hazlo exacto"}
      </div>
      <div style={{ fontSize: 14, color: T.tx2, lineHeight: 1.5, maxWidth: 640 }}>
        {todo
          ? "Con tus datos reales ya puedes simular decisiones y ver cómo crece tu patrimonio."
          : "Tu nivel de arriba sale de tres cifras redondas. Cada sección que llenes con tus datos reales vuelve tu nivel exacto y te abre una herramienta nueva."}
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(var(--fp-ink),0.08)", margin: "14px 0 6px", overflow: "hidden" }}>
        <div style={{ width: (hechos / pasos.length) * 100 + "%", height: "100%", background: verde, transition: "width .3s" }} />
      </div>

      {!todo && (
        <div style={{ display: "grid", gap: 2, marginTop: 8 }}>
          {pasos.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: mb ? "28px 1fr" : "28px 1fr auto", gap: "4px 12px", alignItems: "start", padding: "12px 0", borderTop: i ? "1px solid " + T.border : "none" }}>
              <span style={{ width: 26, height: 26, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                background: p.hecho ? verde : "transparent", color: p.hecho ? "#000" : T.tx3, border: "2px solid " + (p.hecho ? verde : "rgba(var(--fp-ink),0.2)") }}>
                {p.hecho ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: p.hecho ? T.tx3 : T.tx, textDecoration: p.hecho ? "line-through" : "none" }}>{p.titulo}</div>
                {!p.hecho && <div style={{ fontSize: 13, color: T.tx3, marginTop: 2 }}>{p.detalle}</div>}
                <div style={{ fontSize: 13, color: p.hecho ? verde : T.tx2, marginTop: 4, display: "flex", gap: 6, alignItems: "flex-start" }}>
                  {p.hecho ? <Unlock size={14} style={{ marginTop: 2, flexShrink: 0 }} /> : <Lock size={14} style={{ marginTop: 2, flexShrink: 0 }} />}
                  <span>{p.hecho ? "Listo: " : ""}{p.abre}</span>
                </div>
              </div>
              {!p.hecho && !p.opcional && (
                <button type="button" onClick={() => irA(p.ir || p.id)} style={{ ...sec, gridColumn: mb ? "2" : "auto", justifySelf: "start", ...(p.id === siguiente ? { background: T.tx, color: "var(--fp-bg)", border: "none" } : {}) }}>
                  Cargar <ArrowRight size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + T.border }}>
        <div style={{ fontSize: 13, color: T.tx3, marginBottom: 8 }}>{todo ? "Sigue con:" : "Y cuando quieras, aunque sea con lo estimado:"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={sec} onClick={() => irA("f10")}>Mira tu patrimonio en 10 años <ArrowRight size={15} /></button>
          <button type="button" style={sec} onClick={() => irA("sim")}>Simula qué pasa si cambias algo <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
