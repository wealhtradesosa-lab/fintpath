// ═══════════════════════════════════════════════════════════════════════════
// HallazgosPension — «¿Qué te conviene?» (4-nov-2026)
// El retorno por peso aportado y los hallazgos que salen de los escenarios
// (lib/pensionColpensiones.js → hallazgosPension). Informativo: siempre con el
// aviso de que lo valida un experto.
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo } from "./estilos.js";

export default function HallazgosPension({ hallazgos, nombre, aviso }) {
  if (!Array.isArray(hallazgos) || !hallazgos.length) return null;
  const [rec, ...resto] = hallazgos;
  return (
    <section aria-label="Hallazgos de tu pensión" style={{ ...tarjeta, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h3 style={titulo}>{nombre ? `¿Qué muestran los números de ${nombre}?` : "¿Qué muestran los números?"}</h3>
        <div style={subtitulo}>Retorno por peso = mesada extra que recibirías en toda tu pensión ÷ lo que aportas, en pesos de hoy y frente a dejar de cotizar hoy.</div>
      </div>
      <div style={{ background: trama(C.pos, 10), border: `1px solid ${trama(C.pos, 35)}`, borderRadius: 12, padding: "14px 16px", fontSize: 15, lineHeight: 1.55, color: C.txt }}>{rec.texto}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {resto.map((h, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: h.tipo === "tope" ? C.txt : C.txt2 }}>{h.texto}</li>
        ))}
      </ul>
      {aviso && <div style={{ fontSize: 13, color: C.neg, lineHeight: 1.5 }}>{aviso}</div>}
      <div style={{ fontSize: 12, color: C.txt3, lineHeight: 1.6, borderTop: `1px solid ${C.linea}`, paddingTop: 10 }}>
        Informativo, no es asesoría financiera ni pensional. Antes de decidir, valídalo con un actuario o un asesor pensional.
      </div>
    </section>
  );
}
