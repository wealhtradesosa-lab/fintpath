import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generarHallazgos } from "../../src/lib/hallazgos.js";

const qa = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_patrimonio_completo.json", import.meta.url), "utf8"));
const user = { ingresos: qa.ingresos, gas: qa.gas, deu: qa.deu, inv: qa.inv, trm: qa.trm };
const ids = (h) => [...(h.alertas || []), ...(h.buenas || [])].map((x) => x.id);

describe("hallazgos usan el colchón único (3,07 meses en QA Pro, no 1,3)", () => {
  it("QA Pro: 3,07 ≥ 3 meses → no hay alerta de fondo de emergencia", () => {
    expect(ids(generarHallazgos({ user, trm: qa.trm, max: 10 }))).not.toContain("fondo_emergencia");
  });
  it("sin el fondo de inversión líquido el colchón baja a 1,3 y la alerta lo muestra", () => {
    const u = { ...user, inv: qa.inv.filter((i) => i.tp !== "Fondo de Inversión") };
    const h = generarHallazgos({ user: u, trm: qa.trm, max: 10 });
    const f = [...(h.alertas || [])].find((x) => x.id === "fondo_emergencia");
    expect(f.metrica).toBe("1.3");
  });
});
