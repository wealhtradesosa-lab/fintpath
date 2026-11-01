// 1-nov-2026 — fix/trm-renta. El motor de renta (taxCO.js) y los borradores
// F-210/F-110 convierten los USD con la tasa real (trmUsable). Nunca 4200: sin
// tasa, los USD quedan fuera y el resultado se marca «pendiente de tasa».
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { generarBorradorF210 } from "../../src/lib/borradorDeclaracionF210.js";
import { usdPendienteDeTasa, NOTA_TRM_PENDIENTE } from "../../src/lib/trm.js";

const nat = { id: "o1", name: "Luis", type: "natural" };
const user = (ingresos, trm, owners = [nat], inv = []) => ({ trm, owners, ingresos, gas: {}, deu: [], inv });
// 1.000 USD una vez al año → el total anual del ítem es 1.000 USD.
const usdAnual = (fc, id = fc, owner = "o1") => ({ id, owner, nombre: fc, fiscalCode: fc, mensual: 1000, frecuencia: "anual", moneda: "USD", tipo: "fijo" });
const det = (u, name = "Luis") => estimarImpuesto(u, { ag: 2025 }).detalle.find((d) => d.name === name);

describe("TRM real en el motor de renta", () => {
  it("«Ganaste»: 1.000 USD de salario a 3.158 = $3.158.000", () => {
    const d = det(user([usdAnual("LAB_SALARIO", "sal")], 3158));
    expect(d.ingreso).toBe(3_158_000);
    expect(d.pendienteTasa).toBe(false);
  });

  it("honorarios en USD también se convierten (antes entraban como si fueran pesos)", () => {
    const d = det(user([usdAnual("LAB_HONORARIOS_SIN_EMPLEADOS", "hon")], 3158));
    expect(d.ingreso).toBe(3_158_000);
  });

  it("sin tasa real (vacía o la provisional 4200): los USD quedan fuera y se marca pendiente de tasa", () => {
    for (const trm of [undefined, 0, 4200]) {
      const u = user([usdAnual("LAB_SALARIO", "sal"), { id: "cop", owner: "o1", nombre: "Arriendo", fiscalCode: "CAP_ARRENDAMIENTO", mensual: 1_000_000, tipo: "fijo" }], trm);
      const r = estimarImpuesto(u, { ag: 2025 });
      const d = r.detalle.find((x) => x.name === "Luis");
      expect(r.pendienteTasa).toBe(true);
      expect(d.pendienteTasa).toBe(true);
      expect(d.ingresosPendientesTasa.map((i) => i.id)).toEqual(["sal"]);
      // Solo cuentan los pesos: nada de 1.000 × 4.200 = 4.200.000
      expect(d.ingreso).toBe(12_000_000);
      expect(usdPendienteDeTasa(u)).toBe(true);
    }
  });

  it("con tasa real no hay aviso", () => {
    const u = user([usdAnual("LAB_SALARIO", "sal")], 3158);
    expect(estimarImpuesto(u, { ag: 2025 }).pendienteTasa).toBe(false);
    expect(usdPendienteDeTasa(u)).toBe(false);
    expect(NOTA_TRM_PENDIENTE).toContain("pendiente de tasa");
  });

  it("persona jurídica: el ingreso en USD usa la tasa real y nunca 4200", () => {
    const jur = { id: "j1", name: "SAS", type: "juridica" };
    const ingJ = { ...usdAnual("ING_OPERACIONALES", "op", "j1") };
    const conTasa = det(user([ingJ], 3158, [jur]), "SAS");
    const sinTasa = det(user([ingJ], 4200, [jur]), "SAS");
    expect(conTasa.ingreso).toBe(3_158_000);
    expect(sinTasa.ingreso).toBe(0);
    expect(sinTasa.pendienteTasa).toBe(true);
  });

  it("borrador F-210: el activo en USD se valora con la tasa real; sin tasa queda fuera", () => {
    const inv = [{ id: "c", owner: "o1", nombre: "Cuenta USD", fiscalCode: "INV_CUENTA_BANCARIA", va: 1000, moneda: "USD" }];
    const r29 = (trm) => {
      const u = user([{ id: "s", owner: "o1", nombre: "Salario", fiscalCode: "LAB_SALARIO", mensual: 5_000_000, tipo: "fijo" }], trm, [nat], inv);
      return generarBorradorF210(u, nat, estimarImpuesto(u, { ag: 2025 }), 2025).find((x) => x.numero === 291)?.valor;
    };
    expect(r29(3158)).toBe(3_158_000);
    expect(r29(4200)).toBe(0);
    expect(r29(undefined)).toBe(0);
  });
});
