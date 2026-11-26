// 26-nov-2026 (Santiago: "uno al pararse en cualquier ítem de patrimonio, ingreso o gasto vea la ficha completa y entienda
// si está conectado a algo. Por ejemplo District: conectado a deuda District, ingreso District y gasto property management
// District"; "uno ver qué cosas tienen conexiones"; "¿cómo puede existir un ingreso o inversión sin conexiones?").
// Qué está conectado a qué, y qué está suelto por error. Solo lee los datos; no cambia nada.
//   conectado → tiene su inversión (o la inversión tiene ingresos, gastos o deuda)
//   libre     → no necesita conexión: un salario, el mercado, una tarjeta
//   revisar   → debería salir de una inversión y está suelto: un arriendo, un predial, una hipoteca
import { montoPromedioMensual } from "./flowHelpers.js";
import { esLaboral } from "./metrics.js";
import { claveIngreso, claveGasto, sugerirVinculados, sugerirActivoDeDeuda, deudaActivo } from "./futuro10.js";

const sinT = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ING_DE_ACTIVO = /arriend|alquiler|renta|dividend|interes|rendimient|rent\b|rental|interest|utilidad/;
const GAS_DE_ACTIVO = /predial|property management|hoa\b|administracion|property tax|valorizacion/;
const DEU_DE_ACTIVO = /hipotec|mortgage|leasing|vehicul|carro|auto loan/;
const fxDe = (user) => (x) => (String((x && x.moneda) || "").toUpperCase() === "USD" ? Number(user.trm) || 4200 : 1);

/**
 * Mapa de conexiones de los datos del usuario.
 * → { activos: { id: { ingresos, gastos, deudas, sugeridos } }, ingresos: [{ k, key, nombre, mensual, activoId, estado, sugiere }],
 *     gastos: [{ cat, idx, key, … }], deudas: [{ k, id, nombre, saldo, cuota, activoId, estado, sugiere }] }
 * Plata en la moneda base (USD × trm), al mes.
 */
export function mapaConexiones(user = {}, cfg = {}) {
  const fx = fxDe(user), inv = (user.inv || []).filter((a) => a && a.id), existe = new Set(inv.map((a) => a.id));
  const nomA = (id) => { const a = inv.find((q) => q.id === id); return a ? a.n || a.nombre || "" : ""; };
  const activos = {}; inv.forEach((a) => { activos[a.id] = { id: a.id, nombre: nomA(a.id), ingresos: [], gastos: [], deudas: [], sugeridos: [] }; });
  // Lo que por el nombre parece de cada inversión (solo para proponerlo: nunca se conecta solo).
  const sugIng = {}, sugGas = {};
  inv.forEach((a) => { const s = sugerirVinculados(user, a.id);
    s.ingresos.filter((x) => x.sugerido).forEach((x) => { (sugIng[x.key] = sugIng[x.key] || []).push(a.id); });
    s.gastos.filter((x) => x.sugerido).forEach((x) => { (sugGas[x.key] = sugGas[x.key] || []).push(a.id); }); });
  const una = (l) => (l && l.length === 1 ? l[0] : null);

  const ingL = user.ingresos || [], ingresos = [];
  ingL.forEach((i, k) => {
    if (!i || i.sim === false) return;
    const key = claveIngreso(ingL, k), activoId = i.activoId && existe.has(i.activoId) ? i.activoId : null, sugiere = activoId ? null : una(sugIng[key]);
    const pareceDeActivo = !esLaboral(i) && (ING_DE_ACTIVO.test(sinT(`${i.categoria || ""} ${i.nombre || ""}`)) || /^(CAP_|DIV_|NOL_ARRIENDO_)/.test(String(i.fiscalCode || "")));
    const x = { k, key, nombre: i.nombre || i.categoria || "", mensual: montoPromedioMensual(i) * fx(i), activoId, sugiere, desdePatrimonio: !!i.desdePatrimonio,
      estado: activoId ? "conectado" : !esLaboral(i) && (sugiere || pareceDeActivo) ? "revisar" : "libre" };
    ingresos.push(x);
    if (activoId) activos[activoId].ingresos.push(x); else if (sugiere) activos[sugiere].sugeridos.push({ tipo: "ingreso", ...x });
  });

  const gastos = [];
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false) return;
    const key = claveGasto(cat, items, idx), nombre = g.c || g.n || g.nombre || cat, activoId = g.activoId && existe.has(g.activoId) ? g.activoId : null, sugiere = activoId ? null : una(sugGas[key]);
    const x = { cat, idx, key, nombre, mensual: montoPromedioMensual(g) * fx(g), activoId, sugiere,
      estado: activoId ? "conectado" : sugiere || GAS_DE_ACTIVO.test(sinT(nombre)) ? "revisar" : "libre" };
    gastos.push(x);
    if (activoId) activos[activoId].gastos.push(x); else if (sugiere) activos[sugiere].sugeridos.push({ tipo: "gasto", ...x });
  }));

  const deudas = [];
  (user.deu || []).forEach((d, k) => {
    if (!d || d.sim === false) return;
    const nombre = d.n || d.nombre || "", de = deudaActivo(d, cfg), activoId = de && existe.has(de) ? de : null;
    const sg = activoId ? null : sugerirActivoDeDeuda(nombre, inv), sugiere = sg ? (typeof sg === "string" ? sg : sg.id) || null : null;
    const x = { k, id: d.id, nombre, saldo: (Number(d.mt ?? d.saldo) || 0) * fx(d), cuota: (Number(d.pg ?? d.pago) || 0) * fx(d), activoId, sugiere: sugiere && existe.has(sugiere) ? sugiere : null,
      estado: activoId ? "conectado" : (sugiere && existe.has(sugiere)) || DEU_DE_ACTIVO.test(sinT(nombre + " " + (d.tp || d.tipo || ""))) ? "revisar" : "libre" };
    deudas.push(x);
    if (activoId) activos[activoId].deudas.push(x); else if (x.sugiere) activos[x.sugiere].sugeridos.push({ tipo: "deuda", ...x });
  });
  return { activos, ingresos, gastos, deudas, nombreActivo: nomA };
}

/** La cuenta de una inversión con lo que tiene conectado: lo que te deja al mes y lo que es tuyo. */
export function cuentaDeActivo(mapa, id, valorHoy = 0) {
  const a = (mapa.activos || {})[id] || { ingresos: [], gastos: [], deudas: [], sugeridos: [] };
  const sum = (l, c) => l.reduce((s, x) => s + (x[c] || 0), 0);
  const entra = sum(a.ingresos, "mensual"), sale = sum(a.gastos, "mensual"), cuotas = sum(a.deudas, "cuota"), debes = sum(a.deudas, "saldo");
  return { ...a, entra, sale, cuotas, deja: entra - sale - cuotas, debes, valor: valorHoy, tuyo: valorHoy - debes, conexiones: a.ingresos.length + a.gastos.length + a.deudas.length };
}
