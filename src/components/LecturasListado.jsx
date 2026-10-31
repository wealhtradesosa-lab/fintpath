import { fmtPctEs } from "../lib/metrics.js";

/** 31-oct-2026 — Ingresos: lo que depende de tu trabajo contra lo que no. */
export function CorteTrabajo({ r, T, fm }) {
  if (!r || r.total <= 0) return null;
  const pSin = r.pctSin, pTrab = 100 - pSin;
  const frase = pSin >= 99.5
    ? "Todo lo que te entra llega sin que tengas que trabajar."
    : pSin < 0.5
      ? "Todo lo que te entra depende de tu trabajo. Ningún activo te paga todavía."
      : `El ${fmtPctEs(pSin, 0)} de lo que te entra no depende de tu trabajo.`;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.txt }}>{frase}</div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: T.bg3, margin: "10px 0 8px" }}>
        <div style={{ width: pSin + "%", background: "#22c55e" }} />
        <div style={{ width: pTrab + "%", background: "#3b82f6" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", fontSize: 13, color: T.txt2 }}>
        <span><span style={{ color: "#22c55e" }}>●</span> Sin trabajar (arriendos, intereses, dividendos, pensión): <b style={{ color: T.txt }}>{fm(r.sinTrabajo)}/mes</b></span>
        <span><span style={{ color: "#3b82f6" }}>●</span> De tu trabajo (sueldo, honorarios, negocio): <b style={{ color: T.txt }}>{fm(r.trabajo)}/mes</b></span>
      </div>
    </div>
  );
}

/** 31-oct-2026 — Egresos: este mes contra tu promedio, por clase. */
export function MesVsPromedio({ r, T, fm, mesNombre }) {
  if (!r || r.totProm <= 0) return null;
  const sube = r.difTotal > 0;
  const enLinea = Math.abs(r.pctTotal) < 5;
  const col = (d) => (d > 0 ? "#ef4444" : "#22c55e");
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.txt }}>
        {enLinea
          ? `En ${mesNombre} vas en línea con tu promedio.`
          : `En ${mesNombre} sale ${fm(Math.abs(r.difTotal))} ${sube ? "más" : "menos"} que tu promedio (${sube ? "+" : "−"}${fmtPctEs(Math.abs(r.pctTotal), 0)}).`}
      </div>
      <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>Comparado con lo que gastas en promedio al mes este año.</div>
      {r.notables.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          {r.notables.slice(0, 4).map((k) => (
            <div key={k.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, color: T.txt2 }}>
              <span>{k.icono} {k.nombre}</span>
              <span style={{ color: col(k.dif), fontWeight: 700 }}>
                {k.dif > 0 ? "+" : "−"}{fmtPctEs(Math.abs(k.pct), 0)} · {fm(Math.abs(k.dif))} {k.dif > 0 ? "más" : "menos"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
