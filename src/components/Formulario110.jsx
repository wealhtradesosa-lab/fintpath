// ═══════════════════════════════════════════════════════════════════════════
// FORMULARIO 110 — Declaración de Renta Persona Jurídica
// ─────────────────────────────────────────────────────────────────────────
// Wizard guiado tipo formulario DIAN 110. Replica la estructura real de la
// declaración de renta de persona jurídica, renglón por renglón.
//
// Scope de esta V1 (cubre ~95% de casos de empresas colombianas):
//   Paso 1 · Identificación y régimen
//   Paso 2 · Ingresos brutos
//   Paso 3 · Depuración (costos, deducciones, gastos)
//   Paso 4 · Compensaciones y rentas especiales
//   Paso 5 · Liquidación (impuesto, descuentos, retenciones, saldo)
//
// Base legal: Estatuto Tributario, Ley 2277/2022 (última reforma), Formulario
// 110 DIAN vigente. Cada casilla indica artículo ET aplicable.
//
// Los datos de este wizard se guardan por owner en:
//   data.owners[].formulario110: { año, identificacion, ingresos, depuracion,
//                                   compensaciones, liquidacion, resultado }
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
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

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTES DE UI REUTILIZABLES
// ─────────────────────────────────────────────────────────────────────────

const Field = ({ label, casilla, articulo, value, onChange, placeholder, hint, readonly, optional, prevYear, prevYearLabel }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, flex: 1 }}>
        {casilla && <span style={{ color: T.cyan, fontFamily: "monospace", marginRight: 6 }}>R{casilla}</span>}
        {label}
        {optional && <span style={{ color: T.txt3, fontSize: 10, marginLeft: 4, fontWeight: 400 }}>(opcional)</span>}
      </label>
      {articulo && <span style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{articulo}</span>}
    </div>
    <input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.value === "" ? null : +e.target.value)}
      placeholder={placeholder || "0"}
      readOnly={readonly}
      style={{
        width: "100%", background: readonly ? T.bg2 : T.bg3,
        border: "1px solid " + T.border, color: readonly ? T.txt3 : T.txt,
        padding: "10px 12px", borderRadius: 8, fontSize: 13,
        fontFamily: "monospace", outline: "none",
        cursor: readonly ? "default" : "text",
      }}
    />
    {prevYear != null && prevYear > 0 && !readonly && (
      <button onClick={() => onChange(Math.round(prevYear))} title="Click para copiar este valor al campo" style={{
        marginTop: 4, padding: "4px 8px", background: "rgba(6,182,212,0.12)", border: "1px solid " + T.cyan,
        color: T.cyan, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
      }}>
        📥 {prevYearLabel || "Año anterior"}: ${Math.round(prevYear).toLocaleString("es-CO")}
      </button>
    )}
    {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
  </div>
);

const Section = ({ title, icon, children, color = T.blue }) => (
  <div style={{ marginBottom: 20, background: T.card, border: "1px solid " + T.border, borderRadius: 12, overflow: "hidden" }}>
    <div style={{ padding: "12px 16px", background: color + "10", borderBottom: "1px solid " + T.border, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{title}</div>
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

const TotalRow = ({ label, value, strong, color, negative }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: strong ? T.bg3 : "transparent", borderRadius: 6, marginTop: strong ? 8 : 0, borderTop: strong ? "1px solid " + T.border : "none" }}>
    <span style={{ fontSize: strong ? 13 : 12, fontWeight: strong ? 700 : 500, color: color || T.txt2 }}>{label}</span>
    <span style={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 800 : 600, color: color || (negative ? T.red : T.txt), fontFamily: "monospace" }}>
      {negative ? "−" : ""}{fm(Math.abs(value || 0))}
    </span>
  </div>
);

const StepHeader = ({ number, title, subtitle, total }) => (
  <div style={{ marginBottom: 20, padding: "16px 20px", background: T.bg3, borderRadius: 12, borderLeft: "4px solid " + T.blue }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: 1 }}>Paso {number} de 5</div>
    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{title}</div>
    {subtitle && <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{subtitle}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// PASOS DEL WIZARD
// ─────────────────────────────────────────────────────────────────────────

function Paso1Identificacion({ data, update }) {
  const ident = data.identificacion || {};

  return (
    <>
      <StepHeader number={1} title="Identificación y régimen" subtitle="Datos básicos de la empresa declarante" />

      <Section title="Información societaria" icon="🏢" color={T.blue}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>Tipo societario</label>
          <select
            value={ident.tipoSocietario || ""}
            onChange={(e) => update({ ...ident, tipoSocietario: e.target.value })}
            style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", outline: "none" }}
          >
            <option value="">— Seleccioná —</option>
            <option value="sas">SAS — Sociedad por Acciones Simplificada</option>
            <option value="ltda">Ltda — Limitada</option>
            <option value="sa">SA — Sociedad Anónima</option>
            <option value="esal">ESAL — Sin ánimo de lucro</option>
            <option value="ut">UT/Consorcio</option>
            <option value="otra">Otra</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>Régimen tributario</label>
          <select
            value={ident.regimen || ""}
            onChange={(e) => update({ ...ident, regimen: e.target.value })}
            style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", outline: "none" }}
          >
            <option value="">— Seleccioná —</option>
            <option value="ordinario">Ordinario (35%)</option>
            <option value="simple">Simple (RST 1.4–11.5%)</option>
            <option value="zona_franca">Zona Franca (20%)</option>
            <option value="chc">CHC — Holding (35% con exenciones)</option>
            <option value="exenta">Economía Naranja / Exenta (0%)</option>
          </select>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>Este régimen se usa para calcular la tarifa aplicable.</div>
        </div>

        <Field
          label="Actividad económica principal (código CIIU)"
          value={ident.ciiu}
          onChange={(v) => update({ ...ident, ciiu: v })}
          placeholder="Ej: 6810 (actividades inmobiliarias)"
          hint="Código CIIU de 4 dígitos. Define el grupo de actividad en Régimen Simple."
          optional
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>¿Gran contribuyente?</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["Sí", "No"].map((v) => {
                const sel = ident.granContribuyente === (v === "Sí");
                return (
                  <button key={v} type="button" onClick={() => update({ ...ident, granContribuyente: v === "Sí" })}
                    style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (sel ? T.blue : T.border), background: sel ? T.blueDim : T.bg3, color: sel ? T.blue : T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>¿Obligado a llevar contabilidad?</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["Sí", "No"].map((v) => {
                const sel = ident.obligadoContabilidad === (v === "Sí");
                return (
                  <button key={v} type="button" onClick={() => update({ ...ident, obligadoContabilidad: v === "Sí" })}
                    style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1px solid " + (sel ? T.blue : T.border), background: sel ? T.blueDim : T.bg3, color: sel ? T.blue : T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Año fiscal" icon="📅" color={T.purple}>
        <Field
          label="Año gravable a declarar"
          value={ident.anoGravable}
          onChange={(v) => update({ ...ident, anoGravable: v })}
          placeholder="2025"
          hint="Año fiscal al que corresponden los ingresos, gastos y demás valores que ingresarás en este wizard."
        />
      </Section>
    </>
  );
}

function Paso2Ingresos({ data, update, anterior }) {
  const ing = data.ingresos || {};
  const updateField = (key, v) => update({ ...ing, [key]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  const total = (+ing.operacionales || 0) + (+ing.noOperacionales || 0) + (+ing.interesesFinancieros || 0)
    + (+ing.dividendos || 0) + (+ing.utilidadFIC || 0) + (+ing.arrendamientos || 0)
    + (+ing.rendimientosExterior || 0) + (+ing.otrosIngresos || 0);

  const devoluciones = +ing.devoluciones || 0;
  const netos = total - devoluciones;

  // Ingresos no constitutivos de renta
  const incrngoFIC = +ing.utilidadFIC || 0; // Art. 23-1: FIC no son sujetos del impuesto
  const incrngoDividendos = +ing.dividendosIntersocietarios || 0; // Art. 48: dividendos inter-societarios

  const ingGravables = Math.max(0, netos - incrngoFIC - incrngoDividendos);

  return (
    <>
      <StepHeader number={2} title="Ingresos brutos" subtitle="Todos los ingresos recibidos en el año fiscal. Formulario 110, renglones 42–46." />

      <Section title="Ingresos operacionales (actividad principal)" icon="💼" color={T.blue}>
        <Field
          label="Ingresos operacionales"
          casilla="42"
          articulo="Art. 26 ET"
          value={ing.operacionales}
          onChange={(v) => updateField("operacionales", v)}
          prevYear={anterior?.ingresosOperacionales}
          prevYearLabel={pyLabel}
          hint="Ingresos totales anuales de la actividad económica principal (ventas, servicios, arriendos si es inmobiliaria)."
        />
        <Field
          label="Ingresos no operacionales"
          casilla="43"
          articulo="Art. 26 ET"
          value={ing.noOperacionales}
          onChange={(v) => updateField("noOperacionales", v)}
          prevYear={anterior?.ingresosNoOperacionales}
          prevYearLabel={pyLabel}
          hint="Ingresos por actividades secundarias o eventuales."
          optional
        />
      </Section>

      <Section title="Rendimientos financieros" icon="💰" color={T.cyan}>
        <Field
          label="Intereses bancarios y CDTs"
          articulo="Art. 26 ET"
          value={ing.interesesFinancieros}
          onChange={(v) => updateField("interesesFinancieros", v)}
          hint="Rendimientos de cuentas, CDTs, bonos. Sujetos a retención 7%."
          optional
        />
        <Field
          label="Utilidad de Fondos de Inversión Colectiva (FIC)"
          articulo="Art. 23-1 ET"
          value={ing.utilidadFIC}
          onChange={(v) => updateField("utilidadFIC", v)}
          hint="Distribuciones de FIC. El fondo ya tributó — para el partícipe es NO constitutivo de renta cuando el subyacente es gravado."
          optional
        />
        <Field
          label="Dividendos inter-societarios"
          articulo="Art. 48 ET"
          value={ing.dividendosIntersocietarios}
          onChange={(v) => updateField("dividendosIntersocietarios", v)}
          prevYear={anterior?.dividendos}
          prevYearLabel={pyLabel}
          hint="Dividendos recibidos de otras sociedades colombianas. NO gravados (no constitutivos de renta)."
          optional
        />
        <Field
          label="Otros dividendos gravados"
          articulo="Art. 49 ET"
          value={ing.dividendos}
          onChange={(v) => updateField("dividendos", v)}
          hint="Dividendos de sociedades extranjeras o sujetos a gravamen."
          optional
        />
      </Section>

      <Section title="Otros ingresos" icon="🏠" color={T.orange}>
        <Field
          label="Arrendamientos (si NO es actividad principal)"
          articulo="Art. 26 ET"
          value={ing.arrendamientos}
          onChange={(v) => updateField("arrendamientos", v)}
          hint="Ingresos por arriendos cuando la actividad principal es otra."
          optional
        />
        <Field
          label="Ingresos del exterior"
          articulo="Art. 20 ET"
          value={ing.rendimientosExterior}
          onChange={(v) => updateField("rendimientosExterior", v)}
          hint="Rendimientos, regalías o servicios provenientes del exterior."
          optional
        />
        <Field
          label="Otros ingresos"
          value={ing.otrosIngresos}
          onChange={(v) => updateField("otrosIngresos", v)}
          hint="Ingresos que no entran en las categorías anteriores."
          optional
        />
      </Section>

      <Section title="Devoluciones y ajustes" icon="↩️" color={T.red}>
        <Field
          label="Devoluciones, rebajas y descuentos concedidos"
          casilla="46"
          articulo="Art. 26 ET"
          value={ing.devoluciones}
          onChange={(v) => updateField("devoluciones", v)}
          hint="Devoluciones a clientes, descuentos comerciales, rebajas aplicadas durante el año."
          optional
        />
      </Section>

      <Section title="Resumen" icon="📊" color={T.green}>
        <TotalRow label="Total ingresos brutos" value={total} />
        <TotalRow label="(−) Devoluciones y descuentos" value={devoluciones} negative />
        <TotalRow label="Ingresos netos" value={netos} strong />
        {incrngoFIC > 0 && <TotalRow label="(−) INCRNGO Utilidad FIC (Art. 23-1)" value={incrngoFIC} negative color={T.green} />}
        {incrngoDividendos > 0 && <TotalRow label="(−) INCRNGO Dividendos inter-societarios (Art. 48)" value={incrngoDividendos} negative color={T.green} />}
        <TotalRow label="Ingresos gravables (base para depuración)" value={ingGravables} strong color={T.blue} />
      </Section>
    </>
  );
}

function Paso3Depuracion({ data, update, anterior }) {
  const dep = data.depuracion || {};
  const updateField = (key, v) => update({ ...dep, [key]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  // Totales calculados
  const costosVenta = +dep.costosVenta || 0;
  const nomina = +dep.nomina || 0;
  const honorarios = +dep.honorarios || 0;
  const arriendos = +dep.arriendos || 0;
  const servicios = +dep.servicios || 0;
  const mantenimiento = +dep.mantenimiento || 0;
  const impuestosDeducibles = +dep.impuestosDeducibles || 0;
  const gastosFinancieros = +dep.gastosFinancieros || 0;
  const depreciacion = +dep.depreciacion || 0;
  const deducEspeciales = +dep.deduccionEspecialCTI || 0;
  const provisionCartera = +dep.provisionCartera || 0;
  const otrasDeducciones = +dep.otrasDeducciones || 0;

  const gmf50 = +dep.gmfPagado ? (+dep.gmfPagado * 0.5) : 0;

  const totalDeducciones = costosVenta + nomina + honorarios + arriendos + servicios + mantenimiento
    + impuestosDeducibles + gastosFinancieros + depreciacion + deducEspeciales
    + provisionCartera + gmf50 + otrasDeducciones;

  return (
    <>
      <StepHeader number={3} title="Depuración: costos y deducciones" subtitle="Todo lo que se resta de los ingresos gravables para llegar a la renta líquida. Formulario 110, renglones 47–58." />

      <Section title="Costos de venta" icon="📦" color={T.orange}>
        <Field
          label="Costo de ventas o servicios"
          casilla="47"
          articulo="Art. 58–71 ET"
          value={dep.costosVenta}
          onChange={(v) => updateField("costosVenta", v)}
          prevYear={anterior?.costos}
          prevYearLabel={pyLabel}
          hint="Aplicable si vendés productos o servicios. Para rentistas/tenedores, usar $0."
          optional
        />
      </Section>

      <Section title="Deducciones operacionales" icon="💼" color={T.blue}>
        <Field
          label="Nómina (salarios + prestaciones + aportes)"
          articulo="Art. 107 ET"
          value={dep.nomina}
          onChange={(v) => updateField("nomina", v)}
          hint="Incluye salarios, cesantías, primas, vacaciones, aportes a salud, pensión y parafiscales del año."
          optional
        />
        <Field
          label="Honorarios profesionales"
          articulo="Art. 107 ET"
          value={dep.honorarios}
          onChange={(v) => updateField("honorarios", v)}
          hint="Contador, abogado, revisor fiscal, consultores, asesores."
          optional
        />
        <Field
          label="Arrendamientos pagados"
          articulo="Art. 107 ET"
          value={dep.arriendos}
          onChange={(v) => updateField("arriendos", v)}
          hint="Arriendo de oficina, bodega, equipos."
          optional
        />
        <Field
          label="Servicios públicos y de terceros"
          articulo="Art. 107 ET"
          value={dep.servicios}
          onChange={(v) => updateField("servicios", v)}
          hint="Agua, luz, gas, internet, telefonía, aseo, vigilancia."
          optional
        />
        <Field
          label="Mantenimiento y reparaciones"
          articulo="Art. 107 ET"
          value={dep.mantenimiento}
          onChange={(v) => updateField("mantenimiento", v)}
          hint="Reparaciones menores que no aumenten vida útil del activo."
          optional
        />
      </Section>

      <Section title="Impuestos pagados y gastos financieros" icon="🏛️" color={T.purple}>
        <Field
          label="Impuestos deducibles pagados (100%)"
          articulo="Art. 115 ET"
          value={dep.impuestosDeducibles}
          onChange={(v) => updateField("impuestosDeducibles", v)}
          hint="Predial, ICA, contribuciones especiales (100% deducibles). No incluye GMF."
          optional
        />
        <Field
          label="GMF 4×1000 pagado en el año"
          articulo="Art. 115 ET — 50% deducible"
          value={dep.gmfPagado}
          onChange={(v) => updateField("gmfPagado", v)}
          hint={"Valor total del GMF pagado. El simulador aplica automáticamente el 50% deducible. Este año deducirías: " + fm(gmf50)}
          optional
        />
        <Field
          label="Gastos financieros (intereses)"
          articulo="Art. 117, 118-1 ET"
          value={dep.gastosFinancieros}
          onChange={(v) => updateField("gastosFinancieros", v)}
          prevYear={anterior?.interesesFinancieros}
          prevYearLabel={pyLabel}
          hint="Intereses de créditos. Sujetos a regla de subcapitalización (ratio deuda/patrimonio)."
          optional
        />
      </Section>

      <Section title="Depreciación y amortización" icon="🏗️" color={T.cyan}>
        <Field
          label="Depreciación del período"
          articulo="Art. 128–140 ET"
          value={dep.depreciacion}
          onChange={(v) => updateField("depreciacion", v)}
          prevYear={anterior?.depreciaciones}
          prevYearLabel={pyLabel}
          hint="Depreciación según vida útil: inmuebles 45 años (2.22%/año), vehículos 5 años (20%/año), muebles 10 años, equipos de cómputo 3 años."
          optional
        />
      </Section>

      <Section title="Deducciones especiales" icon="⭐" color={T.green}>
        <Field
          label="Deducción especial por CT&I (inversión en ciencia/tecnología)"
          articulo="Art. 158-1 ET"
          value={dep.deduccionEspecialCTI}
          onChange={(v) => updateField("deduccionEspecialCTI", v)}
          hint="Inversiones calificadas en ciencia, tecnología e innovación. Además aplica como descuento directo."
          optional
        />
        <Field
          label="Provisión individual de cartera"
          articulo="Art. 145 ET"
          value={dep.provisionCartera}
          onChange={(v) => updateField("provisionCartera", v)}
          hint="Cartera con más de 90 días de vencimiento, calificada como de difícil cobro."
          optional
        />
        <Field
          label="Otras deducciones"
          value={dep.otrasDeducciones}
          onChange={(v) => updateField("otrasDeducciones", v)}
          hint="Donaciones deducibles, pérdidas por siniestros, deducibles no listados arriba."
          optional
        />
      </Section>

      <Section title="Resumen" icon="📊" color={T.orange}>
        <TotalRow label="Total costos y deducciones" value={totalDeducciones} strong color={T.orange} />
      </Section>
    </>
  );
}

function Paso4Compensaciones({ data, update, rentaLiquidaOrdinaria, anterior }) {
  const comp = data.compensaciones || {};
  const updateField = (key, v) => update({ ...comp, [key]: v });
  const pyLabel = anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null;

  const perdidasAnteriores = +comp.perdidasAnteriores || 0;
  const rentaExentaCHC = +comp.rentaExentaCHC || 0;
  const rentaExentaZonaFranca = +comp.rentaExentaZonaFranca || 0;
  const rentaExentaNaranja = +comp.rentaExentaNaranja || 0;
  const otrasRentasExentas = +comp.otrasRentasExentas || 0;

  const totalCompensaciones = Math.min(perdidasAnteriores, rentaLiquidaOrdinaria);
  const totalRentasExentas = rentaExentaCHC + rentaExentaZonaFranca + rentaExentaNaranja + otrasRentasExentas;

  const rentaLiqGravable = Math.max(0, rentaLiquidaOrdinaria - totalCompensaciones - totalRentasExentas);

  return (
    <>
      <StepHeader
        number={4}
        title="Compensaciones y rentas exentas"
        subtitle={"Renta líquida ordinaria del paso anterior: " + fm(rentaLiquidaOrdinaria) + ". Formulario 110, renglones 59–67."}
      />

      <Section title="Compensación de pérdidas fiscales" icon="📉" color={T.purple}>
        <Field
          label="Pérdidas fiscales acumuladas de años anteriores"
          casilla="59"
          articulo="Art. 147 ET"
          value={comp.perdidasAnteriores}
          onChange={(v) => updateField("perdidasAnteriores", v)}
          prevYear={anterior?.perdidasRemanentes}
          prevYearLabel={pyLabel ? pyLabel + " (saldo remanente)" : null}
          hint="Saldo de pérdidas fiscales no compensadas de años anteriores. Sin límite temporal. Se compensan hasta el monto de la renta líquida del año."
          optional
        />
        {perdidasAnteriores > rentaLiquidaOrdinaria && (
          <div style={{ padding: "8px 12px", background: T.orangeDim, borderRadius: 6, fontSize: 11, color: T.orange, marginTop: -8, marginBottom: 10 }}>
            ⚠ Solo se compensan {fm(rentaLiquidaOrdinaria)} este año. El saldo de {fm(perdidasAnteriores - rentaLiquidaOrdinaria)} queda para compensar en años siguientes.
          </div>
        )}
      </Section>

      <Section title="Rentas exentas por régimen especial" icon="🌟" color={T.green}>
        <Field
          label="Renta exenta CHC (holdings)"
          articulo="Art. 894 ET"
          value={comp.rentaExentaCHC}
          onChange={(v) => updateField("rentaExentaCHC", v)}
          hint="Dividendos y ganancias ocasionales de subsidiarias extranjeras para CHC calificadas."
          optional
        />
        <Field
          label="Renta exenta Zona Franca"
          articulo="Art. 240-1 ET"
          value={comp.rentaExentaZonaFranca}
          onChange={(v) => updateField("rentaExentaZonaFranca", v)}
          hint="Renta calificada como exenta bajo régimen de zona franca."
          optional
        />
        <Field
          label="Renta exenta Economía Naranja"
          articulo="Art. 235-2 num 1–2 ET"
          value={comp.rentaExentaNaranja}
          onChange={(v) => updateField("rentaExentaNaranja", v)}
          hint="Beneficio vigente para industrias creativas calificadas."
          optional
        />
        <Field
          label="Otras rentas exentas"
          value={comp.otrasRentasExentas}
          onChange={(v) => updateField("otrasRentasExentas", v)}
          hint="Rentas exentas por otros conceptos legales (ej: arts. 206, 207 ET)."
          optional
        />
      </Section>

      <Section title="Resumen" icon="📊" color={T.cyan}>
        <TotalRow label="Renta líquida ordinaria" value={rentaLiquidaOrdinaria} />
        <TotalRow label="(−) Compensación de pérdidas aplicada" value={totalCompensaciones} negative color={T.green} />
        {totalRentasExentas > 0 && <TotalRow label="(−) Rentas exentas" value={totalRentasExentas} negative color={T.green} />}
        <TotalRow label="Renta líquida gravable" value={rentaLiqGravable} strong color={T.cyan} />
      </Section>
    </>
  );
}

function Paso5Liquidacion({ data, update, rentaLiqGravable, regimen, ingresosGravables, anterior }) {
  const liq = data.liquidacion || {};
  const updateField = (key, v) => update({ ...liq, [key]: v });

  // Cálculo del impuesto según régimen
  let tarifa, impuestoBruto, tarifaLabel;
  if (regimen === "ordinario") {
    tarifa = 0.35;
    impuestoBruto = rentaLiqGravable * 0.35;
    tarifaLabel = "35% ordinario";
  } else if (regimen === "simple") {
    tarifa = 0.05; // placeholder — requiere CIIU para tarifa exacta
    impuestoBruto = ingresosGravables * 0.05;
    tarifaLabel = "5% Simple (estimado)";
  } else if (regimen === "zona_franca") {
    tarifa = 0.20;
    impuestoBruto = rentaLiqGravable * 0.20;
    tarifaLabel = "20% Zona Franca";
  } else if (regimen === "chc") {
    tarifa = 0.35;
    impuestoBruto = rentaLiqGravable * 0.35;
    tarifaLabel = "35% CHC";
  } else if (regimen === "exenta") {
    tarifa = 0;
    impuestoBruto = 0;
    tarifaLabel = "Exenta";
  } else {
    tarifa = 0.35;
    impuestoBruto = rentaLiqGravable * 0.35;
    tarifaLabel = "35%";
  }

  // Descuentos tributarios
  const descCTI = +liq.descuentoCTI || 0;
  const descEmpleo = +liq.descuentoEmpleo || 0;
  const descExterior = +liq.descuentoExterior || 0;
  const descDonaciones = +liq.descuentoDonaciones || 0;
  const descOtros = +liq.descuentoOtros || 0;
  const descuentosSolicitados = descCTI + descEmpleo + descExterior + descDonaciones + descOtros;

  // Tope 25% Art. 259 ET (aplica a ordinario, zona_franca, chc)
  const topeDescuentos = (regimen === "ordinario" || regimen === "zona_franca" || regimen === "chc")
    ? impuestoBruto * 0.25 : Infinity;
  const descuentosAplicados = Math.min(descuentosSolicitados, topeDescuentos);
  const descuentosRechazados = descuentosSolicitados - descuentosAplicados;

  // Impuesto neto de renta
  const impuestoNeto = Math.max(0, impuestoBruto - descuentosAplicados);

  // Ganancias ocasionales (independientes)
  const gananciasOcasionales = +liq.gananciasOcasionales || 0;
  const impuestoGananciasOcasionales = gananciasOcasionales * 0.15; // tarifa general actual

  // Retenciones y anticipos
  const retenciones = +liq.retencionesAnio || 0;
  const anticipoAnterior = +liq.anticipoAnterior || 0;
  const autoRetenciones = +liq.autoRetenciones || 0;

  // Anticipo renta siguiente año (75% del impuesto neto — Art. 807 ET)
  // Simplificación: 75% del impuesto neto cuando es primer año, 75% del promedio 2 años cuando hay historia
  const anticipoProximoAno = +liq.anticipoProximoAnoManual != null
    ? +liq.anticipoProximoAnoManual
    : Math.round(impuestoNeto * 0.75);

  const totalImpuesto = impuestoNeto + impuestoGananciasOcasionales + anticipoProximoAno;
  const totalCreditos = retenciones + anticipoAnterior + autoRetenciones;
  const saldoAPagar = Math.max(0, totalImpuesto - totalCreditos);
  const saldoAFavor = Math.max(0, totalCreditos - totalImpuesto);

  return (
    <>
      <StepHeader
        number={5}
        title="Liquidación del impuesto"
        subtitle={"Renta líquida gravable: " + fm(rentaLiqGravable) + " · Tarifa: " + tarifaLabel}
      />

      <Section title="Impuesto de renta" icon="🧮" color={T.blue}>
        <div style={{ padding: "12px 14px", background: T.blueDim, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.txt2, marginBottom: 6 }}>Cálculo automático según régimen</div>
          <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>Base gravable</span>
            <span style={{ fontFamily: "monospace", color: T.txt }}>{fm(regimen === "simple" ? ingresosGravables : rentaLiqGravable)}</span>
          </div>
          <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>× Tarifa</span>
            <span style={{ fontFamily: "monospace", color: T.blue }}>{(tarifa * 100).toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid " + T.border, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Impuesto bruto</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: T.blue }}>{fm(impuestoBruto)}</span>
          </div>
        </div>
      </Section>

      <Section title="Descuentos tributarios (Art. 256–259 ET)" icon="💠" color={T.purple}>
        <div style={{ fontSize: 11, color: T.txt3, marginBottom: 12, padding: "8px 12px", background: T.purpleDim, borderRadius: 6 }}>
          ℹ️ Los descuentos son valores que resta directamente del impuesto. Tope legal: no pueden reducir el impuesto neto por debajo del 75% del bruto (Art. 259 ET). Si declarás más del tope, el exceso no se aplica este año.
        </div>
        <Field
          label="Descuento CT&I (inversión ciencia y tecnología)"
          articulo="Art. 158-1 ET"
          value={liq.descuentoCTI}
          onChange={(v) => updateField("descuentoCTI", v)}
          hint="25% del valor invertido en proyectos CT&I calificados por Minciencias."
          optional
        />
        <Field
          label="Descuento por generación de empleo primera vez"
          articulo="Art. 108-5 ET"
          value={liq.descuentoEmpleo}
          onChange={(v) => updateField("descuentoEmpleo", v)}
          hint="120% de los pagos salariales y prestacionales a menores de 28 años en primer empleo."
          optional
        />
        <Field
          label="Descuento por impuestos pagados en el exterior"
          articulo="Art. 254 ET"
          value={liq.descuentoExterior}
          onChange={(v) => updateField("descuentoExterior", v)}
          hint="Crédito tributario por impuesto de renta pagado en otro país sobre rentas que también tributan en Colombia."
          optional
        />
        <Field
          label="Descuento por donaciones"
          articulo="Art. 257 ET"
          value={liq.descuentoDonaciones}
          onChange={(v) => updateField("descuentoDonaciones", v)}
          hint="25% del valor donado a entidades sin ánimo de lucro calificadas."
          optional
        />
        <Field
          label="Otros descuentos"
          value={liq.descuentoOtros}
          onChange={(v) => updateField("descuentoOtros", v)}
          hint="Otros descuentos directos no listados arriba."
          optional
        />

        {descuentosSolicitados > 0 && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: descuentosRechazados > 0 ? T.orangeDim : T.greenDim, borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: descuentosRechazados > 0 ? T.orange : T.green, marginBottom: 4 }}>
              {descuentosRechazados > 0 ? "⚠ Tope del 25% aplicado (Art. 259 ET)" : "✅ Descuentos aplicados dentro del tope"}
            </div>
            <div style={{ fontSize: 10, color: T.txt2 }}>
              Solicitados: {fm(descuentosSolicitados)} · Aplicados: {fm(descuentosAplicados)}
              {descuentosRechazados > 0 && " · Excedente: " + fm(descuentosRechazados)}
            </div>
          </div>
        )}
      </Section>

      <Section title="Ganancias ocasionales (si aplica)" icon="🎲" color={T.orange}>
        <Field
          label="Ganancias ocasionales gravadas"
          casilla="68"
          articulo="Art. 299–317 ET"
          value={liq.gananciasOcasionales}
          onChange={(v) => updateField("gananciasOcasionales", v)}
          hint="Venta de activos poseídos >2 años, herencias, loterías. Tarifa general 15%."
          optional
        />
      </Section>

      <Section title="Retenciones y anticipos del año" icon="💳" color={T.cyan}>
        <Field
          label="Retenciones en la fuente del año"
          articulo="Art. 373 ET"
          value={liq.retencionesAnio}
          onChange={(v) => updateField("retencionesAnio", v)}
          prevYear={anterior?.retenciones}
          prevYearLabel={anterior?.anoGravable ? `Año ${anterior.anoGravable}` : null}
          hint="Suma total de retenciones en la fuente que te practicaron durante el año (según certificados recibidos)."
          optional
        />
        <Field
          label="Autorretenciones practicadas"
          articulo="Art. 365 ET"
          value={liq.autoRetenciones}
          onChange={(v) => updateField("autoRetenciones", v)}
          hint="Autorretenciones aplicadas si sos autorretenedor calificado."
          optional
        />
        <Field
          label="Anticipo del año anterior"
          articulo="Art. 807 ET"
          value={liq.anticipoAnterior}
          onChange={(v) => updateField("anticipoAnterior", v)}
          prevYear={anterior?.anticipoGenerado}
          prevYearLabel={anterior?.anoGravable ? `Generado año ${anterior.anoGravable}` : null}
          hint="Anticipo de renta del año siguiente pagado en la declaración del año pasado."
          optional
        />
      </Section>

      <Section title="Anticipo renta próximo año" icon="🔜" color={T.purple}>
        <div style={{ fontSize: 11, color: T.txt3, marginBottom: 10, lineHeight: 1.5 }}>
          Por defecto: 75% del impuesto neto (Art. 807 ET). Si tu contador usa otro cálculo (50% primer año, promedio 2 años, etc.), ingresalo manualmente.
        </div>
        <Field
          label="Anticipo próximo año (manual)"
          articulo="Art. 807 ET"
          value={liq.anticipoProximoAnoManual}
          onChange={(v) => updateField("anticipoProximoAnoManual", v)}
          placeholder={"Cálculo automático: " + fm(Math.round(impuestoNeto * 0.75))}
          hint={"Dejalo vacío para usar el cálculo automático 75%. Actualmente: " + fm(anticipoProximoAno)}
          optional
        />
      </Section>

      <Section title="🏛️ RESULTADO DE LA DECLARACIÓN" icon="" color={saldoAPagar > 0 ? T.red : T.green}>
        <TotalRow label="Impuesto bruto" value={impuestoBruto} />
        {descuentosAplicados > 0 && <TotalRow label="(−) Descuentos tributarios aplicados" value={descuentosAplicados} negative color={T.green} />}
        <TotalRow label="Impuesto neto de renta" value={impuestoNeto} strong />
        {impuestoGananciasOcasionales > 0 && <TotalRow label="(+) Impuesto ganancias ocasionales (15%)" value={impuestoGananciasOcasionales} />}
        {anticipoProximoAno > 0 && <TotalRow label="(+) Anticipo renta próximo año (75%)" value={anticipoProximoAno} />}
        <TotalRow label="Total impuesto a cargo" value={totalImpuesto} strong color={T.blue} />
        <div style={{ margin: "8px 0", borderTop: "1px dashed " + T.border }} />
        <TotalRow label="(−) Retenciones año" value={retenciones} negative color={T.cyan} />
        {autoRetenciones > 0 && <TotalRow label="(−) Autorretenciones" value={autoRetenciones} negative color={T.cyan} />}
        {anticipoAnterior > 0 && <TotalRow label="(−) Anticipo año anterior" value={anticipoAnterior} negative color={T.cyan} />}
        <TotalRow label="Total créditos" value={totalCreditos} />
        <div style={{ margin: "12px 0", borderTop: "2px solid " + T.border }} />
        {saldoAPagar > 0 && (
          <div style={{ padding: "14px 16px", background: T.redDim, borderRadius: 10, borderLeft: "4px solid " + T.red }}>
            <div style={{ fontSize: 11, color: T.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Saldo a pagar</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.red, fontFamily: "monospace", marginTop: 4 }}>{fm(saldoAPagar)}</div>
          </div>
        )}
        {saldoAFavor > 0 && (
          <div style={{ padding: "14px 16px", background: T.greenDim, borderRadius: 10, borderLeft: "4px solid " + T.green }}>
            <div style={{ fontSize: 11, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Saldo a favor</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.green, fontFamily: "monospace", marginTop: 4 }}>{fm(saldoAFavor)}</div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Devolución o compensación disponible.</div>
          </div>
        )}
        {anterior?.impuestoRenta > 0 && (
          <AlertasAnoAnterior
            anoAnterior={anterior.anoGravable}
            comparaciones={[
              { label: "Ingresos operacionales", actual: +data.ingresos?.operacionales || 0, anterior: anterior.ingresosOperacionales, sugerencia: "Si subió mucho, confirmá que es crecimiento real del negocio. Si bajó, revisá que sumaste todas las facturas del año." },
              { label: "Retenciones en la fuente", actual: retenciones, anterior: anterior.retenciones, sugerencia: "Las retenciones deberían ser proporcionales a los ingresos. Delta muy grande puede ser falta de certificados de retención." },
              { label: "Impuesto neto de renta", actual: totalImpuesto, anterior: anterior.impuestoRenta, sugerencia: totalImpuesto > anterior.impuestoRenta * 1.5 ? "Revisá si hay gastos o deducciones (depreciación, nómina, ICA) que no cargaste." : null },
            ].filter(c => c.anterior > 0)}
            patronesContext={{
              actual: {
                ingresos: (+data.ingresos?.operacionales || 0) + (+data.ingresos?.noOperacionales || 0) + (+data.ingresos?.dividendos || 0),
                retenciones: retenciones,
                impuesto: totalImpuesto,
                dividendos: +data.ingresos?.dividendos || 0,
              },
              anterior: {
                ingresos: (anterior.ingresosOperacionales || 0) + (anterior.ingresosNoOperacionales || 0) + (anterior.dividendos || 0),
                retenciones: anterior.retenciones || 0,
                impuesto: anterior.impuestoRenta || 0,
                dividendos: anterior.dividendos || 0,
              },
            }}
          />
        )}
      </Section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL — WIZARD
// ─────────────────────────────────────────────────────────────────────────

export default function Formulario110({ owner, onSave, onCancel }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(owner?.formulario110 || {
    identificacion: { regimen: owner?.regimen || "ordinario", tipoSocietario: "sas" },
    ingresos: {},
    depuracion: {},
    compensaciones: {},
    liquidacion: {},
  });

  // Cálculos derivados que los pasos comparten
  const derivados = useMemo(() => {
    const ing = data.ingresos || {};
    const dep = data.depuracion || {};

    const totalIngresos = (+ing.operacionales || 0) + (+ing.noOperacionales || 0) + (+ing.interesesFinancieros || 0)
      + (+ing.dividendos || 0) + (+ing.utilidadFIC || 0) + (+ing.arrendamientos || 0)
      + (+ing.rendimientosExterior || 0) + (+ing.otrosIngresos || 0);

    const devoluciones = +ing.devoluciones || 0;
    const incrngo = (+ing.utilidadFIC || 0) + (+ing.dividendosIntersocietarios || 0);
    const ingresosGravables = Math.max(0, totalIngresos - devoluciones - incrngo);

    const gmf50 = +dep.gmfPagado ? (+dep.gmfPagado * 0.5) : 0;
    const totalDeducciones = (+dep.costosVenta || 0) + (+dep.nomina || 0) + (+dep.honorarios || 0)
      + (+dep.arriendos || 0) + (+dep.servicios || 0) + (+dep.mantenimiento || 0)
      + (+dep.impuestosDeducibles || 0) + (+dep.gastosFinancieros || 0) + (+dep.depreciacion || 0)
      + (+dep.deduccionEspecialCTI || 0) + (+dep.provisionCartera || 0) + gmf50
      + (+dep.otrasDeducciones || 0);

    const rentaLiquidaOrdinaria = Math.max(0, ingresosGravables - totalDeducciones);

    return { totalIngresos, ingresosGravables, totalDeducciones, rentaLiquidaOrdinaria };
  }, [data.ingresos, data.depuracion]);

  const regimen = data.identificacion?.regimen || "ordinario";

  // Mapeo año anterior → renglones del F-110 del año actual. Si el owner
  // tiene declaracionAnterior (F-110), cada campo equivalente recibe el
  // valor del año pasado como referencia comparativa.
  const anterior = useMemo(() => {
    const da = owner?.declaracionAnterior;
    if (!da || da.tipo !== "F110") return null;
    const r = da.renglones || {};
    return {
      anoGravable: da.anoGravable,
      ingresosOperacionales: +r.ingresosOperacionales || 0,
      ingresosNoOperacionales: +r.ingresosNoOperacionales || 0,
      dividendos: +r.dividendos || 0,
      costos: +r.costos || 0,
      gastosDeducibles: +r.gastosDeducibles || 0,
      depreciaciones: +r.depreciaciones || 0,
      interesesFinancieros: +r.interesesFinancieros || 0,
      perdidasAplicadas: +r.perdidasAplicadas || 0,
      perdidasRemanentes: +r.perdidasRemanentes || 0,
      rentaLiquidaGravable: +r.rentaLiquidaGravable || 0,
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
    { n: 4, label: "Compensaciones" },
    { n: 5, label: "Liquidación" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, padding: "18px 22px", background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(167,139,250,0.08))", borderRadius: 14, border: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26 }}>📋</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Formulario 110 · Declaración de Renta</div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
              {owner?.name || "Persona Jurídica"} · Año gravable {data.identificacion?.anoGravable || "—"}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            ← Volver
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.txt3, marginTop: 12, lineHeight: 1.5 }}>
          Este wizard replica la estructura real del Formulario 110 DIAN. Los valores que ingresas se guardan en el perfil de <strong>{owner?.name}</strong> y NO se mezclan con los datos del simulador rápido. Los cálculos siguen el Estatuto Tributario colombiano y la Ley 2277/2022.
        </div>
      </div>

      {/* Step tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto" }}>
        {steps.map((s) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <button key={s.n} onClick={() => setStep(s.n)}
              style={{
                flex: "1 1 auto", minWidth: 100,
                padding: "10px 12px", border: "1px solid " + (active ? T.blue : done ? T.green : T.border),
                background: active ? T.blueDim : done ? T.greenDim : T.bg3,
                color: active ? T.blue : done ? T.green : T.txt3,
                borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
              <div style={{ fontSize: 10 }}>Paso {s.n}{done && " ✓"}</div>
              <div>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div>
        {step === 1 && <Paso1Identificacion data={data} update={(v) => setData({ ...data, identificacion: v })} />}
        {step === 2 && <Paso2Ingresos data={data} update={(v) => setData({ ...data, ingresos: v })} anterior={anterior} />}
        {step === 3 && <Paso3Depuracion data={data} update={(v) => setData({ ...data, depuracion: v })} anterior={anterior} />}
        {step === 4 && <Paso4Compensaciones data={data} update={(v) => setData({ ...data, compensaciones: v })} rentaLiquidaOrdinaria={derivados.rentaLiquidaOrdinaria} anterior={anterior} />}
        {step === 5 && <Paso5Liquidacion data={data} update={(v) => setData({ ...data, liquidacion: v })}
          rentaLiqGravable={Math.max(0, derivados.rentaLiquidaOrdinaria - Math.min(+data.compensaciones?.perdidasAnteriores || 0, derivados.rentaLiquidaOrdinaria) - ((+data.compensaciones?.rentaExentaCHC || 0) + (+data.compensaciones?.rentaExentaZonaFranca || 0) + (+data.compensaciones?.rentaExentaNaranja || 0) + (+data.compensaciones?.otrasRentasExentas || 0)))}
          regimen={regimen}
          ingresosGravables={derivados.ingresosGravables}
          anterior={anterior} />}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ← Paso anterior
          </button>
        )}
        {step < 5 && (
          <button onClick={() => setStep(step + 1)} style={{ flex: 1, padding: "12px 20px", background: T.blue, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
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
        Este simulador sigue la estructura del Formulario 110 DIAN y el Estatuto Tributario vigente, pero NO reemplaza a tu contador público. Para tu declaración oficial, consultá con un profesional.
      </div>
    </div>
  );
}
