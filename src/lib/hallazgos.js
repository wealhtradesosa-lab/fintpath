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
    titulo: `Tu ${cara.nombre} al ${cara.tasa.toFixed(2)}% cuesta más de lo que rinde tu ahorro`,
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
    titulo: `${mayor.nombre} concentra el ${pct.toFixed(0)}% de tu patrimonio`,
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
export function generarHallazgos({ user, recomendaciones = [], trm = 4200, patrimonioTotal = 0, descartados = [], max = 3 } = {}) {
  if (!user) return [];

  const propios = [
    deudaCaraVsAhorro(user, trm),
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
      base: r.base || "Estatuto Tributario",
      // 25-jul-2026: apuntaba a "taxopt", que es TaxOptimizerUS — el
      // optimizador de Estados Unidos. Un usuario colombiano hacía clic en
      // una recomendación del ET y aterrizaba en una pantalla que dice
      // "próximamente". El destino correcto es "tax" (Impuestos).
      accion: { label: "Ver impuestos", pagina: "tax" },
      tono: "oportunidad",
    }));

  return [...propios, ...fiscales]
    .filter((h) => !descartados.includes(h.id))
    // Orden por plata. Los de riesgo (impacto 0) quedan al final: importan,
    // pero no compiten con una oportunidad concreta de ahorro.
    .sort((a, b) => b.impactoAnual - a.impactoAnual)
    .slice(0, max);
}
