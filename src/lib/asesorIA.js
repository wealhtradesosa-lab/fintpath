// ═══════════════════════════════════════════════════════════════════════════
// asesorIA.js — Contexto y formato del Asesor IA (funciones puras)
//
// 11-oct-2026. QA encontró que el asesor hacía mal las cuentas ("28% de
// $350K va a intereses", "$12M ahorrando $1,35M/mes son 6 meses") y no veía
// el CDT como liquidez. En vez de pedirle al modelo que calcule, Finpathia le
// pasa ya calculadas las cifras clave con las mismas fórmulas de la app
// (tasa mensual equivalente, amortización, nivel de libertad), y el prompt le
// prohíbe recalcularlas. Se calculan aquí, en el navegador, porque es donde
// están los datos y los totales que la persona ve en pantalla: así el asesor
// y la app dicen lo mismo.
// ═══════════════════════════════════════════════════════════════════════════
import { montoPromedioMensual, promedioMesActivo, tasaMensualEq, vaCOP } from "./flowHelpers.js";

const fm = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
const pc = (n) => (Number(n) || 0).toFixed(1) + "%";
const encendidos = (lista) => (lista || []).filter((x) => x && x.sim !== false);

// Mismos umbrales que el coach Estratega y el reporte (App.jsx).
export const NIVELES = ["Pre-Seguridad", "Seguridad", "Vitalidad", "Independencia", "Libertad", "Libertad Absoluta"];
const UMBRALES = [65, 82.5, 100, 150, 250];

export function nivelLibertad(ind) {
  const i = Number(ind) || 0;
  let nivel = 0;
  UMBRALES.forEach((u, k) => { if (i >= u) nivel = k + 1; });
  return nivel;
}

// Tipos de activo que la app cuenta como liquidez (runway del reporte).
export const TIPOS_LIQUIDOS = ["Cash", "CDT", "Renta Fija", "Fondo de Inversión"];

/** Meses para terminar una deuda pagando solo la cuota (amortización real). */
export function mesesDeuda({ saldo, cuota, tasaEA }) {
  const B = Number(saldo) || 0, P = Number(cuota) || 0;
  if (B <= 0 || P <= 0) return null;
  const r = tasaMensualEq(tasaEA);
  if (r <= 0) return Math.ceil(B / P);
  if (P <= B * r) return Infinity; // la cuota no cubre los intereses
  return Math.ceil(-Math.log(1 - (r * B) / P) / Math.log(1 + r));
}

const pctDe = (parte, total) => (Number(total) > 0 ? pc((Number(parte) || 0) / Number(total) * 100) : "—");

// Factor de egresos que pide cada siguiente nivel = UMBRALES[nivel] / 100
// (mismos factores del coach Estratega: 0,65 · 0,825 · 1 · 1,5 · 2,5).
/** Brecha al siguiente nivel: por ingresos o por egresos, cifras exactas. */
export function brechaNivel({ ni, te, nivel }) {
  if (!(te > 0) || nivel >= 5) return null;
  const factor = UMBRALES[nivel] / 100;
  const ingresoNecesario = te * factor;
  const egresoMaximo = ni / factor;
  return {
    ingresoNecesario,
    faltaIngreso: Math.max(0, ingresoNecesario - ni),
    egresoMaximo,
    bajarEgresos: Math.max(0, te - egresoMaximo),
  };
}

/** Meta y faltante del fondo de emergencia a 3 y 6 meses de egresos totales. */
export function fondoEmergencia({ te, liquidez }) {
  return [3, 6].map((meses) => {
    const meta = meses * (Number(te) || 0);
    return { meses, meta, falta: Math.max(0, meta - (Number(liquidez) || 0)) };
  });
}

/** Qué deuda va primero con avalancha (tasa) y con bola de nieve (saldo). */
export function ordenDeudas(deudas) {
  const ds = (deudas || []).filter((d) => (Number(d.mt) || 0) > 0);
  if (ds.length < 2) return null;
  const nombre = (d) => d.n || d.nombre || "Deuda";
  const avalancha = [...ds].sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))[0];
  const bola = [...ds].sort((a, b) => (Number(a.mt) || 0) - (Number(b.mt) || 0))[0];
  return { coinciden: avalancha === bola, avalancha: nombre(avalancha), bolaDeNieve: nombre(bola) };
}

/** Gastos encendidos por categoría, en monto promedio mensual, de mayor a menor. */
export function gastosPorCategoria(user) {
  return Object.entries((user && user.gas) || {})
    .map(([cat, items]) => ({ cat, total: encendidos(items).reduce((s, g) => s + montoPromedioMensual(g), 0) }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Cifras clave ya calculadas, para que el modelo no haga aritmética. */
export function cifrasClave(user, totals) {
  const u = user || {};
  const t = totals || {};
  const trm = Number(u.trm) || 4200;
  const lineas = [];

  const ni = Number(t.ni) || 0, te = Number(t.te) || 0;
  lineas.push(`• Flujo de caja mensual: ${fm(ni)} (ingresos netos) − ${fm(te)} (egresos totales) = ${fm(ni - te)}`);

  const nivel = nivelLibertad(t.ind);
  if (te > 0) {
    let txt = `• Nivel de libertad financiera en Finpathia: ${NIVELES[nivel]} (nivel ${nivel}/5, índice ${pc(t.ind)} = ingresos netos / egresos totales)`;
    if (nivel < 5) {
      const b = brechaNivel({ ni, te, nivel });
      txt += `. Siguiente nivel: ${NIVELES[nivel + 1]} (índice ${UMBRALES[nivel]}%).` +
        ` Brecha exacta, por ingresos: faltan ${fm(b.faltaIngreso)}/mes de ingresos netos (llegar a ${fm(b.ingresoNecesario)}/mes con los egresos actuales).` +
        ` O, por egresos: con los ingresos actuales, los egresos totales tendrían que bajar ${fm(b.bajarEgresos)}/mes (hasta ${fm(b.egresoMaximo)}/mes)`;
    }
    lineas.push(txt);
  }

  // 11-oct-2026 (QA #35): el modelo daba el % de los egresos como si fuera de
  // los ingresos ("Vivienda 31,8 % de tus ingresos netos"; es el 25,9 %).
  // Se le dan los dos porcentajes, rotulados.
  const gastos = gastosPorCategoria(u);
  if (gastos.length) {
    lineas.push("• Gastos por categoría (monto/mes · % de los ingresos netos · % de los egresos totales):");
    gastos.forEach(({ cat, total }) => {
      lineas.push(`  - ${cat}: ${fm(total)} · ${pctDe(total, ni)} de los ingresos netos · ${pctDe(total, te)} de los egresos totales`);
    });
    const cuotasDeu = Number(t.tc) || 0;
    if (cuotasDeu > 0) lineas.push(`  - Cuotas de deudas: ${fm(cuotasDeu)} · ${pctDe(cuotasDeu, ni)} de los ingresos netos · ${pctDe(cuotasDeu, te)} de los egresos totales`);
  }

  const deudas = encendidos(u.deu).filter((d) => (Number(d.mt) || 0) > 0);
  if (deudas.length) {
    const saldo = deudas.reduce((s, d) => s + (Number(d.mt) || 0), 0);
    const cuotas = deudas.reduce((s, d) => s + (Number(d.pg || d.pago) || 0), 0);
    lineas.push(`• Deudas: saldo total ${fm(saldo)}, cuotas ${fm(cuotas)}/mes` + (ni > 0 ? ` (${pc(cuotas / ni * 100)} de los ingresos netos)` : ""));
    const orden = ordenDeudas(deudas);
    if (orden) {
      lineas.push(orden.coinciden
        ? `  - avalancha y bola de nieve coinciden: ${orden.avalancha} (es la de tasa más alta y también la de saldo más bajo)`
        : `  - avalancha (tasa más alta primero): ${orden.avalancha}; bola de nieve (saldo más bajo primero): ${orden.bolaDeNieve}`);
    }
    lineas.push("  - Un abono extra baja el saldo y los intereses futuros, no la cuota mensual.");
    [...deudas].sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0)).forEach((d) => {
      const saldoD = Number(d.mt) || 0, cuota = Number(d.pg || d.pago) || 0, ts = Number(d.ts) || 0;
      const interes = saldoD * tasaMensualEq(ts);
      const meses = mesesDeuda({ saldo: saldoD, cuota, tasaEA: ts });
      let txt = `  - ${d.n || d.nombre || "Deuda"}: tasa ${ts}% E.A. → interés de este mes ≈ ${fm(interes)}; de la cuota de ${fm(cuota)}, ≈ ${fm(Math.max(0, cuota - interes))} abona a capital`;
      if (meses === Infinity) txt += "; la cuota no alcanza a cubrir los intereses";
      else if (meses) txt += `; pagando solo la cuota termina en ≈ ${meses} meses`;
      lineas.push(txt);
    });
  }

  const liquidos = encendidos(u.inv).filter((i) => TIPOS_LIQUIDOS.includes(i.tp || i.tipo));
  const liquidez = liquidos.reduce((s, i) => s + vaCOP(i, trm), 0);
  if (liquidos.length) {
    let txt = `• Liquidez (${liquidos.map((i) => i.n || i.nombre || i.tp || i.tipo).join(", ")}): ${fm(liquidez)}`;
    if (te > 0) txt += ` = ${(liquidez / te).toFixed(1)} meses de egresos totales`;
    lineas.push(txt);
  }
  if (te > 0) {
    lineas.push("• Fondo de emergencia (meses de egresos totales; la liquidez de arriba cuenta como fondo):");
    fondoEmergencia({ te, liquidez }).forEach(({ meses, meta, falta }) => {
      lineas.push(`  - ${meses} meses = ${fm(meta)}; ${falta > 0 ? `faltan exactamente ${fm(falta)}` : "ya está cubierto"}`);
    });
  }

  return "CIFRAS CALCULADAS POR FINPATHIA (úsalas tal cual):\n" + lineas.join("\n") + "\n";
}

/**
 * Contexto que recibe el asesor. Solo ítems encendidos (sim !== false): lo
 * apagado no existe para ningún cálculo ni análisis. Antes inversiones y
 * deudas apagadas sí entraban.
 */
export function buildContext(user, totals) {
  const u = user || {};
  const t = totals || {};

  let ctx = `RESUMEN PATRIMONIAL:
• Patrimonio neto: ${fm(t.nw)}
• Ingresos netos: ${fm(t.ni)}/mes
• Gastos familiares: ${fm(t.gfm)}/mes
• Cuotas deudas: ${fm(t.tc)}/mes
• Egresos totales: ${fm(t.te)}/mes
• Cash flow: ${fm(t.cf)}/mes
• Índice independencia: ${pc(t.ind)}
• Deuda total: ${fm(t.td)}
• Deuda/Activos: ${pc(t.dta)}
`;

  const inv = encendidos(u.inv);
  if (inv.length) {
    ctx += "\nINVERSIONES Y ACTIVOS:\n";
    inv.forEach((i) => {
      ctx += `• ${i.n || i.nombre || "?"}: ${fm(i.va)}${i.moneda === "USD" ? " (USD)" : ""} (tipo: ${i.tp || i.tipo || "?"})${i.vc ? " costo: " + fm(i.vc) : ""}\n`;
    });
  }

  const ingresos = encendidos(u.ingresos);
  if (ingresos.length) {
    ctx += "\nINGRESOS MENSUALES:\n";
    ingresos.forEach((i) => {
      const mon = i.moneda === "USD" ? " (USD)" : "";
      ctx += `• ${i.nombre || "?"}: ${fm(promedioMesActivo(i))}/mes${mon} (${i.categoria || "?"})${i.capital ? " capital: " + fm(i.capital) + " tasa: " + i.tasa + "%" : ""}\n`;
    });
  }

  // 25-jul-2026: monto promedio mensual (un gasto anual no es mensual) y solo encendidos.
  const gas = u.gas || {};
  const cats = Object.entries(gas)
    .map(([cat, items]) => ({ cat, act: encendidos(items) }))
    .filter((c) => c.act.length);
  if (cats.length) {
    ctx += "\nGASTOS POR CATEGORÍA:\n";
    cats.forEach(({ cat, act }) => {
      const total = act.reduce((s, g) => s + montoPromedioMensual(g), 0);
      ctx += `• ${cat}: ${fm(total)}/mes (${act.length} items)\n`;
    });
  }

  const deu = encendidos(u.deu).filter((d) => (Number(d.mt) || 0) > 0);
  if (deu.length) {
    ctx += "\nDEUDAS:\n";
    deu.forEach((d) => {
      ctx += `• ${d.n || d.nombre || "?"}: saldo ${fm(d.mt)}, cuota ${fm(d.pg || d.pago)}/mes, tasa ${d.ts || 0}% E.A.\n`;
    });
  }

  ctx += "\nNO CARGADO (no lo supongas; pregunta si lo necesitas): edad, ciudad, estrato, personas a cargo, valor de bienes que no estén en la lista de activos.\n";
  ctx += "\n" + cifrasClave(u, t);
  return ctx;
}

/**
 * Normaliza el markdown que el chat no sabe pintar. El prompt pide no usar
 * tablas ni bloques de código, pero si el modelo los manda igual:
 *  · una tabla se vuelve viñetas "- celda · celda" (sin la fila "|---|");
 *  · las cercas ``` se quitan y el contenido queda como texto normal.
 */
export function normalizarMarkdown(texto) {
  const salida = [];
  let encabezado = null;
  for (const linea of String(texto || "").split("\n")) {
    const l = linea.trim();
    if (/^```/.test(l)) continue;
    if (/^\|.*\|$/.test(l)) {
      const celdas = l.slice(1, -1).split("|").map((c) => c.trim());
      if (celdas.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separador
      if (encabezado === null) { encabezado = celdas; salida.push(`**${celdas.filter(Boolean).join(" · ")}**`); continue; }
      salida.push("- " + celdas.filter(Boolean).join(" · "));
      continue;
    }
    encabezado = null;
    salida.push(linea);
  }
  return salida.join("\n");
}
