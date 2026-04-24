// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Motor de recomendaciones fiscales (Commit 6)
// ─────────────────────────────────────────────────────────────────────────
// Dado un user + el output de estimarImpuesto(u), calcula recomendaciones
// concretas: "aportar $X/mes a Y ahorra $Z/año".
//
// Principios:
//   1. DETERMINÍSTICO. No llama estimarImpuesto dos veces con inputs
//      modificados (ese enfoque acumula aproximaciones). Usa los topes y
//      "espacio disponible" que el motor ya expone.
//   2. CONSERVADOR. Siempre aproxima el ahorro POR DEBAJO del real. Mejor
//      subestimar y que el usuario se sorprenda de más, que prometer y
//      decepcionar.
//   3. NO INVENTA. Solo recomienda palancas con base legal clara y datos
//      reales del user. Si no hay margen, dice "todo optimizado".
//   4. HONESTO. Si la palanca no aplica (ej: intereses hipotecarios en
//      deuda no-vivienda), no se sugiere.
//
// Cada recomendación tiene:
//   - code: identificador para UI/analytics
//   - severity: "high" | "medium" | "low"  (impacto en $)
//   - ownerId + ownerName: a qué owner aplica
//   - titulo, descripcion: qué mostrar en UI
//   - ahorroAnualEstimado: número en COP
//   - aporteSugeridoMensual: número en COP (para las que requieren aportar)
//   - cta: { label, page, extraAction? }
//   - base: referencia legal (artículo ET)
// ═══════════════════════════════════════════════════════════════════════════

import { GRUPOS_SIMPLE, TOPE_SIMPLE_UVT, calcularImpuestoSimple } from "./regimenSimple.js";

const UVT = 52_374; // 2026

/**
 * Genera recomendaciones para cada owner del user basadas en la estimación
 * actual del motor.
 *
 * @param {object} user - user object (u de App.jsx, con owners, ingresos, gas, deu, inv)
 * @param {object} estimacion - output de estimarImpuesto(user)
 * @returns {Array<object>} recomendaciones ordenadas por impacto descendente
 */
export function generarRecomendaciones(user, estimacion) {
  if (!user || !estimacion?.detalle) return [];
  const recs = [];
  const owners = user.owners || [];

  for (const ow of owners) {
    const det = estimacion.detalle.find(d => d.name === ow.name);
    if (!det) continue;

    if (ow.type === "natural") {
      recs.push(...recomendacionesNatural(user, ow, det));
    } else if (ow.type === "juridica") {
      recs.push(...recomendacionesJuridica(user, ow, det));
    }
  }

  // Ordenar por impacto descendente (ahorro mayor primero).
  recs.sort((a, b) => (b.ahorroAnualEstimado || 0) - (a.ahorroAnualEstimado || 0));
  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// Persona natural
// ─────────────────────────────────────────────────────────────────────────
function recomendacionesNatural(user, ow, det) {
  const recs = [];
  const impBruto = Number(det.impBruto) || 0;
  const tasaMarginalAprox = estimarTasaMarginal(det);

  // ═════════════ PALANCA 1: Pensión Voluntaria (Art. 126-1 ET) ═════════════
  //
  // El motor expone `espacioParaPVyAFC`, que ya descuenta lo que el owner
  // aporta hoy y respeta el cap 40% neto laboral / 2500 UVT. Si es > 0,
  // hay margen legal para aportar más.
  const espacio = Number(det.espacioParaPVyAFC) || 0;
  const pvAportaHoy = pvAportadaHoyAnual(user, ow.id);
  if (espacio > 1_000_000 && tasaMarginalAprox > 0) {
    const aporteSugeridoMensual = Math.round(espacio / 12 * 0.8); // conservador: 80% del espacio
    const ahorro = Math.round(aporteSugeridoMensual * 12 * tasaMarginalAprox / 100);
    if (ahorro >= 500_000) {
      recs.push({
        code: "APORTAR_PV_AFC",
        severity: severityByAhorro(ahorro),
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: pvAportaHoy > 0
          ? "Aumentar aporte a Pensión Voluntaria / AFC"
          : "Empezar a aportar a Pensión Voluntaria o AFC",
        descripcion: pvAportaHoy > 0
          ? `Ya aportás ${fm(pvAportaHoy)}/año a PV/AFC. Tenés margen legal para aportar ${fm(aporteSugeridoMensual)}/mes adicionales sin pasarte del cap.`
          : `No tenés aportes a PV/AFC registrados. Son 100% deducibles de la base gravable bajo el cap 25%/2500 UVT.`,
        aporteSugeridoMensual,
        ahorroAnualEstimado: ahorro,
        cta: { label: "Registrar en Egresos", page: "gas" },
        base: "Arts. 126-1 y 126-4 ET",
        supuestos: [
          `Tasa marginal estimada: ${tasaMarginalAprox.toFixed(1)}%`,
          `Espacio legal disponible: ${fm(espacio)}/año`,
          `Aporte sugerido: 80% del espacio (conservador)`,
        ],
      });
    }
  }

  // ═════════════ PALANCA 2: Intereses hipotecarios vivienda (Art. 119 ET) ═════════════
  //
  // Si el owner tiene una deuda registrada como DEU_NAT_VIVIENDA_HABITACIONAL
  // y los intereses NO están siendo deducidos (porque deducVivienda es 0 o
  // muy bajo), hay una deducción perdida.
  const deducViviendaActual = Number(det.deducVivienda) || 0;
  const deudasViviendaOwner = (user.deu || []).filter(d => d.owner === ow.id && d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL");
  const interesesAnualesEstimados = deudasViviendaOwner.reduce((s, d) => {
    const rem = Number(d.rem) || 0;
    const tasa = Number(d.tasa) || 0;
    return s + (rem * tasa / 100);
  }, 0);
  const topLegalVivienda = 1200 * UVT;
  if (interesesAnualesEstimados > 0 && deducViviendaActual < interesesAnualesEstimados * 0.5) {
    const deducibleNuevo = Math.min(interesesAnualesEstimados, topLegalVivienda);
    const ahorro = Math.round(deducibleNuevo * tasaMarginalAprox / 100);
    if (ahorro >= 300_000) {
      recs.push({
        code: "INTERESES_VIVIENDA_NO_DEDUCIDOS",
        severity: severityByAhorro(ahorro),
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: "Intereses de vivienda no están siendo deducidos",
        descripcion: `Tenés ${fm(interesesAnualesEstimados)}/año en intereses de deuda hipotecaria de vivienda habitacional, pero el motor no los está contando. Verificá que la deuda esté marcada con fiscalCode correcto en el módulo Deudas.`,
        ahorroAnualEstimado: ahorro,
        cta: { label: "Revisar deuda en Deudas", page: "deu" },
        base: "Art. 119 ET",
        supuestos: [
          `Tasa marginal estimada: ${tasaMarginalAprox.toFixed(1)}%`,
          `Tope legal: ${fm(topLegalVivienda)} (1.200 UVT)`,
          `Intereses estimados: rem × tasa de cada deuda`,
        ],
      });
    }
  }

  // ═════════════ PALANCA 3: Dependientes (Art. 387 parr 2 ET) ═════════════
  //
  // Si tiene ingresos laborales > 0 pero no tiene dependientes declarados,
  // y es típicamente una deducción subutilizada.
  const deducDepActual = Number(det.deducDep) || 0;
  const ingLaboralAnual = Number(det.aportesDesglose?.salarioGravableAnual) || 0;
  if (ingLaboralAnual > 50_000_000 && deducDepActual === 0) {
    // Dependientes: hasta 10% del ingreso bruto del trabajador, topado en 32 UVT/mes
    const deducMax = Math.min(ingLaboralAnual * 0.10, 32 * UVT * 12);
    const ahorro = Math.round(deducMax * tasaMarginalAprox / 100);
    if (ahorro >= 500_000) {
      recs.push({
        code: "DEPENDIENTES_NO_DECLARADOS",
        severity: severityByAhorro(ahorro),
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: "¿Tenés cónyuge, hijos o padres dependientes?",
        descripcion: `Con tu salario podés deducir hasta ${fm(deducMax)}/año por dependientes (10% del ingreso bruto, tope 32 UVT/mes). Aplica a cónyuge, hijos menores, hijos hasta 25 años estudiando, o padres/hermanos con discapacidad.`,
        ahorroAnualEstimado: ahorro,
        cta: { label: "Configurar en perfil del owner", page: "set" },
        base: "Art. 387 parr 2 ET",
        supuestos: [
          `Tasa marginal estimada: ${tasaMarginalAprox.toFixed(1)}%`,
          `Tope: 10% del bruto laboral, máx 32 UVT × 12 meses`,
          `Requiere documentación (registro civil, certificados)`,
        ],
      });
    }
  }

  // ═════════════ PALANCA 4: Salud prepagada (Art. 387 #2 ET) ═════════════
  //
  // Tope 16 UVT/mes. Si el owner no tiene salud prepagada registrada y
  // tiene impuesto > 0, vale la pena mencionarlo.
  const deducMedActual = Number(det.deducMedicina) || 0;
  if (deducMedActual === 0 && impBruto > 2_000_000) {
    const topeAnual = 16 * UVT * 12;
    const ahorro = Math.round(topeAnual * tasaMarginalAprox / 100);
    if (ahorro >= 500_000) {
      recs.push({
        code: "SALUD_PREPAGADA_NO_REGISTRADA",
        severity: "medium",
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: "Si pagás medicina prepagada, es deducible",
        descripcion: `No tenés salud prepagada registrada. Si pagás Colsanitas, Sura, Medplus u otra, es deducible hasta ${fm(topeAnual)}/año (16 UVT/mes).`,
        ahorroAnualEstimado: ahorro,
        cta: { label: "Registrar en Egresos como Aporte Tributario", page: "gas" },
        base: "Art. 387 #2 ET",
        supuestos: [
          `Ahorro máximo teórico — depende de cuánto pagás realmente.`,
          `Categoría Egresos: "Aporte tributario" → Salud prepagada`,
        ],
      });
    }
  }

  // Si hay impuesto > 0 pero NO hay recomendaciones: todo optimizado
  if (recs.length === 0 && impBruto > 0) {
    recs.push({
      code: "TODO_OPTIMIZADO",
      severity: "info",
      ownerId: ow.id,
      ownerName: ow.name,
      titulo: "✅ Tu situación fiscal está optimizada",
      descripcion: `Con los datos actuales, ${ow.name} está aprovechando las palancas fiscales disponibles. Pagar menos impuesto requeriría cambios estructurales (régimen, composición de ingresos, constitución de vehículos).`,
      ahorroAnualEstimado: 0,
      cta: null,
      base: null,
      supuestos: null,
    });
  }

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// Persona jurídica
// ─────────────────────────────────────────────────────────────────────────
function recomendacionesJuridica(user, ow, det) {
  const recs = [];
  const impBruto = Number(det.impBruto) || 0;
  const ingAnual = Number(det.ingreso) || 0;

  // ═════════════ PALANCA 0: Régimen SIMPLE (Art. 905 ET) ═════════════
  //
  // Commit 6.1 profesional: usa tarifas reales por grupo y tramo (Art. 908 ET)
  // en vez de 5% plano. Valida exclusiones del Art. 906 ET.
  //
  // Requisitos para recomendar el cambio:
  //   1. Régimen actual = "ordinario" (no sugerir a ZF, CHC, exenta, SIMPLE).
  //   2. Ingresos anuales < 100.000 UVT (Art. 905 ET).
  //   3. Owner NO en lista de exclusiones (Art. 906 ET, ow.simpleExcluido).
  //   4. Owner tiene grupo SIMPLE asignado (ow.simpleGrupo) — sin grupo,
  //      mostramos mensaje pidiendo configurarlo en vez de inventar 5%.
  //   5. Impuesto bajo SIMPLE debe ser > $3M menor al ordinario actual
  //      (umbral de relevancia práctica).
  const regimenActual = ow.regimen || "ordinario";
  const limiteSimple = TOPE_SIMPLE_UVT * UVT;

  // ═════════════ Caso A: está en ordinario, podría evaluar SIMPLE ═════════════
  if (regimenActual === "ordinario" && ingAnual > 100_000_000 && ingAnual < limiteSimple && impBruto > 0) {
    // Chequeo exclusión
    if (ow.simpleExcluido === true) {
      // No recomendar nada — el owner ya fue marcado como excluido por el usuario/contador.
      // Opcional: futuro info explicando por qué no aparece la recomendación SIMPLE.
    } else if (!ow.simpleGrupo) {
      // Owner no tiene grupo asignado: recomendar que lo configure, sin dar ahorro
      // inventado. Es honesto.
      recs.push({
        code: "CONFIGURAR_GRUPO_SIMPLE",
        severity: "medium",
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: `Podría aplicar al Régimen SIMPLE — configurá el grupo de actividad`,
        descripcion: `${ow.name} tiene ingresos de ${fm(ingAnual)}, por debajo del tope legal de ${fm(limiteSimple)} para SIMPLE. Para calcular si conviene el cambio, necesitamos saber a qué grupo de actividad pertenece (Art. 908 ET). Configurá el grupo en el perfil del owner.`,
        ahorroAnualEstimado: 0,
        cta: { label: "Configurar grupo SIMPLE en perfil", page: "set" },
        base: "Arts. 905, 908 ET",
        supuestos: [
          `Tarifa SIMPLE varía entre 1,2% y 13,7% según grupo de actividad.`,
          `Sin saber el grupo, no podemos estimar el impuesto con precisión.`,
          `Consultá a tu contador para identificar el grupo correcto según CIIU.`,
        ],
      });
    } else {
      // Tiene grupo asignado: cálculo real con tarifa oficial
      const grupoInfo = GRUPOS_SIMPLE[ow.simpleGrupo];
      if (grupoInfo) {
        const { impuesto: impSimpleReal, tarifaEfectiva } = calcularImpuestoSimple(ingAnual, ow.simpleGrupo, UVT);
        const diferencia = impBruto - impSimpleReal;

        if (diferencia > 3_000_000) {
          // SIMPLE es más barato — recomendar evaluar
          recs.push({
            code: "EVALUAR_REGIMEN_SIMPLE",
            severity: severityByAhorro(diferencia),
            ownerId: ow.id,
            ownerName: ow.name,
            titulo: `Evaluar cambio a Régimen Simple (RST)`,
            descripcion: `${ow.name} pagaría aproximadamente ${fm(impSimpleReal)}/año bajo SIMPLE (grupo: ${grupoInfo.label}, tarifa efectiva ${(tarifaEfectiva * 100).toFixed(2)}%), vs ${fm(impBruto)}/año bajo ordinario. SIMPLE también sustituye el ICA y avisos, lo que puede ampliar el ahorro real si hoy pagás ICA alto.`,
            ahorroAnualEstimado: Math.round(diferencia),
            cta: { label: "Cambiar régimen en perfil del owner", page: "set" },
            base: "Arts. 903-916 ET (tarifas Art. 908)",
            supuestos: [
              `Grupo asignado: "${grupoInfo.label}".`,
              `Tarifa efectiva aplicada: ${(tarifaEfectiva * 100).toFixed(2)}% (cálculo por tramos marginales, Art. 908 ET).`,
              `Comparación entre impuesto de renta ordinario vs SIMPLE; no incluye posible ahorro adicional por ICA absorbido (ampliaría el beneficio).`,
              `SIMPLE exige anticipos bimestrales (6 pagos/año) — afecta flujo de caja.`,
              `Cambio de régimen se formaliza en MUISCA hasta último día hábil de febrero.`,
              `Verificá con tu contador que no caés en exclusiones del Art. 906 ET (financiera, minera, combustibles, etc.).`,
            ],
          });
        } else if (diferencia < -1_000_000) {
          // SIMPLE sería MÁS CARO — advertir si el usuario estaba pensando cambiarse
          recs.push({
            code: "SIMPLE_NO_CONVIENE",
            severity: "info",
            ownerId: ow.id,
            ownerName: ow.name,
            titulo: `SIMPLE no conviene para ${ow.name} según el grupo configurado`,
            descripcion: `Bajo SIMPLE pagarías ${fm(impSimpleReal)} (tarifa ${(tarifaEfectiva * 100).toFixed(2)}%), más que los ${fm(impBruto)} del régimen ordinario actual. La tarifa efectiva del grupo "${grupoInfo.label}" es alta para tu nivel de ingresos.`,
            ahorroAnualEstimado: 0,
            cta: null,
            base: "Art. 908 ET",
            supuestos: [
              `Grupo asignado: "${grupoInfo.label}".`,
              `Para grupos profesionales (consultoría, profesiones liberales) la tarifa SIMPLE al máximo tramo es 13,7% sobre ingresos brutos, lo que a menudo supera al 35% sobre utilidad del ordinario cuando la utilidad es baja-media.`,
            ],
          });
        }
      }
    }
  }

  // Si ya está en SIMPLE, no sugerir cambio. Si es otra cosa (zona_franca, CHC,
  // exenta), tampoco: son regímenes especiales elegidos por razones específicas.

  // ═════════════ PALANCA 0b: Alerta — SIMPLE con ingresos sobre el tope ═════════════
  //
  // Si está en SIMPLE pero superó 100K UVT, legalmente debe salir. No es
  // ahorro — es compliance. Severity 'error' (no se ordena por ahorro).
  if (regimenActual === "simple" && ingAnual >= limiteSimple) {
    recs.push({
      code: "SIMPLE_FUERA_DE_RANGO",
      severity: "high",  // lo tratamos como alerta, no como optimización
      ownerId: ow.id,
      ownerName: ow.name,
      titulo: `⚠️ ${ow.name} podría haber superado el tope de 100.000 UVT en SIMPLE`,
      descripcion: `Los ingresos anuales estimados son ${fm(ingAnual)}, por encima del tope legal de ${fm(limiteSimple)}. Si se supera el tope, el régimen SIMPLE deja de aplicar y debe pasarse a ordinario. Verificá con tu contador.`,
      ahorroAnualEstimado: 0,
      cta: { label: "Revisar régimen en perfil del owner", page: "set" },
      base: "Art. 905 ET",
      supuestos: [
        `Tope: 100.000 UVT × UVT 2026 = ${fm(limiteSimple)}.`,
        `Ingresos estimados desde módulo Ingresos del owner.`,
        `Si el año anterior también superó el tope, la obligación de salir del SIMPLE es retroactiva.`,
      ],
    });
  }

  // ═════════════ PALANCA 1: Descuento ICA (50% del ICA pagado, Art. 115 ET) ═════════════
  //
  // Si tiene gastos categoría "Predial" o fiscalCode GAS_JUR_PREDIAL y no
  // declaró descuento ICA el año pasado, hay una palanca obvia.
  const gastosICA = Object.values(user.gas || {}).flat().filter(g =>
    g.owner === ow.id && (g.fiscalCode === "GAS_JUR_PREDIAL" || g.cat === "Predial")
  );
  const icaPagadoAnual = gastosICA.reduce((s, g) => s + ((Number(g.m) || 0) * 12), 0);
  if (icaPagadoAnual > 500_000 && impBruto > 0) {
    const descuentoPotencial = Math.round(icaPagadoAnual * 0.5);
    const descuentoActual = Number(ow.descuentosTributarios?.ica) || 0;
    if (descuentoPotencial > descuentoActual * 1.5) {
      recs.push({
        code: "DESCUENTO_ICA_NO_CAPTURADO",
        severity: severityByAhorro(descuentoPotencial - descuentoActual),
        ownerId: ow.id,
        ownerName: ow.name,
        titulo: "50% del ICA pagado es descontable del impuesto de renta",
        descripcion: `${ow.name} paga ~${fm(icaPagadoAnual)}/año en ICA. El 50% (${fm(descuentoPotencial)}) se descuenta DIRECTAMENTE del impuesto de renta (no de la base). Es la palanca de mayor impacto para personas jurídicas.`,
        ahorroAnualEstimado: descuentoPotencial - descuentoActual,
        cta: { label: "Configurar en perfil del owner", page: "set" },
        base: "Art. 115 ET",
        supuestos: [
          `50% directo sobre impuesto (no sobre base).`,
          `ICA pagado estimado desde gastos categoría Predial.`,
        ],
      });
    }
  }

  // Si hay impuesto > 0 pero NO hay recomendaciones
  if (recs.length === 0 && impBruto > 0) {
    recs.push({
      code: "TODO_OPTIMIZADO_JURIDICA",
      severity: "info",
      ownerId: ow.id,
      ownerName: ow.name,
      titulo: `✅ ${ow.name} está operando con estructura estándar`,
      descripcion: `No detecté palancas automáticas subutilizadas. Optimizaciones adicionales requerirían análisis caso-por-caso (CTI, donaciones calificadas, zona franca, régimen SIMPLE).`,
      ahorroAnualEstimado: 0,
      cta: null,
      base: null,
      supuestos: null,
    });
  }

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Estima la tasa marginal del owner natural desde el detalle del motor.
 * Si rentaLiqGeneral cae en tramo X de Art. 241, la marginal es la de ese tramo.
 * Aproximación razonable sin re-simular.
 */
function estimarTasaMarginal(det) {
  const base = (Number(det.baseGravable) || 0) / UVT; // en UVT
  if (base <= 1090) return 0;
  if (base <= 1700) return 19;
  if (base <= 4100) return 28;
  if (base <= 8670) return 33;
  if (base <= 18970) return 35;
  if (base <= 31000) return 37;
  return 39;
}

function pvAportadaHoyAnual(user, ownerId) {
  return Object.values(user.gas || {}).flat()
    .filter(g => g.owner === ownerId && (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC"))
    .reduce((s, g) => s + ((Number(g.m) || 0) * 12), 0);
}

function severityByAhorro(ahorro) {
  if (ahorro >= 5_000_000) return "high";
  if (ahorro >= 1_500_000) return "medium";
  return "low";
}

function fm(v) {
  return "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
}
