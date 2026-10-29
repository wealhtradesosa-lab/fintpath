// ════════════════════════════════════════════════════════════════════════════
// Solucionador de ganancia ocasional (venta de inmuebles, Colombia).
//
// 28-oct-2026 (Santiago): "esto debería ser más un solucionador: vas a pagar
// tanto; haz esto y ahorras tanto". Validado primero como prototipo.
//
// Regla central de cómo se combinan las estrategias:
//   · Camino por compra = costo (× factor Art. 73 si es persona, o reajuste
//     Art. 70 si es empresa) + mejoras. Estas SÍ se suman entre sí.
//   · Camino por avalúo = avalúo catastral del año anterior a la escritura (Art. 72).
//   · Costo fiscal = el MAYOR de los dos caminos (nunca se suman).
//   · Aparte, encima: pérdidas ocasionales del mismo año, exención de vivienda
//     (Art. 311-1, solo personas) y dividendo no gravado (Art. 49, empresas).
// Solo se muestran los pasos que aplican al tipo de dueño.
// ════════════════════════════════════════════════════════════════════════════
import { uvtForYear } from "./taxCO.js";
import { calcImpRenta } from "./tablaArt241.js";
import { TARIFA_GO, TARIFA_SOCIEDADES, EXENCION_311_1_UVT, factorArt73, tablaArt70, ULTIMO_AG_ART70 } from "./normaGananciaOcasional.js";

const n = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };

export const PLAN_DEFAULT_USAR = { soportes: false, factor: true, reajuste: true, mejoras: true, avaluo: true, perdidas: true, vivienda: true };

/**
 * @param {object} e
 *  titular "natural"|"juridica", tipo, anoCompra, costo, venta, anoVenta (año de la escritura),
 *  avaluoAnterior (año anoVenta-1), avaluoSiguiente (año anoVenta, para firmar en enero siguiente),
 *  mejoras, perdidas, reajusteContador, vivienda (bool), afc (bool), usar {id: bool}
 */
export function planGananciaOcasional(e = {}) {
  const nat = e.titular !== "juridica";
  const anoVenta = Number(e.anoVenta) || new Date().getFullYear();
  const uvt = uvtForYear(anoVenta);
  const venta = n(e.venta);
  const usar = { ...PLAN_DEFAULT_USAR, ...(e.usar || {}) };

  // 28-oct-2026 (Santiago: "la gente no lo sabe… ¿tiene registrado casa y lote,
  // solo lote a pesar de tener casa construida? Según el escenario, que proponga").
  // modo "terminado": una sola compra (escritura). modo "construido": lote + construcción,
  // cada una con su año; la construcción solo cuenta si tiene soportes.
  const construido = e.modo === "construido";
  const sinSoporte = construido && e.soporteConstruccion === "no";
  const partes = construido
    ? [
        { id: "lote", concepto: "Lote", valor: n(e.lote), ano: Number(e.anoLote) || anoVenta },
        { id: "construccion", concepto: "Construcción", valor: n(e.construccion), ano: Number(e.anoConstruccion) || Number(e.anoLote) || anoVenta, sinSoporte },
      ].filter((p) => p.valor > 0)
    : [{ id: "compra", concepto: "Compra", valor: n(e.costo), ano: Number(e.anoCompra) || anoVenta }];
  const anoCompra = construido ? Math.max(...partes.map((p) => p.ano), 0) || anoVenta : (Number(e.anoCompra) || anoVenta);
  const tenencia = anoVenta - anoCompra;
  const esGO = tenencia >= 2;
  const incluir = (p) => !p.sinSoporte || usar.soportes;
  const costoBase = partes.filter((p) => !p.sinSoporte).reduce((a, p) => a + p.valor, 0);

  const impuesto = (costo, exento = 0) => {
    const u = Math.max(0, venta - costo);
    if (!esGO) return nat ? calcImpRenta(u / uvt, uvt) : u * TARIFA_SOCIEDADES;
    return Math.max(0, u - exento) * TARIFA_GO;
  };
  // Ajuste de cada parte desde su propio año: factor Art. 73 (persona) o reajuste Art. 70 (empresa).
  const ajustar = (lista) => lista.map((p) => {
    if (nat) { const f = factorArt73(p.ano, e.tipo || "urbano"); return { ...p, factor: f, resultado: p.valor * f }; }
    const t = tablaArt70(p.ano, p.valor);
    return { ...p, factor: t.factor, resultado: t.costo, filas: t.filas, desde: p.ano + 1 };
  });
  const sumaAjustada = (lista) => ajustar(lista).reduce((a, p) => a + p.resultado, 0);

  let hist = costoBase, aval = 0, perd = 0, exento = 0;
  const C = () => Math.max(hist, aval) + perd;
  const prueba = (fn, ex = exento) => { const t = { hist, aval, perd }; fn(t); return impuesto(Math.max(t.hist, t.aval) + t.perd, ex); };
  const hoy = impuesto(costoBase);
  const pasos = [];

  // 0 · Construcción sin soportes: conseguirlos (o apoyarse en el avalúo)
  if (sinSoporte) {
    const cons = partes.find((p) => p.id === "construccion");
    const conAjuste = (usar.factor !== false && usar.reajuste !== false);
    const valorCons = conAjuste ? sumaAjustada([cons]) : cons.valor;
    const d = impuesto(C(), exento) - prueba((t) => { t.hist += cons.valor; });
    pasos.push({
      id: "soportes", grupo: "compra", titulo: "Reúne los soportes de la construcción", norma: "Arts. 69 y 771-2 ET",
      ok: true, on: usar.soportes, ahorro: d,
      texto: `Hoy solo puedes probar el lote, así que el cálculo arranca en $${fmt(costoBase)}. Si consigues los soportes de los $${fmt(cons.valor)} de construcción, ese valor suma a tu costo${conAjuste ? ` y también se reajusta desde ${cons.ano} (queda en unos $${fmt(valorCons)})` : ""}. Marca «Lo voy a hacer» si los vas a reunir.`,
      porque: "El costo fiscal es lo que puedes probar que pagaste: el lote más la construcción y las mejoras (Art. 69). Sin soportes, la DIAN puede rechazar la construcción y dejar solo el lote como costo, aunque la casa exista. Si la empresa ya declaraba un valor que incluía la construcción, ese valor vale mientras la DIAN no lo cuestione, pero en una revisión te pedirán soportes.",
      soporte: "Licencia de construcción, contratos de obra, facturas de materiales (ferretería, concreto, acero), pagos de mano de obra y seguridad social, y la contabilidad de los años de la obra.",
      ojo: "Si no logras reunir soportes, el avalúo catastral (paso de abajo) suele ser tu mejor salida: el catastro sí incluye la casa construida.",
    });
    if (usar.soportes) hist += cons.valor;
  }

  // 1 · Ajuste por años: factor (persona) o reajuste (empresa), cada parte desde su año
  {
    const lista = partes.filter(incluir);
    const aj = ajustar(lista);
    const base = lista.reduce((a, p) => a + p.valor, 0);
    const conAj = aj.reduce((a, p) => a + p.resultado, 0);
    const cR = !nat && n(e.reajusteContador) > base ? n(e.reajusteContador) : conAj;
    const d = impuesto(C(), exento) - prueba((t) => { t.hist = t.hist - base + Math.max(base, cR); });
    const detalle = aj.length > 1 ? aj.map((p) => `${p.concepto} ${p.ano}: $${fmt(p.valor)} × ${p.factor.toLocaleString("es-CO", { maximumFractionDigits: 4 })} = $${fmt(p.resultado)}`).join(" · ") : "";
    const formula = { hasta: nat ? null : ULTIMO_AG_ART70, partes: aj.map((p) => ({ concepto: p.concepto, desde: nat ? p.ano : p.ano + 1, costo: p.valor, factor: p.factor, resultado: p.resultado, filas: p.filas || null })) };
    if (nat) {
      const ok = conAj > base;
      pasos.push({
        id: "factor", grupo: "compra",
        titulo: aj.length === 1 ? `Multiplica tu costo × ${aj[0].factor.toLocaleString("es-CO")} (factor DIAN, ${aj[0].ano})` : "Lleva cada parte a pesos de hoy con el factor DIAN",
        norma: "Art. 73 ET · Decreto 449 de 2026", ok, on: usar.factor, ahorro: d,
        texto: ok ? `Tu costo por compra pasa de $${fmt(base)} a $${fmt(conAj)}.${detalle ? " " + detalle + "." : ""} Lo aplica el contador en la declaración.` : "La compra es muy reciente: todavía no hay factor.",
        formula: aj.length > 1 ? formula : null,
        porque: "El Art. 73 deja a las personas naturales llevar a pesos de hoy el costo de inmuebles, acciones y aportes, multiplicándolo por el factor de su año. Si construiste, el lote se ajusta desde el año en que lo compraste y la construcción desde el año en que la pagaste. La tabla la publica el Gobierno cada año (vigente: Decreto 449 de 2026). Si usas el Art. 73 no puedes usar también el reajuste del Art. 70 para el mismo bien (Art. 280).",
        soporte: "La escritura del lote o de la compra y, si construiste, los soportes de la obra con sus fechas.",
        ojo: "Para ventas de 2026 el factor oficial sale en 2027 y será un poco mayor: este resultado es conservador.",
      });
      if (usar.factor && ok) hist = hist - base + conAj;
    } else {
      pasos.push({
        id: "reajuste", grupo: "compra", titulo: aj.length > 1 ? "Reajusta el lote y la construcción, cada uno desde su año" : "Reajusta el costo de la empresa año por año",
        norma: "Art. 70 ET · Oficio DIAN 914975 de 2021", ok: cR > base, on: usar.reajuste, ahorro: d,
        campos: ["reajusteContador"], valores: { reajusteContador: cR },
        texto: `Tu costo reajustado es $${fmt(cR)} (antes $${fmt(base)}).${detalle ? " " + detalle + "." : ""} Ya quedó en la casilla; cámbialo solo si tu contador tiene otro valor.`,
        formula,
        porque: "El Art. 70 deja subir cada año el costo de los activos fijos con el porcentaje que fija el Gobierno por decreto. Cada parte se reajusta desde el año siguiente a cuando se pagó: el lote desde su compra y la construcción desde que se hizo. Es opcional, y la DIAN aceptó aplicarlo al vender aunque no se haya aplicado ni declarado antes (Oficio 914975 de 2021). A las empresas no les aplica el factor del Art. 73: este es su ajuste.",
        soporte: "El cálculo año por año con los decretos de cada porcentaje (la tabla de este paso).",
        ojo: "Si el valor que tiene la empresa ya incluye una revaluación contable o reajustes aplicados antes, no se reajusta otra vez encima: se parte del costo histórico real. El oficio no dice palabra por palabra que se sumen todos los años de una vez; muchos asesores lo aplican así. Subir el costo también sube el patrimonio: revisa el impuesto temporal al patrimonio de empresas (Decreto 0173 de 2026).",
      });
      if (usar.reajuste) hist = hist - base + Math.max(base, cR);
    }
  }

  // 2 · Mejoras (se suman al camino por compra)
  {
    const m = n(e.mejoras);
    const d = impuesto(C(), exento) - prueba((t) => { t.hist += m; });
    pasos.push({
      id: "mejoras", grupo: "compra", titulo: "Suma reformas, ampliaciones y valorización con factura", norma: "Art. 69 ET",
      ok: m > 0, on: usar.mejoras, ahorro: d, campos: ["mejoras"],
      texto: m > 0
        ? (d > 0 ? `Suma $${fmt(m)} a tu costo por compra, que queda en $${fmt(hist + m)}.` : `Aun sumando $${fmt(m)}, tu costo por compra no supera el avalúo: aquí las mejoras no cambian el impuesto.`)
        : "Reformas, ampliaciones y sus materiales (facturas de ferretería incluidas) a nombre del dueño se suman a tu costo por compra. Cada $100 MM bajan el impuesto $15 MM.",
      porque: "El Art. 69 arma el costo fiscal con el precio de compra más las adiciones y mejoras y las contribuciones por valorización pagadas. Cada mejora también se reajusta desde el año en que se hizo.",
      soporte: "Facturas electrónicas a nombre del dueño (con NIT si es empresa), contratos de obra, pagos de mano de obra y recibos de valorización.",
      ojo: "Solo cuentan mejoras que aumentan el valor o la vida útil (ampliaciones, remodelaciones). Arreglos y mantenimiento no. Si la empresa ya las descontó como gasto, no se pueden sumar otra vez.",
    });
    if (usar.mejoras) hist += m;
  }

  // 3 · Avalúo (camino alternativo: se usa el mayor)
  {
    const av = n(e.avaluoAnterior);
    const d = impuesto(C(), exento) - prueba((t) => { t.aval = Math.max(t.aval, av); });
    pasos.push({
      id: "avaluo", grupo: "avaluo", titulo: `Usa el avalúo catastral ${anoVenta - 1} como costo (firmas en ${anoVenta})`, norma: "Art. 72 ET",
      ok: d > 0, on: usar.avaluo, ahorro: d, campos: ["avaluoAnterior"],
      texto: (!av ? `Escribe el avalúo catastral ${anoVenta - 1} (está en el predial). Si es mayor que tu costo por compra, se usa en su lugar.`
        : d > 0 ? `El avalúo ($${fmt(av)}) es mayor que tu costo por compra ($${fmt(hist)}), así que la ley te deja usarlo en su lugar.`
        : `Tu costo por compra ($${fmt(hist)}) ya es mayor que el avalúo, así que no lo necesitas. El avalúo no se suma: se usa el mayor de los dos.`) + ` Regla: cuenta el avalúo del año anterior a la firma de la escritura (firmas en ${anoVenta} → avalúo ${anoVenta - 1}; firmas en ${anoVenta + 1} → avalúo ${anoVenta}).`,
      ...(sinSoporte ? { destacado: "Como no tienes soportes de la construcción, este paso es clave: el avalúo catastral sí incluye la casa construida." } : {}),
      porque: "El Art. 72 deja tomar como costo el avalúo catastral (o el autoavalúo) del año anterior a la venta, en vez del costo por compra. Aplica a personas y empresas si el inmueble es activo fijo. Basta con que aparezca en el predial o en la renta (Consejo de Estado, sentencia 20677 de 2018).",
      soporte: `La factura o declaración del predial de ${anoVenta - 1}.`,
      ojo: "Un avalúo comercial de perito NO sirve, aunque sea más alto. Lo que sí sirve es el avalúo catastral o el autoavalúo que quede en el predial: en ciudades donde el predial se declara (como Bogotá) puedes declarar un autoavalúo mayor; en otras se le pide al catastro una autoestimación del avalúo. Ese valor cuenta para ventas del año siguiente y sube el predial. Tampoco vale corregir declaraciones para subirlo. El inmueble tiene que estar en la declaración de renta (Oficio DIAN 561 de 2021).",
    });
    if (usar.avaluo) aval = Math.max(aval, av);
  }

  // 5 · Pérdidas ocasionales del mismo año (aparte)
  {
    const p = n(e.perdidas);
    const d = impuesto(C(), exento) - prueba((t) => { t.perd += p; });
    pasos.push({
      id: "perdidas", grupo: "aparte", titulo: "Vende en el mismo año algo que haya perdido valor", norma: "Art. 300 ET · doctrina DIAN",
      ok: p > 0, on: usar.perdidas, ahorro: d, campos: ["perdidas"],
      texto: p > 0 ? `Esa pérdida de $${fmt(p)} se resta de la ganancia del inmueble.`
        : "Si tienes otro activo de más de 2 años que hoy vale menos de lo que costó (acciones, un lote, un vehículo), venderlo el mismo año resta esa pérdida. Escribe la pérdida.",
      porque: "Las pérdidas por vender activos de más de 2 años (pérdidas ocasionales) se restan de las ganancias ocasionales del mismo año. Si la otra venta cae en otro año, no se puede restar.",
      ejemplo: "Con un carro: la empresa compró una camioneta en 2022 por $400 MM y ya la depreció $160 MM, así que su costo fiscal hoy es $240 MM. Si la vende el mismo año de la casa en $180 MM, pierde $60 MM y esa pérdida se resta de la ganancia de la casa: el impuesto baja $9 MM (15% de $60 MM). Ojo: en una empresa el carro casi siempre está depreciado, así que su costo fiscal es bajo y venderlo puede dar ganancia en vez de pérdida. La pérdida que cuenta es frente al costo fiscal, no frente a lo que pagaste.",
      soporte: "La escritura o contrato de venta del otro activo y su costo fiscal.",
      ojo: "La venta tiene que ser real y a precio de mercado (Art. 90): venderle a un socio o vinculado por debajo de su valor la DIAN la puede desconocer. Las pérdidas de renta ordinaria de años anteriores no sirven para esto.",
    });
    if (usar.perdidas) perd += p;
  }

  // 6 · Persona: exención de vivienda · Empresa: dividendo no gravado
  if (nat) {
    const ex = EXENCION_311_1_UVT * uvt;
    const e2 = e.vivienda && e.afc && esGO ? ex : 0;
    const d = impuesto(C(), 0) - impuesto(C(), e2);
    pasos.push({
      id: "vivienda", grupo: "aparte", titulo: `Si vives ahí: $${fmt(ex)} exentos (5.000 UVT)`, norma: "Art. 311-1 ET",
      ok: !!e.vivienda, on: usar.vivienda, ahorro: d || (e.vivienda && esGO ? impuesto(C(), 0) - impuesto(C(), ex) : 0), checks: true,
      texto: "Requisito: que sea tu vivienda y que TODO el dinero vaya a una cuenta AFC para comprar otra vivienda, o directo a pagar el crédito de esta casa.",
      porque: "El Art. 311-1 deja exentas las primeras 5.000 UVT de la utilidad cuando una persona natural vende su casa o apartamento de habitación (la Ley 2277 de 2022 bajó el tope de 7.500 a 5.000 UVT y quitó el límite de avalúo).",
      soporte: "El certificado de la cuenta AFC con el depósito de la venta, o el soporte del abono directo al crédito hipotecario.",
      ojo: "Si retiras la plata de la AFC para otra cosa, pierdes la exención. Las 5.000 UVT son por la venta completa, no por cada dueño (Concepto DIAN 820 de 2024).",
    });
    if (usar.vivienda) exento = e2;
  } else {
    pasos.push({
      id: "dividendo", grupo: "aparte", titulo: "Saca la plata de la empresa sin otro impuesto", norma: "Art. 49 ET",
      ok: true, on: true, ahorro: 0, info: true,
      texto: "Lo que queda después del 15% se reparte a los socios como dividendo no gravado. No pagas un segundo impuesto.",
      porque: "El Art. 49 calcula qué parte de las utilidades de la empresa ya pagó impuesto; incluye las ganancias ocasionales gravadas menos su impuesto. Esa parte se reparte como dividendo no gravado.",
      soporte: "El acta de asamblea que decreta el dividendo y el cálculo del Art. 49 firmado por el contador.",
      ojo: "El cálculo del Art. 49 es de toda la empresa en el año: si tuvo otras utilidades o pérdidas, el monto no gravado cambia.",
    });
  }

  const final = impuesto(C(), exento);

  // Alternativa de fecha (no es un paso del plan): solo si la escritura es este año.
  // 28-oct-2026 (Santiago: "si uno pone arriba la escritura en un año, ¿por qué
  // en las preguntas pone dos años de avalúo?"). El plan usa solo el avalúo del
  // año elegido; esta tarjeta compara contra firmar en enero del año siguiente.
  let alternativaEnero = null;
  const anoActual = Number(e.anoActual) || new Date().getFullYear();
  if (!e._sinAlternativa && anoVenta === anoActual) {
    const r2 = planGananciaOcasional({ ...e, anoVenta: anoVenta + 1, avaluoAnterior: e.avaluoSiguiente, avaluoSiguiente: "", _sinAlternativa: true });
    alternativaEnero = {
      anoNuevo: anoVenta + 1, avaluoAno: anoVenta, tieneAvaluo: n(e.avaluoSiguiente) > 0,
      final: r2.final, ahorroExtra: Math.max(0, final - r2.final),
    };
  }
  return { nat, uvt, esGO, tenencia, hoy, final, alternativaEnero, costoBase, construido, sinSoporte, ahorro: Math.max(0, hoy - final), costoFinal: C(), caminoCompra: hist, caminoAvaluo: aval, pasos };
}

function fmt(v) { return Math.round(v).toLocaleString("es-CO"); }
