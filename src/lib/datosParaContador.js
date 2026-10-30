// ═══════════════════════════════════════════════════════════════════════════
// Lo que el contador ve del cliente (30-oct-2026, Santiago: "sería bueno que el
// contador vea ingresos, gastos, deudas y patrimonio"). Solo lo que el usuario YA
// cargó en FINPATHIA; no se le pide nada nuevo. De gastos van únicamente los que
// cuentan para la declaración; el día a día queda privado.
// ═══════════════════════════════════════════════════════════════════════════
import { totalAnualItem } from "./flowHelpers.js";

export const CATEGORIAS_GASTO_TRIBUTARIAS = ["Aporte tributario", "Inmueble arrendado", "Impuesto", "Seguridad Social"];

export function datosParaContador(u, ownerId) {
  const owners = u?.owners || [];
  const primero = owners[0]?.id === ownerId;
  const esDe = (x) => x?.owner === ownerId || (!x?.owner && primero);
  const fx = (x) => (x?.moneda === "USD" ? Number(u?.trm) || 4200 : 1);
  const n = (v) => Number(v) || 0;
  const ingresos = (u?.ingresos || []).filter((i) => i && i.sim !== false && esDe(i))
    .map((i) => ({ nombre: i.nombre || i.categoria || "Ingreso", tipo: i.categoria || i.tipo || "", anual: n(totalAnualItem(i)) * fx(i) }))
    .filter((x) => x.anual > 0).sort((a, b) => b.anual - a.anual);
  const bienes = (u?.inv || []).filter((i) => i && esDe(i))
    .map((i) => ({ nombre: i.nombre || i.n || "Bien", tipo: i.tp || i.tipo || "", valor: n(i.va) * fx(i) }))
    .filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const deudas = (u?.deu || []).filter((d) => d && !d.pagada && esDe(d))
    .map((d) => ({ nombre: d.n || d.nombre || "Deuda", tipo: d.tp || "", saldo: n(d.mt) * fx(d) }))
    .filter((x) => x.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const gastos = [];
  const juridica = owners.find((o) => o.id === ownerId)?.type === "juridica";
  // Una sociedad declara todos sus costos y gastos; de una persona solo van los que cuentan.
  const cats = juridica ? Object.keys(u?.gas || {}) : CATEGORIAS_GASTO_TRIBUTARIAS;
  for (const cat of cats) {
    for (const g of (u?.gas?.[cat] || [])) {
      if (!g || !esDe(g)) continue;
      const anual = n(totalAnualItem(g)) * fx(g);
      if (anual > 0) gastos.push({ nombre: g.nombre || g.c || cat, cat, anual });
    }
  }
  gastos.sort((a, b) => b.anual - a.anual);
  return { ingresos, bienes, deudas, gastos };
}
