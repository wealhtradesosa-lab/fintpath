// ═══════════════════════════════════════════════════════════════════════════
// FORMULARIO 210 — Declaración de Renta Persona Natural
// ─────────────────────────────────────────────────────────────────────────
// Wizard guiado tipo formulario DIAN 210. Replica la estructura real de la
// declaración de renta de persona natural residente fiscal, cédula por cédula.
//
// Scope V1 (cubre ~90% de casos):
//   Paso 1 · Identificación y residencia fiscal
//   Paso 2 · Cédula General — Ingresos (Trabajo + Capital + No laboral)
//   Paso 3 · Cédula General — Depuración (INCRNGO, exentas, deducciones,
//            tope 40% / 1340 UVT Art. 336)
//   Paso 4 · Otras cédulas (Pensiones, Dividendos, Ganancias Ocasionales)
//   Paso 5 · Liquidación (tabla Art. 241 + descuentos + retenciones + saldo)
//
// Base legal: ET arts. 206 (exenta 25%), 241 (tabla tarifa), 242-243
// (dividendos), 38-39 (componente inflacionario), 55 (aportes obligatorios),
// 119 (intereses hipoteca), 387 (dependientes), 336 (tope 40%).
//
// Pre-llenado inteligente: si el owner ya tiene ingresos/gastos registrados
// en FINPATHIA, el motor estimarImpuesto() calcula todos los valores y el
// wizard los ofrece como defaults editables. El usuario puede confirmarlos
// o sobrescribirlos con valores oficiales.
//
// Los datos se guardan por owner en:
//   data.owners[].formulario210: { identificacion, ingresos, depuracion,
//                                   otrasCedulas, liquidacion }
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { estimarImpuesto } from "../lib/taxCO.js";
import { calcImpRenta as calcImpRentaCore } from "../lib/tablaArt241.js";
import AlertasAnoAnterior from "./AlertasAnoAnterior.jsx";

const UVT = 52374; // UVT 2026

const T = {
  bg: "#0f1117", bg2: "#15181f", bg3: "#1c2029", card: "#16191f",
  border: "rgba(255,255,255,0.08)",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  blue: "#3b82f6", green: "#22c55e", orange: "#f59e0b", red: "#ef4444",
  purple: "#a78bfa", cyan: "#06b6d4",
  blueDim: "rgba(59,130,246,0.1)", greenDim: "rgba(34,197,94,0.1)",
  orangeDim: "rgba(245,158,11,0.1)", redDim: "rgba(239,68,68,0.1)",
  purpleDim: "rgba(167,139,250,0.1)",
};

const fm = (n) => {
  if (!n && n !== 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
};

// Tabla Art. 241 ET — impuesto progresivo por UVT. Fuente única: src/lib/tablaArt241.js.
// Esta función mantiene la firma anterior (uvts → impuesto) para no tener
// que actualizar 15+ call sites en el wizard. Internamente delega al módulo central.
function calcImpTabla241(uvts) {
  return calcImpRentaCore(uvts, UVT);
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI REUTILIZABLES (copia de Formulario110 para aislamiento)
// ─────────────────────────────────────────────────────────────────────────

const Field = ({ label, casilla, articulo, value, onChange, placeholder, hint, readonly, suggested, suggestedLabel, prevYear, prevYearLabel }) => {
  const hasSuggestion = suggested != null && suggested > 0 && (!value || +value === 0);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, flex: 1 }}>
          {casilla && <span style={{ color: T.cyan, fontFamily: "monospace", marginRight: 6 }}>R{casilla}</span>}
          {label}
        </label>
        {articulo && <span style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{articulo}</span>}
      </div>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => !readonly && onChange(e.target.value)}
        placeholder={placeholder || "0"}
        readOnly={readonly}
        style={{
          width: "100%", padding: "10px 12px", background: readonly ? T.bg2 : T.bg3,
          border: "1px solid " + T.border, color: T.txt, borderRadius: 8, fontSize: 13,
          fontFamily: "monospace", outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {hasSuggestion && !readonly && (
          <button onClick={() => onChange(Math.round(suggested))} style={{
            padding: "4px 8px", background: T.greenDim, border: "1px solid " + T.green,
            color: T.green, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
          }}>
            💡 Pre-llenar con {suggestedLabel || fm(suggested)}
          </button>
        )}
        {prevYear != null && prevYear > 0 && !readonly && (
          <button onClick={() => onChange(Math.round(prevYear))} title="Click para copiar este valor al campo" style={{
            padding: "4px 8px", background: "rgba(6,182,212,0.12)", border: "1px solid " + T.cyan,
            color: T.cyan, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
          }}>
            📥 {prevYearLabel || "Año anterior"}: {fm(prevYear)}
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
};

const Section = ({ title, icon, color, children }) => (
  <div style={{ background: T.card, border: "1px solid " + T.border, borderLeft: "3px solid " + (color || T.blue), borderRadius: 10, padding: 16, marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: color || T.blue, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{title}
    </div>
    {children}
  </div>
);

const StepHeader = ({ number, title, subtitle }) => (
  <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid " + T.border }}>
    <div style={{ fontSize: 11, color: T.cyan, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>PASO {number}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginBottom: 4 }}>{title}</div>
    {subtitle && <div style={{ fontSize: 12, color: T.txt3, lineHeight: 1.5 }}>{subtitle}</div>}
  </div>
);

const Totals = ({ rows }) => (
  <div style={{ background: T.bg2, borderRadius: 10, padding: 14, marginBottom: 14 }}>
    {rows.map((r, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < rows.length - 1 ? "1px dashed " + T.border : "none" }}>
        <span style={{ fontSize: 12, color: r.highlight ? T.txt : T.txt2, fontWeight: r.highlight ? 700 : 500 }}>{r.label}</span>
        <span style={{ fontSize: r.highlight ? 14 : 12, fontWeight: r.highlight ? 800 : 600, color: r.color || T.txt, fontFamily: "monospace" }}>{r.value}</span>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// PASO 1 · IDENTIFICACIÓN Y RESIDENCIA FISCAL
// ─────────────────────────────────────────────────────────────────────────

function Paso1Identificacion({ data, update }) {
  const ident = data.identificacion || {};
  return (
    <>
      <StepHeader number={1} title="Identificación del declarante" subtitle="Datos básicos de la persona natural. Formulario 210, sección A." />
      <Section title="Datos del contribuyente" icon="👤" color={T.blue}>
        <Field label="NIT / Cédula" casilla="5" value={ident.nit} onChange={(v) => update({ ...ident, nit: v })} placeholder="0" hint="Tu número de identificación tributaria." />
        <Field label="Año gravable" casilla="4" value={ident.anoGravable} onChange={(v) => update({ ...ident, anoGravable: v })} placeholder="2025" hint="Año fiscal que estás declarando." />
      </Section>
      <Section title="Residencia fiscal" icon="🌎" color={T.purple}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Este wizard asume que sos <strong>residente fiscal colombiano</strong> (presencia &gt; 183 días en 365 consecutivos, o familia en Colombia, o activos &gt; 50% en Colombia). Si sos no residente, consultá con tu contador — la tarifa es plana del 35% sin tabla progresiva.
        </div>
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 2 · CÉDULA GENERAL — INGRESOS
// ─────────────────────────────────────────────────────────────────────────

function Paso2IngresosCedulaGeneral({ data, update, sugeridos, anterior }) {
  const ing = data.ingresos || {};
  const upd = (k, v) => update({ ...ing, [k]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  const trabajoBruto = (+ing.salarios || 0) + (+ing.honorarios || 0) + (+ing.servicios || 0) + (+ing.comisiones || 0) + (+ing.viaticos || 0);
  const capitalBruto = (+ing.intereses || 0) + (+ing.rendimientosFIC || 0) + (+ing.arrendamientoMuebles || 0) + (+ing.rendimientosGenericos || 0);
  const noLaboralBruto = (+ing.arrendamientos || 0) + (+ing.honorariosIndependiente || 0) + (+ing.ventaActivos || 0) + (+ing.otros || 0);
  const totalGeneral = trabajoBruto + capitalBruto + noLaboralBruto;

  return (
    <>
      <StepHeader number={2} title="Cédula General — Ingresos" subtitle="Ingresos brutos de trabajo, capital y no laborales. Los tres se suman para formar la Cédula General (Art. 335 ET)." />

      <Section title="Rentas de trabajo" icon="💼" color={T.blue}>
        <Field label="Salarios" casilla="32" articulo="Art. 103 ET" value={ing.salarios} onChange={(v) => upd("salarios", v)} suggested={sugeridos?.salarios} prevYear={anterior?.salarios} prevYearLabel={pyLabel} hint="Salarios, primas, bonificaciones, comisiones laborales recibidas como empleado." />
        <Field label="Honorarios" casilla="34" articulo="Art. 103 ET" value={ing.honorarios} onChange={(v) => upd("honorarios", v)} suggested={sugeridos?.honorarios} prevYear={anterior?.honorarios} prevYearLabel={pyLabel} hint="Honorarios recibidos como persona natural por servicios independientes." />
        <Field label="Servicios" casilla="35" articulo="Art. 103 ET" value={ing.servicios} onChange={(v) => upd("servicios", v)} hint="Servicios personales no calificados como honorarios." />
        <Field label="Comisiones" casilla="36" articulo="Art. 103 ET" value={ing.comisiones} onChange={(v) => upd("comisiones", v)} hint="Comisiones por ventas u otros." />
        <Field label="Viáticos no reembolsables" casilla="37" articulo="Art. 10 Dcto 823/84" value={ing.viaticos} onChange={(v) => upd("viaticos", v)} hint="Viáticos fijos no sujetos a rendición." />
      </Section>

      <Section title="Rentas de capital" icon="💰" color={T.cyan}>
        <Field label="Intereses y rendimientos bancarios (CDT)" casilla="44" articulo="Art. 38 ET" value={ing.intereses} onChange={(v) => upd("intereses", v)} suggested={sugeridos?.intereses} prevYear={anterior?.intereses} prevYearLabel={pyLabel} hint="Rendimientos financieros de cuentas y CDTs. Aplicará componente inflacionario en el Paso 3." />
        <Field label="Rendimientos de FIC" casilla="45" articulo="Art. 23-1 ET" value={ing.rendimientosFIC} onChange={(v) => upd("rendimientosFIC", v)} suggested={sugeridos?.fic} hint="Distribuciones de fondos de inversión colectiva." />
        <Field label="Arrendamiento de muebles" casilla="46" articulo="Art. 103 ET" value={ing.arrendamientoMuebles} onChange={(v) => upd("arrendamientoMuebles", v)} hint="Arriendo de equipos, vehículos u otros bienes muebles." />
        <Field label="Otros rendimientos de capital" casilla="47" value={ing.rendimientosGenericos} onChange={(v) => upd("rendimientosGenericos", v)} hint="Otros conceptos de rentas de capital que no encajan arriba." />
      </Section>

      <Section title="Rentas no laborales" icon="🏠" color={T.orange}>
        <Field label="Arrendamiento de inmuebles" casilla="52" articulo="Art. 103 ET" value={ing.arrendamientos} onChange={(v) => upd("arrendamientos", v)} suggested={sugeridos?.arrendamientos} prevYear={anterior?.arrendamientos} prevYearLabel={pyLabel} hint="Arriendo de apartamentos, casas, locales, bodegas." />
        <Field label="Honorarios como independiente sin empleados" casilla="53" articulo="Art. 206 #10 ET" value={ing.honorariosIndependiente} onChange={(v) => upd("honorariosIndependiente", v)} hint="Solo si tu owner está marcado como 'sin 2+ empleados 83% año' en Config. Si tenés empleados, van en Trabajo arriba." />
        <Field label="Venta de activos (menos de 2 años)" casilla="54" articulo="Art. 300 ET" value={ing.ventaActivos} onChange={(v) => upd("ventaActivos", v)} hint="Si tenías el activo más de 2 años, es Ganancia Ocasional (Paso 4)." />
        <Field label="Otros ingresos no laborales" casilla="55" value={ing.otros} onChange={(v) => upd("otros", v)} />
      </Section>

      <Totals rows={[
        { label: "Total rentas de trabajo", value: fm(trabajoBruto) },
        { label: "Total rentas de capital", value: fm(capitalBruto) },
        { label: "Total rentas no laborales", value: fm(noLaboralBruto) },
        { label: "TOTAL INGRESOS CÉDULA GENERAL", value: fm(totalGeneral), highlight: true, color: T.blue },
      ]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 3 · CÉDULA GENERAL — DEPURACIÓN
// ─────────────────────────────────────────────────────────────────────────

function Paso3DepuracionCedulaGeneral({ data, update, totales, sugeridos, anterior }) {
  const dep = data.depuracion || {};
  const upd = (k, v) => update({ ...dep, [k]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  const incrngo = (+dep.aportesPensionObligatoria || 0) + (+dep.aportesSaludObligatoria || 0) + (+dep.aportesSolidaridad || 0);
  const ingresoNeto = Math.max(0, (totales.totalGeneralBruto || 0) - incrngo);

  const exenta25 = +dep.exenta25Art206 || 0;
  const pensionVoluntaria = +dep.pensionVoluntaria || 0;
  const afc = +dep.afc || 0;
  const totalExentas = exenta25 + pensionVoluntaria + afc;

  const interesesVivienda = +dep.interesesVivienda || 0;
  const dependientes = +dep.dependientes || 0;
  const saludPrepagada = +dep.saludPrepagada || 0;
  const gmf50 = +dep.gmf50 || 0;
  const totalDeducciones = interesesVivienda + dependientes + saludPrepagada + gmf50;

  const beneficiosAntesTope = totalExentas + totalDeducciones;
  // Tope: 40% del ingreso neto y 1340 UVT (Art. 336 ET)
  const tope40 = ingresoNeto * 0.40;
  const tope1340 = 1340 * UVT;
  const topeAplicado = Math.min(tope40, tope1340);
  const beneficiosAceptados = Math.min(beneficiosAntesTope, topeAplicado);
  const pctUsadoTope = topeAplicado > 0 ? (beneficiosAceptados / topeAplicado * 100) : 0;

  const componenteInflac = +dep.componenteInflacionario || 0;
  const rentaLiquidaGeneral = Math.max(0, ingresoNeto - beneficiosAceptados - componenteInflac);

  return (
    <>
      <StepHeader number={3} title="Cédula General — Depuración" subtitle="Ingresos no constitutivos de renta, rentas exentas y deducciones. Sujeto a tope del 40% / 1340 UVT (Art. 336 ET)." />

      <Section title="Ingresos no constitutivos de renta (INCRNGO)" icon="🏛️" color={T.green}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Los aportes <strong>obligatorios</strong> a seguridad social NO constituyen renta — se restan del ingreso bruto <strong>antes</strong> del tope del 40%.
        </div>
        <Field label="Aportes obligatorios a pensión" casilla="41" articulo="Art. 55 ET" value={dep.aportesPensionObligatoria} onChange={(v) => upd("aportesPensionObligatoria", v)} suggested={sugeridos?.aportesPension} hint={anterior?.aportesObligatorios > 0 ? `4% del salario (empleado) o IBC × 16% (independiente). · 📥 Año ${anterior.anoGravable} declaraste $${anterior.aportesObligatorios.toLocaleString("es-CO")} en aportes obligatorios totales (pensión + salud + solidaridad).` : "4% del salario (empleado) o IBC × 16% (independiente)."} />
        <Field label="Aportes obligatorios a salud" casilla="42" articulo="Art. 56 ET" value={dep.aportesSaludObligatoria} onChange={(v) => upd("aportesSaludObligatoria", v)} suggested={sugeridos?.aportesSalud} hint="4% del salario o IBC × 12.5% (independiente)." />
        <Field label="Aportes al Fondo de Solidaridad" casilla="43" articulo="Ley 100" value={dep.aportesSolidaridad} onChange={(v) => upd("aportesSolidaridad", v)} hint="Solo si tu ingreso > 4 SMMLV. Típicamente 1% del salario." />
        {anterior?.aportesObligatorios > 0 && (
          <div style={{ padding: "8px 10px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 6, fontSize: 10, color: T.cyan, marginTop: 4 }}>
            📥 Año {anterior.anoGravable}: aportes obligatorios totales {fm(anterior.aportesObligatorios)}
          </div>
        )}
      </Section>

      <Section title="Rentas exentas" icon="🛡️" color={T.purple}>
        <Field label="Exenta laboral 25% (Art. 206 #10)" casilla="72" articulo="Art. 206 #10 ET" value={dep.exenta25Art206} onChange={(v) => upd("exenta25Art206", v)} suggested={sugeridos?.exenta25} prevYear={anterior?.exenta25} prevYearLabel={pyLabel} hint="25% del neto laboral, tope 790 UVT/año. Aplica a salarios y a honorarios si el declarante tiene 2+ empleados ≥83% del año." />
        <Field label="Pensión voluntaria" casilla="73" articulo="Art. 126-1 ET" value={dep.pensionVoluntaria} onChange={(v) => upd("pensionVoluntaria", v)} hint={anterior?.pvAFC > 0 ? `Hasta 25% del ingreso y 2500 UVT/año. Debe permanecer 10 años. · 📥 Año ${anterior.anoGravable} declaraste $${anterior.pvAFC.toLocaleString("es-CO")} combinado entre PV y AFC (sin separación disponible en el importador).` : "Hasta 25% del ingreso y 2500 UVT/año. Debe permanecer 10 años."} />
        <Field label="Cuenta AFC" casilla="74" articulo="Art. 126-4 ET" value={dep.afc} onChange={(v) => upd("afc", v)} hint={anterior?.pvAFC > 0 ? `Hasta 30% del ingreso y 3800 UVT/año. Debe usarse para vivienda o permanecer 10 años. · 📥 Año ${anterior.anoGravable} declaraste $${anterior.pvAFC.toLocaleString("es-CO")} combinado PV+AFC.` : "Hasta 30% del ingreso y 3800 UVT/año. Debe usarse para vivienda o permanecer 10 años."} />
      </Section>

      <Section title="Deducciones" icon="📉" color={T.orange}>
        <Field label="Intereses de crédito de vivienda" casilla="75" articulo="Art. 119 ET" value={dep.interesesVivienda} onChange={(v) => upd("interesesVivienda", v)} suggested={sugeridos?.interesesVivienda} prevYear={anterior?.interesesVivienda} prevYearLabel={pyLabel} hint="Hasta 1200 UVT/año. Solo vivienda del contribuyente (no inmuebles de inversión)." />
        <Field label="Dependientes (10% ingreso, tope 384 UVT)" casilla="76" articulo="Art. 387 ET" value={dep.dependientes} onChange={(v) => upd("dependientes", v)} suggested={sugeridos?.dependientes} prevYear={anterior?.dependientes} prevYearLabel={pyLabel} hint="Hijos menores de 18, estudiantes hasta 23, cónyuge sin ingresos propios, padres dependientes económicamente." />
        <Field label="Salud prepagada" casilla="77" articulo="Art. 387 ET" value={dep.saludPrepagada} onChange={(v) => upd("saludPrepagada", v)} prevYear={anterior?.saludPrepagada} prevYearLabel={anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null} hint="Medicina prepagada y pólizas de salud. Tope 192 UVT/año ($10.056.000)." />
        <Field label="50% del GMF (4×1000)" casilla="78" articulo="Art. 115 ET" value={dep.gmf50} onChange={(v) => upd("gmf50", v)} suggested={sugeridos?.gmf50} prevYear={anterior?.gmf50} prevYearLabel={anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null} hint="La mitad del gravamen a los movimientos financieros pagado." />
      </Section>

      <Section title="Componente inflacionario de rendimientos" icon="📈" color={T.cyan}>
        <Field label="Componente inflacionario excluido" casilla="79" articulo="Art. 38-39 ET" value={dep.componenteInflacionario} onChange={(v) => upd("componenteInflacionario", v)} suggested={sugeridos?.componenteInflac} hint="50.88% de los intereses y rendimientos bancarios/FIC (Decreto 0771/2025) no constituye renta." />
      </Section>

      <Totals rows={[
        { label: "Ingreso bruto Cédula General", value: fm(totales.totalGeneralBruto || 0) },
        { label: "– INCRNGO (aportes obligatorios)", value: "– " + fm(incrngo) },
        { label: "= Ingreso neto", value: fm(ingresoNeto), color: T.cyan },
        { label: "Beneficios solicitados (exentas + deduc)", value: fm(beneficiosAntesTope) },
        { label: `Tope 40% / 1340 UVT → aplicado: ${pctUsadoTope.toFixed(0)}%`, value: fm(topeAplicado), color: T.orange },
        { label: "Beneficios aceptados (con tope)", value: "– " + fm(beneficiosAceptados) },
        { label: "– Componente inflacionario", value: "– " + fm(componenteInflac) },
        { label: "RENTA LÍQUIDA GRAVABLE CÉDULA GENERAL", value: fm(rentaLiquidaGeneral), highlight: true, color: T.green },
      ]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 4 · OTRAS CÉDULAS
// ─────────────────────────────────────────────────────────────────────────

function Paso4OtrasCedulas({ data, update, sugeridos, anterior }) {
  const oc = data.otrasCedulas || {};
  const upd = (k, v) => update({ ...oc, [k]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  // Cédula pensional
  const pensionesBruto = +oc.pensionesBruto || 0;
  const pensionExenta = Math.min(pensionesBruto, 1000 * UVT * 12); // 1000 UVT/mes
  const pensionGravable = Math.max(0, pensionesBruto - pensionExenta);

  // Cédula dividendos Art. 242
  const divArt49ParteGravada = +oc.divArt49Gravada || 0;
  const divArt49NoGravados = +oc.divArt49NoGravados || 0;
  const divExteriorYOtros = +oc.divExteriorYOtros || 0;
  const divExentos = Math.min(divArt49NoGravados, 300 * UVT);
  const divGravablesBaja = Math.max(0, divArt49NoGravados - divExentos); // Tarifa 0% hasta 1090 UVT, luego 19-39% progresivo en tabla 241
  const divGravablesAlta = divArt49ParteGravada + divExteriorYOtros;

  // Ganancias ocasionales Art. 313
  const goVentaActivos = +oc.goVentaActivos || 0;
  const goHerencias = +oc.goHerencias || 0;
  const goLoteria = +oc.goLoteria || 0;
  const goBase = goVentaActivos + goHerencias;
  const impGO = goBase * 0.15 + goLoteria * 0.20;

  return (
    <>
      <StepHeader number={4} title="Otras cédulas" subtitle="Pensiones, dividendos y ganancias ocasionales se declaran separadamente — tienen tratamientos especiales." />

      <Section title="Cédula de pensiones" icon="👴" color={T.cyan}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Pensiones de jubilación, invalidez, vejez o sobrevivientes. Exentas hasta <strong>1.000 UVT/mes</strong> (\${fm(1000 * UVT)}/mes). El exceso se grava a la tabla 241.
        </div>
        <Field label="Total pensiones brutas anuales" casilla="91" articulo="Art. 206 #5 ET" value={oc.pensionesBruto} onChange={(v) => upd("pensionesBruto", v)} prevYear={anterior?.pensiones} prevYearLabel={pyLabel} hint={`Parte exenta calculada: ${fm(pensionExenta)}/año · Parte gravable: ${fm(pensionGravable)}/año`} />
      </Section>

      <Section title="Cédula de dividendos y participaciones" icon="💵" color={T.purple}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Los dividendos tienen tratamiento especial (Art. 242 ET). Los <strong>no gravados Art. 49</strong> suman a la tabla 241. Los <strong>parte gravada Art. 49</strong> y los <strong>de sociedades extranjeras</strong> se gravan al 35% + tarifa general.
        </div>
        <Field label="Dividendos Art. 49 parte gravada" casilla="101" articulo="Art. 242 ET" value={oc.divArt49Gravada} onChange={(v) => upd("divArt49Gravada", v)} prevYear={anterior?.dividendos} prevYearLabel={anterior?.anoGravable ? `Dividendos totales año ${anterior.anoGravable}` : null} hint="Se gravan al 35% en la sociedad; vos agregás la tarifa general." />
        <Field label="Dividendos Art. 49 no gravados" casilla="102" articulo="Art. 242 ET" value={oc.divArt49NoGravados} onChange={(v) => upd("divArt49NoGravados", v)} hint={anterior?.dividendos > 0 ? `Exentos hasta 300 UVT (${fm(300 * UVT)}). Exceso se grava según Art. 242. · 📥 Año ${anterior.anoGravable} declaraste $${anterior.dividendos.toLocaleString("es-CO")} en dividendos totales (suma de todas las categorías).` : `Exentos hasta 300 UVT (${fm(300 * UVT)}). Exceso se grava según Art. 242.`} />
        <Field label="Dividendos de sociedad extranjera" casilla="103" articulo="Art. 245 ET" value={oc.divExteriorYOtros} onChange={(v) => upd("divExteriorYOtros", v)} hint="Se gravan al 35% + tarifa general (Art. 245 ET)." />
      </Section>

      <Section title="Ganancias ocasionales" icon="🎁" color={T.orange}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Ganancias por venta de activos poseídos &gt; 2 años, herencias, legados, donaciones y loterías. Tarifa <strong>15%</strong> general · <strong>20%</strong> loterías.
        </div>
        <Field label="Venta de activos fijos (> 2 años)" casilla="111" articulo="Art. 300 ET" value={oc.goVentaActivos} onChange={(v) => upd("goVentaActivos", v)} hint="Utilidad (precio venta – costo fiscal). Tarifa 15%." />
        <Field label="Herencias, legados y donaciones" casilla="112" articulo="Art. 302 ET" value={oc.goHerencias} onChange={(v) => upd("goHerencias", v)} hint="Tarifa 15%." />
        <Field label="Premios, rifas, loterías" casilla="113" articulo="Art. 317 ET" value={oc.goLoteria} onChange={(v) => upd("goLoteria", v)} hint="Tarifa especial 20%." />
      </Section>

      <Totals rows={[
        { label: "Pensión gravable", value: fm(pensionGravable) },
        { label: "Dividendos que suman a tabla 241", value: fm(divGravablesBaja) },
        { label: "Dividendos Art. 242 tarifa alta", value: fm(divGravablesAlta) },
        { label: "Base ganancias ocasionales (15%)", value: fm(goBase) },
        { label: "Impuesto ganancias ocasionales", value: fm(impGO), highlight: true, color: T.orange },
      ]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASO 5 · LIQUIDACIÓN
// ─────────────────────────────────────────────────────────────────────────

function Paso5Liquidacion({ data, update, rentaLiqGeneralFinal, impGO, sugeridos, anterior }) {
  const liq = data.liquidacion || {};
  const upd = (k, v) => update({ ...liq, [k]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  const impuestoTabla = calcImpTabla241(rentaLiqGeneralFinal / UVT);

  const descCTI = +liq.descuentoCTI || 0;
  const descDonaciones = +liq.descuentoDonaciones || 0;
  const descExterior = +liq.descuentoExterior || 0;
  const descuentosTotal = descCTI + descDonaciones + descExterior;
  const topeDescuentos = impuestoTabla * 0.25; // Art. 259 ET
  const descuentosAplicados = Math.min(descuentosTotal, topeDescuentos);

  const impuestoDespuesDescuentos = Math.max(0, impuestoTabla - descuentosAplicados);
  const retencionesAño = +liq.retenciones || 0;
  const anticipoAnterior = +liq.anticipoAnioAnterior || 0;
  const impuestoNeto = impuestoDespuesDescuentos + impGO;
  const saldoPagar = Math.max(0, impuestoNeto - retencionesAño - anticipoAnterior);
  const saldoFavor = Math.max(0, retencionesAño + anticipoAnterior - impuestoNeto);

  return (
    <>
      <StepHeader number={5} title="Liquidación del impuesto" subtitle="Aplicación de la tabla Art. 241 ET, descuentos tributarios, retenciones y cálculo del saldo final." />

      <Section title="Impuesto según tabla Art. 241 ET" icon="📊" color={T.blue}>
        <Totals rows={[
          { label: "Renta líquida gravable total", value: fm(rentaLiqGeneralFinal) },
          { label: "Expresada en UVT", value: (rentaLiqGeneralFinal / UVT).toFixed(2) },
          { label: "Impuesto por tabla 241", value: fm(impuestoTabla), color: T.blue },
        ]} />
      </Section>

      <Section title="Descuentos tributarios (Art. 256-259 ET)" icon="💸" color={T.green}>
        <div style={{ padding: 10, background: T.bg3, borderRadius: 8, marginBottom: 10, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Los descuentos se restan <strong>directamente del impuesto</strong>, no de la base. Tope: <strong>25% del impuesto</strong> (Art. 259 ET).
        </div>
        <Field label="Descuento CTI (inversión en ciencia y tecnología)" casilla="131" articulo="Art. 256 ET" value={liq.descuentoCTI} onChange={(v) => upd("descuentoCTI", v)} />
        <Field label="Descuento por donaciones (25% de lo donado)" casilla="132" articulo="Art. 257 ET" value={liq.descuentoDonaciones} onChange={(v) => upd("descuentoDonaciones", v)} hint="25% del valor donado a entidades sin ánimo de lucro calificadas." />
        <Field label="Descuento impuestos pagados en el exterior" casilla="133" articulo="Art. 254 ET" value={liq.descuentoExterior} onChange={(v) => upd("descuentoExterior", v)} hint="Impuestos pagados en otros países sobre rentas de fuente extranjera." />
      </Section>

      <Section title="Retenciones y anticipo" icon="🧾" color={T.cyan}>
        <Field label="Total retenciones en la fuente del año" casilla="141" articulo="Art. 383-388 ET" value={liq.retenciones} onChange={(v) => upd("retenciones", v)} suggested={sugeridos?.retenciones} prevYear={anterior?.retenciones} prevYearLabel={pyLabel} hint="Suma de todas las retenciones que te practicaron en el año (certificados de retención)." />
        <Field label="Anticipo liquidado año anterior" casilla="142" value={liq.anticipoAnioAnterior} onChange={(v) => upd("anticipoAnioAnterior", v)} prevYear={anterior?.anticipoGenerado} prevYearLabel={pyLabel} hint="Si en tu declaración del año pasado quedó anticipo a pagar este año, acá va." />
      </Section>

      <Totals rows={[
        { label: "Impuesto según tabla Art. 241", value: fm(impuestoTabla) },
        { label: "– Descuentos aplicados (tope 25%)", value: "– " + fm(descuentosAplicados), color: T.green },
        { label: "= Impuesto neto cédula general", value: fm(impuestoDespuesDescuentos) },
        { label: "+ Impuesto ganancias ocasionales", value: "+ " + fm(impGO) },
        { label: "= Impuesto neto total", value: fm(impuestoNeto), color: T.blue },
        { label: "– Retenciones en la fuente", value: "– " + fm(retencionesAño) },
        { label: "– Anticipo año anterior", value: "– " + fm(anticipoAnterior) },
        ...(saldoPagar > 0 ? [{ label: "💰 SALDO A PAGAR", value: fm(saldoPagar), highlight: true, color: T.red }] : []),
        ...(saldoFavor > 0 ? [{ label: "✅ SALDO A FAVOR", value: fm(saldoFavor), highlight: true, color: T.green }] : []),
      ]} />

      {anterior && (() => {
        const ingP = data.ingresos || {};
        const depP = data.depuracion || {};
        const ocP = data.otrasCedulas || {};
        return (
        <AlertasAnoAnterior
          anoAnterior={anterior.anoGravable}
          comparaciones={[
            { label: "Retenciones en la fuente", actual: retencionesAño, anterior: anterior.retenciones, sugerencia: "Si bajó significativamente, revisá que tengas todos los certificados de retención del año." },
            { label: "Impuesto total", actual: impuestoNeto, anterior: anterior.impuestoRenta, sugerencia: anterior.impuestoRenta > 0 && impuestoNeto > anterior.impuestoRenta * 1.5 ? "El impuesto subió mucho. Puede ser correcto si subieron ingresos, pero también revisá si te faltaron deducciones (intereses vivienda, dependientes, medicina prepagada, AFC, pensión voluntaria)." : null },
          ].filter(c => c.anterior > 0)}
          patronesContext={{
            actual: {
              ingresos: (+ingP.salarios || 0) + (+ingP.honorarios || 0) + (+ingP.intereses || 0) + (+ingP.arrendamientos || 0),
              retenciones: retencionesAño,
              impuesto: impuestoNeto,
              salarios: +ingP.salarios || 0,
              aportesPension: +depP.aportesPensionObligatoria || 0,
              interesesVivienda: +depP.interesesVivienda || 0,
              dependientes: +depP.dependientes || 0,
              dividendos: (+ocP.divArt49Gravada || 0) + (+ocP.divArt49NoGravados || 0) + (+ocP.divExteriorYOtros || 0),
              exenta25: +depP.exenta25Art206 || 0,
              pvAFC: (+depP.pensionVoluntaria || 0) + (+depP.afc || 0),
              saludPrepagada: +depP.saludPrepagada || 0,
              gmf: +depP.gmf50 || 0,
            },
            anterior: {
              ingresos: (anterior.salarios || 0) + (anterior.honorarios || 0) + (anterior.intereses || 0) + (anterior.arrendamientos || 0),
              retenciones: anterior.retenciones || 0,
              impuesto: anterior.impuestoRenta || 0,
              salarios: anterior.salarios || 0,
              aportesPension: anterior.aportesObligatorios || 0,
              interesesVivienda: anterior.interesesVivienda || 0,
              dependientes: anterior.dependientes || 0,
              dividendos: anterior.dividendos || 0,
              exenta25: anterior.exenta25 || 0,
              pvAFC: anterior.pvAFC || 0,
              saludPrepagada: anterior.saludPrepagada || 0,
              gmf: anterior.gmf50 || 0,
            },
          }}
        />
        );
      })()}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CONTENEDOR PRINCIPAL DEL F-210
// ─────────────────────────────────────────────────────────────────────────

export default function Formulario210({ owner, user, onSave, onCancel }) {
  const initial = owner?.formulario210 || {};
  const [data, setData] = useState({
    identificacion: initial.identificacion || { anoGravable: String(new Date().getFullYear() - 1) },
    ingresos: initial.ingresos || {},
    depuracion: initial.depuracion || {},
    otrasCedulas: initial.otrasCedulas || {},
    liquidacion: initial.liquidacion || {},
  });
  const [step, setStep] = useState(1);

  // Pre-llenar con lo que el motor estimarImpuesto() calcula para este owner.
  // Si el usuario ya tiene ingresos/gastos registrados, acá ya está todo.
  const sugeridos = useMemo(() => {
    if (!user || !owner) return {};
    try {
      const est = estimarImpuesto(user);
      const d = est.detalle.find(x => x.name === owner.name);
      if (!d || d.type !== "natural") return {};

      // Mapeos desde el detalle del motor hacia renglones del F-210.
      const aportesD = d.aportesDesglose || {};
      return {
        salarios: aportesD.salarioInputAnual || 0,
        honorarios: 0, // TODO: separar honorarios del motor
        intereses: d.interesesBancAnual || 0,
        fic: d.utilidadFICAnual || 0,
        arrendamientos: (d.ingNoLaboral || 0),
        aportesPension: aportesD.pensionObligatoriaAnual || 0,
        aportesSalud: aportesD.saludObligatoriaAnual || 0,
        exenta25: d.exenta25 || 0,
        interesesVivienda: d.deducVivienda || 0,
        dependientes: d.deducDep || 0,
        gmf50: d.gmfDeducible || 0,
        componenteInflac: d.componenteInflacExcluido || 0,
        retenciones: d.retefuenteNat || d.reteN || 0,
      };
    } catch (e) {
      return {};
    }
  }, [user, owner]);

  // Totales derivados para compartir entre pasos
  const totales = useMemo(() => {
    const ing = data.ingresos || {};
    const trabajoBruto = (+ing.salarios || 0) + (+ing.honorarios || 0) + (+ing.servicios || 0) + (+ing.comisiones || 0) + (+ing.viaticos || 0);
    const capitalBruto = (+ing.intereses || 0) + (+ing.rendimientosFIC || 0) + (+ing.arrendamientoMuebles || 0) + (+ing.rendimientosGenericos || 0);
    const noLaboralBruto = (+ing.arrendamientos || 0) + (+ing.honorariosIndependiente || 0) + (+ing.ventaActivos || 0) + (+ing.otros || 0);
    return {
      totalGeneralBruto: trabajoBruto + capitalBruto + noLaboralBruto,
      trabajoBruto, capitalBruto, noLaboralBruto,
    };
  }, [data.ingresos]);

  // Renta líquida final después de Paso 3 + aportes cédula pensional y dividendos
  const rentaLiqGeneralFinal = useMemo(() => {
    const dep = data.depuracion || {};
    const oc = data.otrasCedulas || {};
    const incrngo = (+dep.aportesPensionObligatoria || 0) + (+dep.aportesSaludObligatoria || 0) + (+dep.aportesSolidaridad || 0);
    const ingresoNeto = Math.max(0, totales.totalGeneralBruto - incrngo);
    const beneficios = (+dep.exenta25Art206 || 0) + (+dep.pensionVoluntaria || 0) + (+dep.afc || 0) + (+dep.interesesVivienda || 0) + (+dep.dependientes || 0) + (+dep.saludPrepagada || 0) + (+dep.gmf50 || 0);
    const tope = Math.min(ingresoNeto * 0.40, 1340 * UVT);
    const beneficiosAceptados = Math.min(beneficios, tope);
    const rentaGen = Math.max(0, ingresoNeto - beneficiosAceptados - (+dep.componenteInflacionario || 0));
    // Agregar pensión gravable + dividendos que suman a tabla 241
    const pensionBruto = +oc.pensionesBruto || 0;
    const pensionExenta = Math.min(pensionBruto, 1000 * UVT * 12);
    const pensionGravable = Math.max(0, pensionBruto - pensionExenta);
    const divNoGrav = +oc.divArt49NoGravados || 0;
    const divExentos = Math.min(divNoGrav, 300 * UVT);
    const divGravablesBaja = Math.max(0, divNoGrav - divExentos);
    return rentaGen + pensionGravable + divGravablesBaja;
  }, [data.depuracion, data.otrasCedulas, totales]);

  // Impuesto ganancias ocasionales
  const impGO = useMemo(() => {
    const oc = data.otrasCedulas || {};
    const goVenta = +oc.goVentaActivos || 0;
    const goHerencia = +oc.goHerencias || 0;
    const goLoteria = +oc.goLoteria || 0;
    return (goVenta + goHerencia) * 0.15 + goLoteria * 0.20;
  }, [data.otrasCedulas]);

  // Mapeo año anterior → renglones del F-210 del año actual. Si el owner
  // tiene declaracionAnterior (F-210), cada campo equivalente recibe el valor
  // del año pasado como referencia comparativa.
  const anterior = useMemo(() => {
    const da = owner?.declaracionAnterior;
    if (!da || da.tipo !== "F210") return null;
    const r = da.renglones || {};
    return {
      anoGravable: da.anoGravable,
      salarios: +r.salarios || 0,
      honorarios: +r.honorarios || 0,
      intereses: +r.intereses || 0,
      arrendamientos: +r.arrendamientos || 0,
      pensiones: +r.pensiones || 0,
      dividendos: +r.dividendos || 0,
      aportesObligatorios: +r.aportesObligatorios || 0,
      exenta25: +r.exenta25 || 0,
      pvAFC: +r.pvAFC || 0,
      interesesVivienda: +r.interesesVivienda || 0,
      dependientes: +r.dependientes || 0,
      saludPrepagada: +r.saludPrepagada || 0,
      gmf50: +r.gmf50 || 0,
      impuestoRenta: +r.impuestoRenta || 0,
      retenciones: +r.retenciones || 0,
      anticipoGenerado: +r.anticipoGenerado || 0,
    };
  }, [owner?.declaracionAnterior]);

  const handleSave = () => {
    if (onSave) onSave(data);
  };

  const steps = [
    { n: 1, label: "Identificación" },
    { n: 2, label: "Ingresos" },
    { n: 3, label: "Depuración" },
    { n: 4, label: "Otras cédulas" },
    { n: 5, label: "Liquidación" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ marginBottom: 20, padding: "18px 22px", background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,182,212,0.08))", borderRadius: 14, border: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26 }}>📄</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Formulario 210 · Declaración de Renta Persona Natural</div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
              {owner?.name || "Persona Natural"} · Año gravable {data.identificacion?.anoGravable || "—"}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>← Volver</button>
        </div>
        <div style={{ fontSize: 11, color: T.txt3, marginTop: 12, lineHeight: 1.5 }}>
          Este wizard replica la estructura real del Formulario 210 DIAN para residentes fiscales. Los renglones pre-llenados con el botón 💡 vienen del simulador rápido — podés aceptarlos, ajustarlos o dejarlos en cero. Los cálculos siguen el Estatuto Tributario colombiano y la Ley 2277/2022.
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto" }}>
        {steps.map((s) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <button key={s.n} onClick={() => setStep(s.n)}
              style={{
                flex: "1 1 auto", minWidth: 100,
                padding: "10px 12px", border: "1px solid " + (active ? T.green : done ? T.cyan : T.border),
                background: active ? T.greenDim : done ? "rgba(6,182,212,0.1)" : T.bg3,
                color: active ? T.green : done ? T.cyan : T.txt3,
                borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
              <div style={{ fontSize: 10 }}>Paso {s.n}{done && " ✓"}</div>
              <div>{s.label}</div>
            </button>
          );
        })}
      </div>

      <div>
        {step === 1 && <Paso1Identificacion data={data} update={(v) => setData({ ...data, identificacion: v })} />}
        {step === 2 && <Paso2IngresosCedulaGeneral data={data} update={(v) => setData({ ...data, ingresos: v })} sugeridos={sugeridos} anterior={anterior} />}
        {step === 3 && <Paso3DepuracionCedulaGeneral data={data} update={(v) => setData({ ...data, depuracion: v })} totales={totales} sugeridos={sugeridos} anterior={anterior} />}
        {step === 4 && <Paso4OtrasCedulas data={data} update={(v) => setData({ ...data, otrasCedulas: v })} sugeridos={sugeridos} anterior={anterior} />}
        {step === 5 && <Paso5Liquidacion data={data} update={(v) => setData({ ...data, liquidacion: v })} rentaLiqGeneralFinal={rentaLiqGeneralFinal} impGO={impGO} sugeridos={sugeridos} anterior={anterior} />}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ← Paso anterior
          </button>
        )}
        {step < 5 && (
          <button onClick={() => setStep(step + 1)} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            Paso siguiente →
          </button>
        )}
        {step === 5 && (
          <button onClick={handleSave} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            💾 Guardar declaración
          </button>
        )}
      </div>

      <div style={{ marginTop: 20, padding: 12, background: T.bg3, borderRadius: 10, fontSize: 10, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        Este simulador sigue la estructura del Formulario 210 DIAN y el Estatuto Tributario vigente, pero NO reemplaza a tu contador público. Para tu declaración oficial, consultá con un profesional.
      </div>
    </div>
  );
}
