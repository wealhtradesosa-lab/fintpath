import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/* ═══════════════════════════════════════════════════
   PLANEACIÓN TRIBUTARIA COLOMBIA 2026
   Estatuto Tributario • Ley 2277/2022 • UVT $52,374
   ═══════════════════════════════════════════════════ */

const UVT = 52374;
const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  border: "rgba(255,255,255,0.06)", txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308",
};
const fm = (v) => {
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  return "$" + Math.round(v).toLocaleString("es-CO");
};

const TABLA = [
  { d: 0, h: 1090, t: 0, b: 0 }, { d: 1090, h: 1700, t: 19, b: 0 },
  { d: 1700, h: 4100, t: 28, b: 115.86 }, { d: 4100, h: 8670, t: 33, b: 787.86 },
  { d: 8670, h: 18970, t: 35, b: 2295.96 }, { d: 18970, h: 31000, t: 37, b: 5900.96 },
  { d: 31000, h: Infinity, t: 39, b: 10352.96 },
];
const calcImp = (uvtBase) => { for (let i = TABLA.length - 1; i >= 0; i--) { if (uvtBase > TABLA[i].d) return (TABLA[i].b + (uvtBase - TABLA[i].d) * TABLA[i].t / 100) * UVT; } return 0; };

const DEDUC_NAT = { "Salud": 1, "Vivienda": 1, "Seguros": 0.5, "Pensión voluntaria": 1, "Seguridad Social": 0 };
const DEDUC_JUR = { "Vivienda": 1, "Servicios": 1, "Transporte": 1, "Seguros": 1, "Educación": 0.5, "Salud prepagada": 0, "Seguridad social": 0, "Impuestos": 1, "Otro": 0.5 };
const LIM_NAT = { "Salud": 16 * UVT, "Vivienda": 100 * UVT, "Seguros": 16 * UVT, "Pensión voluntaria": 208 * UVT };

const CAT_FISCAL_LABELS = { "Salario": "💼 Salario", "Honorarios": "📋 Honorarios", "Arriendo": "🏠 Arrendamiento", "Rendimiento": "💰 Rendimientos", "Dividendos": "📊 Dividendos", "Inversión": "🏦 Inversión", "Pensión": "🏛️ Pensión", "Negocio": "🏢 Negocio", "Otro": "📝 Otros" };

const Cd = ({ children, style: s }) => (
  <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", ...s }}>{children}</div>
);

function OwnerCard({ owner, ingresos, gastos, inv, deu, trm, isJ, mb }) {
  const [showOpt, setShowOpt] = useState(false);

  const calc = useMemo(() => {
    // Ingresos por categoría fiscal
    const ingByCat = {};
    let ingTotal = 0;
    ingresos.forEach(i => {
      const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1);
      const cat = i.categoria || "otros";
      ingByCat[cat] = (ingByCat[cat] || 0) + m;
      ingTotal += m;
    });
    const ingAnual = ingTotal * 12;

    // Gastos por categoría + deducibilidad
    const noDeducJ = ["Alimentación","Entretenimiento","Personal","Vestimenta","Mascotas","Deporte"];
    const reglas = isJ ? DEDUC_JUR : DEDUC_NAT;
    const limites = isJ ? null : LIM_NAT;
    const gastosByCat = {};
    let gastosTotal = 0, gastosDeducTotal = 0;
    gastos.forEach(g => {
      const cat = g.cat || "Otro";
      const m = g.m || 0;
      gastosTotal += m;
      const pct = reglas[cat] || 0;
      let deducMes = m * pct;
      if (limites && limites[cat]) deducMes = Math.min(deducMes, limites[cat]);
      gastosDeducTotal += deducMes;
      if (!gastosByCat[cat]) gastosByCat[cat] = { total: 0, deduc: 0, pct };
      gastosByCat[cat].total += m;
      gastosByCat[cat].deduc += deducMes;
    });
    const gastosDeducAnual = gastosDeducTotal * 12;

    // Patrimonio de este owner
    const patTotal = inv.reduce((s, i) => s + (+i.va || 0), 0);
    const deuTotal = deu.reduce((s, d) => s + (d.mt || 0), 0);

    let impuesto = 0, baseGravable = 0, tasaEfectiva = 0;
    let detalleCalc = [];

    if (isJ) {
      // Jurídica: solo gastos registrados por el usuario
      const interesesJ = deu.reduce((s,d) => s + (d.mt||0) * ((d.ts||d.tasa||0)/100), 0);
      const deprecJ = inv.reduce((s,i) => {
        const tp = (i.tp||i.tipo||"").toLowerCase();
        if (/real estate|bodega|local|oficina/i.test(tp)) return s + (i.va||0)*0.05;
        if (/vehículo|vehiculo/i.test(tp)) return s + (i.va||0)*0.20;
        return s;
      }, 0);
      
      // TODOS los gastos asignados a esta empresa son deducibles
      const totalGastos = gastos.reduce((s,g) => s + (g.m||0), 0) * 12;
      const totalDeduc = totalGastos + interesesJ + deprecJ;
      const utilidad = Math.max(0, ingAnual - totalDeduc);
      impuesto = utilidad * 0.35;
      baseGravable = utilidad;
      const pctGastos = ingAnual > 0 ? (totalDeduc / ingAnual * 100) : 0;
      detalleCalc = [
        { l: "Ingresos brutos anuales", v: ingAnual, bold: true },
        ...(totalGastos > 0 ? [{ l: "(-) Gastos operativos registrados", v: -totalGastos, color: T.green, sub: gastos.length + " gastos asignados a esta empresa" }] : []),
        ...(interesesJ > 0 ? [{ l: "(-) Intereses de deudas", v: -interesesJ, color: T.green }] : []),
        ...(deprecJ > 0 ? [{ l: "(-) Depreciación activos", v: -deprecJ, color: T.green, sub: "Inmuebles 5%/año, vehículos 20%/año" }] : []),
        { l: "Total deducciones", v: null, sub: fm(totalDeduc) + " (" + pctGastos.toFixed(0) + "% de ingresos)", color: pctGastos < 30 ? T.orange : T.green },
        ...(pctGastos < 30 ? [{ l: "⚠️ Pocos gastos registrados", v: null, sub: "Solo el " + pctGastos.toFixed(0) + "% de los ingresos son gastos. Una empresa típica tiene 40-70%. Registra en 💳 Gastos: nómina, servicios, seguros, mantenimiento, predial, energía, admin.", color: T.orange }] : []),
        { l: "= Utilidad gravable", v: utilidad, bold: true },
        { l: "Tarifa renta (35%)", v: null, sub: "Régimen general sociedades colombianas" },
        { l: "= IMPUESTO DE RENTA", v: impuesto, color: T.red, bold: true },
      ];
    } else {
      // ── Persona Natural: cálculo completo como contador ──
      // Separar salario vs independiente para aportes
      const salAnual = ingresos.filter(i => i.categoria === "Salario").reduce((s,i) => s + (i.mensual||0), 0) * 12;
      const honAnual = ingresos.filter(i => i.categoria === "Honorarios").reduce((s,i) => s + (i.mensual||0), 0) * 12;
      const otrosAnual = ingAnual - salAnual - honAnual;
      
      // No constitutivo: 8% salario + 8% del 40% de honorarios
      const noConst = salAnual * 0.08 + honAnual * 0.40 * 0.08;
      const neto = ingAnual - noConst;
      const exenta25 = Math.min(neto * 0.25, 790 * UVT);
      
      // Dependientes
      const gastoEduc = gastos.filter(g => g.cat === "Educación").reduce((s,g) => s + (g.m||0), 0);
      const deducDep = gastoEduc > 500000 ? Math.min(ingAnual * 0.10, 384 * UVT) : 0;
      
      // Intereses hipoteca
      const interesesHip = deu.reduce((s,d) => {
        if (/mortgage|hipoteca|vivienda|casa|apto/i.test((d.tp||"")+(d.n||"")))
          return s + (d.mt||0) * ((d.ts||d.tasa||0)/100);
        return s;
      }, 0);
      const deducViv = Math.min(interesesHip, 1200 * UVT);
      
      const totalDeduc = gastosDeducAnual + deducDep + deducViv;
      const totalBenef = exenta25 + totalDeduc;
      const lim40 = neto * 0.40;
      
      // Contador llena tope con PV + AFC
      const espacio = Math.max(0, lim40 - totalBenef);
      const pv = Math.min(espacio, neto * 0.25, 2500 * UVT);
      const afcEsp = Math.max(0, lim40 - totalBenef - pv);
      const afcVal = Math.min(afcEsp, neto * 0.30, 3800 * UVT);
      
      const totalConOpt = totalBenef + pv + afcVal;
      const benAplic = Math.min(totalConOpt, lim40);
      const excedido = totalConOpt > lim40;
      baseGravable = Math.max(0, neto - benAplic);
      impuesto = calcImp(baseGravable / UVT);
      detalleCalc = [
        { l: "Ingresos brutos anuales", v: ingAnual, bold: true },
        { l: "(-) Aportes obligatorios", v: -noConst, color: T.blue, sub: "Salario 8% + Independiente 3.2%" },
        { l: "= Ingreso neto", v: neto, bold: true },
        { l: "(-) Renta exenta 25%", v: -exenta25, color: T.green, sub: "Máx 790 UVT = " + fm(790 * UVT) },
        ...(gastosDeducAnual > 0 ? [{ l: "(-) Gastos deducibles DIAN", v: -gastosDeducAnual, color: T.green, sub: "Salud, seguros" }] : []),
        ...(deducDep > 0 ? [{ l: "(-) Dependientes", v: -deducDep, color: T.green, sub: "10% ingreso, máx 384 UVT" }] : []),
        ...(deducViv > 0 ? [{ l: "(-) Intereses vivienda", v: -deducViv, color: T.green, sub: "Hipoteca, máx 1200 UVT" }] : []),
        ...(pv > 0 ? [{ l: "(-) Pensión voluntaria*", v: -pv, color: T.green, sub: "Optimización del contador" }] : []),
        ...(afcVal > 0 ? [{ l: "(-) Cuenta AFC*", v: -afcVal, color: T.green, sub: "Optimización del contador" }] : []),
        { l: "Tope 40% del ingreso neto", v: null, sub: "Máximo: " + fm(lim40) + " | Usado: " + fm(benAplic), color: excedido ? T.orange : T.green },
        { l: "= Renta líquida gravable", v: baseGravable, bold: true, sub: Math.round(baseGravable / UVT).toLocaleString() + " UVT" },
        { l: "→ Tabla Art. 241 ET", v: null, sub: "Tarifa marginal: " + (TABLA.find((r, i) => baseGravable / UVT > r.d && (i === TABLA.length - 1 || baseGravable / UVT <= TABLA[i].h))?.t || 0) + "%" },
        { l: "= IMPUESTO DE RENTA", v: impuesto, color: T.red, bold: true },
        ...(pv > 0 || afcVal > 0 ? [{ l: "* Incluye optimización tributaria", v: null, sub: "PV + AFC que un contador recomendaría para llenar el tope 40%", color: T.blue }] : []),
      ];
    }
    tasaEfectiva = ingAnual > 0 ? (impuesto / ingAnual * 100) : 0;

    // Optimizaciones
    const opts = [];
    if (!isJ) {
      const espacioGlobal = Math.max(0, (ingAnual - ingAnual * 0.08) * 0.40 - (Math.min((ingAnual - ingAnual * 0.08) * 0.25, 790 * UVT) + gastosDeducAnual));
      if (espacioGlobal > 100000) {
        const aportePV = Math.min(espacioGlobal, (ingAnual - ingAnual * 0.08) * 0.25, 2500 * UVT);
        if (aportePV > 0) {
          const newBase = Math.max(0, baseGravable - aportePV);
          const newImp = calcImp(newBase / UVT);
          const ahorro = impuesto - newImp;
          if (ahorro > 10000) opts.push({ icon: "💰", title: "Pensión voluntaria", desc: "Aporta hasta " + fm(aportePV / 12) + "/mes a un fondo de pensión voluntaria.", ahorro, color: T.green });
        }
        const aporteAFC = Math.min(espacioGlobal, (ingAnual - ingAnual * 0.08) * 0.30, 3800 * UVT);
        if (aporteAFC > 0) {
          const newBase2 = Math.max(0, baseGravable - aporteAFC);
          const newImp2 = calcImp(newBase2 / UVT);
          const ahorro2 = impuesto - newImp2;
          if (ahorro2 > 10000) opts.push({ icon: "🏠", title: "Cuenta AFC", desc: "Ahorra hasta " + fm(aporteAFC / 12) + "/mes en una Cuenta AFC (Ahorro para el Fomento de Construcción).", ahorro: ahorro2, color: T.blue });
        }
      }
      const tieneSalud = Object.keys(gastosByCat).includes("Salud");
      if (!tieneSalud && ingAnual > 1090 * UVT) {
        opts.push({ icon: "🏥", title: "Medicina prepagada", desc: "Si pagas medicina prepagada, es deducible hasta " + fm(16 * UVT) + "/mes. Regístrala en Gastos → categoría Salud.", ahorro: 0, color: T.purple });
      }
    } else {
      const gastosNoDeduc = gastos.filter(g => !(DEDUC_JUR[g.cat || "Otro"])).reduce((s, g) => s + (g.m || 0), 0);
      if (gastosNoDeduc > 0) {
        opts.push({ icon: "⚠️", title: "Gastos no deducibles", desc: fm(gastosNoDeduc) + "/mes en gastos personales no son deducibles para la empresa (Alimentación, Entretenimiento, etc.).", ahorro: 0, color: T.orange });
      }
    }

    return { ingTotal, ingAnual, ingByCat, gastosTotal, gastosDeducTotal, gastosDeducAnual, gastosByCat, patTotal, deuTotal, impuesto, baseGravable, tasaEfectiva, detalleCalc, opts };
  }, [ingresos, gastos, inv, deu, trm, isJ]);

  const pieData = [
    { name: "Impuesto", value: calc.impuesto, color: T.red },
    { name: "Neto", value: Math.max(0, calc.ingAnual - calc.impuesto), color: T.green },
  ].filter(d => d.value > 0);

  if (calc.ingAnual <= 0) return (
    <Cd style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{isJ ? "🏢" : "👤"}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{owner.name}</div>
          <div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica" : "Persona Natural"}</div>
        </div>
      </div>
      <div style={{ padding: 20, textAlign: "center", color: T.txt3, fontSize: 13 }}>
        No hay ingresos asignados a este propietario.<br />
        Ve a <strong style={{ color: T.blue }}>💰 Ingresos</strong> y asigna <strong>{owner.name}</strong> como propietario en cada ingreso que le corresponda.
      </div>
    </Cd>
  );

  return (
    <Cd style={{ padding: 0, marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: mb ? "16px" : "20px 24px", borderBottom: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: mb ? "flex-start" : "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{isJ ? "🏢" : "👤"}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{owner.name}</div>
            <div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica — Tarifa 35%" : "Persona Natural — Tabla Art. 241 ET"}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: mb ? 18 : 24, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>{fm(calc.impuesto)}/año</div>
          <div style={{ fontSize: 12, color: T.txt3 }}>{fm(calc.impuesto / 12)}/mes • Tasa: {calc.tasaEfectiva.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr 1fr", gap: 0 }}>
        {/* Left: Radiografía */}
        <div style={{ padding: mb ? 16 : 20, borderRight: mb ? "none" : "1px solid " + T.border, borderBottom: mb ? "1px solid " + T.border : "none" }}>
          {/* Ingresos */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 8 }}>💰 Ingresos ({ingresos.length} fuentes)</div>
          {Object.entries(calc.ingByCat).map(([cat, m]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: "1px solid " + T.border }}>
              <span style={{ color: T.txt2 }}>{CAT_FISCAL_LABELS[cat] || cat}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fm(m)}/mes</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
            <span>Total ingresos</span>
            <span style={{ color: T.green }}>{fm(calc.ingTotal)}/mes</span>
          </div>

          {/* Gastos deducibles */}
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginTop: 16, marginBottom: 8 }}>📝 Gastos deducibles</div>
          {Object.entries(calc.gastosByCat).filter(([, v]) => v.deduc > 0).map(([cat, v]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, borderBottom: "1px solid " + T.border }}>
              <span style={{ color: T.txt2 }}>{cat} <span style={{ color: T.txt3 }}>({v.pct === 1 ? "100%" : Math.round(v.pct * 100) + "%"})</span></span>
              <span style={{ fontFamily: "monospace", color: T.green }}>{fm(v.deduc)}/mes</span>
            </div>
          ))}
          {Object.entries(calc.gastosByCat).filter(([, v]) => v.deduc > 0).length === 0 && (
            <div style={{ fontSize: 11, color: T.txt3, padding: "8px 0" }}>No hay gastos deducibles registrados.</div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
            <span>Total deducible</span>
            <span style={{ color: T.green }}>{fm(calc.gastosDeducTotal)}/mes</span>
          </div>

          {/* Gastos no deducibles */}
          {Object.entries(calc.gastosByCat).filter(([, v]) => v.total > v.deduc).length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.txt3, marginTop: 12, marginBottom: 6 }}>Gastos no deducibles</div>
            {Object.entries(calc.gastosByCat).filter(([, v]) => v.total > v.deduc).map(([cat, v]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 10, color: T.txt3 }}>
                <span>{cat}</span>
                <span>{fm(v.total - v.deduc)}/mes</span>
              </div>
            ))}
          </>}

          {/* Patrimonio y deudas */}
          {(calc.patTotal > 0 || calc.deuTotal > 0) && <>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.purple, marginTop: 16, marginBottom: 8 }}>🏦 Patrimonio</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
              <span style={{ color: T.txt2 }}>Activos ({inv.length})</span>
              <span style={{ fontFamily: "monospace" }}>{fm(calc.patTotal)}</span>
            </div>
            {calc.deuTotal > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
              <span style={{ color: T.txt2 }}>Deudas ({deu.length})</span>
              <span style={{ fontFamily: "monospace", color: T.red }}>{fm(calc.deuTotal)}</span>
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, padding: "6px 0", borderTop: "1px solid " + T.border }}>
              <span>Patrimonio neto</span>
              <span>{fm(calc.patTotal - calc.deuTotal)}</span>
            </div>
          </>}
        </div>

        {/* Right: Cálculo + Pie */}
        <div style={{ padding: mb ? 16 : 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 90, height: 90 }}>
              <ResponsiveContainer width="100%" height={90}>
                <PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={24} outerRadius={40} paddingAngle={2}>{pieData.map((p, i) => <Cell key={i} fill={p.color} />)}</Pie></PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.txt3 }}>Del ingreso bruto</div>
              <div style={{ fontSize: 13 }}><span style={{ color: T.red, fontWeight: 700 }}>{calc.tasaEfectiva.toFixed(1)}%</span> va a impuestos</div>
              <div style={{ fontSize: 13 }}><span style={{ color: T.green, fontWeight: 700 }}>{(100 - calc.tasaEfectiva).toFixed(1)}%</span> queda neto</div>
            </div>
          </div>

          {/* Cálculo paso a paso */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📊 Cálculo del impuesto</div>
          {calc.detalleCalc.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: r.bold ? "2px solid " + T.border : "1px solid " + T.border }}>
              <div>
                <span style={{ fontSize: 11, color: r.color || T.txt2, fontWeight: r.bold ? 700 : 400 }}>{r.l}</span>
                {r.sub && <div style={{ fontSize: 9, color: T.txt3 }}>{r.sub}</div>}
              </div>
              {r.v !== null && <span style={{ fontSize: 12, fontWeight: r.bold ? 700 : 600, fontFamily: "monospace", color: r.color || T.txt }}>{r.v < 0 ? "- " + fm(Math.abs(r.v)) : fm(r.v)}</span>}
            </div>
          ))}

          {/* Optimizaciones */}
          {calc.opts.length > 0 && <>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, marginTop: 16, marginBottom: 8, cursor: "pointer" }} onClick={() => setShowOpt(!showOpt)}>
              💡 {calc.opts.length} oportunidad{calc.opts.length > 1 ? "es" : ""} de optimización {showOpt ? "▲" : "▼"}
            </div>
            {showOpt && calc.opts.map((o, i) => (
              <div key={i} style={{ background: o.color + "08", border: "1px solid " + o.color + "20", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: o.color }}>{o.icon} {o.title}</div>
                <div style={{ fontSize: 11, color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>{o.desc}</div>
                {o.ahorro > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginTop: 6 }}>Ahorro potencial: {fm(o.ahorro)}/año ({fm(o.ahorro / 12)}/mes)</div>}
              </div>
            ))}
          </>}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 24px", borderTop: "1px solid " + T.border, fontSize: 9, color: T.txt3, textAlign: "center" }}>
        Estimación basada en datos registrados. Clasificación DIAN automática. Consulta tu contador para la declaración oficial.
      </div>
    </Cd>
  );
}

export default function SimuladorTributario({ trm, user }) {
  const mb = typeof window !== "undefined" && window.innerWidth < 768;
  const owners = (user && user.owners) || [{ id: "own_1", name: "Personal", type: "natural" }];
  const ing = (user && user.ingresos) || [];
  const gas = user && user.gas ? user.gas : {};
  const inv = (user && user.inv) || [];
  const deu = (user && user.deu) || [];

  const sinClasificar = ing.filter(i => !i.categoria || i.categoria === "").length;

  // Build flat gastos array
  const gastosFlat = [];
  Object.entries(gas).forEach(([cat, items]) => {
    (items || []).forEach(g => gastosFlat.push({ ...g, cat }));
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: mb ? 18 : 24, fontWeight: 800, margin: "0 0 4px", color: T.orange }}>🧾 Planeación Tributaria — Colombia 2026</h1>
        <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Radiografía fiscal por propietario • Estatuto Tributario • UVT 2026: {fm(UVT)} • Ley 2277/2022</p>
      </div>

      {sinClasificar > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, fontSize: 12, color: T.orange, lineHeight: 1.6 }}>
          ⚠️ <strong>{sinClasificar} ingreso(s)</strong> sin clasificación fiscal. Para un cálculo más preciso, ve a <strong>💰 Ingresos</strong> y asigna <strong>Propietario</strong> + <strong>Clasificación DIAN</strong> a cada ingreso.
          Solo los ingresos clasificados se incluyen en el cálculo.
        </div>
      )}

      {/* Resumen global */}
      {(()=> {
        let totalImp = 0;
        owners.forEach(ow => {
          const oIng = ing.filter(i => {
            if (i.owner === "na") return false;
            if (i.owner === ow.id) return true;
            if (ow.id === "own_1" && (!i.owner || i.owner === "") && i.categoria && i.categoria !== "") return true;
            return false;
          });
          if (oIng.reduce((s, i) => s + (i.mensual || 0), 0) <= 0) return;
          totalImp++; // count owners with income
        });
        return totalImp > 1 ? (
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 Resumen Global</div>
            <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {owners.map(ow => {
                const oIng = ing.filter(i => {
                  if (i.owner === "na") return false;
                  if (i.owner === ow.id) return true;
                  if (ow.id === "own_1" && (!i.owner || i.owner === "") && i.categoria) return true;
                  return false;
                });
                const ingAnual = oIng.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
                if (ingAnual <= 0) return null;
                const isJ = ow.type === "juridica";
                const oGas = gastosFlat.filter(g => g.owner && g.owner === ow.id);
                const noDeducJ = ["Alimentación","Entretenimiento","Personal","Vestimenta","Mascotas","Deporte"];
    const reglas = isJ ? DEDUC_JUR : DEDUC_NAT;
                let gastosD = 0;
                oGas.forEach(g => { const p = reglas[g.cat || "Otro"] || 0; gastosD += (g.m || 0) * p; });
                const imp = isJ ? Math.max(0, ingAnual - gastosD * 12) * 0.35 : (()=> {
                  const nc = ingAnual * 0.08; const n = ingAnual - nc; const ex = Math.min(n * 0.25, 790 * UVT);
                  const bn = Math.min(ex + gastosD * 12, n * 0.4); return calcImp(Math.max(0, n - bn) / UVT);
                })();
                return (
                  <div key={ow.id} style={{ flex: 1, minWidth: 200, background: T.bg3, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{isJ ? "🏢" : "👤"} {ow.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.red, marginTop: 4 }}>{fm(imp)}/año</div>
                    <div style={{ fontSize: 10, color: T.txt3 }}>{fm(imp / 12)}/mes • {(ingAnual > 0 ? (imp / ingAnual * 100) : 0).toFixed(1)}% tasa</div>
                  </div>
                );
              })}
            </div>
          </Cd>
        ) : null;
      })()}

      {/* Card por cada propietario */}
      {owners.map(ow => {
        const oIng = ing.filter(i => {
          if (i.owner === "na") return false;
          if (i.owner === ow.id) return true;
          if (ow.id === "own_1" && (!i.owner || i.owner === "") && i.categoria && i.categoria !== "") return true;
          return false;
        });
        const oGas = gastosFlat.filter(g => g.owner && g.owner === ow.id);
        const oInv = inv.filter(i => i.owner && i.owner === ow.id);
        const oDeu = deu.filter(d => d.owner && d.owner === ow.id);
        return <OwnerCard key={ow.id} owner={ow} ingresos={oIng} gastos={oGas} inv={oInv} deu={oDeu} trm={trm} isJ={ow.type === "juridica"} mb={mb} />;
      })}

      <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.txt2, marginBottom: 8 }}>📋 ¿De dónde salen estos datos?</div>
        <div style={{ fontSize: 11, color: T.txt3, lineHeight: 1.8 }}>
          <strong style={{color: T.green}}>💰 Ingresos</strong> → Base gravable (solo los que tienen propietario asignado)<br/>
          <strong style={{color: T.red}}>💳 Gastos</strong> → Deducciones automáticas según categoría DIAN<br/>
          <strong style={{color: T.blue}}>📋 Deudas</strong> → Intereses deducibles (hipotecas)<br/>
          <strong style={{color: T.txt3}}>🏦 Patrimonio</strong> → No afecta este cálculo (la DIAN cobra sobre ingresos, no sobre patrimonio)<br/><br/>
          <strong>Sin propietario = no se calcula.</strong> Solo se incluyen los items que tú asignes explícitamente a un propietario fiscal.
        </div>
      </div>
      <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 10, lineHeight: 1.6 }}>
        Estimación con optimización tributaria (PV + AFC). UVT 2026: {fm(UVT)}. No constituye asesoría fiscal.
      </div>
    </div>
  );
}
