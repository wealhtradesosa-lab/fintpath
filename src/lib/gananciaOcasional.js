// ════════════════════════════════════════════════════════════════════════════
// Motor del Optimizador de ganancia ocasional (venta de inmuebles, Colombia).
//
// Entrada: lo que la gente SÍ sabe (año de compra, valor de la escritura, si
// está en la renta, avalúo catastral, precio de venta). Salida: "lo que la
// mayoría paga" vs "lo que pagarías con la norma bien aplicada", cada vía de
// costo fiscal comparada, y la lista de estrategias con ahorro en pesos.
//
// Es un motor PURO (sin React) para poder testearlo número a número.
// La norma (tablas, UVT, tarifas) vive en normaGananciaOcasional.js.
// ════════════════════════════════════════════════════════════════════════════
import { uvtForYear } from "./taxCO.js";
import { calcImpRenta } from "./tablaArt241.js";
import {
  TARIFA_GO, TARIFA_SOCIEDADES, EXENCION_311_1_UVT, RETENCION_398,
  factorArt73, TABLA_ART73_AG,
} from "./normaGananciaOcasional.js";

const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };

/** Años completos entre compra y venta (con mes si se conoce). */
export function tenenciaAnos({ anoCompra, mesCompra, anoVenta, mesVenta }) {
  const ac = Number(anoCompra), av = Number(anoVenta);
  if (!Number.isFinite(ac) || !Number.isFinite(av)) return { anos: 0, exacta: false };
  const mc = Number(mesCompra) || 0, mv = Number(mesVenta) || 0;
  if (mc && mv) return { anos: (av - ac) + (mv - mc) / 12, exacta: true };
  return { anos: av - ac, exacta: false };
}

/**
 * @param {object} e
 *  titular: "natural" | "juridica"
 *  tipo: "urbano" | "rural_agro" | "rural_otro"
 *  anoCompra, mesCompra?, anoVenta, mesVenta?
 *  valorEscritura   — precio en la escritura de compra
 *  costoDeclarado   — (sociedad) costo fiscal en la declaración de la empresa
 *  enRenta          — "si" | "no" | "nose"
 *  avaluoAnterior   — avalúo catastral del año anterior a la venta
 *  avaluoActual     — avalúo catastral de este año (para la estrategia de enero)
 *  mejoras, valorizacion — con soporte, no incluidas en la escritura
 *  depreciacion     — (sociedad) depreciación fiscal acumulada
 *  precioVenta
 *  esVivienda       — (natural) es su casa/apto de habitación
 *  afc              — "si" | "no" | "tal_vez" (todo el dinero a AFC o al crédito)
 */
export function calcularGananciaOcasional(e = {}) {
  const natural = e.titular !== "juridica";
  const anoVenta = Number(e.anoVenta) || new Date().getFullYear();
  const uvt = uvtForYear(anoVenta);
  const venta = n(e.precioVenta);
  const escritura = n(e.valorEscritura);
  const adiciones = n(e.mejoras) + n(e.valorizacion);
  const dep = natural ? 0 : n(e.depreciacion);
  const avaluoAnt = n(e.avaluoAnterior);
  const ten = tenenciaAnos({ ...e, anoVenta });
  const esGO = ten.anos >= 2;
  const alertas = [];

  // ── Vías de costo fiscal ────────────────────────────────────────────────
  const vias = [];
  if (natural) {
    vias.push({ id: "art69", nombre: "Valor de la escritura + mejoras", norma: "Art. 69 ET", valor: escritura + adiciones, valida: escritura > 0 });
    const f = factorArt73(e.anoCompra, e.tipo || "urbano");
    vias.push({
      id: "art73", nombre: `Escritura × ${f.toLocaleString("es-CO")} (año ${e.anoCompra || "?"}) + mejoras`,
      norma: `Art. 73 ET · tabla AG ${TABLA_ART73_AG}`, factor: f,
      valor: escritura * f + adiciones, valida: escritura > 0 && f > 1,
      nota: f > 1 ? null : "Compra muy reciente: aún no hay factor.",
    });
  } else {
    const base = n(e.costoDeclarado) || Math.max(0, escritura - dep);
    vias.push({ id: "art69", nombre: n(e.costoDeclarado) ? "Costo fiscal en la declaración de la empresa + mejoras" : "Escritura − depreciación + mejoras", norma: "Arts. 69-70 ET", valor: base + adiciones, valida: base > 0 });
  }
  const avaluoBloqueado = e.enRenta === "no";
  vias.push({
    id: "art72", nombre: `Avalúo catastral ${anoVenta - 1}`, norma: "Art. 72 ET",
    valor: Math.max(0, avaluoAnt - dep), valida: avaluoAnt > 0 && !avaluoBloqueado,
    nota: avaluoBloqueado ? "Solo vale si el inmueble está en la declaración de renta." : null,
  });

  const validas = vias.filter((v) => v.valida);
  const mejor = validas.reduce((a, v) => (v.valor > (a?.valor ?? -1) ? v : a), null);
  vias.forEach((v) => { v.gana = mejor && v.id === mejor.id; });

  // ── Escenario "lo que la mayoría hace" ──────────────────────────────────
  const costoAntes = natural ? escritura : (vias[0].valida ? vias[0].valor - adiciones : 0);
  // ── Escenario optimizado ────────────────────────────────────────────────
  const costoDespues = mejor ? mejor.valor : costoAntes;

  const liquidar = (costo, conExencion) => {
    const utilidad = Math.max(0, venta - costo);
    const recaptura = natural ? 0 : Math.min(dep, utilidad);
    const utilidadGO = utilidad - recaptura;
    let exento = 0, imp = 0, impOrdinaria = 0, tipo = "go";
    if (esGO) {
      if (natural && conExencion) exento = Math.min(utilidadGO, EXENCION_311_1_UVT * uvt);
      imp = (utilidadGO - exento) * TARIFA_GO;
    } else {
      tipo = "ordinaria";
      impOrdinaria = natural ? calcImpRenta(utilidadGO / uvt, uvt) : utilidadGO * TARIFA_SOCIEDADES;
    }
    const impRecaptura = recaptura * TARIFA_SOCIEDADES;
    const total = imp + impOrdinaria + impRecaptura;
    return { costo, utilidad, recaptura, utilidadGO, exento, impGO: imp, impOrdinaria, impRecaptura, total, tipo };
  };

  const califica311 = natural && !!e.esVivienda && esGO;
  let antes = liquidar(costoAntes, false);
  let despues = liquidar(costoDespues, califica311 && e.afc === "si");

  // ── Sociedad: vender las ACCIONES en vez del inmueble (Arts. 73 y 300) ──
  // El socio vende como persona natural: su costo (aportes) se ajusta con el
  // factor del Art. 73 para acciones. Se compara contra lo que la empresa
  // pagaría por vender la casa (su parte), porque después del 15% la empresa
  // reparte el resto como dividendo no gravado (Art. 49).
  let acciones = null;
  if (!natural && n(e.costoAcciones) > 0 && Number(e.anoAcciones) > 1900) {
    const pct = Math.min(100, n(e.pctAcciones) || 100) / 100;
    const precioAcc = Math.max(0, venta - n(e.deudasEmpresa)) * pct;
    const fA = factorArt73(e.anoAcciones, "acciones");
    const costoAj = n(e.costoAcciones) * fA;
    const tenA = tenenciaAnos({ anoCompra: e.anoAcciones, anoVenta });
    const gan = Math.max(0, precioAcc - costoAj);
    const imp = tenA.anos >= 2 ? gan * TARIFA_GO : calcImpRenta(gan / uvt, uvt);
    const impEmpresa = despues.total * pct;
    acciones = { pct, precio: precioAcc, factor: fA, costo: costoAj, ganancia: gan, impuesto: imp, impEmpresa, ahorro: Math.max(0, impEmpresa - imp), esGO: tenA.anos >= 2 };
    if (e.ventaAcciones) {
      antes = { ...antes, total: antes.total * pct, costo: antes.costo };
      despues = { costo: costoAj, utilidad: gan, recaptura: 0, utilidadGO: gan, exento: 0, impGO: imp, impOrdinaria: 0, impRecaptura: 0, total: imp, tipo: "acciones" };
    }
  }
  const ahorro = Math.max(0, antes.total - despues.total);

  // ── Estrategias ─────────────────────────────────────────────────────────
  const est = [];
  const ahorroCosto = (c) => Math.max(0, Math.min(venta, c) - Math.min(venta, costoAntes)) * (esGO ? TARIFA_GO : 0);
  if (natural) {
    const v73 = vias.find((v) => v.id === "art73");
    est.push({
      id: "art73", titulo: `Ajustar el costo con el factor de la DIAN (×${(v73.factor || 1).toLocaleString("es-CO")})`, norma: "Art. 73 ET",
      estado: v73.valida ? (v73.gana ? "aplicada" : "superada") : "no_aplica",
      ahorro: v73.valida ? ahorroCosto(v73.valor) : 0,
      detalle: v73.valida
        ? `Lo que pagaste en ${e.anoCompra} se lleva a pesos de hoy: tu costo pasa de $${Math.round(escritura).toLocaleString("es-CO")} a $${Math.round(escritura * v73.factor).toLocaleString("es-CO")}. Es legal y casi nadie lo usa.`
        : "La compra es muy reciente para tener factor.",
    });
  } else {
    est.push({
      id: "art73", titulo: "Factor de la DIAN (Art. 73)", norma: "Art. 73 ET", estado: "no_aplica", ahorro: 0,
      detalle: "Solo existe para personas naturales. A una empresa le aplica el reajuste anual del Art. 70: pregúntale a tu contador si lo aplicó cada año en la declaración.",
    });
  }
  const v72 = vias.find((v) => v.id === "art72");
  est.push({
    id: "art72", titulo: "Usar el avalúo catastral como costo", norma: "Art. 72 ET", campos: avaluoBloqueado ? [] : ["avaluoAnterior"],
    estado: v72.valida ? (v72.gana ? "aplicada" : "superada") : avaluoBloqueado ? "bloqueada" : "falta_dato",
    ahorro: v72.valida ? ahorroCosto(v72.valor) : 0,
    detalle: avaluoBloqueado
      ? "No puedes usarlo: el inmueble no está en tu declaración de renta. Regularízalo con tu contador antes de vender."
      : avaluoAnt
        ? `Vale el avalúo de ${anoVenta - 1} que aparece en el predial o en la renta. Un avalúo comercial de perito NO sirve.`
        : `Escribe el avalúo catastral de ${anoVenta - 1} (está en la factura del predial). Si es mayor que tu costo, te baja el impuesto.`,
  });
  if (adiciones > 0) est.push({
    id: "mejoras", titulo: "Sumar mejoras y valorización con soporte", norma: "Art. 69 ET", estado: "aplicada", campos: ["mejoras", "valorizacion"],
    ahorro: esGO ? Math.min(adiciones, Math.max(0, venta - costoAntes)) * TARIFA_GO * (mejor?.id === "art72" ? 0 : 1) : 0,
    detalle: "Remodelaciones, ampliaciones y contribuciones por valorización suman al costo si tienes factura o soporte.",
  });
  else est.push({
    id: "mejoras", titulo: "¿Le hiciste mejoras? Súmalas", norma: "Art. 69 ET", estado: "falta_dato", ahorro: 0, campos: ["mejoras", "valorizacion"],
    detalle: "Remodelaciones, ampliaciones y contribuciones por valorización con factura suben el costo. Cada $10 MM de costo baja el impuesto estimado en $1,5 MM.",
  });

  const exPosible = Math.min(liquidar(costoDespues, false).utilidadGO, EXENCION_311_1_UVT * uvt) * TARIFA_GO;
  if (natural) {
    est.push({
      id: "311-1", titulo: `Primeras 5.000 UVT exentas por ser tu vivienda ($${Math.round(EXENCION_311_1_UVT * uvt).toLocaleString("es-CO")})`, norma: "Art. 311-1 ET",
      estado: !e.esVivienda ? "no_aplica" : !esGO ? "bloqueada" : e.afc === "si" ? "aplicada" : "posible",
      accion: califica311 ? (e.afc === "si" ? "quitar_afc" : "afc") : null,
      ahorro: califica311 ? exPosible : 0,
      detalle: !e.esVivienda
        ? "Solo para la casa o apartamento donde vives."
        : !esGO ? "Requiere haberla tenido más de 2 años."
        : e.afc === "si" ? "Requisito: TODO el dinero de la venta va a una cuenta AFC para comprar otra vivienda, o directo a pagar el crédito hipotecario de esta casa. Si lo sacas para otra cosa, pierdes el beneficio."
        : "Lo ganas si pones TODO el dinero de la venta en una cuenta AFC para comprar otra vivienda, o pagas directo el crédito hipotecario de esta casa. Las 5.000 UVT son por la venta completa, no por cada dueño (DIAN, Concepto 820 de 2024).",
    });
  } else {
    est.push({
      id: "311-1", titulo: "Exención de vivienda (5.000 UVT)", norma: "Art. 311-1 ET", estado: "no_aplica", ahorro: 0,
      detalle: "No aplica: el inmueble es de la empresa. Aunque vivas ahí, la exención es solo para personas naturales que venden su propia vivienda.",
    });
  }
  if (!esGO) {
    const conGO = (() => { const u = Math.max(0, venta - costoDespues); return u * TARIFA_GO; })();
    est.push({
      id: "esperar", titulo: "Esperar a cumplir 2 años para vender", norma: "Art. 300 ET", estado: "posible", accion: "esperar",
      ahorro: Math.max(0, despues.total - conGO),
      detalle: natural
        ? "Antes de 2 años la ganancia suma a tu renta normal (hasta 39%). Después paga 15% fijo. Cuenta desde la fecha de la escritura de compra."
        : "Antes de 2 años la empresa paga 35%; después, 15%.",
    });
  } else if (!ten.exacta && Math.floor(ten.anos) === 2) {
    alertas.push("Llevas cerca de 2 años: confirma que hayan pasado 2 años completos entre la escritura de compra y la de venta. Si no, se paga como renta normal.");
  }
  const avAct = n(e.avaluoActual);
  if ((Number(e.mesVenta) || 12) >= 10 && !avaluoBloqueado) {
    const costoEnero = Math.max(costoDespues, avAct - dep);
    const imp = (c) => Math.max(0, venta - c) * TARIFA_GO;
    const ah = esGO && avAct > avaluoAnt ? Math.max(0, imp(costoDespues) - imp(costoEnero)) : 0;
    est.push({
      id: "enero", titulo: `Escriturar en enero de ${anoVenta + 1}`, norma: "Art. 72 ET",
      estado: !avAct ? "falta_dato" : ah > 0 ? "posible" : "superada", campos: ["avaluoActual"], accion: ah > 0 ? "enero" : null,
      ahorro: ah,
      detalle: !avAct
        ? `Si escrituras en enero de ${anoVenta + 1}, el costo pasa a ser el avalúo catastral de ${anoVenta}. Escríbelo (está en el predial de este año) para ver si te conviene esperar unas semanas.`
        : ah > 0 ? `El avalúo de ${anoVenta} ($${Math.round(avAct).toLocaleString("es-CO")}) es mayor: escriturar en enero baja el impuesto.`
        : `El avalúo de ${anoVenta} no mejora tu costo: no hace falta esperar.`,
    });
  }
  if (!natural) {
    est.push({
      id: "dividendo", titulo: "Sacar la plata de la empresa sin otro impuesto", norma: "Art. 49 ET", estado: "info", ahorro: 0,
      detalle: "Lo que quede de la ganancia después del 15% se puede repartir a los socios como dividendo NO gravado. Pídele a tu contador el cálculo del Art. 49.",
    });
    const fm$ = (v) => "$" + Math.round(v).toLocaleString("es-CO");
    est.push({
      id: "acciones", titulo: "Vender tus acciones de la empresa en vez de la casa", norma: "Arts. 73 y 300 ET",
      campos: ["costoAcciones", "anoAcciones", "pctAcciones", "deudasEmpresa"],
      estado: !acciones ? "falta_dato" : e.ventaAcciones ? "aplicada" : acciones.ahorro > 0 ? "posible" : "superada",
      accion: acciones && acciones.ahorro > 0 ? (e.ventaAcciones ? "quitar_acciones" : "acciones") : null,
      ahorro: acciones ? acciones.ahorro : 0,
      detalle: !acciones
        ? "La casa no cambia de dueño: el comprador te compra la empresa completa, con la casa adentro, y tú recibes la plata. Pagas ganancia ocasional, pero sobre tus acciones, y a tus aportes sí les aplica el factor de la DIAN. Escribe cuánto te costaron tus acciones y en qué año, y te mostramos cuánto pagarías."
        : `El comprador se queda con la empresa y la casa; tú recibes ${fm$(acciones.precio)} por tus acciones. Tu costo ${fm$(n(e.costoAcciones))} × ${acciones.factor.toLocaleString("es-CO")} (año ${e.anoAcciones}) = ${fm$(acciones.costo)}. Impuesto: ${fm$(acciones.impuesto)} frente a ${fm$(acciones.impEmpresa)} si la empresa vende la casa. Requiere que el comprador acepte comprar la sociedad (hereda su costo fiscal bajo y sus deudas): hazlo con abogado.`,
    });
    if (dep > 0) alertas.push(`La depreciación que la empresa ya descontó ($${Math.round(dep).toLocaleString("es-CO")}) vuelve como renta ordinaria al 35% (Arts. 195-196 ET).`);
  }

  // ── Alertas de cumplimiento ─────────────────────────────────────────────
  if (e.enRenta === "no") alertas.push("El inmueble no está en tu declaración de renta. Antes de vender, habla con tu contador para incluirlo: la DIAN cruza la escritura con tu declaración y la omisión tiene sanción.");
  if (e.enRenta === "nose") alertas.push("Revisa tu última declaración de renta: si el inmueble no aparece, no puedes usar el avalúo catastral como costo.");
  if (avaluoAnt > 0 && venta > 0 && venta < avaluoAnt) alertas.push("El precio de venta es menor que el avalúo catastral: la DIAN no acepta vender por debajo del avalúo (Art. 90 ET).");
  if (natural && venta > 0) alertas.push(`Al firmar la escritura, la notaría te retiene el 1% del precio ($${Math.round(venta * RETENCION_398).toLocaleString("es-CO")}). No es un costo extra: se descuenta del impuesto en tu declaración.`);

  const MITOS = [
    { mito: "“Hago un avalúo comercial y la declaro por más”", realidad: "El Art. 72 excluye el avalúo de perito, y las correcciones a las declaraciones no cuentan. Solo vale el avalúo catastral o el autoavalúo del predial." },
    { mito: "“Parto la venta en dos años y pago menos”", realidad: "La ganancia ocasional paga 15% fijo, sin escalas: partirla da lo mismo. Fraccionar sin razón real puede verse como abuso." },
    { mito: "“Escrituro por menos para pagar menos”", realidad: "Desde 2019 se escritura por el precio real y se declara bajo juramento que no hubo pagos por fuera (Art. 90 ET). Es fraude." },
    { mito: "“Digo que era mi vivienda aunque está a nombre de la empresa”", realidad: "La exención del Art. 311-1 es solo para personas naturales. Declararlo así es una declaración inexacta con sanción." },
  ];

  return { natural, uvt, anoVenta, tenencia: ten, esGO, vias, mejor: despues.tipo === "acciones" ? { id: "acciones", norma: "venta de acciones · Art. 73" } : mejor, antes, despues, ahorro, acciones, estrategias: est, alertas, mitos: MITOS };
}
