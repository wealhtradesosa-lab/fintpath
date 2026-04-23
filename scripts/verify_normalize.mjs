// Verificador del normalizador de fiscalCode. Corré con:
//   node scripts/verify_normalize.mjs
//
// Valida que la inferencia desde categorías legacy produce los fiscalCode
// correctos y emite los warnings esperados.

import { normalizeFiscalData, getFiscalWarnings } from "../src/lib/normalize.js";
import {
  LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS,
  CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS,
  NOL_ARRIENDO_INMUEBLE, NOL_OTROS,
  DIV_ART49_GRAVADOS, DIV_INTERSOCIETARIOS, PEN_JUBILACION,
  GAS_NAT_SALUD_MEDICINA, GAS_INMUEBLE_PREDIAL, GAS_INMUEBLE_MANTENIMIENTO,
  GAS_JUR_NOMINA, GAS_JUR_OPERATIVO, GAS_JUR_NO_DEDUCIBLE, GAS_JUR_CAPACITACION,
  DEU_NAT_VIVIENDA_HABITACIONAL, DEU_NAT_CONSUMO, DEU_JUR_PRODUCTIVA,
  INV_INMUEBLE_ARRENDADO, INV_INMUEBLE_COMERCIAL_PROPIO, INV_INMUEBLE_HABITACIONAL,
  INV_CDT, INV_ACCIONES,
  OWN_NAT_RESIDENTE_ORDINARIO, OWN_JUR_ORDINARIO, OWN_JUR_ZONA_FRANCA,
} from "../src/lib/fiscalCodes.js";

let pass = 0, fail = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name}\n    esperado: ${expected}\n    actual:   ${actual}`); }
};

console.log("\n═══ VERIFICADOR NORMALIZE — inferencia de fiscalCode ═══\n");

// ─── 1. Owners
console.log("— Owners:");
{
  const u = { owners: [
    { id: "a", type: "natural", regimen: "ordinario" },
    { id: "b", type: "juridica", regimen: "ordinario" },
    { id: "c", type: "juridica", regimen: "zona_franca" },
  ] };
  const { data } = normalizeFiscalData(u);
  check("natural ordinario → OWN_NAT_RESIDENTE_ORDINARIO", data.owners[0].fiscalCode, OWN_NAT_RESIDENTE_ORDINARIO);
  check("juridica ordinario → OWN_JUR_ORDINARIO", data.owners[1].fiscalCode, OWN_JUR_ORDINARIO);
  check("juridica zona franca → OWN_JUR_ZONA_FRANCA", data.owners[2].fiscalCode, OWN_JUR_ZONA_FRANCA);
}

// ─── 2. Ingresos comunes
console.log("\n— Ingresos:");
{
  const u = {
    owners: [{ id: "s", type: "natural", regimen: "ordinario" }],
    ingresos: [
      { id: "1", categoria: "Salario", owner: "s" },
      { id: "2", categoria: "Honorarios", owner: "s" },
      { id: "3", categoria: "Arriendo", owner: "s" },
      { id: "4", categoria: "Intereses bancarios", owner: "s" },
      { id: "5", categoria: "Utilidad FIC", owner: "s" },
      { id: "6", categoria: "Rendimiento", owner: "s" },
      { id: "7", categoria: "Inversión", owner: "s" },
      { id: "8", categoria: "Dividendos", owner: "s" },
      { id: "9", categoria: "Pensión", owner: "s" },
      { id: "10", categoria: "Algo raro", owner: "s" },
    ],
  };
  const { data } = normalizeFiscalData(u);
  check("Salario → LAB_SALARIO", data.ingresos[0].fiscalCode, LAB_SALARIO);
  check("Honorarios (sin regimenHonorarios) → LAB_HONORARIOS_SIN_EMPLEADOS", data.ingresos[1].fiscalCode, LAB_HONORARIOS_SIN_EMPLEADOS);
  check("Arriendo → NOL_ARRIENDO_INMUEBLE", data.ingresos[2].fiscalCode, NOL_ARRIENDO_INMUEBLE);
  check("Intereses bancarios → CAP_INTERESES_BANCARIOS", data.ingresos[3].fiscalCode, CAP_INTERESES_BANCARIOS);
  check("Utilidad FIC → CAP_FIC", data.ingresos[4].fiscalCode, CAP_FIC);
  check("Rendimiento → CAP_RENDIMIENTO_GENERICO", data.ingresos[5].fiscalCode, CAP_RENDIMIENTO_GENERICO);
  check("Inversión → CAP_VENTA_ACTIVOS", data.ingresos[6].fiscalCode, CAP_VENTA_ACTIVOS);
  check("Dividendos (natural) → DIV_ART49_GRAVADOS", data.ingresos[7].fiscalCode, DIV_ART49_GRAVADOS);
  check("Pensión → PEN_JUBILACION", data.ingresos[8].fiscalCode, PEN_JUBILACION);
  check("Desconocido → NOL_OTROS", data.ingresos[9].fiscalCode, NOL_OTROS);
}

// ─── 3. Honorarios con régimen declarado
console.log("\n— Honorarios con regimenHonorarios:");
{
  const u = {
    owners: [{ id: "s", type: "natural", regimen: "ordinario", regimenHonorarios: "con_empleados" }],
    ingresos: [{ id: "1", categoria: "Honorarios", owner: "s" }],
  };
  const { data } = normalizeFiscalData(u);
  check("Honorarios con 2+ empleados → LAB_HONORARIOS_CON_EMPLEADOS", data.ingresos[0].fiscalCode, LAB_HONORARIOS_CON_EMPLEADOS);
}

// ─── 4. Dividendos — owner jurídica
console.log("\n— Dividendos según owner type:");
{
  const u = {
    owners: [{ id: "j", type: "juridica", regimen: "ordinario" }],
    ingresos: [{ id: "1", categoria: "Dividendos", owner: "j" }],
  };
  const { data } = normalizeFiscalData(u);
  check("Dividendos (jurídica) → DIV_INTERSOCIETARIOS", data.ingresos[0].fiscalCode, DIV_INTERSOCIETARIOS);
}

// ─── 5. Gastos natural
console.log("\n— Gastos natural:");
{
  const u = {
    owners: [{ id: "s", type: "natural", regimen: "ordinario" }],
    gas: {
      "Salud": [{ id: "g1", cat: "Salud", m: 100000, owner: "s" }],
      "Predial": [{ id: "g2", cat: "Predial", m: 50000, owner: "s" }],
      "Mantenimiento": [{ id: "g3", cat: "Mantenimiento", m: 30000, owner: "s" }],
    },
  };
  const { data } = normalizeFiscalData(u);
  check("Salud (natural) → GAS_NAT_SALUD_MEDICINA", data.gas["Salud"][0].fiscalCode, GAS_NAT_SALUD_MEDICINA);
  check("Predial (natural) → GAS_INMUEBLE_PREDIAL", data.gas["Predial"][0].fiscalCode, GAS_INMUEBLE_PREDIAL);
  check("Mantenimiento (natural) → GAS_INMUEBLE_MANTENIMIENTO", data.gas["Mantenimiento"][0].fiscalCode, GAS_INMUEBLE_MANTENIMIENTO);
}

// ─── 6. Gastos jurídica
console.log("\n— Gastos jurídica:");
{
  const u = {
    owners: [{ id: "j", type: "juridica", regimen: "ordinario" }],
    gas: {
      "Nómina": [{ id: "g1", cat: "Nómina", m: 1000000, owner: "j" }],
      "Servicios": [{ id: "g2", cat: "Servicios", m: 500000, owner: "j" }],
      "Educación": [{ id: "g3", cat: "Educación", m: 800000, owner: "j" }],
      "Alimentación": [{ id: "g4", cat: "Alimentación", m: 200000, owner: "j" }],
    },
  };
  const { data, warnings } = normalizeFiscalData(u);
  check("Nómina (juridica) → GAS_JUR_NOMINA", data.gas["Nómina"][0].fiscalCode, GAS_JUR_NOMINA);
  check("Servicios (juridica) → GAS_JUR_OPERATIVO", data.gas["Servicios"][0].fiscalCode, GAS_JUR_OPERATIVO);
  check("Educación (juridica) → GAS_JUR_CAPACITACION", data.gas["Educación"][0].fiscalCode, GAS_JUR_CAPACITACION);
  check("Alimentación (juridica) → GAS_JUR_NO_DEDUCIBLE", data.gas["Alimentación"][0].fiscalCode, GAS_JUR_NO_DEDUCIBLE);
  // Warning de causalidad ambigua para Educación en jurídica
  const hasWarning = warnings.some(w => w.code === "GASTO_JURIDICA_CAUSALIDAD_AMBIGUA");
  check("warning 'causalidad ambigua' emitido para Educación jurídica", hasWarning, true);
}

// ─── 7. Deudas
console.log("\n— Deudas:");
{
  const u = {
    owners: [
      { id: "n", type: "natural", regimen: "ordinario" },
      { id: "j", type: "juridica", regimen: "ordinario" },
    ],
    deu: [
      { id: "d1", tp: "mortgage", n: "Hipoteca casa", owner: "n" },
      { id: "d2", tp: "credit_card", n: "Visa", owner: "n" },
      { id: "d3", tp: "mortgage", n: "Hipoteca edificio", owner: "j" },
    ],
  };
  const { data } = normalizeFiscalData(u);
  check("Hipoteca (natural) → DEU_NAT_VIVIENDA_HABITACIONAL", data.deu[0].fiscalCode, DEU_NAT_VIVIENDA_HABITACIONAL);
  check("Tarjeta (natural) → DEU_NAT_CONSUMO", data.deu[1].fiscalCode, DEU_NAT_CONSUMO);
  check("Hipoteca (juridica) → DEU_JUR_PRODUCTIVA", data.deu[2].fiscalCode, DEU_JUR_PRODUCTIVA);
}

// ─── 8. Inversiones
console.log("\n— Inversiones:");
{
  const u = {
    owners: [
      { id: "n", type: "natural", regimen: "ordinario" },
      { id: "j", type: "juridica", regimen: "ordinario" },
    ],
    ingresos: [
      { id: "i1", categoria: "Arriendo", owner: "n" },
    ],
    inv: [
      { id: "x1", tp: "Real Estate", owner: "n" }, // natural con arriendo → arrendado
      { id: "x2", tp: "Real Estate", owner: "j" }, // jurídica sin arriendo → comercial propio
      { id: "x3", tp: "CDT", owner: "n" },
      { id: "x4", tp: "Acciones", owner: "n" },
    ],
  };
  const { data } = normalizeFiscalData(u);
  check("Real Estate natural con arriendo → INV_INMUEBLE_ARRENDADO", data.inv[0].fiscalCode, INV_INMUEBLE_ARRENDADO);
  check("Real Estate juridica → INV_INMUEBLE_COMERCIAL_PROPIO", data.inv[1].fiscalCode, INV_INMUEBLE_COMERCIAL_PROPIO);
  check("CDT → INV_CDT", data.inv[2].fiscalCode, INV_CDT);
  check("Acciones → INV_ACCIONES", data.inv[3].fiscalCode, INV_ACCIONES);
}

// ─── 9. fiscalCode explícito NO se sobrescribe
console.log("\n— fiscalCode explícito tiene prioridad:");
{
  const u = {
    owners: [{ id: "s", type: "natural", regimen: "ordinario" }],
    ingresos: [{ id: "1", categoria: "Arriendo", fiscalCode: "CAP_ARRIENDO_MUEBLE", owner: "s" }],
  };
  const { data } = normalizeFiscalData(u);
  check("fiscalCode ya asignado se respeta (no infiere)", data.ingresos[0].fiscalCode, "CAP_ARRIENDO_MUEBLE");
}

// ─── 10. Warnings
console.log("\n— Warnings generales:");
{
  const u = {
    owners: [{ id: "s", type: "natural", regimen: "ordinario" }],
    ingresos: [
      { id: "i1", categoria: "Salario", owner: "" },  // sin owner
      { id: "i2", categoria: "Honorarios", owner: "s" }, // sin regimenHonorarios
      { id: "i3", categoria: "Arriendo", owner: "s" },   // info de inferencia
    ],
  };
  const warnings = getFiscalWarnings(u);
  check("warning INGRESO_SIN_PROPIETARIO presente", warnings.some(w => w.code === "INGRESO_SIN_PROPIETARIO"), true);
  check("warning HONORARIOS_SIN_REGIMEN_DECLARADO presente", warnings.some(w => w.code === "HONORARIOS_SIN_REGIMEN_DECLARADO"), true);
  check("info ARRIENDO_INFERIDO_INMUEBLE presente", warnings.some(w => w.code === "ARRIENDO_INFERIDO_INMUEBLE"), true);
}

// ─── 11. User null no rompe
console.log("\n— Edge cases:");
{
  const { data, warnings } = normalizeFiscalData(null);
  check("user=null devuelve data=null sin crashear", data, null);
  check("user=null devuelve warnings vacío", warnings.length, 0);
}

// ═════════════════════════════════════════════════════════════════════════
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${pass} pasan, ${fail} fallan\n`);
process.exit(fail === 0 ? 0 : 1);
