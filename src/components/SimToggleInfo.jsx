// ═══════════════════════════════════════════════════════════════════════════
// SIM TOGGLE INFO — Banner reutilizable (Commit 8.8)
// ─────────────────────────────────────────────────────────────────────────
// Aparece al top de cada módulo (Ingresos, Egresos, Deudas, Inversiones)
// para explicar al usuario QUÉ hace el checkbox ✅/⬜ de cada ítem.
//
// Dato: `sim` es un flag por ítem que, cuando está en false, excluye ese
// ítem de TODAS las simulaciones del sistema:
//   - Calculadora de impuestos
//   - Simulador Avanzado (patrimonio, cash flow)
//   - Coaches IA
//   - Asesor IA
//   - Dashboard Fiscal
//
// Sin explicación visible, el usuario no entiende por qué desactivar algo
// hace que "el impuesto baje" o que "no aparezca en el reporte".
// ═══════════════════════════════════════════════════════════════════════════

import { C } from "../lib/designTokens.js";

// Alias de compat para no reescribir todo el JSX.
const T = {
  bg2: C.surface,
  txt: C.text, txt2: C.muted, txt3: C.subtle,
  border: C.border,
  green: C.ok, orange: C.warn, blue: C.accent,
};

export default function SimToggleInfo({ total, activos, moduloNombre = "estos ítems" }) {
  const inactivos = (total || 0) - (activos || 0);
  return (
    <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderLeft: "3px solid " + T.green, borderRadius: 8, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 16 }}>✅</div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          Solo los datos ENCENDIDOS se tienen en cuenta para las simulaciones
        </div>
        <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          Cada ítem tiene un toggle <strong style={{ color: T.green }}>✅ (encendido)</strong> o <strong style={{ color: T.txt3 }}>⬜ (apagado)</strong> a la derecha. Los apagados <strong>no se incluyen</strong> en impuestos, cash flow, asesores ni coaches IA — útil para simular "qué pasaría si quito {moduloNombre}".
        </div>
      </div>
      {total != null && (
        <div style={{ textAlign: "right", fontSize: 10, color: T.txt3, whiteSpace: "nowrap" }}>
          <div><span style={{ color: T.green, fontWeight: 700 }}>{activos}</span> activos</div>
          {inactivos > 0 && <div><span style={{ color: T.orange, fontWeight: 700 }}>{inactivos}</span> apagados</div>}
        </div>
      )}
    </div>
  );
}

// Versión compacta (1 línea) para páginas que consumen datos pero no los editan
// (Calculadora, Dashboard, Coaches, Asesor IA).
export function SimToggleInfoCompact() {
  return (
    <div style={{ padding: "7px 12px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 6, marginBottom: 12, fontSize: 10, color: T.txt2, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.5 }}>
      <span style={{ fontSize: 12 }}>✅</span>
      <span>
        <strong style={{ color: T.green, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 10 }}>Solo los datos encendidos</strong> se usan en este cálculo. Items apagados en Ingresos/Egresos/Deudas/Inversiones quedan afuera.
      </span>
    </div>
  );
}
