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
const SM_2026 = 1_750_905;
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
function calcColpensiones({ sexo, edad, semanasActuales, ibcSM, iblProm, ipc, edadJub }) {
  const IBC = ibcSM * SM_2026;
  const aniosFaltantes = Math.max(0, edadJub - edad);

  // semanasTotales = lo que se pasa (la tabla ya suma las futuras)
  const semanasTotales = semanasActuales;
  const cumpleSemanas = semanasTotales >= 1300;
  const cumpleRequisitos = cumpleSemanas;

  // IBL = Promedio IBC últimos 10 años (Art. 21 Ley 100)
  // Si el usuario ingresa su promedio real, se usa. Si no, se usa el IBC actual.
  const IBL = iblProm > 0 ? iblProm : IBC;

  // ═══ TASA DE REEMPLAZO — Ley 797/2003 Art. 10 ═══
  // Base: 65.50% - 0.50% por cada SMMLV adicional del IBC sobre el primero
  // Se usa ibcSM (nivel de cotización), NO IBL/SMMLV
  const s = ibcSM; // SMMLV del IBC (lo que cotiza)
  let tasaBase = 65.50 - 0.50 * Math.max(0, s - 1);
  if (tasaBase < 40) tasaBase = 40;

  // Bonus: +1.5% por cada 50 semanas adicionales sobre 1300
  const semanasExtra = Math.max(0, semanasTotales - 1300);
  const bloques50 = Math.floor(semanasExtra / 50);
  const bonusSemanas = bloques50 * 1.5;
  let tasaTotal = tasaBase + bonusSemanas;
  if (tasaTotal > 80) tasaTotal = 80; // Tope legal

  // Pensión bruta
  const pensionBruta = IBL * (tasaTotal / 100);
  const pensionTope = 25 * SM_2026;
  const pensionAplicada = Math.min(pensionBruta, pensionTope);

  // ═══ DESCUENTOS — Salud 12% + Fondo Solidaridad ═══
  // Fondo Solidaridad Pensional para pensiones altas:
  const pensionSMLV = pensionAplicada / SM_2026;
  let pctDescuento = 0.12; // Salud base 12%
  if (pensionSMLV > 20) pctDescuento += 0.02; // >20 SMMLV: +2% solidaridad
  else if (pensionSMLV > 10) pctDescuento += 0.01 + (pensionSMLV - 10) / 10 * 0.01; // 10-20: gradual
  const descuentoSalud = pensionAplicada * pctDescuento;
  const pensionNeta = pensionAplicada - descuentoSalud;

  // Pensión mínima
  const pensionMinima = SM_2026;
  const pensionFinal = cumpleRequisitos ? Math.max(pensionNeta, pensionMinima) : 0;

  const total20Anios = pensionFinal * 12 * 20;
  const mesesFaltantes = aniosFaltantes * 12;
  const semanasQueFaltan = Math.max(0, 1300 - semanasActuales);

  return {
    IBC, IBL, tasaBase, bonusSemanas, tasaTotal,
    pensionBruta, pensionTope, pensionAplicada, descuentoSalud, pensionNeta, pensionFinal,
    semanasTotales, semanasExtra, semanasQueFaltan, bloques50, pctDescuento,
    cumpleSemanas, cumpleRequisitos,
    aniosFaltantes, mesesFaltantes, total20Anios, edadJub, pensionMinima,
  };
}

// RAIS — Régimen de Ahorro Individual con Solidaridad (Fondos Privados)
function calcRAIS({ saldoActual, ibcSM, rendAnual, aniosCotizar, aportesVolMes, bonoPensional, sexo }) {
  const IBC = ibcSM * SM_2026;

  // ═══ APORTE REAL AL AHORRO INDIVIDUAL ═══
  // Total cotización: 16% del IBC
  // Pero NO todo va a la cuenta individual:
  //   - 11.5% → cuenta de ahorro individual (lo que crece)
  //   - 1.5%  → Fondo Garantía Pensión Mínima
  //   - 3.0%  → Administración + seguros
  const aporteTotal = IBC * 0.16;
  const aporteMes = IBC * 0.115; // Solo lo que va a la cuenta
  const comisionMes = IBC * 0.03; // Lo que cobra la AFP
  const fondoGarantia = IBC * 0.015;

  const rendMes = Math.pow(1 + rendAnual / 100, 1 / 12) - 1;

  let saldo = saldoActual + (bonoPensional || 0);
  const proyeccion = [];
  for (let y = 1; y <= aniosCotizar; y++) {
    for (let m = 0; m < 12; m++) {
      saldo = saldo * (1 + rendMes) + aporteMes + (aportesVolMes || 0);
    }
    proyeccion.push({ anio: y, saldo: Math.round(saldo) });
  }

  // ═══ MODALIDADES DE PENSIÓN ═══

  // 1. RETIRO PROGRAMADO
  // Saldo queda en la AFP, se recalcula cada año
  // Esperanza de vida hombre 62 años: ~20.7 años (tabla RV08)
  // Rendimiento real durante retiro: ~4% anual
  // Tabla RV08 Superfinanciera — esperanza de vida según sexo
  // Hombre 62 años: 20.7 años | Mujer 57 años: 27.3 años
  const esperanzaVida = sexo === "F" ? 27.3 : 20.7; // Tabla RV08 por sexo
  const mesesVida = Math.round(esperanzaVida * 12);
  const rRetiro = Math.pow(1.04, 1/12) - 1;
  const factorRP = rRetiro > 0 ? (1 - Math.pow(1 + rRetiro, -mesesVida)) / rRetiro : mesesVida;
  const retiroProgramado = saldo / factorRP;

  // 2. RENTA VITALICIA
  // Se transfiere saldo a aseguradora, pago fijo de por vida
  // Aseguradora usa tasa más conservadora (~3%) y esperanza 22 años
  // Resultado: ~15-20% menos que retiro programado
  // Renta vitalicia: aseguradora usa esperanza más conservadora
  const esperanzaVitalicia = esperanzaVida + 2; // +2 años margen aseguradora
  const mesesVitalicia = Math.round(esperanzaVitalicia * 12);
  const rVitalicia = Math.pow(1.03, 1/12) - 1;
  const factorRV = rVitalicia > 0 ? (1 - Math.pow(1 + rVitalicia, -mesesVitalicia)) / rVitalicia : mesesVitalicia;
  const rentaVitalicia = saldo / factorRV;

  // Pensión mínima garantizada: si cualquier modalidad < 1 SMMLV,
  // el Fondo de Garantía complementa hasta el mínimo
  const pensionMinima = SM_2026;
  const retiroFinal = Math.max(retiroProgramado, pensionMinima);
  const rentaFinal = Math.max(rentaVitalicia, pensionMinima);

  return {
    saldoFinal: saldo,
    aporteTotal,
    aporteMes,
    comisionMes,
    fondoGarantia,
    totalAportado: aporteMes * 12 * aniosCotizar + saldoActual,
    totalComisiones: comisionMes * 12 * aniosCotizar,
    rendimiento: saldo - (aporteMes * 12 * aniosCotizar + saldoActual),
    retiroProgramado: retiroFinal,
    rentaVitalicia: rentaFinal,
    rentaMes: retiroFinal, // Default to retiro programado
    proyeccion,
    heredable: true,
    factorRP: factorRP.toFixed(1),
    factorRV: factorRV.toFixed(1),
  };
}

export default function PensionesColpensiones({ trm }) {
  const [sexo, setSexo] = useState("M");
  const [edad, setEdad] = useState(40);
  const [semanas, setSemanas] = useState(800);
  const [ibcSM, setIbcSM] = useState(10);
  const [iblPromSM, setIblPromSM] = useState(0); // Promedio últimos 10 años (0 = usar IBC actual)
  const [ipc, setIpc] = useState(5.5);
  const [privSaldo, setPrivSaldo] = useState(200_000_000);
  const [privRend, setPrivRend] = useState(8);
  const [aportesVol, setAportesVol] = useState(0); // Aportes voluntarios mensuales
  const [bonoPensional, setBonoPensional] = useState(0); // Bono si se trasladó
  const [tab, setTab] = useState("colp"); // colp | rais | comparar

  const edadJub = sexo === "F" ? 57 : 62;
  const aniosFaltantes = Math.max(0, edadJub - edad);

  const colp = useMemo(() => calcColpensiones({
    sexo, edad, semanasActuales: semanas, ibcSM, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, ipc, edadJub,
  }), [sexo, edad, semanas, ibcSM, iblPromSM, ipc, edadJub]);

  const colpJub = useMemo(() => calcColpensiones({
    sexo, edad, semanasActuales: semanas + aniosFaltantes * 52, ibcSM, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, ipc, edadJub,
  }), [sexo, edad, semanas, ibcSM, iblPromSM, ipc, edadJub, aniosFaltantes]);

  const rais = useMemo(() => calcRAIS({
    saldoActual: privSaldo, ibcSM, rendAnual: privRend, aniosCotizar: aniosFaltantes, aportesVolMes: aportesVol, bonoPensional, sexo,
  }), [privSaldo, ibcSM, privRend, aniosFaltantes, aportesVol, bonoPensional, sexo]);

  const tabs = [
    { id: "colp", icon: "🏛️", label: "Colpensiones" },
    { id: "rais", icon: "🏦", label: "Fondo Privado" },
    { id: "comparar", icon: "⚖️", label: "Comparar" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: T.blue }}>Simulador de Pensiones — Colombia</h1>
          <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Cálculo actuarial • Ley 100/1993 • Ley 797/2003 • SMMLV 2026: {fCOP(SM_2026)}</p>
        </div>
        <button onClick={() => { document.body.setAttribute("data-date", new Date().toLocaleDateString("es-CO")); window.print(); }} style={{ background: T.blue, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>📄 Exportar PDF</button>
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
          <In label="Aportes voluntarios" value={aportesVol} onChange={setAportesVol} unit="COP/mes" min={0} />
          <In label="IBL promedio 10 años (SMMLV)" value={iblPromSM} onChange={setIblPromSM} unit="SMMLV" min={0} max={25} step={0.5} />
          <In label="Bono pensional (traslado)" value={bonoPensional} onChange={setBonoPensional} unit="COP" min={0} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: T.txt3, lineHeight: 1.5 }}>
          💡 <strong>IBL promedio:</strong> Si dejaste en 0, se usa tu IBC actual. Para mayor precisión, ingresa el promedio de tus últimos 10 años de cotización en SMMLV.
          {aportesVol > 0 && <><br/>💰 <strong>Aportes voluntarios:</strong> {fCOP(aportesVol)}/mes se suman al ahorro RAIS (no afectan Colpensiones).</>}
          {bonoPensional > 0 && <><br/>📋 <strong>Bono pensional:</strong> {fCOP(bonoPensional)} se suma al saldo inicial del fondo privado.</>}
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
                <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Si paras de cotizar hoy</div>
                {aniosFaltantes > 0 && <div style={{ borderTop: "1px solid " + T.border, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase" }}>Al jubilarte ({edad + aniosFaltantes} años)</div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: T.green, letterSpacing: "-0.04em", marginTop: 4 }}>{fCOP(colpJub.pensionFinal)}</div>
                  <div style={{ fontSize: 12, color: T.txt2, marginTop: 2 }}>Tasa: {pc(colpJub.tasaTotal)} • {colpJub.semanasTotales.toLocaleString()} semanas</div>
                </div>}
                <div style={{ fontSize: 14, color: T.txt3, marginTop: 8 }}>≈ {fUSD(colp.pensionFinal, trm)}</div>
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

          {/* ═══ HITOS DE SEMANAS — Como un actuario ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 6 }}>📊 Hitos de Semanas — ¿Cuánto ganas por seguir cotizando?</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 8px" }}>
              Por cada <strong>50 semanas</strong> adicionales después de 1,300 → tu tasa sube <strong>1.5%</strong>. Tope: 80%.
            </p>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>
              Con IBL topado en 25 SMMLV, cada bloque de 50 semanas agrega ~<strong>{fCOP(colp.IBL * 0.015)}</strong>/mes a tu pensión.
            </p>

            {/* Milestone table like an actuary would show */}
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Semanas","Extras","Bloques×50","Bonus","Tasa total","Pensión bruta","Neta (−12%)","Estado"].map(h => (
                      <th key={h} style={{ padding: "8px 6px", textAlign: h === "Estado" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "2px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1300,1350,1400,1450,1500,1550,1600,1650,1700,1750,1800,1850,1900,1950,2000,2100,2150].map(sem => {
                    const extras = Math.max(0, sem - 1300);
                    const bloques = Math.floor(extras / 50);
                    const bonus = bloques * 1.5;
                    const s = colp.IBL / SM_2026;
                    let tasaB = 65.50 - 0.50 * s;
                    if (tasaB < 55) tasaB = 55;
                    const tasaT = Math.min(tasaB + bonus, 80);
                    const bruta = colp.IBL * tasaT / 100;
                    const tope = 25 * SM_2026;
                    const aplicada = Math.min(bruta, tope);
                    const neta = aplicada * 0.88;
                    const esActual = Math.abs(sem - colp.semanasTotales) < 25;
                    const esAlcanzable = sem <= colp.semanasTotales + aniosFaltantes * 52;
                    const yaAlcanzo = sem <= colp.semanasTotales;
                    const esTope = tasaT >= 80;
                    return (
                      <tr key={sem} style={{ background: esActual ? T.blue + "15" : esTope ? T.green + "08" : "transparent", borderBottom: "1px solid " + T.border }}>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: esActual ? 800 : 600, color: esActual ? T.blue : T.txt }}>{sem.toLocaleString()}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.txt3 }}>{extras > 0 ? "+" + extras : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.green }}>{bloques}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.green, fontWeight: 600 }}>+{bonus.toFixed(1)}%</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: esTope ? T.green : T.blue, fontSize: 13 }}>{tasaT.toFixed(1)}%</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace" }}>{fCOP(bruta)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: T.blue }}>{fCOP(neta)}</td>
                        <td style={{ padding: "8px 6px", fontSize: 11, color: yaAlcanzo ? T.green : esAlcanzable ? T.orange : T.txt3 }}>
                          {esActual ? "← Tú estás aquí" : yaAlcanzo ? "✅ Ya alcanzado" : esAlcanzable ? "📅 Alcanzable" : esTope ? "🏆 Tope 80%" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Cd>

          {/* ═══ ANÁLISIS ACTUARIAL ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>🧮 Análisis Actuarial — ¿Vale la pena seguir cotizando?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 8 }}>📋 Tu situación actual</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                    Semanas cotizadas: <strong>{semanas.toLocaleString()}</strong><br/>
                    Semanas al jubilarte: <strong>{colp.semanasTotales.toLocaleString()}</strong><br/>
                    Semanas extras (sobre 1,300): <strong>{colp.semanasExtra}</strong><br/>
                    Bloques de 50: <strong>{Math.floor(colp.semanasExtra / 50)}</strong><br/>
                    Tasa actual: <strong style={{ color: T.blue }}>{pc(colp.tasaTotal)}</strong><br/>
                    Pensión proyectada: <strong style={{ color: T.blue }}>{fCOP(colp.pensionFinal)}/mes</strong>
                  </div>
                </div>
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 8 }}>💡 Costo de cada bloque</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                    Cada 50 semanas (~1 año) te compra:<br/>
                    <strong style={{ color: T.green }}>+1.5% de tasa = +{fCOP(colp.IBL * 0.015 * 0.88)}/mes neto</strong><br/><br/>
                    Aportas: {fCOP(colp.IBC * 0.16)}/mes × 12 = <strong>{fCOP(colp.IBC * 0.16 * 12)}/año</strong><br/><br/>
                    Ganancia: {fCOP(colp.IBL * 0.015 * 0.88)} × 12 meses × 20 años =<br/>
                    <strong style={{ color: T.green }}>{fCOP(colp.IBL * 0.015 * 0.88 * 12 * 20)} en pensión total</strong><br/><br/>
                    vs Costo: {fCOP(colp.IBC * 0.16 * 12)}<br/>
                    <strong style={{ color: T.green }}>Retorno: {((colp.IBL * 0.015 * 0.88 * 12 * 20) / (colp.IBC * 0.16 * 12)).toFixed(1)}x tu inversión</strong>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>🎯 Para llegar al 80% (tope máximo)</div>
                  {(() => {
                    const tasaActual = colp.tasaTotal;
                    const falta = Math.max(0, 80 - tasaActual);
                    const bloquesNecesarios = Math.ceil(falta / 1.5);
                    const semanasNecesarias = bloquesNecesarios * 50;
                    const aniosNecesarios = (semanasNecesarias / 52).toFixed(1);
                    const pensionAl80 = Math.min(colp.IBL * 0.80, 25 * SM_2026) * 0.88;
                    return (
                      <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                        Te falta: <strong style={{ color: T.orange }}>{pc(falta)}</strong> para llegar al 80%<br/>
                        Necesitas: <strong>{bloquesNecesarios} bloques</strong> × 50 = <strong>{semanasNecesarias.toLocaleString()} semanas</strong><br/>
                        Equivale a: <strong>~{aniosNecesarios} años</strong> más cotizando<br/><br/>
                        Pensión al 80%: <strong style={{ color: T.green }}>{fCOP(pensionAl80)}/mes</strong><br/>
                        vs tu actual: {fCOP(colp.pensionFinal)}/mes<br/>
                        Diferencia: <strong style={{ color: T.green }}>+{fCOP(pensionAl80 - colp.pensionFinal)}/mes</strong>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.05))", border: "1px solid " + T.green + "20", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>📌 Recomendación actuarial</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
                    {colp.tasaTotal >= 75 ? (
                      <span>Estás muy cerca del tope. <strong style={{ color: T.green }}>Sigue cotizando al tope de 25 SMMLV</strong> hasta alcanzar el 80%. La diferencia es significativa.</span>
                    ) : colp.tasaTotal >= 65 ? (
                      <span>Tu tasa es buena. Cada año adicional agrega ~{fCOP(colp.IBL * 0.015 * 0.88)}/mes a tu pensión. <strong style={{ color: T.blue }}>Vale la pena seguir al tope si puedes.</strong></span>
                    ) : colp.tasaTotal >= 55 ? (
                      <span>Tu tasa está en el rango base. <strong style={{ color: T.orange }}>Cada 50 semanas extras son valiosas</strong> — no dejes de cotizar si puedes mantener el IBC alto.</span>
                    ) : (
                      <span style={{ color: T.orange }}>Aún no cumples los requisitos mínimos. Enfócate en llegar a 1,300 semanas.</span>
                    )}
                    <br/><br/>
                    <strong>Regla clave:</strong> No sobrecotizar por encima de 25 SMMLV agregados. No baja beneficio. Mantener el IBC al tope es lo que importa.
                  </div>
                </div>
              </div>
            </div>
          </Cd>

          {/* ═══ ESCENARIOS: SI SIGO PAGANDO X AÑOS MÁS ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 6 }}>📅 ¿Qué pasa si sigo cotizando X años más?</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>
              Hoy tienes <strong style={{ color: T.blue }}>{semanas.toLocaleString()} semanas</strong>. Cada año sumas ~52 semanas. Mira cómo cambia tu pensión:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Si pago...","Tendrás","Semanas","Extras","Bloques","Tasa","Pensión neta","Ganas vs hoy","En 20 años"].map(h => (
                      <th key={h} style={{ padding: "10px 8px", textAlign: h === "Si pago..." ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "2px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const hoy = calcColpensiones({ sexo, edad, semanasActuales: semanas, ibcSM, ipc, edadJub });
                    const aniosArr = [0, 1, 2, 3, 5, 7, 10, 15, Math.max(0, edadJub - edad)].filter((v, i, a) => v >= 0 && a.indexOf(v) === i).sort((a, b) => a - b);
                    return aniosArr.map(a => {
                      const semFuturas = semanas + a * 52;
                      const sc = calcColpensiones({ sexo, edad, semanasActuales: semFuturas, ibcSM, ipc, edadJub });
                      const diff = sc.pensionFinal - hoy.pensionFinal;
                      const esHoy = a === 0;
                      const esJub = a === Math.max(0, edadJub - edad);
                      const total20 = sc.pensionFinal * 12 * 20;
                      return (
                        <tr key={a} style={{ background: esJub ? T.blue + "10" : esHoy ? T.bg3 : "transparent", borderBottom: "1px solid " + T.border }}>
                          <td style={{ padding: "10px 8px", fontWeight: 700, color: esJub ? T.blue : esHoy ? T.orange : T.txt }}>
                            {esHoy ? "🔵 Paro hoy" : esJub ? "🏆 Hasta jubilación (" + a + "a)" : a + " año" + (a > 1 ? "s" : "") + " más"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>{edad + a} años</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{semFuturas.toLocaleString()}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: sc.semanasExtra > 0 ? T.green : T.txt3 }}>{sc.semanasExtra > 0 ? "+" + sc.semanasExtra : "—"}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: T.green }}>{Math.floor(sc.semanasExtra / 50)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 13, color: sc.tasaTotal >= 70 ? T.green : sc.tasaTotal >= 60 ? T.blue : T.orange }}>{pc(sc.tasaTotal)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: T.blue, fontSize: 14 }}>{fCOP(sc.pensionFinal)}/mes</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: diff > 0 ? T.green : T.txt3, fontWeight: 600 }}>
                            {esHoy ? "—" : diff > 0 ? "+" + fCOP(diff) + "/mes" : "igual"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", color: T.txt2 }}>{fCOP(total20)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, padding: 14, background: T.bg3, borderRadius: 10, fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
              <strong style={{ color: T.green }}>📖 Cómo leer esta tabla:</strong> Si hoy tienes {semanas.toLocaleString()} semanas y pagas <strong>5 años más</strong>, acumulas {(semanas + 5 * 52).toLocaleString()} semanas.
              {(() => {
                const sc5 = calcColpensiones({ sexo, edad, semanasActuales: semanas + 5 * 52, ibcSM, ipc, edadJub });
                const hoy2 = calcColpensiones({ sexo, edad, semanasActuales: semanas, ibcSM, ipc, edadJub });
                return ` Tu tasa sube de ${pc(hoy2.tasaTotal)} a ${pc(sc5.tasaTotal)} y tu pensión pasa de ${fCOP(hoy2.pensionFinal)} a ${fCOP(sc5.pensionFinal)}/mes — una diferencia de ${fCOP(sc5.pensionFinal - hoy2.pensionFinal)}/mes de por vida.`;
              })()}
            </div>
          </Cd>

          {/* ═══ FÓRMULA DEL 1.5% EXPLICADA ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <div style={{ background: T.orange + "10", border: "1px solid " + T.orange + "30", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
              <strong style={{ color: T.orange }}>⚠️ Nota importante:</strong> El IBL (Ingreso Base de Liquidación) se calcula como el promedio de los últimos 10 años de cotización. Si no has cotizado al nivel actual durante 10+ años, tu pensión real para "Paro hoy" será <strong>menor</strong> que la proyectada aquí. La proyección "Hasta jubilación" es más precisa porque asume que seguirás cotizando al nivel actual. Para un cálculo exacto con tu historial real, consulta un actuario profesional.
            </div>
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
              <Row l="Aporte a tu cuenta (11.5%)" v={fCOP(rais.aporteMes)} sub="De 16% total: 11.5% ahorro + 3% admin + 1.5% garantía" color={T.green} />
              <Row l="Rendimiento anual" v={privRend + "%"} />
              <Row l={"Años cotizando más"} v={aniosFaltantes + " años"} />
              <Row l="Total a tu cuenta" v={fCOP(rais.totalAportado)} />
              <Row l="Total comisiones AFP" v={fCOP(rais.totalComisiones)} color={T.red} sub="3% del IBC por administración y seguros" />
              <Row l="Rendimientos ganados" v={fCOP(rais.rendimiento)} color={T.green} />
              <Row l="Saldo final proyectado" v={fCOP(rais.saldoFinal)} color={T.green} bold />
            </Cd>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Cd glow={T.green} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Retiro Programado</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: T.green, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(rais.retiroProgramado)}</div>
                <div style={{ fontSize: 13, color: T.txt3, marginTop: 4 }}>≈ {fUSD(rais.retiroProgramado, trm)}</div>
                <div style={{ fontSize: 12, color: T.txt2, marginTop: 8, lineHeight: 1.6 }}>Heredable • Saldo en AFP • Tasa 4% real</div>
                <div style={{ borderTop: "1px solid " + T.border, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase" }}>Renta Vitalicia (aseguradora)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.blue, marginTop: 4 }}>{fCOP(rais.rentaVitalicia)}</div>
                  <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>No heredable • Pago fijo de por vida • Tasa 3% real</div>
                </div>
              </Cd>

              <Cd style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>✅ Ventajas Fondo Privado</div>
                {[
                  { t: "100% heredable — tu familia recibe el saldo", c: T.green },
                  { t: "Retiro anticipado posible (cumpliendo requisitos)", c: T.green },
                  { t: "Rendimientos de mercado (pueden ser mayores)", c: T.blue },
                  { t: "Riesgo de mercado — rendimientos no garantizados", c: T.orange },
                  { t: "Pensión mínima garantizada (1 SMMLV) si cumple requisitos", c: T.blue },
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
