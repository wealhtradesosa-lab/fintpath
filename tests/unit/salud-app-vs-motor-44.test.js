// #44 — QA vio salud 31 / FL 81.722 en pantalla y 32 / 186.175 "en el motor".
// La diferencia era el fixture: qa_pro_patrimonio_completo.json no trae `owners`,
// así que estimarImpuesto() no calcula impuesto ni retención. Con los datos
// reales guardados (con owners) el motor da exactamente lo que muestra la app:
// impuesto bruto 5.829.335 − retenciones 4.575.900 = saldo 1.253.435/año
// (104.453/mes), que cT() resta como egreso. 186.175 − 104.453 = 81.722.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { calcularMetricas, saludFinanciera } from "../../src/lib/metrics.js";

const u = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_cuenta_real_20261019.json", import.meta.url), "utf8"));

function comoApp(user) {
  const t = estimarImpuesto(user);
  let ib = 0, rt = 0;
  (t.detalle || []).forEach(x => { ib += x.impBruto != null ? x.impBruto : (x.impuesto || 0); rt += x.reteN || 0; });
  const retencionMensual = Math.round(rt / 12);
  const impuestoNeto = Math.max(0, Math.round((ib - rt) / 12));
  const m = calcularMetricas({ ingresos: user.ingresos, gastos: user.gas, deudas: user.deu, inv: user.inv, trm: user.trm || 4200, retencionMensual, impuestoNeto });
  return { ib, rt, impuestoNeto, m, salud: saludFinanciera(m).score };
}

describe("#44 QA Pro: app y motor cuadran con los datos guardados", () => {
  const r = comoApp(u);
  it("ningún arriendo trae meRetienen guardado (opt-in desmarcado)", () => {
    expect(u.ingresos.some(i => i.meRetienen === true)).toBe(false);
  });
  it("saldo a pagar 1.253.435/año → 104.453/mes", () => {
    expect(Math.round(r.ib - r.rt)).toBe(1253435);
    expect(r.impuestoNeto).toBe(104453);
  });
  it("FL 81.722, independencia 17,1%, salud 31", () => {
    expect(r.m.fl).toBe(81722);
    expect(r.m.coberturaPasiva).toBeCloseTo(17.14, 2);
    expect(r.salud).toBe(31);
  });
});
