/**
 * contrarianHome.js — Alerta única del coach Contrarian para el Dashboard.
 *
 * Misma lógica determinística que getCoach("contrarian") en App.jsx
 * (errores en el mismo orden = prioridad). No reescribe getCoach en este PR;
 * el home card usa TRM real del estado (sin hardcodear 4200).
 */
import { montoPromedioMensual, vaCOP } from "./flowHelpers.js";
import { tx, esUS } from "./region.js";
import { nombreCategoria } from "./infografia.js";

const num = (v) => Number(v) || 0;

/**
 * @returns {null | {
 *   id: string,
 *   message: string,
 *   ctaPage: string,
 *   ctaLabel: string,
 *   advId?: string | null
 * }}
 */
export function getTopContrarianAlert(user, totales, trm) {
  if (!user || !totales) return null;
  const t = totales;
  const rate = num(trm) > 0 ? num(trm) : null;
  // Si aún no hay TRM en estado, no inventamos 4200 en código nuevo:
  // tratamos USD como 1× (mejor que un hardcode falso). getCoach legacy sigue aparte.
  const usdMul = rate || 1;

  const inv = (user.inv || []).filter((i) => i.sim !== false);
  const deu = (user.deu || []).filter((d) => d.sim !== false);
  const ing = (user.ingresos || []).filter((i) => i.sim !== false);
  const gas = {};
  Object.entries(user.gas || {}).forEach(([cat, items]) => {
    const fi = (items || []).filter((g) => g.sim !== false);
    if (fi.length > 0) gas[cat] = fi;
  });

  const pasivos = ing.filter((i) =>
    ["Arriendo", "Rendimiento", "Dividendos", "Inversión"].includes(i.categoria)
  );
  const activos = ing.filter(
    (i) => !["Arriendo", "Rendimiento", "Dividendos", "Inversión"].includes(i.categoria)
  );
  const ingPasivo = pasivos.reduce(
    (s, i) => s + num(i.mensual) * (i.moneda === "USD" ? usdMul : 1),
    0
  );
  const ingActivo = activos.reduce(
    (s, i) => s + num(i.mensual) * (i.moneda === "USD" ? usdMul : 1),
    0
  );
  const ni = num(t.ni) || ingPasivo + ingActivo;
  const pctPasivo = ni > 0 ? (ingPasivo / ni) * 100 : 0;

  const runway =
    num(t.te) > 0
      ? Math.round(
          inv
            .filter((i) => ["Cash", "CDT", "Renta Fija"].includes(i.tp || i.tipo) || /hysa|savings|money market|t-bill/i.test(String(i.tp || i.tipo || "")))
            .reduce((s, i) => s + vaCOP(i, rate || usdMul), 0) / t.te
        )
      : 0;

  const reVal = inv
    .filter((i) => (i.tp || i.tipo) === "Real Estate")
    .reduce((s, i) => s + vaCOP(i, rate || usdMul), 0);
  const rePct = num(t.nw) > 0 ? (reVal / t.nw) * 100 : 0;

  const gasCats = Object.entries(gas)
    .map(([cat, items]) => ({
      cat,
      total: items.reduce((s, g) => s + montoPromedioMensual(g), 0),
    }))
    .sort((a, b) => b.total - a.total);

  const hiDebt = deu.filter((d) => num(d.mt) > 0).sort((a, b) => num(b.ts) - num(a.ts));
  const worstDebt = hiDebt[0];
  const bigG = gasCats.find((g) => ni > 0 && g.total > ni * 0.25);
  const dta = num(t.dta);

  // Orden = prioridad (igual que getCoach contrarian)
  const alerts = [];
  if (rePct > 60) {
    alerts.push({
      id: "re_concentration",
      message: tx(`Concentración inmobiliaria ${rePct.toFixed(0)}% — no compres más inmuebles.`, `Real estate is ${rePct.toFixed(0)}% of your net worth — don't buy more property.`),
      ctaPage: "inv",
      ctaLabel: tx("Ver patrimonio", "View assets"),
      advId: null,
    });
  }
  if (100 - pctPasivo > 80) {
    alerts.push({
      id: "work_dependency",
      message: tx(`${(100 - pctPasivo).toFixed(0)}% depende de trabajo — si te enfermas, pierdes casi todo.`, `${(100 - pctPasivo).toFixed(0)}% of your income depends on working — if you get sick, you lose almost all of it.`),
      ctaPage: "coach",
      ctaLabel: tx("Ver tu nivel", "See your level"),
      advId: "estratega",
    });
  }
  if (runway < 6) {
    alerts.push({
      id: "runway",
      message: tx(`Solo ${runway} meses de runway — mínimo 6 meses líquidos.`, `Only ${runway} months of runway — keep at least 6 months liquid.`),
      ctaPage: "inv",
      ctaLabel: tx("Ver liquidez", "View cash"),
      advId: null,
    });
  }
  if (worstDebt && num(worstDebt.ts) > 15) {
    alerts.push({
      id: "expensive_debt",
      message: tx(`Deuda al ${worstDebt.ts}%${esUS() ? " APR" : ""} (${worstDebt.n || "crédito"}) — págala primero.`, `Debt at ${worstDebt.ts}%${esUS() ? " APR" : ""} (${worstDebt.n || "loan"}) — pay it off first.`),
      ctaPage: "deu",
      ctaLabel: tx("Ver deudas", "View debts"),
      advId: null,
    });
  }
  if (bigG) {
    alerts.push({
      id: "big_expense",
      message: tx(`${nombreCategoria(bigG.cat)} = ${((bigG.total / ni) * 100).toFixed(0)}% del ingreso — máx. recomendado 25%.`, `${nombreCategoria(bigG.cat)} = ${((bigG.total / ni) * 100).toFixed(0)}% of income — 25% max recommended.`),
      ctaPage: "gas",
      ctaLabel: tx("Ver gastos", "View expenses"),
      advId: null,
    });
  }
  if (dta > 50) {
    alerts.push({
      id: "high_da",
      message: tx(`Deuda/Activos ${dta.toFixed(1)}% — más de la mitad está financiada con deuda.`, `Debt/Assets ${dta.toFixed(1)}% — more than half is financed with debt.`),
      ctaPage: "deu",
      ctaLabel: tx("Revisar deudas", "Review debts"),
      advId: null,
    });
  }

  return alerts[0] || null;
}

/** ¿Hay datos suficientes para mostrar la tarjeta? */
export function hasContrarianHomeData(user) {
  if (!user) return false;
  return (
    (user.inv && user.inv.length > 0) ||
    (user.deu && user.deu.length > 0) ||
    (user.ingresos && user.ingresos.length > 0) ||
    Object.keys(user.gas || {}).length > 0
  );
}
