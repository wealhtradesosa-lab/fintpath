/**
 * norteUnMinuto.js — El norte en un minuto (norte.js es el módulo Tu Norte, no tocar) (20-oct-2026).
 *
 * Definición del producto (claude/definicion-producto.md): FINPATHIA es el
 * sistema que te ayuda a alcanzar tu libertad financiera. El primer minuto
 * entrega el norte SIN cuenta: con tres cifras la persona sabe en qué nivel
 * está, cuántos meses de vida tiene cubiertos y cuánto falta para subir.
 *
 * Usa la misma regla de niveles que toda la app (metrics.js · nivelLibertad):
 * el nivel lo define cuánto de tus gastos y cuotas pagan tus activos.
 *
 * Puro: recibe números, devuelve números. Sin React, sin storage.
 */
import { nivelLibertad, NIVELES } from "./metrics.js";

export const RETORNO_SUPUESTO = 0.07; // 7% efectivo anual, neto. Explícito en pantalla.
export const CLAVE_NORTE = "fp3_norte";

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };

/**
 * Años para que un capital C, con aporte mensual A y retorno anual r, genere
 * una renta mensual objetivo R (renta = capital × r / 12). null si no se llega.
 */
export function añosHastaRenta({ capital = 0, aporteMensual = 0, rentaObjetivo = 0, retorno = RETORNO_SUPUESTO }) {
  if (!(rentaObjetivo > 0)) return 0;
  const objetivo = (rentaObjetivo * 12) / retorno; // capital necesario
  if (capital >= objetivo) return 0;
  if (!(aporteMensual > 0) && !(capital > 0)) return null;
  const rm = Math.pow(1 + retorno, 1 / 12) - 1;
  let c = capital, meses = 0;
  while (c < objetivo && meses < 12 * 60) { c = c * (1 + rm) + aporteMensual; meses++; }
  return meses >= 12 * 60 ? null : meses / 12;
}

/**
 * @param {object} d
 * @param {number} d.ingresoTrabajo  lo que ganas al mes por tu trabajo (neto)
 * @param {number} d.ingresoPasivo   lo que te pagan tus activos al mes (arriendos netos, intereses, dividendos)
 * @param {number} d.gastos          gastos + cuotas del mes
 * @param {number} d.ahorrado        lo que tienes ahorrado o invertido (sin la casa donde vives)
 * @param {number} [d.deudas]        saldo total de deudas (opcional; afecta patrimonio neto)
 */
export function calcularNorte(d = {}) {
  const ia = num(d.ingresoTrabajo), ipDeclarado = num(d.ingresoPasivo), ob = num(d.gastos), ahorrado = num(d.ahorrado), deudas = num(d.deudas);
  // Si no declara ingreso pasivo pero sí tiene capital, se estima lo que ese
  // capital puede rendir: así alguien con $100M en un CDT no sale en "cero".
  const ipEstimado = ahorrado * RETORNO_SUPUESTO / 12;
  const ip = ipDeclarado > 0 ? ipDeclarado : ipEstimado;
  const ipFuente = ipDeclarado > 0 ? "declarado" : (ahorrado > 0 ? "estimado" : "ninguno");
  const fl = ia + ip - ob;
  const patrimonioNeto = ahorrado - deudas;
  const nivel = nivelLibertad({ ip, ob, fl, patrimonioNeto });
  const mesesCubiertos = ob > 0 ? ahorrado / ob : null;
  const cobertura = ob > 0 ? (ip / ob) * 100 : 0;

  // Siguiente nivel: cuánta renta pasiva falta y cuántos años tomaría
  // invirtiendo el sobrante actual, y con un extra.
  const sig = nivel.siguiente;
  const rentaFalta = nivel.faltaIPSiguiente || 0;
  // Sobrante en caja: solo flujos reales (sin el rendimiento estimado del
  // capital, que no es plata que llega al bolsillo cada mes).
  const sobrante = Math.max(0, ia + ipDeclarado - ob);
  const añosConSobrante = sig ? añosHastaRenta({ capital: ahorrado, aporteMensual: sobrante, rentaObjetivo: ip + rentaFalta }) : 0;
  // Extra sugerido: 10% del ingreso, redondeado a $50.000.
  const extra = Math.max(50000, Math.round((ia * 0.10) / 50000) * 50000);
  const añosConExtra = sig ? añosHastaRenta({ capital: ahorrado, aporteMensual: sobrante + extra, rentaObjetivo: ip + rentaFalta }) : 0;
  // Independencia total (nivel 5): renta pasiva = gastos
  const añosIndependencia = añosHastaRenta({ capital: ahorrado, aporteMensual: sobrante, rentaObjetivo: ob });

  return {
    entradas: { ingresoTrabajo: ia, ingresoPasivo: ipDeclarado, gastos: ob, ahorrado, deudas },
    ia, ip, ipFuente, ob, fl, sobrante, patrimonioNeto, cobertura, mesesCubiertos,
    nivel: nivel.nivel, nombre: nivel.nombre, candado: nivel.candado, data: nivel.data,
    siguiente: sig, rentaFalta, añosConSobrante, extra, añosConExtra, añosIndependencia,
    niveles: NIVELES,
    retorno: RETORNO_SUPUESTO,
  };
}

/** Guarda / lee el norte calculado en la landing para que el registro lo herede. */
export function guardarNorte(entradas) {
  try { window.sessionStorage.setItem(CLAVE_NORTE, JSON.stringify({ ...entradas, ts: Date.now() })); } catch { /* noop */ }
}
export function leerNorte() {
  try { const o = JSON.parse(window.sessionStorage.getItem(CLAVE_NORTE) || "null"); return o && typeof o === "object" ? o : null; } catch { return null; }
}
export function borrarNorte() {
  try { window.sessionStorage.removeItem(CLAVE_NORTE); } catch { /* noop */ }
}

/**
 * Convierte las tres cifras del norte en los ítems que la app entiende, para
 * que el dashboard muestre el nivel desde el primer segundo. Nombres
 * genéricos a propósito: la persona los afina después.
 */
export function itemsDesdeNorte(entradas, ownerId = "own_1") {
  const e = entradas || {};
  const ia = num(e.ingresoTrabajo), ip = num(e.ingresoPasivo), ob = num(e.gastos), ahorrado = num(e.ahorrado), deudas = num(e.deudas);
  const id = (p) => p + "_" + Math.random().toString(36).slice(2, 8);
  const ingresos = [];
  if (ia > 0) ingresos.push({ id: id("n_ing"), nombre: "Mi ingreso mensual", categoria: "Salario", mensual: ia, tipo: "fijo", fuente: "", owner: ownerId, moneda: "COP" });
  if (ip > 0) ingresos.push({ id: id("n_ip"), nombre: "Lo que me pagan mis activos", categoria: "Rendimiento", mensual: ip, tipo: "fijo", fuente: "", owner: ownerId, moneda: "COP" });
  const gas = ob > 0 ? { "Personal": [{ c: "Mis gastos y cuotas del mes", m: ob, t: "f", owner: ownerId }] } : {};
  const inv = ahorrado > 0 ? [{ id: id("n_inv"), n: "Mis ahorros e inversiones", ub: "Colombia", tp: "Cash", va: ahorrado, vc: ahorrado, tasa: "", owner: ownerId }] : [];
  const deu = deudas > 0 ? [{ id: id("n_deu"), n: "Mis deudas", tp: "loan", mt: deudas, pg: 0, ts: 0, owner: ownerId }] : [];
  return { ingresos, gas, inv, deu };
}
