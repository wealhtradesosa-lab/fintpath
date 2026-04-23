// ═══════════════════════════════════════════════════════════════════════════
// ALERTAS AÑO ANTERIOR
// ─────────────────────────────────────────────────────────────────────────
// Componente reutilizable que detecta deltas significativos entre los
// valores del año actual (calculados o ingresados en el wizard) y los
// renglones de owner.declaracionAnterior capturados del año previo.
//
// Umbrales (configurables):
//   > 20% de delta  → ⚠️ warning (naranja)
//   > 50% de delta  → 🚨 alerta fuerte (roja)
//   Monto mínimo    → \$1.000.000 para no alertar por ruido en cifras chicas
//
// Ejemplos de lo que detecta:
//   · "retenciones bajaron 40% vs año anterior — revisá certificados"
//   · "ingresos subieron 80% vs año anterior — confirmá si incluyes ingresos
//      no operacionales que no declarabas antes"
//   · "impuesto aumentó 65% — puede ser correcto si subieron ingresos, pero
//      también puede indicar deducciones olvidadas"
//
// Uso:
//   <AlertasAnoAnterior
//     anterior={owner.declaracionAnterior}
//     actual={{ ingresos, retenciones, impuesto }}
//     tipo="F210" // o "F110"
//   />
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  orange: "#f59e0b", red: "#ef4444", green: "#22c55e", cyan: "#06b6d4",
};

const fmMoney = (v) => {
  const n = Math.round(Number(v) || 0);
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("es-CO");
};

// Calcula alertas dado un set de comparaciones (par actual vs anterior).
// Retorna array de objetos { severity, label, deltaPct, sugerencia }
// severity: "warning" | "critical"
export function calcAlertasAnoAnterior(comparaciones) {
  const alertas = [];
  const MIN_MONTO = 1_000_000; // No alertar por cifras pequeñas
  const UMBRAL_WARNING = 20;
  const UMBRAL_CRITICAL = 50;

  for (const c of comparaciones) {
    const actual = Number(c.actual) || 0;
    const anterior = Number(c.anterior) || 0;
    // Ignorar si ambos son 0 o casi 0
    if (Math.max(actual, anterior) < MIN_MONTO) continue;
    // Ignorar si el anterior es 0 (no hay base de comparación)
    if (anterior === 0) continue;

    const deltaPct = ((actual - anterior) / anterior) * 100;
    const deltaAbs = Math.abs(deltaPct);
    if (deltaAbs < UMBRAL_WARNING) continue;

    const severity = deltaAbs >= UMBRAL_CRITICAL ? "critical" : "warning";
    const direccion = deltaPct > 0 ? "subió" : "bajó";
    alertas.push({
      severity,
      label: c.label,
      actual,
      anterior,
      deltaPct,
      deltaAbs,
      direccion,
      sugerencia: c.sugerencia || null,
      flagField: c.flagField || null,
    });
  }
  return alertas;
}

export default function AlertasAnoAnterior({ comparaciones, anoAnterior }) {
  const alertas = calcAlertasAnoAnterior(comparaciones);
  if (alertas.length === 0) return null;

  const critical = alertas.filter(a => a.severity === "critical");
  const warning = alertas.filter(a => a.severity === "warning");

  return (
    <div style={{
      marginTop: 14, marginBottom: 14,
      background: critical.length > 0 ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
      border: "1px solid " + (critical.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"),
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: critical.length > 0 ? T.red : T.orange,
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
      }}>
        {critical.length > 0 ? "🚨" : "⚠️"}
        Alertas de consistencia vs año {anoAnterior || "anterior"}
        <span style={{ color: T.txt3, fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
          ({alertas.length} diferencia{alertas.length !== 1 ? "s" : ""} significativa{alertas.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {alertas.map((a, i) => {
          const color = a.severity === "critical" ? T.red : T.orange;
          const icon = a.deltaPct > 0 ? "▲" : "▼";
          return (
            <div key={i} style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              borderLeft: "2px solid " + color,
              fontSize: 11,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ color: T.txt, fontWeight: 600 }}>{a.label}</span>
                <span style={{ color: color, fontWeight: 700, fontFamily: "monospace" }}>
                  {icon} {a.deltaAbs.toFixed(0)}%
                </span>
              </div>
              <div style={{ color: T.txt3, marginTop: 2, fontFamily: "monospace", fontSize: 10 }}>
                Año anterior: {fmMoney(a.anterior)} · Actual: {fmMoney(a.actual)} · Delta: {a.deltaPct > 0 ? "+" : ""}{fmMoney(a.actual - a.anterior)}
              </div>
              {a.sugerencia && (
                <div style={{ color: T.txt2, marginTop: 4, fontSize: 10, lineHeight: 1.4 }}>
                  → {a.sugerencia}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: T.txt3, marginTop: 8, lineHeight: 1.4 }}>
        Estas alertas son informativas — pueden ser cambios legítimos (aumento de ingresos, nuevas deducciones, etc.) o pueden indicar errores de captura. Revisá cada una antes de dar por final el cálculo.
      </div>
    </div>
  );
}
