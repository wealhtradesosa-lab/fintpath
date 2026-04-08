import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

/* ═══════════════════════════════════════════════════
   SIMULADOR TRIBUTARIO COLOMBIA 2026
   Estatuto Tributario • Ley 2277/2022 • UVT 2026
   ═══════════════════════════════════════════════════ */

const UVT_2026 = 49799; // Valor UVT 2026
const SM_2026 = 1750905;
const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24", bg4: "#2a2a32",
  border: "rgba(255,255,255,0.06)", txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee",
};
const fCOP = (v) => {
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  return "$" + Math.round(v).toLocaleString("es-CO");
};
const pc = (v) => (v || 0).toFixed(1) + "%";

// Tabla de tarifas de renta personas naturales 2026 (Art. 241 ET)
const TABLA_RENTA = [
  { desde: 0,     hasta: 1090,  tarifa: 0,    base: 0 },
  { desde: 1090,  hasta: 1700,  tarifa: 19,   base: 0 },
  { desde: 1700,  hasta: 4100,  tarifa: 28,   base: 115.86 },
  { desde: 4100,  hasta: 8670,  tarifa: 33,   base: 787.86 },
  { desde: 8670,  hasta: 18970, tarifa: 35,   base: 2295.96 },
  { desde: 18970, hasta: 31000, tarifa: 37,   base: 5900.96 },
  { desde: 31000, hasta: Infinity, tarifa: 39, base: 10352.96 },
];

function calcImpuesto(baseGravableUVT) {
  for (let i = TABLA_RENTA.length - 1; i >= 0; i--) {
    const r = TABLA_RENTA[i];
    if (baseGravableUVT > r.desde) {
      const exceso = baseGravableUVT - r.desde;
      const impuestoUVT = r.base + exceso * (r.tarifa / 100);
      return { impuestoUVT, impuestoPesos: impuestoUVT * UVT_2026, rango: r, rangoIdx: i };
    }
  }
  return { impuestoUVT: 0, impuestoPesos: 0, rango: TABLA_RENTA[0], rangoIdx: 0 };
}

const Cd = ({ children, style: s }) => (
  <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", ...s }}>{children}</div>
);
const Row = ({ l, v, color, bold, sub, tip }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }} title={tip || ""}>
    <div><span style={{ fontSize: 13, color: T.txt2 }}>{l}</span>{sub && <div style={{ fontSize: 10, color: T.txt3 }}>{sub}</div>}</div>
    <span style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: color || T.txt, fontFamily: "monospace" }}>{v}</span>
  </div>
);
const In = ({ label, value, onChange, unit, min, max, step, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={min || 0} max={max} step={step || 1}
        style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none" }} />
      {unit && <span style={{ fontSize: 11, color: T.txt3, minWidth: 40 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 10, color: T.txt3, marginTop: 3 }}>{sub}</div>}
  </div>
);

export default function SimuladorTributario({ trm }) {
  const [salarioMes, setSalarioMes] = useState(15000000);
  const [otrosIngresos, setOtrosIngresos] = useState(0);
  const [pensionVol, setPensionVol] = useState(0);
  const [afc, setAfc] = useState(0);
  const [dependientes, setDependientes] = useState(0);
  const [medicinaPrepagada, setMedicinaPrepagada] = useState(0);
  const [interesesVivienda, setInteresesVivienda] = useState(0);
  const [donaciones, setDonaciones] = useState(0);

  const calc = useMemo(() => {
    const salarioAnual = salarioMes * 12;
    const ingresoBrutoAnual = salarioAnual + otrosIngresos * 12;

    // ═══ INGRESOS NO CONSTITUTIVOS DE RENTA ═══
    const aporteSaludOblig = salarioAnual * 0.04; // 4% salud empleado
    const aportePensionOblig = salarioAnual * 0.04; // 4% pensión empleado
    const totalNoConstitutivo = aporteSaludOblig + aportePensionOblig;
    const ingresoNeto = ingresoBrutoAnual - totalNoConstitutivo;

    // ═══ RENTAS EXENTAS (Art. 206 ET) ═══
    // 25% del ingreso laboral (limitado a 790 UVT anuales = 240 UVT mensuales)
    const renta25pct = Math.min(ingresoNeto * 0.25, 790 * UVT_2026);

    // ═══ DEDUCCIONES ═══
    // Dependientes: 10% ingreso bruto, máx 32 UVT/mes = 384 UVT/año
    const deducDependientes = dependientes > 0 ? Math.min(ingresoBrutoAnual * 0.10, 384 * UVT_2026) : 0;
    // Medicina prepagada: máx 16 UVT/mes = 192 UVT/año
    const deducMedicina = Math.min(medicinaPrepagada * 12, 192 * UVT_2026);
    // Intereses vivienda: máx 100 UVT/mes = 1200 UVT/año
    const deducVivienda = Math.min(interesesVivienda * 12, 1200 * UVT_2026);
    // Donaciones: máx 25% renta líquida
    const deducDonaciones = donaciones * 12;
    const totalDeducciones = deducDependientes + deducMedicina + deducVivienda + deducDonaciones;

    // ═══ RENTAS EXENTAS ADICIONALES ═══
    // Pensión voluntaria: exenta hasta 25% ingreso o 2500 UVT/año
    const pensionVolAnual = pensionVol * 12;
    const exentaPensionVol = Math.min(pensionVolAnual, ingresoNeto * 0.25, 2500 * UVT_2026);
    // AFC: exenta hasta 30% ingreso o 3800 UVT/año
    const afcAnual = afc * 12;
    const exentaAFC = Math.min(afcAnual, ingresoNeto * 0.30, 3800 * UVT_2026);

    // ═══ LÍMITE GLOBAL 40% (Art. 336 ET - Ley 2277/2022) ═══
    // Deducciones + Rentas exentas NO pueden superar el 40% del ingreso neto
    const totalBeneficios = renta25pct + totalDeducciones + exentaPensionVol + exentaAFC;
    const limite40 = ingresoNeto * 0.40;
    const beneficioAplicado = Math.min(totalBeneficios, limite40);

    // ═══ RENTA LÍQUIDA GRAVABLE ═══
    const rentaLiquida = Math.max(0, ingresoNeto - beneficioAplicado);
    const rentaLiquidaUVT = rentaLiquida / UVT_2026;

    // ═══ IMPUESTO ═══
    const imp = calcImpuesto(rentaLiquidaUVT);
    const impuestoAnual = imp.impuestoPesos;
    const impuestoMes = impuestoAnual / 12;
    const tasaEfectiva = ingresoBrutoAnual > 0 ? (impuestoAnual / ingresoBrutoAnual) * 100 : 0;

    // ═══ ESCENARIO SIN OPTIMIZACIÓN ═══
    const rentaSinOpt = Math.max(0, ingresoNeto - renta25pct);
    const impSinOpt = calcImpuesto(rentaSinOpt / UVT_2026);
    const ahorro = impSinOpt.impuestoPesos - impuestoAnual;

    // ═══ RECOMENDACIONES ═══
    const recs = [];
    const espacioPensionVol = Math.max(0, Math.min(ingresoNeto * 0.25, 2500 * UVT_2026) - pensionVolAnual);
    const espacioAFC = Math.max(0, Math.min(ingresoNeto * 0.30, 3800 * UVT_2026) - afcAnual);
    const espacioGlobal = Math.max(0, limite40 - beneficioAplicado);

    if (espacioGlobal > 0 && espacioPensionVol > 0 && pensionVolAnual === 0) {
      const aporteRec = Math.min(espacioPensionVol, espacioGlobal);
      const impConAporte = calcImpuesto(Math.max(0, rentaLiquida - aporteRec) / UVT_2026);
      recs.push({ t: "💰 Aporte a pensión voluntaria", d: "Puedes aportar hasta " + fCOP(aporteRec / 12) + "/mes y ahorrar ~" + fCOP((impuestoAnual - impConAporte.impuestoPesos)) + "/año en impuestos.", ahorro: impuestoAnual - impConAporte.impuestoPesos, color: T.green });
    }
    if (espacioGlobal > 0 && espacioAFC > 0 && afcAnual === 0) {
      const aporteRec = Math.min(espacioAFC, espacioGlobal);
      const impConAporte = calcImpuesto(Math.max(0, rentaLiquida - aporteRec) / UVT_2026);
      recs.push({ t: "🏠 Cuenta AFC (Ahorro para el Fomento de Construcción)", d: "Abre una cuenta AFC y ahorra hasta " + fCOP(aporteRec / 12) + "/mes. Ahorro: ~" + fCOP((impuestoAnual - impConAporte.impuestoPesos)) + "/año.", ahorro: impuestoAnual - impConAporte.impuestoPesos, color: T.blue });
    }
    if (dependientes === 0 && ingresoBrutoAnual > 1090 * UVT_2026) {
      recs.push({ t: "👨‍👩‍👧 Dependientes", d: "Si tienes hijos menores, padres o cónyuge a cargo, puedes deducir hasta " + fCOP(384 * UVT_2026 / 12) + "/mes.", ahorro: 0, color: T.purple });
    }
    if (medicinaPrepagada === 0 && ingresoBrutoAnual > 2000 * UVT_2026) {
      recs.push({ t: "🏥 Medicina prepagada", d: "Si pagas medicina prepagada, puedes deducir hasta " + fCOP(16 * UVT_2026) + "/mes.", ahorro: 0, color: T.cyan });
    }
    if (totalBeneficios > limite40) {
      recs.push({ t: "⚠️ Tope del 40% alcanzado", d: "Ya usas el máximo de beneficios tributarios permitidos. No puedes deducir más (" + fCOP(totalBeneficios - limite40) + " no aplicados).", ahorro: 0, color: T.orange });
    }
    if (recs.length === 0 && impuestoAnual > 0) {
      recs.push({ t: "✅ Buena optimización", d: "Estás aprovechando tus beneficios tributarios. Tu tasa efectiva es " + pc(tasaEfectiva) + ".", ahorro: 0, color: T.green });
    }

    return {
      ingresoBrutoAnual, salarioAnual, totalNoConstitutivo, ingresoNeto,
      renta25pct, deducDependientes, deducMedicina, deducVivienda, deducDonaciones,
      totalDeducciones, exentaPensionVol, exentaAFC, totalBeneficios, limite40,
      beneficioAplicado, rentaLiquida, rentaLiquidaUVT,
      impuestoAnual, impuestoMes, tasaEfectiva, rango: imp.rango, rangoIdx: imp.rangoIdx,
      ahorro, recs, espacioGlobal,
    };
  }, [salarioMes, otrosIngresos, pensionVol, afc, dependientes, medicinaPrepagada, interesesVivienda, donaciones]);

  const pieData = [
    { name: "Impuesto", value: calc.impuestoAnual, color: T.red },
    { name: "Beneficios tributarios", value: calc.beneficioAplicado, color: T.green },
    { name: "No constitutivo", value: calc.totalNoConstitutivo, color: T.blue },
    { name: "Neto después de impuesto", value: Math.max(0, calc.ingresoBrutoAnual - calc.impuestoAnual - calc.totalNoConstitutivo - calc.beneficioAplicado), color: T.txt3 },
  ].filter(d => d.value > 0);

  const tablaRango = TABLA_RENTA.map((r, i) => ({
    rango: r.hasta === Infinity ? ">" + r.desde.toLocaleString() : r.desde.toLocaleString() + " – " + r.hasta.toLocaleString(),
    tarifa: r.tarifa + "%",
    enPesos: r.hasta === Infinity ? ">" + fCOP(r.desde * UVT_2026) : fCOP(r.desde * UVT_2026) + " – " + fCOP(r.hasta * UVT_2026),
    activo: i === calc.rangoIdx,
  }));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: T.orange }}>Simulador Tributario — Colombia 2026</h1>
          <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Estatuto Tributario • Ley 2277/2022 • UVT 2026: {fCOP(UVT_2026)}</p>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
        <Cd style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📋 Tus Ingresos</h3>
          <In label="Salario mensual" value={salarioMes} onChange={setSalarioMes} unit="COP" sub={"= " + fCOP(salarioMes * 12) + "/año"} />
          <In label="Otros ingresos/mes" value={otrosIngresos} onChange={setOtrosIngresos} unit="COP" sub="Arriendos, honorarios, dividendos" />

          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 14px" }}>💰 Beneficios Tributarios</h3>
          <In label="Pensión voluntaria/mes" value={pensionVol} onChange={setPensionVol} unit="COP" sub={"Exenta hasta " + fCOP(Math.min(calc.ingresoNeto * 0.25, 2500 * UVT_2026) / 12) + "/mes"} />
          <In label="Cuenta AFC/mes" value={afc} onChange={setAfc} unit="COP" sub={"Exenta hasta " + fCOP(Math.min(calc.ingresoNeto * 0.30, 3800 * UVT_2026) / 12) + "/mes"} />

          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 14px" }}>📝 Deducciones</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Dependientes</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setDependientes(n)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${dependientes === n ? T.green : T.border}`, background: dependientes === n ? T.green + "15" : T.bg3, color: dependientes === n ? T.green : T.txt2, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>{n}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 3 }}>Hijos, cónyuge o padres a cargo</div>
          </div>
          <In label="Medicina prepagada/mes" value={medicinaPrepagada} onChange={setMedicinaPrepagada} unit="COP" sub={"Máx " + fCOP(16 * UVT_2026) + "/mes"} />
          <In label="Intereses vivienda/mes" value={interesesVivienda} onChange={setInteresesVivienda} unit="COP" sub={"Máx " + fCOP(100 * UVT_2026) + "/mes"} />
          <In label="Donaciones/mes" value={donaciones} onChange={setDonaciones} unit="COP" sub="A entidades autorizadas" />
        </Cd>

        {/* Results */}
        <div>
          {/* Big number */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Cd style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Impuesto de Renta Anual</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: T.red, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(calc.impuestoAnual)}</div>
              <div style={{ fontSize: 14, color: T.txt3, marginTop: 4 }}>{fCOP(calc.impuestoMes)}/mes</div>
              <div style={{ fontSize: 13, color: T.orange, marginTop: 8, fontWeight: 600 }}>Tasa efectiva: {pc(calc.tasaEfectiva)}</div>
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Rango: {calc.rango.tarifa}% (marginal)</div>
            </Cd>

            <Cd style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ahorro por Beneficios</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: T.green, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(calc.ahorro)}</div>
              <div style={{ fontSize: 14, color: T.txt3, marginTop: 4 }}>{fCOP(calc.ahorro / 12)}/mes</div>
              <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Espacio restante: {fCOP(calc.espacioGlobal)}</div>
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Límite 40%: {fCOP(calc.limite40)}</div>
            </Cd>
          </div>

          {/* Distribution pie */}
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Distribución de tu Ingreso Bruto</div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={2}>{pieData.map((p, i) => <Cell key={i} fill={p.color} />)}</Pie></PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, fontSize: 12 }}>
                {pieData.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + T.border }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                      <span style={{ color: T.txt2 }}>{p.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{fCOP(p.value)}</span>
                      <span style={{ color: T.txt3, fontSize: 10 }}>{calc.ingresoBrutoAnual > 0 ? pc(p.value / calc.ingresoBrutoAnual * 100) : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Cd>

          {/* Cálculo detallado */}
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 Cálculo Detallado</h3>
            <Row l="Ingreso bruto anual" v={fCOP(calc.ingresoBrutoAnual)} bold />
            <Row l="(-) Aportes obligatorios" v={"- " + fCOP(calc.totalNoConstitutivo)} color={T.blue} sub="Salud 4% + Pensión 4%" />
            <Row l="= Ingreso neto" v={fCOP(calc.ingresoNeto)} bold />
            <div style={{ height: 8 }} />
            <Row l="(-) Renta exenta 25%" v={"- " + fCOP(calc.renta25pct)} color={T.green} sub={"Máx 790 UVT/año = " + fCOP(790 * UVT_2026)} />
            {calc.exentaPensionVol > 0 && <Row l="(-) Pensión voluntaria" v={"- " + fCOP(calc.exentaPensionVol)} color={T.green} />}
            {calc.exentaAFC > 0 && <Row l="(-) Cuenta AFC" v={"- " + fCOP(calc.exentaAFC)} color={T.green} />}
            {calc.deducDependientes > 0 && <Row l="(-) Dependientes" v={"- " + fCOP(calc.deducDependientes)} color={T.green} />}
            {calc.deducMedicina > 0 && <Row l="(-) Medicina prepagada" v={"- " + fCOP(calc.deducMedicina)} color={T.green} />}
            {calc.deducVivienda > 0 && <Row l="(-) Intereses vivienda" v={"- " + fCOP(calc.deducVivienda)} color={T.green} />}
            {calc.deducDonaciones > 0 && <Row l="(-) Donaciones" v={"- " + fCOP(calc.deducDonaciones)} color={T.green} />}
            <Row l="Total beneficios" v={fCOP(calc.totalBeneficios)} sub={calc.totalBeneficios > calc.limite40 ? "⚠️ Excede tope 40% → aplicado: " + fCOP(calc.beneficioAplicado) : "Dentro del tope 40%"} color={calc.totalBeneficios > calc.limite40 ? T.orange : T.green} />
            <div style={{ height: 8 }} />
            <Row l="= Renta líquida gravable" v={fCOP(calc.rentaLiquida)} bold sub={Math.round(calc.rentaLiquidaUVT).toLocaleString() + " UVT"} />
            <Row l="= IMPUESTO DE RENTA" v={fCOP(calc.impuestoAnual)} color={T.red} bold />
          </Cd>

          {/* Tabla de tarifas */}
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 Tabla de Tarifas (Art. 241 ET)</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Rango (UVT)", "En pesos", "Tarifa"].map(h => (
                    <th key={h} style={{ padding: "8px", textAlign: h === "Tarifa" ? "right" : "left", color: T.txt3, fontWeight: 600, fontSize: 10, textTransform: "uppercase", borderBottom: "2px solid " + T.border }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tablaRango.map((r, i) => (
                  <tr key={i} style={{ background: r.activo ? T.orange + "15" : "transparent", borderBottom: "1px solid " + T.border }}>
                    <td style={{ padding: "8px", fontWeight: r.activo ? 700 : 400, color: r.activo ? T.orange : T.txt2 }}>{r.activo ? "👉 " : ""}{r.rango}</td>
                    <td style={{ padding: "8px", fontSize: 11, color: r.activo ? T.txt : T.txt3 }}>{r.enPesos}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: r.activo ? T.orange : T.txt2 }}>{r.tarifa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cd>

          {/* Recomendaciones */}
          {calc.recs.length > 0 && (
            <Cd style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>💡 Recomendaciones para Optimizar</h3>
              {calc.recs.map((r, i) => (
                <div key={i} style={{ background: r.color + "08", border: "1px solid " + r.color + "20", borderRadius: 12, padding: 16, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.color, marginBottom: 4 }}>{r.t}</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>{r.d}</div>
                  {r.ahorro > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginTop: 6 }}>Ahorro potencial: {fCOP(r.ahorro)}/año ({fCOP(r.ahorro / 12)}/mes)</div>}
                </div>
              ))}
            </Cd>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Este simulador es una herramienta informativa basada en la normativa tributaria colombiana vigente (ET, Ley 2277/2022). Los resultados son estimaciones y no constituyen asesoría fiscal. Consulta a un contador certificado para tu declaración de renta.
      </div>
    </div>
  );
}
