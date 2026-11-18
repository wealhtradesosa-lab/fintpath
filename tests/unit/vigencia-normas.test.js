import { describe, it, expect } from "vitest";
import { normasPendientes, ULTIMA_REVISION_NORMATIVA } from "../../src/lib/vigenciaNormas.js";

const ids = (fecha) => normasPendientes(new Date(fecha + "T12:00:00")).map((p) => p.id);

describe("Vigencia de normas", () => {
  it("hoy (28-oct-2026) está al día", () => {
    expect(ids("2026-10-28")).toEqual([]);
  });
  it("desde el 10 de diciembre pide la UVT del año siguiente", () => {
    expect(ids("2026-12-15")).toContain("uvt");
  });
  it("en 2027 sin UVT 2027 es alerta alta", () => {
    const p = normasPendientes(new Date("2027-01-05T12:00:00")).find((x) => x.id === "uvt");
    expect(p.gravedad).toBe("alta");
  });
  it("después de junio pide el reajuste y la tabla del año anterior", () => {
    expect(ids("2027-07-01")).toEqual(expect.arrayContaining(["art70", "art73"]));
  });
  it("EE. UU.: desde el 10 de diciembre pide el año fiscal siguiente del IRS", () => {
    // 18-nov-2026: el año fiscal 2027 ya está cargado (Rev. Proc. 2026-35).
    expect(ids("2026-12-15")).not.toContain("irs");
    expect(ids("2027-11-02")).not.toContain("irs");
    expect(ids("2027-12-15")).toContain("irs");
  });
  it("EE. UU.: en 2028 con el año fiscal 2027 es alerta alta", () => {
    const p = normasPendientes(new Date("2028-01-05T12:00:00")).find((x) => x.id === "irs");
    expect(p.gravedad).toBe("alta");
  });
  it("avisa si el revisor deja de correr", () => {
    // Relativo a la última revisión (antes era una fecha fija que dejaba de
    // cumplir los 21 días cuando el revisor corría a tiempo).
    const base = new Date(ULTIMA_REVISION_NORMATIVA + "T12:00:00");
    const masAdelante = (dias) => new Date(base.getTime() + dias * 86400000).toISOString().slice(0, 10);
    expect(ids(masAdelante(10))).not.toContain("revision");
    expect(ids(masAdelante(25))).toContain("revision");
  });
});

// Guardia real: si hoy falta algo grave, esta prueba falla y se nota antes de publicar.
describe("Guardia de hoy", () => {
  it("no hay normas vencidas de gravedad alta", () => {
    expect(normasPendientes().filter((p) => p.gravedad === "alta")).toEqual([]);
  });
});
