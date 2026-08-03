import { useState, useMemo } from "react";

/**
 * BitcoinRetirementUS — Bitcoin vs. 401(k), la versión americana.
 *
 * 03-ago-2026. El módulo colombiano (PensionColombia) compara ahorro en BTC
 * contra Colpensiones: salarios mínimos, tasa de reemplazo, aporte obligatorio
 * del 16%. Nada de eso existe en Estados Unidos, así que se ocultaba con
 * `hidden: isUS` en vez de mostrar números sin sentido.
 *
 * Acá el ejercicio es el mismo —¿y si eso lo pusiera en Bitcoin?— pero contra
 * el sistema real:
 *   · aporte al 401(k) como % del salario, con EMPLOYER MATCH, que es la
 *     diferencia grande contra Colombia: el match es dinero gratis y el modelo
 *     tiene que reconocerlo o la comparación es deshonesta;
 *   · Social Security estimada, en lugar de la mesada de Colpensiones;
 *   · regla del 4% (Bengen) para convertir capital en renta.
 *
 * El motor de proyección de BTC es el mismo que el colombiano: compra mensual,
 * anual o única, con el precio creciendo al CAGR elegido. Cuándo se compra
 * cambia cuánto se acumula, así que cada modo se simula en su propio momento
 * del calendario y no como un promedio.
 */

const C = {
  bg2: "#18181b", bg3: "#27272a", card: "#111113",
  border: "rgba(255,255,255,0.06)",
  tx: "#fafafa", tx2: "#a1a1aa", tx3: "#71717a",
  gn: "#22c55e", rd: "#ef4444", or: "#f97316", bl: "#3b82f6", gold: "#eab308",
};

const LIMITS = {
  K401_LIMIT: 23500,        // 2025 employee deferral
  K401_CATCHUP: 31000,      // 50+
  SS_MAX_70: 4873,          // max monthly benefit at 70
  SS_FRA: 67,
  SWR: 4,                   // Bengen 1994
};

const fUSD = (v) => {
  const n = Math.round(Number(v) || 0);
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-US");
};
const fFull = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("en-US");
const fBTC = (v) => Number(v).toFixed(4) + " ₿";

function Sl({ label, value, onChange, min, max, step, display, color, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
                    flexWrap: "wrap", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.tx2, fontWeight: 600, flex: "1 1 auto", minWidth: 0 }}>
          {label}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: color || C.tx, fontFamily: "monospace" }}>
          {display}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color || C.gn, cursor: "pointer" }} />
      {sub && <div style={{ fontSize: 11, color: C.tx3, marginTop: 5, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

const Cd = ({ children, style, glow }) => (
  <div style={{
    background: C.card, border: `1px solid ${glow || C.border}`, borderRadius: 16,
    boxShadow: glow ? `0 0 0 1px ${glow}22` : "none", ...style,
  }}>{children}</div>
);

const Rw = ({ l, v, color, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10,
                flexWrap: "wrap", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
    <span style={{ fontSize: 12.5, color: C.tx3 }}>{l}</span>
    <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600,
                   color: color || C.tx, fontFamily: "monospace" }}>{v}</span>
  </div>
);

const Sec = ({ n, t, s }) => (
  <div style={{ marginTop: 22, marginBottom: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: C.tx3, letterSpacing: "0.08em" }}>{n} · {t}</div>
    <div style={{ fontSize: 11, color: C.tx3, marginTop: 3 }}>{s}</div>
  </div>
);

export default function BitcoinRetirementUS({ user }) {
  const [salary, setSalary]   = useState(120000);   // anual
  const [pct, setPct]         = useState(10);       // % del salario al 401(k)
  const [match, setMatch]     = useState(50);       // % que iguala el empleador
  const [matchCap, setMatchCap] = useState(6);      // hasta N% del salario
  const [years, setYears]     = useState(20);
  const [age, setAge]         = useState(35);
  const [cagr, setCagr]       = useState(25);
  const [pBTC, setPBTC]       = useState(95000);
  const [swr, setSwr]         = useState(LIMITS.SWR);
  const [freq, setFreq]       = useState("monthly"); // monthly | annual | once
  const [once, setOnce]       = useState("");
  const [annual, setAnnual]   = useState("");
  const [abiertas, setAbiertas] = useState([]);

  // ── Aportes ───────────────────────────────────────────────────────────────
  const yourContrib = Math.min(salary * (pct / 100), LIMITS.K401_LIMIT);
  // El match iguala un % de lo que ponés, pero solo hasta un tope del salario.
  // Es la parte que la gente subestima: sobre ese tramo, el retorno inmediato
  // es del 50% o 100% antes de que el mercado haga nada.
  const matchable = Math.min(salary * (matchCap / 100), yourContrib);
  const employerMatch = matchable * (match / 100);
  const total401k = yourContrib + employerMatch;
  const monthly401k = total401k / 12;

  // ── Proyección 401(k) ─────────────────────────────────────────────────────
  const k401 = useMemo(() => {
    const r = 0.07 / 12; // 7% anual, retorno real de referencia
    const n = years * 12;
    const fv = (total401k / 12) * ((Math.pow(1 + r, n) - 1) / r);
    const invested = total401k * years;
    return { fv, invested, monthlyIncome: (fv * (swr / 100)) / 12 };
  }, [total401k, years, swr]);

  // ── Proyección BTC ────────────────────────────────────────────────────────
  const btc = useMemo(() => {
    const g = cagr / 100;
    const priceAt = (m) => pBTC * Math.pow(1 + g, m / 12);
    let coins = 0, invested = 0;

    if (freq === "once") {
      const amt = Number(once) || 0;
      coins += amt / pBTC; invested += amt;
    }
    // 03-ago-2026 (Santiago: "no veo que tenga en cuenta la valorización del BTC
    // en el tiempo como lo vemos en Colombia"). El cálculo SÍ la contemplaba
    // —priceAt() hace crecer el precio mes a mes— pero no se MOSTRABA: solo se
    // veía el resultado final. Sin la tabla año por año no hay forma de saber si
    // el modelo asume valorización o no. Se guarda la serie, igual que Colombia.
    const serie = [];
    for (let y = 1; y <= years; y++) {
      if (freq === "monthly") {
        // Se compara contra lo MISMO que iría al 401(k), incluido el match:
        // si no, la comparación favorece artificialmente a Bitcoin.
        for (let m = 1; m <= 12; m++) { coins += (total401k / 12) / priceAt((y - 1) * 12 + m); }
        invested += total401k;
      } else if (freq === "annual") {
        const amt = Number(annual) || 0;
        coins += amt / priceAt((y - 1) * 12 + 1); invested += amt;
      }
      const py = pBTC * Math.pow(1 + g, y);
      serie.push({ year: y, price: py, coins, value: coins * py, invested });
    }
    const finalPrice = pBTC * Math.pow(1 + g, years);
    const fv = coins * finalPrice;
    return { coins, finalPrice, fv, invested, serie, monthlyIncome: (fv * (swr / 100)) / 12 };
  }, [freq, once, annual, total401k, years, cagr, pBTC, swr]);

  // ── Social Security estimada ──────────────────────────────────────────────
  // Aproximación por tramos del AIME. No reemplaza el cálculo de la SSA, y se
  // dice explícitamente en pantalla.
  const ssMonthly = useMemo(() => {
    const aime = Math.min(salary, 176100) / 12;
    let pia = 0;
    if (aime <= 1226) pia = aime * 0.9;
    else if (aime <= 7391) pia = 1226 * 0.9 + (aime - 1226) * 0.32;
    else pia = 1226 * 0.9 + (7391 - 1226) * 0.32 + (aime - 7391) * 0.15;
    return Math.min(pia, LIMITS.SS_MAX_70);
  }, [salary]);

  const retireAge = age + years;
  const traditionalTotal = k401.monthlyIncome + ssMonthly;
  const mult = traditionalTotal > 0 ? btc.monthlyIncome / traditionalTotal : 0;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>₿ Bitcoin vs. 401(k)</h2>
        <p style={{ color: C.tx3, fontSize: 12, margin: 0 }}>
          What if the same money you put into your retirement plan went into Bitcoin instead?
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        {/* ── Parámetros ── */}
        <Cd style={{ padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚙️ Your numbers</div>

          <Sec n="1" t="YOUR CONTRIBUTION" s="What you and your employer put in" />
          <Sl label="💼 Annual salary" value={salary} onChange={setSalary}
            min={40000} max={500000} step={5000} display={fFull(salary)} color={C.tx}
            sub={`Social Security estimate: ${fFull(ssMonthly)}/mo at age ${LIMITS.SS_FRA}`} />
          <Sl label="📊 You contribute" value={pct} onChange={setPct}
            min={1} max={30} step={1} display={pct + "% = " + fFull(yourContrib) + "/yr"} color={C.bl}
            sub={yourContrib >= LIMITS.K401_LIMIT
              ? `⚠️ Capped at the ${fFull(LIMITS.K401_LIMIT)} IRS limit for 2025`
              : `${fFull(salary - yourContrib)} of salary left`} />
          <Sl label="🎁 Employer match" value={match} onChange={setMatch}
            min={0} max={100} step={5} display={match + "% = " + fFull(employerMatch) + "/yr"} color={C.gn}
            sub={`Your employer matches ${match}% of what you put in, up to ${matchCap}% of salary. This is free money — the model counts it.`} />
          <Sl label="🔒 Match cap" value={matchCap} onChange={setMatchCap}
            min={1} max={15} step={1} display={"up to " + matchCap + "% of salary"} color={C.gn} />

          <div style={{ background: C.bg3, borderRadius: 10, padding: "12px 14px", marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: C.tx3, marginBottom: 4 }}>Total going in every year:</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.gn, fontFamily: "monospace" }}>
              {fFull(total401k)}
            </div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 4 }}>
              {fFull(yourContrib)} yours + {fFull(employerMatch)} employer · {fFull(monthly401k)}/mo
            </div>
          </div>

          <Sec n="2" t="HOW YOU'D BUY BITCOIN" s="Same money, different asset" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[{ v: "monthly", l: "Every month" }, { v: "annual", l: "Once a year" }, { v: "once", l: "One time only" }].map((o) => (
              <button key={o.v} onClick={() => setFreq(o.v)}
                style={{ flex: "1 1 110px", background: freq === o.v ? "rgba(247,147,26,0.15)" : C.bg3,
                  border: "1px solid " + (freq === o.v ? C.or : C.border), borderRadius: 10,
                  padding: "10px 12px", cursor: "pointer", color: C.tx, fontWeight: 700, fontSize: 12.5 }}>
                {o.l}
              </button>
            ))}
          </div>
          {freq === "monthly" && (
            <div style={{ background: C.bg3, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.tx2, marginBottom: 4 }}>
              Same {fFull(monthly401k)}/mo that would go to your 401(k) — including the match.
            </div>
          )}
          {freq === "annual" && (
            <div>
              <div style={{ fontSize: 11, color: C.tx3, marginBottom: 5, fontWeight: 600 }}>AMOUNT PER YEAR (USD)</div>
              <input value={annual} onChange={(e) => setAnnual(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="20000" inputMode="numeric"
                style={{ width: "100%", background: C.bg3, border: "1px solid " + C.border,
                  borderRadius: 8, padding: "10px 12px", color: C.tx, fontSize: 14 }} />
            </div>
          )}
          {freq === "once" && (
            <div>
              <div style={{ fontSize: 11, color: C.tx3, marginBottom: 5, fontWeight: 600 }}>BUY NOW AND HOLD (USD)</div>
              <input value={once} onChange={(e) => setOnce(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="50000" inputMode="numeric"
                style={{ width: "100%", background: C.bg3, border: "1px solid " + C.border,
                  borderRadius: 8, padding: "10px 12px", color: C.tx, fontSize: 14 }} />
              {Number(once) > 0 && (
                <div style={{ fontSize: 11.5, color: C.or, marginTop: 6, fontFamily: "monospace" }}>
                  {fBTC(Number(once) / pBTC)} at today's price
                </div>
              )}
            </div>
          )}

          <Sec n="3" t="YOUR HORIZON" s="How long the money works" />
          <Sl label="🎂 Your age today" value={age} onChange={setAge}
            min={20} max={65} step={1} display={age + " years old"} color={C.tx} />
          <Sl label="⏰ Years until retirement" value={years} onChange={setYears}
            min={1} max={40} step={1} display={years + " years"} color={C.gn}
            sub={`You'd retire at ${retireAge}`} />

          <Sec n="4" t="MARKET ASSUMPTIONS" s="Adjust if you disagree with the defaults" />
          <Sl label="📈 Bitcoin annual growth (CAGR)" value={cagr} onChange={setCagr}
            min={0} max={60} step={1} display={cagr + "%"} color={C.or}
            sub="Historical BTC CAGR has been far higher, but past returns don't predict future ones. 401(k) assumes 7% real." />
          <Sl label="💰 Bitcoin price today" value={pBTC} onChange={setPBTC}
            min={10000} max={200000} step={1000} display={fFull(pBTC)} color={C.gold} />
          <Sl label="🏦 Withdrawal rate" value={swr} onChange={setSwr}
            min={2} max={8} step={0.5} display={swr + "% per year"} color={C.bl}
            sub="The 4% rule (Bengen, 1994). Use 3.5% for horizons over 40 years." />
        </Cd>

        {/* ── Resultado ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Cd glow={C.or} style={{ padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              At age {retireAge}, after {years} years
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
              <div style={{ background: C.bg3, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: C.tx3 }}>🏛️ 401(k) + Social Security</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.bl, marginTop: 6, fontFamily: "monospace" }}>
                  {fUSD(traditionalTotal)}
                </div>
                <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>per month</div>
              </div>
              <div style={{ background: "rgba(247,147,26,0.08)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: C.tx3 }}>₿ Bitcoin</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.or, marginTop: 6, fontFamily: "monospace" }}>
                  {fUSD(btc.monthlyIncome)}
                </div>
                <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>per month</div>
              </div>
            </div>

            {mult > 0 && (
              <div style={{ textAlign: "center", padding: "14px 16px", background: C.bg3, borderRadius: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: mult >= 1 ? C.or : C.bl, fontFamily: "monospace" }}>
                  {mult >= 1 ? mult.toFixed(1) + "×" : (1 / mult).toFixed(1) + "×"}
                </div>
                <div style={{ fontSize: 12.5, color: C.tx2, marginTop: 4 }}>
                  {mult >= 1 ? "more with Bitcoin" : "more with the traditional plan"}
                </div>
              </div>
            )}
          </Cd>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
            <Cd style={{ padding: 20 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.bl, marginBottom: 10 }}>🏛️ Traditional plan</div>
              <Rw l="You contribute:" v={fFull(yourContrib) + "/yr"} />
              <Rw l="Employer match:" v={fFull(employerMatch) + "/yr"} color={C.gn} />
              <Rw l={`Total in ${years} years:`} v={fFull(k401.invested)} />
              <Rw l="401(k) balance:" v={fUSD(k401.fv)} color={C.bl} bold />
              <Rw l={`Income at ${swr}%:`} v={fFull(k401.monthlyIncome) + "/mo"} />
              <Rw l="Social Security:" v={fFull(ssMonthly) + "/mo"} />
              <div style={{ fontSize: 10.5, color: C.tx3, marginTop: 10, lineHeight: 1.5 }}>
                Assumes 7% real return. Social Security is a rough estimate from your salary —
                check ssa.gov for your actual projection.
              </div>
            </Cd>

            <Cd style={{ padding: 20 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.or, marginBottom: 10 }}>₿ Bitcoin</div>
              <Rw l="Total invested:" v={fFull(btc.invested)} />
              <Rw l="Bitcoin accumulated:" v={fBTC(btc.coins)} color={C.or} />
              <Rw l={`Price in ${years} years:`} v={fUSD(btc.finalPrice)} />
              <Rw l="Portfolio value:" v={fUSD(btc.fv)} color={C.or} bold />
              <Rw l={`Income at ${swr}%:`} v={fFull(btc.monthlyIncome) + "/mo"} />
              <div style={{ fontSize: 10.5, color: C.tx3, marginTop: 10, lineHeight: 1.5 }}>
                No employer match, no tax deferral, and far higher volatility.
                Bitcoin has dropped over 70% multiple times.
              </div>
            </Cd>
          </div>

          {/* 03-ago-2026 (Santiago: "busque una solución más práctica,
              desplegables por cada 10 años"). Una tabla de 40 filas es
              incómoda y filtrar años saltea información. Se agrupa por décadas:
              cada bloque muestra su resumen —precio al cierre, BTC acumulado,
              valor— y se despliega para ver año por año.
              La década final viene abierta: es la que interesa. */}
          {btc.serie && btc.serie.length > 0 && (
            <Cd style={{ padding: 20 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>📈 Year by year</div>
              <div style={{ fontSize: 11, color: C.tx3, marginBottom: 12 }}>
                Bitcoin price growing at {cagr}% a year — this is the assumption doing the heavy lifting.
              </div>
              {(() => {
                const decadas = [];
                for (let i = 0; i < btc.serie.length; i += 10) decadas.push(btc.serie.slice(i, i + 10));
                return decadas.map((bloque, di) => {
                  const ultimo = bloque[bloque.length - 1];
                  const abierta = abiertas.includes(di) || di === decadas.length - 1;
                  return (
                    <div key={di} style={{ marginBottom: 8 }}>
                      <button onClick={() => setAbiertas((p) =>
                          p.includes(di) ? p.filter((x) => x !== di) : [...p, di])}
                        style={{ width: "100%", background: C.bg3, border: `1px solid ${C.border}`,
                          borderRadius: 10, padding: "11px 14px", cursor: "pointer", color: C.tx,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          gap: 10, flexWrap: "wrap", textAlign: "left" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                          {abierta ? "▾" : "▸"} Years {bloque[0].year}–{ultimo.year}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.or, fontFamily: "monospace" }}>
                          {fUSD(ultimo.value)}
                          <span style={{ color: C.tx3, fontWeight: 500, marginLeft: 8 }}>
                            {ultimo.coins.toFixed(3)} ₿
                          </span>
                        </span>
                      </button>
                      {abierta && (
                        <div style={{ overflowX: "auto", marginTop: 4 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 300 }}>
                            <thead>
                              <tr>
                                {["Year", "BTC price", "You hold", "Value", "Invested"].map((h) => (
                                  <th key={h} style={{ padding: "7px 10px", textAlign: h === "Year" ? "left" : "right",
                                        color: C.tx3, fontWeight: 600, fontSize: 10, textTransform: "uppercase",
                                        borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {bloque.map((r) => (
                                <tr key={r.year} style={{ borderBottom: `1px solid ${C.border}`,
                                      background: r.year === years ? "rgba(247,147,26,0.07)" : "transparent" }}>
                                  <td style={{ padding: "7px 10px", fontWeight: 700, color: C.tx2 }}>{r.year}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", color: C.gold }}>{fUSD(r.price)}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", color: C.tx3 }}>{r.coins.toFixed(3)} ₿</td>
                                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.or }}>{fUSD(r.value)}</td>
                                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", color: C.tx3 }}>{fUSD(r.invested)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </Cd>
          )}

          {/* Los supuestos, explícitos. Un modelo que no dice de dónde salen sus
              números es una opinión con formato de cálculo. */}
          <Cd style={{ padding: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.tx2, marginBottom: 10 }}>📋 Model assumptions</div>
            <Rw l="401(k) employee limit (2025):" v={fFull(LIMITS.K401_LIMIT)} />
            <Rw l="401(k) assumed return:" v="7% real, after inflation" />
            <Rw l="Bitcoin CAGR:" v={cagr + "% a year"} color={C.or} />
            <Rw l="Bitcoin price today:" v={fFull(pBTC)} />
            <Rw l={`Bitcoin price in ${years} years:`} v={fUSD(btc.finalPrice)} color={C.gold} />
            <Rw l="Withdrawal rate:" v={swr + "% (Bengen 1994)"} />
            <Rw l="Social Security:" v={`estimated from AIME brackets`} />
            <div style={{ fontSize: 10.5, color: C.tx3, marginTop: 10, lineHeight: 1.5 }}>
              The 7% for the 401(k) is a long-run market average. The Bitcoin CAGR is
              whatever you set above — it is not a forecast, and it's the number that
              decides the outcome.
            </div>
          </Cd>

          <Cd style={{ padding: 20, border: `1px solid ${C.rd}33` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.rd, marginBottom: 10 }}>⚠️ What this model doesn't tell you</div>
            {[
              "The employer match is an immediate, guaranteed return. Bitcoin has no equivalent.",
              "401(k) contributions reduce your taxable income today; buying Bitcoin doesn't.",
              "Bitcoin gains are taxed as capital gains when sold. 401(k) withdrawals are ordinary income.",
              "A 25% CAGR sustained for decades is an assumption, not a forecast.",
              "Bitcoin has fallen more than 70% several times. A 401(k) index fund hasn't.",
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 11.5, color: C.tx2, lineHeight: 1.5 }}>
                <span style={{ color: C.rd, flexShrink: 0 }}>·</span><span>{t}</span>
              </div>
            ))}
          </Cd>
        </div>
      </div>
    </div>
  );
}
