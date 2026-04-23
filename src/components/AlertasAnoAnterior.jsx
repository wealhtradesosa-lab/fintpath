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

// Detecta PATRONES ANÓMALOS cruzados entre varias variables de la
// declaración. Estos patrones no se ven mirando un campo aislado — solo
// emergen cuando se comparan relaciones entre campos.
//
// ctx:
//   actual:   { ingresos, retenciones, impuesto, salarios, aportesPension,
//               interesesVivienda, dependientes, dividendos }
//   anterior: { ...mismos campos... }
//
// Retorna array de { severity, label, sugerencia } — mismo shape que
// calcAlertasAnoAnterior pero sin deltaPct (no aplica).
export function calcPatronesAnomalos(ctx) {
  const patrones = [];
  const a = ctx?.actual || {};
  const p = ctx?.anterior || {};
  const MIN = 1_000_000;

  // Patrón 1: ingresos↑ pero retenciones↓ (inconsistencia temporal)
  if (p.ingresos > MIN && p.retenciones > MIN && a.ingresos > MIN) {
    const deltaIng = ((a.ingresos - p.ingresos) / p.ingresos) * 100;
    const deltaRet = a.retenciones > 0 ? ((a.retenciones - p.retenciones) / p.retenciones) * 100 : -100;
    if (deltaIng > 15 && deltaRet < -15) {
      patrones.push({
        severity: "critical",
        label: "Retenciones inconsistentes con ingresos",
        sugerencia: `Los ingresos subieron ${deltaIng.toFixed(0)}% pero las retenciones bajaron ${Math.abs(deltaRet).toFixed(0)}%. Normalmente más ingresos = más retenciones. Verificá que tengas TODOS los certificados de retención del año — es muy común olvidar alguno, especialmente si cambiaste de pagador.`,
      });
    }
  }

  // Patrón 2: impuesto↑ mucho sin ingresos↑ (faltan deducciones)
  if (p.impuesto > MIN && a.impuesto > MIN && p.ingresos > MIN && a.ingresos > MIN) {
    const deltaImp = ((a.impuesto - p.impuesto) / p.impuesto) * 100;
    const deltaIng = ((a.ingresos - p.ingresos) / p.ingresos) * 100;
    if (deltaImp > 30 && deltaIng < 15) {
      patrones.push({
        severity: "warning",
        label: "Impuesto sube más de lo esperado",
        sugerencia: `El impuesto subió ${deltaImp.toFixed(0)}% pero los ingresos solo ${deltaIng > 0 ? "+" : ""}${deltaIng.toFixed(0)}%. Revisá si te faltaron deducciones del año pasado: intereses de vivienda, dependientes, medicina prepagada, aportes a pensión voluntaria o AFC. Cada uno vale hasta varios millones en impuesto.`,
      });
    }
  }

  // Patrón 3: deducciones clave desaparecieron
  if (p.interesesVivienda > MIN && (!a.interesesVivienda || a.interesesVivienda < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Intereses de vivienda: desaparecieron",
      sugerencia: `El año anterior dedujiste $${Math.round(p.interesesVivienda).toLocaleString("es-CO")} en intereses de crédito de vivienda y este año está en cero. ¿Pagaste totalmente el crédito, lo transferiste, o se te olvidó cargar? Si el crédito sigue activo, solicitá el certificado al banco.`,
    });
  }
  if (p.dependientes > MIN && (!a.dependientes || a.dependientes < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Deducción por dependientes: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.dependientes).toLocaleString("es-CO")} por dependientes y este año está en cero. ¿Tus hijos/padres ya no son dependientes (cumplieron edad, tienen ingresos propios) o se te olvidó? Es una de las deducciones más fáciles de documentar.`,
    });
  }

  // Patrón 4: ingresos altos pero retenciones = 0
  if (a.ingresos > 100e6 && (!a.retenciones || a.retenciones < 100000) && p.retenciones > MIN) {
    patrones.push({
      severity: "critical",
      label: "Sin retenciones con ingresos altos",
      sugerencia: `Ingresos declarados de $${Math.round(a.ingresos / 1e6)}M pero retenciones en cero. El año pasado declaraste $${Math.round(p.retenciones).toLocaleString("es-CO")} en retenciones. Si sos empleado o prestás servicios profesionales, casi seguro te están practicando retención — revisá que no se te olvidó ningún certificado.`,
    });
  }

  // Patrón 5: dividendos declarados año pasado, este no
  if (p.dividendos > MIN && (!a.dividendos || a.dividendos < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Dividendos: ausentes este año",
      sugerencia: `El año pasado declaraste $${Math.round(p.dividendos).toLocaleString("es-CO")} en dividendos y este año no hay. Si seguís siendo socio de esa empresa, pediles el certificado de distribuciones del año. Los dividendos son uno de los valores más fáciles de omitir porque no los pagás de tu bolsillo.`,
    });
  }

  // Patrón 6: exenta 25% laboral desapareció
  if (p.exenta25 > MIN && (!a.exenta25 || a.exenta25 < MIN) && a.salarios > MIN) {
    patrones.push({
      severity: "warning",
      label: "Exenta 25% laboral: desapareció",
      sugerencia: `El año anterior te aplicaste $${Math.round(p.exenta25).toLocaleString("es-CO")} por la exenta 25% del Art. 206 #10 ET (25% del neto laboral) y este año está en cero, aunque seguís teniendo salarios. Verificá el Paso 3 del F-210 — esta exenta es automática si tenés ingresos laborales y rara vez debería faltar.`,
    });
  }

  // Patrón 7: PV+AFC desaparecieron (beneficio voluntario)
  if (p.pvAFC > MIN && (!a.pvAFC || a.pvAFC < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Aportes a pensión voluntaria / AFC: desaparecieron",
      sugerencia: `El año anterior aportaste $${Math.round(p.pvAFC).toLocaleString("es-CO")} entre pensión voluntaria y AFC (ambos son deducibles). Si seguís haciendo esos aportes, cargalos en el Paso 3 — pueden valer varios millones en impuesto. Si dejaste de aportar voluntariamente, ignorá esta alerta.`,
    });
  }

  return patrones;
}

export default function AlertasAnoAnterior({ comparaciones, anoAnterior, patronesContext }) {
  const alertas = calcAlertasAnoAnterior(comparaciones);
  const patrones = patronesContext ? calcPatronesAnomalos(patronesContext) : [];
  if (alertas.length === 0 && patrones.length === 0) return null;

  const critical = [...alertas, ...patrones].filter(a => a.severity === "critical");

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
          ({alertas.length + patrones.length} señal{(alertas.length + patrones.length) !== 1 ? "es" : ""})
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {alertas.map((a, i) => {
          const color = a.severity === "critical" ? T.red : T.orange;
          const icon = a.deltaPct > 0 ? "▲" : "▼";
          return (
            <div key={"d" + i} style={{
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
        {patrones.map((p, i) => {
          const color = p.severity === "critical" ? T.red : T.orange;
          return (
            <div key={"p" + i} style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              borderLeft: "2px solid " + color,
              fontSize: 11,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ color: T.txt, fontWeight: 600 }}>🔀 {p.label}</span>
                <span style={{ color: color, fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>
                  Patrón cruzado
                </span>
              </div>
              {p.sugerencia && (
                <div style={{ color: T.txt2, marginTop: 4, fontSize: 10, lineHeight: 1.4 }}>
                  → {p.sugerencia}
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
