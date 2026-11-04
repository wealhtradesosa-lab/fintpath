// ═══════════════════════════════════════════════════════════════════════════
// Ahorro en Bitcoin (Colombia) — paso a paso.
//
// 04-nov-2026 (Santiago: "uno arranca como perdido, no sabe por dónde empezar,
// de una vez te muestra valores sin haber iniciado"; "¿no debería estar el
// resumen o escenario al final?"; "si la persona ya hizo su pensión, que aquí
// la pueda comparar pero no hacerla otra vez").
//
// Antes: cuatro pestañas que abrían con un resultado armado sobre supuestos que
// nadie había elegido (25 salarios mínimos, 10 años, tasa de reemplazo del 55 %)
// y una "pensión" calculada como salario × tasa, con 19 % de impuesto (la
// pensión es exenta hasta 1.000 UVT) y "tu familia no recibe nada" (existe la
// sustitución pensional). Además comparaba dólares de dentro de N años con una
// mesada en pesos de hoy.
//
// Ahora, en orden:
//   1 ¿Cuánto vas a poner?   2 ¿Por cuánto tiempo?   3 ¿Qué escenario?
//   4 ¿Contra qué pensión lo comparas? (la guardada en Pensiones, la que ya
//     recibes o ninguna)   →   Resultado al final, con los tres escenarios.
// Nada se calcula hasta tener 1 y 2. Las respuestas se guardan en u.ahorroBTC.
// El motor está en lib/ahorroBTC.js.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { fmtNumEs, fmtPctEs } from "../lib/formato.js";
import Disclaimer from "./Disclaimer";
import NumberInput from "./NumberInput";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "./PageHeader.jsx";
import { ChartGradients, ChartTooltip, axisProps, gridProps } from "../lib/chartTheme.jsx";
import { simularAhorroBTC, escenariosAhorroBTC, pensionParaComparar, ESCENARIOS_BTC, INFLACION_USD } from "../lib/ahorroBTC.js";

const T = { card: "var(--fp-card)", bg3: "var(--fp-raised)", border: "rgba(var(--fp-ink),0.08)", txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", green: "#00c805", red: "#ff5000", blue: "#3b82f6", orange: "#f59e0b" };
const PRECIO_RESPALDO = 100_000; // USD, solo si no se pudo traer el precio de hoy

const fC = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1e9) return "$" + fmtNumEs(v / 1e6, 0) + " MM";
  if (a >= 1e6) return "$" + fmtNumEs(v / 1e6, 1) + " MM";
  return "$" + Math.round(v || 0).toLocaleString("es-CO");
};
const fU = (v) => "USD " + Math.round(v || 0).toLocaleString("en-US");

const Paso = ({ n, titulo, listo, children }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 24, height: 24, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: listo ? T.green : T.bg3, color: listo ? "#fff" : T.txt2, flexShrink: 0 }}>{listo ? "✓" : n}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>{titulo}</span>
    </div>
    {children}
  </div>
);
const Chip = ({ activo, onClick, children, sub }) => (
  <button type="button" onClick={onClick} style={{ flex: "1 1 120px", textAlign: "left", background: activo ? "rgba(245,158,11,0.12)" : T.bg3, border: `1px solid ${activo ? T.orange : T.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: T.txt }}>
    <div style={{ fontSize: 14, fontWeight: 700 }}>{children}</div>
    {sub && <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>{sub}</div>}
  </button>
);
const Fila = ({ l, v, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${T.border}`, fontSize: 13 }}>
    <span style={{ color: T.txt2 }}>{l}</span><strong style={{ color: color || T.txt, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</strong>
  </div>
);
const inputSt = { width: "100%", maxWidth: 320, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.txt, fontSize: 16 };

export default function PensionBTC({ trm: pTrm, guardado, onGuardar, pensionCalculada, irAPensiones }) {
  const g = guardado || {};
  const [frecuencia, setFrecuencia] = useState(g.frecuencia || "mensual");
  const [monto, setMonto] = useState(g.monto || "");
  const [años, setAños] = useState(g.años || "");
  const [escenario, setEscenario] = useState(g.escenario || "moderado");
  const [pensionFuente, setPensionFuente] = useState(g.pensionFuente || (pensionCalculada?.neta > 0 ? "calculada" : ""));
  const [pensionManual, setPensionManual] = useState(g.pensionManual || "");
  const [precio, setPrecio] = useState(null);
  const [precioFuente, setPrecioFuente] = useState("");
  const [verDetalle, setVerDetalle] = useState(false);
  const trm = pTrm || 4200;

  // Precio de hoy del BTC (misma función de precios del portafolio).
  useEffect(() => {
    let vivo = true;
    fetch("/api/stock-price?tickers=BTC").then((r) => r.json()).then((d) => {
      const p = d?.prices?.BTC?.price;
      if (vivo && p > 0) { setPrecio(p); setPrecioFuente("hoy"); }
    }).catch(() => {}).finally(() => { if (vivo) setPrecioFuente((f) => f || "respaldo"); });
    return () => { vivo = false; };
  }, []);
  const precioHoy = precio || PRECIO_RESPALDO;

  // Guardar respuestas para no empezar de cero la próxima vez.
  useEffect(() => {
    if (!onGuardar) return;
    const v = { frecuencia, monto, años, escenario, pensionFuente, pensionManual };
    if (JSON.stringify(v) === JSON.stringify({ ...v, ...(guardado || {}) }) && guardado) return; // sin cambios
    const t = setTimeout(() => onGuardar(v), 600);
    return () => clearTimeout(t);
  }, [frecuencia, monto, años, escenario, pensionFuente, pensionManual]); // eslint-disable-line react-hooks/exhaustive-deps

  const montoN = Number(monto) || 0;
  const añosN = Number(años) || 0;
  const listo1 = montoN > 0;
  const listo2 = añosN > 0;
  const esc = ESCENARIOS_BTC.find((e) => e.id === escenario) || ESCENARIOS_BTC[1];
  const base = { frecuencia, monto: montoN, años: añosN, precioHoy, trm };
  const r = useMemo(() => simularAhorroBTC({ ...base, cagr: esc.cagr }), [frecuencia, montoN, añosN, precioHoy, trm, esc.cagr]); // eslint-disable-line react-hooks/exhaustive-deps
  const todos = useMemo(() => (r ? escenariosAhorroBTC(base) : []), [r]); // eslint-disable-line react-hooks/exhaustive-deps
  const pension = pensionParaComparar({ fuente: pensionFuente, calculada: pensionCalculada, manual: pensionManual });
  const listo4 = pensionFuente === "ninguna" || !!pension;

  const textoFrecuencia = frecuencia === "mensual" ? "cada mes" : frecuencia === "anual" ? "cada año" : "una sola vez";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <PageHeader label="Bitcoin" title="Ahorro en Bitcoin" subtitle="Cuánto podrías tener si ahorras en bitcoin, y cómo se compara con tu pensión." />

      <div style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, marginBottom: 16 }}>
        Responde cuatro preguntas. El resultado aparece al final, en pesos de hoy, con tres escenarios de precio.
      </div>

      {/* 1 · Cuánto */}
      <Paso n={1} titulo="¿Cuánto vas a poner?" listo={listo1}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Chip activo={frecuencia === "mensual"} onClick={() => setFrecuencia("mensual")}>Cada mes</Chip>
          <Chip activo={frecuencia === "anual"} onClick={() => setFrecuencia("anual")}>Una vez al año</Chip>
          <Chip activo={frecuencia === "unico"} onClick={() => setFrecuencia("unico")}>Una sola vez</Chip>
        </div>
        <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>Monto en pesos, {textoFrecuencia}</div>
        <NumberInput value={monto} onChange={(v) => setMonto(v === "" ? "" : v)} placeholder="Ej. 1.000.000" style={inputSt} />
      </Paso>

      {/* 2 · Cuánto tiempo */}
      {listo1 && (
        <Paso n={2} titulo={frecuencia === "unico" ? "¿Cuántos años lo dejas quieto?" : "¿Por cuántos años?"} listo={listo2}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[5, 10, 15, 20].map((a) => <Chip key={a} activo={añosN === a} onClick={() => setAños(a)}>{a} años</Chip>)}
          </div>
          <NumberInput value={años} onChange={(v) => setAños(v === "" ? "" : Math.min(40, Number(v)))} placeholder="Otro número de años" style={{ ...inputSt, maxWidth: 200 }} />
        </Paso>
      )}

      {/* 3 · Escenario */}
      {listo1 && listo2 && (
        <Paso n={3} titulo="¿Cuánto crees que sube el bitcoin al año?" listo>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ESCENARIOS_BTC.map((e) => <Chip key={e.id} activo={escenario === e.id} onClick={() => setEscenario(e.id)} sub={fmtPctEs(e.cagr, 0) + " al año en dólares"}>{e.nombre}</Chip>)}
          </div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 10, lineHeight: 1.6 }}>
            Precio de hoy: <strong style={{ color: T.txt2 }}>{fU(precioHoy)}</strong>{precioFuente === "respaldo" && " (referencia; no se pudo traer el precio de hoy)"} · Dólar: {fC(trm)}.
            Históricamente subió mucho más, pero proyectar eso a 10 o 20 años da precios que el mundo no puede pagar. Al final ves los tres escenarios.
          </div>
        </Paso>
      )}

      {/* 4 · Pensión */}
      {listo1 && listo2 && (
        <Paso n={4} titulo="¿Contra qué pensión lo comparas?" listo={listo4}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {pensionCalculada?.neta > 0 && (
              <Chip activo={pensionFuente === "calculada"} onClick={() => setPensionFuente("calculada")} sub={fC(pensionCalculada.neta) + " al mes · calculada en Pensiones"}>La que ya calculé</Chip>
            )}
            <Chip activo={pensionFuente === "manual"} onClick={() => setPensionFuente("manual")} sub="Ya estoy pensionado o la conozco">Escribirla</Chip>
            <Chip activo={pensionFuente === "ninguna"} onClick={() => setPensionFuente("ninguna")} sub="Solo quiero ver el ahorro">No comparar</Chip>
          </div>
          {pensionFuente === "manual" && <>
            <div style={{ fontSize: 13, color: T.txt3, marginBottom: 6 }}>Mesada neta al mes, en pesos de hoy</div>
            <NumberInput value={pensionManual} onChange={(v) => setPensionManual(v === "" ? "" : v)} placeholder="Ej. 8.000.000" style={inputSt} />
          </>}
          {!(pensionCalculada?.neta > 0) && irAPensiones && (
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 10 }}>
              ¿No sabes cuánto sería tu pensión? <button type="button" onClick={irAPensiones} style={{ background: "none", border: 0, padding: 0, color: T.blue, cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Calcúlala en Pensiones</button> y guárdala; aquí aparece sola.
            </div>
          )}
        </Paso>
      )}

      {/* ═══ RESULTADO — al final ═══ */}
      {r && listo4 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: T.txt3, marginBottom: 8 }}>Resultado · escenario {esc.nombre.toLowerCase()} · en pesos de hoy</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: T.txt2 }}>Pones {fC(r.invertido)} en {añosN} años y terminas con</div>
            <div style={{ fontSize: 48, fontWeight: 700, color: T.txt, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fC(r.valorCOPHoy)}</div>
            <div style={{ fontSize: 14, color: T.txt2 }}>{fmtNumEs(r.btc, 4)} BTC · {fmtNumEs(r.multiplo, 1)} veces lo que pusiste</div>

            <div style={{ display: "grid", gridTemplateColumns: pension ? "1fr 1fr" : "1fr", gap: 12, marginTop: 20 }}>
              <div style={{ background: T.bg3, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, color: T.txt3 }}>Si retiras el {r.retiroPct} % al año</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: T.orange, fontVariantNumeric: "tabular-nums" }}>{fC(r.retiroMes)}<span style={{ fontSize: 14, color: T.txt3, fontWeight: 500 }}> /mes</span></div>
                <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>Y el capital sigue invertido; se hereda.</div>
              </div>
              {pension && (
                <div style={{ background: T.bg3, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, color: T.txt3 }}>Tu pensión {pension.origen === "calculada" ? "calculada" : ""}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: T.blue, fontVariantNumeric: "tabular-nums" }}>{fC(pension.promedioMes)}<span style={{ fontSize: 14, color: T.txt3, fontWeight: 500 }}> /mes</span></div>
                  <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{fC(pension.mesada)} × 13 mesadas ÷ 12. Vitalicia, exenta y con sustitución al cónyuge.</div>
                </div>
              )}
            </div>
            {pension && (
              <div style={{ fontSize: 14, color: T.txt2, marginTop: 14, lineHeight: 1.6 }}>
                El ahorro en bitcoin te daría <strong style={{ color: r.retiroMes >= pension.promedioMes ? T.green : T.orange }}>{fmtNumEs(r.retiroMes / pension.promedioMes, 1)} veces</strong> tu pensión en este escenario.
                {" "}No son excluyentes: la pensión es el piso seguro; el bitcoin, lo que se suma encima.
              </div>
            )}
            {r.irreal && <div style={{ fontSize: 12, color: T.red, marginTop: 10 }}>Ojo: con este crecimiento el bitcoin valdría más que una cuarta parte de toda la riqueza del mundo. Toma este escenario con pinzas.</div>}
          </div>

          {/* Los tres escenarios */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Los tres escenarios</div>
            <div style={{ fontSize: 13, color: T.txt3, marginBottom: 12 }}>Mismos aportes; cambia cuánto sube el precio.</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                <thead><tr>{["Escenario", "Terminas con", "Retiro al mes", pension ? "Veces tu pensión" : null, "Si cae 50 %"].filter(Boolean).map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "6px 8px", color: T.txt3, fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                <tbody>{todos.map((e) => (
                  <tr key={e.id} onClick={() => setEscenario(e.id)} style={{ cursor: "pointer", background: e.id === escenario ? "rgba(245,158,11,0.08)" : "transparent" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 700 }}>{e.nombre} <span style={{ color: T.txt3, fontWeight: 500 }}>{fmtPctEs(e.cagr, 0)}</span></td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>{fC(e.r.valorCOPHoy)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: T.orange }}>{fC(e.r.retiroMes)}</td>
                    {pension && <td style={{ padding: "10px 8px", textAlign: "right" }}>{fmtNumEs(e.r.retiroMes / pension.promedioMes, 1)}×</td>}
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.txt2 }}>{fC(e.r.estres50)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 10, lineHeight: 1.6 }}>El bitcoin ha caído más de 50 % varias veces; la última columna es lo que retirarías si te toca uno de esos años.</div>
          </div>

          <button type="button" onClick={() => setVerDetalle((v) => !v)} style={{ background: "none", border: 0, padding: "4px 0", color: T.txt2, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>{verDetalle ? "Ocultar detalle" : "Ver año por año y supuestos"}</button>

          {verDetalle && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginTop: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Cómo crece, en pesos de hoy</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={r.serie}><ChartGradients /><CartesianGrid {...gridProps} />
                  <XAxis dataKey="año" {...axisProps} tickFormatter={(v) => "Año " + v} />
                  <YAxis {...axisProps} width={70} tickFormatter={(v) => fC(v)} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fC(v)} />} />
                  <Area type="monotone" dataKey="invertido" name="Lo que pusiste" stroke="var(--fp-txt3)" fill="transparent" />
                  <Area type="monotone" dataKey="valorCOPHoy" name="Lo que vale" stroke={T.orange} fill="rgba(245,158,11,0.12)" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12 }}>
                <Fila l="Precio del BTC hoy" v={fU(precioHoy)} />
                <Fila l={"Precio en " + añosN + " años (" + esc.nombre.toLowerCase() + ")"} v={fU(r.precioFinal)} />
                <Fila l="Valor en dólares de ese año" v={fU(r.valorUSD)} />
                <Fila l="Inflación del dólar descontada" v={fmtPctEs(INFLACION_USD, 0) + " al año"} />
                <Fila l="Dólar usado (constante, en pesos de hoy)" v={fC(trm)} />
                <Fila l={"Retiro anual (regla del " + r.retiroPct + " %)"} v={fC(r.retiroMes * 12)} />
              </div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 12, lineHeight: 1.6 }}>
                La regla del 4 %: retiras cada año el 4 % del capital y el resto sigue invertido. No contempla impuestos sobre la venta del bitcoin (ganancia ocasional si lo tuviste más de dos años) ni la devaluación del peso, que en el pasado jugó a favor de quien ahorra en dólares.
              </div>
            </div>
          )}
        </div>
      )}

      <Disclaimer variante="cripto" idioma="es" T={T} />
    </div>
  );
}
