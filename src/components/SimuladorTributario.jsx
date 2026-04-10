import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const UVT = 52374;
const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24", bg4: "#252530",
  border: "rgba(255,255,255,0.06)", txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee",
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

const DEDUC_JUR = { "Nómina": 1, "Honorarios": 1, "Vivienda": 1, "Servicios": 1, "Mantenimiento": 1, "Seguros": 1, "Transporte": 1, "Predial": 1, "Representación": 1, "Tecnología": 1, "Educación": 1, "Seguridad Social": 1 };
const NO_DEDUC = ["Alimentación","Entretenimiento","Personal","Vestimenta","Mascotas","Deporte","Ahorro"];
const DEDUC_NAT = { "Salud": 1, "Vivienda": 1, "Seguros": 0.5 };
const LIM_NAT = { "Salud": 16 * UVT * 12, "Vivienda": 100 * UVT * 12, "Seguros": 16 * UVT * 12 };

const CAT_LABELS = { "Salario": "💼", "Honorarios": "📋", "Arriendo": "🏠", "Rendimiento": "💰", "Dividendos": "📊", "Inversión": "🏦", "Pensión": "🏛️", "Negocio": "🏢", "Otro": "📝" };

const Cd = ({ children, style: s }) => <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", ...s }}>{children}</div>;
const Kpi = ({ label, value, sub, color, big }) => (
  <div style={{ padding: big ? "20px 16px" : "14px 16px", textAlign: "center" }}>
    <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: big ? 28 : 20, fontWeight: 800, color: color || T.txt, marginTop: 4, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>{sub}</div>}
  </div>
);

function OwnerPlan({ owner, ingresos, gastos, inv, deu, trm, isJ, mb }) {
  const calc = useMemo(() => {
    const ingAnual = ingresos.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
    if (ingAnual <= 0) return null;

    // Gastos by category
    const gastosByCat = {};
    let gastosDeducTotal = 0, gastosTotal = 0;
    gastos.forEach(g => {
      const cat = g.cat || "Otro";
      const m = g.m || 0;
      gastosTotal += m;
      const pct = isJ ? (NO_DEDUC.includes(cat) ? 0 : (DEDUC_JUR[cat] || 0.5)) : (DEDUC_NAT[cat] || 0);
      let deducMes = m * pct;
      if (!isJ && LIM_NAT[cat]) deducMes = Math.min(deducMes, LIM_NAT[cat] / 12);
      gastosDeducTotal += deducMes;
      if (!gastosByCat[cat]) gastosByCat[cat] = { total: 0, deduc: 0, pct };
      gastosByCat[cat].total += m;
      gastosByCat[cat].deduc += deducMes;
    });

    // Ingresos by cat
    const ingByCat = {};
    ingresos.forEach(i => {
      const cat = i.categoria || "Otro";
      const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1);
      ingByCat[cat] = (ingByCat[cat] || 0) + m;
    });

    // Intereses deudas
    const intereses = deu.reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
    // Depreciación
    const deprec = inv.reduce((s, i) => {
      const tp = (i.tp || i.tipo || "").toLowerCase();
      if (/real estate|bodega|local|oficina/i.test(tp)) return s + (i.va || 0) * 0.05;
      if (/vehículo|vehiculo/i.test(tp)) return s + (i.va || 0) * 0.20;
      return s;
    }, 0);

    // Patrimonio
    const patTotal = inv.reduce((s, i) => s + (+i.va || 0), 0);
    const deuTotal = deu.reduce((s, d) => s + (d.mt || 0), 0);

    if (isJ) {
      // ═══ JURÍDICA ═══
      const gastosDeducAnual = gastosDeducTotal * 12;
      const totalDeduc = gastosDeducAnual + intereses + deprec;
      const utilidadActual = Math.max(0, ingAnual - totalDeduc);
      const impActual = utilidadActual * 0.35;
      const tasaActual = ingAnual > 0 ? (impActual / ingAnual * 100) : 0;

      // CON ESTRATEGIA: estimar gastos faltantes típicos
      const pctGastos = ingAnual > 0 ? (totalDeduc / ingAnual * 100) : 0;
      const gastosEsperados = ingAnual * 0.55; // Una empresa bien gestionada ~55% gastos
      const gastosAdicionales = Math.max(0, gastosEsperados - totalDeduc);
      const utilidadOptima = Math.max(0, ingAnual - Math.max(totalDeduc, gastosEsperados));
      const impOptimo = utilidadOptima * 0.35;
      const ahorro = impActual - impOptimo;

      // Recomendaciones
      const recs = [];
      if (!gastosByCat["Nómina"]) recs.push({ icon: "👥", title: "Nómina y empleados", desc: "Salarios y prestaciones son 100% deducibles. Cada $1M en nómina ahorra $350K en impuestos.", impact: 0, color: T.blue });
      if (!gastosByCat["Honorarios"]) recs.push({ icon: "📋", title: "Honorarios profesionales", desc: "Contador, abogado, revisor fiscal. Registra estos gastos como deducibles.", impact: 0, color: T.blue });
      if (!gastosByCat["Mantenimiento"]) recs.push({ icon: "🔧", title: "Mantenimiento de propiedades", desc: "Reparaciones, pintura, plomería — todo deducible para inmuebles de la empresa.", impact: 0, color: T.blue });
      if (!gastosByCat["Predial"]) recs.push({ icon: "🏛️", title: "Predial e impuestos locales", desc: "Predial, ICA, contribuciones — impuestos pagados son deducibles.", impact: 0, color: T.blue });
      if (pctGastos < 40) recs.push({ icon: "⚠️", title: "Gastos registrados: " + pctGastos.toFixed(0) + "% de ingresos", desc: "Una empresa operativa típica tiene 40-70% en gastos. Revisa si faltan gastos por registrar.", impact: ahorro > 0 ? ahorro : 0, color: T.orange });

      return { type: "juridica", ingAnual, ingByCat, gastosByCat, gastosTotal, gastosDeducTotal, totalDeduc, intereses, deprec, patTotal, deuTotal, utilidad: utilidadActual, impActual, tasaActual, pctGastos, impOptimo, ahorro, recs };
    } else {
      // ═══ PERSONA NATURAL ═══
      const salAnual = ingresos.filter(i => i.categoria === "Salario").reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const honAnual = ingresos.filter(i => i.categoria === "Honorarios").reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const noConst = salAnual * 0.08 + honAnual * 0.40 * 0.08;
      const neto = ingAnual - noConst;
      const exenta25 = Math.min(neto * 0.25, 790 * UVT);

      // Deducciones actuales
      const gastoEduc = gastos.filter(g => g.cat === "Educación").reduce((s, g) => s + (g.m || 0), 0);
      const deducDep = gastoEduc > 500000 ? Math.min(ingAnual * 0.10, 384 * UVT) : 0;
      const interesesHip = deu.filter(d => /hipoteca|vivienda|casa|apto|mortgage/i.test((d.tp || "") + (d.n || ""))).reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
      const deducViv = Math.min(interesesHip, 1200 * UVT);
      const gastosDeducNat = gastos.reduce((s, g) => { const p = DEDUC_NAT[g.cat] || 0; let a = (g.m || 0) * p * 12; if (LIM_NAT[g.cat]) a = Math.min(a, LIM_NAT[g.cat]); return s + a; }, 0);

      const lim40 = neto * 0.40;

      // ── SIN ESTRATEGIA: solo deducciones actuales ──
      const benefSin = exenta25 + gastosDeducNat + deducDep + deducViv;
      const benAplicSin = Math.min(benefSin, lim40);
      const rentaSin = Math.max(0, neto - benAplicSin);
      const impSin = calcImp(rentaSin / UVT);
      const tasaSin = ingAnual > 0 ? (impSin / ingAnual * 100) : 0;

      // ── CON ESTRATEGIA: llenar el tope 40% ──
      const espacioOpt = Math.max(0, lim40 - benefSin);
      const pvMax = Math.min(espacioOpt, neto * 0.25, 2500 * UVT);
      const espacioPost = Math.max(0, lim40 - benefSin - pvMax);
      const afcMax = Math.min(espacioPost, neto * 0.30, 3800 * UVT);
      const benefCon = benefSin + pvMax + afcMax;
      const benAplicCon = Math.min(benefCon, lim40);
      const rentaCon = Math.max(0, neto - benAplicCon);
      const impCon = calcImp(rentaCon / UVT);
      const ahorro = impSin - impCon;
      const tasaCon = ingAnual > 0 ? (impCon / ingAnual * 100) : 0;
      const pctUsado = lim40 > 0 ? (benAplicSin / lim40 * 100) : 0;

      // Recomendaciones
      const recs = [];
      if (pvMax > 500000) recs.push({ icon: "💰", title: "Pensión voluntaria", desc: "Aporta " + fm(pvMax / 12) + "/mes a un fondo de pensión voluntaria. Es exento de renta y ahorras para el futuro. Retirable después de 10 años.", impact: calcImp(rentaSin / UVT) - calcImp(Math.max(0, rentaSin - pvMax) / UVT), color: T.green });
      if (afcMax > 500000) recs.push({ icon: "🏠", title: "Cuenta AFC", desc: "Ahorra " + fm(afcMax / 12) + "/mes en una Cuenta AFC. Exento si se usa para compra de vivienda.", impact: calcImp(Math.max(0, rentaSin - pvMax) / UVT) - impCon, color: T.blue });
      if (!gastosByCat["Salud"] && ingAnual > 2000 * UVT) recs.push({ icon: "🏥", title: "Medicina prepagada", desc: "Deducible hasta " + fm(16 * UVT) + "/mes. Regístrala en Gastos → Salud.", impact: 0, color: T.purple });
      if (deducDep > 0) recs.push({ icon: "👨‍👩‍👧", title: "Dependientes: " + fm(deducDep) + "/año", desc: "Ya se está deduciendo 10% del ingreso por dependientes (gastos educación detectados).", impact: 0, color: T.green });
      if (deducViv > 0) recs.push({ icon: "🏠", title: "Intereses vivienda: " + fm(deducViv) + "/año", desc: "Los intereses de tu hipoteca ya se deducen automáticamente.", impact: 0, color: T.green });
      if (ingAnual > 400e6 && !recs.find(r => r.title.includes("SAS"))) recs.push({ icon: "🏢", title: "Evalúa una estructura societaria", desc: "Con ingresos altos, una SAS puede optimizar tu carga fiscal canalizando ingresos por la empresa (35% sobre utilidad vs hasta 39% persona natural).", impact: 0, color: T.purple });

      return {
        type: "natural", ingAnual, ingByCat, gastosByCat, gastosTotal, gastosDeducTotal, gastosDeducNat, patTotal, deuTotal,
        noConst, neto, exenta25, deducDep, deducViv, lim40,
        benefSin, benAplicSin, rentaSin, impSin: impSin, tasaSin,
        pvMax, afcMax, benefCon, benAplicCon, rentaCon, impCon, tasaCon, ahorro, pctUsado,
        recs
      };
    }
  }, [ingresos, gastos, inv, deu, trm, isJ]);

  if (!calc) return (
    <Cd style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{isJ ? "🏢" : "👤"}</span>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>{owner.name}</div><div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica" : "Persona Natural"}</div></div>
      </div>
      <div style={{ padding: 20, textAlign: "center", color: T.txt3, fontSize: 13 }}>No hay ingresos asignados. Ve a <strong style={{ color: T.blue }}>💰 Ingresos</strong> y asigna <strong>{owner.name}</strong> como propietario.</div>
    </Cd>
  );

  const impActual = isJ ? calc.impActual : calc.impSin;
  const impOptimo = isJ ? calc.impOptimo : calc.impCon;
  const ahorro = calc.ahorro;
  const tasaActual = isJ ? calc.tasaActual : calc.tasaSin;
  const tasaOptima = isJ ? (calc.ingAnual > 0 ? calc.impOptimo / calc.ingAnual * 100 : 0) : calc.tasaCon;

  const barData = [
    { name: "Actual", value: Math.round(impActual / 12), fill: T.red },
    { name: "Con estrategia", value: Math.round(impOptimo / 12), fill: T.green },
  ];

  return (
    <Cd style={{ marginBottom: 20, overflow: "visible" }}>
      {/* Header */}
      <div style={{ padding: mb ? "16px" : "20px 24px", borderBottom: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{isJ ? "🏢" : "👤"}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{owner.name}</div>
            <div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica — Tarifa 35%" : "Persona Natural — Tabla Art. 241 ET"}</div>
          </div>
        </div>
        {ahorro > 100000 && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "8px 16px" }}>
            <div style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>AHORRO POTENCIAL</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{fm(ahorro)}/año</div>
          </div>
        )}
      </div>

      {/* KPIs: Actual vs Estrategia */}
      <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr auto 1fr", gap: 0 }}>
        {/* Sin Estrategia */}
        <div style={{ padding: "16px 20px", background: "rgba(239,68,68,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", marginBottom: 12 }}>📋 Situación Actual</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>{fm(impActual)}<span style={{ fontSize: 12, fontWeight: 400, color: T.txt3 }}>/año</span></div>
          <div style={{ fontSize: 13, color: T.txt3 }}>{fm(impActual / 12)}/mes • Tasa: {(tasaActual || 0).toFixed(1)}%</div>

          <div style={{ marginTop: 16, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: T.txt2, marginBottom: 6 }}>Desglose:</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.txt2 }}><span>Ingresos brutos</span><span style={{ fontFamily: "monospace" }}>{fm(calc.ingAnual)}/año</span></div>
            {isJ ? <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green }}><span>(-) Gastos deducibles</span><span style={{ fontFamily: "monospace" }}>{fm(calc.totalDeduc)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.txt2 }}><span style={{ paddingLeft: 12, fontSize: 10, color: T.txt3 }}>Gastos: {fm(calc.gastosDeducTotal * 12)} • Intereses: {fm(calc.intereses)} • Deprec: {fm(calc.deprec)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 4 }}><span>Utilidad gravable</span><span style={{ fontFamily: "monospace" }}>{fm(calc.utilidad)}</span></div>
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>Gastos = {(calc.pctGastos || 0).toFixed(0)}% de ingresos</div>
            </> : <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.blue }}><span>(-) Aportes obligatorios</span><span style={{ fontFamily: "monospace" }}>{fm(calc.noConst)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green }}><span>(-) Renta exenta 25%</span><span style={{ fontFamily: "monospace" }}>{fm(calc.exenta25)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green }}><span>(-) Deducciones</span><span style={{ fontFamily: "monospace" }}>{fm(calc.gastosDeducNat + calc.deducDep + calc.deducViv)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 4 }}><span>Renta gravable</span><span style={{ fontFamily: "monospace" }}>{fm(calc.rentaSin)}</span></div>
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>Tope 40% usado: {(calc.pctUsado || 0).toFixed(0)}%</div>
            </>}
          </div>
        </div>

        {/* Arrow */}
        {!mb && <div style={{ display: "flex", alignItems: "center", padding: "0 12px", fontSize: 24, color: T.green }}>→</div>}

        {/* Con Estrategia */}
        <div style={{ padding: "16px 20px", background: "rgba(34,197,94,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", marginBottom: 12 }}>🎯 Con Estrategia</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(impOptimo)}<span style={{ fontSize: 12, fontWeight: 400, color: T.txt3 }}>/año</span></div>
          <div style={{ fontSize: 13, color: T.txt3 }}>{fm(impOptimo / 12)}/mes • Tasa: {(tasaOptima || 0).toFixed(1)}%</div>

          <div style={{ marginTop: 16, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: T.txt2, marginBottom: 6 }}>Optimizaciones aplicadas:</div>
            {isJ ? <>
              {calc.pctGastos < 50 && <div style={{ padding: "4px 0", color: T.green }}>✅ Registrar gastos faltantes (~55% ingresos)</div>}
              <div style={{ padding: "4px 0", color: T.green }}>✅ Intereses de deudas deducidos</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Depreciación de activos aplicada</div>
            </> : <>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Renta exenta 25% ({fm(calc.exenta25)})</div>
              {calc.deducDep > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Dependientes ({fm(calc.deducDep)})</div>}
              {calc.deducViv > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Intereses vivienda ({fm(calc.deducViv)})</div>}
              {calc.pvMax > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Pensión voluntaria ({fm(calc.pvMax / 12)}/mes)</div>}
              {calc.afcMax > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Cuenta AFC ({fm(calc.afcMax / 12)}/mes)</div>}
              <div style={{ padding: "4px 0", color: T.green, fontWeight: 600 }}>→ Tope 40% al 100%</div>
            </>}
          </div>
        </div>
      </div>

      {/* Savings bar */}
      {ahorro > 100000 && (
        <div style={{ padding: "12px 20px", background: T.bg3, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <ResponsiveContainer width="100%" height={50}>
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.txt3 }}>Reducción</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{ahorro > 0 ? "-" + (ahorro / impActual * 100).toFixed(0) + "%" : "0%"}</div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {calc.recs.length > 0 && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid " + T.border }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 10 }}>💡 Plan de acción ({calc.recs.length} recomendaciones)</div>
          {calc.recs.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < calc.recs.length - 1 ? "1px solid " + T.border : "none" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.title}</div>
                <div style={{ fontSize: 11, color: T.txt2, marginTop: 2, lineHeight: 1.5 }}>{r.desc}</div>
                {r.impact > 100000 && <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginTop: 4 }}>Ahorro estimado: {fm(r.impact)}/año ({fm(r.impact / 12)}/mes)</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 20px", borderTop: "1px solid " + T.border, fontSize: 9, color: T.txt3, textAlign: "center" }}>
        Estimación basada en datos registrados • Normativa DIAN vigente • Consulta tu contador para la declaración oficial
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
  const sinAsignar = ing.filter(i => !i.owner || i.owner === "").length;

  const gastosFlat = [];
  Object.entries(gas).forEach(([cat, items]) => { (items || []).forEach(g => gastosFlat.push({ ...g, cat })); });

  // Calculate totals for summary
  let totalActual = 0, totalOptimo = 0;
  const ownerData = owners.map(ow => {
    const oIng = ing.filter(i => i.owner === ow.id);
    const oGas = gastosFlat.filter(g => g.owner === ow.id);
    const oInv = inv.filter(i => i.owner === ow.id);
    const oDeu = deu.filter(d => d.owner === ow.id);
    return { owner: ow, ing: oIng, gas: oGas, inv: oInv, deu: oDeu };
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: mb ? 20 : 26, fontWeight: 800, margin: "0 0 4px", color: T.orange }}>🧾 Planeación Tributaria</h1>
        <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Colombia 2026 • Estatuto Tributario • UVT: {fm(UVT)} • Ley 2277/2022</p>
        <p style={{ fontSize: 12, color: T.txt2, margin: "8px 0 0", lineHeight: 1.5 }}>Radiografía fiscal de cada propietario: situación actual vs optimización con estrategia tributaria.</p>
      </div>

      {sinAsignar > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: T.orange, lineHeight: 1.6 }}>
          ⚠️ <strong>{sinAsignar} ingreso(s)</strong> sin propietario asignado — no se incluyen en el cálculo. Asigna propietario en <strong>💰 Ingresos</strong>.
        </div>
      )}

      {/* Owner cards */}
      {ownerData.map(od => (
        <OwnerPlan key={od.owner.id} owner={od.owner} ingresos={od.ing} gastos={od.gas} inv={od.inv} deu={od.deu} trm={trm} isJ={od.owner.type === "juridica"} mb={mb} />
      ))}

      <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Estimaciones basadas en la normativa tributaria colombiana vigente. UVT 2026: {fm(UVT)} (Resolución DIAN 000238). No constituye asesoría fiscal profesional.
      </div>
    </div>
  );
}
