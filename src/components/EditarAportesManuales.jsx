// ═══════════════════════════════════════════════════════════════════════════
// AJUSTES FISCALES AVANZADOS (persona natural)
// ─────────────────────────────────────────────────────────────────────────
// Modal para ajustes de cálculo que no tienen hogar natural en otros módulos.
//
// Commit 1.8: los aportes migraron a sus lugares naturales:
//   · Pensión obligatoria / Salud obligatoria  → ing.aportes (Ingresos, form salario)
//   · Pensión Voluntaria                       → egreso AP_TRIB_PV (Egresos)
//   · AFC                                      → egreso AP_TRIB_AFC (Egresos)
//   · Salud prepagada                          → egreso AP_TRIB_SALUD_PREPAGADA
//
// Este modal queda sólo para edge cases que aún no tienen UI dedicada:
//   · Seguridad social total mensual (honorarios independientes, PILA)
//   · Flag salario-es-bruto (afecta gross-up si registraste salario neto)
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { track } from "../lib/analytics.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4", green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

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
    // Commit 1.8: sólo 2 campos sobreviven — el resto vive en Ingresos/Egresos
    segSocialIndependienteMensual: existing.segSocialIndependienteMensual || null,
    salarioEsBruto: existing.salarioEsBruto !== false, // default true
  });

  const upd = (k, v) => setA({ ...a, [k]: v });

  const handleSave = () => {
    track("ajustes_fiscales_avanzados_guardados", {
      owner_id: owner?.id,
      tiene_ss_indep: +a.segSocialIndependienteMensual > 0,
      salario_es_bruto: a.salarioEsBruto,
    });
    // Preservar campos existentes que no tocamos acá (por si quedan datos
    // legacy de pensionObligatoria/saludObligatoria/pensionVoluntaria que aún
    // no fueron migrados silenciosamente en esta sesión del navegador).
    if (onSave) onSave({ ...existing, ...a });
  };

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>⚙️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Ajustes fiscales avanzados</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            {owner?.name} · Casos especiales que no entran en Ingresos ni en Egresos
          </div>
        </div>
      </div>

      <div style={{ padding: 14, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: T.cyan, marginBottom: 4 }}>💡 ¿Dónde están los demás aportes?</div>
        <strong>Pensión y salud obligatorias</strong> viven dentro del form de cada salario (módulo <em>Ingresos</em>) — prellenadas al 4%+4% y editables.
        <strong> Pensión Voluntaria, AFC y Salud prepagada</strong> viven como egresos con categoría <em>"Aporte tributario"</em> (módulo <em>Egresos</em>).
        Este modal es sólo para los dos casos especiales de abajo.
      </div>

      <div style={{ background: T.bg2, borderRadius: 12, padding: 16, border: "1px solid " + T.border }}>
        <Field
          label="Seguridad social independiente — total mensual"
          articulo="Art. 55 ET"
          value={a.segSocialIndependienteMensual}
          onChange={(v) => upd("segSocialIndependienteMensual", v)}
          hint="Sólo si sos independiente con honorarios: pensión + salud + riesgos que aportás en PILA. Típicamente 16-19% × (40% de tus honorarios). Dejá en blanco si no aplica."
        />
        <Toggle
          label="Mi salario en Ingresos es BRUTO (antes de aportes)"
          value={a.salarioEsBruto}
          onChange={(v) => upd("salarioEsBruto", v)}
          hint="Recomendado: SÍ (es el default). Desactivá sólo si registraste el salario NETO (lo que efectivamente cae a la cuenta), para que el motor haga el gross-up correctamente."
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Cancelar
        </button>
        <button onClick={handleSave} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          💾 Guardar ajustes
        </button>
      </div>

      <div style={{ marginTop: 20, padding: 12, background: T.bg3, borderRadius: 10, fontSize: 10, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        Estos ajustes afectan sólo el <strong>Simulador tributario</strong>. Si los dejás en los valores por default, el motor aplica las reglas estándar para la mayoría de usuarios.
      </div>
    </div>
  );
}
