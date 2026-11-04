// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · SimuladorFuturo — "¿Me alcanza con la vida que viene?"
//
// 4-oct-2026, Santiago: "este año como está simulado está bien, pero voy a
// tener unos cambios muy grandes el año entrante; quisiera poder simular un
// mes futuro según esos cambios para saber si soy capaz de sostenerme o no".
//
// El simulador de año actual solo mueve lo que ya existe (sliders) dentro de
// este año. Este responde otra pregunta y por eso es otra pantalla:
//
//   AÑO FUTURO = vida de hoy − lo que termina + lo que entra, con lo que cambia
//
// 1. BASE: cada ingreso, gasto y deuda con sim !== false, proyectado a los 12
//    meses del año elegido con su frecuencia (un predial anual cae en su mes).
//    Los pagos únicos de este año no se repiten. Los variables entran por su
//    promedio de mes activo. Todo se convierte a COP de una vez.
// 2. CAMBIOS: tres verbos. termina (desde mes X vale 0), cambia (desde mes X
//    vale otro monto), nuevo (entra algo entre mes X y mes Y).
// 3. IMPUESTO: estimarImpuesto sobre el usuario futuro, no copiado del de hoy.
//    Retención proporcional al ingreso de cada mes; impuesto neto parejo.
// 4. VEREDICTO: mes típico = promedio de los meses en que ya aplican todos los
//    cambios. Al lado, el mes típico de hoy. Las 12 barras son clicables para
//    pararse en un mes concreto.
//
// Los datos reales NO se tocan. Los escenarios viven en user.escenarios y se
// guardan con la cuenta.
// ═══════════════════════════════════════════════════════════════════════════
import { tx, esUS, esEN, plata, plataCorta, pct, nombreMes, monedaBase, localeCifras } from "../lib/region.js";
import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "./PageHeader";
import { estimarImpuestoReferente, pagosDeclaracion } from "../lib/impuestoReferente";
import { C, Cα, F, R } from "../lib/designTokens";
import SankeyFlujo from "./SankeyFlujo";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import { snapshotPatrimonio, estimarAmortizacionAnual } from "../lib/proyeccionPatrimonio.js";
import { montoDelMes, promedioMesActivo, getFrecuencia, MESES, getMesActual, rangoEfectivo } from "../lib/flowHelpers.js";
import { cuotaDeudaDelMes, retencionDelMes } from "./SimuladorAvanzado";

// 3-nov-2026: cifras y meses según la región de la sesión (region.js). Colombia
// sale igual que antes; EE. UU. con formato $1,234 / $2.5M y meses en el idioma.
const fm = (n) => plata(n);
const mesL = (m) => (m >= 1 && m <= 12 ? nombreMes(m) : "");
// Mes dentro de una frase: en español va en minúscula ("desde marzo"); en inglés, con mayúscula.
const mesF = (m) => (esEN() ? mesL(m) : mesL(m).toLowerCase());
// Tasa con hasta 2 decimales en el formato del país: 14% · 1,5% (CO) · 1.5% (US).
const fmtTasa = (n) => { if (n === "" || n == null) return ""; const v = Number(n); if (!Number.isFinite(v)) return String(n) + "%"; return v.toLocaleString(localeCifras(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%"; };
// Ejemplo de capital para los campos: CO "Ej: 500000000" (igual que antes); EE. UU. 50000.
const ejCapital = () => tx("Ej: ", "e.g. ") + (esUS() ? "50000" : "500000000");
// Rótulos del Sankey. Colombia en español: null → los de siempre del componente.
const labelsSankey = () => {
  if (esUS()) return {
    retencion: tx("Retención de nómina", "Payroll withholding"), retencionNota: tx("no llega a tu cuenta", "never hits your account"),
    impuesto: tx("Pagos estimados", "Estimated taxes"), impuestoNota: tx("IRS y estado", "IRS & state"),
    aportes: tx("Aportes de retiro", "Retirement contributions"), aportesNota: "401(k), IRA",
    cuotas: tx("Cuotas de deuda", "Debt payments"), cuotasNota: tx("capital + interés", "principal + interest"),
    titulo: tx("¿Por dónde se va tu plata?", "Where your money goes"),
    pie: (monto) => tx(`El ancho de cada cinta es la plata: entran ${monto}.`, `Each ribbon's width is the money: ${monto} coming in.`),
  };
  if (!esEN()) return null;
  return { retencion: "Income tax withheld", retencionNota: "never hits your account", impuesto: "Income tax", impuestoNota: "balance due", aportes: "Mandatory contributions", aportesNota: "health and pension", cuotas: "Debt payments", cuotasNota: "principal + interest", titulo: "Where your money goes", pie: (monto) => `Each ribbon's width is the money: ${monto} coming in.` };
};
const anualMensualTxt = (modo) => (modo === "mensual" ? tx("mensual", "monthly") : tx("anual", "yearly"));
// Frecuencia (clave interna en español) para mostrar.
const FREC_EN = { mensual: "monthly", variable: "variable", anual: "yearly", trimestral: "quarterly", semestral: "every 6 months", unico: "one-time", bimestral: "every 2 months", cuatrimestral: "every 4 months" };
const frecTxt = (f) => tx(f, FREC_EN[f] || f);
// Moneda base: Colombia convierte dólares a pesos con la TRM (como siempre);
// EE. UU. trabaja en dólares y convierte lo que esté en pesos.
const aBase = (moneda, trm) => {
  if (!esUS()) return moneda === "USD" ? trm : 1;
  const t = Number(trm) || 0;
  return String(moneda || "").toUpperCase() === "COP" && t > 1 ? 1 / t : 1;
};
// Cuota de una deuda en un mes, en la moneda base. En EE. UU. no se deja que
// cuotaDeudaDelMes multiplique los dólares por la TRM.
const cuotaMes = (d, cuota, año, mes, trm) => (esUS()
  ? cuotaDeudaDelMes({ ...d, moneda: undefined }, cuota, año, mes, trm) * aBase(d?.moneda, trm)
  : cuotaDeudaDelMes(d, cuota, año, mes, trm));
// Patrimonio y amortización (proyeccionPatrimonio.js) convierten dólares con la
// TRM. En EE. UU. se les pasa todo ya en dólares y sin moneda.
function usuarioEnBase(user = {}) {
  if (!esUS()) return user;
  const t = Number(user?.trm) || 0;
  const k = (x) => (String(x?.moneda || "").toUpperCase() === "COP" && t > 1 ? 1 / t : 1);
  const inv = (user.inv || []).map((i) => ({ ...i, moneda: undefined, va: (Number(i.va) || 0) * k(i), vc: (Number(i.vc) || 0) * k(i) }));
  const deudas = (user.deudas || []).map((d) => ({ ...d, moneda: undefined, mt: (Number(d.mt) || 0) * k(d), pg: (Number(d.pg) || 0) * k(d), pago: d.pago != null ? (Number(d.pago) || 0) * k(d) : d.pago }));
  return { ...user, inv, deudas };
}
// Renta mensual que sale de un capital y una tasa (anual o mensual).
const rentaDe = (cap, tasa, modo) => { const c = Number(cap) || 0, t = Number(tasa) || 0; return c > 0 && t > 0 ? Math.round(modo === "mensual" ? c * t / 100 : c * t / 100 / 12) : 0; };
// Formato corto para las barras: $12,3 M · $850 K
const fmC = (n) => plataCorta(n);
const uid = () => "c_" + Math.random().toString(36).slice(2, 9);

const CATS_ING = ["Salario", "Honorarios", "Arriendo", "Dividendos", "Intereses bancarios", "Rendimiento", "Pensión", "Negocio", "Otro"];
// Las categorías se guardan con su clave en español (el motor de impuestos de cada
// país las lee así); solo cambia lo que se muestra.
const CAT_ING_EN = { "Salario": "Salary (W-2)", "Honorarios": "Freelance (1099)", "Arriendo": "Rent", "Dividendos": "Dividends", "Intereses bancarios": "Bank interest", "Rendimiento": "Investment return", "Pensión": "Pension / Social Security", "Negocio": "Business", "Otro": "Other" };
const CAT_ING_US_ES = { "Salario": "Salario (W-2)", "Honorarios": "Freelance (1099)", "Pensión": "Pensión / Seguro Social" };
const catTxt = (c) => (esEN() ? CAT_ING_EN[c] || c : esUS() ? CAT_ING_US_ES[c] || c : c);
const FISCAL_ING = {
  "Salario": "LAB_SALARIO", "Honorarios": "LAB_HONORARIOS_SIN_EMPLEADOS", "Arriendo": "NOL_ARRIENDO_INMUEBLE",
  "Dividendos": "DIV_ART49_GRAVADOS", "Intereses bancarios": "CAP_INTERESES_BANCARIOS",
  "Rendimiento": "CAP_RENDIMIENTO_GENERICO", "Pensión": "PEN_JUBILACION", "Negocio": "NOL_NEGOCIO", "Otro": "NOL_OTROS",
};

// ─── Base: la vida de hoy, por ítem ────────────────────────────────────────
// Cada entrada: { key, kind: "ing"|"gas"|"deu", nombre, cat, montoTipico, porMes(año) → [12] COP }
// 9-oct-2026 (Santiago: "carga ítems que ni siquiera tengo activados"). Lo que
// termina antes de diciembre de este año NO continúa el año entrante: "RENTA
// HASTA SEPT" o un crédito que acaba en noviembre son cosas que se acabaron,
// no cosas que se repiten cada año. Quedan listadas aparte con un botón "sí
// continúa" por si el usuario sabe que siguen. Lo que empieza a mitad de año,
// el año entrante va completo.
// 28-oct-2026 — Claves estables por ítem (id, o nombre normalizado + número si se repite). Antes era la
// posición en la lista (`gas_Vivienda_3`): al borrar o reordenar un gasto, los ajustes de un escenario
// caían en OTRO ítem. `oldKey` guarda la clave vieja para migrar escenarios guardados.
const normK = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function construirBase(user) {
  const trm = user?.trm || 4200;
  const out = [];
  const vistos = {};
  const claveEstable = (pref, item, nombre) => {
    if (item && item.id) return `${pref}:id:${item.id}`;
    const b = `${pref}:${normK(nombre)}`;
    vistos[b] = (vistos[b] || 0) + 1;
    return vistos[b] > 1 ? `${b}#${vistos[b]}` : b;
  };
  // 10-oct-2026: un variable sin montos en los meses que FALTAN del año no
  // "terminó" (district: montos hasta octubre porque nov y dic no han
  // pasado). Solo cuenta como terminado si su último monto es anterior al
  // mes actual. Los periódicos siguen la vigencia declarada.
  const mesHoy = getMesActual().mes;
  const vig = (item) => {
    const r = rangoEfectivo(item);
    const esVariable = getFrecuencia(item) === "variable";
    // 28-oct-2026 (Santiago: "no veo los salarios de los mayordomos ni la administración de Óscar").
    // Un variable con monto hasta el mes pasado sigue vivo: el mes en curso aún no se ha cargado.
    const termina = esVariable ? (r.hasta < Math.min(mesHoy, 12) - 1) : (r.hasta < 12);
    return { ...r, termina };
  };
  // 28-oct-2026 (Santiago: "deberían aparecer así sea apagados y uno los activa"). Lo apagado en el
  // simulador también aparece, sin contar, para poder llevarlo al año entrante con un toque.
  const vigA = (item) => item.sim === false ? { ...vig(item), termina: true, apagado: true } : vig(item);
  (user.ingresos || []).forEach((i, idx) => {
    const fx = aBase(i.moneda, trm);
    const v = vigA(i);
    out.push({
      key: claveEstable("ing", i, i.nombre || i.fuente), oldKey: `ing_${idx}`, kind: "ing", ref: i, vig: v,
      nombre: i.nombre || i.fuente || tx("Ingreso", "Income"), cat: i.categoria || "",
      capital: Number(i.capital) || 0, tasa: Number(i.tasa) || 0, tasaModo: i.tasaModo || "anual",
      montoTipico: (getFrecuencia(i) === "variable" ? supuestoVariable(i).monto : promedioMesActivo(i)) * fx,
      supuesto: getFrecuencia(i) === "variable" ? supuestoVariable(i).texto : (getFrecuencia(i) === "mensual" ? "" : tx(`${getFrecuencia(i)} · cae en su mes`, `${frecTxt(getFrecuencia(i))} · falls in its month`)),
      porMes: (año) => proyectarPorMes(i, año, fx),
      porMesReal: (año) => MESES.map((m) => (montoDelMes(i, año, m.v) || 0) * fx),
    });
  });
  Object.entries(user.gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g, idx) => {
      const fx = aBase(g.moneda, trm);
      const v = vigA(g);
      out.push({
        key: claveEstable(`gas:${cat}`, g, g.c), oldKey: `gas_${cat}_${idx}`, kind: "gas", ref: g, vig: v,
        nombre: g.c || tx("Gasto", "Expense"), cat,
        montoTipico: (getFrecuencia(g) === "variable" ? supuestoVariable(g).monto : promedioMesActivo(g)) * fx,
        supuesto: getFrecuencia(g) === "variable" ? supuestoVariable(g).texto : (getFrecuencia(g) === "mensual" ? "" : tx(`${getFrecuencia(g)} · cae en su mes`, `${frecTxt(getFrecuencia(g))} · falls in its month`)),
        porMes: (año) => proyectarPorMes(g, año, fx),
        porMesReal: (año) => MESES.map((m) => (montoDelMes(g, año, m.v) || 0) * fx),
      });
    });
  });
  (user.deudas || []).forEach((d, idx) => {
    if ((d.mt || 0) <= 0) return;
    const cuota = d.pago || d.pg || 0;
    const hasta = Number(d.hastaMes) || 12;
    const v = d.sim === false ? { desde: Number(d.desdeMes) || 1, hasta, termina: true, apagado: true } : { desde: Number(d.desdeMes) || 1, hasta, termina: hasta < 12 };
    const dFull = { ...d, desdeMes: 1, hastaMes: 12 };
    out.push({
      key: claveEstable("deu", d, d.n || d.nombre), oldKey: `deu_${idx}`, kind: "deu", ref: d, vig: v,
      nombre: d.n || d.nombre || tx("Deuda", "Debt"), cat: d.tipo || "",
      montoTipico: cuotaMes(dFull, cuota, getMesActual().año, 1, trm) || cuota * aBase(d.moneda, trm),
      porMes: (año) => MESES.map((m) => cuotaMes(dFull, cuota, año, m.v, trm)),
      porMesReal: (año) => MESES.map((m) => cuotaMes(d, cuota, año, m.v, trm)),
    });
  });
  return out;
}


// 11-oct-2026: como se lleva un VARIABLE al ano siguiente. Antes: promedio de
// mes activo, plano los 12 meses. Con RENTA TRADICIONAL (78, 39, 39 en
// sep-nov) daba 52M/mes; con BROOKFORT (4 pagos sueltos, 35M en el ano) daba
// 8,7M/mes. Regla: si viene desde comienzo de ano (primer monto en ene-mar),
// su total anual repartido en 12; si empezo despues, la mediana de los meses
// con monto (resiste un pago doble). El texto se muestra en la fila.
function supuestoVariable(item) {
  const montos = (Array.isArray(item?.montosMensuales) ? item.montosMensuales : []).map((v) => Number(v) || 0);
  const conMonto = montos.map((v, i) => ({ v, mes: i + 1 })).filter((x) => x.v > 0);
  if (!conMonto.length) return { monto: 0, texto: tx("sin montos este año", "no amounts this year") };
  const primero = conMonto[0].mes;
  if (primero <= 3) {
    const total = montos.reduce((a, v) => a + v, 0);
    return { monto: total / 12, texto: tx(`${fm(total)} de este año repartidos en 12`, `${fm(total)} from this year spread over 12 months`) };
  }
  const vals = conMonto.map((x) => x.v).sort((a, b) => a - b);
  const med = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
  // 28-oct-2026 (Santiago: "son ingresos de todo 2027, ¿por qué dice desde septiembre si no di esa instrucción?").
  // El cálculo ya cuenta los 12 meses; el texto daba a entender que empezaba en septiembre. Ahora dice de dónde
  // sale el valor: lo que recibes desde ese mes de ESTE año.
  return { monto: med, texto: tx(`todo el año · valor típico de lo que recibes desde ${mesL(primero).toLowerCase()} de este año (${conMonto.length} ${conMonto.length === 1 ? "mes" : "meses"})`, `whole year · typical amount you've received since ${mesL(primero)} this year (${conMonto.length} ${conMonto.length === 1 ? "month" : "months"})`) };
}

// Un ítem de hoy, en cada mes del año futuro. "unico" no se repite; "variable"
// entra plano por su promedio de mes activo (no sabemos cómo se repartirá).
export function proyectarPorMes(item, año, fx) {
  const f = getFrecuencia(item);
  if (f === "unico") return MESES.map(() => 0);
  if (f === "variable") {
    return MESES.map(() => supuestoVariable(item).monto * fx);
  }
  // Frecuencias periódicas: montoDelMes respeta mesPago y vigencia, pero mira
  // el flag "pagado" del año — en el futuro nada está pagado, así que se limpia.
  // Año completo: lo que empezó a mitad de este año, el entrante va entero.
  const limpio = { ...item, pagados: undefined, pagado: undefined, desdeMes: 1, hastaMes: 12 };
  return MESES.map((m) => (montoDelMes(limpio, año, m.v) || 0) * fx);
}

// ─── Aplicar cambios → 12 meses por ítem (base + nuevos) ───────────────────
export function aplicarCambios(base, cambios, año, incluidos) {
  const continuan = new Set(cambios.filter((c) => c.tipo === "continua").map((c) => c.ref));
  // 28-oct-2026: cada escenario tiene sus propios interruptores (`incluidos`); sin ellos, regla de antes.
  const filas = base
    .filter((b) => (incluidos ? incluidos.has(b.key) : (!b.vig?.termina || continuan.has(b.key))))
    .map((b) => ({ ...b, meses: b.porMes(año), origen: "hoy", continua: b.vig?.termina ? cambios.find((c) => c.tipo === "continua" && c.ref === b.key) : null }));
  cambios.forEach((c) => {
    if (c.tipo === "nuevo") {
      const desde = Number(c.desdeMes) || 1, hasta = Number(c.hastaMes) || 12;
      filas.push({
        key: c.id, kind: c.kind, nombre: c.nombre || tx("Nuevo", "New"), cat: c.cat || "",
        capital: Number(c.capital) || 0, tasa: Number(c.tasa) || 0, tasaModo: c.tasaModo || "anual",
        montoTipico: Number(c.monto) || 0, origen: "nuevo", cambio: c,
        meses: MESES.map((m) => (m.v >= desde && m.v <= hasta ? Number(c.monto) || 0 : 0)),
      });
      return;
    }
    const fila = filas.find((f) => f.key === c.ref);
    if (!fila) return;
    const desde = Number(c.desdeMes) || 1;
    if (c.tipo === "termina") {
      fila.meses = fila.meses.map((v, i) => (i + 1 >= desde ? 0 : v));
      fila.cambio = c; fila.origen = "termina";
    } else if (c.tipo === "meses") {
      // 28-oct-2026 (Santiago: "uno debería poder marcar si es todo el año o unos meses").
      const hasta = Number(c.hastaMes) || 12;
      fila.meses = fila.meses.map((v, i) => (i + 1 >= desde && i + 1 <= hasta ? v : 0));
      fila.cambio = c; fila.origen = "meses";
    } else if (c.tipo === "cambia") {
      fila.meses = fila.meses.map((v, i) => (i + 1 >= desde ? Number(c.monto) || 0 : v));
      fila.cambio = c; fila.origen = "cambia";
      if (c.modo === "capital" && Number(c.capital) > 0) { fila.capital = Number(c.capital); fila.tasa = Number(c.tasa) || 0; fila.tasaModo = c.tasaModo || "anual"; }
    }
  });
  return filas;
}

// ─── Usuario sintético para el motor tributario ────────────────────────────
// Cada fila se vuelve un ítem "variable" con sus 12 montos en COP, que es la
// forma que el motor ya entiende (totalAnualItem suma los 12).
export function usuarioFuturo(user, filas) {
  // 11-oct-2026: un item sin propietario ("" o "na") NO se le asigna a nadie.
  // BTG PACTUAL (owner "") caia en Sosa como persona natural y tributaba
  // $1.470M/ano al 39%: impuesto 28,6M/mes cuando el simulador normal da 0.
  // Solo los NUEVOS sin eleccion toman el primer propietario.
  const owner0 = (user.owners || [])[0]?.id || "own_1";
  const dueño = (base, f) => (base.owner !== undefined ? base.owner : (f.cambio?.owner || owner0));
  const ing = [], gas = {}, deu = [];
  filas.forEach((f) => {
    const avg = f.meses.reduce((s, v) => s + v, 0) / 12;
    const base = f.ref || {};
    // Las filas ya están en la moneda base del país (pesos en Colombia, dólares en EE. UU.).
    const comun = { frecuencia: "variable", montosMensuales: f.meses, moneda: monedaBase(), sim: true, desdeMes: 1, hastaMes: 12 };
    if (f.kind === "ing") {
      ing.push({ ...base, ...comun, nombre: f.nombre, mensual: avg, capital: f.capital || base.capital, tasa: f.tasa || base.tasa,
        categoria: base.categoria || f.cat || "Otro",
        fiscalCode: base.fiscalCode || FISCAL_ING[f.cat] || "NOL_OTROS",
        owner: dueño(base, f) });
    } else if (f.kind === "gas") {
      const cat = f.cat || "Otros";
      gas[cat] = gas[cat] || [];
      gas[cat].push({ ...base, ...comun, c: f.nombre, m: avg, cat, owner: dueño(base, f) });
    } else {
      deu.push({ ...base, ...comun, n: f.nombre, pago: avg, pg: avg, mt: base.mt || Number(f.cambio?.saldo) || avg * 12,
        owner: dueño(base, f) });
    }
  });
  // taxConfig: estado civil y estado de residencia (EE. UU.); el motor de EE. UU. lo necesita.
  return { owners: user.owners || [], ingresos: ing, gas, deu, inv: user.inv || [], trm: user.trm || 4200, taxConfig: user.taxConfig, _calRef: user._calRef, _calRefHoy: user._calRefHoy };
}

export function impuestoAnual(u) {
  const t = estimarImpuestoReferente(u, u._calRef || {});
  let bruto = 0, rete = 0;
  (t.detalle || []).forEach((d) => {
    bruto += d.impBruto != null ? d.impBruto : (d.impuesto || 0);
    rete += d.reteN || 0;
  });
  return { bruto, rete, neto: Math.max(0, bruto - rete), detalle: t.detalle || [] };
}

// ─── Cuadro de un mes (o de un promedio de meses) ──────────────────────────
// 29-oct-2026 (Santiago: "la declaración de renta no se paga mensual, se paga en un solo mes").
// pagoMes[12]: lo que sale por la declaración del año anterior en cada mes. Un mes concreto
// lo lleva completo; el «mes típico» no (es un pago de una vez y se muestra aparte).
export function cuadro(filas, mesesIdx, imp, pagoMes) {
  const n = mesesIdx.length || 1;
  const suma = (kind) => filas.filter((f) => f.kind === kind).reduce((s, f) => s + mesesIdx.reduce((a, i) => a + (f.meses[i] || 0), 0), 0) / n;
  const ingresos = suma("ing"), gastos = suma("gas"), cuotas = suma("deu");
  const brutoAnual = filas.filter((f) => f.kind === "ing").reduce((s, f) => s + f.meses.reduce((a, v) => a + v, 0), 0);
  const retencion = retencionDelMes(ingresos, brutoAnual / 12, imp.rete / 12);
  // 3-nov-2026 — EE. UU.: los pagos estimados son 4 al año, todos los años: en el mes
  // típico se prorratean (sin ellos el mes típico se vería mejor de lo que es).
  // En Colombia la declaración es un pago de una vez y no entra al mes típico.
  const impuesto = pagoMes ? (mesesIdx.length === 1 ? pagoMes[mesesIdx[0]] || 0 : (esUS() ? pagoMes.reduce((a, v) => a + (v || 0), 0) / 12 : 0)) : imp.neto / 12;
  const egresos = gastos + cuotas + impuesto;
  const queda = ingresos - retencion - egresos;
  return { ingresos, retencion, gastos, cuotas, impuesto, egresos, queda };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function SimuladorFuturo({ user, escenarios = [], onUpdate, onNavigate }) {
  const añoHoy = getMesActual().año;
  const [selId, setSelId] = useState(escenarios[0]?.id || null);
  const [mesFoco, setMesFoco] = useState(null); // null = mes típico
  const [mesHover, setMesHover] = useState(null);
  const [form, setForm] = useState(null);       // formulario de cambio abierto


  const esc = escenarios.find((e) => e.id === selId) || null;
  const año = esc?.año || añoHoy + 1;
  const cambiosRaw = esc?.cambios || [];

  // La tira fija solo aparece cuando el veredicto salió de la vista (al editar abajo).
  const veredictoRef = useRef(null);
  const [veredictoVisible, setVeredictoVisible] = useState(true);
  useEffect(() => {
    const el = veredictoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVeredictoVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [esc?.id]);

  const guardar = (lista) => onUpdate && onUpdate(lista);
  const actualizar = (patch) => guardar(escenarios.map((e) => (e.id === selId ? { ...e, ...patch } : e)));
  const nuevoEscenario = () => {
    const b0 = construirBase(user);
    const e = { id: uid(), nombre: tx(`Mi ${añoHoy + 1}`, `My ${añoHoy + 1}`), año: añoHoy + 1, cambios: [], activos: Object.fromEntries(b0.map((b) => [b.key, !b.vig?.termina])), conocidos: b0.map((b) => b.key), creado: new Date().toISOString() };
    guardar([...escenarios, e]); setSelId(e.id); setMesFoco(null);
  };
  const borrarEscenario = () => {
    if (!esc || !window.confirm(tx(`¿Borrar el escenario "${esc.nombre}"?`, `Delete the scenario "${esc.nombre}"?`))) return;
    const resto = escenarios.filter((e) => e.id !== selId);
    guardar(resto); setSelId(resto[0]?.id || null);
  };

  const base = useMemo(() => construirBase(user), [user]);
  // Escenarios guardados con claves viejas (posición) → claves estables.
  const mapaViejo = useMemo(() => { const m = {}; base.forEach((b) => { if (b.oldKey) m[b.oldKey] = b.key; }); return m; }, [base]);
  const cambios = useMemo(() => cambiosRaw.map((c) => (c.ref && mapaViejo[c.ref] && !base.some((b) => b.key === c.ref) ? { ...c, ref: mapaViejo[c.ref] } : c)), [cambiosRaw, mapaViejo, base]);
  // ═══ 28-oct-2026 (Santiago: "si apago y prendo un gasto en las secciones también desaparece del año
  // futuro… ¿qué pasa si quiero proyectar un futuro diferente?"). Cada escenario tiene sus interruptores:
  //   esc.activos[key] = true/false → decisión del usuario en ESTE escenario (manda sobre todo)
  //   esc.conocidos = claves que existían al crear el escenario → lo que aparezca después en tus datos
  //   no se cuela solo: queda en «Nuevos en tus datos de hoy» hasta que decidas.
  const activos = esc?.activos || {};
  const conocidos = esc?.conocidos ? new Set(esc.conocidos) : null;
  const esNuevoHoy = (b) => !!conocidos && !conocidos.has(b.key) && !(b.oldKey && conocidos.has(b.oldKey)) && activos[b.key] === undefined;
  const incluido = (b) => {
    if (activos[b.key] !== undefined) return !!activos[b.key];
    if (cambios.some((c) => c.tipo === "continua" && c.ref === b.key)) return true;
    if (esNuevoHoy(b)) return false;
    return !b.vig?.termina;
  };
  const incluidosSet = useMemo(() => new Set(base.filter(incluido).map((b) => b.key)), [base, esc]);
  const filas = useMemo(() => aplicarCambios(base, cambios, año, incluidosSet), [base, cambios, año, incluidosSet]);
  const nuevosHoy = base.filter(esNuevoHoy);
  const excluidos = base.filter((b) => !incluidosSet.has(b.key) && !esNuevoHoy(b));
  // Al primer toque se guarda la foto completa (qué cuenta y qué no): desde ahí, apagar algo en el
  // simulador o en Egresos ya no mueve este escenario.
  const setActivo = (keys, val) => {
    const foto = Object.fromEntries(base.filter((b) => !esNuevoHoy(b)).map((b) => [b.key, incluido(b)]));
    actualizar({ activos: { ...foto, ...activos, ...Object.fromEntries(keys.map((k) => [k, val])) }, conocidos: [...new Set([...(esc?.conocidos || base.map((b) => b.key)), ...keys])], cambios });
  };
  // Escenario viejo sin «conocidos»: no se escribe nada al abrirlo; la foto de hoy se guarda con el
  // primer interruptor que toques (setActivo), y los ajustes migrados se guardan con el siguiente cambio.
  const impFut = useMemo(() => impuestoAnual(usuarioFuturo(user, filas)), [user, filas]);

  // Hoy: la misma base, en el año en curso, con el impuesto de hoy.
  // 11-oct-2026 (Santiago: "de dónde me gasto yo hoy 115M, no me da"). "Hoy"
  // usaba la proyección a 12 meses completos: las pensiones que en 2026 corren
  // oct–dic contaban como todo el año. Ahora es 2026 tal como fue.
  const filasHoy = useMemo(() => base.filter((b) => !b.vig?.apagado).map((b) => ({ ...b, meses: b.porMesReal(añoHoy), origen: "hoy" })), [base, añoHoy]);
  const impHoy = useMemo(() => impuestoAnual(usuarioFuturo(user, filasHoy)), [user, filasHoy]);
  // Renta que se paga de un golpe: en el año simulado, la de año−1 (Calculadora de declaración);
  // hoy, la de la declaración del año pasado. Por titular (persona natural y sociedades).
  // EE. UU. (3-nov-2026): lo que no retiene la nómina se paga en 4 pagos estimados
  // del MISMO año (Form 1040-ES), así que sale del impuesto del escenario, no del de hoy.
  const pagoFut = useMemo(() => (esUS()
    ? pagosDeclaracion(user.owners, {}, impFut.detalle, año)
    : pagosDeclaracion(user.owners, user._calRef || {}, impHoy.detalle, año - 1)), [user, impHoy, impFut, año]);
  const pagoHoy = useMemo(() => pagosDeclaracion(user.owners, user._calRefHoy || {}, impHoy.detalle, añoHoy - 1), [user, impHoy, añoHoy]);
  const hoy = useMemo(() => cuadro(filasHoy, MESES.map((_, i) => i), impHoy, pagoHoy.porMes), [filasHoy, impHoy, pagoHoy]);
  const porMesHoy = useMemo(() => MESES.map((_, i) => cuadro(filasHoy, [i], impHoy, pagoHoy.porMes)), [filasHoy, impHoy, pagoHoy]);

  // Mes típico futuro: desde el último cambio hasta diciembre.
  const mesRegimen = cambios.reduce((m, c) => Math.max(m, Number(c.desdeMes) || 1), 1);
  const idxRegimen = MESES.map((_, i) => i).filter((i) => i + 1 >= mesRegimen);
  const tipico = useMemo(() => cuadro(filas, idxRegimen, impFut, pagoFut.porMes), [filas, idxRegimen.join(","), impFut, pagoFut]);
  const porMes = useMemo(() => MESES.map((m, i) => ({ mes: m.v, ...cuadro(filas, [i], impFut, pagoFut.porMes) })), [filas, impFut, pagoFut]);
  const foco = mesFoco ? porMes[mesFoco - 1] : null;
  const vista = foco || tipico;
  const maxAbs = Math.max(1, ...porMes.map((m) => Math.abs(m.queda)));
  const maxBar = Math.max(1, ...porMes.map((m) => Math.max(m.ingresos, m.egresos + m.retencion)));
  // Qué pasa en cada mes: lo que entra, termina o cambia justo ahí.
  const eventosMes = useMemo(() => {
    const ev = MESES.map(() => []);
    const nombreDe = (c) => c.tipo === "nuevo" ? (c.nombre || tx("Nuevo", "New")) : (filas.find((f) => f.key === c.ref)?.nombre || base.find((b) => b.key === c.ref)?.nombre || "—");
    cambios.forEach((c) => {
      const d = Number(c.desdeMes) || 1;
      if (c.tipo === "nuevo") {
        if (d >= 1 && d <= 12) ev[d - 1].push({ tipo: "entra", texto: tx(`entra ${nombreDe(c)} (${fm(c.monto)}/mes)`, `${nombreDe(c)} starts (${fm(c.monto)}/mo)`) });
        const h = Number(c.hastaMes) || 12;
        if (h < 12) ev[h].push({ tipo: "sale", texto: tx(`termina ${nombreDe(c)}`, `${nombreDe(c)} ends`) });
      } else if (c.tipo === "meses") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "entra", texto: tx(`arranca ${nombreDe(c)}`, `${nombreDe(c)} starts`) });
        const h = Number(c.hastaMes) || 12;
        if (h < 12) ev[h].push({ tipo: "sale", texto: tx(`termina ${nombreDe(c)}`, `${nombreDe(c)} ends`) });
      } else if (c.tipo === "termina") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "sale", texto: tx(`termina ${nombreDe(c)}`, `${nombreDe(c)} ends`) });
      } else if (c.tipo === "cambia") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "cambia", texto: tx(`${nombreDe(c)} pasa a ${fm(c.monto)}/mes`, `${nombreDe(c)} changes to ${fm(c.monto)}/mo`) });
      }
    });
    // Ítems de hoy que se agotan dentro del año (créditos que se pagan, contratos que acaban)
    // y pagos de una sola vez, agrupados para no hacer ruido.
    const tocado = new Set(cambios.flatMap((c) => [c.ref, c.id]));
    const unaVez = MESES.map(() => []);
    filas.forEach((f) => {
      if (tocado.has(f.key)) return;
      const ms = f.meses || [];
      const activos = ms.filter((v) => v > 0).length;
      if (activos === 0) return;
      if (activos === 1) { unaVez[ms.findIndex((v) => v > 0)].push(f); return; }
      for (let i = 1; i < 12; i++) {
        if (ms[i - 1] > 0 && !(ms[i] > 0)) ev[i].push({ tipo: "sale", texto: tx(`${f.nombre} ya no cuenta (${f.kind === "deu" ? "crédito pagado" : "termina"})`, `${f.nombre} no longer counts (${f.kind === "deu" ? "loan paid off" : "ends"})`) });
        if (!(ms[i - 1] > 0) && ms[i] > 0) ev[i].push({ tipo: "entra", texto: tx(`arranca ${f.nombre} (${fm(ms[i])}/mes)`, `${f.nombre} starts (${fm(ms[i])}/mo)`) });
      }
    });
    unaVez.forEach((lista, i) => {
      if (!lista.length) return;
      const tot = lista.reduce((a, f) => a + (f.meses[i] || 0), 0);
      ev[i].push({ tipo: "cambia", texto: tx(`${lista.length === 1 ? "pago de una vez" : lista.length + " pagos de una vez"} (${fm(tot)}): ${lista.map((f) => f.nombre).join(", ")}`, `${lista.length === 1 ? "one-time payment" : lista.length + " one-time payments"} (${fm(tot)}): ${lista.map((f) => f.nombre).join(", ")}`) });
    });
    return ev;
  }, [cambios, filas, base]);
  // Acumulado del año y curva de patrimonio (12-oct-2026, Santiago: "ver el
  // acumulado de ingresos, saldo a favor y gastos por año, y la curva de
  // crecimiento del patrimonio con ese sobrante o pérdida cada mes").
  const anual = useMemo(() => {
    const sum = (k) => porMes.reduce((a, m) => a + m[k], 0);
    return { ingresos: sum("ingresos"), gastos: sum("gastos"), cuotas: sum("cuotas"), impuestos: sum("impuesto") + sum("retencion"), ret: sum("retencion"), decl: sum("impuesto"), queda: sum("queda"), positivos: porMes.filter((m) => m.queda >= 0).length };
  }, [porMes]);
  const anualHoy = useMemo(() => {
    const sum = (k) => porMesHoy.reduce((a, m) => a + m[k], 0);
    return { ingresos: sum("ingresos"), gastos: sum("gastos"), cuotas: sum("cuotas"), impuestos: sum("impuesto") + sum("retencion"), ret: sum("retencion"), decl: sum("impuesto"), queda: sum("queda") };
  }, [porMesHoy]);
  const snap = useMemo(() => snapshotPatrimonio(usuarioEnBase(user)), [user]);
  const amortMes = useMemo(() => estimarAmortizacionAnual(usuarioEnBase(user).deudas, user.trm) / 12, [user]);
  const curvaPat = useMemo(() => {
    let pat = snap.patrimonioNeto, acum = 0;
    const pts = [{ m: tx("Hoy", "Today"), pat, queda: 0, amort: 0, acum: 0 }];
    porMes.forEach((m) => {
      const amort = Math.min(amortMes, Math.max(0, m.cuotas)); // si ya no hay cuotas, no baja deuda
      pat += m.queda + amort; acum += m.queda;
      pts.push({ m: mesL(m.mes).slice(0, 3), pat: Math.round(pat), queda: Math.round(m.queda), amort: Math.round(amort), acum: Math.round(acum) });
    });
    return pts;
  }, [porMes, snap, amortMes]);
  const patFin = curvaPat[curvaPat.length - 1].pat;
  const mesesIguales = porMes.every((m) => Math.abs(m.queda - porMes[0].queda) < 1 && Math.abs(m.ingresos - porMes[0].ingresos) < 1);

  // ─── Cambios: alta / baja ─────────────────────────────────────────────
  const agregarCambio = (c) => { actualizar({ cambios: [...cambios, { id: uid(), ...c }] }); setForm(null); };
  const quitarCambio = (id) => actualizar({ cambios: cambios.filter((c) => c.id !== id) });

  const owners = user.owners || [];
  const kindL = { ing: tx("ingreso", "income"), gas: tx("gasto", "expense"), deu: tx("deuda", "debt") };
  // Plural del grupo ("ingresos · 4"). En español es kindL + "s", como antes.
  const kindPl = { ing: tx("ingresos", "income"), gas: tx("gastos", "expenses"), deu: tx("deudas", "debts") };
  const colorK = { ing: C.ok, gas: C.danger, deu: C.warn };

  // ─── UI ───────────────────────────────────────────────────────────────
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 18, marginBottom: 16 };
  const input = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const btn = (primary) => ({ background: primary ? C.accent : C.raised, color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.accent : C.border}`, borderRadius: R.md, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const Celda = ({ etiqueta, valor, color, tenue }) => (
    <div style={{ minWidth: 110 }}>
      <div style={F.label}>{etiqueta}</div>
      <div style={{ ...F.mono, color, opacity: tenue ? 0.85 : 1 }}>{fm(valor)}</div>
    </div>
  );

  // Fila individual de la base (ingreso, gasto o deuda), reutilizada por categoría.
  const Interruptor = ({ on, onClick, titulo }) => (
    <button type="button" onClick={onClick} title={titulo} aria-pressed={on}
      style={{ width: 34, height: 20, borderRadius: 999, border: "none", cursor: "pointer", padding: 2, flexShrink: 0, background: on ? C.ok : C.border, display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "all .15s" }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", display: "block" }} />
    </button>
  );
  const motivoExcluido = (f) => activos[f.key] === false ? tx(`apagado en este escenario`, "turned off in this scenario")
    : f.vig?.apagado ? tx("apagado en el simulador de hoy · tócalo para contarlo en " + año, `turned off in today's simulator · tap it to count it in ${año}`)
    : f.vig?.termina ? tx(`terminó en ${mesL(f.vig.hasta).toLowerCase()} de ${añoHoy} · tócalo si sigue en ${año}`, `ended in ${mesL(f.vig.hasta)} ${añoHoy} · tap it if it continues in ${año}`) : tx("no cuenta", "doesn't count");
  const renderFila = (f) => { const k = f.kind;
                  if (f.excluido) return (
                    <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, opacity: 0.55, flexWrap: "wrap" }}>
                      <Interruptor on={false} onClick={() => setActivo([f.key], true)} titulo={tx(`Contar en ${año}`, `Count in ${año}`)} />
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "line-through" }}>{f.nombre} <span style={F.caption}>· {catTxt(f.cat)}</span></div>
                        <div style={F.caption}>{motivoExcluido(f)}</div>
                      </div>
                      <div style={{ ...F.mono, color: C.muted, whiteSpace: "nowrap" }}>{fm(f.montoTipico)}{tx("/mes", "/mo")}</div>
                    </div>
                  );
                  const anual = f.meses.reduce((s, v) => s + v, 0);
                  const c = f.cambio;
                  const editando = form && form.tipo !== "nuevo" && form.ref === f.key;
                  const estado = !c ? null
                    : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? tx("no cuenta en todo el año", "doesn't count all year") : tx(`cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`, `counts through ${mesL(Number(c.desdeMes) - 1)}, then ends`))
                    : c.tipo === "meses" ? tx(`cuenta solo de ${mesL(Number(c.desdeMes) || 1).toLowerCase()} a ${mesL(Number(c.hastaMes) || 12).toLowerCase()} de ${año}`, `counts only ${mesL(Number(c.desdeMes) || 1)} to ${mesL(Number(c.hastaMes) || 12)} ${año}`)
                    : c.tipo === "cambia" ? `${tx(`pasa a ${fm(c.monto)}/mes desde ${mesL(c.desdeMes).toLowerCase()}`, `changes to ${fm(c.monto)}/mo from ${mesL(c.desdeMes)}`)}${c.modo === "capital" && rentaDe(c.capital, c.tasa, c.tasaModo) > 0 ? ` (${fm(Number(c.capital))} × ${fmtTasa(c.tasa)} ${anualMensualTxt(c.tasaModo)})` : ""}`
                    : c.tipo === "continua" ? tx(`sigue en ${año}`, `continues in ${año}`) : "";
                  return (
                    <div key={f.key} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, background: editando ? Cα.accent08 : "transparent", borderRadius: editando ? R.md : 0, paddingLeft: editando ? 8 : 0, paddingRight: editando ? 8 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {f.origen !== "nuevo" && <Interruptor on onClick={() => setActivo([f.key], false)} titulo={tx(`No contar en ${año}`, `Don't count in ${año}`)} />}
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre} <span style={F.caption}>· {catTxt(f.cat)}</span></div>
                          {/* 11-oct-2026 (Santiago: "¿cuánto es entonces mi arriendo?").
                              Con un cambio aplicado, primero el valor que rige en el año
                              futuro; el supuesto anterior, tachado y en pequeño. */}
                          {c && c.tipo !== "continua" ? (
                            <div style={F.caption}>
                              {/* 21-oct-2026 (Santiago: "no vemos el capital de esa inversión").
                                  Con cambio aplicado también se ve el capital: el del cambio si
                                  se cambió por capital × tasa; si no, el del ítem con la tasa
                                  implícita del nuevo monto. */}
                              {(() => {
                                const capC = c.tipo === "cambia" && c.modo === "capital" && Number(c.capital) > 0 ? Number(c.capital) : 0;
                                const cap = capC || Number(f.capital) || 0;
                                if (!(cap > 0)) return null;
                                const mensual = anual / 12;
                                const tasaImpl = cap > 0 && mensual > 0 ? (mensual * 12 / cap) * 100 : 0;
                                const tasaTxt = capC ? `${fmtTasa(c.tasa)} ${anualMensualTxt(c.tasaModo)}` : tx(`${fmtTasa(tasaImpl)} anual implícito`, `${fmtTasa(tasaImpl)} implied yearly`);
                                return <>Capital <b style={{ color: C.text }}>{fm(cap)}</b> × {tasaTxt} → </>;
                              })()}
                              <b style={{ color: C.text }}>{tx(`${fm(anual / 12)}/mes en ${año}`, `${fm(anual / 12)}/mo in ${año}`)}</b> · {tx(`${fm(anual)} en el año`, `${fm(anual)} for the year`)}
                              <span style={{ marginLeft: 8, textDecoration: "line-through", opacity: 0.7 }}>{tx(`antes ${fm(f.montoTipico)}/mes`, `was ${fm(f.montoTipico)}/mo`)}</span>
                            </div>
                          ) : (
                            <div style={F.caption}>
                              {f.capital > 0 && f.tasa > 0 ? <>Capital <b style={{ color: C.text }}>{fm(f.capital)}</b> × {fmtTasa(f.tasa)} {anualMensualTxt(f.tasaModo)} → </> : ""}
                              {tx(`${fm(f.montoTipico)}/mes · ${fm(anual)} en ${año}`, `${fm(f.montoTipico)}/mo · ${fm(anual)} in ${año}`)}{f.supuesto ? ` · ${f.supuesto}` : (f.meses.every((v) => v > 0) ? tx(" · todo el año", " · all year") : "")}
                            </div>
                          )}
                          {estado && (
                            <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8, padding: "2px 10px", borderRadius: R.pill, background: Cα.warn15, color: C.warn, fontSize: 12, fontWeight: 700 }}>
                              {estado}
                              <button onClick={() => quitarCambio(c.id)} style={{ background: "none", border: "none", color: C.warn, cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}>{tx("deshacer", "undo")}</button>
                            </div>
                          )}
                        </div>
                        {/* 28-oct-2026 (Santiago: "es muy importante hacer más visible la renta o el gasto mensual
                            de cada ítem; solo se ve el capital y el valor mensual es el más importante"). */}
                        {(() => {
                          const mensual = c && c.tipo === "cambia" ? Number(c.monto) || 0 : f.montoTipico;
                          const col = k === "ing" ? C.ok : k === "deu" ? C.warn : C.danger;
                          return (
                            <div style={{ textAlign: "right", flexShrink: 0, minWidth: 120 }}>
                              <div style={{ ...F.mono, fontSize: 16, fontWeight: 700, color: col, lineHeight: 1.1 }}>{k === "ing" ? "+" : "−"}{fm(mensual)}<span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{tx("/mes", "/mo")}</span></div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{tx(`${fm(anual)} en ${año}`, `${fm(anual)} in ${año}`)}</div>
                            </div>
                          );
                        })()}
                        {!c && !editando && (<>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12 }} onClick={() => setForm({ tipo: "meses", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 1, hastaMes: 12 })}>{tx("Unos meses", "Some months")}</button>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12 }} onClick={() => setForm({ tipo: "termina", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 7 })}>{tx("Termina", "Ends")}</button>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 12 }} onClick={() => setForm({ tipo: "cambia", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 1, monto: Math.round(f.montoTipico), modo: k === "ing" && f.capital > 0 ? "capital" : "monto", capital: f.capital || "", tasa: f.tasa || "", tasaModo: f.tasaModo || "anual" })}>{tx("Cambia", "Changes")}</button>
                        </>)}
                      </div>
                      {editando && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                          {form.tipo === "meses" ? (<>
                            <div style={{ flex: "1 1 100%", ...F.caption }}>{tx(`¿En qué meses de ${año} cuenta? Fuera de ese rango, en cero.`, `Which months of ${año} does it count? Outside that range, zero.`)}</div>
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>{tx("Desde", "From")}</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value), hastaMes: Math.max(Number(e.target.value), Number(form.hastaMes) || 12) })}>
                                {MESES.map((m) => <option key={m.v} value={m.v}>{mesL(m.v)}</option>)}
                              </select>
                            </div>
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>{tx("Hasta", "To")}</div>
                              <select style={input} value={form.hastaMes} onChange={(e) => setForm({ ...form, hastaMes: Number(e.target.value) })}>
                                {MESES.filter((m) => m.v >= (Number(form.desdeMes) || 1)).map((m) => <option key={m.v} value={m.v}>{mesL(m.v)}</option>)}
                              </select>
                            </div>
                          </>) : form.tipo === "termina" ? (
                            <div style={{ flex: "1 1 160px" }}>
                              <div style={F.label}>{tx(`Último mes que cuenta en ${año}`, `Last month it counts in ${año}`)}</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                <option value={1}>{tx(`Ninguno — no cuenta en ${año}`, `None — doesn't count in ${año}`)}</option>
                                {MESES.filter((m) => m.v < 12).map((m) => <option key={m.v} value={m.v + 1}>{mesL(m.v)}</option>)}
                              </select>
                            </div>
                          ) : (<>
                            {/* 11-oct-2026 (Santiago: "esto aquí debería permitir poner el
                                capital y el % de rentabilidad, o el valor"). En ingresos se
                                puede cambiar por capital × tasa o por monto directo. */}
                            {k === "ing" && (
                              <div style={{ flex: "1 1 100%", display: "flex", gap: 6 }}>
                                {[["capital", tx("Capital y % rentabilidad", "Capital and % return")], ["monto", tx("Monto directo", "Direct amount")]].map(([m, l]) => (
                                  <button key={m} type="button" onClick={() => setForm({ ...form, modo: m, monto: m === "capital" && rentaDe(form.capital, form.tasa, form.tasaModo) > 0 ? String(rentaDe(form.capital, form.tasa, form.tasaModo)) : form.monto })}
                                    style={{ ...btn(form.modo === m), padding: "4px 10px", fontSize: 12 }}>{l}</button>
                                ))}
                              </div>
                            )}
                            {k === "ing" && form.modo === "capital" ? (<>
                              <div style={{ flex: "1 1 150px" }}>
                                <div style={F.label}>{tx("Capital invertido", "Capital invested")}</div>
                                <input style={input} type="number" autoFocus value={form.capital || ""} placeholder={ejCapital()}
                                  onChange={(e) => setForm({ ...form, capital: e.target.value, monto: String(rentaDe(e.target.value, form.tasa, form.tasaModo) || form.monto) })} />
                              </div>
                              <div style={{ flex: "0 1 120px" }}>
                                <div style={F.label}>% {anualMensualTxt(form.tasaModo)}</div>
                                <input style={input} type="number" step="0.1" value={form.tasa || ""} placeholder={tx("Ej: 14", "e.g. ") + (esUS() ? "5" : "14")}
                                  onChange={(e) => setForm({ ...form, tasa: e.target.value, monto: String(rentaDe(form.capital, e.target.value, form.tasaModo) || form.monto) })} />
                              </div>
                              <div style={{ flex: "0 1 120px" }}>
                                <div style={F.label}>{tx("Tasa", "Rate")}</div>
                                <select style={input} value={form.tasaModo || "anual"} onChange={(e) => setForm({ ...form, tasaModo: e.target.value, monto: String(rentaDe(form.capital, form.tasa, e.target.value) || form.monto) })}>
                                  <option value="anual">{tx("anual", "yearly")}</option><option value="mensual">{tx("mensual", "monthly")}</option>
                                </select>
                              </div>
                              <div style={{ flex: "1 1 100%", ...F.caption }}>
                                {rentaDe(form.capital, form.tasa, form.tasaModo) > 0
                                  ? <>{fm(Number(form.capital))} × {fmtTasa(form.tasa)} {anualMensualTxt(form.tasaModo)} = <b style={{ color: C.text }}>{fm(rentaDe(form.capital, form.tasa, form.tasaModo))}{tx("/mes", "/mo")}</b> · {fm(rentaDe(form.capital, form.tasa, form.tasaModo) * 12)} {tx("al año", "a year")}{f.capital > 0 ? tx(` · hoy: ${fm(f.capital)} × ${fmtTasa(f.tasa)} = ${fm(f.montoTipico)}/mes`, ` · today: ${fm(f.capital)} × ${fmtTasa(f.tasa)} = ${fm(f.montoTipico)}/mo`) : ""}</>
                                  : tx("Pon capital y tasa y el monto mensual sale solo.", "Enter capital and rate and the monthly amount is calculated for you.")}
                              </div>
                            </>) : (
                              <div style={{ flex: "1 1 160px" }}>
                                <div style={F.label}>{k === "deu" ? tx("Nueva cuota mensual", "New monthly payment") : tx(`Nuevo monto mensual (${monedaBase()})`, `New monthly amount (${monedaBase()})`)}</div>
                                <input style={input} type="number" autoFocus value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                              </div>
                            )}
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>{tx("Desde", "From")}</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                {MESES.map((m) => <option key={m.v} value={m.v}>{mesL(m.v)}</option>)}
                              </select>
                            </div>
                          </>)}
                          <button style={btn(true)} onClick={() => agregarCambio(form)}>{tx("Aplicar", "Apply")}</button>
                          <button style={btn(false)} onClick={() => setForm(null)}>{tx("Cancelar", "Cancel")}</button>
                        </div>
                      )}
                    </div>
                  );
  };

  return (
    <div>
      <PageHeader label={tx("Simulador · futuro", "Simulator · next year")} title={tx("¿Me alcanza con la vida que viene?", "Will my money cover the year ahead?")}
        subtitle={tx(`Tu vida de hoy proyectada a ${año}, con los cambios que sabes que vienen. Tus datos reales no se tocan.`, `Your life today projected to ${año}, with the changes you know are coming. Your real data isn't touched.`)} />

      {/* ── Escenario ── */}
      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={F.label}>{tx("Escenario", "Scenario")}</div>
          <select value={selId || ""} onChange={(e) => { setSelId(e.target.value); setMesFoco(null); }} style={{ ...input, width: "auto", minWidth: 180 }}>
            {escenarios.length === 0 && <option value="">{tx("— ninguno —", "— none —")}</option>}
            {escenarios.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {e.año}</option>)}
          </select>
          <button style={btn(true)} onClick={nuevoEscenario}>{tx("+ Nuevo escenario", "+ New scenario")}</button>
          {esc && <button style={btn(false)} onClick={borrarEscenario}>{tx("Borrar", "Delete")}</button>}
        </div>
        {esc && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 220px" }}>
              <div style={F.label}>{tx("Nombre", "Name")}</div>
              <input style={input} value={esc.nombre} onChange={(e) => actualizar({ nombre: e.target.value })} />
            </div>
            <div style={{ flex: "0 0 120px" }}>
              <div style={F.label}>{tx("Año", "Year")}</div>
              <select style={input} value={esc.año} onChange={(e) => actualizar({ año: Number(e.target.value) })}>
                {[1, 2, 3].map((k) => <option key={k} value={añoHoy + k}>{añoHoy + k}</option>)}
              </select>
            </div>
            <div style={{ flex: "2 1 300px" }}>
              <div style={F.label}>{tx("Qué va a pasar (para ti)", "What's going to happen (your notes)")}</div>
              <input style={input} placeholder={tx("Ej: me paso a independiente en marzo, vendo el carro en junio…", "e.g. I go freelance in March, sell the car in June…")} value={esc.descripcion || ""} onChange={(e) => actualizar({ descripcion: e.target.value })} />
            </div>
          </div>
        )}
        {!esc && <div style={{ ...F.body, marginTop: 10 }}>{tx("Crea un escenario para empezar. Arranca con tu vida de hoy; después le agregas los cambios.", "Create a scenario to start. It begins with your life today; then you add the changes.")}</div>}
      </div>

      {esc && (<>
        {/* Tira fija: el resultado a la vista mientras se edita abajo (10-oct-2026,
            Santiago: "uno le da Terminar y como que no pasa nada"). */}
        {!veredictoVisible && <div style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", width: "min(720px, calc(100vw - 32px))", zIndex: 500, padding: "8px 12px", background: C.surface, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(255,80,0,0.25)"}`, borderRadius: R.md, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
          <div style={{ ...F.caption, minWidth: 0 }}>
            <b style={{ color: C.text }}>{foco ? `${mesL(foco.mes)} ${año}` : tx(`Mes típico ${año}`, `Typical month ${año}`)}</b> · {cambios.length} {cambios.length === 1 ? tx("cambio", "change") : tx("cambios", "changes")}
          </div>
          <div style={{ ...F.mono, color: vista.queda >= 0 ? C.ok : C.danger, whiteSpace: "nowrap" }}>
            {vista.queda >= 0 ? tx("quedan ", "left over ") : tx("faltan ", "short ")}{fm(Math.abs(vista.queda))}{tx("/mes", "/mo")}
            <span style={{ ...F.caption, marginLeft: 8 }}>{Math.abs(vista.queda - hoy.queda) < 1 ? tx("igual que hoy", "same as today") : `${vista.queda > hoy.queda ? "+" : "−"}${fm(Math.abs(vista.queda - hoy.queda))} ${tx("vs hoy", "vs today")}`}</span>
          </div>
        </div>}

        {/* ── Veredicto ── */}
        <div style={card} ref={veredictoRef}>
          {/* 11-oct-2026 (Santiago: "ingresos y cuotas no podrían estar en una sola
              franja y así liberar espacio para gráficos"). Hoy vs futuro en una
              sola tabla: una fila por año, una columna por concepto. */}
          {(() => {
            // 29-oct-2026 (Santiago: "¿esto es al mes o anual? ¿cuotas qué es, créditos?").
            // La clave interna (k) decide el color de la diferencia; el texto va en el idioma.
            const cols = [[tx("Ingresos", "Income"), (x) => x.ingresos, C.text, "ing"], [tx("Gastos", "Expenses"), (x) => x.gastos, C.text, "gas"], [tx("Cuotas de créditos", "Loan payments"), (x) => x.cuotas, C.text, "deu"], [foco ? tx("Impuestos", "Taxes") : esUS() ? tx("Impuestos (nómina y estimados)", "Taxes (payroll & estimated)") : tx("Retención de renta", "Income tax withholding"), (x) => x.impuesto + x.retencion, C.text, "imp"], [tx("Te queda", "Left over"), (x) => x.queda, null, "queda"]]; // 31-oct-2026: cifras neutras; color solo en «Te queda» y la diferencia
            const filasT = [
              { k: "hoy", titulo: tx(`Hoy · ${añoHoy}`, `Today · ${añoHoy}`), sub: tx("referencia, no cambia", "reference, doesn't change"), d: hoy },
              { k: "fut", titulo: foco ? `${mesL(foco.mes)} ${año}` : tx(`Mes típico ${año}`, `Typical month ${año}`), sub: foco ? tx("ese mes en concreto", "that specific month") : (cambios.length ? tx(`promedio ${mesL(mesRegimen).toLowerCase()}–dic, ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}`, `average ${mesL(mesRegimen)}–Dec, ${cambios.length} ${cambios.length === 1 ? "change" : "changes"}`) : tx("sin cambios todavía", "no changes yet")), d: vista, fuerte: true },
            ];
            const th = { ...F.label, textAlign: "right", padding: "4px 8px", whiteSpace: "nowrap" };
            const td = { ...F.mono, textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
            // 30-oct-2026 (Santiago: "no están bien diseñadas para mobile"): en el celular la
            // tabla de 5 columnas no cabía; se voltea (concepto por fila) con cifras cortas.
            if (typeof window !== "undefined" && window.innerWidth < 640) {
              const [h, f] = filasT;
              return (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: "left", padding: "4px 4px" }}>{tx("Al mes", "Per month")}</th>
                    <th style={{ ...th, padding: "4px 4px" }}>{h.titulo}</th>
                    <th style={{ ...th, padding: "4px 4px" }}>{f.titulo}</th>
                  </tr></thead>
                  <tbody>
                    {cols.map(([t, g, col, ck]) => {
                      const a = g(h.d), b2 = g(f.d), dif = b2 - a;
                      const bueno = ck === "ing" || ck === "queda" ? dif >= 0 : dif <= 0;
                      return (
                        <tr key={t} style={{ borderTop: `1px solid ${C.border}` }}>
                          <td style={{ ...F.body, padding: "6px 4px" }}>{t}</td>
                          <td style={{ ...td, padding: "6px 4px", color: col || (a >= 0 ? C.ok : C.danger) }}>{fmC(a)}</td>
                          <td style={{ ...td, padding: "6px 4px", fontWeight: 700, color: col || (b2 >= 0 ? C.ok : C.danger) }}>
                            {fmC(b2)}
                            {Math.abs(dif) >= 1 && <div style={{ ...F.caption, fontWeight: 400, color: bueno ? C.ok : C.danger }}>{(dif > 0 ? "+" : "−") + fmC(Math.abs(dif))}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            }
            return (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("Todo es ", "Everything is ")}<b style={{ color: C.text }}>{tx("al mes", "per month")}</b></th>{cols.map(([t]) => <th key={t} style={th}>{t}</th>)}</tr></thead>
                  <tbody>
                    {filasT.map((r) => (
                      <tr key={r.k} style={{ background: r.fuerte ? Cα.ok08 : "transparent", borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "6px 8px", minWidth: 150 }}><div style={{ ...F.body, color: C.text, fontWeight: 600 }}>{r.titulo}</div><div style={F.caption}>{r.sub}</div></td>
                        {cols.map(([t, g, col]) => { const v = g(r.d); return <td key={t} style={{ ...td, color: col || (v >= 0 ? C.ok : C.danger), fontWeight: r.fuerte ? 700 : 400 }}>{fm(v)}</td>; })}
                      </tr>
                    ))}
                    <tr style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "4px 8px", ...F.caption }}>{tx("Diferencia vs hoy", "Difference vs today")}</td>
                      {cols.map(([t, g, , ck]) => { const d = g(vista) - g(hoy); const bueno = ck === "ing" || ck === "queda" ? d >= 0 : d <= 0; return <td key={t} style={{ ...td, fontSize: 12, padding: "3px 8px", color: Math.abs(d) < 1 ? C.subtle : bueno ? C.ok : C.danger }}>{Math.abs(d) < 1 ? "=" : (d > 0 ? "+" : "−") + fm(Math.abs(d))}</td>; })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div style={{ marginTop: 12, padding: "10px 13px", borderRadius: R.md, background: vista.queda >= 0 ? Cα.ok08 : Cα.danger08, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(255,80,0,0.25)"}` }}>
            <div style={{ ...F.h3, color: vista.queda >= 0 ? C.ok : C.danger }}>
              {vista.queda >= 0
                ? tx(`Te sostienes: quedan ${fm(vista.queda)} al mes (${vista.ingresos > 0 ? Math.round((vista.queda / vista.ingresos) * 100) : 0}% de lo que entra).`, `You're covered: ${fm(vista.queda)} left over each month (${vista.ingresos > 0 ? Math.round((vista.queda / vista.ingresos) * 100) : 0}% of what comes in).`)
                : tx(`No alcanza: faltan ${fm(-vista.queda)} al mes.`, `Not enough: ${fm(-vista.queda)} short each month.`)}
              {" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>
                {Math.abs(vista.queda - hoy.queda) < 1 ? tx("Igual que hoy.", "Same as today.") : tx(`${vista.queda > hoy.queda ? "Mejor" : "Peor"} que hoy por ${fm(Math.abs(vista.queda - hoy.queda))}.`, `${vista.queda > hoy.queda ? "Better" : "Worse"} than today by ${fm(Math.abs(vista.queda - hoy.queda))}.`)}
              </span>
            </div>
            <div style={{ ...F.caption, marginTop: 4 }}>
              {esUS() ? (<>
                {tx(`Gastos ${fm(vista.gastos)} + cuotas ${fm(vista.cuotas)} = lo que gastas. Aparte, lo que retiene tu nómina (federal, estatal y FICA): ${fm(vista.retencion)}${foco ? "" : "/mes"}.`, `Expenses ${fm(vista.gastos)} + loan payments ${fm(vista.cuotas)} = what you spend. Separately, what your paycheck withholds (federal, state and FICA): ${fm(vista.retencion)}${foco ? "" : "/mo"}.`)}
                {foco ? (vista.impuesto > 0 ? tx(` En ${mesL(foco.mes).toLowerCase()} además haces un pago estimado al IRS y a tu estado: ${fm(vista.impuesto)}.`, ` In ${mesL(foco.mes)} you also make an estimated tax payment to the IRS and your state: ${fm(vista.impuesto)}.`) : "") : tx(` Los pagos estimados de ${año} (4 al año: enero, abril, junio y septiembre) van prorrateados en el mes típico: ${fm(vista.impuesto)}/mes. Míralos abajo en Impuestos.`, ` ${año} estimated tax payments (4 a year: January, April, June and September) are spread across the typical month: ${fm(vista.impuesto)}/mo. See them below under Taxes.`)}
              </>) : (<>
              {tx(`Gastos ${fm(vista.gastos)} + cuotas ${fm(vista.cuotas)} = lo que gastas. Aparte, la retención en la fuente: ${fm(vista.retencion)}${foco ? "" : "/mes"}.`, `Expenses ${fm(vista.gastos)} + loan payments ${fm(vista.cuotas)} = what you spend. Separately, income tax withheld at source: ${fm(vista.retencion)}${foco ? "" : "/mo"}.`)}
              {foco ? (vista.impuesto > 0 ? tx(` En ${mesL(foco.mes).toLowerCase()} además pagas la declaración de renta ${año - 1}: ${fm(vista.impuesto)}.`, ` In ${mesL(foco.mes)} you also pay your ${año - 1} income tax return: ${fm(vista.impuesto)}.`) : "") : tx(` La declaración de renta ${año - 1} no entra en el mes típico: se paga de una vez (mírala abajo en Impuestos).`, ` The ${año - 1} income tax return isn't in the typical month: it's paid once (see it below under Taxes).`)}
              </>)}
            </div>
          </div>

          {/* 28-oct-2026 (Santiago: "no sé de dónde sale que en 2027 tengo ingresos superiores a 150 M").
              Lo que más mueve los ingresos y los gastos frente a hoy, ítem por ítem. */}
          {(() => {
            const idxF = foco ? [foco.mes - 1] : idxRegimen;
            const nF = idxF.length || 1;
            const fut = (f) => idxF.reduce((a, i) => a + (f.meses[i] || 0), 0) / nF;
            const hoyDe = (key) => { const h = filasHoy.find((x) => x.key === key); return h ? h.meses.reduce((a, v) => a + v, 0) / 12 : 0; };
            const difs = filas.filter((f) => f.kind === "ing" || f.kind === "gas").map((f) => {
              const a = hoyDe(f.key), b = fut(f);
              const h = filasHoy.find((x) => x.key === f.key);
              const mesesHoy = h ? h.meses.filter((v) => v > 0).length : 0;
              const motivo = f.origen === "nuevo" ? tx("nuevo en tu escenario", "new in your scenario")
                : f.cambio ? (f.cambio.tipo === "cambia" ? tx("lo cambiaste", "you changed it") : f.cambio.tipo === "meses" ? tx("solo unos meses", "only some months") : f.cambio.tipo === "termina" ? tx("termina", "ends") : "")
                : (mesesHoy > 0 && mesesHoy < 12 && b > a ? tx(`en ${añoHoy} solo contó ${mesesHoy} ${mesesHoy === 1 ? "mes" : "meses"}; en ${año} cuenta todo el año`, `in ${añoHoy} it only counted ${mesesHoy} ${mesesHoy === 1 ? "month" : "months"}; in ${año} it counts all year`) : "");
              return { nombre: f.nombre, kind: f.kind, a, b, d: b - a, motivo };
            }).filter((x) => Math.abs(x.d) >= 1000).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
            const top = (k) => difs.filter((x) => x.kind === k).slice(0, 5);
            const bloqueK = (k, titulo, total) => {
              const lst = top(k);
              if (!lst.length) return null;
              return (
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <div style={{ ...F.label, marginBottom: 6 }}>{tx(`${titulo} ${total >= 0 ? "suben" : "bajan"} ${fm(Math.abs(total))}/mes — lo que más pesa`, `${titulo} ${total >= 0 ? "go up" : "go down"} ${fm(Math.abs(total))}/mo — biggest drivers`)}</div>
                  {lst.map((x, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre}</div>
                        <div style={F.caption}>{tx(`${fm(x.a)} hoy → ${fm(x.b)} en ${año}`, `${fm(x.a)} today → ${fm(x.b)} in ${año}`)}{x.motivo ? ` · ${x.motivo}` : ""}</div>
                      </div>
                      <div style={{ ...F.mono, fontWeight: 700, color: (k === "ing") === (x.d > 0) ? C.ok : C.danger, whiteSpace: "nowrap" }}>{x.d > 0 ? "+" : "−"}{fm(Math.abs(x.d))}</div>
                    </div>
                  ))}
                </div>
              );
            };
            if (!difs.length) return null;
            return (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{tx("¿Por qué cambia frente a hoy?", "Why is it different from today?")}</div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {bloqueK("ing", tx("Ingresos", "Income"), vista.ingresos - hoy.ingresos)}
                  {bloqueK("gas", tx("Gastos", "Expenses"), vista.gastos - hoy.gastos)}
                </div>
              </div>
            );
          })()}

          {/* 11-oct-2026 (Santiago: "ese gráfico se ve enorme… mire esos espacios
              vacíos"). Orden: barras a todo el ancho (son bajitas), y debajo el
              Sankey y el desglose ítem por ítem lado a lado, que tienen alturas
              parecidas y se llenan mutuamente. */}
          <div style={{ marginTop: 16 }}>
          {/* 12 meses: ingresos vs egresos, con lo que pasa en cada uno */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 0, flexWrap: "wrap" }}>
            <div style={F.label}>{tx(`Mes a mes en ${año}`, `Month by month in ${año}`)}</div>
            <div style={{ display: "flex", gap: 10, ...F.caption }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.ok, borderRadius: 3, marginRight: 4 }} />{tx("Ingresos", "Income")}</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.danger, borderRadius: 3, marginRight: 4 }} />{esUS() ? tx("Gastos + cuotas + impuestos", "Expenses + loan payments + taxes") : tx("Gastos + cuotas + impuestos y retención", "Expenses + loan payments + taxes and withholding")}</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.warn, borderRadius: "50%", marginRight: 4 }} />{tx("algo entra, termina o cambia", "something starts, ends or changes")}</span>
            </div>
            {mesFoco && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12, marginLeft: "auto" }} onClick={() => setMesFoco(null)}>{tx("← volver al mes típico", "← back to the typical month")}</button>}
          </div>
          <div style={{ ...F.caption, marginTop: 4 }}>
            {mesesIguales
              ? tx("Todos los meses salen iguales en este escenario: nada entra, termina ni cambia a mitad de año. El número de cada barra es lo que te queda ese mes.", "Every month comes out the same in this scenario: nothing starts, ends or changes mid-year. The number on each bar is what's left over that month.")
              : tx("El número sobre cada mes es lo que te queda. Pásate por encima para ver el detalle y haz clic para que el veredicto de arriba muestre ese mes.", "The number above each month is what's left over. Hover to see the detail and click so the summary above shows that month.")}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 10, height: 128 }} onMouseLeave={() => setMesHover(null)}>
            {porMes.map((m, i) => {
              const hi = (m.ingresos / maxBar) * 100, he = ((m.egresos + m.retencion) / maxBar) * 100;
              const sel = mesFoco === m.mes, hov = mesHover === m.mes, pos = m.queda >= 0;
              const ev = eventosMes[i];
              return (
                <div key={m.mes} onClick={() => setMesFoco(sel ? null : m.mes)} onMouseEnter={() => setMesHover(m.mes)}
                  style={{ flex: 1, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0,
                    background: sel || hov ? C.raised : "transparent", borderRadius: R.md, border: `1px solid ${sel ? C.text : "transparent"}`, padding: "4px 2px 2px" }}>
                  <div style={{ ...F.mono, fontSize: 11, textAlign: "center", color: pos ? C.ok : C.danger, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{fmC(m.queda)}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, flex: 1 }}>
                    <div style={{ flex: 1, height: `${Math.max(3, hi)}%`, background: C.ok, opacity: sel || hov ? 1 : 0.6, borderRadius: 3 }} />
                    <div style={{ flex: 1, height: `${Math.max(3, he)}%`, background: C.danger, opacity: sel || hov ? 1 : 0.6, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {MESES.map((m, i) => (
              <div key={m.v} style={{ flex: 1, textAlign: "center", ...F.caption, fontSize: 11, color: mesFoco === m.v ? C.text : undefined, fontWeight: mesFoco === m.v ? 700 : 400 }}>
                {mesL(m.v).slice(0, 3)}{eventosMes[i].length > 0 && <span style={{ display: "inline-block", width: 6, height: 6, background: C.warn, borderRadius: "50%", marginLeft: 3, verticalAlign: "middle" }} />}
              </div>
            ))}
          </div>
          {(() => {
            const mm = mesHover || mesFoco;
            if (!mm) return null;
            const m = porMes[mm - 1], ev = eventosMes[mm - 1];
            return (
              <div style={{ marginTop: 10, padding: "10px 12px", background: C.raised, borderRadius: R.md, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
                  <div style={{ ...F.label, minWidth: 90 }}>{mesL(mm)} {año}</div>
                  <Celda etiqueta={tx("Ingresos", "Income")} valor={m.ingresos} color={C.ok} />
                  <Celda etiqueta={tx("Gastos", "Expenses")} valor={m.gastos} color={C.danger} />
                  <Celda etiqueta={tx("Cuotas", "Loan payments")} valor={m.cuotas} color={C.warn} />
                  <Celda etiqueta={tx("Impuestos", "Taxes")} valor={m.impuesto + m.retencion} color={C.purple} />
                  <Celda etiqueta={tx("Queda", "Left over")} valor={m.queda} color={m.queda >= 0 ? C.ok : C.danger} />
                </div>
                <div style={{ ...F.caption, marginTop: 6 }}>
                  {ev.length === 0
                    ? (mm === 1 ? tx("Arranca el año con todo lo que está activo.", "The year starts with everything that's active.") : tx(`Igual que ${mesL(mm - 1).toLowerCase()}: nada entra ni termina este mes.`, `Same as ${mesL(mm - 1)}: nothing starts or ends this month.`))
                    : <>{tx("Este mes: ", "This month: ")}{ev.map((e, k) => <span key={k} style={{ color: e.tipo === "entra" ? C.ok : e.tipo === "sale" ? C.danger : C.warn }}>{k > 0 ? " · " : ""}{e.texto}</span>)}</>}
                </div>
              </div>
            );
          })()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, marginTop: 16, alignItems: "stretch" }}>
        {(() => {
          const idx = foco ? [foco.mes - 1] : idxRegimen;
          const prom = (f) => idx.reduce((a, i) => a + (f.meses[i] || 0), 0) / (idx.length || 1);
          const fuentes = filas.filter((f) => f.kind === "ing").map((f) => ({ nombre: f.nombre, valor: prom(f) }));
          const porCat = {};
          let aportes = 0;
          filas.filter((f) => f.kind === "gas").forEach((f) => {
            const v = prom(f);
            if (f.cat === "Seguridad Social") aportes += v;
            else porCat[f.cat || "Otros"] = (porCat[f.cat || "Otros"] || 0) + v;
          });
          const sub = foco ? tx(`${mesL(foco.mes)} ${año} · un solo mes del escenario.`, `${mesL(foco.mes)} ${año} · a single month of the scenario.`) : (cambios.length ? tx(`Mes típico ${año}: promedio ${mesL(mesRegimen).toLowerCase()}–dic con tus cambios aplicados.`, `Typical month ${año}: average ${mesL(mesRegimen)}–Dec with your changes applied.`) : tx(`Mes típico ${año}: tu vida de hoy llevada a todo el año.`, `Typical month ${año}: your life today carried over the whole year.`));
          return (
            <div style={{ minWidth: 0 }}>
              <SankeyFlujo
                bruto={vista.ingresos}
                fuentes={fuentes}
                retencion={vista.retencion}
                impuesto={vista.impuesto}
                aportes={aportes}
                cuotas={vista.cuotas}
                gastosCats={(() => {
                  // Máximo 3 categorías + "Otros": con más, las etiquetas de la derecha se pisan.
                  const cs = Object.entries(porCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
                  if (cs.length <= 4) return cs;
                  return [...cs.slice(0, 3), [tx(`Otros gastos (${cs.length - 3})`, `Other expenses (${cs.length - 3})`), cs.slice(3).reduce((a, [, v]) => a + v, 0)]];
                })()}
                cashFlow={vista.queda}
                subtitulo={sub}
                labels={labelsSankey()}
                fmt={fm}
                T={{ card: C.surface, border: C.border, tx: C.text, tx2: C.muted, tx3: C.subtle }}
              />
            </div>
          );
        })()}
          {(() => {
            const idx = foco ? [foco.mes - 1] : idxRegimen;
            const n = idx.length || 1;
            const valor = (f) => idx.reduce((a, i) => a + (f.meses[i] || 0), 0) / n;
            const grupos = [["ing", tx("Ingresos", "Income"), C.ok], ["gas", tx("Gastos", "Expenses"), C.danger], ["deu", tx("Cuotas", "Loan payments"), C.warn]];
            return (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{tx("De dónde sale cada número", "Where each number comes from")}</div>
                <div style={{ ...F.caption, marginBottom: 10 }}>{foco ? `${mesL(foco.mes)} ${año}` : tx(`Mes típico ${año}`, `Typical month ${año}`)} · {tx("ítem por ítem, ordenado de mayor a menor.", "item by item, largest first.")}</div>
                {/* 21-oct-2026 (Santiago, en el celular: "esta sección no se deja
                    recorrer"): el scroll interno de 400 px peleaba con el scroll de la
                    página en el móvil y la tarjeta desbordaba a lo ancho (minmax 380px
                    en una pantalla de 390). En pantallas angostas la lista va completa,
                    sin scroll propio; el límite de alto queda solo para escritorio. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, ...(typeof window !== "undefined" && window.innerWidth >= 900 ? { overflowY: "auto", maxHeight: 400, paddingRight: 4 } : {}) }}>
                  {grupos.map(([k, titulo, color]) => {
                    const lista = filas.filter((f) => f.kind === k).map((f) => ({ ...f, v: valor(f) })).filter((f) => f.v !== 0).sort((a, b) => b.v - a.v);
                    const total = lista.reduce((a, f) => a + f.v, 0);
                    return (
                      <div key={k} style={{ background: C.raised, borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ ...F.label, color }}>{titulo} · {lista.length}</span>
                          <span style={{ ...F.mono, fontSize: 12, color }}>{fm(total)}</span>
                        </div>
                        {lista.length === 0 && <div style={{ ...F.caption, marginTop: 6 }}>{tx("Nada este mes.", "Nothing this month.")}</div>}
                        {lista.map((f) => (
                          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...F.body, color: C.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {f.nombre}{f.origen === "nuevo" ? tx(" · nuevo", " · new") : f.cambio ? tx(" · con cambio", " · changed") : ""}
                              </div>
                              <div style={{ ...F.caption, fontSize: 11 }}>
                                {f.capital > 0 && f.tasa > 0 ? `${fm(f.capital)} × ${fmtTasa(f.tasa)} ${anualMensualTxt(f.tasaModo)}` : catTxt(f.cat)}
                              </div>
                            </div>
                            <span style={{ ...F.mono, fontSize: 12, color: C.text, flexShrink: 0 }}>{fm(f.v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  // 29-oct-2026 (Santiago: "así como se ven ingresos, gastos, deudas, debería verse impuestos").
                  const decl = (pagoFut.titulares || []).filter((t) => t.total > 0).map((t) => ({ t, v: foco ? t.meses.filter((m) => m.mes === foco.mes).reduce((a, m) => a + t.total * m.fraccion, 0) : (esUS() ? t.total / 12 : 0) }));
                  const total = vista.retencion + vista.impuesto;
                  return (
                    <div style={{ background: C.raised, borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.border}`, marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ ...F.label, color: C.purple }}>{tx("Impuestos", "Taxes")} · {1 + decl.length}</span>
                        <span style={{ ...F.mono, fontSize: 12, color: C.purple }}>{fm(total)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                        <div style={{ ...F.body, color: C.text, fontSize: 12 }}>{esUS() ? tx("Retenido de tu nómina", "Payroll withholding") : tx("Retención en la fuente", "Income tax withheld at source")}<div style={{ ...F.caption, fontSize: 11 }}>{esUS() ? tx("federal, estatal y FICA que te descuentan del salario", "federal, state and FICA taken out of your paycheck") : tx("adelanto de tu renta que te descuentan al pagarte", "advance on your income tax, deducted when you're paid")}</div></div>
                        <span style={{ ...F.mono, fontSize: 12, color: C.text }}>{fm(vista.retencion)}</span>
                      </div>
                      {decl.map(({ t, v }) => (
                        <div key={t.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ ...F.body, color: C.text, fontSize: 12 }}>{esUS() ? tx(`Pagos estimados ${año}`, `Estimated tax payments ${año}`) : tx(`Declaración de renta ${año - 1}`, `Income tax return ${año - 1}`)} · {t.name}
                            <div style={{ ...F.caption, fontSize: 11 }}>{fm(t.total)} {fechaPago(t)}{foco && !v ? tx(" · no cae en este mes", " · not due this month") : !foco ? (esUS() ? tx(" · prorrateado en el mes típico", " · spread across the typical month") : tx(" · no entra al mes típico", " · not in the typical month")) : ""}</div>
                          </div>
                          <span style={{ ...F.mono, fontSize: 12, color: C.text }}>{fm(v)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })()}
          </div>
        </div>

        {/* ── Acumulado del año y patrimonio ── */}
        <div style={card}>
          <div style={F.h2}>{tx(`Lo que suma ${año} y a dónde llega tu patrimonio`, `${año} totals and where your net worth ends up`)}</div>
          <div style={F.caption}>{tx("Los 12 meses del escenario sumados, comparados con tu vida de hoy llevada a un año completo.", "The scenario's 12 months added up, compared with your life today over a full year.")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
            {[
              [tx("Ingresos del año", "Income for the year"), anual.ingresos, anualHoy.ingresos, C.ok, true],
              [tx("Gastos del año", "Expenses for the year"), anual.gastos, anualHoy.gastos, C.danger, false],
              [tx("Cuotas del año", "Loan payments for the year"), anual.cuotas, anualHoy.cuotas, C.warn, false],
              [tx("Impuestos del año", "Taxes for the year"), anual.impuestos, anualHoy.impuestos, C.purple, false, "imp"],
              [anual.queda >= 0 ? tx("Te queda en el año", "Left over for the year") : tx("Te falta en el año", "Short for the year"), anual.queda, anualHoy.queda, anual.queda >= 0 ? C.ok : C.danger, true],
            ].map(([t, v, vh, col, masEsMejor, ck]) => {
              const d = v - vh, bueno = masEsMejor ? d >= 0 : d <= 0;
              return (
                <div key={t} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "10px 12px" }}>
                  <div style={F.label}>{t}</div>
                  <div style={{ ...F.mono, fontSize: 18, color: col }}>{fm(v)}</div>
                  {/* 31-oct-2026 (Santiago: "me confunde… ¿120 MM?"). Son dos cosas
                      distintas: la retención ya te la descuentan al pagarte; la
                      declaración sí sale de tu bolsillo. Se dicen por separado. */}
                  {ck === "imp" && (esUS() ? (
                    <div style={{ ...F.caption, color: C.muted, margin: "2px 0 4px", lineHeight: 1.45 }}>
                      {tx(`${fm(anual.ret)} retenido de nómina (ya te lo descuentan)`, `${fm(anual.ret)} payroll withholding (already taken out)`)}<br />
                      {tx(`+ ${fm(anual.decl)} de pagos estimados (sale de tu bolsillo)`, `+ ${fm(anual.decl)} estimated payments (out of your pocket)`)}
                      <div style={{ color: C.subtle }}>{tx(`Hoy: ${fm(anualHoy.ret)} de nómina + ${fm(anualHoy.decl)} de pagos estimados`, `Today: ${fm(anualHoy.ret)} withholding + ${fm(anualHoy.decl)} estimated payments`)}</div>
                    </div>
                  ) : (
                    <div style={{ ...F.caption, color: C.muted, margin: "2px 0 4px", lineHeight: 1.45 }}>
                      {tx(`${fm(anual.ret)} de retención (ya te la descuentan al pagarte)`, `${fm(anual.ret)} withheld (already taken out when you're paid)`)}<br />
                      {tx(`+ ${fm(anual.decl)} de declaraciones (sale de tu bolsillo)`, `+ ${fm(anual.decl)} from tax returns (out of your pocket)`)}
                      <div style={{ color: C.subtle }}>{tx(`Hoy: ${fm(anualHoy.ret)} de retención + ${fm(anualHoy.decl)} de declaraciones`, `Today: ${fm(anualHoy.ret)} withheld + ${fm(anualHoy.decl)} from tax returns`)}</div>
                    </div>
                  ))}
                  <div style={{ ...F.caption, color: Math.abs(d) < 1 ? C.subtle : bueno ? C.ok : C.danger }}>
                    {Math.abs(d) < 1 ? tx("igual que hoy", "same as today") : tx(`${d > 0 ? "+" : "−"}${fm(Math.abs(d))} vs hoy (${fm(vh)})`, `${d > 0 ? "+" : "−"}${fm(Math.abs(d))} vs today (${fm(vh)})`)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ ...F.caption, marginTop: 8 }}>
            {anual.positivos === 12 ? tx("Los 12 meses cierran en positivo.", "All 12 months end positive.") : anual.positivos === 0 ? tx("Ningún mes cierra en positivo.", "No month ends positive.") : tx(`${anual.positivos} meses cierran en positivo y ${12 - anual.positivos} en negativo.`, `${anual.positivos} months end positive and ${12 - anual.positivos} negative.`)}
            {" "}{tx("Promedio mensual: ", "Monthly average: ")}{fm(anual.queda / 12)}.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
            <div>
              <div style={F.h3}>{tx(`Curva del patrimonio en ${año}`, `Net worth curve in ${año}`)}</div>
              <div style={F.caption}>{tx("Arranca en tu patrimonio neto de hoy y cada mes suma lo que queda, más el capital de las cuotas que baja la deuda. Sin valorización de activos: solo tu flujo.", "Starts at your net worth today and each month adds what's left over, plus the principal your loan payments pay down. No asset appreciation: just your cash flow.")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={F.label}>{tx(`Hoy → dic ${año}`, `Today → Dec ${año}`)}</div>
              <div style={{ ...F.mono, fontSize: 15 }}>
                <span style={{ color: C.muted }}>{fm(snap.patrimonioNeto)}</span> → <span style={{ color: patFin >= snap.patrimonioNeto ? C.ok : C.danger }}>{fm(patFin)}</span>
                <span style={{ ...F.caption, marginLeft: 8, color: patFin >= snap.patrimonioNeto ? C.ok : C.danger }}>{patFin >= snap.patrimonioNeto ? "+" : "−"}{fm(Math.abs(patFin - snap.patrimonioNeto))}{snap.patrimonioNeto > 0 ? ` (${pct(((patFin - snap.patrimonioNeto) / snap.patrimonioNeto * 100), 1)})` : ""}</span>
              </div>
            </div>
          </div>
          <div style={{ height: 240, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curvaPat} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <ChartGradients />
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="m" {...axisProps} />
                <YAxis {...axisProps} width={64} domain={[(min) => min - Math.max(1, Math.abs(patFin - snap.patrimonioNeto)) * 0.6, (max) => max + Math.max(1, Math.abs(patFin - snap.patrimonioNeto)) * 0.3]} tickFormatter={(v) => fmC(v)} />
                <YAxis yAxisId="oculto" hide domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip formatter={(v) => fm(v)} />} />
                <ReferenceLine y={snap.patrimonioNeto} stroke={CHART.txt3} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="pat" name={tx("Patrimonio neto", "Net worth")} stroke={CHART.blue} strokeWidth={2} fill="url(#gradBlue)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                {/* Series invisibles: solo para que el tooltip muestre el detalle del mes */}
                <Area yAxisId="oculto" type="monotone" dataKey="queda" name={tx("Queda ese mes", "Left over that month")} stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                <Area yAxisId="oculto" type="monotone" dataKey="amort" name={tx("Deuda que baja", "Debt paid down")} stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                <Area yAxisId="oculto" type="monotone" dataKey="acum" name={tx("Sobrante acumulado", "Cumulative surplus")} stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...F.caption, marginTop: 6 }}>
            {tx(`Patrimonio neto hoy: activos ${fm(snap.activos)} − deudas ${fm(snap.deudasTotales)} = ${fm(snap.patrimonioNeto)}.`, `Net worth today: assets ${fm(snap.activos)} − debts ${fm(snap.deudasTotales)} = ${fm(snap.patrimonioNeto)}.`)}{amortMes > 0 ? tx(` Capital que baja la deuda: ${fm(amortMes)}/mes mientras haya cuotas.`, ` Principal paid down: ${fm(amortMes)}/mo while there are payments.`) : ""}{tx(" Pásate por la curva para ver cada mes.", " Hover over the curve to see each month.")}
          </div>
        </div>

        {/* ── Cambios ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={F.h2}>{tx(`Lo que cambia en ${año}`, `What changes in ${año}`)}</div>
              <div style={F.caption}>{tx("Tres verbos: algo termina, algo cambia de monto, algo nuevo entra.", "Three verbs: something ends, something changes amount, something new comes in.")}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ing", "gas", "deu"].map((k) => (
                <button key={k} style={btn(false)} onClick={() => setForm({ tipo: "nuevo", kind: k, desdeMes: 1, hastaMes: 12, cat: k === "ing" ? "Salario" : "" })}>
                  {tx(`+ Nuevo ${kindL[k]}`, `+ New ${kindL[k]}`)}
                </button>
              ))}
            </div>
          </div>

          {cambios.length === 0 && <div style={{ ...F.body, marginTop: 10 }}>{tx("Todavía no hay cambios. Agrega algo nuevo con los botones de arriba, o baja a tu vida de hoy y marca en cada fila qué termina o qué cambia.", "No changes yet. Add something new with the buttons above, or scroll down to your life today and mark on each row what ends or changes.")}</div>}
          {cambios.some((c) => c.tipo === "termina" || c.tipo === "cambia" || c.tipo === "meses") && <div style={{ ...F.caption, marginTop: 8 }}>{cambios.filter((c) => c.tipo === "termina" || c.tipo === "cambia" || c.tipo === "meses").length}{tx(" ajustes sobre tu vida de hoy: se ven marcados en cada fila, abajo.", " adjustments to your life today: they're marked on each row below.")}</div>}
          {cambios.filter((c) => c.tipo === "nuevo" || c.tipo === "continua").map((c) => {
            const fila = filas.find((f) => f.key === c.ref) || filas.find((f) => f.key === c.id);
            const nombre = c.tipo === "nuevo" ? c.nombre : (fila?.nombre || "—");
            const texto = c.tipo === "continua" ? (base.find((b) => b.key === c.ref)?.vig?.apagado ? tx(`estaba apagado; cuenta en ${año}`, `was turned off; counts in ${año}`) : tx(`sigue en ${año} aunque en ${añoHoy} terminó en ${mesL(base.find((b) => b.key === c.ref)?.vig?.hasta || 12).toLowerCase()}`, `continues in ${año} even though in ${añoHoy} it ended in ${mesL(base.find((b) => b.key === c.ref)?.vig?.hasta || 12)}`))
              : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? tx("no cuenta en todo el año", "doesn't count all year") : tx(`cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`, `counts through ${mesL(Number(c.desdeMes) - 1)}, then ends`))
              : c.tipo === "cambia" ? tx(`pasa a ${fm(c.monto)} desde ${mesL(c.desdeMes).toLowerCase()}`, `changes to ${fm(c.monto)} from ${mesL(c.desdeMes)}`)
              : `${tx(`entra ${fm(c.monto)}/mes de ${mesL(c.desdeMes).toLowerCase()} a ${mesL(c.hastaMes || 12).toLowerCase()}`, `${fm(c.monto)}/mo from ${mesL(c.desdeMes)} to ${mesL(c.hastaMes || 12)}`)}${Number(c.capital) > 0 && Number(c.tasa) > 0 ? ` (${fm(Number(c.capital))} × ${fmtTasa(c.tasa)} ${anualMensualTxt(c.tasaModo)})` : ""}`;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
                <span style={{ ...F.label, color: colorK[c.kind], minWidth: 56 }}>{kindL[c.kind]}</span>
                <span style={{ ...F.body, color: C.text, flex: 1 }}><b>{nombre}</b> {texto}</span>
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} onClick={() => quitarCambio(c.id)}>{tx("Quitar", "Remove")}</button>
              </div>
            );
          })}

          {form && form.tipo === "nuevo" && (
            <div style={{ marginTop: 12, padding: 12, background: C.raised, borderRadius: R.md, border: `1px solid ${C.border}` }}>
              <div style={{ ...F.h3, marginBottom: 8 }}>
                {form.tipo === "nuevo" ? tx(`Nuevo ${kindL[form.kind]}`, `New ${kindL[form.kind]}`) : form.tipo === "termina" ? tx(`“${form.nombre}” termina`, `“${form.nombre}” ends`) : tx(`“${form.nombre}” cambia de monto`, `“${form.nombre}” changes amount`)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {form.tipo === "nuevo" && (<>
                  <div><div style={F.label}>{tx("Nombre", "Name")}</div><input style={input} value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={form.kind === "ing" ? tx("Ej: Nuevo contrato", "e.g. New contract") : form.kind === "gas" ? tx("Ej: Arriendo nuevo", "e.g. New rent") : tx("Ej: Crédito carro", "e.g. Car loan")} /></div>
                  {form.kind === "ing" && <div><div style={F.label}>{tx("Tipo", "Type")}</div><select style={input} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{CATS_ING.map((c) => <option key={c} value={c}>{catTxt(c)}</option>)}</select></div>}
                  {form.kind === "ing" && (<>
                    {/* 11-oct-2026 (Santiago: "una inversión nueva no me deja poner
                        capital ni porcentaje y no calcula el monto"). Con capital y
                        tasa el monto mensual se deriva solo, como en Ingresos. */}
                    <div><div style={F.label}>{tx("Capital invertido (opcional)", "Capital invested (optional)")}</div>
                      <input style={input} type="number" placeholder={ejCapital()} value={form.capital || ""} onChange={(e) => {
                        const cap = Number(e.target.value) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, capital: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>{tx(`% rentabilidad ${form.tasaModo === "mensual" ? "mensual" : "anual"}`, `% return ${form.tasaModo === "mensual" ? "monthly" : "yearly"}`)}</div>
                      <input style={input} type="number" placeholder={tx("Ej: ", "e.g. ") + (form.tasaModo === "mensual" ? "1" : esUS() ? "5" : "14")} value={form.tasa || ""} onChange={(e) => {
                        const tas = Number(e.target.value) || 0, cap = Number(form.capital) || 0;
                        const nf = { ...form, tasa: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>{tx("Periodicidad de la tasa", "Rate period")}</div>
                      <select style={input} value={form.tasaModo || "anual"} onChange={(e) => {
                        const tm = e.target.value, cap = Number(form.capital) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, tasaModo: tm };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(tm === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }}>
                        <option value="anual">{tx("Anual (ej: 14% al año)", "Yearly (e.g. 5% a year)")}</option>
                        <option value="mensual">{tx("Mensual (ej: 1% al mes)", "Monthly (e.g. 1% a month)")}</option>
                      </select></div>
                  </>)}
                  {form.kind === "gas" && <div><div style={F.label}>{tx("Categoría", "Category")}</div><input style={input} list="cats-gas" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder={tx("Ej: Vivienda", "e.g. Housing")} /><datalist id="cats-gas">{Object.keys(user.gastos || {}).map((c) => <option key={c} value={c} />)}</datalist></div>}
                  {form.kind === "deu" && <div><div style={F.label}>{tx("Saldo (opcional)", "Balance (optional)")}</div><input style={input} type="number" value={form.saldo || ""} onChange={(e) => setForm({ ...form, saldo: e.target.value })} /></div>}
                  {owners.length > 1 && <div><div style={F.label}>{tx("De quién", "Whose")}</div><select style={input} value={form.owner || owners[0].id} onChange={(e) => setForm({ ...form, owner: e.target.value })}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
                </>)}
                {form.tipo !== "termina" && (
                  <div><div style={F.label}>{form.kind === "deu" ? tx("Cuota mensual", "Monthly payment") : tx(`Monto mensual (${monedaBase()})`, `Monthly amount (${monedaBase()})`)}</div><input style={input} type="number" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                    {form.kind === "ing" && Number(form.capital) > 0 && Number(form.tasa) > 0 && (
                      <div style={{ ...F.caption, color: C.ok, marginTop: 4 }}>
                        {fm(Number(form.capital))} × {fmtTasa(form.tasa)} {anualMensualTxt(form.tasaModo)} = {fm(Number(form.monto) || 0)}{tx("/mes", "/mo")} · {fm((Number(form.monto) || 0) * 12)} {tx("al año", "a year")}
                      </div>
                    )}
                  </div>
                )}
                <div><div style={F.label}>{form.tipo === "termina" ? tx("Último mes que cuenta", "Last month it counts") : tx("Desde", "From")}</div>
                  <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                    {MESES.map((m) => <option key={m.v} value={form.tipo === "termina" ? m.v + 1 : m.v}>{mesL(m.v)}</option>)}
                  </select></div>
                {form.tipo === "nuevo" && (
                  <div><div style={F.label}>{tx("Hasta", "To")}</div>
                    <select style={input} value={form.hastaMes} onChange={(e) => setForm({ ...form, hastaMes: Number(e.target.value) })}>
                      {MESES.map((m) => <option key={m.v} value={m.v}>{mesL(m.v)}</option>)}
                    </select></div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={btn(true)} disabled={form.tipo === "nuevo" && !form.nombre} onClick={() => agregarCambio(form)}>{tx("Agregar", "Add")}</button>
                <button style={btn(false)} onClick={() => setForm(null)}>{tx("Cancelar", "Cancel")}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Base: la vida de hoy ── */}
        <div style={card}>
          <div style={F.h2}>Tu vida de hoy, llevada a {año}</div>
          {nuevosHoy.length > 0 && (
            <div style={{ margin: "4px 0 14px", padding: "10px 12px", borderRadius: R.md, background: Cα.accent08, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={F.h3}>{nuevosHoy.length} {nuevosHoy.length === 1 ? "cosa nueva" : "cosas nuevas"} en tus datos de hoy · ¿{nuevosHoy.length === 1 ? "cuenta" : "cuentan"} en {año}?</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...btn(true), padding: "5px 12px", fontSize: 12 }} onClick={() => setActivo(nuevosHoy.map((b) => b.key), true)}>Contar todas</button>
                  <button style={{ ...btn(false), padding: "5px 12px", fontSize: 12 }} onClick={() => setActivo(nuevosHoy.map((b) => b.key), false)}>Ninguna</button>
                </div>
              </div>
              <div style={{ ...F.caption, margin: "4px 0 6px" }}>Las registraste después de crear este escenario. No se suman solas: tú decides.</div>
              {nuevosHoy.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                  <span style={{ ...F.label, color: colorK[f.kind], minWidth: 56 }}>{kindL[f.kind]}</span>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre} <span style={F.caption}>· {f.cat}</span></div>
                    <div style={F.caption}>{fm(f.montoTipico)}/mes</div>
                  </div>
                  <button style={{ ...btn(true), padding: "3px 10px", fontSize: 12 }} onClick={() => setActivo([f.key], true)}>Contar</button>
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} onClick={() => setActivo([f.key], false)}>No</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...F.caption, marginBottom: 8 }}>Todo lo que tienes hoy, llevado a {año}. <b style={{ color: C.text }}>Este escenario tiene sus propios interruptores</b>: prender o apagar aquí no cambia tus datos ni el simulador, y apagar algo allá no lo saca de aquí. Usa Cambia, Unos meses o Termina para ajustar una fila.</div>
          {["ing", "gas", "deu"].map((k) => {
            const grupoIn = filas.filter((f) => f.kind === k && f.origen === "hoy" || (f.kind === k && f.cambio && f.origen !== "nuevo"));
            const grupoEx = excluidos.filter((b) => b.kind === k).map((b) => ({ ...b, excluido: true, meses: MESES.map(() => 0) }));
            const grupo = [...grupoIn, ...grupoEx];
            if (!grupo.length) return null;
            return (
              <div key={k} style={{ marginTop: 10 }}>
                {/* 11-oct-2026 (Santiago: "deberían verse los totales"). */}
                {(() => {
                  const anualGrupo = grupo.reduce((a, f) => a + f.meses.reduce((x, v) => x + v, 0), 0);
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0" }}>
                      <span style={{ ...F.label, color: colorK[k] }}>{kindL[k]}s · {grupoIn.length}{grupoEx.length ? ` de ${grupo.length}` : ""}</span>
                      <span style={{ ...F.mono, fontSize: 13, color: colorK[k] }}>{fm(anualGrupo / 12)}/mes <span style={{ ...F.caption, color: C.subtle }}>· {fm(anualGrupo)} en {año}</span></span>
                    </div>
                  );
                })()}
                {/* 11-oct-2026 (Santiago: "más separados, por categorías"). */}
                {(() => {
                  const porCat = {};
                  grupo.forEach((f) => { const cat = f.cat || "Sin categoría"; (porCat[cat] = porCat[cat] || []).push(f); });
                  // 21-oct-2026 (Santiago: "lo más importante, saber cuánto invertí, no se ve").
                  // Capital por categoría: el del cambio si se cambió por capital, si no el del ítem.
                  const capitalDe = (f) => { if (f.excluido) return 0; const c = f.cambio; return (c && c.tipo === "cambia" && c.modo === "capital" && Number(c.capital) > 0) ? Number(c.capital) : (Number(f.capital) || 0); };
                  const cats = Object.entries(porCat).map(([cat, fs]) => ({ cat, fs, anual: fs.reduce((a, f) => a + f.meses.reduce((x, v) => x + v, 0), 0), capital: fs.reduce((a, f) => a + capitalDe(f), 0) })).sort((a, b) => b.anual - a.anual);
                  return cats.map(({ cat, fs, anual: anualCat, capital: capCat }) => (
                    <div key={cat} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 8px", background: C.raised, borderRadius: R.sm, marginBottom: 2, gap: 10, flexWrap: "wrap" }}>
                        <span style={{ ...F.h3, fontSize: 12 }}>{cat} <span style={F.caption}>· {fs.length}</span>{capCat > 0 && <span style={{ ...F.caption, marginLeft: 8 }}>capital invertido <b style={{ color: C.text }}>{fm(capCat)}</b></span>}</span>
                        <span style={{ ...F.mono, fontSize: 12, color: C.text }}>{fm(anualCat / 12)}/mes{capCat > 0 && anualCat > 0 && <span style={{ ...F.caption, marginLeft: 6 }}>· {fmtTasaEs((anualCat / capCat) * 100)} anual</span>}</span>
                      </div>
                      {fs.map((f) => renderFila(f))}
                    </div>
                  ));
                })()}
              </div>
            );
          })}

          <GrupoImpuestos pago={pagoFut} año={año} porMes={porMes} onNavigate={onNavigate} onVerMes={(m) => setMesFoco(m)} />

          {filas.filter((f) => f.origen === "hoy").length === 0 && (
            <div style={F.body}>No hay nada encendido para simular. Revisa los interruptores "simular" en Ingresos, Egresos y Deudas{onNavigate ? "" : "."}</div>
          )}
        </div>
      </>)}
    </div>
  );
}

// ─── Renta del año anterior que se paga en el año simulado ─────────────────
// 29-oct-2026 (Santiago: "en la proyección del año siguiente uno no ve el impuesto del 2026,
// el que se generó"; "se paga en un solo mes"; "por persona natural y por jurídica").
function fechaPago(t) {
  const f = (m) => (m.dia ? `el ${m.dia} de ${mesL(m.mes).toLowerCase()}` : `en ${mesL(m.mes).toLowerCase()}`);
  return t.meses.length > 1 ? `en dos cuotas: ${t.meses.map((m) => mesL(m.mes).toLowerCase()).join(" y ")}` : f(t.meses[0]);
}
// 29-oct-2026 (Santiago: "cómo dejar claro que la declaración es cobro y la retención no;
// así como está uno cree que también se la están cobrando"). Dos bloques separados:
// lo que ya te descuentan al pagarte (no sale aparte de tu bolsillo) y lo que pagas al declarar.
function GrupoImpuestos({ pago, año, porMes, onNavigate, onVerMes }) {
  const ret = porMes.reduce((a, m) => a + (m.retencion || 0), 0);
  const tit = (pago?.titulares || []).filter((t) => t.total > 0 || t.fuente !== "motor");
  const alDeclarar = pago?.total || 0;
  const falta = (pago?.porMes || []).map((v, i) => ({ v, i, queda: porMes[i]?.queda ?? 0 })).filter((x) => x.v > 0 && x.queda < 0);
  const link = { ...F.caption, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" };
  const bloque = (titulo, sub, valor, color, hijos) => (
    <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: R.md, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "8px 10px", background: C.raised, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...F.h3, fontSize: 13, color: C.text }}>{titulo}</div>
          <div style={F.caption}>{sub}</div>
        </div>
        <span style={{ ...F.mono, fontSize: 14, fontWeight: 700, color }}>{valor}</span>
      </div>
      {hijos}
    </div>
  );
  const fila = (key, nombre, sub, derecha, colorDer = C.text) => (
    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ ...F.body, color: C.text }}>{nombre}</div>
        <div style={F.caption}>{sub}</div>
      </div>
      <span style={{ ...F.mono, fontSize: 13, color: colorDer }}>{derecha}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0" }}>
        <span style={{ ...F.label, color: C.purple, whiteSpace: "nowrap" }}>impuestos de renta</span>
        <span style={{ ...F.caption }}>en total, tu renta de {año} pesa {fm(ret + alDeclarar)}</span>
      </div>
      {bloque("1 · Ya te lo descuentan al pagarte", "Retención en la fuente. No es un cobro aparte: es parte de tu impuesto, pagado por adelantado. Por eso a tu cuenta llega menos de lo que registraste como ingreso.", `${fm(ret / 12)}/mes`, C.muted,
        fila("ret", "Retención en la fuente", `${fm(ret)} en ${año} · sale de las retenciones de tu última declaración, ajustadas a tus ingresos de este escenario. Al declarar se resta del impuesto.`, "ya descontada", C.muted))}
      {bloque("2 · Lo que pagas de tu bolsillo al declarar", `La declaración de ${año - 1}: impuesto − lo que ya te retuvieron + anticipo. Sale de una vez, en la fecha de cada uno.`, fm(alDeclarar), alDeclarar > 0 ? C.danger : C.ok,
        tit.map((t) => fila(t.name, `${t.name} · ${t.type === "juridica" ? "sociedad" : "persona natural"}`,
          <>{t.total > 0 ? `Paga ${fechaPago(t)}` : "Lo retenido cubre su impuesto"}{" · "}{t.fuente === "motor" ? "aproximado (sin declaración)" : <button type="button" onClick={() => onNavigate?.("taxcalc")} style={link}>de la Calculadora</button>}
            {t.total > 0 && <>{" · "}<button type="button" onClick={() => onVerMes(t.meses[0].mes)} style={link}>ver ese mes</button></>}</>,
          t.total > 0 ? `paga ${fm(t.total)}` : t.saldo < 0 ? `no paga · saldo a favor ${fm(-t.saldo)}` : "no paga", t.total > 0 ? C.danger : C.ok)))}
      {falta.length > 0 && <div style={{ ...F.caption, color: C.danger, padding: "6px 2px" }}>{falta.map((x) => `En ${mesL(x.i + 1).toLowerCase()} te faltan ${fm(-x.queda)}`).join("; ")}: conviene ir apartando desde antes.</div>}
    </div>
  );
}
