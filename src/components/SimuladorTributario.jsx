import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { estimarImpuesto } from "../lib/taxCO.js";
import { adapterOwnerPlan } from "../lib/ownerPlanAdapter.js";
import { getFiscalWarnings } from "../lib/normalize.js";
import { calcImpRenta as calcImpRentaCore } from "../lib/tablaArt241.js";
import { track } from "../lib/analytics.js";

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
// Tabla Art. 241 y cálculo centralizado en src/lib/tablaArt241.js.
// calcImp se usa solo para estimar el impact textual en 2 recomendaciones
// (Pensión Voluntaria y AFC). No afecta los números del motor.
const calcImp = (uvtBase) => calcImpRentaCore(uvtBase, UVT);

const DEDUC_JUR = { "Nómina": 1, "Honorarios": 1, "Vivienda": 1, "Servicios": 1, "Mantenimiento": 1, "Seguros": 1, "Transporte": 1, "Arrendamiento": 1, "Predial": 1, "Representación": 1, "Tecnología": 1, "Educación": 1, "Seguridad Social": 1, "Depreciación": 1 };
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

function OwnerPlan({ owner, ingresos, gastos, inv, deu, trm, isJ, mb, componenteInflacionarioPct }) {

  const calc = useMemo(() => {
    // Sprint 4B2 paso 2: swap del useMemo legacy (~335 líneas) por
    // adapterOwnerPlan que delega TODO el cálculo tributario al motor
    // estimarImpuesto() via adapter con aliases. Lo único local son los
    // recs (recomendaciones textuales) que dependen del tema de colores T
    // y de formato fm específico del componente.
    const fiscalData = adapterOwnerPlan({ owner, ingresos, gastos, inv, deu, trm, componenteInflacionarioPct });
    if (!fiscalData) return null;

    const recs = [];
    if (fiscalData.type === "juridica") {
      const gbc = fiscalData.gastosByCat || {};
      if (!gbc["Nómina"]) recs.push({ icon: "👥", title: "Nómina y empleados", desc: "Salarios y prestaciones son 100% deducibles. Cada $1M en nómina ahorra $350K en impuestos.", impact: 0, color: T.blue });
      if (!gbc["Honorarios"]) recs.push({ icon: "📋", title: "Honorarios profesionales", desc: "Contador, abogado, revisor fiscal. Registra estos gastos como deducibles.", impact: 0, color: T.blue });
      if (!gbc["Mantenimiento"]) recs.push({ icon: "🔧", title: "Mantenimiento de propiedades", desc: "Reparaciones, pintura, plomería — todo deducible para inmuebles de la empresa.", impact: 0, color: T.blue });
      if (!gbc["Predial"]) recs.push({ icon: "🏛️", title: "Predial e impuestos locales", desc: "Predial, ICA, contribuciones — impuestos pagados son deducibles.", impact: 0, color: T.blue });
      if ((fiscalData.pctGastos || 0) < 40) recs.push({ icon: "⚠️", title: "Gastos registrados: " + (fiscalData.pctGastos || 0).toFixed(0) + "% de ingresos", desc: "Una empresa operativa típica registra 40–70% de sus ingresos como gastos. Revisa si te faltan gastos operativos por registrar (nómina, honorarios, mantenimiento, servicios). Cada peso deducible real baja el impuesto en $0,35.", impact: 0, color: T.orange });
      if ((fiscalData.utilidad || 0) > 50e6) {
        recs.push({ icon: "🎁", title: "Bonificaciones a empleados (Art. 107 ET)", desc: "Primas extralegales y bonificaciones son deducibles si cumplen relación de causalidad, necesidad y proporcionalidad. Consulta con tu contador el monto viable según tu estructura de nómina.", impact: 0, color: T.purple });
        recs.push({ icon: "🤝", title: "Donaciones con descuento 25% (Art. 257 ET)", desc: "Donaciones a entidades sin ánimo de lucro calificadas dan un DESCUENTO del 25% del valor donado, directo del impuesto. El monto recomendable depende de tu estrategia fiscal — tu contador puede calcular el óptimo.", impact: 0, color: T.purple });
        recs.push({ icon: "📋", title: "Provisión de cartera (Art. 145 ET)", desc: "Provisión individual por deterioro de cartera: aplica si tienes cuentas por cobrar con más de 90 días. El monto deducible depende de tu cartera real — no hay porcentaje automático.", impact: 0, color: T.purple });
        recs.push({ icon: "🏗️", title: "Depreciación acelerada (Art. 137 ET)", desc: "Evalúa con tu contador aplicar depreciación acelerada en activos productivos. Reduce utilidad gravable hoy, difiere impuesto. Aplica solo a ciertos activos y tasas definidas por reglamento.", impact: 0, color: T.purple });
        recs.push({ icon: "🏦", title: "Apalancamiento financiero (Art. 117 ET)", desc: "Crédito para inversión productiva: los intereses son deducibles sujetos a subcapitalización. Consulta con tu contador antes de endeudarte solo por el beneficio fiscal.", impact: 0, color: T.purple });
        recs.push({ icon: "📈", title: "Reinvertir utilidades en activos productivos", desc: "Comprar equipos/vehículos genera depreciación deducible futura. Cada $100M en activos puede generar $20-33M/año en depreciación según vida útil.", impact: 0, color: T.purple });
        recs.push({ icon: "💰", title: "Distribuir dividendos estratégicamente", desc: "En vez de dejar utilidad en la empresa (35%), distribuir dividendos al socio tributa al 15% (>300 UVT). Si la persona natural tiene tasa efectiva menor al 35%, conviene distribuir.", impact: 0, color: T.purple });
      }
      if ((fiscalData.descuentoICA || 0) > 0) recs.push({ icon: "🏛️", title: "Descuento 50% del ICA: " + fm(fiscalData.descuentoICA), desc: "El 50% del ICA pagado se descuenta directamente del impuesto de renta (Art. 115 ET). No es deducción, es descuento — se resta del impuesto calculado.", impact: 0, color: T.green });
      if ((fiscalData.gmf50 || 0) > 0) recs.push({ icon: "💳", title: "GMF 4×1000 deducible: " + fm(fiscalData.gmf50), desc: "El 50% del GMF (4×1000) pagado es deducible de la renta. Se calcula automáticamente.", impact: 0, color: T.green });
    } else {
      const gbc = fiscalData.gastosByCat || {};
      const rentaSin = fiscalData.rentaSin || 0;
      const pvMax = fiscalData.pvMax || 0;
      const afcMax = fiscalData.afcMax || 0;
      const ingAnual = fiscalData.ingAnual || 0;
      const deducDep = fiscalData.deducDep || 0;
      const deducViv = fiscalData.deducViv || 0;
      const pctUsado = fiscalData.pctUsado || 0;
      const ahorro = fiscalData.ahorro || 0;
      const impCon = fiscalData.impCon || 0;
      if (pvMax > 500000) recs.push({ icon: "💰", title: "Pensión voluntaria", desc: "Aporta " + fm(pvMax / 12) + "/mes a un fondo de pensión voluntaria. Es exento de renta y ahorras para el futuro. Retirable después de 10 años.", impact: calcImp(rentaSin / UVT) - calcImp(Math.max(0, rentaSin - pvMax) / UVT), color: T.green });
      if (afcMax > 500000) recs.push({ icon: "🏠", title: "Cuenta AFC", desc: "Ahorra " + fm(afcMax / 12) + "/mes en una Cuenta AFC. Exento si se usa para compra de vivienda.", impact: calcImp(Math.max(0, rentaSin - pvMax) / UVT) - impCon, color: T.blue });
      if (!gbc["Salud"] && ingAnual > 2000 * UVT) recs.push({ icon: "🏥", title: "Medicina prepagada", desc: "Deducible hasta " + fm(16 * UVT) + "/mes. Regístrala en Gastos → Salud.", impact: 0, color: T.purple });
      if (deducDep > 0) recs.push({ icon: "👨‍👩‍👧", title: "Dependientes: " + fm(deducDep) + "/año", desc: "Ya se está deduciendo 10% del ingreso por dependientes (gastos educación detectados).", impact: 0, color: T.green });
      if (deducViv > 0) recs.push({ icon: "🏠", title: "Intereses vivienda: " + fm(deducViv) + "/año", desc: "Los intereses de tu hipoteca ya se deducen automáticamente.", impact: 0, color: T.green });
      const tieneArriendos = ingresos.some(i => /Arriendo/i.test(i.categoria || ""));
      const invInmuebles = inv.filter(i => /Real Estate|bodega|local|oficina/i.test((i.tp||i.tipo||"").toLowerCase()));
      if (tieneArriendos && invInmuebles.length > 0) {
        const deprecInmuebles = invInmuebles.reduce((s,i) => s + (i.va||0) * 0.0222, 0);
        recs.push({ icon: "🏠", title: "Depreciación de inmuebles arrendados (Art. 137 ET)", desc: "Tus inmuebles en arriendo se deprecian 2,22%/año (vida útil 45 años). Esto reduce la renta no laboral directamente. Depreciación anual estimada: " + fm(deprecInmuebles) + ". El ahorro efectivo depende de tu tasa marginal (entre 19% y 39% según tu ingreso) — tu contador puede calcular el valor exacto.", impact: 0, color: T.purple });
      }
      if (ingAnual > 200e6) recs.push({ icon: "🤝", title: "Donaciones con descuento 25% (Art. 257 ET)", desc: "Las donaciones a entidades sin ánimo de lucro calificadas dan un DESCUENTO del 25% del valor donado, directo del impuesto a pagar (no de la base). El tope legal del descuento es el 25% del impuesto de renta del año. El monto que te conviene donar depende de tu estrategia fiscal y filantrópica — consúltalo con tu contador.", impact: 0, color: T.purple });
      const interesesHip = deu.filter(d => /hipoteca|vivienda|casa|apto|mortgage/i.test((d.tp || "") + (d.n || ""))).reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
      if (interesesHip === 0 && deu.length === 0 && ingAnual > 200e6) recs.push({ icon: "🏦", title: "Crédito de vivienda: intereses deducibles (Art. 119 ET)", desc: "Los intereses de un crédito hipotecario para vivienda del contribuyente son deducibles hasta 1.200 UVT/año (" + fm(1200 * UVT) + "). Es una de las deducciones más grandes disponibles — pero solo aplica si efectivamente tomas el crédito y usas la vivienda. No te endeudes solo por el beneficio fiscal; evalúalo con tu contador.", impact: 0, color: T.purple });
      if (ingAnual > 100e6) recs.push({ icon: "💳", title: "GMF 4×1000 deducible (Art. 115 ET)", desc: "El 50% del GMF pagado es deducible. Se calcula automáticamente: " + fm(ingAnual * 0.004 * 0.50) + "/año.", impact: 0, color: T.green });
      if (ingAnual > 400e6) recs.push({ icon: "🏢", title: "Evalúa una estructura societaria", desc: "Con ingresos altos, una SAS puede optimizar tu carga fiscal canalizando ingresos por la empresa (35% sobre utilidad vs hasta 39% persona natural).", impact: 0, color: T.purple });
      if (ahorro < 100000 && pctUsado >= 95) {
        recs.push({ icon: "✅", title: "Tope 40% optimizado al máximo", desc: "Ya estás usando el " + pctUsado.toFixed(0) + "% del tope de deducciones. No hay más espacio para pensión voluntaria o AFC. Tu contador está haciendo un buen trabajo.", impact: 0, color: T.green });
        if (ingAnual > 200e6) recs.push({ icon: "💡", title: "Para reducir más: redistribuir ingresos", desc: "La única forma de bajar más es mover ingresos a una persona jurídica (SAS). La empresa paga 35% sobre UTILIDAD (después de gastos), no sobre ingreso bruto. Consulta con tu contador.", impact: 0, color: T.purple });
      }
    }

    return { ...fiscalData, recs };
  }, [ingresos, gastos, inv, deu, trm, isJ, owner.regimen, owner.perdidasFiscalesAcumuladas, owner.descuentosTributarios, owner.aportes, componenteInflacionarioPct]);

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
            <div style={{ fontSize: 11, color: T.txt3, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span>{isJ ? "Persona Jurídica" : "Persona Natural"}</span>
              <span style={{ background: "rgba(59,130,246,0.12)", color: T.blue, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600 }}>
                {calc.regimen === "ordinario" ? (isJ ? "Ordinario 35%" : "Cédula General") :
                 calc.regimen === "simple" ? "Simple (RST)" :
                 calc.regimen === "zona_franca" ? "Zona Franca 20%" :
                 calc.regimen === "chc" ? "CHC" :
                 calc.regimen === "exenta" ? "Exenta" : calc.regimen}
              </span>
            </div>
          </div>
        </div>
        {ahorro > 100000 && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "8px 16px" }}>
            <div style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>AHORRO POTENCIAL</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{fm(ahorro)}/año</div>
          </div>
        )}
      </div>

      {/* Banner de régimen */}
      {calc.regimenNota && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid " + T.border, background: "rgba(59,130,246,0.04)", fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          <span style={{ color: T.blue, fontWeight: 600 }}>ℹ️ {calc.regimenNota}</span>
        </div>
      )}

      {/* Resumen 3 líneas: Total bruto + Retención estimada + Saldo a pagar */}
      {(() => {
        const impBrutoVal = Number(calc.impBruto) || 0;
        const retencionEstimada = Number(isJ ? calc.retefuenteCalc : calc.retefuenteNat) || 0;
        const saldoAPagar = Math.max(0, impBrutoVal - retencionEstimada);
        if (impBrutoVal <= 0) return null;
        return (
          <div style={{ padding: mb ? "12px 16px" : "14px 24px", borderBottom: "1px solid " + T.border, background: "rgba(34,197,94,0.02)" }}>
            <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr 1fr 1fr", gap: mb ? 8 : 12 }}>
              <div>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>Total bruto / año</div>
                <div style={{ fontSize: mb ? 16 : 18, fontWeight: 800, color: T.txt, fontFamily: "monospace" }}>{fm(impBrutoVal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>(−) Retención estimada</div>
                <div style={{ fontSize: mb ? 16 : 18, fontWeight: 800, color: T.blue, fontFamily: "monospace" }}>{retencionEstimada > 0 ? fm(retencionEstimada) : "$0"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>(=) Saldo a pagar</div>
                <div style={{ fontSize: mb ? 16 : 18, fontWeight: 800, color: saldoAPagar > 0 ? T.orange : T.green, fontFamily: "monospace" }}>{fm(saldoAPagar)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 9, color: T.txt3, lineHeight: 1.5, fontStyle: "italic" }}>
              Retención estimada según tarifas legales (Art. 383-401 ET) por tipo de ingreso: salario tabla progresiva Art. 383, honorarios 11% Art. 392, arriendo 3,5% Art. 401, rendimientos/dividendos 7% Art. 392-395. Verificá con tu certificado de retención del año.
            </div>
          </div>
        );
      })()}

      {/* Banner diagnóstico para jurídicas con impuesto alto: detecta
          condiciones típicas de data incompleta. Guardas estrictas para
          no romper si calc/inv/deu llegan en un estado inesperado. */}
      {(() => {
        try {
          if (!isJ) return null;
          if (!calc || typeof calc !== "object") return null;
          const ingAnual = Number(calc.ingAnual) || 0;
          if (ingAnual < 10_000_000) return null;

          const diagnos = [];
          const pctGastos = Number(calc.pctGastos) || 0;
          if (pctGastos < 15) {
            diagnos.push({
              msg: `Gastos registrados: ${pctGastos.toFixed(0)}% de ingresos (típico operativo: 40–70%).`,
              accion: "Registrá gastos como nómina, honorarios, mantenimiento, predial, servicios públicos en el módulo Gastos.",
            });
          }

          const deprec = Number(calc.deprec) || 0;
          const invArr = Array.isArray(inv) ? inv : [];
          if (deprec === 0 && owner?.id) {
            const tieneInmuebles = invArr.some(i => {
              if (!i || i.owner !== owner.id) return false;
              const tp = String(i.tp || i.tipo || "").toLowerCase();
              return /real estate|bodega|local|oficina|apto|apartamento|casa|inmueble/i.test(tp);
            });
            if (tieneInmuebles) {
              diagnos.push({
                msg: "No hay depreciación aplicada aunque hay inmuebles registrados.",
                accion: "La depreciación del 2.22%/año sobre inmuebles (vida útil 45 años) se aplica automáticamente si los activos están vinculados al owner. Verificá el campo owner del inmueble.",
              });
            }
          }

          const intereses = Number(calc.intereses) || 0;
          const deuArr = Array.isArray(deu) ? deu : [];
          if (intereses === 0 && owner?.id) {
            const tieneDeudas = deuArr.some(d => d && d.owner === owner.id && (Number(d.mt) || 0) > 0);
            if (tieneDeudas) {
              diagnos.push({
                msg: "Hay deudas pero los intereses no aparecen como deducción.",
                accion: "Verificá que las deudas tengan tasa de interés configurada. Intereses = saldo × tasa anual.",
              });
            }
          }

          const descuentosSolicitados = Number(calc.descuentosSolicitados) || 0;
          const _decl = (owner && owner.declaraciones && owner.declaraciones[0]) || (owner && owner.declaracionAnterior);
          const r = (_decl && _decl.renglones) || {};
          const hubo = (Number(r.descICA) || 0) + (Number(r.descDonaciones) || 0) + (Number(r.descCree) || 0) + (Number(r.descCTI) || 0);
          if (hubo > 1_000_000 && descuentosSolicitados < hubo * 0.3) {
            diagnos.push({
              msg: `Año anterior usaste ~${fm(hubo)} en descuentos tributarios y ahora apenas ${fm(descuentosSolicitados)}.`,
              accion: `Tocá el botón '⭐ Descuentos' en la tarjeta de ${owner?.name || "este owner"} para capturar ICA, donaciones, CT&I. Son directo del impuesto, no de la base.`,
            });
          }

          if (diagnos.length === 0) return null;

          return (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid " + T.border, background: "rgba(245,158,11,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, marginBottom: 6 }}>
                💡 ¿Por qué este impuesto parece alto?
              </div>
              <div style={{ fontSize: 11, color: T.txt2, marginBottom: 8, lineHeight: 1.5 }}>
                El motor calcula impuesto con la data registrada. Detectamos lo siguiente que puede estar haciéndolo más alto de lo real:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {diagnos.map((d, i) => (
                  <div key={i} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, borderLeft: "2px solid " + T.orange, fontSize: 11, lineHeight: 1.5 }}>
                    <div style={{ color: T.txt, fontWeight: 600 }}>{d.msg}</div>
                    <div style={{ color: T.txt3, marginTop: 2, fontSize: 10 }}>→ {d.accion}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        } catch (e) {
          // Si algo falla en el diagnóstico, no rompemos toda la UI
          if (typeof window !== "undefined" && window.console) window.console.warn("[banner-diagnostico] error:", e);
          return null;
        }
      })()}

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
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green, fontWeight: 600 }}><span>(-) Deducciones aplicadas</span><span style={{ fontFamily: "monospace" }}>{fm(calc.totalDeduc)}</span></div>
              
              {/* Desglose detallado de gastos */}
              {Object.entries(calc.gastosByCat).filter(([,v]) => v.deduc > 0).map(([cat, v]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                  <span style={{ color: T.green }}>✅ {cat} ({Math.round(v.pct * 100)}%)</span>
                  <span style={{ fontFamily: "monospace", color: T.green }}>{fm(v.deduc)}/mes</span>
                </div>
              ))}
              {calc.intereses > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Intereses de deudas</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.intereses)}/año</span>
              </div>}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ GMF 4×1000 (50%)</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.ingAnual * 0.004 * 0.5)}/año</span>
              </div>
              {calc.deprec > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Depreciación de activos</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deprec)}/año</span>
              </div>}
              
              {/* Gastos NO deducibles */}
              {Object.entries(calc.gastosByCat).filter(([,v]) => v.total > v.deduc).length > 0 && <>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.txt3, marginTop: 6, marginBottom: 2 }}>No deducibles:</div>
                {Object.entries(calc.gastosByCat).filter(([,v]) => v.total > v.deduc).map(([cat, v]) => (
                  <div key={"nd_"+cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                    <span style={{ color: T.txt3 }}>❌ {cat}</span>
                    <span style={{ fontFamily: "monospace", color: T.txt3 }}>{fm(v.total - v.deduc)}/mes</span>
                  </div>
                ))}
              </>}
              
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 6 }}><span>Renta antes de compensación</span><span style={{ fontFamily: "monospace" }}>{fm(calc.utilidad)}</span></div>
              {calc.perdidasAplicadas > 0 && <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.green }}>
                  <span>(-) Pérdidas fiscales compensadas (Art. 147 ET)</span>
                  <span style={{ fontFamily: "monospace" }}>-{fm(calc.perdidasAplicadas)}</span>
                </div>
                {calc.perdidasAcumuladas > calc.perdidasAplicadas && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16, marginBottom: 2 }}>Saldo pérdidas para próximo año: {fm(calc.perdidasAcumuladas - calc.perdidasAplicadas)}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, fontWeight: 700 }}>
                  <span>Renta gravable compensada</span>
                  <span style={{ fontFamily: "monospace" }}>{fm(calc.baseGravable)}</span>
                </div>
              </>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: Math.min(calc.pctGastos || 0, 100) + "%", background: (calc.pctGastos || 0) >= 50 ? T.green : T.orange, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: T.txt3, whiteSpace: "nowrap" }}>Gastos: {(calc.pctGastos || 0).toFixed(0)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11, fontWeight: 600, borderTop: "1px solid " + T.border, marginTop: 4 }}>
                <span>Impuesto bruto ({(calc.tarifa * 100).toFixed(0)}%)</span>
                <span style={{ fontFamily: "monospace" }}>{fm(calc.impBruto)}</span>
              </div>
              {calc.descuentoICA > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue }}><span>(-) Descuento 50% ICA (Art. 115 ET)</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.descuentoICA)}</span></div>}
              {calc.descuentosAplicados > 0 && <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue }}>
                  <span>(-) Descuentos tributarios (Art. 256-259 ET)</span>
                  <span style={{ fontFamily: "monospace" }}>-{fm(calc.descuentosAplicados)}</span>
                </div>
                {calc.descuentosDesglose && <>
                  {calc.descuentosDesglose.cti > 0 && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16 }}>• CT&I (Art. 158-1): {fm(calc.descuentosDesglose.cti)}</div>}
                  {calc.descuentosDesglose.empleo > 0 && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16 }}>• Empleo 1ra vez (Art. 108-5): {fm(calc.descuentosDesglose.empleo)}</div>}
                  {calc.descuentosDesglose.exterior > 0 && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16 }}>• Impuestos exterior (Art. 254): {fm(calc.descuentosDesglose.exterior)}</div>}
                  {calc.descuentosDesglose.donaciones > 0 && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16 }}>• Donaciones 25% (Art. 257): {fm(calc.descuentosDesglose.donaciones)}</div>}
                  {calc.descuentosDesglose.otros > 0 && <div style={{ fontSize: 9, color: T.txt3, paddingLeft: 16 }}>• Otros descuentos: {fm(calc.descuentosDesglose.otros)}</div>}
                </>}
                {calc.descuentosSolicitados > calc.descuentosAplicados && <div style={{ fontSize: 9, color: T.orange, paddingLeft: 16 }}>⚠ Tope 25% aplicado (Art. 259 ET): {fm(calc.descuentosSolicitados - calc.descuentosAplicados)} exceden el límite y no se aplicaron este año.</div>}
              </>}
              {calc.retefuenteCalc > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue }}><span>(-) Retención en la fuente</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.retefuenteCalc)}</span></div>}
            </> : <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.blue }}><span>(-) Pensión obligatoria (Art. 55 ET)</span><span style={{ fontFamily: "monospace" }}>{fm(calc.noConst)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green }}><span>(-) Renta exenta 25%</span><span style={{ fontFamily: "monospace" }}>{fm(calc.exenta25)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green, fontWeight: 600 }}><span>(-) Deducciones aplicadas</span><span style={{ fontFamily: "monospace" }}>{fm(calc.gastosDeducNat + calc.deducDep + calc.deducViv)}</span></div>
              
              {/* Desglose detallado */}
              {calc.gastosDeducNat > 0 && Object.entries(calc.gastosByCat).filter(([,v]) => v.deduc > 0).map(([cat, v]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                  <span style={{ color: T.green }}>✅ {cat} ({Math.round(v.pct * 100)}%){v.pct > 0 && v.deduc < v.total ? " — máx aplicado" : ""}</span>
                  <span style={{ fontFamily: "monospace", color: T.green }}>{fm(v.deduc * 12)}/año</span>
                </div>
              ))}
              {calc.deducDep > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Dependientes (10% ingreso)</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deducDep)}/año</span>
              </div>}
              {calc.deducViv > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Intereses vivienda</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deducViv)}/año</span>
              </div>}
              
              {/* Gastos NO deducibles para natural */}
              {Object.entries(calc.gastosByCat).filter(([cat]) => !(DEDUC_NAT[cat])).length > 0 && <>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.txt3, marginTop: 6, marginBottom: 2 }}>No deducibles (persona natural):</div>
                {Object.entries(calc.gastosByCat).filter(([cat]) => !(DEDUC_NAT[cat]) && calc.gastosByCat[cat].total > 0).slice(0, 5).map(([cat, v]) => (
                  <div key={"nd_"+cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                    <span style={{ color: T.txt3 }}>❌ {cat}</span>
                    <span style={{ fontFamily: "monospace", color: T.txt3 }}>{fm(v.total)}/mes</span>
                  </div>
                ))}
              </>}
              
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 6 }}><span>Renta gravable</span><span style={{ fontFamily: "monospace" }}>{fm(calc.rentaSin)}</span></div>
              {calc.componenteInflacExcluido > 0 && (
                <div style={{ marginTop: 4, padding: "8px 10px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 6, fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ color: T.blue, fontWeight: 600 }}>📉 Componente inflacionario {calc.pctComponenteInflac.toFixed(2)}% (Art. 38-39 ET)</span>
                    <span style={{ fontFamily: "monospace", color: T.blue, fontWeight: 600 }}>−{fm(calc.componenteInflacExcluido)}</span>
                  </div>
                  <div style={{ color: T.txt3, fontSize: 9, lineHeight: 1.5 }}>
                    Parte de tus rendimientos financieros (intereses bancarios + FIC) no constituye renta ni ganancia ocasional. Decreto 0771/2025 — año gravable 2024. Aplica a persona natural no obligada a llevar contabilidad. Ajustable en Configuración.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: Math.min(calc.pctUsado || 0, 100) + "%", background: (calc.pctUsado || 0) >= 90 ? T.green : T.orange, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: T.txt3, whiteSpace: "nowrap" }}>Tope 40%: {(calc.pctUsado || 0).toFixed(0)}%</span>
              </div>
              {calc.retefuenteNat > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue, marginTop: 4 }}><span>(-) Retención en la fuente</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.retefuenteNat)}</span></div>}
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

          {/* Diagnóstico cuando no hay diferencia entre actual y optimizado */}
          {(() => {
            try {
              const actual = Number(impActual) || 0;
              const optimo = Number(impOptimo) || 0;
              const dif = Math.abs(actual - optimo);
              if (dif > 100_000) return null; // Hay diferencia real, no mostrar

              let titulo, texto;
              if (isJ) {
                titulo = "Sin optimización automática (persona jurídica)";
                texto = "Las optimizaciones jurídicas (depreciación acelerada, distribución de dividendos, descuento ICA, CT&I) requieren decisiones estratégicas que no se automatizan. Para reducir el impuesto, capturá los descuentos tributarios reales con el botón ⭐ Descuentos en la tarjeta de " + (owner?.name || "este owner") + ".";
              } else if (calc?.regimen === "simple") {
                titulo = "Régimen Simple (RST) no admite optimización";
                texto = "El régimen Simple tributa sobre ingresos brutos con tarifa fija (1,4%–8,3% según grupo de actividad). No admite deducciones de cédula general ni aportes voluntarios como reductores de base.";
              } else if (actual < 100_000) {
                titulo = "No hay impuesto a optimizar";
                texto = "Con la renta líquida gravable actual estás por debajo del mínimo gravable o en el primer rango de la tabla Art. 241 ET (sin impuesto). No hay nada que reducir.";
              } else if ((Number(calc?.neto) || 0) < 1_000_000) {
                titulo = "Sin ingresos laborales para aplicar PV/AFC";
                texto = "La optimización automática sugiere aportes a pensión voluntaria + AFC hasta llenar el tope 40%. Estos aportes solo reducen la cédula laboral (salario + honorarios). Como tus ingresos son de capital/arrendamientos/dividendos, no hay base donde aplicar la estrategia.";
              } else {
                titulo = "Ya aprovechás el máximo legal de deducciones";
                texto = "Entre tus aportes obligatorios, exenta 25%, dependientes, intereses de vivienda, salud prepagada y pensión voluntaria ya capturada, llenaste el tope 40% / 1340 UVT (Art. 336 ET). No hay espacio adicional de optimización automática. Si querés reducir más, mirá las recomendaciones estratégicas abajo.";
              }

              return (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, fontSize: 11, lineHeight: 1.55 }}>
                  <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 4 }}>💡 ¿Por qué no hay diferencia?</div>
                  <div style={{ color: T.txt2, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
                  <div style={{ color: T.txt3, fontSize: 10 }}>{texto}</div>
                </div>
              );
            } catch (e) {
              if (typeof window !== "undefined" && window.console) window.console.warn("[diagnostico-optimo] error:", e);
              return null;
            }
          })()}

          <div style={{ marginTop: 16, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: T.txt2, marginBottom: 6 }}>Deducciones automáticas aplicadas:</div>
            {isJ ? <>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Gastos operativos registrados</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Intereses de deudas deducidos</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Depreciación de activos aplicada</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ GMF 4×1000 (50% deducible)</div>
              {calc.descuentoICA > 0 && <div style={{ padding: "4px 0", color: T.blue }}>✅ Descuento 50% ICA aplicado</div>}
              <div style={{ padding: "4px 0", color: T.blue }}>✅ Retención en la fuente descontada</div>
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, fontSize: 10, color: T.txt2, lineHeight: 1.5 }}>
                ℹ️ <strong>No hay ahorro automático para persona jurídica.</strong> Las estrategias corporativas (bonificaciones, donaciones Art. 257 ET, provisión de cartera, depreciación acelerada, apalancamiento) existen pero su monto viable depende de tu estructura contable. El simulador no inventa porcentajes genéricos — consultá con tu contador para estimar ahorros concretos. Mirá las recomendaciones abajo.
              </div>
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
      {(
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
            <div style={{ fontSize: 10, color: T.txt3 }}>{ahorro > 100000 ? "Reducción" : "Estado"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ahorro > 100000 ? T.green : T.txt3 }}>{ahorro > 100000 ? "-" + (impActual > 0 ? (ahorro / impActual * 100).toFixed(0) : 0) + "%" : "✅ Optimizado"}</div>
          </div>
        </div>
      )}

      {/* Retención en la fuente automática */}
      {((isJ && calc.retefuenteCalc > 0) || (!isJ && calc.retefuenteNat > 0)) && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + T.border, background: "rgba(59,130,246,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>📋 Retención en la fuente estimada</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: "monospace" }}>{fm(isJ ? calc.retefuenteCalc : calc.retefuenteNat)}/año</span>
          </div>
          <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>Calculada automáticamente según tus ingresos: arriendos (3.5%), rendimientos (7%), honorarios (11%), salario (tabla Art. 383). Este valor se descuenta del impuesto. Verifica con tus certificados reales.</div>
          {impActual <= 0 && <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginTop: 6 }}>💰 Saldo a favor estimado: {fm(Math.abs(impActual))}</div>}
        </div>
      )}

      {/* DISCLAIMER HONESTO — Solo jurídica */}
      {isJ && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + T.border, background: "rgba(251,191,36,0.05)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚖️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>Qué modela el simulador — y qué no</div>
              <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.6 }}>
                <strong style={{ color: T.green }}>Sí se aplica automáticamente:</strong> tarifa del 35% sobre utilidad (Art. 240 ET), deducción de intereses y gastos operativos registrados, depreciación según tipo de activo, GMF 4×1000 al 50% (Art. 115 ET), descuento del 50% del ICA (Art. 115 ET) y retención en la fuente por tipo de ingreso.
                <br /><br />
                <strong style={{ color: "#fbbf24" }}>No se estiman automáticamente:</strong> bonificaciones extralegales, donaciones con descuento (Art. 257 ET), provisión de cartera (Art. 145 ET), depreciación acelerada (Art. 137 ET), apalancamiento productivo (Art. 117 ET), zona franca, créditos tributarios especiales. Existen en el Estatuto Tributario pero su monto viable depende de la estructura contable de cada empresa — el simulador no inventa porcentajes genéricos que no tienen soporte legal universal.
                <br /><br />
                <strong>Este simulador no sustituye la asesoría de un contador.</strong> Es una herramienta de referencia basada en los datos que tú registras. Para tu declaración oficial y para estructurar estrategias de optimización específicas, consulta con un contador público.
              </div>
            </div>
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

export default function SimuladorTributario({ trm, user, onNavigate, onUpdate }) {
  const mb = typeof window !== "undefined" && window.innerWidth < 768;
  const owners = (user && user.owners) || [{ id: "own_1", name: "Personal", type: "natural" }];
  // Respeta el flag sim en todos los items — si el usuario lo desactivó en Ingresos/Gastos/etc,
  // el simulador lo ignora. Default: sim === undefined o true → se incluye. sim === false → se excluye.
  const ing = ((user && user.ingresos) || []).filter(i => i.sim !== false);
  const gasRaw = user && user.gas ? user.gas : {};
  const gas = {};
  Object.entries(gasRaw).forEach(([cat, items]) => {
    const filtered = (items || []).filter(g => g.sim !== false);
    if (filtered.length > 0) gas[cat] = filtered;
  });
  const inv = ((user && user.inv) || []).filter(i => i.sim !== false);
  const deu = ((user && user.deu) || []).filter(d => d.sim !== false);
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

  // Calculate consolidated totals — USANDO estimarImpuesto() como single source of truth.
  // Esto reemplaza la implementación duplicada que tenía 6 bugs documentados para persona
  // natural (INCRNGO sobre todo el ingreso, renta exenta 25% sobre total, tope 40% sobre
  // total, no aplicaba componente inflacionario Art. 38-39 ET, no clasificaba por cédula,
  // no deducía gastos del inmueble para arriendos). El motor estimarImpuesto() ya tiene
  // toda la lógica correcta del Estatuto Tributario y es la única fuente de verdad.
  const consolidado = useMemo(() => {
    const est = estimarImpuesto(user);
    let totalIngreso = 0, totalImpActual = 0, totalImpOptimo = 0;
    const items = [];
    (est.detalle || []).forEach(d => {
      totalIngreso += d.ingreso || 0;
      totalImpActual += d.impuesto || 0;
      totalImpOptimo += d.impOptimizado != null ? d.impOptimizado : (d.impuesto || 0);
      items.push({
        name: d.name,
        icon: d.type === "juridica" ? "🏢" : "👤",
        imp: d.impuesto || 0,
        impOpt: d.impOptimizado != null ? d.impOptimizado : (d.impuesto || 0),
        ing: d.ingreso || 0,
      });
    });
    return { totalIngreso, totalImpActual, totalImpOptimo, ahorro: totalImpActual - totalImpOptimo, items };
  }, [user]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: mb ? 20 : 26, fontWeight: 800, margin: "0 0 4px", color: T.orange }}>🧾 Planeación Tributaria</h1>
        <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Colombia 2026 • Estatuto Tributario • UVT: {fm(UVT)} • Ley 2277/2022</p>
      </div>

      {sinAsignar > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: T.orange, lineHeight: 1.6 }}>
          ⚠️ <strong>{sinAsignar} ingreso(s)</strong> sin propietario asignado — no se incluyen en el cálculo. Asigna propietario en <strong>💰 Ingresos</strong>.
        </div>
      )}

      {/* ═══ PANEL DE REVISIÓN FISCAL (Sprint 5 — rediseño) ═══ */}
      {(() => {
        const warns = getFiscalWarnings(user).filter(w => w.code !== "INGRESO_SIN_PROPIETARIO"); // ya mostrado arriba
        if (warns.length === 0) return null;
        const errs = warns.filter(w => w.severity === "error");
        const warnings = warns.filter(w => w.severity === "warning");
        const infos = warns.filter(w => w.severity === "info");

        // Helper: formateo de moneda compacto para el panel.
        const fmM = (v) => {
          const n = Math.round(Number(v) || 0);
          if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
          if (n >= 1000) return "$" + (n / 1000).toFixed(0) + "K";
          return "$" + n.toLocaleString("es-CO");
        };

        // Aprobar: persiste el fiscalCodeSugerido en el item, haciendo desaparecer el warning.
        const aprobar = (w) => {
          if (!onUpdate || !w.fiscalCodeSugerido) return;
          track("revision_fiscal_aprobar", {
            item_type: w.itemType || "unknown",
            fiscal_code: w.fiscalCodeSugerido,
            severity: w.severity || "info",
          });
          onUpdate(prev => {
            if (!prev) return prev;
            if (w.itemType === "ingreso") {
              const nw = (prev.ingresos || []).map(i => i.id === w.itemId ? { ...i, fiscalCode: w.fiscalCodeSugerido } : i);
              return { ...prev, ingresos: nw };
            }
            if (w.itemType === "gasto") {
              const cat = w.itemGastoCat, idx = w.itemGastoIdx;
              const arr = (prev.gas && prev.gas[cat]) || [];
              if (idx == null || !arr[idx]) return prev;
              const nArr = arr.map((g, i) => i === idx ? { ...g, fiscalCode: w.fiscalCodeSugerido } : g);
              return { ...prev, gas: { ...prev.gas, [cat]: nArr } };
            }
            if (w.itemType === "deuda") {
              const nw = (prev.deu || []).map(d => d.id === w.itemId ? { ...d, fiscalCode: w.fiscalCodeSugerido } : d);
              return { ...prev, deu: nw };
            }
            if (w.itemType === "inversion") {
              const nw = (prev.inv || []).map(i => i.id === w.itemId ? { ...i, fiscalCode: w.fiscalCodeSugerido } : i);
              return { ...prev, inv: nw };
            }
            if (w.itemType === "owner") {
              const nw = (prev.owners || []).map(o => o.id === w.itemId ? { ...o, fiscalCode: w.fiscalCodeSugerido } : o);
              return { ...prev, owners: nw };
            }
            return prev;
          });
        };

        // Aprobar TODOS los de un tipo/código en bloque — delega a aprobar() en loop.
        const aprobarGrupo = (list) => {
          track("revision_fiscal_aprobar_grupo", {
            cantidad: list.length,
            item_type: list[0]?.itemType || "unknown",
          });
          list.forEach(w => aprobar(w));
        };

        const pgMap = { ingreso: "ing", gasto: "gas", deuda: "deu", inversion: "inv", owner: "set" };
        const pgLabel = { ingreso: "💰 Ingresos", gasto: "💳 Egresos", deuda: "📋 Deudas", inversion: "🏦 Patrimonio", owner: "⚙️ Config" };

        // Agrupar warnings duplicados (mismo code + mismo itemType).
        // Ejemplo: 3 arriendos separados generan 3 warnings
        // ARRIENDO_INFERIDO_INMUEBLE idénticos. Los juntamos en una sola
        // fila que muestra "3 items afectados" con lista expandible.
        const agruparWarnings = (lista) => {
          const grupos = new Map();
          for (const w of lista) {
            const clave = (w.code || "NO_CODE") + "::" + (w.itemType || "");
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(w);
          }
          const resultado = [];
          for (const items of grupos.values()) {
            if (items.length === 1) {
              resultado.push(items[0]);
            } else {
              // Warning grupal: conserva el primer item como representativo
              // pero marca la cantidad y la lista completa para bulk approve.
              const montoTotal = items.reduce((s, x) => s + (x.itemMonto || 0), 0);
              resultado.push({
                ...items[0],
                _grupo: items,
                _count: items.length,
                itemConcepto: `${items.length} ítems (${items[0].itemCategoria || items[0].itemConcepto || ""})`,
                itemMonto: montoTotal,
              });
            }
          }
          return resultado;
        };

        const renderRow = (w, i) => {
          const color = w.severity === "error" ? T.red : w.severity === "warning" ? T.orange : T.blue;
          const icon = w.severity === "error" ? "⛔" : w.severity === "warning" ? "⚠️" : "ℹ️";
          const target = pgMap[w.itemType];
          const label = pgLabel[w.itemType];
          // Label del item: prioriza concepto, cae en categoría.
          const itemLbl = w.itemConcepto || w.itemCategoria || "Item";
          const monto = w.itemMonto ? fmM(w.itemMonto * 12) + "/año" : null;
          const canApprove = onUpdate && w.fiscalCodeSugerido && (w.itemId || (w.itemType === "gasto" && w.itemGastoCat != null));
          const esGrupo = w._grupo && w._count > 1;

          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 11, borderLeft: "2px solid " + color }}>
              <span style={{ fontSize: 14, marginTop: 1 }}>{icon}</span>
              <div style={{ flex: 1, lineHeight: 1.5, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", marginBottom: 2 }}>
                  <span style={{ color: T.txt, fontWeight: 700, fontSize: 12 }}>{itemLbl}</span>
                  {monto && <span style={{ color: T.txt3, fontSize: 10 }}>· {monto}</span>}
                  {w.itemOwnerName && !esGrupo && <span style={{ color: T.txt3, fontSize: 10 }}>· {w.itemOwnerName}</span>}
                </div>
                <div style={{ color: color, fontSize: 11 }}>{w.message}</div>
                {esGrupo && (
                  <details style={{ marginTop: 4, fontSize: 10, color: T.txt3 }}>
                    <summary style={{ cursor: "pointer", userSelect: "none" }}>Ver los {w._count} items</summary>
                    <ul style={{ margin: "4px 0 0 14px", padding: 0, lineHeight: 1.6 }}>
                      {w._grupo.map((sub, si) => (
                        <li key={si} style={{ listStyle: "disc" }}>
                          <span style={{ color: T.txt2 }}>{sub.itemConcepto || sub.itemCategoria || "Item"}</span>
                          {sub.itemMonto ? <span style={{ color: T.txt3 }}> · {fmM(sub.itemMonto * 12)}/año</span> : null}
                          {sub.itemOwnerName ? <span style={{ color: T.txt3 }}> · {sub.itemOwnerName}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {w.accionSugerida && <div style={{ color: T.txt3, marginTop: 3, fontSize: 10 }}>→ {w.accionSugerida}</div>}
                {w.articuloET && w.articuloET !== "—" && <div style={{ color: T.txt3, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>{w.articuloET}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                {canApprove && (
                  <button onClick={() => esGrupo ? aprobarGrupo(w._grupo) : aprobar(w)} style={{ background: T.green + "22", border: "1px solid " + T.green, color: T.green, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }} title={esGrupo ? `Aprobar ${w._count} items` : `Aprobar clasificación sugerida: ${w.fiscalCodeSugerido}`}>
                    ✓ Aprobar{esGrupo ? ` (${w._count})` : ""}
                  </button>
                )}
                {onNavigate && target && (
                  <button onClick={() => onNavigate(target)} style={{ background: "transparent", border: "1px solid " + T.border, color: T.txt2, padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ✏️ {label}
                  </button>
                )}
              </div>
            </div>
          );
        };

        return (
          <div style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.orange }}>🔍 Revisión de precisión fiscal</div>
              {onUpdate && warns.some(w => w.fiscalCodeSugerido) && (
                <button onClick={() => {
                  if (!confirm(`Aprobar la clasificación sugerida para ${warns.filter(w => w.fiscalCodeSugerido).length} ítem(s)?\n\nSe persiste el fiscalCode inferido en cada item. Podés revertir editando el item manualmente.`)) return;
                  aprobarGrupo(warns.filter(w => w.fiscalCodeSugerido));
                }} style={{ background: T.green + "22", border: "1px solid " + T.green, color: T.green, padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  ✓ Aprobar todos ({warns.filter(w => w.fiscalCodeSugerido).length})
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginBottom: 12, lineHeight: 1.6 }}>
              {(() => {
                const grupErrs = agruparWarnings(errs);
                const grupWarnings = agruparWarnings(warnings);
                const grupInfos = agruparWarnings(infos);
                const total = grupErrs.length + grupWarnings.length + grupInfos.length;
                return <>
                  {total} alerta{total !== 1 ? "s" : ""} de clasificación fiscal ({warns.length} ítem{warns.length !== 1 ? "s" : ""} afectado{warns.length !== 1 ? "s" : ""}). Revisá cada una y aprobá o editá.
                  {grupErrs.length > 0 && <> • <strong style={{ color: T.red }}>{grupErrs.length} error{grupErrs.length !== 1 ? "es" : ""}</strong></>}
                  {grupWarnings.length > 0 && <> • <span style={{ color: T.orange }}>{grupWarnings.length} advertencia{grupWarnings.length !== 1 ? "s" : ""}</span></>}
                  {grupInfos.length > 0 && <> • <span style={{ color: T.blue }}>{grupInfos.length} info</span></>}
                </>;
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...agruparWarnings(errs), ...agruparWarnings(warnings), ...agruparWarnings(infos)].map(renderRow)}
            </div>
          </div>
        );
      })()}

      {/* ═══ RESUMEN CONSOLIDADO ═══ */}
      {consolidado.items.length > 0 && (
        <Cd style={{ marginBottom: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(34,197,94,0.02))" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📊 Panorama Fiscal Consolidado</div>
            <div style={{ fontSize: 11, color: T.txt3 }}>Todos los propietarios combinados</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 0 }}>
            <Kpi label="Ingresos totales" value={fm(consolidado.totalIngreso)} sub="/año" color={T.txt} />
            <Kpi label="Impuesto actual" value={fm(consolidado.totalImpActual)} sub={fm(consolidado.totalImpActual / 12) + "/mes"} color={T.red} />
            <Kpi label="Con estrategia" value={fm(consolidado.totalImpOptimo)} sub={fm(consolidado.totalImpOptimo / 12) + "/mes"} color={T.green} />
            <Kpi label="Ahorro potencial" value={fm(consolidado.ahorro)} sub={consolidado.totalImpActual > 0 ? "-" + (consolidado.ahorro / consolidado.totalImpActual * 100).toFixed(0) + "% reducción" : ""} color={T.green} />
          </div>
          <div style={{ padding: "12px 24px", borderTop: "1px solid " + T.border }}>
            <div style={{ display: "flex", gap: mb ? 12 : 20, flexWrap: "wrap" }}>
              {consolidado.items.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span>{it.icon}</span>
                  <span style={{ color: T.txt2 }}>{it.name}:</span>
                  <span style={{ color: T.red, fontFamily: "monospace", fontWeight: 600 }}>{fm(it.imp)}</span>
                  <span style={{ color: T.txt3 }}>→</span>
                  <span style={{ color: T.green, fontFamily: "monospace", fontWeight: 600 }}>{fm(it.impOpt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "10px 24px", borderTop: "1px solid " + T.border, fontSize: 11, color: T.txt3 }}>
            Tasa efectiva actual: <strong style={{ color: T.red }}>{consolidado.totalIngreso > 0 ? (consolidado.totalImpActual / consolidado.totalIngreso * 100).toFixed(1) : 0}%</strong> → Con estrategia: <strong style={{ color: T.green }}>{consolidado.totalIngreso > 0 ? (consolidado.totalImpOptimo / consolidado.totalIngreso * 100).toFixed(1) : 0}%</strong>
          </div>
        </Cd>
      )}

      {/* ═══ CALENDARIO TRIBUTARIO ═══ */}
      <Cd style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.cyan, marginBottom: 10 }}>📅 Fechas clave para optimizar</div>
        <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr 1fr 1fr", gap: 10, fontSize: 11 }}>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.orange }}>Antes de diciembre 31</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Aportes a pensión voluntaria y AFC. Donaciones deducibles. Compras de activos depreciables.</div>
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.blue }}>Marzo - Abril 2027</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Declaración de renta personas jurídicas. Tener certificados de retención y estados financieros listos.</div>
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.green }}>Agosto - Octubre 2027</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Declaración de renta personas naturales. Último plazo según dos últimos dígitos del NIT.</div>
          </div>
        </div>
      </Cd>

      {/* ═══ DETALLE POR PROPIETARIO ═══ */}
      <div style={{ fontSize: 14, fontWeight: 700, color: T.txt2, marginBottom: 12 }}>Detalle por propietario</div>

      {/* Owner cards */}
      {ownerData.map(od => (
        <OwnerPlan key={od.owner.id} owner={od.owner} ingresos={od.ing} gastos={od.gas} inv={od.inv} deu={od.deu} trm={trm} isJ={od.owner.type === "juridica"} mb={mb} componenteInflacionarioPct={user?.componenteInflacionarioPct != null ? user.componenteInflacionarioPct : 50.88} />
      ))}

      <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Estimaciones basadas en la normativa tributaria colombiana vigente. UVT 2026: {fm(UVT)} (Resolución DIAN 000238). No constituye asesoría fiscal profesional.
      </div>
    </div>
  );
}
