import { useState } from "react";
import { MESES } from "../lib/flowHelpers.js";

// ═══════════════════════════════════════════════════════════════════════════
// 14-nov-2026 — Flujo de caja: el mes elegido contra el promedio del año.
//
// Santiago: "darle al usuario mucha claridad en sus números, organizar mejor,
// limpiar […] mirar los promedios del año (ingresos, gastos proyectados) y
// además el mes presente, y tener más visible qué mes estamos viendo"; "y uno
// poder ahí mismo cambiar de mes".
//
// Reemplaza tres piezas que decían lo mismo con cifras sin rótulo:
//  · las tarjetas "Ingresos mensuales" / "Egresos mensuales" (eran el promedio
//    del año, pero no lo decían);
//  · la línea "Ingresos del mes … − Egresos del mes …" del hero;
//  · "Al año", "Al día" e "Independencia" (esta última es otra medida distinta
//    del nivel de libertad financiera y confundía).
//
// Las dos columnas salen de la misma fuente: el mes es filas[mes − 1] y el
// promedio es Σ filas ÷ 12, igual que las barras y el cierre del año.
// ═══════════════════════════════════════════════════════════════════════════

const CAMPOS = ["bruto", "retencion", "disponible", "aportes", "gastosFam", "cuotas", "impuesto", "inversiones", "egresos", "flujo"];

export function promedioFilas(filas) {
  const p = Object.fromEntries(CAMPOS.map((k) => [k, 0]));
  (filas || []).forEach((f) => CAMPOS.forEach((k) => { p[k] += Number(f[k]) || 0; }));
  CAMPOS.forEach((k) => { p[k] = p[k] / 12; });
  return p;
}

export function estadoMes(mes, mesActual) {
  if (mes < mesActual) return { texto: "Ejecutado", tono: "neutro" };
  if (mes === mesActual) return { texto: "Mes actual", tono: "actual" };
  return { texto: "Proyectado · con este escenario", tono: "proyectado" };
}

const FILAS = [
  {
    id: "ing", label: "Ingresos disponibles", sub: "Después de retención en la fuente", campo: "disponible", sube: "bien",
    detalle: [
      { label: "Ingreso bruto", campo: "bruto" },
      { label: "Retención en la fuente", campo: "retencion", resta: true, nota: "Se descuenta en tu declaración" },
    ],
  },
  {
    id: "egr", label: "Egresos", sub: "Gastos, cuotas e impuesto", campo: "egresos", sube: "mal",
    detalle: [
      { label: "Aportes obligatorios", campo: "aportes" },
      { label: "Gastos familiares", campo: "gastosFam" },
      { label: "Cuotas de deudas", campo: "cuotas" },
      { label: "Impuesto de renta", campo: "impuesto", nota: "Se paga en el mes de cada declaración" },
      { label: "Aportes a inversiones", campo: "inversiones", nota: "Extraordinarios: la plata pasa a tu patrimonio", soloSiHay: true },
    ],
  },
];

export default function FlujoMesVsPromedio({ T, fm, mes, año, mesActual, onMes, filaMes, filaProm, deltaEscenario, children }) {
  const [abierto, setAbierto] = useState({});
  const nombre = MESES.find((m) => m.v === mes)?.l || "";
  const estado = estadoMes(mes, mesActual);
  const flujo = filaMes.flujo || 0;
  const colorFlujo = flujo >= 0 ? T.gn : T.rd;
  const colorDif = (dif, sube) => {
    if (Math.abs(dif) < 1) return T.txt3;
    const bueno = sube === "mal" ? dif < 0 : dif > 0;
    return bueno ? T.gn : T.rd;
  };
  const signo = (n) => (Math.abs(n) < 1 ? "—" : (Math.round(n) > 0 ? "+" : "") + fm(n));
  const num = { fontFamily: "'Plus Jakarta Sans',ui-monospace", fontVariantNumeric: "tabular-nums", textAlign: "right", paddingLeft: 12 };
  const flecha = (activo) => ({
    background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.txt,
    width: 34, height: 34, fontSize: 18, lineHeight: 1, cursor: "pointer",
    visibility: activo ? "visible" : "hidden",
  });
  const tonoEstado = estado.tono === "actual" ? T.gn : estado.tono === "proyectado" ? T.gd : T.txt3;

  return (
    <div className="fp-mvp" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
      <style>{`
        .fp-mvp { container-type: inline-size; }
        .fp-mvp-grid { display: grid; grid-template-columns: minmax(0,1.5fr) repeat(3, minmax(0,1fr)); column-gap: 0; align-items: stretch; }
        .fp-mvp-meses { display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: 4px; }
        @container (max-width: 560px) {
          .fp-mvp-grid { grid-template-columns: minmax(0,1fr) auto; }
          .fp-mvp-col-prom, .fp-mvp-col-dif, .fp-mvp-cab { display: none; }
          .fp-mvp-movil { display: block !important; }
          .fp-mvp-meses { grid-template-columns: repeat(6, minmax(0,1fr)); }
        }
      `}</style>

      {/* Encabezado: el mes que se está viendo, grande, con flechas */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" aria-label="Mes anterior" onClick={() => onMes(mes - 1)} style={flecha(mes > 1)}>‹</button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, letterSpacing: 1.2 }}>Flujo de caja</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.txt, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{nombre} {año}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tonoEstado, marginTop: 1 }}>{estado.texto}</div>
          </div>
          <button type="button" aria-label="Mes siguiente" onClick={() => onMes(mes + 1)} style={flecha(mes < 12)}>›</button>
        </div>
        {mes !== mesActual && (
          <button type="button" onClick={() => onMes(mesActual)}
            style={{ background: "none", border: "none", color: T.gd, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            Volver al mes actual
          </button>
        )}
      </div>

      {/* Tira de meses: se elige ahí mismo */}
      <div className="fp-mvp-meses" role="tablist" aria-label="Elegir mes" style={{ marginBottom: 18 }}>
        {MESES.map((m) => {
          const sel = m.v === mes;
          const futuro = m.v > mesActual;
          return (
            <button key={m.v} type="button" role="tab" aria-selected={sel} onClick={() => onMes(m.v)}
              style={{
                padding: "6px 0", borderRadius: 7, fontSize: 12, cursor: "pointer",
                fontWeight: sel ? 700 : 500,
                background: sel ? "rgba(0,200,5,0.14)" : T.bg3,
                color: sel ? T.gn : (futuro ? T.txt3 : T.txt2),
                border: sel ? `1px solid ${T.gn}` : (futuro ? `1px dashed ${T.border}` : `1px solid ${T.border}`),
              }}>
              {m.l.slice(0, 3)}{m.v === mesActual ? " ·" : ""}
            </button>
          );
        })}
      </div>

      {/* Tabla: mes contra promedio */}
      <div className="fp-mvp-grid">
        <div className="fp-mvp-cab" style={{ fontSize: 11, color: T.txt3, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }} />
        <div className="fp-mvp-cab" style={{ ...num, fontSize: 11, fontWeight: 700, color: T.gn, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>{nombre}</div>
        <div className="fp-mvp-cab" style={{ ...num, fontSize: 11, color: T.txt3, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>Promedio mensual {año}</div>
        <div className="fp-mvp-cab" style={{ ...num, fontSize: 11, color: T.txt3, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>Diferencia</div>

        {FILAS.map((f) => {
          const vM = filaMes[f.campo] || 0;
          const vP = filaProm[f.campo] || 0;
          const dif = vM - vP;
          const open = !!abierto[f.id];
          return [
            <div key={f.id + "l"} style={{ padding: "11px 0 9px", borderTop: f.id === "ing" ? "none" : `1px solid ${T.border}` }}>
              <button type="button" onClick={() => setAbierto((a) => ({ ...a, [f.id]: !a[f.id] }))} aria-expanded={open}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: T.txt }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontSize: 11, color: T.txt3, marginLeft: 6 }}>{open ? "▾" : "▸"}</span>
                <div style={{ fontSize: 11, color: T.txt3, marginTop: 1 }}>{f.sub}</div>
              </button>
              <div className="fp-mvp-movil" style={{ display: "none", fontSize: 11, color: T.txt3, marginTop: 3 }}>
                Promedio {fm(vP)} · <span style={{ color: colorDif(dif, f.sube) }}>{signo(dif)}</span>
              </div>
            </div>,
            <div key={f.id + "m"} style={{ ...num, fontSize: 15, fontWeight: 700, color: T.txt, borderTop: f.id === "ing" ? "none" : `1px solid ${T.border}`, padding: "11px 0 9px" }}>{fm(vM)}</div>,
            <div key={f.id + "p"} className="fp-mvp-col-prom" style={{ ...num, fontSize: 13, color: T.txt2, borderTop: f.id === "ing" ? "none" : `1px solid ${T.border}`, padding: "11px 0 9px" }}>{fm(vP)}</div>,
            <div key={f.id + "d"} className="fp-mvp-col-dif" style={{ ...num, fontSize: 13, fontWeight: 600, color: colorDif(dif, f.sube), borderTop: f.id === "ing" ? "none" : `1px solid ${T.border}`, padding: "11px 0 9px" }}>{signo(dif)}</div>,
            ...(open ? f.detalle.flatMap((d) => {
              const m = filaMes[d.campo] || 0;
              const p = filaProm[d.campo] || 0;
              if (d.soloSiHay && Math.round(m) === 0 && Math.round(p) === 0) return [];
              const dd = (d.resta ? -1 : 1) * (m - p);
              const v = (x) => (d.resta && Math.round(x) !== 0 ? "−" : "") + fm(x);
              return [
                <div key={f.id + d.campo + "l"} style={{ paddingLeft: 14, paddingBottom: 7, borderLeft: `2px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.txt2 }}>{d.label}</div>
                  {d.nota && <div style={{ fontSize: 11, color: T.txt3 }}>{d.nota}</div>}
                  <div className="fp-mvp-movil" style={{ display: "none", fontSize: 11, color: T.txt3 }}>Promedio {v(p)}</div>
                </div>,
                <div key={f.id + d.campo + "m"} style={{ ...num, fontSize: 12, color: T.txt2, paddingBottom: 7 }}>{v(m)}</div>,
                <div key={f.id + d.campo + "p"} className="fp-mvp-col-prom" style={{ ...num, fontSize: 12, color: T.txt3, paddingBottom: 7 }}>{v(p)}</div>,
                <div key={f.id + d.campo + "d"} className="fp-mvp-col-dif" style={{ ...num, fontSize: 12, color: colorDif(f.sube === "mal" ? (m - p) : dd, f.sube), paddingBottom: 7 }}>{Math.abs(m - p) < 1 ? "—" : signo(d.resta ? -(m - p) : (m - p))}</div>,
              ];
            }) : []),
          ];
        })}

        {/* Flujo neto: el protagonista */}
        {(() => {
          const dif = flujo - (filaProm.flujo || 0);
          const bt = `1.5px solid ${T.border}`;
          return [
            <div key="fl" style={{ padding: "13px 0 4px", borderTop: bt }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Flujo neto</div>
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 1 }}>Ingresos disponibles − egresos</div>
              <div className="fp-mvp-movil" style={{ display: "none", fontSize: 11, color: T.txt3, marginTop: 3 }}>
                Promedio {fm(filaProm.flujo || 0)} · <span style={{ color: colorDif(dif, "bien") }}>{signo(dif)}</span>
              </div>
            </div>,
            <div key="flm" style={{ ...num, fontSize: "clamp(1.25rem, 3vw, 1.6rem)", fontWeight: 800, color: colorFlujo, padding: "13px 0 4px", borderTop: bt, letterSpacing: "-0.02em" }}>{fm(flujo)}</div>,
            <div key="flp" className="fp-mvp-col-prom" style={{ ...num, fontSize: 14, fontWeight: 600, color: T.txt2, padding: "13px 0 4px", borderTop: bt }}>{fm(filaProm.flujo || 0)}</div>,
            <div key="fld" className="fp-mvp-col-dif" style={{ ...num, fontSize: 14, fontWeight: 700, color: colorDif(dif, "bien"), padding: "13px 0 4px", borderTop: bt }}>{signo(dif)}</div>,
          ];
        })()}
      </div>

      {deltaEscenario != null && Math.abs(deltaEscenario) >= 1 && (
        <div style={{ fontSize: 11, color: T.txt3, marginTop: 8, textAlign: "right" }}>
          Este escenario cambia el flujo promedio en <span style={{ color: deltaEscenario >= 0 ? T.gn : T.rd, fontWeight: 700 }}>{signo(deltaEscenario)}</span> al mes frente a tus datos
        </div>
      )}

      {children}
    </div>
  );
}
