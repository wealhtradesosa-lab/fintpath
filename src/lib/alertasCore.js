// ═══════════════════════════════════════════════════════════════════════════
// ALERTAS CORE
// ─────────────────────────────────────────────────────────────────────────
// Funciones puras de detección de alertas, patrones cruzados, tendencias y
// proyecciones año-a-año. Extraídas de AlertasAnoAnterior.jsx para ser
// testeables directamente con node (sin transpiler JSX).
//
// El componente React AlertasAnoAnterior.jsx importa estas funciones y las
// usa para renderizar el panel.
//
// ESTAS FUNCIONES NO DEPENDEN DE REACT — son puramente lógica de negocio.
// Cualquier refactor debe mantener esa separación.
// ═══════════════════════════════════════════════════════════════════════════

// ── calcAlertasAnoAnterior ────────────────────────────────────────────────
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
    if (Math.max(actual, anterior) < MIN_MONTO) continue;
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

// ── calcPatronesAnomalos ──────────────────────────────────────────────────
// Detecta PATRONES ANÓMALOS cruzados entre varias variables de la
// declaración. Estos patrones no se ven mirando un campo aislado — solo
// emergen cuando se comparan relaciones entre campos.
//
// 9 patrones detectados: retenciones inconsistentes, impuesto inflado,
// intereses vivienda desaparecidos, dependientes desaparecidos, sin
// retenciones con ingresos altos, dividendos ausentes, exenta25 desaparecida,
// PV+AFC desaparecidos, medicina prepagada desaparecida, GMF desaparecido.
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

  // Patrón 3: intereses vivienda desaparecieron
  if (p.interesesVivienda > MIN && (!a.interesesVivienda || a.interesesVivienda < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Intereses de vivienda: desaparecieron",
      sugerencia: `El año anterior dedujiste $${Math.round(p.interesesVivienda).toLocaleString("es-CO")} en intereses de crédito de vivienda y este año está en cero. ¿Pagaste totalmente el crédito, lo transferiste, o se te olvidó cargar? Si el crédito sigue activo, solicitá el certificado al banco.`,
    });
  }

  // Patrón 4: dependientes desaparecieron
  if (p.dependientes > MIN && (!a.dependientes || a.dependientes < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Deducción por dependientes: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.dependientes).toLocaleString("es-CO")} por dependientes y este año está en cero. ¿Tus hijos/padres ya no son dependientes (cumplieron edad, tienen ingresos propios) o se te olvidó? Es una de las deducciones más fáciles de documentar.`,
    });
  }

  // Patrón 5: ingresos altos pero retenciones = 0
  if (a.ingresos > 100e6 && (!a.retenciones || a.retenciones < 100000) && p.retenciones > MIN) {
    patrones.push({
      severity: "critical",
      label: "Sin retenciones con ingresos altos",
      sugerencia: `Ingresos declarados de $${Math.round(a.ingresos / 1e6)}M pero retenciones en cero. El año pasado declaraste $${Math.round(p.retenciones).toLocaleString("es-CO")} en retenciones. Si sos empleado o prestás servicios profesionales, casi seguro te están practicando retención — revisá que no se te olvidó ningún certificado.`,
    });
  }

  // Patrón 6: dividendos ausentes
  if (p.dividendos > MIN && (!a.dividendos || a.dividendos < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Dividendos: ausentes este año",
      sugerencia: `El año pasado declaraste $${Math.round(p.dividendos).toLocaleString("es-CO")} en dividendos y este año no hay. Si seguís siendo socio de esa empresa, pediles el certificado de distribuciones del año. Los dividendos son uno de los valores más fáciles de omitir porque no los pagás de tu bolsillo.`,
    });
  }

  // Patrón 7: exenta 25% desapareció
  if (p.exenta25 > MIN && (!a.exenta25 || a.exenta25 < MIN) && a.salarios > MIN) {
    patrones.push({
      severity: "warning",
      label: "Exenta 25% laboral: desapareció",
      sugerencia: `El año anterior te aplicaste $${Math.round(p.exenta25).toLocaleString("es-CO")} por la exenta 25% del Art. 206 #10 ET (25% del neto laboral) y este año está en cero, aunque seguís teniendo salarios. Verificá el Paso 3 del F-210 — esta exenta es automática si tenés ingresos laborales y rara vez debería faltar.`,
    });
  }

  // Patrón 8: PV+AFC desaparecieron
  if (p.pvAFC > MIN && (!a.pvAFC || a.pvAFC < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Aportes a pensión voluntaria / AFC: desaparecieron",
      sugerencia: `El año anterior aportaste $${Math.round(p.pvAFC).toLocaleString("es-CO")} entre pensión voluntaria y AFC (ambos son deducibles). Si seguís haciendo esos aportes, cargalos en el Paso 3 — pueden valer varios millones en impuesto. Si dejaste de aportar voluntariamente, ignorá esta alerta.`,
    });
  }

  // Patrón 9: salud prepagada desapareció
  if (p.saludPrepagada > MIN && (!a.saludPrepagada || a.saludPrepagada < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Medicina prepagada: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.saludPrepagada).toLocaleString("es-CO")} en medicina prepagada (Art. 387 ET). Si seguís con tu plan de salud prepagada o pólizas, el comprobante anual está deducible hasta 192 UVT. Revisá tu recibo anual.`,
    });
  }

  // Patrón 10: GMF desapareció
  if (p.gmf > MIN && (!a.gmf || a.gmf < MIN)) {
    patrones.push({
      severity: "warning",
      label: "GMF 4×1000 deducible: desapareció",
      sugerencia: `El año anterior dedujiste $${Math.round(p.gmf).toLocaleString("es-CO")} del GMF (Art. 115 ET). El 50% del gravamen a los movimientos financieros es deducible. Si tus cuentas bancarias siguen activas, se calculó automáticamente — verificá la casilla 78.`,
    });
  }

  // Patrón 11: descuento por donaciones desapareció (Art. 257 ET)
  if (p.descDonaciones > MIN && (!a.descDonaciones || a.descDonaciones < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Descuento por donaciones: desapareció",
      sugerencia: `El año anterior usaste $${Math.round(p.descDonaciones).toLocaleString("es-CO")} de descuento por donaciones (Art. 257 ET, 25% del donado). Si seguís donando a las mismas ESAL, pedí el certificado anual de donaciones — el descuento se aplica directo del impuesto, no de la base.`,
    });
  }

  // Patrón 12: ganancias ocasionales declaradas pero impuesto GO en cero
  if (p.gananciasOcasionales > MIN && a.gananciasOcasionales > MIN && p.impuestoGO > MIN && (!a.impuestoGO || a.impuestoGO < MIN)) {
    patrones.push({
      severity: "critical",
      label: "Ganancias ocasionales sin impuesto",
      sugerencia: `Declaraste $${Math.round(a.gananciasOcasionales).toLocaleString("es-CO")} en ganancias ocasionales pero el impuesto GO está en cero. La tarifa es 15% fija (Art. 314 ET). Revisá si aplicaste las exenciones correctas (venta vivienda principal tiene tope de 7.500 UVT exento, herencias hasta 3.250 UVT) o si te falta calcular el impuesto.`,
    });
  }

  // Patrón 13: descuento ICA desapareció (solo jurídicas)
  if (p.descICA > MIN && (!a.descICA || a.descICA < MIN)) {
    patrones.push({
      severity: "warning",
      label: "Descuento ICA: desapareció",
      sugerencia: `El año anterior usaste $${Math.round(p.descICA).toLocaleString("es-CO")} de descuento por el 50% del ICA pagado (Art. 115 ET). Si tu empresa siguió operando y pagando ICA, este descuento se sigue aplicando — verificá las casillas 88-90 del F-110.`,
    });
  }

  return patrones;
}

// ── pendienteAnual ────────────────────────────────────────────────────────
// Helper privado que calcula la pendiente porcentual promedio año-a-año en
// una serie de valores.
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

// ── calcPatronesTendencia ─────────────────────────────────────────────────
// Detecta cambios vs TENDENCIA histórica — no solo vs el último año.
// Requiere ≥ 2 años de historial para ser útil.
export function calcPatronesTendencia({ serie, actual }) {
  const patrones = [];
  if (!Array.isArray(serie) || serie.length < 2) return patrones;
  const MIN = 1_000_000;
  const UMBRAL_ANOMALIA_PCT = 20;

  const checkVariable = (key, label, articulo) => {
    const vals = serie.map(s => Number(s[key]) || 0);
    const valActual = Number(actual?.[key]) || 0;
    const ultimoAnterior = vals[vals.length - 1] || 0;
    if (ultimoAnterior < MIN || valActual < MIN) return;

    const pendiente = pendienteAnual(vals);
    if (pendiente === null) return;

    const deltaObservado = ((valActual - ultimoAnterior) / ultimoAnterior) * 100;
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

// ── proyectarSiguienteAno ─────────────────────────────────────────────────
// Proyección lineal del año siguiente basada en la pendiente histórica.
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
