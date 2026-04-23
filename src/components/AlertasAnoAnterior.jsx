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

import { useEffect } from "react";
import { track } from "../lib/analytics.js";

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

  // Patrón 8: salud prepagada desapareció
  if (p.saludPrepagada > MIN && (!a.saludPrepagada || a.saludPrepagada < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Medicina prepagada: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.saludPrepagada).toLocaleString("es-CO")} en medicina prepagada (Art. 387 ET). Si seguís con tu plan de salud prepagada o pólizas, el comprobante anual está deducible hasta 192 UVT. Revisá tu recibo anual.`,
    });
  }

  // Patrón 9: GMF desapareció
  if (p.gmf > MIN && (!a.gmf || a.gmf < MIN)) {
    patrones.push({
      severity: "warning",
      label: "GMF 4×1000 deducible: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.gmf).toLocaleString("es-CO")} del GMF (Art. 115 ET). El 50% del gravamen a los movimientos financieros es deducible. Si tus cuentas bancarias siguen activas, se calculó automáticamente — verificá la casilla 78.`,
    });
  }

  return patrones;
}

// ═══════════════════════════════════════════════════════════════════════════
// PATRONES DE TENDENCIA (multi-año)
// ─────────────────────────────────────────────────────────────────────────
// Detecta cambios vs TENDENCIA histórica — no solo vs el último año.
// Requiere ≥ 3 años de historial para ser útil. Si hay menos, devuelve [].
//
// Ejemplos de lo que detecta:
//   · El impuesto venía creciendo ~10%/año en los últimos 3 años
//     y este año bajó 40% → anomalía
//   · Las retenciones se mantenían estables y este año cayeron → alerta
//   · Los ingresos vienen bajando en cada uno de los últimos 3 años → tendencia
//
// Input:
//   serie: array de { anoGravable, ingresos, retenciones, impuesto, ... }
//   ordenado ascendente por año (más antiguo primero, más reciente último).
//
//   actual: { ingresos, retenciones, impuesto } — valores del año en curso
//           (que aún no están en serie)
//
// Output: array de { severity, label, sugerencia } — mismo shape que patrones.
// ═══════════════════════════════════════════════════════════════════════════

// Calcula la pendiente porcentual promedio año-a-año en una serie de valores
// (cada elemento debe ser > 0 y numérico). Retorna null si la serie no permite
// calcular pendiente (menos de 2 puntos válidos o ruido cero).
function pendienteAnual(valores) {
  const v = valores.filter(x => x > 0);
  if (v.length < 2) return null;
  let sumaPct = 0, pasos = 0;
  for (let i = 1; i < v.length; i++) {
    const deltaPct = ((v[i] - v[i - 1]) / v[i - 1]) * 100;
    sumaPct += deltaPct;
    pasos++;
  }
  return pasos > 0 ? sumaPct / pasos : null;
}

export function calcPatronesTendencia({ serie, actual }) {
  const patrones = [];
  if (!Array.isArray(serie) || serie.length < 2) return patrones;
  const MIN = 1_000_000;
  const UMBRAL_ANOMALIA_PCT = 20; // delta vs pendiente en puntos porcentuales

  // Helpers
  const fmM = (n) => "$" + Math.round(n / 1e6).toLocaleString("es-CO") + "M";
  const checkVariable = (key, label, articulo) => {
    const vals = serie.map(s => Number(s[key]) || 0);
    const valActual = Number(actual?.[key]) || 0;
    const ultimoAnterior = vals[vals.length - 1] || 0;
    if (ultimoAnterior < MIN || valActual < MIN) return;

    const pendiente = pendienteAnual(vals);
    if (pendiente === null) return;

    // Delta observado entre el último año de la serie y el año actual
    const deltaObservado = ((valActual - ultimoAnterior) / ultimoAnterior) * 100;
    // ¿Cuánto se desvía del promedio histórico?
    const desvio = deltaObservado - pendiente;

    if (Math.abs(desvio) >= UMBRAL_ANOMALIA_PCT) {
      const direccionHist = pendiente > 5 ? "creciendo" : pendiente < -5 ? "bajando" : "estable";
      const direccionActual = deltaObservado > 0 ? "subió" : "bajó";
      const severity = Math.abs(desvio) >= 40 ? "critical" : "warning";
      patrones.push({
        severity,
        label: `${label}: rompe la tendencia histórica`,
        sugerencia: `Los últimos ${serie.length} años (${serie[0].anoGravable}–${serie[serie.length-1].anoGravable}) tu ${label.toLowerCase()} venía ${direccionHist === "estable" ? "estable" : direccionHist + " ~" + Math.abs(pendiente).toFixed(0) + "%/año"} y este año ${direccionActual} ${Math.abs(deltaObservado).toFixed(0)}%. Es un cambio de ${Math.abs(desvio).toFixed(0)} puntos vs lo esperado${articulo ? ` (${articulo})` : ""}. Si es correcto, OK. Si no, revisá la captura.`,
      });
    }
  };

  checkVariable("impuesto", "Impuesto total");
  checkVariable("retenciones", "Retenciones");
  checkVariable("ingresos", "Ingresos totales");

  return patrones;
}

// Calcula proyección lineal del año siguiente a partir de una serie histórica.
// Devuelve { valor, pendientePct } o null si no hay suficientes puntos.
export function proyectarSiguienteAno(serie, key) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  const vals = serie.map(s => Number(s[key]) || 0).filter(v => v > 0);
  if (vals.length < 2) return null;
  const pendiente = pendienteAnual(vals);
  if (pendiente === null) return null;
  const ultimo = vals[vals.length - 1];
  const proyeccion = ultimo * (1 + pendiente / 100);
  return { valor: proyeccion, pendientePct: pendiente };
}

export default function AlertasAnoAnterior({ comparaciones, anoAnterior, patronesContext, tendenciaContext }) {
  const alertas = calcAlertasAnoAnterior(comparaciones);
  const patrones = patronesContext ? calcPatronesAnomalos(patronesContext) : [];
  const tendencias = tendenciaContext ? calcPatronesTendencia(tendenciaContext) : [];

  // Analytics: emitir evento cada vez que el panel renderiza señales reales
  useEffect(() => {
    const total = alertas.length + patrones.length + tendencias.length;
    if (total === 0) return;
    track("alertas_ano_anterior_renderizado", {
      total_senales: total,
      alertas_delta: alertas.length,
      patrones_cruzados: patrones.length,
      patrones_tendencia: tendencias.length,
      critical_count: [...alertas, ...patrones, ...tendencias].filter(a => a.severity === "critical").length,
      anos_historial: tendenciaContext?.serie?.length || 0,
      // Labels de las señales disparadas (sin montos, solo nombres de patrones)
      labels: [...alertas.map(a => a.label), ...patrones.map(p => p.label), ...tendencias.map(t => t.label)],
    });
  }, [alertas.length, patrones.length, tendencias.length]);

  if (alertas.length === 0 && patrones.length === 0 && tendencias.length === 0) return null;

  const critical = [...alertas, ...patrones, ...tendencias].filter(a => a.severity === "critical");
  const totalSenales = alertas.length + patrones.length + tendencias.length;

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
          ({totalSenales} señal{totalSenales !== 1 ? "es" : ""})
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
        {tendencias.map((t, i) => {
          const color = t.severity === "critical" ? T.red : T.orange;
          return (
            <div key={"t" + i} style={{
              padding: "8px 10px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              borderLeft: "2px solid " + color,
              fontSize: 11,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ color: T.txt, fontWeight: 600 }}>📈 {t.label}</span>
                <span style={{ color: color, fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>
                  Tendencia histórica
                </span>
              </div>
              {t.sugerencia && (
                <div style={{ color: T.txt2, marginTop: 4, fontSize: 10, lineHeight: 1.4 }}>
                  → {t.sugerencia}
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
