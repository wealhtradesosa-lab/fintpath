// ═══════════════════════════════════════════════════════════════════════════
// EDITAR APORTES MANUALES (persona natural)
// ─────────────────────────────────────────────────────────────────────────
// Modal que captura owner.aportes — overrides manuales de los aportes a
// seguridad social que el motor estimarImpuesto() usa para calcular:
//   · INCRNGO (aportes obligatorios no constitutivos de renta)
//   · Deducciones voluntarias (PV + AFC con tope 40% / 1340 UVT)
//   · Gross-up de salario neto → bruto si se requiere
//
// Si están vacíos, el motor usa HEURÍSTICOS por default:
//   · Pensión obligatoria: 4% del salario empleado, 16% × 0.4 IBC independiente
//   · Salud obligatoria: 4% del salario empleado, 12.5% × 0.4 IBC independiente
//   · No se asume pensión voluntaria ni AFC por default
//
// Capturar los valores reales da un cálculo más preciso, especialmente
// para quienes aportan a pensión voluntaria o tienen IBCs especiales.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { track } from "../lib/analytics.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4", green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

const Field = ({ label, articulo, value, onChange, hint }) => (
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
    {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

const Toggle = ({ label, value, onChange, hint }) => (
  <div style={{ marginBottom: 14, padding: "10px 12px", background: T.bg3, borderRadius: 8, border: "1px solid " + T.border }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.txt2, flex: 1, cursor: "pointer" }} onClick={() => onChange(!value)}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          padding: "4px 10px",
          background: value ? T.green : T.bg2,
          color: value ? "#000" : T.txt3,
          border: "1px solid " + (value ? T.green : T.border),
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 700,
          minWidth: 50,
        }}
      >
        {value ? "SÍ" : "NO"}
      </button>
    </div>
    {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

export default function EditarAportesManuales({ owner, onSave, onCancel }) {
  const existing = owner?.aportes || {};
  const [a, setA] = useState({
    pensionObligatoriaMensual: existing.pensionObligatoriaMensual || null,
    saludObligatoriaMensual: existing.saludObligatoriaMensual || null,
    segSocialIndependienteMensual: existing.segSocialIndependienteMensual || null,
    pensionVoluntariaMensual: existing.pensionVoluntariaMensual || null,
    salarioEsBruto: existing.salarioEsBruto !== false, // default true
  });

  const upd = (k, v) => setA({ ...a, [k]: v });

  const totalMensual = (+a.pensionObligatoriaMensual || 0) + (+a.saludObligatoriaMensual || 0) + (+a.segSocialIndependienteMensual || 0) + (+a.pensionVoluntariaMensual || 0);
  const totalAnual = totalMensual * 12;

  const handleSave = () => {
    track("aportes_manuales_guardados", {
      owner_id: owner?.id,
      total_anual_m: Math.round(totalAnual / 1e6),
      campos_capturados: Object.values(a).filter(v => typeof v === "number" && v > 0).length,
      salario_es_bruto: a.salarioEsBruto,
    });
    if (onSave) onSave(a);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🏥</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Aportes a seguridad social</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            {owner?.name} · Overrides manuales para el cálculo del simulador tributario
          </div>
        </div>
      </div>

      <div style={{ padding: 14, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: T.cyan, marginBottom: 4 }}>💡 Por qué capturar estos valores</div>
        El motor usa <strong>heurísticos por default</strong> (4% del salario, 16%×40% del IBC independiente). Si capturás los valores REALES de tu planilla/extracto, el cálculo del simulador se vuelve más preciso — especialmente si aportás a pensión voluntaria o tenés IBCs especiales.
      </div>

      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border }}>
        <Field
          label="Pensión obligatoria mensual (empleado)"
          articulo="Art. 55 ET"
          value={a.pensionObligatoriaMensual}
          onChange={(v) => upd("pensionObligatoriaMensual", v)}
          hint="4% de tu salario base si sos empleado. Mirá la planilla PILA o tu extracto."
        />
        <Field
          label="Salud obligatoria mensual (empleado)"
          articulo="Art. 55 ET"
          value={a.saludObligatoriaMensual}
          onChange={(v) => upd("saludObligatoriaMensual", v)}
          hint="4% de tu salario base si sos empleado."
        />
        <Field
          label="Seguridad social independiente (mensual total)"
          articulo="Art. 55 ET"
          value={a.segSocialIndependienteMensual}
          onChange={(v) => upd("segSocialIndependienteMensual", v)}
          hint="Si sos independiente: pensión + salud + riesgos. Típicamente 16-19% × (40% de tus honorarios). Lo que efectivamente pagaste en PILA."
        />
        <Field
          label="Pensión voluntaria mensual"
          articulo="Art. 126-1 ET"
          value={a.pensionVoluntariaMensual}
          onChange={(v) => upd("pensionVoluntariaMensual", v)}
          hint="Aportes voluntarios a fondo de pensión. Deducibles dentro del tope 40% / 1340 UVT. Permanencia mínima 10 años."
        />
        <Toggle
          label="Mi salario registrado en Ingresos es BRUTO (antes de aportes)"
          value={a.salarioEsBruto}
          onChange={(v) => upd("salarioEsBruto", v)}
          hint="Si registraste el salario NETO (ya descontados los aportes), desactivá este toggle para que el motor haga gross-up."
        />
      </div>

      <div style={{ padding: "12px 14px", background: T.bg2, borderRadius: 10, marginTop: 16, border: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: T.txt2, fontSize: 12, fontWeight: 600 }}>Total aportes anuales</div>
          <div style={{ color: T.txt3, fontSize: 10, marginTop: 2 }}>{fm(totalMensual)}/mes × 12</div>
        </div>
        <span style={{ color: T.green, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{fm(totalAnual)}</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Cancelar
        </button>
        <button onClick={handleSave} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          💾 Guardar aportes
        </button>
      </div>

      <div style={{ marginTop: 20, padding: 12, background: T.bg3, borderRadius: 10, fontSize: 10, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        Estos valores se usan en el <strong>Simulador tributario</strong> (pestaña Plan Tributario). Si los dejás en cero, el motor aplica heurísticos estándar. Podés editarlos en cualquier momento.
      </div>
    </div>
  );
}
