// ═══════════════════════════════════════════════════════════════════════════
// EDITAR DESCUENTOS TRIBUTARIOS (jurídicas)
// ─────────────────────────────────────────────────────────────────────────
// Modal que captura owner.descuentosTributarios para owners jurídicas.
// El motor estimarImpuesto() los lee para aplicar descuentos al impuesto
// bruto (no a la base). Son:
//   · CTI (Art. 158-1) — inversión en ciencia/tecnología/ambiental
//   · Empleo primera vez (Art. 108-5)
//   · Exterior (Art. 254) — impuestos pagados exterior con convenio
//   · Donaciones (Art. 257) — 25% del valor donado a ESAL calificadas
//   · Otros — cualquier otro descuento tributario
//
// Tope: el total no puede reducir el impuesto a menos del 75% del bruto
// (Art. 259 ET, solo ordinario y zona franca).
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { track } from "../lib/analytics.js";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4", green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

const Field = ({ label, articulo, value, onChange, hint, prevYear, prevYearLabel }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, flex: 1 }}>
        {label}
      </label>
      {articulo && <span style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{articulo}</span>}
    </div>
    <input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.value === "" ? null : +e.target.value)}
      placeholder="0"
      style={{
        width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt,
        padding: "10px 12px", borderRadius: 8, fontSize: 13, fontFamily: "monospace", outline: "none",
      }}
    />
    {prevYear != null && prevYear > 0 && (
      <button onClick={() => onChange(Math.round(prevYear))} title="Click para copiar este valor" style={{
        marginTop: 4, padding: "4px 8px", background: "rgba(6,182,212,0.12)", border: "1px solid " + T.cyan,
        color: T.cyan, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
      }}>
        📥 {prevYearLabel || "Año anterior"}: {fm(prevYear)}
      </button>
    )}
    {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

export default function EditarDescuentosTributarios({ owner, onSave, onCancel }) {
  // Fase 3 commit 7: gating reader.
  const { role } = useRole();
  const existing = owner?.descuentosTributarios || {};
  const [d, setD] = useState({
    // Descuentos (reducen el impuesto directo, tope 25% Art. 259 ET)
    cti: existing.cti || null,
    empleo: existing.empleo || null,
    exterior: existing.exterior || null,
    donaciones: existing.donaciones || null,
    otros: existing.otros || null,
    // Deducciones avanzadas (reducen la base gravable, sin tope global)
    provisionCarteraAnual: existing.provisionCarteraAnual || null,
    inversionCTIanual: existing.inversionCTIanual || null,
    salariosDiscapacidadAnual: existing.salariosDiscapacidadAnual || null,
  });

  const upd = (k, v) => setD({ ...d, [k]: v });

  // Valores año anterior (si hay declaración F-110 importada)
  const _decl = (owner?.declaraciones && owner.declaraciones[0]) || owner?.declaracionAnterior;
  const prev = _decl?.tipo === "F110" ? (_decl.renglones || {}) : {};
  const prevAno = _decl?.anoGravable;
  const prevLabel = prevAno ? `Año ${prevAno}` : null;

  // Descuentos (reducen impuesto directo): impacto = monto cargado
  const totalDescuentos = (+d.cti || 0) + (+d.empleo || 0) + (+d.exterior || 0) + (+d.donaciones || 0) + (+d.otros || 0);
  // Deducciones avanzadas (reducen base gravable). Impacto fiscal aproximado:
  //   - Provisión cartera: monto × 35% (régimen ordinario)
  //   - CT&I 175%: el 75% adicional × 35% = monto × 0.2625 sobre la inversión
  //   - Discapacidad 200%: el 100% adicional × 35% = monto × 0.35 sobre el salario
  const provImpacto = (+d.provisionCarteraAnual || 0) * 0.35;
  const ctiImpacto = (+d.inversionCTIanual || 0) * 0.75 * 0.35;
  const discImpacto = (+d.salariosDiscapacidadAnual || 0) * 1.0 * 0.35;
  const totalImpactoDeducciones = provImpacto + ctiImpacto + discImpacto;
  const total = totalDescuentos + totalImpactoDeducciones;

  const handleSave = () => {
    if (!guardEdit(role)) return;
    track("descuentos_tributarios_guardados", {
      owner_id: owner?.id,
      total_pesos_m: Math.round(total / 1e6),
      campos_capturados: Object.values(d).filter(v => +v > 0).length,
    });
    if (onSave) onSave(d);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>⭐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Descuentos tributarios</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            {owner?.name} · Estos valores se restan DIRECTO del impuesto de renta (no de la base)
          </div>
        </div>
      </div>

      <div style={{ padding: 14, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: T.orange, marginBottom: 4 }}>⚠️ Tope del 25% (Art. 259 ET)</div>
        El total aplicado no puede reducir el impuesto a menos del 75% del bruto (solo aplica a régimen ordinario y zona franca). El motor calcula esto automáticamente — capturá el monto TOTAL que te corresponde y el sistema aplica el tope.
      </div>

      {/* ── DEDUCCIONES AVANZADAS (reducen la base gravable, sin tope) ── */}
      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid " + T.border }}>
          <span style={{ fontSize: 16 }}>🧮</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.purple, flex: 1 }}>Deducciones avanzadas</div>
          <span style={{ fontSize: 9, color: T.txt3, fontWeight: 600 }}>Reducen la base · ahorro = monto × 35%</span>
        </div>
        <div style={{ padding: "10px 12px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, marginBottom: 14, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Estas son <strong style={{ color: T.txt }}>palancas que tu contador aplica</strong> y que el motor ahora puede capturar. A diferencia de los descuentos de abajo, estas reducen la <strong>base gravable</strong> (no el impuesto). El ahorro real es ~35% del monto cargado en régimen ordinario.
        </div>
        <Field
          label="Provisión por deterioro de cartera"
          articulo="Art. 145 ET"
          value={d.provisionCarteraAnual}
          onChange={(v) => upd("provisionCarteraAnual", v)}
          hint="Provisión individual por deudores morosos (+90 días vencidos), hasta 33% del valor de la cartera vencida. Tope global: 5% del total cartera. Tu contador la calcula al cierre del ejercicio."
        />
        <Field
          label="Inversión en CT&I (75% adicional sobre el gasto)"
          articulo="Art. 158-1 ET"
          value={d.inversionCTIanual}
          onChange={(v) => upd("inversionCTIanual", v)}
          hint="Total invertido el año en proyectos de I+D, innovación o ambiental aprobados por Minciencias. La deducción es del 175% del valor (el 100% ya está como gasto en Egresos; este campo aplica el 75% adicional). El descuento del 25% va abajo en CTI (es independiente y acumulable)."
        />
        <Field
          label="Salarios a personas con discapacidad ≥25%"
          articulo="Ley 361/97 Art. 31"
          value={d.salariosDiscapacidadAnual}
          onChange={(v) => upd("salariosDiscapacidadAnual", v)}
          hint="Total anual pagado en salarios + prestaciones a empleados con certificación de discapacidad ≥25%. Deducción del 200% (el 100% ya está en nómina; este campo aplica el 100% adicional). Sin tope. Requiere certificación de la Junta Médica."
        />
        {totalImpactoDeducciones > 0 && (
          <div style={{ padding: "10px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid " + T.purple, borderRadius: 8, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: T.txt2, fontSize: 12 }}>💰 Ahorro estimado de estas deducciones</span>
            <span style={{ color: T.purple, fontSize: 14, fontWeight: 800, fontFamily: "monospace" }}>~{fm(totalImpactoDeducciones)}/año</span>
          </div>
        )}
      </div>

      {/* ── DESCUENTOS (reducen el impuesto directo, tope 25% Art. 259 ET) ── */}
      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid " + T.border }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.green, flex: 1 }}>Descuentos del impuesto</div>
          <span style={{ fontSize: 9, color: T.txt3, fontWeight: 600 }}>Reducen el impuesto directo · sujetos a tope 25%</span>
        </div>
        <Field
          label="CTI — Inversión en ciencia, tecnología y ambiente"
          articulo="Art. 158-1 ET"
          value={d.cti}
          onChange={(v) => upd("cti", v)}
          prevYear={+prev.descCTI || 0}
          prevYearLabel={prevLabel}
          hint="Crédito tributario por inversión productiva en CTI aprobada por Colciencias / CONPES. Típicamente en empresas con I+D o productos ambientales."
        />
        <Field
          label="Empleo primera vez"
          articulo="Art. 108-5 ET"
          value={d.empleo}
          onChange={(v) => upd("empleo", v)}
          hint="120% de salarios pagados a personas menores de 28 años en su primer empleo formal."
        />
        <Field
          label="Impuestos pagados en el exterior"
          articulo="Art. 254 ET"
          value={d.exterior}
          onChange={(v) => upd("exterior", v)}
          prevYear={+prev.descCree || 0}
          prevYearLabel={prevLabel}
          hint="Impuestos pagados en países con convenio de doble tributación. Ver certificados del exterior."
        />
        <Field
          label="Donaciones a entidades sin ánimo de lucro"
          articulo="Art. 257 ET"
          value={d.donaciones}
          onChange={(v) => upd("donaciones", v)}
          prevYear={+prev.descDonaciones || 0}
          prevYearLabel={prevLabel}
          hint="25% del valor donado a ESAL calificadas. NO es deducción de la base, es descuento directo. El certificado de la ESAL debe incluir el RUT y número de resolución DIAN."
        />
        <Field
          label="Otros descuentos tributarios"
          value={d.otros}
          onChange={(v) => upd("otros", v)}
          hint="Cualquier otro descuento permitido por ley que no encaje en las categorías anteriores."
        />
      </div>

      <div style={{ padding: "12px 14px", background: T.bg2, borderRadius: 10, marginTop: 16, border: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: T.txt2, fontSize: 13, fontWeight: 600 }}>Total capturado</span>
        <span style={{ color: T.green, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{fm(total)}</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Cancelar
        </button>
        <button onClick={handleSave} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          💾 Guardar descuentos
        </button>
      </div>

      <div style={{ marginTop: 20, padding: 12, background: T.bg3, borderRadius: 10, fontSize: 10, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        Estos descuentos se aplican al impuesto de renta de <strong>{owner?.name}</strong> calculado por el motor, respetando el tope del 25% (Art. 259 ET). Podés editarlos en cualquier momento.
      </div>
    </div>
  );
}
