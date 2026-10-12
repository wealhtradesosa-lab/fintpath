import { useMemo } from "react";
import { C, Cα, F, R } from "../lib/designTokens";

/**
 * RentaAnoTrasAno — "Tu renta, año tras año", en palabras simples.
 *
 * 12-oct-2026 (Santiago: "la sección de declaración de renta no es intuitiva,
 * uno que no sabe de declaraciones le cuesta ver entre tanta información…
 * que se compare fácil año tras año, el pago de cada año y el porcentaje de
 * lo que se pagó").
 *
 * Una tarjeta por año: las declaraciones que el usuario subió (F-210/F-110)
 * y el año en curso estimado por el motor. Cuatro números por año, siempre
 * los mismos y en el mismo orden: Ganaste · Impuesto del año · Ya retenido ·
 * Saldo. Y el que más importa, grande: de cada $100 que ganaste, cuántos
 * fueron impuesto.
 *
 * No conoce el motor ni el parser: recibe `declaraciones` (owner.declaraciones)
 * y `detalleActual` (estimacion.detalle del owner) y normaliza ambos a la
 * misma forma.
 */

const fm = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
const fmC = (n) => {
  const a = Math.abs(Math.round(n || 0)), sg = n < 0 ? "−" : "";
  if (a >= 1e9) return sg + "$" + (a / 1e9).toFixed(1).replace(".0", "").replace(".", ",") + " mil M";
  if (a >= 1e7) return sg + "$" + Math.round(a / 1e6) + " M";
  if (a >= 1e6) return sg + "$" + (a / 1e6).toFixed(1).replace(".0", "").replace(".", ",") + " M";
  if (a >= 1e3) return sg + "$" + Math.round(a / 1e3) + " K";
  return sg + "$" + a;
};

// Declaración guardada → fila normalizada. F-210 (natural) y F-110 (jurídica)
// guardan renglones con nombres distintos; acá se unifican.
export function filaDesdeDeclaracion(d) {
  const r = d?.renglones || {};
  const esF110 = d?.tipo === "F110";
  const ingresos = Number(r.ingresosBrutos) || 0;
  const impuesto = esF110
    ? (Number(r.impuestoNeto) || Number(r.impuestoCalculado) || 0)
    : (Number(r.impuestoCalculado) || 0);
  const retenido = esF110 ? (Number(r.autorretencion) || 0) : (Number(r.retefuente) || 0);
  const saldo = r.saldoPagar != null && r.saldoPagar !== "" ? Number(r.saldoPagar) || 0 : impuesto - retenido;
  return { ano: Number(d?.anoGravable) || 0, fuente: "declarada", ingresos, impuesto, retenido, saldo, tipo: d?.tipo || (esF110 ? "F110" : "F210") };
}

// Detalle del motor (estimacion.detalle[i]) → fila normalizada.
export function filaDesdeMotor(det, ano) {
  if (!det) return null;
  const ingresos = Number(det.ingreso) || 0;
  const impuesto = Number(det.impuestoACargo ?? det.impBruto ?? 0);
  const retenido = Number(det.pagosPrevios ?? det.reteN ?? det.retefuenteNat ?? 0);
  return { ano, fuente: "estimada", ingresos, impuesto, retenido, saldo: impuesto - retenido, tipo: det.type === "juridica" ? "F110" : "F210" };
}

export default function RentaAnoTrasAno({ declaraciones = [], detalleActual = null, anoActual, ownerName = "", onSubir, compacto = false }) {
  const filas = useMemo(() => {
    const decl = (declaraciones || []).map(filaDesdeDeclaracion).filter((f) => f.ano > 0 && (f.ingresos > 0 || f.impuesto > 0));
    const act = filaDesdeMotor(detalleActual, anoActual);
    const todas = [...decl.filter((f) => f.ano !== anoActual), ...(act && (act.ingresos > 0 || act.impuesto > 0) ? [act] : [])];
    return todas.sort((a, b) => a.ano - b.ano).map((f) => ({ ...f, tasa: f.ingresos > 0 ? (f.impuesto / f.ingresos) * 100 : 0 }));
  }, [declaraciones, detalleActual, anoActual]);

  const declaradas = filas.filter((f) => f.fuente === "declarada");
  const actual = filas.find((f) => f.fuente === "estimada");
  const ultimaDecl = declaradas[declaradas.length - 1];
  const maxIng = Math.max(1, ...filas.map((f) => f.ingresos));

  // Frase de veredicto: la comparación que importa, en una línea.
  const veredicto = (() => {
    if (!actual && !ultimaDecl) return null;
    if (actual && ultimaDecl) {
      const dPts = actual.tasa - ultimaDecl.tasa;
      const dImp = actual.impuesto - ultimaDecl.impuesto;
      const igual = Math.abs(dPts) < 0.5;
      return (
        <>
          En <b>{ultimaDecl.ano}</b> el impuesto fue <b>{fm(ultimaDecl.impuesto)}</b>, el <b>{ultimaDecl.tasa.toFixed(1)}%</b> de lo que ganaste.
          {" "}Para <b>{actual.ano}</b> va en <b>{fm(actual.impuesto)}</b> ({actual.tasa.toFixed(1)}%):{" "}
          <span style={{ color: igual ? C.muted : dPts < 0 ? C.ok : C.danger, fontWeight: 700 }}>
            {igual ? "misma proporción" : `${Math.abs(dPts).toFixed(1)} puntos ${dPts < 0 ? "menos" : "más"} de tu ingreso`}
          </span>
          {" "}y {dImp === 0 ? "el mismo monto" : `${fm(Math.abs(dImp))} ${dImp < 0 ? "menos" : "más"} en pesos`}.
        </>
      );
    }
    const f = actual || ultimaDecl;
    return (
      <>
        En <b>{f.ano}</b> {f.fuente === "estimada" ? "el impuesto va en" : "el impuesto fue"} <b>{fm(f.impuesto)}</b>: de cada $100 que ganaste, <b>${f.tasa.toFixed(0)}</b> {f.fuente === "estimada" ? "serían" : "fueron"} impuesto.
        {f.fuente === "estimada" && " Sube tu declaración del año pasado para comparar."}
      </>
    );
  })();

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: compacto ? 14 : 18 };

  if (filas.length === 0) {
    return (
      <div style={card}>
        <div style={F.h2}>Tu renta, año tras año</div>
        <div style={{ ...F.body, marginTop: 6 }}>Todavía no hay nada que comparar{ownerName ? ` para ${ownerName}` : ""}. Carga tus ingresos del año o sube la declaración del año pasado.</div>
        {onSubir && <button onClick={onSubir} style={{ marginTop: 10, background: C.accent, color: "#fff", border: "none", borderRadius: R.md, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Subir declaración del año pasado</button>}
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={F.h2}>Tu renta, año tras año{ownerName ? ` · ${ownerName}` : ""}</div>
          <div style={F.caption}>Qué ganaste, cuánto se fue en impuesto y cuánto quedó por pagar. Mismos cuatro números cada año, para comparar de un vistazo.</div>
        </div>
        {onSubir && declaradas.length < 3 && (
          <button onClick={onSubir} style={{ background: C.raised, color: C.text, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Subir otro año
          </button>
        )}
      </div>

      {veredicto && (
        <div style={{ ...F.body, color: C.text, marginTop: 12, padding: "10px 12px", background: C.raised, borderRadius: R.md, border: `1px solid ${C.border}` }}>
          {veredicto}
        </div>
      )}

      {/* Una tarjeta por año */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${compacto ? 200 : 230}px, 1fr))`, gap: 10, marginTop: 12 }}>
        {filas.map((f) => {
          const est = f.fuente === "estimada";
          const aFavor = f.saldo < 0;
          const pctRet = f.ingresos > 0 ? Math.min(100, (Math.min(f.retenido, f.impuesto) / f.ingresos) * 100) : 0;
          const pctSaldo = f.ingresos > 0 && f.saldo > 0 ? Math.min(100 - pctRet, (f.saldo / f.ingresos) * 100) : 0;
          return (
            <div key={f.ano + f.fuente} style={{ background: est ? Cα.accent08 : C.raised, border: `1px solid ${est ? Cα.accent25 : C.border}`, borderRadius: R.lg, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ ...F.h2, fontSize: 18 }}>{f.ano}</div>
                <span style={{ ...F.label, padding: "2px 8px", borderRadius: R.pill, background: est ? Cα.accent15 : Cα.ok15, color: est ? C.accent : C.ok }}>
                  {est ? "estimado · borrador" : `declarado · ${f.tipo === "F110" ? "F-110" : "F-210"}`}
                </span>
              </div>

              {/* El número que importa */}
              <div style={{ marginTop: 8 }}>
                <div style={{ ...F.monoXl, color: f.tasa >= 25 ? C.danger : f.tasa >= 15 ? C.warn : C.ok }}>{f.tasa.toFixed(1)}%</div>
                <div style={F.caption}>de cada $100 que ganaste, <b style={{ color: C.text }}>${f.tasa.toFixed(0)}</b> {est ? "serían" : "fueron"} impuesto</div>
              </div>

              {/* Barra: ingreso completo; adentro, lo retenido y lo que faltó pagar */}
              <div style={{ marginTop: 10, height: 10, borderRadius: R.sm, background: Cα.ok15, overflow: "hidden", display: "flex" }} title={`Retenido ${pctRet.toFixed(1)}% · saldo ${pctSaldo.toFixed(1)}% de lo ganado`}>
                <div style={{ width: `${pctRet}%`, background: C.accent }} />
                <div style={{ width: `${pctSaldo}%`, background: C.warn }} />
              </div>
              <div style={{ ...F.caption, fontSize: 10, marginTop: 3, display: "flex", gap: 10 }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, background: C.accent, borderRadius: 3, marginRight: 4 }} />ya retenido</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, background: C.warn, borderRadius: 3, marginRight: 4 }} />faltó pagar</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, background: Cα.ok15, borderRadius: 3, marginRight: 4 }} />te quedó</span>
              </div>

              {/* Los cuatro números, siempre en el mismo orden */}
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 5, columnGap: 8, alignItems: "baseline" }}>
                <div style={F.caption}>Ganaste</div>
                <div style={{ ...F.mono, fontSize: 13, color: C.ok, textAlign: "right" }}>{fm(f.ingresos)}</div>
                <div style={F.caption}>Impuesto del año</div>
                <div style={{ ...F.mono, fontSize: 13, color: C.danger, textAlign: "right" }}>{fm(f.impuesto)}</div>
                <div style={F.caption}>Ya retenido en el año</div>
                <div style={{ ...F.mono, fontSize: 13, color: C.accent, textAlign: "right" }}>{fm(f.retenido)}</div>
                <div style={{ ...F.caption, color: C.text, fontWeight: 600 }}>{aFavor ? "Te devuelven" : est ? "Te falta pagar" : "Pagaste al declarar"}</div>
                <div style={{ ...F.mono, fontSize: 14, color: aFavor ? C.ok : C.warn, textAlign: "right" }}>{fm(Math.abs(f.saldo))}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparación lado a lado cuando hay 2+ años: una tabla chica */}
      {filas.length >= 2 && !compacto && (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...F.label, textAlign: "left", padding: "4px 8px" }}></th>
                {filas.map((f) => <th key={f.ano} style={{ ...F.label, textAlign: "right", padding: "4px 8px" }}>{f.ano}{f.fuente === "estimada" ? " (est.)" : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Ganaste", (f) => fm(f.ingresos), C.ok],
                ["Impuesto del año", (f) => fm(f.impuesto), C.danger],
                ["% de lo ganado", (f) => f.tasa.toFixed(1) + "%", C.text],
                ["Ya retenido", (f) => fm(f.retenido), C.accent],
                ["Saldo al declarar", (f) => (f.saldo < 0 ? "a favor " : "") + fm(Math.abs(f.saldo)), C.warn],
              ].map(([t, g, col]) => (
                <tr key={t} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...F.caption, padding: "5px 8px", whiteSpace: "nowrap" }}>{t}</td>
                  {filas.map((f) => <td key={f.ano} style={{ ...F.mono, fontSize: 12, color: col, textAlign: "right", padding: "5px 8px", whiteSpace: "nowrap" }}>{g(f)}</td>)}
                </tr>
              ))}
              {filas.length >= 2 && (
                <tr style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...F.caption, padding: "5px 8px" }}>Cambio vs año anterior</td>
                  {filas.map((f, i) => {
                    if (i === 0) return <td key={f.ano} style={{ ...F.caption, textAlign: "right", padding: "5px 8px" }}>—</td>;
                    const prev = filas[i - 1], d = f.impuesto - prev.impuesto, dp = f.tasa - prev.tasa;
                    return (
                      <td key={f.ano} style={{ ...F.mono, fontSize: 11, textAlign: "right", padding: "5px 8px", color: Math.abs(d) < 1 ? C.subtle : d < 0 ? C.ok : C.danger, whiteSpace: "nowrap" }}>
                        {Math.abs(d) < 1 ? "=" : `${d < 0 ? "−" : "+"}${fmC(Math.abs(d))} · ${dp < 0 ? "−" : "+"}${Math.abs(dp).toFixed(1)} pts`}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <details style={{ marginTop: 10 }}>
        <summary style={{ ...F.caption, cursor: "pointer", color: C.accent }}>¿Qué significa cada número?</summary>
        <div style={{ ...F.caption, marginTop: 6, lineHeight: 1.6 }}>
          <b style={{ color: C.text }}>Ganaste</b>: todo lo que entró en el año antes de cualquier descuento (ingresos brutos).<br />
          <b style={{ color: C.text }}>Impuesto del año</b>: lo que la DIAN cobra por ese año completo, según la tabla de renta. Es el número real de cuánto te cuesta el impuesto.<br />
          <b style={{ color: C.text }}>Ya retenido</b>: lo que te fueron descontando durante el año (tu empresa, el banco, quien te paga honorarios). Ya es impuesto pagado, solo que por adelantado.<br />
          <b style={{ color: C.text }}>Saldo al declarar</b>: impuesto del año menos lo ya retenido. Si da positivo, lo pagas al presentar la declaración; si da negativo, te devuelven.<br />
          <b style={{ color: C.text }}>% de lo ganado</b>: impuesto del año dividido entre lo que ganaste. Es la forma más fácil de comparar un año con otro aunque hayas ganado distinto.
        </div>
      </details>
    </div>
  );
}
