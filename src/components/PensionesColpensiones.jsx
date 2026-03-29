import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from "recharts";

/* ═══════════════════════════════════════════════════
   MÓDULO PENSIONES COLOMBIA — Cálculo Actuarial
   Ley 100/1993 + Ley 797/2003 + Acto Legislativo 01/2005
   Régimen de Prima Media (Colpensiones) y RAIS (Fondos Privados)
   ═══════════════════════════════════════════════════ */

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24", bg4: "#2a2a32",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee",
};
const SM_2026 = 1_959_000;
const fCOP = (v) => {
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  return "$" + Math.round(v).toLocaleString("es-CO");
};
const fUSD = (v, trm) => "$" + Math.round(v / (trm || 4200)).toLocaleString("en-US") + " USD";
const pc = (v) => (v || 0).toFixed(1) + "%";
const TT = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 12 };

const Cd = ({ children, style: s, glow }) => (
  <div style={{ background: T.card, border: `1px solid ${glow ? glow + "30" : T.border}`, borderRadius: 16, overflow: "hidden", ...(glow ? { boxShadow: `0 0 20px ${glow}08` } : {}), ...s }}>{children}</div>
);
const Row = ({ l, v, color, bold, sub }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
    <div><span style={{ fontSize: 14, color: T.txt2 }}>{l}</span>{sub && <div style={{ fontSize: 11, color: T.txt3 }}>{sub}</div>}</div>
    <span style={{ fontSize: 14, fontWeight: bold ? 700 : 600, color: color || T.txt, fontFamily: "monospace" }}>{v}</span>
  </div>
);
const In = ({ label, value, onChange, unit, min, max, step }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={min} max={max} step={step || 1}
        style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none" }} />
      {unit && <span style={{ fontSize: 12, color: T.txt3, minWidth: 44 }}>{unit}</span>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════
   CÁLCULOS ACTUARIALES
   ═══════════════════════════════════════════════════ */

// Régimen de Prima Media — Colpensiones
function calcColpensiones({ sexo, edad, semanasActuales, ibcSM, ipc, edadJub }) {
  const IBC = ibcSM * SM_2026;
  const aniosFaltantes = Math.max(0, edadJub - edad);
  const semanasFuturas = aniosFaltantes * 52;
  const semanasTotales = semanasActuales + semanasFuturas;

  // Requisito mínimo: 1300 semanas + edad (57 mujer, 62 hombre)
  const cumpleEdad = edad >= edadJub || aniosFaltantes >= 0;
  const cumpleSemanas = semanasTotales >= 1300;
  const cumpleRequisitos = cumpleEdad && cumpleSemanas;

  // IBL — Promedio de los últimos 10 años ajustado por IPC
  // Fórmula: IBL = promedio(IBC_ajustado) de últimos 10 años
  let sumIBL = 0;
  for (let y = 0; y < 10; y++) {
    sumIBL += IBC * Math.pow((1 + (ipc || 5.5) / 100) / 1.09, y);
  }
  const IBL = sumIBL / 10;

  // Tasa de reemplazo — Ley 797/2003 Art. 10
  // r = 65.50% - 0.50% por cada SMMLV adicional sobre el primero
  // Mínimo: 55% (por 1300 semanas) → en realidad la ley dice mínimo ~33.99%
  // + 1.5% por cada 50 semanas adicionales sobre 1300
  const semanasExtra = Math.max(0, semanasTotales - 1300);
  const bonusSemanas = Math.floor(semanasExtra / 50) * 1.5;
  const s = IBL / SM_2026; // Cuántos salarios mínimos es el IBL
  let tasaBase = 65.50 - 0.50 * s;
  if (tasaBase < 33.99) tasaBase = 33.99;
  let tasaTotal = tasaBase + bonusSemanas;
  if (tasaTotal > 80) tasaTotal = 80; // Tope máximo 80%

  // Pensión calculada
  const pensionBruta = IBL * (tasaTotal / 100);
  const pensionTope = 25 * SM_2026; // Tope máximo: 25 SMMLV
  const pensionAplicada = Math.min(pensionBruta, pensionTope);
  const descuentoSalud = pensionAplicada * 0.12; // 12% salud
  const pensionNeta = pensionAplicada - descuentoSalud;

  // Pensión mínima
  const pensionMinima = SM_2026;
  const pensionFinal = Math.max(pensionNeta, cumpleRequisitos ? pensionMinima : 0);

  // Valor total pensión en 20 años
  const total20Anios = pensionFinal * 12 * 20;

  // Meses y semanas que faltan
  const mesesFaltantes = aniosFaltantes * 12;
  const semanasQueFaltan = Math.max(0, 1300 - semanasActuales);

  return {
    IBC, IBL, tasaBase, bonusSemanas, tasaTotal,
    pensionBruta, pensionTope, pensionAplicada, descuentoSalud, pensionNeta, pensionFinal,
    semanasTotales, semanasExtra, semanasQueFaltan,
    cumpleEdad, cumpleSemanas, cumpleRequisitos,
    aniosFaltantes, mesesFaltantes, total20Anios, edadJub, pensionMinima,
  };
}

// RAIS — Régimen de Ahorro Individual con Solidaridad (Fondos Privados)
function calcRAIS({ saldoActual, ibcSM, rendAnual, aniosCotizar }) {
  const IBC = ibcSM * SM_2026;
  const aporteMes = IBC * 0.16; // 16% del IBC
  const rendMes = Math.pow(1 + rendAnual / 100, 1 / 12) - 1;

  let saldo = saldoActual;
  const proyeccion = [];
  for (let y = 1; y <= aniosCotizar; y++) {
    for (let m = 0; m < 12; m++) {
      saldo = saldo * (1 + rendMes) + aporteMes;
    }
    proyeccion.push({ anio: y, saldo: Math.round(saldo) });
  }

  // Anualidad: saldo / 240 meses (20 años)
  const rentaMes = saldo / 240;
  // Retiro programado: saldo / expectativa de vida restante
  const retiroProgramado = saldo / (20 * 12); // Simplificado a 20 años

  return {
    saldoFinal: saldo,
    aporteMes,
    totalAportado: aporteMes * 12 * aniosCotizar + saldoActual,
    rendimiento: saldo - (aporteMes * 12 * aniosCotizar + saldoActual),
    rentaMes,
    retiroProgramado,
    proyeccion,
    heredable: true,
  };
}

export default function PensionesColpensiones({ trm }) {
  const [sexo, setSexo] = useState("M");
  const [edad, setEdad] = useState(40);
  const [semanas, setSemanas] = useState(800);
  const [ibcSM, setIbcSM] = useState(10);
  const [ipc, setIpc] = useState(5.5);
  const [privSaldo, setPrivSaldo] = useState(200_000_000);
  const [privRend, setPrivRend] = useState(8);
  const [tab, setTab] = useState("colp"); // colp | rais | comparar

  const edadJub = sexo === "F" ? 57 : 62;
  const aniosFaltantes = Math.max(0, edadJub - edad);

  const colp = useMemo(() => calcColpensiones({
    sexo, edad, semanasActuales: semanas, ibcSM, ipc, edadJub,
  }), [sexo, edad, semanas, ibcSM, ipc, edadJub]);

  const rais = useMemo(() => calcRAIS({
    saldoActual: privSaldo, ibcSM, rendAnual: privRend, aniosCotizar: aniosFaltantes,
  }), [privSaldo, ibcSM, privRend, aniosFaltantes]);

  const tabs = [
    { id: "colp", icon: "🏛️", label: "Colpensiones" },
    { id: "rais", icon: "🏦", label: "Fondo Privado" },
    { id: "comparar", icon: "⚖️", label: "Comparar" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: T.blue }}>Simulador de Pensiones — Colombia</h1>
        <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Cálculo actuarial • Ley 100/1993 • Ley 797/2003 • SMMLV 2026: {fCOP(SM_2026)}</p>
      </div>

      {/* Input Form */}
      <Cd style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>👤 Tu Perfil de Cotización</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {/* Sexo */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Sexo</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ v: "M", l: "👨 Hombre (62)", c: T.blue }, { v: "F", l: "👩 Mujer (57)", c: "#ec4899" }].map((g) => (
                <button key={g.v} onClick={() => setSexo(g.v)} style={{
                  flex: 1, padding: "10px", borderRadius: 8,
                  border: `1px solid ${sexo === g.v ? g.c : T.border}`,
                  background: sexo === g.v ? g.c + "15" : T.bg3,
                  color: sexo === g.v ? g.c : T.txt2, cursor: "pointer", fontWeight: 600, fontSize: 13,
                }}>{g.l}</button>
              ))}
            </div>
          </div>
          <In label="Edad actual" value={edad} onChange={setEdad} unit="años" min={18} max={70} />
          <In label="Semanas cotizadas" value={semanas} onChange={setSemanas} unit="semanas" min={0} max={3000} />
          <In label="IBC (Salarios mínimos)" value={ibcSM} onChange={setIbcSM} unit="SMMLV" min={1} max={25} />
          <In label="Saldo fondo privado" value={privSaldo} onChange={setPrivSaldo} unit="COP" min={0} />
          <In label="Rendimiento fondo %" value={privRend} onChange={setPrivRend} unit="%" min={0} max={20} step={0.5} />
        </div>
        <div style={{ marginTop: 12, padding: 14, background: T.bg3, borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: T.txt2 }}>
          <span>📅 <strong>Edad jubilación:</strong> {edadJub} años</span>
          <span>⏳ <strong>Faltan:</strong> {aniosFaltantes} años</span>
          <span>📊 <strong>IBC:</strong> {fCOP(ibcSM * SM_2026)}/mes</span>
          <span>💰 <strong>Aporte pensión:</strong> {fCOP(ibcSM * SM_2026 * 0.16)}/mes (16%)</span>
          <span>📋 <strong>Semanas al jubilarse:</strong> {colp.semanasTotales}</span>
        </div>
      </Cd>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map((t) => {
          const a = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 24px", borderRadius: 10,
              border: `1px solid ${a ? T.blue : T.border}`,
              background: a ? T.blue + "15" : "transparent",
              color: a ? T.blue : T.txt3, cursor: "pointer", fontSize: 14, fontWeight: a ? 700 : 500,
            }}>{t.icon} {t.label}</button>
          );
        })}
      </div>

      {/* ═══ COLPENSIONES ═══ */}
      {tab === "colp" && (
        <div>
          {/* Requisitos */}
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📋 Requisitos de Pensión — Colpensiones</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { l: "Edad mínima", v: edadJub + " años", ok: edad >= edadJub, actual: edad + " años" },
                { l: "Semanas mínimas", v: "1,300 sem", ok: colp.semanasTotales >= 1300, actual: colp.semanasTotales + " sem" },
                { l: "Estado", v: colp.cumpleRequisitos ? "✅ Cumple" : "⏳ En proceso", ok: colp.cumpleRequisitos, actual: colp.cumpleRequisitos ? "Listo" : `Faltan ${colp.semanasQueFaltan} sem` },
              ].map((r) => (
                <div key={r.l} style={{ background: r.ok ? T.greenDim : T.bg3, border: `1px solid ${r.ok ? T.green + "20" : T.border}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.txt3, marginBottom: 4 }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: r.ok ? T.green : T.txt }}>{r.v}</div>
                  <div style={{ fontSize: 12, color: r.ok ? T.green : T.txt3, marginTop: 4 }}>Tú: {r.actual}</div>
                </div>
              ))}
            </div>
          </Cd>

          {/* Cálculo detallado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Cd style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.blue, marginBottom: 14 }}>🧮 Cálculo de la Pensión</h3>
              <Row l="IBC (Ingreso Base de Cotización)" v={fCOP(colp.IBC)} color={T.txt} />
              <Row l="IBL (Ingreso Base de Liquidación)" v={fCOP(colp.IBL)} color={T.blue} sub="Promedio últimos 10 años ajustado IPC" />
              <Row l="IBL en SMMLV" v={(colp.IBL / SM_2026).toFixed(1) + " SMMLV"} />
              <Row l="Tasa base de reemplazo" v={pc(colp.tasaBase)} sub="Ley 797/2003: 65.5% - 0.5% por SMMLV" />
              <Row l="Bonus semanas extra" v={"+" + pc(colp.bonusSemanas)} color={T.green} sub={colp.semanasExtra + " semanas extras × 1.5% / 50 sem"} />
              <Row l="Tasa total de reemplazo" v={pc(colp.tasaTotal)} color={T.blue} bold />
              <Row l="Pensión bruta" v={fCOP(colp.pensionBruta)} color={T.txt} />
              <Row l="Tope máximo (25 SMMLV)" v={fCOP(colp.pensionTope)} />
              <Row l="Pensión aplicada" v={fCOP(colp.pensionAplicada)} bold />
              <Row l="Descuento salud (12%)" v={"-" + fCOP(colp.descuentoSalud)} color={T.red} />
            </Cd>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* RESULTADO PRINCIPAL */}
              <Cd glow={T.blue} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tu Pensión Mensual Neta</div>
                <div style={{ fontSize: 48, fontWeight: 800, color: T.blue, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(colp.pensionFinal)}</div>
                <div style={{ fontSize: 14, color: T.txt3, marginTop: 4 }}>≈ {fUSD(colp.pensionFinal, trm)}</div>
                <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Tasa de reemplazo: <strong style={{ color: T.blue }}>{pc(colp.tasaTotal)}</strong></div>
              </Cd>

              {/* Métricas adicionales */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Cd style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: T.txt3 }}>EN 20 AÑOS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.txt }}>{fCOP(colp.total20Anios)}</div>
                </Cd>
                <Cd style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: T.txt3 }}>PENSIÓN MÍNIMA</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{fCOP(SM_2026)}</div>
                </Cd>
              </div>

              {/* Alertas */}
              <Cd style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⚠️ Consideraciones</div>
                {[
                  { t: "No heredable — al fallecer se pierde (excepto sustitución pensional)", c: T.red },
                  { t: "Sujeta a reformas pensionales futuras", c: T.orange },
                  { t: "Ajuste anual por IPC (no pierde poder adquisitivo)", c: T.green },
                  { t: "Garantía estatal — respaldada por el gobierno", c: T.blue },
                  colp.cumpleRequisitos ? { t: "✅ Cumples requisitos de edad y semanas", c: T.green } : { t: `⏳ Faltan ${aniosFaltantes} años y ${Math.max(0, 1300 - semanas)} semanas`, c: T.orange },
                ].map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: a.c, padding: "4px 0", borderBottom: i < 4 ? `1px solid ${T.border}` : "none" }}>
                    {a.t}
                  </div>
                ))}
              </Cd>
            </div>
          </div>

          {/* ═══ ESCENARIOS DE JUBILACIÓN ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 6 }}>📊 Escenarios: ¿Qué pasa si me jubilo en X años?</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>
              Por cada 50 semanas adicionales después de 1,300, tu tasa sube 1.5%. Mínimo 55%, máximo 80%.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Escenario","Edad","Años cotizando","Semanas","Sem. extras","Bonus 1.5%","Tasa reemplazo","Pensión bruta","Neta (−12%)","vs Actual"].map(h => (
                      <th key={h} style={{ padding: "10px 8px", textAlign: h === "Escenario" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "2px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 3, 5, 7, 10, Math.max(0, edadJub - edad)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((extraAnios) => {
                    const sc = calcColpensiones({ sexo, edad: edad, semanasActuales: semanas + extraAnios * 52, ibcSM, ipc, edadJub: Math.max(edadJub, edad + extraAnios) });
                    const esActual = extraAnios === 0;
                    const esJubilacion = extraAnios === Math.max(0, edadJub - edad);
                    return (
                      <tr key={extraAnios} style={{ background: esJubilacion ? T.blue + "10" : esActual ? T.bg3 : "transparent", borderBottom: "1px solid " + T.border }}>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: esJubilacion ? T.blue : esActual ? T.orange : T.txt }}>
                          {esActual ? "🔵 HOY" : esJubilacion ? "🏆 Jubilación" : "📅 En " + extraAnios + " años"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>{edad + extraAnios} años</td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>{extraAnios} más</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{sc.semanasTotales.toLocaleString()}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", color: T.green }}>{sc.semanasExtra > 0 ? "+" + sc.semanasExtra : "—"}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", color: T.green, fontWeight: 600 }}>{sc.bonusSemanas > 0 ? "+" + pc(sc.bonusSemanas) : "—"}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: sc.tasaTotal >= 65 ? T.green : sc.tasaTotal >= 55 ? T.blue : T.orange, fontSize: 14 }}>{pc(sc.tasaTotal)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>{fCOP(sc.pensionBruta)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: T.blue }}>{fCOP(sc.pensionFinal)}</td>
                        <td style={{ padding: "10px 8px", textAlign: "right", color: esActual ? T.txt3 : T.green, fontWeight: 600 }}>
                          {esActual ? "—" : "+" + fCOP(sc.pensionFinal - colp.pensionFinal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Cd>

          {/* ═══ FÓRMULA DEL 1.5% EXPLICADA ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>📖 ¿Cómo sube tu pensión? — Fórmula del 1.5%</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.8 }}>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <strong style={{ color: T.blue }}>Tasa base:</strong> 65.5% − 0.5% por cada SMMLV de tu IBL<br/>
                    <span style={{ color: T.txt3 }}>Tu IBL: {(colp.IBL / SM_2026).toFixed(1)} SMMLV → Tasa base: {pc(colp.tasaBase)}</span>
                  </div>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <strong style={{ color: T.green }}>Bonus por semanas extras:</strong><br/>
                    Por cada <strong>50 semanas</strong> después de 1,300 → <strong>+1.5%</strong><br/>
                    <span style={{ color: T.txt3 }}>Tus semanas extras: {colp.semanasExtra} → +{pc(colp.bonusSemanas)}</span>
                  </div>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14 }}>
                    <strong style={{ color: T.orange }}>Tope máximo:</strong> 80% (no puede pasar de ahí)<br/>
                    <span style={{ color: T.txt3 }}>Tu tasa final: <strong style={{ color: T.blue, fontSize: 16 }}>{pc(colp.tasaTotal)}</strong></span>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ejemplo con tus datos:</div>
                <div style={{ background: T.bg3, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 2 }}>
                    Tasa base: <strong>{pc(colp.tasaBase)}</strong><br/>
                    + Bonus ({colp.semanasExtra} semanas ÷ 50 × 1.5%): <strong style={{ color: T.green }}>+{pc(colp.bonusSemanas)}</strong><br/>
                    <div style={{ borderTop: "1px solid " + T.border, marginTop: 8, paddingTop: 8 }}>
                      = Tasa total: <strong style={{ color: T.blue, fontSize: 18 }}>{pc(colp.tasaTotal)}</strong><br/>
                      Tu IBL: {fCOP(colp.IBL)}<br/>
                      Pensión: {fCOP(colp.IBL)} × {pc(colp.tasaTotal)} = <strong style={{ color: T.blue, fontSize: 16 }}>{fCOP(colp.pensionBruta)}</strong>
                    </div>
                  </div>
                </div>
                {colp.tasaTotal < 80 && <div style={{ marginTop: 8, fontSize: 11, color: T.green }}>
                  💡 Si cotizas {Math.ceil((80 - colp.tasaTotal) / 1.5) * 50} semanas más llegas al tope de 80%
                </div>}
              </div>
            </div>
          </Cd>

          {/* ═══ BARRA VISUAL DE TASA ═══ */}
          <Cd style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tu tasa de reemplazo vs máximos</div>
            <div style={{ position: "relative", height: 32, background: T.bg3, borderRadius: 16, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: Math.min(colp.tasaTotal / 80 * 100, 100) + "%", background: "linear-gradient(90deg, #ef4444 0%, #eab308 30%, #22c55e 60%, #3b82f6 100%)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12, minWidth: 60 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#000" }}>{pc(colp.tasaTotal)}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.txt3 }}>
              <span>55% mínimo</span>
              <span>65.5% base</span>
              <span>80% máximo</span>
            </div>
          </Cd>
        </div>
      )}

      {/* ═══ FONDO PRIVADO (RAIS) ═══ */}
      {tab === "rais" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Cd style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.green, marginBottom: 14 }}>🏦 Fondo Privado — Proyección</h3>
              <Row l="Saldo actual" v={fCOP(privSaldo)} />
              <Row l="Aporte mensual (16%)" v={fCOP(rais.aporteMes)} color={T.green} />
              <Row l="Rendimiento anual" v={privRend + "%"} />
              <Row l={"Años cotizando más"} v={aniosFaltantes + " años"} />
              <Row l="Total aportado" v={fCOP(rais.totalAportado)} />
              <Row l="Rendimientos ganados" v={fCOP(rais.rendimiento)} color={T.green} />
              <Row l="Saldo final proyectado" v={fCOP(rais.saldoFinal)} color={T.green} bold />
            </Cd>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Cd glow={T.green} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Renta Vitalicia Mensual</div>
                <div style={{ fontSize: 48, fontWeight: 800, color: T.green, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(rais.rentaMes)}</div>
                <div style={{ fontSize: 14, color: T.txt3, marginTop: 4 }}>≈ {fUSD(rais.rentaMes, trm)}</div>
                <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Anualidad sobre 20 años</div>
              </Cd>

              <Cd style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>✅ Ventajas Fondo Privado</div>
                {[
                  { t: "100% heredable — tu familia recibe el saldo", c: T.green },
                  { t: "Retiro anticipado posible (cumpliendo requisitos)", c: T.green },
                  { t: "Rendimientos de mercado (pueden ser mayores)", c: T.blue },
                  { t: "Riesgo de mercado — rendimientos no garantizados", c: T.orange },
                  { t: "No hay pensión mínima garantizada", c: T.red },
                ].map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: a.c, padding: "4px 0", borderBottom: i < 4 ? `1px solid ${T.border}` : "none" }}>{a.t}</div>
                ))}
              </Cd>
            </div>
          </div>

          {/* Proyección chart */}
          <Cd style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Crecimiento del Fondo</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={rais.proyeccion}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="anio" tick={{ fill: T.txt3, fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickFormatter={(v) => fCOP(v)} />
                <Tooltip contentStyle={TT} labelStyle={{color:"#fafafa"}} itemStyle={{color:"#fafafa"}} formatter={(v) => fCOP(v)} />
                <defs><linearGradient id="raisG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.green} stopOpacity={0.3} /><stop offset="100%" stopColor={T.green} stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey="saldo" stroke={T.green} fill="url(#raisG)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Cd>
        </div>
      )}

      {/* ═══ COMPARAR ═══ */}
      {tab === "comparar" && (
        <div>
          {/* Big comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <Cd glow={T.blue} style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏛️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 12 }}>Colpensiones</div>
              <div style={{ fontSize: 11, color: T.txt3 }}>PENSIÓN MENSUAL</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.blue }}>{fCOP(colp.pensionFinal)}</div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{fUSD(colp.pensionFinal, trm)}</div>
              <div style={{ marginTop: 16, fontSize: 12, color: T.txt2, textAlign: "left" }}>
                <Row l="Tasa reemplazo" v={pc(colp.tasaTotal)} color={T.blue} bold />
                <Row l="En 20 años" v={fCOP(colp.total20Anios)} />
                <Row l="Heredable" v="❌ No" color={T.red} />
                <Row l="Garantía" v="✅ Estado" color={T.green} />
                <Row l="Riesgo" v="Reformas" color={T.orange} />
              </div>
            </Cd>

            <Cd glow={T.green} style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏦</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>Fondo Privado</div>
              <div style={{ fontSize: 11, color: T.txt3 }}>RENTA MENSUAL</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.green }}>{fCOP(rais.rentaMes)}</div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{fUSD(rais.rentaMes, trm)}</div>
              <div style={{ marginTop: 16, fontSize: 12, color: T.txt2, textAlign: "left" }}>
                <Row l="Saldo final" v={fCOP(rais.saldoFinal)} color={T.green} bold />
                <Row l="Rendimientos" v={fCOP(rais.rendimiento)} color={T.green} />
                <Row l="Heredable" v="✅ Sí" color={T.green} />
                <Row l="Garantía" v="❌ Mercado" color={T.orange} />
                <Row l="Riesgo" v="Rentabilidad" color={T.orange} />
              </div>
            </Cd>
          </div>

          {/* Visual comparison bars */}
          <Cd style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Comparación Visual</div>
            {[
              { l: "Pensión mensual", colp: colp.pensionFinal, rais: rais.rentaMes },
              { l: "Total 20 años", colp: colp.total20Anios, rais: rais.rentaMes * 240 },
              { l: "Capital heredable", colp: 0, rais: rais.saldoFinal },
            ].map((c) => {
              const max = Math.max(c.colp, c.rais, 1);
              return (
                <div key={c.l} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: T.txt2, marginBottom: 6 }}>{c.l}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.blue }}>Colpensiones</span>
                    <div style={{ height: 24, background: T.bg3, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${(c.colp / max) * 100}%`, height: "100%", background: T.blue, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{fCOP(c.colp)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: T.green }}>Fondo Priv.</span>
                    <div style={{ height: 24, background: T.bg3, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${(c.rais / max) * 100}%`, height: "100%", background: T.green, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{fCOP(c.rais)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Cd>

          {/* Winner */}
          <Cd glow={rais.rentaMes > colp.pensionFinal ? T.green : T.blue} style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 16, color: T.txt2 }}>
              {rais.rentaMes > colp.pensionFinal ? "El Fondo Privado paga más" : "Colpensiones paga más"}
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, background: "linear-gradient(135deg, " + (rais.rentaMes > colp.pensionFinal ? T.green : T.blue) + ", " + T.cyan + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {rais.rentaMes > colp.pensionFinal ? (rais.rentaMes / Math.max(colp.pensionFinal, 1)).toFixed(1) + "x" : (colp.pensionFinal / Math.max(rais.rentaMes, 1)).toFixed(1) + "x"}
            </div>
            <div style={{ fontSize: 14, color: T.txt2 }}>
              {fCOP(Math.max(rais.rentaMes, colp.pensionFinal))}/mes vs {fCOP(Math.min(rais.rentaMes, colp.pensionFinal))}/mes
            </div>
            {rais.rentaMes > colp.pensionFinal && (
              <div style={{ fontSize: 13, color: T.green, marginTop: 8 }}>+ Capital heredable de {fCOP(rais.saldoFinal)}</div>
            )}
          </Cd>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 11, color: T.txt3 }}>⚠️ Simulador educativo • Los cálculos son aproximados • Consulta un asesor pensional certificado • Ley 100/1993 • Ley 797/2003</p>
      </div>
    </div>
  );
}
