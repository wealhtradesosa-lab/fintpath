import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, Cell } from "recharts";

const T = {
  bg: "#09090b", bg2: "#18181b", bg3: "#27272a",
  card: "#111113", cardBorder: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", blue: "#3b82f6", gold: "#eab308", purple: "#a78bfa",
  grad1: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
};
const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtCOP = (v) => { if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M"; return "$" + Math.round(v).toLocaleString("es-CO"); };
const pct = (n) => (n || 0).toFixed(1) + "%";
const TT = { background: "#18181b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#fafafa", fontSize: 12 };

// SMMLV 2026 Colombia
const SM_2026 = 1_959_000;

// ─── COLPENSIONES CALCULATION (Actuarial) ───
function calcColpensiones({ ibc_sm, edad, edad_jub, semanas_actuales, ipc }) {
  const SM = SM_2026;
  const IBC = ibc_sm * SM;
  const aniosCot = edad_jub - edad;
  const semanasTot = semanas_actuales + aniosCot * 52;

  // IBL = promedio 10 últimos años ajustado por IPC
  let sumIBL = 0;
  for (let y = 0; y < 10; y++) sumIBL += IBC * Math.pow((1 + ipc / 100) / 1.09, y);
  const IBL = sumIBL / 10;

  // Tasa de reemplazo Ley 797/2003
  const semanasExtra = semanasTot > 1300 ? semanasTot - 1300 : 0;
  const bonusPct = Math.floor(semanasExtra / 50) * 1.5;
  const s = IBL / SM;
  let rBase = 65.5 - 0.5 * s;
  if (rBase < 33.99) rBase = 33.99;
  let rTotal = rBase + bonusPct;
  if (rTotal > 80) rTotal = 80;

  const pensionBruta = Math.min(IBL * (rTotal / 100), 25 * SM);
  const pensionNeta = pensionBruta * 0.88; // Descuento salud

  return { tipo: "colpensiones", IBL, rBase, bonusPct, rTotal, pensionBruta, pensionNeta, semanasTot, semanasExtra, ingresoMes: pensionNeta, saldoFinal: pensionNeta * 12 * 20 };
}

// ─── FONDO PRIVADO CALCULATION ───
function calcPrivado({ saldoActual, rendAnual, ibc_sm, aniosContinuar }) {
  const SM = SM_2026;
  const IBC = ibc_sm * SM;
  const aporte = IBC * 0.16;
  const rendMes = Math.pow(1 + rendAnual / 100, 1 / 12) - 1;
  let saldo = saldoActual;
  for (let y = 0; y < aniosContinuar; y++) for (let m = 0; m < 12; m++) saldo = saldo * (1 + rendMes) + aporte;
  const rentaMes = saldo / 20 / 12;
  return { tipo: "privado", saldoFinal: saldo, ingresoMes: rentaMes };
}

// ─── BTC DCA CALCULATION ───
function calcBTC({ aporteMesUSD, cagrPct, aniosTotal, precioBase }) {
  const cagr = cagrPct / 100;
  let btcAcum = 0;
  const anios = [];
  for (let y = 1; y <= aniosTotal; y++) {
    for (let m = 1; m <= 12; m++) {
      const mg = (y - 1) * 12 + m;
      const precioMes = precioBase * Math.pow(1 + cagr, mg / 12);
      btcAcum += aporteMesUSD / precioMes;
    }
    const pFinal = precioBase * Math.pow(1 + cagr, y);
    anios.push({ anio: y, btcAcum, valorUSD: btcAcum * pFinal, precioBTC: pFinal });
  }
  const pFinal = precioBase * Math.pow(1 + cagr, aniosTotal);
  const valorFinal = btcAcum * pFinal;
  const retiroMes = (valorFinal * 0.04) / 12;
  return { btcAcum, valorFinal, retiroMes, pFinal, anios };
}

const In = ({ label, value, onChange, type, unit }) => (
  <div style={{ marginBottom: 10 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type={type || "number"} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.cardBorder}`, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none" }} />
      {unit && <span style={{ fontSize: 12, color: T.txt3, minWidth: 40 }}>{unit}</span>}
    </div>
  </div>
);

const StatRow = ({ label, value, color }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
    <span style={{ fontSize: 13, color: T.txt2 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: color || T.txt }}>{value}</span>
  </div>
);

export default function PensionColombia({ trm }) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState({
    edad: 40, genero: "M", semanas: 800, ibc_sm: 10,
    privSaldo: 200_000_000, privRend: 8,
    btcCagr: 56, btcPrice: 50000, btcAnios: 10, btcExtra: 0,
    ipc: 5.5,
  });

  const upd = (k, v) => setP((prev) => ({ ...prev, [k]: k === "genero" ? v : Number(v) || 0 }));
  const edadJub = p.genero === "F" ? 57 : 62;
  const aniosRest = Math.max(0, edadJub - p.edad);

  // ── CALCULATIONS ──
  const colp = useMemo(() => calcColpensiones({
    ibc_sm: p.ibc_sm, edad: p.edad, edad_jub: edadJub, semanas_actuales: p.semanas, ipc: p.ipc,
  }), [p.ibc_sm, p.edad, edadJub, p.semanas, p.ipc]);

  const priv = useMemo(() => calcPrivado({
    saldoActual: p.privSaldo, rendAnual: p.privRend, ibc_sm: p.ibc_sm, aniosContinuar: aniosRest,
  }), [p.privSaldo, p.privRend, p.ibc_sm, aniosRest]);

  const btc = useMemo(() => {
    const IBC = p.ibc_sm * SM_2026;
    const aporteMes = IBC * 0.16 + p.btcExtra;
    const aporteMesUSD = aporteMes / (trm || 4200);
    return calcBTC({ aporteMesUSD, cagrPct: p.btcCagr, aniosTotal: p.btcAnios, precioBase: p.btcPrice });
  }, [p.ibc_sm, p.btcExtra, p.btcCagr, p.btcPrice, p.btcAnios, trm]);

  const comparison = useMemo(() => [
    { name: "Colpensiones", value: colp.ingresoMes, color: T.blue },
    { name: "Fondo Privado", value: priv.ingresoMes, color: T.green },
    { name: "BTC (4% Rule)", value: btc.retiroMes, color: T.gold },
  ], [colp, priv, btc]);

  const btcRetiroUSD = btc.retiroMes;
  const btcRetiroCOP = btcRetiroUSD * (trm || 4200);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Plan de Jubilación — Colombia</h2>
      <p style={{ color: T.txt3, fontSize: 13, marginBottom: 20 }}>Colpensiones + Fondo Privado + Estrategia BTC</p>

      {/* Steps */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: T.bg2, borderRadius: 12, overflow: "hidden" }}>
        {[{ n: 1, i: "👤", l: "Perfil" }, { n: 2, i: "🏛️", l: "Colpensiones" }, { n: 3, i: "₿", l: "BTC + Resultado" }].map((s) => {
          const active = step === s.n, done = step > s.n;
          return (
            <div key={s.n} onClick={() => setStep(s.n)} style={{ flex: 1, padding: "12px", textAlign: "center", cursor: "pointer", background: active ? "#1a1a2e" : done ? T.greenDim : "transparent", transition: "all 0.3s" }}>
              <div style={{ fontSize: 18 }}>{s.i}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? T.txt : done ? T.green : T.txt3, marginTop: 3 }}>{done ? "✓ " : ""}{s.l}</div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: Profile */}
      {step === 1 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>Paso 1 — Perfil de Cotización</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <In label="Edad actual" value={p.edad} onChange={(v) => upd("edad", v)} unit="años" />
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Género</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["M", "F"].map((g) => (
                  <button key={g} onClick={() => upd("genero", g)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${p.genero === g ? T.green : T.cardBorder}`, background: p.genero === g ? T.greenDim : T.bg3, color: p.genero === g ? T.green : T.txt2, cursor: "pointer", fontWeight: 600 }}>
                    {g === "M" ? "👨 Hombre (62)" : "👩 Mujer (57)"}
                  </button>
                ))}
              </div>
            </div>
            <In label="Semanas cotizadas" value={p.semanas} onChange={(v) => upd("semanas", v)} unit="sem" />
            <In label="IBC (en SMMLV)" value={p.ibc_sm} onChange={(v) => upd("ibc_sm", v)} unit="SMMLV" />
            <In label="Saldo fondo privado (COP)" value={p.privSaldo} onChange={(v) => upd("privSaldo", v)} unit="COP" />
            <In label="Rendimiento fondo %" value={p.privRend} onChange={(v) => upd("privRend", v)} unit="%" />
          </div>
          <div style={{ marginTop: 16, padding: 14, background: T.bg3, borderRadius: 10, fontSize: 13, color: T.txt2 }}>
            <strong>SMMLV 2026:</strong> ${SM_2026.toLocaleString("es-CO")} COP • <strong>Edad jubilación:</strong> {edadJub} años • <strong>Faltan:</strong> {aniosRest} años • <strong>IPC:</strong> {p.ipc}%
          </div>
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{ background: T.green, color: "#000", border: "none", padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>Siguiente → Colpensiones</button>
          </div>
        </div>
      )}

      {/* STEP 2: Colpensiones */}
      {step === 2 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: T.blue }}>Paso 2 — Proyección Colpensiones</h3>
          <p style={{ color: T.txt3, fontSize: 13, marginBottom: 20 }}>Si te trasladas a Colpensiones y cotizas {aniosRest} años más</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Colpensiones */}
            <div style={{ background: `${T.blue}08`, border: `1px solid ${T.blue}20`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: T.blue }}>🏛️ Colpensiones</div>
              <StatRow label="Semanas al jubilarse" value={colp.semanasTot + " sem"} color={T.txt} />
              <StatRow label="IBL (Ingreso Base)" value={fmtCOP(colp.IBL)} color={T.blue} />
              <StatRow label="Tasa base" value={pct(colp.rBase)} />
              <StatRow label="Bonus semanas extra" value={"+" + pct(colp.bonusPct)} color={T.green} />
              <StatRow label="Tasa total reemplazo" value={pct(colp.rTotal)} color={T.blue} />
              <StatRow label="Pensión bruta" value={fmtCOP(colp.pensionBruta)} color={T.txt} />
              <div style={{ marginTop: 12, padding: 12, background: `${T.blue}12`, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: T.txt3 }}>PENSIÓN NETA MENSUAL</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: T.blue }}>{fmtCOP(colp.pensionNeta)}</div>
                <div style={{ fontSize: 12, color: T.txt3 }}>≈ {fmt(colp.pensionNeta / (trm || 4200))} USD</div>
              </div>
            </div>

            {/* Fondo Privado */}
            <div style={{ background: `${T.green}08`, border: `1px solid ${T.green}20`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: T.green }}>🏦 Fondo Privado</div>
              <StatRow label="Saldo actual" value={fmtCOP(p.privSaldo)} />
              <StatRow label="Rendimiento anual" value={p.privRend + "%"} color={T.green} />
              <StatRow label={"Años cotizando más"} value={aniosRest + " años"} />
              <StatRow label="Saldo proyectado" value={fmtCOP(priv.saldoFinal)} color={T.green} />
              <div style={{ marginTop: 12, padding: 12, background: T.greenDim, borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: T.txt3 }}>RENTA MENSUAL (20 AÑOS)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: T.green }}>{fmtCOP(priv.ingresoMes)}</div>
                <div style={{ fontSize: 12, color: T.txt3 }}>≈ {fmt(priv.ingresoMes / (trm || 4200))} USD</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.txt2, padding: "12px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Perfil</button>
            <button onClick={() => setStep(3)} style={{ background: T.green, color: "#000", border: "none", padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>Siguiente → BTC + Resultado</button>
          </div>
        </div>
      )}

      {/* STEP 3: BTC + Comparison */}
      {step === 3 && (
        <div>
          {/* BTC Config */}
          <div style={{ background: T.card, border: `1px solid ${T.gold}20`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: T.gold }}>₿ Estrategia Bitcoin DCA</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
              <In label="CAGR Bitcoin %" value={p.btcCagr} onChange={(v) => upd("btcCagr", v)} unit="%" />
              <In label="Precio entrada BTC" value={p.btcPrice} onChange={(v) => upd("btcPrice", v)} unit="USD" />
              <In label="Años de DCA" value={p.btcAnios} onChange={(v) => upd("btcAnios", v)} unit="años" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: `${T.gold}12`, borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase" }}>BTC Acumulados</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{btc.btcAcum.toFixed(4)} ₿</div>
              </div>
              <div style={{ background: T.greenDim, borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase" }}>Portafolio Final</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{fmt(btc.valorFinal)}</div>
              </div>
              <div style={{ background: `${T.blue}12`, borderRadius: 14, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase" }}>Retiro Mensual (4%)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{fmt(btcRetiroUSD)}</div>
                <div style={{ fontSize: 11, color: T.txt3 }}>{fmtCOP(btcRetiroCOP)} COP</div>
              </div>
            </div>
          </div>

          {/* COMPARISON */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>⚖️ Comparación de Estrategias</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparison} layout="vertical">
                <XAxis type="number" tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCOP(v)} />
                <YAxis dataKey="name" type="category" tick={{ fill: T.txt2, fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={TT} formatter={(v) => fmtCOP(v)} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                  {comparison.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Big multiplier */}
            {btc.retiroMes > 0 && colp.ingresoMes > 0 && (
              <div style={{ textAlign: "center", background: T.bg3, borderRadius: 16, padding: 24, marginTop: 16 }}>
                <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase" }}>BTC vs COLPENSIONES</div>
                <div style={{ fontSize: 56, fontWeight: 800, background: T.grad1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {(btcRetiroCOP / Math.max(1, colp.ingresoMes)).toFixed(1)}x
                </div>
                <div style={{ fontSize: 13, color: T.txt2 }}>
                  BTC: {fmtCOP(btcRetiroCOP)}/mes vs Colpensiones: {fmtCOP(colp.ingresoMes)}/mes
                </div>
              </div>
            )}
          </div>

          {/* BTC Projection Table */}
          {btc.anios.length > 0 && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: T.txt2 }}>Proyección BTC por Año</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={btc.anios}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.cardBorder} />
                  <XAxis dataKey="anio" tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} label={{ value: "Años", fill: T.txt3, fontSize: 10, position: "insideBottom", offset: -5 }} />
                  <YAxis tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickFormatter={(v) => "$" + (v / 1e6).toFixed(1) + "M"} />
                  <Tooltip contentStyle={TT} formatter={(v) => fmt(v)} />
                  <defs><linearGradient id="gbtc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.gold} stopOpacity={0.3} /><stop offset="100%" stopColor={T.gold} stopOpacity={0} /></linearGradient></defs>
                  <Area type="monotone" dataKey="valorUSD" stroke={T.gold} fill="url(#gbtc)" strokeWidth={2} name="Valor USD" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ textAlign: "left", marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{ background: "transparent", border: `1px solid ${T.cardBorder}`, color: T.txt2, padding: "12px 24px", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>← Colpensiones</button>
          </div>
        </div>
      )}
    </div>
  );
}
