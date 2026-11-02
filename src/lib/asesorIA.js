// ═══════════════════════════════════════════════════════════════════════════
// asesorIA.js — Cifras precalculadas y formato del Asesor IA (funciones puras)
//
// 11-oct-2026 (QA #35), rehecho sobre main el 2-nov-2026. QA encontró que el
// asesor hacía mal las cuentas ("28% de $350K va a intereses", "$12M
// ahorrando $1,35M/mes son 6 meses") y confundía el % de los egresos con el %
// de los ingresos. En vez de pedirle al modelo que calcule, Finpathia le pasa
// ya calculadas las cifras clave con las fórmulas de la app (tasa mensual
// equivalente, amortización), y el prompt le prohíbe recalcularlas.
//
// El nivel de libertad y el colchón NO se calculan aquí: vienen de metrics.js
// por asesorNivel.js (bloqueNivelLibertad), para que el asesor diga lo mismo
// que el Dashboard. El #35 original traía su propia escala de niveles
// (65/82,5/100…), que ya no existe.
// ═══════════════════════════════════════════════════════════════════════════
import { montoPromedioMensual, tasaMensualEq } from "./flowHelpers.js";

const fm = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-CO");
};
const pc = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("es-CO") + "%";
const encendidos = (lista) => (lista || []).filter((x) => x && x.sim !== false);
const pctDe = (parte, total) => (Number(total) > 0 ? pc((Number(parte) || 0) / Number(total) * 100) : "—");

/** Meses para terminar una deuda pagando solo la cuota (amortización real). */
export function mesesDeuda({ saldo, cuota, tasaEA }) {
  const B = Number(saldo) || 0, P = Number(cuota) || 0;
  if (B <= 0 || P <= 0) return null;
  const r = tasaMensualEq(tasaEA);
  if (!(r > 0)) return Math.ceil(B / P);
  if (P <= B * r) return Infinity; // la cuota no cubre los intereses
  return Math.ceil(-Math.log(1 - (r * B) / P) / Math.log(1 + r));
}

/** Meta y faltante del fondo de emergencia a 3 y 6 meses de gastos + cuotas. */
export function fondoEmergencia({ ob, liquidez }) {
  return [3, 6].map((meses) => {
    const meta = meses * (Number(ob) || 0);
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

/**
 * Cifras clave ya calculadas, para que el modelo no haga aritmética.
 * @param {object} user  datos del usuario
 * @param {object} totals totales de cT (ni, te, tc y metMes/met de metrics.js)
 */
export function cifrasClave(user, totals) {
  const u = user || {};
  const t = totals || {};
  const m = t.metMes || t.met || {};
  const lineas = [];
  const ni = Number(t.ni) || 0, te = Number(t.te) || 0;

  if (ni || te) lineas.push(`• Flujo de caja mensual: ${fm(ni)} (ingresos netos) − ${fm(te)} (egresos totales) = ${fm(ni - te)}`);

  // QA #35: el % de los egresos salía como si fuera de los ingresos. Van los dos, rotulados.
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
      let txt = `  - ${d.n || d.nombre || "Deuda"}: tasa ${pc(ts)} E.A. → interés de este mes ≈ ${fm(interes)} (solo este mes: baja a medida que baja el saldo)`;
      if (cuota > 0) txt += `; de la cuota de ${fm(cuota)}, ≈ ${fm(Math.max(0, cuota - interes))} abona a capital`;
      if (meses === Infinity) txt += "; la cuota no alcanza a cubrir los intereses";
      else if (meses) txt += `; pagando solo la cuota termina en ≈ ${meses} meses`;
      lineas.push(txt);
    });
  }

  // Fondo de emergencia contra gastos + cuotas del mes y la liquidez de
  // metrics.js (las mismas cifras del colchón del Dashboard).
  const ob = Number(m.ob) || 0;
  if (ob > 0) {
    const liquidez = Number(m.liquidos) || 0;
    lineas.push(`• Fondo de emergencia (meses de gastos + cuotas; los activos líquidos ${fm(liquidez)} cuentan como fondo):`);
    fondoEmergencia({ ob, liquidez }).forEach(({ meses, meta, falta }) => {
      lineas.push(`  - ${meses} meses = ${fm(meta)}; ${falta > 0 ? `faltan exactamente ${fm(falta)}` : "ya está cubierto"}`);
    });
  }

  if (!lineas.length) return "";
  return "\nCIFRAS CALCULADAS POR FINPATHIA (úsalas tal cual):\n" + lineas.join("\n") + "\n";
}

/** Lo que el asesor no debe suponer. */
export const NO_CARGADO = "\nNO CARGADO (no lo supongas; pregunta si lo necesitas): edad, ciudad, estrato, personas a cargo, valor de bienes que no estén en la lista de activos.\n";

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
