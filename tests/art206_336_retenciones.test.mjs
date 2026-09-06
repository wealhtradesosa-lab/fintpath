// ═════════════════════════════════════════════════════════════════════════
// F1 / F2 / F3 — Art.206 25%, Art.336 (40% + 1340 UVT), retenciones→saldo
// AG 2025 · UVT = 49.799
// Ejecutar: node tests/art206_336_retenciones.test.mjs
// ═════════════════════════════════════════════════════════════════════════

import {
  estimarImpuesto,
  uvtForYear,
  TOPE_EXENTA25_UVT,
  TOPE_ART336_UVT,
} from "../src/lib/taxCO.js";

const AG = 2025;
const UVT = uvtForYear(AG);
const assert = (cond, msg) => {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ✓", msg);
};
const approx0 = (n, tol = 1) => Math.abs(n) <= tol;

console.log("═".repeat(70));
console.log(`Fixtures Art.206 / 336 / retenciones — AG ${AG} UVT=${UVT}`);
console.log("Pipeline: bruto → (−) no constit. → deducciones → 25% 206 (790 UVT/año)");
console.log("          → tope 336 min(40%,1340 UVT) → Art.241 → (−) retenciones → saldo");
console.log("═".repeat(70));

assert(UVT === 49799, "UVT AG 2025 = 49799");
assert(TOPE_EXENTA25_UVT === 790, "tope Art.206 = 790 UVT/año");
assert(TOPE_ART336_UVT === 1340, "tope Art.336 absoluto = 1340 UVT");
assert(790 * UVT === 39_341_210, "790×49799 = 39_341_210");
assert(1340 * UVT === 66_730_660, "1340×49799 = 66_730_660");

// ── F1 — Contador ~$0 (retenciones cubren a cargo) ───────────────────────
console.log("\nF1 — neto laboral ~120M, retenciones ≥ a cargo → saldo ≈ 0");
{
  // Target neto ≈ 120M. Con aportes 4%+4% como no-const pensión (salud sí suma):
  // motor: noConstSalPens = aPens*12, noConstSalSalud = aSalud*12.
  // neto = sal - (pens+salud)*12. Para neto=120M con 4%+4%: sal = 120M/0.92.
  const netoTarget = 120_000_000;
  const mensual = Math.round((netoTarget / 0.92) / 12);
  const aportesMes = Math.round(mensual * 0.04);
  // Retenciones reales (contador): cubren con holgura el a cargo típico
  const retencionesContador = 12_000_000;
  const user = {
    owners: [{
      id: "o1", name: "Synth F1 Contador0", type: "natural",
      descuentosTributarios: { retencionesEsperadasAnual: retencionesContador },
    }],
    ingresos: [{
      id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO",
      mensual, moneda: "COP",
      aportes: { pension: aportesMes, salud: aportesMes },
    }],
    gastos: [], deudas: [], inversiones: [],
  };
  const d = estimarImpuesto(user, { añoGravable: AG }).detalle[0];
  const cap790 = TOPE_EXENTA25_UVT * UVT;
  const tope336 = Math.min(d.neto * 0.40, TOPE_ART336_UVT * UVT);

  assert(d.exenta25 > 0, `exenta25 aplicada (${Math.round(d.exenta25)})`);
  assert(d.exenta25 <= cap790 + 1, `exenta25 ≤ 790 UVT (${cap790})`);
  assert(Math.abs(d.lim40 - tope336) < 1, `lim40 = min(40% neto, 1340 UVT) → ${Math.round(d.lim40)}`);
  assert(d.benAplic <= d.lim40 + 1, "benef ≤ tope 336 (nunca suma sin tope)");
  assert(d.impuestoACargo > 0 || d.impBruto > 0, `a cargo > 0 (${Math.round(d.impuestoACargo ?? d.impBruto)})`);
  assert(d.reteN >= (d.impuestoACargo ?? d.impBruto) - 1 || d.reteN === retencionesContador,
    `retenciones (${d.reteN}) cubren o son override contador`);
  assert(approx0(d.saldoAPagar ?? d.impuesto), `saldo ≈ 0 (got ${d.saldoAPagar ?? d.impuesto})`);
  assert((d.impuestoACargo ?? d.impBruto) > (d.saldoAPagar ?? d.impuesto),
    "a cargo ≠ saldo: nunca presentar solo a cargo como si fuera a pagar");
  console.log("   ", {
    neto: Math.round(d.neto),
    exenta25: Math.round(d.exenta25),
    lim40: Math.round(d.lim40),
    aCargo: Math.round(d.impuestoACargo ?? d.impBruto),
    reteN: Math.round(d.reteN),
    saldo: Math.round(d.saldoAPagar ?? d.impuesto),
  });
}

// ── F2 — 25% + tope 336 con bag que empuja el techo ───────────────────────
console.log("\nF2 — high labor + dep + prepagada + PV → benef = min(suma, 40%, 1340 UVT)");
{
  // Motor lee u.gas (por categoría), no u.gastos[].
  // Bag grande: 25% (790 UVT) + dep + prepagada + PV/AFC → debe pegar 1340 UVT
  // (40% de neto alto > 1340 UVT, así el absoluto es el que bindea).
  const mensual = 30_000_000; // 360M/año bruto → neto ~331M → 40% ~132M > 1340 UVT
  const user = {
    owners: [{
      id: "o1", name: "Synth F2 Tope336", type: "natural",
      fiscalProfile: { dependientes: { cantidad: 2 } },
    }],
    ingresos: [{
      id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO",
      mensual, moneda: "COP",
      aportes: { pension: Math.round(mensual * 0.04), salud: Math.round(mensual * 0.04) },
    }],
    gas: {
      "Salud": [
        { id: "g1", owner: "o1", fiscalCode: "AP_TRIB_SALUD_PREPAGADA", m: 1_500_000 },
      ],
      "Aporte tributario": [
        { id: "g2", owner: "o1", fiscalCode: "AP_TRIB_PV", m: 6_000_000 },
        { id: "g3", owner: "o1", fiscalCode: "AP_TRIB_AFC", m: 4_000_000 },
      ],
    },
    deudas: [], deu: [], inversiones: [], inv: [],
  };
  const d = estimarImpuesto(user, { añoGravable: AG }).detalle[0];
  const expectedTope = Math.min(d.neto * 0.40, TOPE_ART336_UVT * UVT);
  assert(Math.abs(d.lim40 - expectedTope) < 1, `lim40 correcto (${Math.round(d.lim40)})`);
  assert(d.exenta25 <= TOPE_EXENTA25_UVT * UVT + 1, "25% capped at 790 UVT/año");
  assert(d.benefLaboralSinTope >= d.benAplic - 1, "sinTope ≥ aplicado");
  assert(d.benAplic <= expectedTope + 1, "benef = min(suma, tope336) — nunca sin cap");
  assert(d.benefLaboralSinTope > expectedTope + 1000,
    `bag sin tope (${Math.round(d.benefLaboralSinTope)}) supera techo (${Math.round(expectedTope)})`);
  assert(Math.abs(d.benAplic - expectedTope) < 1, "tope 336 BINDEÁ (1340 UVT < 40%)");
  assert(expectedTope === TOPE_ART336_UVT * UVT, "en F2 el techo absoluto 1340 UVT es el binding");
  console.log("   ", {
    neto: Math.round(d.neto),
    lim40Pct: Math.round(d.lim40Pct),
    lim1340: Math.round(d.lim1340),
    sinTope: Math.round(d.benefLaboralSinTope),
    benAplic: Math.round(d.benAplic),
    exenta25: Math.round(d.exenta25),
  });
}

// ── F3 — regresión sin Art.206 25% → a cargo debe subir vs F1 ────────────
console.log("\nF3 — mismo F1 sin Art.206 → a cargo ↑");
{
  const netoTarget = 120_000_000;
  const mensual = Math.round((netoTarget / 0.92) / 12);
  const aportesMes = Math.round(mensual * 0.04);
  const baseUser = {
    owners: [{ id: "o1", name: "Synth F3", type: "natural" }],
    ingresos: [{
      id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO",
      mensual, moneda: "COP",
      aportes: { pension: aportesMes, salud: aportesMes },
    }],
    gastos: [], deudas: [], inversiones: [],
  };
  const con206 = estimarImpuesto(baseUser, { añoGravable: AG }).detalle[0];
  const sin206 = estimarImpuesto(baseUser, { añoGravable: AG, omitirExenta25: true }).detalle[0];
  const aCon = con206.impuestoACargo ?? con206.impBruto;
  const aSin = sin206.impuestoACargo ?? sin206.impBruto;
  assert(con206.exenta25 > 0, "con 206: exenta25 > 0");
  assert(sin206.exenta25 === 0, "sin 206: exenta25 = 0");
  assert(aSin > aCon, `a cargo sin 206 (${Math.round(aSin)}) > con 206 (${Math.round(aCon)})`);
  console.log("   ", { aCargoCon206: Math.round(aCon), aCargoSin206: Math.round(aSin), delta: Math.round(aSin - aCon) });
}

console.log("\n" + "═".repeat(70));
console.log("ALL FIXTURES PASSED");
console.log("═".repeat(70));
