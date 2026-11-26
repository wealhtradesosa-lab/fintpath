// ═══════════════════════════════════════════════════════════════════════════
// Lo que el contador ve del cliente (30-oct-2026, Santiago: "sería bueno que el
// contador vea ingresos, gastos, deudas y patrimonio"). Solo lo que el usuario YA
// cargó en FINPATHIA; no se le pide nada nuevo. De gastos van únicamente los que
// cuentan para la declaración; el día a día queda privado.
// ═══════════════════════════════════════════════════════════════════════════
import { totalAnualItem } from "./flowHelpers.js";
import { trmCierreAno } from "./trm.js";
import { DEFAULT_AG } from "./taxCO.js";

export const CATEGORIAS_GASTO_TRIBUTARIAS = ["Aporte tributario", "Inmueble arrendado", "Impuesto", "Seguridad Social"];

// 24-nov-2026 — El informe sale de Impuestos: los montos en dólares van con la
// TRM del 31-dic del año gravable (Art. 269 ET; TRM_CIERRE_ANO, el mismo
// DEFAULT_AG del borrador F-210), no con la TRM de hoy ni con el respaldo
// provisional. Si esa tasa no existe, el ítem queda «pendiente de tasa»: valor 0
// en pesos (no entra al total), `usd` con el monto en dólares y `pendienteTasa`.
export function datosParaContador(u, ownerId, ano = DEFAULT_AG) {
  const owners = u?.owners || [];
  const primero = owners[0]?.id === ownerId;
  const esDe = (x) => x?.owner === ownerId || (!x?.owner && primero);
  const tasa = trmCierreAno(u, ano);
  const n = (v) => Number(v) || 0;
  const usd = (x) => x?.moneda === "USD";
  // { [campo]: pesos (0 si falta la tasa), usd?, pendienteTasa? } — `bruto` es el monto como se cargó.
  const conv = (x, campo, bruto) => {
    if (!usd(x)) return { [campo]: bruto };
    if (tasa == null) return { [campo]: 0, usd: bruto, pendienteTasa: true };
    return { [campo]: bruto * tasa, usd: bruto };
  };
  const hay = (x, campo) => x[campo] > 0 || x.usd > 0;
  const orden = (campo) => (a, b) => (b[campo] - a[campo]) || ((b.usd || 0) - (a.usd || 0));
  const ingresos = (u?.ingresos || []).filter((i) => i && i.sim !== false && esDe(i))
    .map((i) => ({ nombre: i.nombre || i.categoria || "Ingreso", tipo: i.categoria || i.tipo || "", ...conv(i, "anual", n(totalAnualItem(i))) }))
    .filter((x) => hay(x, "anual")).sort(orden("anual"));
  const bienes = (u?.inv || []).filter((i) => i && esDe(i))
    .map((i) => ({ nombre: i.nombre || i.n || "Bien", tipo: i.tp || i.tipo || "", ...conv(i, "valor", n(i.va)) }))
    .filter((x) => hay(x, "valor")).sort(orden("valor"));
  const deudas = (u?.deu || []).filter((d) => d && !d.pagada && esDe(d))
    .map((d) => ({ nombre: d.n || d.nombre || "Deuda", tipo: d.tp || "", ...conv(d, "saldo", n(d.mt)) }))
    .filter((x) => hay(x, "saldo")).sort(orden("saldo"));
  const gastos = [];
  const juridica = owners.find((o) => o.id === ownerId)?.type === "juridica";
  // Una sociedad declara todos sus costos y gastos; de una persona solo van los que cuentan.
  const cats = juridica ? Object.keys(u?.gas || {}) : CATEGORIAS_GASTO_TRIBUTARIAS;
  for (const cat of cats) {
    for (const g of (u?.gas?.[cat] || [])) {
      if (!g || !esDe(g)) continue;
      const x = { nombre: g.nombre || g.c || cat, cat, ...conv(g, "anual", n(totalAnualItem(g))) };
      if (hay(x, "anual")) gastos.push(x);
    }
  }
  gastos.sort(orden("anual"));
  const hayUSD = [ingresos, bienes, deudas, gastos].some((l) => l.some((x) => x.usd != null));
  return { ingresos, bienes, deudas, gastos, ano, tasa, hayUSD };
}
