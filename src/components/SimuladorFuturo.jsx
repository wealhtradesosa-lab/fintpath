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
import { fmtPctEs, fmtTasaEs, fmtPlataCortaEs } from "../lib/formato.js";
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

const fm = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
const mesL = (m) => (MESES.find((x) => x.v === m) || {}).l || "";
// Renta mensual que sale de un capital y una tasa (anual o mensual).
const rentaDe = (cap, tasa, modo) => { const c = Number(cap) || 0, t = Number(tasa) || 0; return c > 0 && t > 0 ? Math.round(modo === "mensual" ? c * t / 100 : c * t / 100 / 12) : 0; };
// Formato corto para las barras: $12,3 M · $850 K
const fmC = fmtPlataCortaEs;
const uid = () => "c_" + Math.random().toString(36).slice(2, 9);

const CATS_ING = ["Salario", "Honorarios", "Arriendo", "Dividendos", "Intereses bancarios", "Rendimiento", "Pensión", "Negocio", "Otro"];
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
    const fx = i.moneda === "USD" ? trm : 1;
    const v = vigA(i);
    out.push({
      key: claveEstable("ing", i, i.nombre || i.fuente), oldKey: `ing_${idx}`, kind: "ing", ref: i, vig: v,
      nombre: i.nombre || i.fuente || "Ingreso", cat: i.categoria || "",
      capital: Number(i.capital) || 0, tasa: Number(i.tasa) || 0, tasaModo: i.tasaModo || "anual",
      montoTipico: (getFrecuencia(i) === "variable" ? supuestoVariable(i).monto : promedioMesActivo(i)) * fx,
      supuesto: getFrecuencia(i) === "variable" ? supuestoVariable(i).texto : (getFrecuencia(i) === "mensual" ? "" : `${getFrecuencia(i)} · cae en su mes`),
      porMes: (año) => proyectarPorMes(i, año, fx),
      porMesReal: (año) => MESES.map((m) => (montoDelMes(i, año, m.v) || 0) * fx),
    });
  });
  Object.entries(user.gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g, idx) => {
      const fx = g.moneda === "USD" ? trm : 1;
      const v = vigA(g);
      out.push({
        key: claveEstable(`gas:${cat}`, g, g.c), oldKey: `gas_${cat}_${idx}`, kind: "gas", ref: g, vig: v,
        nombre: g.c || "Gasto", cat,
        montoTipico: (getFrecuencia(g) === "variable" ? supuestoVariable(g).monto : promedioMesActivo(g)) * fx,
        supuesto: getFrecuencia(g) === "variable" ? supuestoVariable(g).texto : (getFrecuencia(g) === "mensual" ? "" : `${getFrecuencia(g)} · cae en su mes`),
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
      nombre: d.n || d.nombre || "Deuda", cat: d.tipo || "",
      montoTipico: cuotaDeudaDelMes(dFull, cuota, getMesActual().año, 1, trm) || cuota * (d.moneda === "USD" ? trm : 1),
      porMes: (año) => MESES.map((m) => cuotaDeudaDelMes(dFull, cuota, año, m.v, trm)),
      porMesReal: (año) => MESES.map((m) => cuotaDeudaDelMes(d, cuota, año, m.v, trm)),
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
  if (!conMonto.length) return { monto: 0, texto: "sin montos este año" };
  const primero = conMonto[0].mes;
  if (primero <= 3) {
    const total = montos.reduce((a, v) => a + v, 0);
    return { monto: total / 12, texto: `${fm(total)} de este año repartidos en 12` };
  }
  const vals = conMonto.map((x) => x.v).sort((a, b) => a - b);
  const med = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
  // 28-oct-2026 (Santiago: "son ingresos de todo 2027, ¿por qué dice desde septiembre si no di esa instrucción?").
  // El cálculo ya cuenta los 12 meses; el texto daba a entender que empezaba en septiembre. Ahora dice de dónde
  // sale el valor: lo que recibes desde ese mes de ESTE año.
  return { monto: med, texto: `todo el año · valor típico de lo que recibes desde ${mesL(primero).toLowerCase()} de este año (${conMonto.length} ${conMonto.length === 1 ? "mes" : "meses"})` };
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
        key: c.id, kind: c.kind, nombre: c.nombre || "Nuevo", cat: c.cat || "",
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
    const comun = { frecuencia: "variable", montosMensuales: f.meses, moneda: "COP", sim: true, desdeMes: 1, hastaMes: 12 };
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
  return { owners: user.owners || [], ingresos: ing, gas, deu, inv: user.inv || [], trm: user.trm || 4200, _calRef: user._calRef, _calRefHoy: user._calRefHoy };
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
  const impuesto = pagoMes ? (mesesIdx.length === 1 ? pagoMes[mesesIdx[0]] || 0 : 0) : imp.neto / 12;
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
    const e = { id: uid(), nombre: `Mi ${añoHoy + 1}`, año: añoHoy + 1, cambios: [], activos: Object.fromEntries(b0.map((b) => [b.key, !b.vig?.termina])), conocidos: b0.map((b) => b.key), creado: new Date().toISOString() };
    guardar([...escenarios, e]); setSelId(e.id); setMesFoco(null);
  };
  const borrarEscenario = () => {
    if (!esc || !window.confirm(`¿Borrar el escenario "${esc.nombre}"?`)) return;
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
  const pagoFut = useMemo(() => pagosDeclaracion(user.owners, user._calRef || {}, impHoy.detalle, año - 1), [user, impHoy, año]);
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
    const nombreDe = (c) => c.tipo === "nuevo" ? (c.nombre || "Nuevo") : (filas.find((f) => f.key === c.ref)?.nombre || base.find((b) => b.key === c.ref)?.nombre || "—");
    cambios.forEach((c) => {
      const d = Number(c.desdeMes) || 1;
      if (c.tipo === "nuevo") {
        if (d >= 1 && d <= 12) ev[d - 1].push({ tipo: "entra", texto: `entra ${nombreDe(c)} (${fm(c.monto)}/mes)` });
        const h = Number(c.hastaMes) || 12;
        if (h < 12) ev[h].push({ tipo: "sale", texto: `termina ${nombreDe(c)}` });
      } else if (c.tipo === "meses") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "entra", texto: `arranca ${nombreDe(c)}` });
        const h = Number(c.hastaMes) || 12;
        if (h < 12) ev[h].push({ tipo: "sale", texto: `termina ${nombreDe(c)}` });
      } else if (c.tipo === "termina") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "sale", texto: `termina ${nombreDe(c)}` });
      } else if (c.tipo === "cambia") {
        if (d >= 2 && d <= 12) ev[d - 1].push({ tipo: "cambia", texto: `${nombreDe(c)} pasa a ${fm(c.monto)}/mes` });
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
        if (ms[i - 1] > 0 && !(ms[i] > 0)) ev[i].push({ tipo: "sale", texto: `${f.nombre} ya no cuenta (${f.kind === "deu" ? "crédito pagado" : "termina"})` });
        if (!(ms[i - 1] > 0) && ms[i] > 0) ev[i].push({ tipo: "entra", texto: `arranca ${f.nombre} (${fm(ms[i])}/mes)` });
      }
    });
    unaVez.forEach((lista, i) => {
      if (!lista.length) return;
      const tot = lista.reduce((a, f) => a + (f.meses[i] || 0), 0);
      ev[i].push({ tipo: "cambia", texto: `${lista.length === 1 ? "pago de una vez" : lista.length + " pagos de una vez"} (${fm(tot)}): ${lista.map((f) => f.nombre).join(", ")}` });
    });
    return ev;
  }, [cambios, filas, base]);
  // Acumulado del año y curva de patrimonio (12-oct-2026, Santiago: "ver el
  // acumulado de ingresos, saldo a favor y gastos por año, y la curva de
  // crecimiento del patrimonio con ese sobrante o pérdida cada mes").
  const anual = useMemo(() => {
    const sum = (k) => porMes.reduce((a, m) => a + m[k], 0);
    return { ingresos: sum("ingresos"), gastos: sum("gastos"), cuotas: sum("cuotas"), impuestos: sum("impuesto") + sum("retencion"), queda: sum("queda"), positivos: porMes.filter((m) => m.queda >= 0).length };
  }, [porMes]);
  const anualHoy = useMemo(() => {
    const sum = (k) => porMesHoy.reduce((a, m) => a + m[k], 0);
    return { ingresos: sum("ingresos"), gastos: sum("gastos"), cuotas: sum("cuotas"), impuestos: sum("impuesto") + sum("retencion"), queda: sum("queda") };
  }, [porMesHoy]);
  const snap = useMemo(() => snapshotPatrimonio(user), [user]);
  const amortMes = useMemo(() => estimarAmortizacionAnual(user.deudas, user.trm) / 12, [user]);
  const curvaPat = useMemo(() => {
    let pat = snap.patrimonioNeto, acum = 0;
    const pts = [{ m: "Hoy", pat, queda: 0, amort: 0, acum: 0 }];
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
  const kindL = { ing: "ingreso", gas: "gasto", deu: "deuda" };
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
      <span style={{ width: 16, height: 16, borderRadius: 999, background: C.text, display: "block" }} />
    </button>
  );
  const motivoExcluido = (f) => activos[f.key] === false ? `apagado en este escenario`
    : f.vig?.apagado ? "apagado en el simulador de hoy · tócalo para contarlo en " + año
    : f.vig?.termina ? `terminó en ${mesL(f.vig.hasta).toLowerCase()} de ${añoHoy} · tócalo si sigue en ${año}` : "no cuenta";
  const renderFila = (f) => { const k = f.kind;
                  if (f.excluido) return (
                    <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, opacity: 0.55, flexWrap: "wrap" }}>
                      <Interruptor on={false} onClick={() => setActivo([f.key], true)} titulo={`Contar en ${año}`} />
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "line-through" }}>{f.nombre} <span style={F.caption}>· {f.cat}</span></div>
                        <div style={F.caption}>{motivoExcluido(f)}</div>
                      </div>
                      <div style={{ ...F.mono, color: C.muted, whiteSpace: "nowrap" }}>{fm(f.montoTipico)}/mes</div>
                    </div>
                  );
                  const anual = f.meses.reduce((s, v) => s + v, 0);
                  const c = f.cambio;
                  const editando = form && form.tipo !== "nuevo" && form.ref === f.key;
                  const estado = !c ? null
                    : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? "no cuenta en todo el año" : `cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`)
                    : c.tipo === "meses" ? `cuenta solo de ${mesL(Number(c.desdeMes) || 1).toLowerCase()} a ${mesL(Number(c.hastaMes) || 12).toLowerCase()} de ${año}`
                    : c.tipo === "cambia" ? `pasa a ${fm(c.monto)}/mes desde ${mesL(c.desdeMes).toLowerCase()}${c.modo === "capital" && rentaDe(c.capital, c.tasa, c.tasaModo) > 0 ? ` (${fm(Number(c.capital))} × ${fmtTasaEs(c.tasa)} ${c.tasaModo === "mensual" ? "mensual" : "anual"})` : ""}`
                    : c.tipo === "continua" ? `sigue en ${año}` : "";
                  return (
                    <div key={f.key} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, background: editando ? Cα.accent08 : "transparent", borderRadius: editando ? R.md : 0, paddingLeft: editando ? 8 : 0, paddingRight: editando ? 8 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {f.origen !== "nuevo" && <Interruptor on onClick={() => setActivo([f.key], false)} titulo={`No contar en ${año}`} />}
                        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                          <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre} <span style={F.caption}>· {f.cat}</span></div>
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
                                const tasaTxt = capC ? `${fmtTasaEs(c.tasa)} ${c.tasaModo === "mensual" ? "mensual" : "anual"}` : `${fmtTasaEs(tasaImpl)} anual implícito`;
                                return <>Capital <b style={{ color: C.text }}>{fm(cap)}</b> × {tasaTxt} → </>;
                              })()}
                              <b style={{ color: C.text }}>{fm(anual / 12)}/mes en {año}</b> · {fm(anual)} en el año
                              <span style={{ marginLeft: 8, textDecoration: "line-through", opacity: 0.7 }}>antes {fm(f.montoTipico)}/mes</span>
                            </div>
                          ) : (
                            <div style={F.caption}>
                              {f.capital > 0 && f.tasa > 0 ? <>Capital <b style={{ color: C.text }}>{fm(f.capital)}</b> × {fmtTasaEs(f.tasa)} {f.tasaModo === "mensual" ? "mensual" : "anual"} → </> : ""}
                              {fm(f.montoTipico)}/mes · {fm(anual)} en {año}{f.supuesto ? ` · ${f.supuesto}` : (f.meses.every((v) => v > 0) ? " · todo el año" : "")}
                            </div>
                          )}
                          {estado && (
                            <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8, padding: "2px 10px", borderRadius: R.pill, background: Cα.warn15, color: C.warn, fontSize: 11, fontWeight: 700 }}>
                              {estado}
                              <button onClick={() => quitarCambio(c.id)} style={{ background: "none", border: "none", color: C.warn, cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0 }}>deshacer</button>
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
                              <div style={{ ...F.mono, fontSize: 16, fontWeight: 800, color: col, lineHeight: 1.1 }}>{k === "ing" ? "+" : "−"}{fm(mensual)}<span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>/mes</span></div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fm(anual)} en {año}</div>
                            </div>
                          );
                        })()}
                        {!c && !editando && (<>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 11 }} onClick={() => setForm({ tipo: "meses", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 1, hastaMes: 12 })}>Unos meses</button>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 11 }} onClick={() => setForm({ tipo: "termina", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 7 })}>Termina</button>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 11 }} onClick={() => setForm({ tipo: "cambia", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 1, monto: Math.round(f.montoTipico), modo: k === "ing" && f.capital > 0 ? "capital" : "monto", capital: f.capital || "", tasa: f.tasa || "", tasaModo: f.tasaModo || "anual" })}>Cambia</button>
                        </>)}
                      </div>
                      {editando && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                          {form.tipo === "meses" ? (<>
                            <div style={{ flex: "1 1 100%", ...F.caption }}>¿En qué meses de {año} cuenta? Fuera de ese rango, en cero.</div>
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>Desde</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value), hastaMes: Math.max(Number(e.target.value), Number(form.hastaMes) || 12) })}>
                                {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                              </select>
                            </div>
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>Hasta</div>
                              <select style={input} value={form.hastaMes} onChange={(e) => setForm({ ...form, hastaMes: Number(e.target.value) })}>
                                {MESES.filter((m) => m.v >= (Number(form.desdeMes) || 1)).map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                              </select>
                            </div>
                          </>) : form.tipo === "termina" ? (
                            <div style={{ flex: "1 1 160px" }}>
                              <div style={F.label}>Último mes que cuenta en {año}</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                <option value={1}>Ninguno — no cuenta en {año}</option>
                                {MESES.filter((m) => m.v < 12).map((m) => <option key={m.v} value={m.v + 1}>{m.l}</option>)}
                              </select>
                            </div>
                          ) : (<>
                            {/* 11-oct-2026 (Santiago: "esto aquí debería permitir poner el
                                capital y el % de rentabilidad, o el valor"). En ingresos se
                                puede cambiar por capital × tasa o por monto directo. */}
                            {k === "ing" && (
                              <div style={{ flex: "1 1 100%", display: "flex", gap: 6 }}>
                                {[["capital", "Capital y % rentabilidad"], ["monto", "Monto directo"]].map(([m, l]) => (
                                  <button key={m} type="button" onClick={() => setForm({ ...form, modo: m, monto: m === "capital" && rentaDe(form.capital, form.tasa, form.tasaModo) > 0 ? String(rentaDe(form.capital, form.tasa, form.tasaModo)) : form.monto })}
                                    style={{ ...btn(form.modo === m), padding: "4px 10px", fontSize: 11 }}>{l}</button>
                                ))}
                              </div>
                            )}
                            {k === "ing" && form.modo === "capital" ? (<>
                              <div style={{ flex: "1 1 150px" }}>
                                <div style={F.label}>Capital invertido</div>
                                <input style={input} type="number" autoFocus value={form.capital || ""} placeholder="Ej: 500000000"
                                  onChange={(e) => setForm({ ...form, capital: e.target.value, monto: String(rentaDe(e.target.value, form.tasa, form.tasaModo) || form.monto) })} />
                              </div>
                              <div style={{ flex: "0 1 120px" }}>
                                <div style={F.label}>% {form.tasaModo === "mensual" ? "mensual" : "anual"}</div>
                                <input style={input} type="number" step="0.1" value={form.tasa || ""} placeholder="Ej: 14"
                                  onChange={(e) => setForm({ ...form, tasa: e.target.value, monto: String(rentaDe(form.capital, e.target.value, form.tasaModo) || form.monto) })} />
                              </div>
                              <div style={{ flex: "0 1 120px" }}>
                                <div style={F.label}>Tasa</div>
                                <select style={input} value={form.tasaModo || "anual"} onChange={(e) => setForm({ ...form, tasaModo: e.target.value, monto: String(rentaDe(form.capital, form.tasa, e.target.value) || form.monto) })}>
                                  <option value="anual">anual</option><option value="mensual">mensual</option>
                                </select>
                              </div>
                              <div style={{ flex: "1 1 100%", ...F.caption }}>
                                {rentaDe(form.capital, form.tasa, form.tasaModo) > 0
                                  ? <>{fm(Number(form.capital))} × {fmtTasaEs(form.tasa)} {form.tasaModo === "mensual" ? "mensual" : "anual"} = <b style={{ color: C.text }}>{fm(rentaDe(form.capital, form.tasa, form.tasaModo))}/mes</b> · {fm(rentaDe(form.capital, form.tasa, form.tasaModo) * 12)} al año{f.capital > 0 ? ` · hoy: ${fm(f.capital)} × ${fmtTasaEs(f.tasa)} = ${fm(f.montoTipico)}/mes` : ""}</>
                                  : "Pon capital y tasa y el monto mensual sale solo."}
                              </div>
                            </>) : (
                              <div style={{ flex: "1 1 160px" }}>
                                <div style={F.label}>{k === "deu" ? "Nueva cuota mensual" : "Nuevo monto mensual (COP)"}</div>
                                <input style={input} type="number" autoFocus value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                              </div>
                            )}
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>Desde</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                              </select>
                            </div>
                          </>)}
                          <button style={btn(true)} onClick={() => agregarCambio(form)}>Aplicar</button>
                          <button style={btn(false)} onClick={() => setForm(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
  };

  return (
    <div>
      <PageHeader label="Simulador · futuro" title="¿Me alcanza con la vida que viene?"
        subtitle={`Tu vida de hoy proyectada a ${año}, con los cambios que sabes que vienen. Tus datos reales no se tocan.`} />

      {/* ── Escenario ── */}
      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={F.label}>Escenario</div>
          <select value={selId || ""} onChange={(e) => { setSelId(e.target.value); setMesFoco(null); }} style={{ ...input, width: "auto", minWidth: 180 }}>
            {escenarios.length === 0 && <option value="">— ninguno —</option>}
            {escenarios.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {e.año}</option>)}
          </select>
          <button style={btn(true)} onClick={nuevoEscenario}>+ Nuevo escenario</button>
          {esc && <button style={btn(false)} onClick={borrarEscenario}>Borrar</button>}
        </div>
        {esc && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 220px" }}>
              <div style={F.label}>Nombre</div>
              <input style={input} value={esc.nombre} onChange={(e) => actualizar({ nombre: e.target.value })} />
            </div>
            <div style={{ flex: "0 0 120px" }}>
              <div style={F.label}>Año</div>
              <select style={input} value={esc.año} onChange={(e) => actualizar({ año: Number(e.target.value) })}>
                {[1, 2, 3].map((k) => <option key={k} value={añoHoy + k}>{añoHoy + k}</option>)}
              </select>
            </div>
            <div style={{ flex: "2 1 300px" }}>
              <div style={F.label}>Qué va a pasar (para ti)</div>
              <input style={input} placeholder="Ej: me paso a independiente en marzo, vendo el carro en junio…" value={esc.descripcion || ""} onChange={(e) => actualizar({ descripcion: e.target.value })} />
            </div>
          </div>
        )}
        {!esc && <div style={{ ...F.body, marginTop: 10 }}>Crea un escenario para empezar. Arranca con tu vida de hoy; después le agregas los cambios.</div>}
      </div>

      {esc && (<>
        {/* Tira fija: el resultado a la vista mientras se edita abajo (10-oct-2026,
            Santiago: "uno le da Terminar y como que no pasa nada"). */}
        {!veredictoVisible && <div style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", width: "min(720px, calc(100vw - 32px))", zIndex: 500, padding: "8px 12px", background: C.surface, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(239,68,68,0.25)"}`, borderRadius: R.md, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
          <div style={{ ...F.caption, minWidth: 0 }}>
            <b style={{ color: C.text }}>{foco ? `${mesL(foco.mes)} ${año}` : `Mes típico ${año}`}</b> · {cambios.length} {cambios.length === 1 ? "cambio" : "cambios"}
          </div>
          <div style={{ ...F.mono, color: vista.queda >= 0 ? C.ok : C.danger, whiteSpace: "nowrap" }}>
            {vista.queda >= 0 ? "quedan " : "faltan "}{fm(Math.abs(vista.queda))}/mes
            <span style={{ ...F.caption, marginLeft: 8 }}>{Math.abs(vista.queda - hoy.queda) < 1 ? "igual que hoy" : `${vista.queda > hoy.queda ? "+" : "−"}${fm(Math.abs(vista.queda - hoy.queda))} vs hoy`}</span>
          </div>
        </div>}

        {/* ── Veredicto ── */}
        <div style={card} ref={veredictoRef}>
          {/* 11-oct-2026 (Santiago: "ingresos y cuotas no podrían estar en una sola
              franja y así liberar espacio para gráficos"). Hoy vs futuro en una
              sola tabla: una fila por año, una columna por concepto. */}
          {(() => {
            const cols = [["Ingresos", (x) => x.ingresos, C.ok], ["Gastos", (x) => x.gastos, C.danger], ["Cuotas", (x) => x.cuotas, C.warn], ["Impuestos", (x) => x.impuesto + x.retencion, C.purple], ["Queda", (x) => x.queda, null]];
            const filasT = [
              { k: "hoy", titulo: `Hoy · ${añoHoy}`, sub: "referencia, no cambia", d: hoy },
              { k: "fut", titulo: foco ? `${mesL(foco.mes)} ${año}` : `Mes típico ${año}`, sub: foco ? "ese mes en concreto" : (cambios.length ? `promedio ${mesL(mesRegimen).toLowerCase()}–dic, ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}` : "sin cambios todavía"), d: vista, fuerte: true },
            ];
            const th = { ...F.label, textAlign: "right", padding: "4px 8px", whiteSpace: "nowrap" };
            const td = { ...F.mono, textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
            return (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ ...th, textAlign: "left" }}></th>{cols.map(([t]) => <th key={t} style={th}>{t}</th>)}</tr></thead>
                  <tbody>
                    {filasT.map((r) => (
                      <tr key={r.k} style={{ background: r.fuerte ? Cα.ok08 : "transparent", borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "6px 8px", minWidth: 150 }}><div style={{ ...F.body, color: C.text, fontWeight: 600 }}>{r.titulo}</div><div style={F.caption}>{r.sub}</div></td>
                        {cols.map(([t, g, col]) => { const v = g(r.d); return <td key={t} style={{ ...td, color: col || (v >= 0 ? C.ok : C.danger), fontWeight: r.fuerte ? 700 : 400 }}>{fm(v)}</td>; })}
                      </tr>
                    ))}
                    <tr style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "4px 8px", ...F.caption }}>Diferencia vs hoy</td>
                      {cols.map(([t, g]) => { const d = g(vista) - g(hoy); const bueno = t === "Ingresos" || t === "Queda" ? d >= 0 : d <= 0; return <td key={t} style={{ ...td, fontSize: 11, padding: "3px 8px", color: Math.abs(d) < 1 ? C.subtle : bueno ? C.ok : C.danger }}>{Math.abs(d) < 1 ? "=" : (d > 0 ? "+" : "−") + fm(Math.abs(d))}</td>; })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div style={{ marginTop: 12, padding: "10px 13px", borderRadius: R.md, background: vista.queda >= 0 ? Cα.ok08 : Cα.danger08, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(239,68,68,0.25)"}` }}>
            <div style={{ ...F.h3, color: vista.queda >= 0 ? C.ok : C.danger }}>
              {vista.queda >= 0
                ? `Te sostienes: quedan ${fm(vista.queda)} al mes (${vista.ingresos > 0 ? Math.round((vista.queda / vista.ingresos) * 100) : 0}% de lo que entra).`
                : `No alcanza: faltan ${fm(-vista.queda)} al mes.`}
              {" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>
                {Math.abs(vista.queda - hoy.queda) < 1 ? "Igual que hoy." : `${vista.queda > hoy.queda ? "Mejor" : "Peor"} que hoy por ${fm(Math.abs(vista.queda - hoy.queda))}.`}
              </span>
            </div>
            <div style={{ ...F.caption, marginTop: 4 }}>
              Gastos {fm(vista.gastos)} + cuotas {fm(vista.cuotas)} = lo que gastas. Aparte, la retención en la fuente: {fm(vista.retencion)}{foco ? "" : "/mes"}.
              {foco ? (vista.impuesto > 0 ? ` En ${mesL(foco.mes).toLowerCase()} además pagas la declaración de renta ${año - 1}: ${fm(vista.impuesto)}.` : "") : ` La declaración de renta ${año - 1} no entra en el mes típico: se paga de una vez (mira abajo en qué mes).`}
            </div>
          </div>
          <RentaQuePagas pago={pagoFut} año={año} porMes={porMes} onNavigate={onNavigate} onVerMes={(m) => setMesFoco(m)} />

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
              const motivo = f.origen === "nuevo" ? "nuevo en tu escenario"
                : f.cambio ? (f.cambio.tipo === "cambia" ? "lo cambiaste" : f.cambio.tipo === "meses" ? "solo unos meses" : f.cambio.tipo === "termina" ? "termina" : "")
                : (mesesHoy > 0 && mesesHoy < 12 && b > a ? `en ${añoHoy} solo contó ${mesesHoy} ${mesesHoy === 1 ? "mes" : "meses"}; en ${año} cuenta todo el año` : "");
              return { nombre: f.nombre, kind: f.kind, a, b, d: b - a, motivo };
            }).filter((x) => Math.abs(x.d) >= 1000).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
            const top = (k) => difs.filter((x) => x.kind === k).slice(0, 5);
            const bloqueK = (k, titulo, total) => {
              const lst = top(k);
              if (!lst.length) return null;
              return (
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <div style={{ ...F.label, marginBottom: 6 }}>{titulo} {total >= 0 ? "suben" : "bajan"} {fm(Math.abs(total))}/mes — lo que más pesa</div>
                  {lst.map((x, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre}</div>
                        <div style={F.caption}>{fm(x.a)} hoy → {fm(x.b)} en {año}{x.motivo ? ` · ${x.motivo}` : ""}</div>
                      </div>
                      <div style={{ ...F.mono, fontWeight: 800, color: (k === "ing") === (x.d > 0) ? C.ok : C.danger, whiteSpace: "nowrap" }}>{x.d > 0 ? "+" : "−"}{fm(Math.abs(x.d))}</div>
                    </div>
                  ))}
                </div>
              );
            };
            if (!difs.length) return null;
            return (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: R.md, border: `1px solid ${C.border}`, background: C.surface }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>🔎 ¿Por qué cambia frente a hoy?</div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {bloqueK("ing", "Ingresos", vista.ingresos - hoy.ingresos)}
                  {bloqueK("gas", "Gastos", vista.gastos - hoy.gastos)}
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
            <div style={F.label}>Mes a mes en {año}</div>
            <div style={{ display: "flex", gap: 10, ...F.caption }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.ok, borderRadius: 3, marginRight: 4 }} />Ingresos</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.danger, borderRadius: 3, marginRight: 4 }} />Gastos + cuotas + impuestos y retención</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: C.warn, borderRadius: "50%", marginRight: 4 }} />algo entra, termina o cambia</span>
            </div>
            {mesFoco && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => setMesFoco(null)}>← volver al mes típico</button>}
          </div>
          <div style={{ ...F.caption, marginTop: 4 }}>
            {mesesIguales
              ? "Todos los meses salen iguales en este escenario: nada entra, termina ni cambia a mitad de año. El número de cada barra es lo que te queda ese mes."
              : "El número sobre cada mes es lo que te queda. Pásate por encima para ver el detalle y haz clic para que el veredicto de arriba muestre ese mes."}
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
                  <div style={{ ...F.mono, fontSize: 10, textAlign: "center", color: pos ? C.ok : C.danger, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{fmC(m.queda)}</div>
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
              <div key={m.v} style={{ flex: 1, textAlign: "center", ...F.caption, fontSize: 10, color: mesFoco === m.v ? C.text : undefined, fontWeight: mesFoco === m.v ? 700 : 400 }}>
                {m.l.slice(0, 3)}{eventosMes[i].length > 0 && <span style={{ display: "inline-block", width: 6, height: 6, background: C.warn, borderRadius: "50%", marginLeft: 3, verticalAlign: "middle" }} />}
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
                  <Celda etiqueta="Ingresos" valor={m.ingresos} color={C.ok} />
                  <Celda etiqueta="Gastos" valor={m.gastos} color={C.danger} />
                  <Celda etiqueta="Cuotas" valor={m.cuotas} color={C.warn} />
                  <Celda etiqueta="Impuestos" valor={m.impuesto + m.retencion} color={C.purple} />
                  <Celda etiqueta="Queda" valor={m.queda} color={m.queda >= 0 ? C.ok : C.danger} />
                </div>
                <div style={{ ...F.caption, marginTop: 6 }}>
                  {ev.length === 0
                    ? (mm === 1 ? "Arranca el año con todo lo que está activo." : `Igual que ${mesL(mm - 1).toLowerCase()}: nada entra ni termina este mes.`)
                    : <>Este mes: {ev.map((e, k) => <span key={k} style={{ color: e.tipo === "entra" ? C.ok : e.tipo === "sale" ? C.danger : C.warn }}>{k > 0 ? " · " : ""}{e.texto}</span>)}</>}
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
          const sub = foco ? `${mesL(foco.mes)} ${año} · un solo mes del escenario.` : (cambios.length ? `Mes típico ${año}: promedio ${mesL(mesRegimen).toLowerCase()}–dic con tus cambios aplicados.` : `Mes típico ${año}: tu vida de hoy llevada a todo el año.`);
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
                  return [...cs.slice(0, 3), [`Otros gastos (${cs.length - 3})`, cs.slice(3).reduce((a, [, v]) => a + v, 0)]];
                })()}
                cashFlow={vista.queda}
                subtitulo={sub}
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
            const grupos = [["ing", "Ingresos", C.ok], ["gas", "Gastos", C.danger], ["deu", "Cuotas", C.warn]];
            return (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>🧾 De dónde sale cada número</div>
                <div style={{ ...F.caption, marginBottom: 10 }}>{foco ? `${mesL(foco.mes)} ${año}` : `Mes típico ${año}`} · ítem por ítem, ordenado de mayor a menor.</div>
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
                        {lista.length === 0 && <div style={{ ...F.caption, marginTop: 6 }}>Nada este mes.</div>}
                        {lista.map((f) => (
                          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...F.body, color: C.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {f.nombre}{f.origen === "nuevo" ? " · nuevo" : f.cambio ? " · con cambio" : ""}
                              </div>
                              <div style={{ ...F.caption, fontSize: 10 }}>
                                {f.capital > 0 && f.tasa > 0 ? `${fm(f.capital)} × ${fmtTasaEs(f.tasa)} ${f.tasaModo === "mensual" ? "mensual" : "anual"}` : f.cat}
                              </div>
                            </div>
                            <span style={{ ...F.mono, fontSize: 12, color: C.text, flexShrink: 0 }}>{fm(f.v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div style={{ ...F.caption, marginTop: 8 }}>
                  Más retención en la fuente {fm(vista.retencion)}{foco ? "" : "/mes"}{vista.impuesto > 0 ? ` y la declaración de renta ${año - 1}: ${fm(vista.impuesto)} este mes` : ""}.
                </div>
              </div>
            );
          })()}
          </div>
        </div>

        {/* ── Acumulado del año y patrimonio ── */}
        <div style={card}>
          <div style={F.h2}>Lo que suma {año} y a dónde llega tu patrimonio</div>
          <div style={F.caption}>Los 12 meses del escenario sumados, comparados con tu vida de hoy llevada a un año completo.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
            {[
              ["Ingresos del año", anual.ingresos, anualHoy.ingresos, C.ok, true],
              ["Gastos del año", anual.gastos, anualHoy.gastos, C.danger, false],
              ["Cuotas del año", anual.cuotas, anualHoy.cuotas, C.warn, false],
              ["Impuestos del año", anual.impuestos, anualHoy.impuestos, C.purple, false],
              [anual.queda >= 0 ? "Saldo a favor del año" : "Faltante del año", anual.queda, anualHoy.queda, anual.queda >= 0 ? C.ok : C.danger, true],
            ].map(([t, v, vh, col, masEsMejor]) => {
              const d = v - vh, bueno = masEsMejor ? d >= 0 : d <= 0;
              return (
                <div key={t} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "10px 12px" }}>
                  <div style={F.label}>{t}</div>
                  <div style={{ ...F.mono, fontSize: 18, color: col }}>{fm(v)}</div>
                  <div style={{ ...F.caption, color: Math.abs(d) < 1 ? C.subtle : bueno ? C.ok : C.danger }}>
                    {Math.abs(d) < 1 ? "igual que hoy" : `${d > 0 ? "+" : "−"}${fm(Math.abs(d))} vs hoy (${fm(vh)})`}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ ...F.caption, marginTop: 8 }}>
            {anual.positivos === 12 ? "Los 12 meses cierran en positivo." : anual.positivos === 0 ? "Ningún mes cierra en positivo." : `${anual.positivos} meses cierran en positivo y ${12 - anual.positivos} en negativo.`}
            {" "}Promedio mensual: {fm(anual.queda / 12)}.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
            <div>
              <div style={F.h3}>Curva del patrimonio en {año}</div>
              <div style={F.caption}>Arranca en tu patrimonio neto de hoy y cada mes suma lo que queda, más el capital de las cuotas que baja la deuda. Sin valorización de activos: solo tu flujo.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={F.label}>Hoy → dic {año}</div>
              <div style={{ ...F.mono, fontSize: 15 }}>
                <span style={{ color: C.muted }}>{fm(snap.patrimonioNeto)}</span> → <span style={{ color: patFin >= snap.patrimonioNeto ? C.ok : C.danger }}>{fm(patFin)}</span>
                <span style={{ ...F.caption, marginLeft: 8, color: patFin >= snap.patrimonioNeto ? C.ok : C.danger }}>{patFin >= snap.patrimonioNeto ? "+" : "−"}{fm(Math.abs(patFin - snap.patrimonioNeto))}{snap.patrimonioNeto > 0 ? ` (${fmtPctEs(((patFin - snap.patrimonioNeto) / snap.patrimonioNeto * 100), 1)})` : ""}</span>
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
                <Area type="monotone" dataKey="pat" name="Patrimonio neto" stroke={CHART.blue} strokeWidth={2} fill="url(#gradBlue)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                {/* Series invisibles: solo para que el tooltip muestre el detalle del mes */}
                <Area yAxisId="oculto" type="monotone" dataKey="queda" name="Queda ese mes" stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                <Area yAxisId="oculto" type="monotone" dataKey="amort" name="Deuda que baja" stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                <Area yAxisId="oculto" type="monotone" dataKey="acum" name="Sobrante acumulado" stroke="none" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...F.caption, marginTop: 6 }}>
            Patrimonio neto hoy: activos {fm(snap.activos)} − deudas {fm(snap.deudasTotales)} = {fm(snap.patrimonioNeto)}.{amortMes > 0 ? ` Capital que baja la deuda: ${fm(amortMes)}/mes mientras haya cuotas.` : ""} Pásate por la curva para ver cada mes.
          </div>
        </div>

        {/* ── Cambios ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={F.h2}>Lo que cambia en {año}</div>
              <div style={F.caption}>Tres verbos: algo termina, algo cambia de monto, algo nuevo entra.</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ing", "gas", "deu"].map((k) => (
                <button key={k} style={btn(false)} onClick={() => setForm({ tipo: "nuevo", kind: k, desdeMes: 1, hastaMes: 12, cat: k === "ing" ? "Salario" : "" })}>
                  + Nuevo {kindL[k]}
                </button>
              ))}
            </div>
          </div>

          {cambios.length === 0 && <div style={{ ...F.body, marginTop: 10 }}>Todavía no hay cambios. Agrega algo nuevo con los botones de arriba, o baja a tu vida de hoy y marca en cada fila qué termina o qué cambia.</div>}
          {cambios.some((c) => c.tipo === "termina" || c.tipo === "cambia" || c.tipo === "meses") && <div style={{ ...F.caption, marginTop: 8 }}>{cambios.filter((c) => c.tipo === "termina" || c.tipo === "cambia" || c.tipo === "meses").length} ajustes sobre tu vida de hoy: se ven marcados en cada fila, abajo.</div>}
          {cambios.filter((c) => c.tipo === "nuevo" || c.tipo === "continua").map((c) => {
            const fila = filas.find((f) => f.key === c.ref) || filas.find((f) => f.key === c.id);
            const nombre = c.tipo === "nuevo" ? c.nombre : (fila?.nombre || "—");
            const texto = c.tipo === "continua" ? (base.find((b) => b.key === c.ref)?.vig?.apagado ? `estaba apagado; cuenta en ${año}` : `sigue en ${año} aunque en ${añoHoy} terminó en ${mesL(base.find((b) => b.key === c.ref)?.vig?.hasta || 12).toLowerCase()}`)
              : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? "no cuenta en todo el año" : `cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`)
              : c.tipo === "cambia" ? `pasa a ${fm(c.monto)} desde ${mesL(c.desdeMes).toLowerCase()}`
              : `entra ${fm(c.monto)}/mes de ${mesL(c.desdeMes).toLowerCase()} a ${mesL(c.hastaMes || 12).toLowerCase()}${Number(c.capital) > 0 && Number(c.tasa) > 0 ? ` (${fm(Number(c.capital))} × ${fmtTasaEs(c.tasa)} ${c.tasaModo === "mensual" ? "mensual" : "anual"})` : ""}`;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
                <span style={{ ...F.label, color: colorK[c.kind], minWidth: 56 }}>{kindL[c.kind]}</span>
                <span style={{ ...F.body, color: C.text, flex: 1 }}><b>{nombre}</b> {texto}</span>
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => quitarCambio(c.id)}>Quitar</button>
              </div>
            );
          })}

          {form && form.tipo === "nuevo" && (
            <div style={{ marginTop: 12, padding: 12, background: C.raised, borderRadius: R.md, border: `1px solid ${C.border}` }}>
              <div style={{ ...F.h3, marginBottom: 8 }}>
                {form.tipo === "nuevo" ? `Nuevo ${kindL[form.kind]}` : form.tipo === "termina" ? `“${form.nombre}” termina` : `“${form.nombre}” cambia de monto`}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {form.tipo === "nuevo" && (<>
                  <div><div style={F.label}>Nombre</div><input style={input} value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={form.kind === "ing" ? "Ej: Nuevo contrato" : form.kind === "gas" ? "Ej: Arriendo nuevo" : "Ej: Crédito carro"} /></div>
                  {form.kind === "ing" && <div><div style={F.label}>Tipo</div><select style={input} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{CATS_ING.map((c) => <option key={c}>{c}</option>)}</select></div>}
                  {form.kind === "ing" && (<>
                    {/* 11-oct-2026 (Santiago: "una inversión nueva no me deja poner
                        capital ni porcentaje y no calcula el monto"). Con capital y
                        tasa el monto mensual se deriva solo, como en Ingresos. */}
                    <div><div style={F.label}>Capital invertido (opcional)</div>
                      <input style={input} type="number" placeholder="Ej: 500000000" value={form.capital || ""} onChange={(e) => {
                        const cap = Number(e.target.value) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, capital: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>% rentabilidad {form.tasaModo === "mensual" ? "mensual" : "anual"}</div>
                      <input style={input} type="number" placeholder={form.tasaModo === "mensual" ? "Ej: 1" : "Ej: 14"} value={form.tasa || ""} onChange={(e) => {
                        const tas = Number(e.target.value) || 0, cap = Number(form.capital) || 0;
                        const nf = { ...form, tasa: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>Periodicidad de la tasa</div>
                      <select style={input} value={form.tasaModo || "anual"} onChange={(e) => {
                        const tm = e.target.value, cap = Number(form.capital) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, tasaModo: tm };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(tm === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }}>
                        <option value="anual">Anual (ej: 14% al año)</option>
                        <option value="mensual">Mensual (ej: 1% al mes)</option>
                      </select></div>
                  </>)}
                  {form.kind === "gas" && <div><div style={F.label}>Categoría</div><input style={input} list="cats-gas" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="Ej: Vivienda" /><datalist id="cats-gas">{Object.keys(user.gastos || {}).map((c) => <option key={c} value={c} />)}</datalist></div>}
                  {form.kind === "deu" && <div><div style={F.label}>Saldo (opcional)</div><input style={input} type="number" value={form.saldo || ""} onChange={(e) => setForm({ ...form, saldo: e.target.value })} /></div>}
                  {owners.length > 1 && <div><div style={F.label}>De quién</div><select style={input} value={form.owner || owners[0].id} onChange={(e) => setForm({ ...form, owner: e.target.value })}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
                </>)}
                {form.tipo !== "termina" && (
                  <div><div style={F.label}>{form.kind === "deu" ? "Cuota mensual" : "Monto mensual (COP)"}</div><input style={input} type="number" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                    {form.kind === "ing" && Number(form.capital) > 0 && Number(form.tasa) > 0 && (
                      <div style={{ ...F.caption, color: C.ok, marginTop: 4 }}>
                        {fm(Number(form.capital))} × {fmtTasaEs(form.tasa)} {form.tasaModo === "mensual" ? "mensual" : "anual"} = {fm(Number(form.monto) || 0)}/mes · {fm((Number(form.monto) || 0) * 12)} al año
                      </div>
                    )}
                  </div>
                )}
                <div><div style={F.label}>{form.tipo === "termina" ? "Último mes que cuenta" : "Desde"}</div>
                  <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                    {MESES.map((m) => <option key={m.v} value={form.tipo === "termina" ? m.v + 1 : m.v}>{m.l}</option>)}
                  </select></div>
                {form.tipo === "nuevo" && (
                  <div><div style={F.label}>Hasta</div>
                    <select style={input} value={form.hastaMes} onChange={(e) => setForm({ ...form, hastaMes: Number(e.target.value) })}>
                      {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select></div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={btn(true)} disabled={form.tipo === "nuevo" && !form.nombre} onClick={() => agregarCambio(form)}>Agregar</button>
                <button style={btn(false)} onClick={() => setForm(null)}>Cancelar</button>
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
                <div style={F.h3}>🆕 {nuevosHoy.length} {nuevosHoy.length === 1 ? "cosa nueva" : "cosas nuevas"} en tus datos de hoy · ¿{nuevosHoy.length === 1 ? "cuenta" : "cuentan"} en {año}?</div>
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
                  <button style={{ ...btn(true), padding: "3px 10px", fontSize: 11 }} onClick={() => setActivo([f.key], true)}>Contar</button>
                  <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => setActivo([f.key], false)}>No</button>
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
const FUENTE_PAGO = {
  calculadora: "de tu Calculadora de declaración",
  real: "de tu declaración ya presentada",
  motor: "estimado con tus ingresos (sin declaración cargada)",
};
function RentaQuePagas({ pago, año, porMes, onNavigate, onVerMes }) {
  const tit = (pago?.titulares || []).filter((t) => t.total > 0 || t.fuente !== "motor");
  if (!tit.length) return null;
  const fecha = (m) => (m.dia ? `${m.dia} ${mesL(m.mes).slice(0, 3).toLowerCase()}` : mesL(m.mes).toLowerCase());
  const falta = pago.porMes.map((v, i) => ({ v, i, queda: porMes[i]?.queda ?? 0 })).filter((x) => x.v > 0 && x.queda < 0);
  const grupos = [["Personas naturales", tit.filter((t) => t.type !== "juridica")], ["Sociedades", tit.filter((t) => t.type === "juridica")]].filter(([, g]) => g.length);
  return (
    <details style={{ marginTop: 10, ...F.caption, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", color: C.muted }}>
        🧾 Renta {año - 1} que pagas en {año}: <b style={{ color: C.text }}>{fm(pago.total)}</b>
        {" · "}{tit.filter((t) => t.total > 0).map((t) => `${t.name} ${t.meses.map(fecha).join(" y ")}`).join(" · ") || "nadie paga"}
        {falta.length > 0 && <span style={{ color: C.danger }}> · ese mes no alcanza</span>}
        <span style={{ color: C.accent }}> · ver detalle</span>
      </summary>
      <div style={{ marginTop: 6 }}>Se paga de una vez al presentar la declaración {año - 1} (saldo + anticipo de {año}), no cada mes.</div>
      {grupos.map(([l, g]) => (
        <div key={l} style={{ marginTop: 8 }}>
          <div style={{ ...F.label, marginBottom: 2 }}>{l}</div>
          {g.map((t) => (
            <div key={t.name} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
              <span>
                <b style={{ color: C.text }}>{t.name}</b> · {FUENTE_PAGO[t.fuente]}
                {t.total <= 0 && t.saldo < 0 ? ` · saldo a favor de ${fm(-t.saldo)}: no paga` : t.anticipo > 0 ? ` · saldo ${fm(t.saldo)} + anticipo ${fm(t.anticipo)}` : ""}
                {t.total > 0 && <> · {t.meses.map((m) => (
                  <button key={m.mes} type="button" onClick={() => onVerMes(m.mes)} style={{ ...F.caption, color: C.accent, background: "none", border: "none", padding: "0 4px", cursor: "pointer", textDecoration: "underline" }}>
                    {fecha(m)}{m.fraccion < 1 ? ` (${fm(t.total * m.fraccion)})` : ""}
                  </button>
                ))}</>}
              </span>
              <span style={{ ...F.mono, color: C.text, fontWeight: 700 }}>{fm(t.total)}</span>
            </div>
          ))}
        </div>
      ))}
      {falta.length > 0 && <div style={{ marginTop: 6, color: C.danger }}>{falta.map((x) => `En ${mesL(x.i + 1).toLowerCase()} te faltan ${fm(-x.queda)}`).join("; ")}: conviene ir apartando desde antes.</div>}
      <div style={{ marginTop: 6 }}>
        La cifra sale de la{" "}
        <button type="button" onClick={() => onNavigate?.("taxcalc")} style={{ ...F.caption, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>Calculadora de declaración</button>; las fechas, de{" "}
        <button type="button" onClick={() => onNavigate?.("prevtax")} style={{ ...F.caption, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>Impuestos › Historial</button>.
      </div>
    </details>
  );
}
