import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from "recharts";
import NumberInput from "./NumberInput";
import { ChartTooltip, sinCorte, MARGEN_EJE } from "../lib/chartTheme.jsx";
import { tx, esUS, esEN, nombreMes, plataCorta } from "../lib/region.js";

/**
 * 31-oct-2026 — Deudas: el saldo bajando mes a mes, la fecha en que quedas
 * libre y lo que pagas en intereses; con y sin abono extra. Antes era una
 * cifra ("Cero en 138 meses") y un campo "Override".
 */
const V = { txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", bg3: "var(--fp-raised)", border: "rgba(var(--fp-ink),0.08)", green: "#00c805", red: "#ff5000", orange: "#f59e0b" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const fechaEnMeses = (n, hoy = new Date()) => {
  if (n == null) return null;
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + n, 1);
  // 3-nov-2026: en inglés, "April 2027" (nombre del mes en el idioma de la sesión).
  if (esEN()) return `${nombreMes(d.getMonth() + 1)} ${d.getFullYear()}`;
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

// Montos redondos para probar, según el tamaño de las cuotas.
const opcionesExtra = (cuotas) => {
  const base = Math.max(cuotas, 1);
  const red = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.round(v / p) * p; };
  return [...new Set([0.1, 0.25, 0.5].map((f) => red(base * f)))].filter((v) => v > 0);
};


// 2-nov-2026 (Santiago: "este gráfico de las deudas no se entiende, no se sabe
// cómo leerlo"). Tres problemas: las dos líneas no decían qué eran, el eje se
// estiraba 50 años porque la línea sin abono nunca llega a cero (tres cuartos
// de la gráfica eran dos rayas planas) y el aviso no decía QUÉ deuda se queda.

// Último mes en que la serie todavía baja. Después de ahí la línea es plana
// (o sube): mostrarla 40 años más no le dice nada al lector.
export const mesQueDejaDeBajar = (serie = []) => {
  if (serie.length < 2) return 0;
  const tol = Math.max(1, (serie[0] || 0) * 0.0005);
  let ult = 0;
  for (let i = 1; i < serie.length; i++) if (serie[i] < serie[i - 1] - tol) ult = i;
  return ult;
};

// Hasta qué mes se dibuja: hasta que la última línea que llega a cero lo hace
// (o deja de bajar), más un año de aire. Tope de 30 años.
export const mesesAGraficar = ({ base, sim, conExtra }) => {
  const total = Math.max(base?.serie?.length || 0, conExtra ? sim?.serie?.length || 0 : 0);
  if (total < 2) return total;
  const finRojo = base?.converge ? base.meses : mesQueDejaDeBajar(base?.serie);
  const finVerde = conExtra ? (sim?.converge ? sim.meses : mesQueDejaDeBajar(sim?.serie)) : 0;
  const fin = Math.max(finRojo || 0, finVerde || 0) + 12;
  return Math.min(total, fin + 1, 361);
};

// Qué deudas no llegan a cero solo con las cuotas, y por qué, en palabras.
export const deudasQueNoTerminan = (s) =>
  (s?.porDeuda || [])
    .filter((d) => (d.saldoFinal || 0) > 0)
    .map((d) => {
      const interes = (d.saldo0 || 0) * (d.rMes || 0);
      const motivo = !(d.cuota > 0)
        ? tx("no tiene cuota mensual", "it has no monthly payment")
        : interes > 0 && d.cuota <= interes
          ? tx("su cuota no alcanza ni para los intereses", "its payment doesn't even cover the interest")
          : tx("su cuota no alcanza", "its payment isn't enough");
      return { nombre: d.nombre, saldo: d.saldoFinal, cuota: d.cuota || 0, interes, motivo };
    });

export default function CaminoACero({ plan, base, fm, cf, extraOverride, setExtraOverride }) {
  const cuotas = (plan.ordenadas || []).reduce((s, d) => s + (d.cuotaCOP || 0), 0);
  const ops = opcionesExtra(cuotas);
  const sim = plan.sim;
  const conExtra = plan.extra > 0;

  const data = useMemo(() => {
    const a = base?.serie || [], b = conExtra ? sim?.serie || [] : [];
    const n = mesesAGraficar({ base, sim, conExtra });
    const paso = n > 240 ? 6 : n > 96 ? 3 : 1;
    const out = [];
    const y0 = new Date().getFullYear(), m0 = new Date().getMonth();
    for (let i = 0; i < n; i += paso) {
      const d = new Date(y0, m0 + i, 1);
      out.push({ i, x: String(d.getFullYear()), solo: a[i] ?? a[a.length - 1] ?? 0, extra: conExtra ? (b[i] ?? 0) : undefined });
    }
    // El último punto siempre entra, para que la línea termine donde termina.
    if (n > 1 && out[out.length - 1].i !== n - 1) {
      const i = n - 1;
      out.push({ i, solo: a[i] ?? a[a.length - 1] ?? 0, extra: conExtra ? (b[i] ?? 0) : undefined });
    }
    return out;
  }, [base, sim, conExtra]);

  // Una marca por enero; si son muchos años, cada 2 o 5.
  const ticks = useMemo(() => {
    const ult = data.length ? data[data.length - 1].i : 0, m0 = new Date().getMonth();
    const enEnero = []; for (let i = (12 - m0) % 12; i <= ult; i += 12) enEnero.push(i);
    const cada = enEnero.length > 24 ? 5 : enEnero.length > 10 ? 2 : 1;
    return enEnero.filter((_, k) => k % cada === 0);
  }, [data]);

  const sel = extraOverride == null || extraOverride === "" ? "cf" : Number(extraOverride);
  const chip = (on) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? V.green : V.border}`, background: on ? "rgba(0,200,5,0.12)" : "transparent", color: on ? V.green : V.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" });

  const caja = (titulo, s, color) => (
    <div style={{ flex: "1 1 200px", background: V.bg3, borderRadius: 12, padding: "12px 14px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: V.txt3, fontWeight: 700, letterSpacing: 0.5 }}>{titulo}</div>
      {s?.converge ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, color: V.txt, marginTop: 4 }}>{tx("Libre en ", "Debt-free in ")}{fechaEnMeses(s.meses)}</div>
          <div style={{ fontSize: 12, color: V.txt2, marginTop: 2 }}>{s.labelMeses}{tx(" · pagas ", " · you pay ")}{fm(s.interesTotal)}{tx(" en intereses", " in interest")}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, color: V.txt, marginTop: 4 }}>{tx("No llegas a cero", "You don't reach zero")}</div>
          <div style={{ fontSize: 12, color: V.txt2, marginTop: 2, lineHeight: 1.5 }}>
            {deudasQueNoTerminan(s).map((d, k) => (
              <div key={k}>{tx("Quedan ", "")}{fm(d.saldo)}{tx(" de ", " left on ")}<strong style={{ color: V.txt }}>{d.nombre}</strong>: {d.motivo}{d.cuota > 0 && d.interes > 0 ? tx(` (${fm(d.cuota)} de cuota frente a ${fm(d.interes)} de intereses al mes)`, ` (${fm(d.cuota)} payment vs ${fm(d.interes)} of interest a month)`) : ""}.</div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const ahorroInt = conExtra && base?.converge && sim?.converge ? base.interesTotal - sim.interesTotal : 0;
  const ahorroMeses = conExtra && base?.converge && sim?.converge ? base.meses - sim.meses : 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: V.txt, marginBottom: 8 }}>{tx("¿Cuánto abonarías de más cada mes?", "How much extra would you pay each month?")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <button type="button" style={chip(sel === 0)} onClick={() => setExtraOverride("0")}>{tx("Nada, solo cuotas", "Nothing, just payments")}</button>
        {ops.map((v) => <button key={v} type="button" style={chip(sel === v)} onClick={() => setExtraOverride(String(v))}>+{fm(v)}</button>)}
        {cf > 0 && <button type="button" style={chip(sel === "cf")} onClick={() => setExtraOverride(null)}>{tx("Lo que te sobra", "Your surplus")} ({fm(cf)})</button>}
        <NumberInput value={typeof sel === "number" && sel > 0 && !ops.includes(sel) ? sel : ""} placeholder={tx("Otro monto", "Other amount")}
          onChange={(v) => setExtraOverride(v === "" || v == null ? "0" : String(v))}
          style={{ width: 120, background: "transparent", border: `1px solid ${V.border}`, borderRadius: 999, padding: "7px 12px", color: V.txt, fontSize: 12, outline: "none" }} />
      </div>
      {cf <= 0 && sel === "cf" && (
        <div style={{ fontSize: 12, color: V.orange, marginBottom: 10 }}>{tx("Hoy no te sobra plata al mes", "Today you have no monthly surplus")} ({fm(cf)}){tx(", así que el plan va solo con tus cuotas. Prueba con un abono para ver la diferencia.", ", so the plan uses only your payments. Try an extra amount to see the difference.")}</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {caja(tx("Solo con tus cuotas", "Payments only"), base, V.red)}
        {conExtra && caja(tx(`Abonando ${fm(plan.extra)} más al mes`, `Paying ${fm(plan.extra)} extra a month`), sim, V.green)}
      </div>
      {ahorroInt > 0 && (
        <div style={{ fontSize: 14, color: V.green, fontWeight: 700, marginBottom: 10 }}>
          {esEN()
            ? <>You save {fm(ahorroInt)} in interest and finish {ahorroMeses >= 12 ? `${Math.floor(ahorroMeses / 12)} ${Math.floor(ahorroMeses / 12) === 1 ? "year" : "years"}${ahorroMeses % 12 ? ` and ${ahorroMeses % 12} ${ahorroMeses % 12 === 1 ? "month" : "months"}` : ""}` : `${ahorroMeses} ${ahorroMeses === 1 ? "month" : "months"}`} sooner.</>
            : <>Te ahorras {fm(ahorroInt)} en intereses y terminas {ahorroMeses >= 12 ? `${Math.floor(ahorroMeses / 12)} ${Math.floor(ahorroMeses / 12) === 1 ? "año" : "años"}${ahorroMeses % 12 ? ` y ${ahorroMeses % 12} ${ahorroMeses % 12 === 1 ? "mes" : "meses"}` : ""}` : `${ahorroMeses} ${ahorroMeses === 1 ? "mes" : "meses"}`} antes.</>}
        </div>
      )}

      {data.length > 1 && (() => {
        const finSolo = base?.converge ? base.meses : null;
        const finExtra = conExtra && sim?.converge ? sim.meses : null;
        const linea = (color, texto) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: V.txt2 }}>
            <span style={{ width: 18, height: 3, background: color, flex: "none" }} />
            <span>{texto}</span>
          </div>
        );
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.txt }}>{tx("Cuánto debes en total, mes a mes", "Total you owe, month by month")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", margin: "6px 0 4px" }}>
              {linea(V.red, tx("Solo con tus cuotas", "Payments only"))}
              {conExtra && linea(V.green, tx(`Abonando ${fm(plan.extra)} más al mes`, `Paying ${fm(plan.extra)} extra a month`))}
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(var(--fp-ink),0.05)" vertical={false} />
                  <XAxis dataKey="i" type="number" domain={[0, "dataMax"]} ticks={ticks} tickFormatter={(i) => String(new Date(new Date().getFullYear(), new Date().getMonth() + i, 1).getFullYear())} tick={{ fill: V.txt3, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: V.txt3, fontSize: 12 }} width={78} tickFormatter={(v) => sinCorte((esUS() ? plataCorta(v) : fm(v)).replace("$", ""))} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fm(v)} labelFormatter={(i) => fechaEnMeses(i)} />} />
                  <Line type="monotone" dataKey="solo" name={tx("Solo con tus cuotas", "Payments only")} stroke={V.red} strokeWidth={2} dot={false} isAnimationActive={false} />
                  {conExtra && <Line type="monotone" dataKey="extra" name={tx(`Abonando ${fm(plan.extra)} más`, `Paying ${fm(plan.extra)} extra`)} stroke={V.green} strokeWidth={2.5} dot={false} isAnimationActive={false} />}
                  {finSolo != null && <ReferenceDot x={finSolo} y={0} r={4} fill={V.red} stroke="none" />}
                  {finExtra != null && <ReferenceDot x={finExtra} y={0} r={5} fill={V.green} stroke="var(--fp-raised)" strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: V.txt3, marginTop: 4 }}>{tx("El punto marca el mes en que la deuda llega a cero. Pasa el dedo o el mouse sobre la gráfica para ver el saldo de cada mes.", "The dot marks the month the debt reaches zero. Hover or tap the chart to see each month's balance.")}</div>
          </div>
        );
      })()}
    </div>
  );
}
