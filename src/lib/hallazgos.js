// ════════════════════════════════════════════════════════════════════════════
// hallazgos.js — Lo que el asesor VE sin que se lo pregunten.
//
// POR QUÉ EXISTE (25-jul-2026): FINPATHIA ya calculaba casi todo esto
// —recomendaciones.js detecta las palancas fiscales sin usar, alertasCore
// los patrones anómalos— pero vivía DENTRO de secciones que hay que ir a
// buscar (Estrategia Tributaria, Dashboard Fiscal). Si el usuario no entra
// ahí, nunca se entera. Y el Asesor IA solo habla si le hablan primero.
//
// Este módulo invierte eso: reúne los hallazgos, los ordena POR PLATA y los
// deja listos para mostrarse en el dashboard, sin que nadie pregunte.
//
// REGLAS (heredadas del principio de Santiago: nada inventado)
//  1. Todo hallazgo lleva `base`: el artículo del ET o el dato que lo origina.
//  2. Todo hallazgo lleva `impactoAnual` en pesos — es el criterio de orden.
//     Sin cifra defendible, no se muestra.
//  3. Silencio cuando no hay nada. Un asesor que habla siempre se vuelve ruido.
//  4. Solo ítems con sim!==false. Lo apagado no existe para el análisis.
// ════════════════════════════════════════════════════════════════════════════

const num = (v) => Number(v) || 0;
const activos = (arr) => (arr || []).filter((x) => x && x.sim !== false);

/** Tasa E.A. → costo anual real de una deuda. */
const costoAnualDeuda = (saldo, tasaEA) => saldo * (tasaEA / 100);

/**
 * Deuda cara vs. ahorro de bajo rendimiento.
 * El hallazgo de mayor impacto para casi cualquier patrimonio: tener plata
 * quieta al 9% mientras se paga un crédito al 23% es perder la diferencia
 * todos los años, aunque las dos cifras se vean sanas por separado.
 */
function deudaCaraVsAhorro(user, trm) {
  const deudas = activos(user?.deu);
  const invs = activos(user?.inv);
  if (!deudas.length || !invs.length) return null;

  // 25-jul-2026 — Segunda corrección, con datos reales de Santiago a la vista.
  //
  // La versión anterior fallaba en dos direcciones opuestas:
  //  · Contaba "Fondo de Inversión" como plata quieta. Sus fondos rinden 23%:
  //    eso NO es dinero ocioso, es una inversión activa. Incluirlos subía el
  //    rendimiento promedio a ~20% y hacía desaparecer el hallazgo.
  //  · Ignoraba el tipo "Cash" (mi lista decía "efectivo", pero la app usa
  //    "Cash"). Sus $180M en Cash al 0% —la plata que de verdad no rinde—
  //    quedaban fuera del análisis.
  // Resultado: el caso más claro del patrimonio no se detectaba.
  //
  // Modelo corregido: liquidez = dinero DISPONIBLE y sin comprometer (Cash,
  // CDT, cuentas de ahorro). Un fondo, acciones o crypto son posiciones
  // tomadas, no plata esperando destino.
  const LIQUIDOS = ["cash", "cdt", "efectivo", "cuenta", "ahorro"];
  const esLiquido = (i) => LIQUIDOS.some((t) => String(i.tipo || "").toLowerCase().includes(t));
  const liquidos = invs.filter(esLiquido);
  const valorCOP = (i) => (i.moneda === "USD" ? num(i.va) * trm : num(i.va));
  const liquidez = liquidos.reduce((s, i) => s + valorCOP(i), 0);
  if (liquidez < 1_000_000) return null;

  // El rendimiento sale de los datos del usuario, no de una constante mía.
  // Para efectivo, una tasa de 0 es un dato REAL y significativo —plata que
  // no rinde—, no un dato faltante. Por eso acá 0 cuenta: era el error de la
  // versión previa, que exigía tasa>0 y así descartaba justo el peor caso.
  const baseLiq = liquidos.reduce((s, i) => s + valorCOP(i), 0);
  const RENDIMIENTO_TIPICO = baseLiq > 0
    ? liquidos.reduce((s, i) => s + num(i.tasa) * valorCOP(i), 0) / baseLiq
    : 0;

  // Elegir por IMPACTO, no por tasa. Una tarjeta de $5M al 28% se ve más
  // "cara" que un crédito de $130M al 23%, pero abonar al segundo ahorra
  // veinte veces más.
  const cara = deudas
    .map((d) => {
      const saldo = num(d.mt), tasa = num(d.ts ?? d.ta);
      const dif = tasa - RENDIMIENTO_TIPICO;
      return {
        nombre: d.n || d.nombre || "Crédito",
        saldo, tasa, dif,
        impacto: dif > 0 ? costoAnualDeuda(Math.min(liquidez, saldo), dif) : 0,
      };
    })
    .filter((d) => d.saldo > 0 && d.tasa > 0 && d.dif > 2)
    .sort((a, b) => b.impacto - a.impacto)[0];
  if (!cara) return null;

  const diferencial = cara.dif;
  const impacto = cara.impacto;
  if (impacto < 500_000) return null;

  return {
    id: "deuda_cara_vs_ahorro",
    metrica: "$" + Math.round(impacto / 1e6) + "M",
    unidad: "al año en juego",
    titulo: `${cara.nombre} al ${cara.tasa.toFixed(1)}%`,
    detalle: `Tenés liquidez disponible mientras pagás una tasa del ${cara.tasa.toFixed(2)}% E.A. Abonar a capital rinde ${diferencial.toFixed(1)} puntos más que dejar la plata quieta.`,
    impactoAnual: impacto,
    base: `Tasa del crédito (${cara.tasa.toFixed(2)}% E.A.) vs. rendimiento de tu efectivo y CDT (${RENDIMIENTO_TIPICO.toFixed(2)}% E.A.), ponderado por monto. No incluye fondos ni acciones: son posiciones tomadas, no plata disponible.`,
    accion: { label: "Ver mis deudas", pagina: "deu" },
    tono: "oportunidad",
  };
}

/**
 * Concentración patrimonial: un solo activo pesando demasiado.
 * No es un error — puede ser deliberado — pero merece verse.
 */
function concentracion(user, trm, patrimonioTotal) {
  const invs = activos(user?.inv);
  if (invs.length < 2 || patrimonioTotal <= 0) return null;

  const mayor = invs
    .map((i) => ({ nombre: i.nombre || i.n || "Activo", valor: i.moneda === "USD" ? num(i.va) * trm : num(i.va) }))
    .sort((a, b) => b.valor - a.valor)[0];
  if (!mayor || mayor.valor <= 0) return null;

  const pct = (mayor.valor / patrimonioTotal) * 100;
  if (pct < 45) return null;

  return {
    id: "concentracion",
    metrica: pct.toFixed(0) + "%",
    unidad: "en un solo activo",
    titulo: mayor.nombre,
    detalle: "Un activo que pesa casi la mitad del total ata tu bienestar a un solo mercado. No es un error si es deliberado, pero conviene tenerlo presente al decidir el próximo movimiento.",
    // Sin cifra de ahorro: no es una oportunidad de plata sino de riesgo.
    impactoAnual: 0,
    riesgo: true,
    base: `${mayor.nombre} sobre patrimonio total calculado`,
    accion: { label: "Ver patrimonio", pagina: "inv" },
    tono: "riesgo",
  };
}


/**
 * Flujo de caja negativo. El hallazgo más urgente que puede existir: si sale
 * más de lo que entra, cualquier otra optimización es secundaria.
 */
function flujoNegativo(t) {
  const cf = num(t?.cashFlow);
  if (cf >= 0) return null;
  const deficit = Math.abs(cf);
  if (deficit < 100_000) return null; // ruido de redondeo
  return {
    id: "flujo_negativo",
    metrica: "-" + Math.round(deficit / 1e6) + "M",
    unidad: "por mes",
    titulo: "Gastás más de lo que entra",
    detalle: `Cada mes salen ${Math.round(deficit).toLocaleString("es-CO")} pesos más de los que ingresan. Si no viene de un ahorro previsto, el patrimonio se erosiona aunque los activos se vean bien.`,
    impactoAnual: deficit * 12,
    base: "Ingresos menos egresos totales del mes, según tus datos cargados",
    accion: { label: "Ver egresos", pagina: "gas" },
    tono: "riesgo",
  };
}

/**
 * Fondo de emergencia: cuántos meses aguanta el efectivo disponible.
 * Umbral de 3 meses — convención de planeación financiera, no norma legal.
 * Se declara como tal en `base`: es un criterio, no un artículo.
 */
function fondoEmergencia(user, t, trm) {
  const egresos = num(t?.egresosTotales);
  if (egresos <= 0) return null;

  const LIQUIDOS = ["cash", "cdt", "efectivo", "cuenta", "ahorro"];
  const liquidez = activos(user?.inv)
    .filter((i) => LIQUIDOS.some((x) => String(i.tipo || "").toLowerCase().includes(x)))
    .reduce((s, i) => s + (i.moneda === "USD" ? num(i.va) * trm : num(i.va)), 0);

  const meses = liquidez / egresos;
  if (meses >= 3) return null;

  const faltante = egresos * 3 - liquidez;
  return {
    id: "fondo_emergencia",
    metrica: meses.toFixed(1),
    unidad: "meses de colchón",
    titulo: meses < 1 ? "Sin colchón" : "Colchón corto",
    detalle: `Con tus egresos actuales, el efectivo disponible alcanza para ${meses.toFixed(1)} meses. Para llegar a tres meses de respaldo faltarían ${Math.round(faltante).toLocaleString("es-CO")} pesos.`,
    impactoAnual: 0,
    base: "Efectivo y CDT sobre egresos mensuales. El umbral de 3 meses es una convención de planeación financiera, no una norma",
    accion: { label: "Ver patrimonio", pagina: "inv" },
    tono: "riesgo",
  };
}

/**
 * Carga de deuda sobre ingreso. Umbral 35% — convención de la banca para
 * capacidad de endeudamiento, declarada como tal.
 */
function cargaDeuda(t) {
  const cuotas = num(t?.cuotasDeudas), bruto = num(t?.brutoTotal);
  if (bruto <= 0 || cuotas <= 0) return null;
  const pct = (cuotas / bruto) * 100;
  if (pct < 35) return null;
  return {
    id: "carga_deuda",
    metrica: pct.toFixed(0) + "%",
    unidad: "de tu ingreso",
    titulo: "Cuotas muy altas",
    detalle: "Por encima del 35% la mayoría de los bancos considera que no hay capacidad para más crédito, y el margen para imprevistos se vuelve muy estrecho.",
    impactoAnual: 0,
    base: "Cuotas de deudas sobre ingreso bruto. El umbral de 35% es el criterio habitual de la banca para capacidad de endeudamiento",
    accion: { label: "Ver deudas", pagina: "deu" },
    tono: "riesgo",
  };
}


// ════════════════════════════════════════════════════════════════════════════
// LO QUE ESTÁ BIEN
// 25-jul-2026 (Santiago): "pueden ser como varias cards, lo bueno lo malo".
// Hasta acá el asesor solo señalaba problemas. Un family office real también
// confirma lo que está sólido: le dice al cliente dónde NO tiene que
// preocuparse. Sin eso el producto se siente como una lista de reproches.
// ════════════════════════════════════════════════════════════════════════════

function colchonSolido(user, t, trm) {
  const egresos = num(t?.egresosTotales);
  if (egresos <= 0) return null;
  const LIQUIDOS = ["cash", "cdt", "efectivo", "cuenta", "ahorro"];
  const liquidez = activos(user?.inv)
    .filter((i) => LIQUIDOS.some((x) => String(i.tipo || "").toLowerCase().includes(x)))
    .reduce((s, i) => s + (i.moneda === "USD" ? num(i.va) * trm : num(i.va)), 0);
  const meses = liquidez / egresos;
  if (meses < 6) return null;
  return {
    id: "colchon_solido", bueno: true, tono: "bueno",
    metrica: meses >= 24 ? "24+" : meses.toFixed(0),
    unidad: "meses",
    titulo: "Colchón sólido",
    detalle: "Tu efectivo cubre bien un período sin ingresos.",
    base: "Efectivo y CDT sobre egresos mensuales",
    impactoAnual: 0,
  };
}

function flujoSano(t) {
  const cf = num(t?.cashFlow), bruto = num(t?.brutoTotal);
  if (cf <= 0 || bruto <= 0) return null;
  const tasa = (cf / bruto) * 100;
  if (tasa < 15) return null;
  return {
    id: "flujo_sano", bueno: true, tono: "bueno",
    metrica: tasa.toFixed(0) + "%",
    unidad: "de tu ingreso",
    titulo: "Ahorrás cada mes",
    detalle: `Te quedan ${Math.round(cf).toLocaleString("es-CO")} pesos libres al mes.`,
    base: "Flujo de caja sobre ingreso bruto",
    impactoAnual: 0,
  };
}

function deudaControlada(t) {
  const cuotas = num(t?.cuotasDeudas), bruto = num(t?.brutoTotal);
  if (bruto <= 0 || cuotas <= 0) return null;
  const pct = (cuotas / bruto) * 100;
  if (pct >= 25) return null;
  return {
    id: "deuda_controlada", bueno: true, tono: "bueno",
    metrica: pct.toFixed(0) + "%",
    unidad: "de tu ingreso",
    titulo: "Deuda bajo control",
    detalle: "Tus cuotas dejan margen amplio para imprevistos.",
    base: "Cuotas sobre ingreso bruto. Referencia habitual de la banca: hasta 35%",
    impactoAnual: 0,
  };
}

/**
 * Reúne todo, ordena por plata y devuelve lo más accionable.
 *
 * @param {object} p
 * @param {object} p.user            datos del usuario
 * @param {Array}  p.recomendaciones salida de generarRecomendaciones() (ya trae ahorroAnualEstimado y base legal)
 * @param {number} p.trm
 * @param {number} p.patrimonioTotal
 * @param {string[]} p.descartados   ids que el usuario ya descartó
 * @param {number} p.max
 */
export function generarHallazgos({ user, recomendaciones = [], trm = 4200, patrimonioTotal = 0, baseNormativa = "Estatuto Tributario", totales = null, descartados = [], max = 3 } = {}) {
  if (!user) return [];

  const propios = [
    flujoNegativo(totales),
    flujoSano(totales),
    colchonSolido(user, totales, trm),
    deudaControlada(totales),
    deudaCaraVsAhorro(user, trm),
    cargaDeuda(totales),
    fondoEmergencia(user, totales, trm),
    concentracion(user, trm, patrimonioTotal),
  ].filter(Boolean);

  // Las recomendaciones fiscales ya vienen con cifra y artículo citado.
  const fiscales = (recomendaciones || [])
    .filter((r) => r && num(r.ahorroAnualEstimado) > 0)
    .map((r) => ({
      id: `fiscal_${r.code || r.codigo}`,
      titulo: r.titulo,
      detalle: r.descripcion,
      impactoAnual: num(r.ahorroAnualEstimado),
      // 02-ago-2026 — el único texto de este motor atado a Colombia. Los 8
    // detectores razonan sobre conceptos universales (deuda cara vs ahorro,
    // concentración, fondo de emergencia), así que sirven igual en US: solo
    // había que no afirmar "Estatuto Tributario" en la jurisdicción
    // equivocada.
    base: r.base || baseNormativa,
      // 25-jul-2026: apuntaba a "taxopt", que es TaxOptimizerUS — el
      // optimizador de Estados Unidos. Un usuario colombiano hacía clic en
      // una recomendación del ET y aterrizaba en una pantalla que dice
      // "próximamente". El destino correcto es "tax" (Impuestos).
      accion: { label: "Ver impuestos", pagina: "tax" },
      tono: "oportunidad",
    }));

  const todos = [...propios, ...fiscales].filter((h) => !descartados.includes(h.id));

  // Se devuelven separados: la interfaz muestra primero lo que hay que mirar
  // y después lo que está bien. Dentro de cada grupo manda la plata.
  const porPlata = (a, b) => b.impactoAnual - a.impactoAnual;
  return {
    alertas: todos.filter((h) => !h.bueno).sort(porPlata).slice(0, max),
    buenas: todos.filter((h) => h.bueno).slice(0, 3),
  };
}
