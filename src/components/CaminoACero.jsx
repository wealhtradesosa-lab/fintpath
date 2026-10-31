import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import NumberInput from "./NumberInput";
import { ChartTooltip } from "../lib/chartTheme.jsx";

/**
 * 31-oct-2026 — Deudas: el saldo bajando mes a mes, la fecha en que quedas
 * libre y lo que pagas en intereses; con y sin abono extra. Antes era una
 * cifra ("Cero en 138 meses") y un campo "Override".
 */
const V = { txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a", bg3: "#1e1e24", border: "rgba(255,255,255,0.08)", green: "#22c55e", red: "#ef4444", orange: "#f97316" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const fechaEnMeses = (n, hoy = new Date()) => {
  if (n == null) return null;
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + n, 1);
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

// Montos redondos para probar, según el tamaño de las cuotas.
const opcionesExtra = (cuotas) => {
  const base = Math.max(cuotas, 1);
  const red = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.round(v / p) * p; };
  return [...new Set([0.1, 0.25, 0.5].map((f) => red(base * f)))].filter((v) => v > 0);
};

export default function CaminoACero({ plan, base, fm, cf, extraOverride, setExtraOverride }) {
  const cuotas = (plan.ordenadas || []).reduce((s, d) => s + (d.cuotaCOP || 0), 0);
  const ops = opcionesExtra(cuotas);
  const sim = plan.sim;
  const conExtra = plan.extra > 0;

  const data = useMemo(() => {
    const a = base?.serie || [], b = conExtra ? sim?.serie || [] : [];
    const n = Math.min(Math.max(a.length, b.length), 601);
    const paso = n > 240 ? 6 : n > 96 ? 3 : 1;
    const out = [];
    const y0 = new Date().getFullYear(), m0 = new Date().getMonth();
    for (let i = 0; i < n; i += paso) {
      const d = new Date(y0, m0 + i, 1);
      out.push({ i, x: String(d.getFullYear()), solo: a[i] ?? 0, extra: conExtra ? (b[i] ?? 0) : undefined });
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
  const chip = (on) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? V.green : V.border}`, background: on ? "rgba(34,197,94,0.12)" : "transparent", color: on ? V.green : V.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" });

  const caja = (titulo, s, color) => (
    <div style={{ flex: "1 1 200px", background: V.bg3, borderRadius: 12, padding: "12px 14px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: V.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</div>
      {s?.converge ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 800, color: V.txt, marginTop: 4 }}>Libre en {fechaEnMeses(s.meses)}</div>
          <div style={{ fontSize: 12, color: V.txt2, marginTop: 2 }}>{s.labelMeses} · pagas {fm(s.interesTotal)} en intereses</div>
        </>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 700, color: V.orange, marginTop: 4 }}>Con estas cuotas no termina de pagarse: alguna cuota no cubre ni los intereses.</div>
      )}
    </div>
  );

  const ahorroInt = conExtra && base?.converge && sim?.converge ? base.interesTotal - sim.interesTotal : 0;
  const ahorroMeses = conExtra && base?.converge && sim?.converge ? base.meses - sim.meses : 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: V.txt, marginBottom: 8 }}>¿Cuánto abonarías de más cada mes?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <button type="button" style={chip(sel === 0)} onClick={() => setExtraOverride("0")}>Nada, solo cuotas</button>
        {ops.map((v) => <button key={v} type="button" style={chip(sel === v)} onClick={() => setExtraOverride(String(v))}>+{fm(v)}</button>)}
        {cf > 0 && <button type="button" style={chip(sel === "cf")} onClick={() => setExtraOverride(null)}>Lo que te sobra ({fm(cf)})</button>}
        <NumberInput value={typeof sel === "number" && sel > 0 && !ops.includes(sel) ? sel : ""} placeholder="Otro monto"
          onChange={(v) => setExtraOverride(v === "" || v == null ? "0" : String(v))}
          style={{ width: 120, background: "transparent", border: `1px solid ${V.border}`, borderRadius: 999, padding: "7px 12px", color: V.txt, fontSize: 12, outline: "none" }} />
      </div>
      {cf <= 0 && sel === "cf" && (
        <div style={{ fontSize: 12, color: V.orange, marginBottom: 10 }}>Hoy no te sobra plata al mes ({fm(cf)}), así que el plan va solo con tus cuotas. Prueba con un abono para ver la diferencia.</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {caja("Solo con tus cuotas", base, V.red)}
        {conExtra && caja(`Abonando ${fm(plan.extra)} más al mes`, sim, V.green)}
      </div>
      {ahorroInt > 0 && (
        <div style={{ fontSize: 14, color: V.green, fontWeight: 700, marginBottom: 10 }}>
          Te ahorras {fm(ahorroInt)} en intereses y terminas {ahorroMeses >= 12 ? `${Math.floor(ahorroMeses / 12)} ${Math.floor(ahorroMeses / 12) === 1 ? "año" : "años"}${ahorroMeses % 12 ? ` y ${ahorroMeses % 12} ${ahorroMeses % 12 === 1 ? "mes" : "meses"}` : ""}` : `${ahorroMeses} ${ahorroMeses === 1 ? "mes" : "meses"}`} antes.
        </div>
      )}

      {data.length > 1 && (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="i" type="number" domain={[0, "dataMax"]} ticks={ticks} tickFormatter={(i) => String(new Date(new Date().getFullYear(), new Date().getMonth() + i, 1).getFullYear())} tick={{ fill: V.txt3, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: V.txt3, fontSize: 11 }} width={56} tickFormatter={(v) => fm(v).replace("$", "")} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => fm(v)} labelFormatter={(i) => fechaEnMeses(i)} />} />
              <Line type="monotone" dataKey="solo" name="Solo cuotas" stroke={V.red} strokeWidth={2} dot={false} />
              {conExtra && <Line type="monotone" dataKey="extra" name={`Con ${fm(plan.extra)} extra`} stroke={V.green} strokeWidth={2} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
