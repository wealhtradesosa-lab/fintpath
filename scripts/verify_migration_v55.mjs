// Verificación aislada Commit 5.5 — migrateDeclaracionesV55 + invariantes de FIFO

import { migrateDeclaracionesV55, MAX_DECLARACIONES } from "../src/lib/migrations.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertEq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || "mismatch"}\n  expected: ${JSON.stringify(b)}\n  actual:   ${JSON.stringify(a)}`);
  }
}

// ───────── Constante ─────────

test("MAX_DECLARACIONES = 3", () => {
  assertEq(MAX_DECLARACIONES, 3);
});

// ───────── Migración básica ─────────

test("migrate: owner.declaracionAnterior singular → declaraciones[0]", () => {
  const u = {
    owners: [{
      id: "own_1", name: "Yo", type: "natural",
      declaracionAnterior: { tipo: "F210", anoGravable: 2024, renglones: { ingresosBrutos: 240_000_000 } },
    }],
  };
  migrateDeclaracionesV55(u);
  const ow = u.owners[0];
  assert(Array.isArray(ow.declaraciones), "debe crear array");
  assertEq(ow.declaraciones.length, 1);
  assertEq(ow.declaraciones[0].anoGravable, 2024);
  assert(ow.declaracionAnterior === undefined, "declaracionAnterior debe borrarse");
  assertEq(u.migratedDeclaracionesV55, true);
});

test("migrate: idempotente (2 veces = 1 sola)", () => {
  const u = {
    owners: [{
      id: "own_1", type: "natural",
      declaracionAnterior: { tipo: "F210", anoGravable: 2024, renglones: {} },
    }],
  };
  migrateDeclaracionesV55(u);
  migrateDeclaracionesV55(u);
  assertEq(u.owners[0].declaraciones.length, 1);
});

test("migrate: sin declaracionAnterior no hace nada", () => {
  const u = { owners: [{ id: "own_1", type: "natural" }] };
  migrateDeclaracionesV55(u);
  assert(u.owners[0].declaraciones === undefined || u.owners[0].declaraciones.length === 0);
  assertEq(u.migratedDeclaracionesV55, true);
});

test("migrate: si ya existe declaraciones[] respeta y borra singular", () => {
  const u = {
    owners: [{
      id: "own_1", type: "natural",
      declaracionAnterior: { tipo: "F210", anoGravable: 2022, renglones: {} },
      declaraciones: [
        { tipo: "F210", anoGravable: 2024, renglones: {} },
        { tipo: "F210", anoGravable: 2023, renglones: {} },
      ],
    }],
  };
  migrateDeclaracionesV55(u);
  // Respeta el array existente, no agrega el singular ni lo pisa
  assertEq(u.owners[0].declaraciones.length, 2);
  assertEq(u.owners[0].declaraciones[0].anoGravable, 2024);
  assert(u.owners[0].declaracionAnterior === undefined, "singular debe borrarse igual");
});

// ───────── Ordenamiento y recorte ─────────

test("migrate: ordena descendente por año", () => {
  const u = {
    owners: [{
      id: "own_1", type: "natural",
      declaraciones: [
        { tipo: "F210", anoGravable: 2022, renglones: {} },
        { tipo: "F210", anoGravable: 2024, renglones: {} },
        { tipo: "F210", anoGravable: 2023, renglones: {} },
      ],
    }],
  };
  migrateDeclaracionesV55(u);
  const anos = u.owners[0].declaraciones.map((d) => d.anoGravable);
  assertEq(anos, [2024, 2023, 2022]);
});

test("migrate: recorta a MAX_DECLARACIONES (3) — descarta los más viejos", () => {
  const u = {
    owners: [{
      id: "own_1", type: "natural",
      declaraciones: [
        { tipo: "F210", anoGravable: 2020, renglones: {} },
        { tipo: "F210", anoGravable: 2024, renglones: {} },
        { tipo: "F210", anoGravable: 2021, renglones: {} },
        { tipo: "F210", anoGravable: 2023, renglones: {} },
        { tipo: "F210", anoGravable: 2022, renglones: {} },
      ],
    }],
  };
  migrateDeclaracionesV55(u);
  assertEq(u.owners[0].declaraciones.length, 3);
  const anos = u.owners[0].declaraciones.map((d) => d.anoGravable);
  assertEq(anos, [2024, 2023, 2022], "queda con los 3 más recientes");
});

// ───────── Multi-owner ─────────

test("migrate: procesa múltiples owners independientemente", () => {
  const u = {
    owners: [
      { id: "own_1", type: "natural", declaracionAnterior: { tipo: "F210", anoGravable: 2024, renglones: {} } },
      { id: "own_2", type: "juridica", declaracionAnterior: { tipo: "F110", anoGravable: 2023, renglones: {} } },
      { id: "own_3", type: "natural" }, // sin declaración
    ],
  };
  migrateDeclaracionesV55(u);
  assertEq(u.owners[0].declaraciones.length, 1);
  assertEq(u.owners[0].declaraciones[0].tipo, "F210");
  assertEq(u.owners[1].declaraciones.length, 1);
  assertEq(u.owners[1].declaraciones[0].tipo, "F110");
  assert(!u.owners[2].declaraciones || u.owners[2].declaraciones.length === 0);
});

// ───────── Edge cases ─────────

test("migrate: null/undefined no explota", () => {
  assertEq(migrateDeclaracionesV55(null), null);
  assertEq(migrateDeclaracionesV55(undefined), undefined);
});

test("migrate: owners vacío no explota", () => {
  const u = { owners: [] };
  migrateDeclaracionesV55(u);
  assertEq(u.migratedDeclaracionesV55, true);
});

test("migrate: sin owners (campo ausente) no explota", () => {
  const u = {};
  migrateDeclaracionesV55(u);
  assertEq(u.migratedDeclaracionesV55, true);
});

// ───────── Simular handler de App.jsx (FIFO con reemplazo por año) ─────────

function simulateFifoHandler(ownerDeclaraciones, nuevaDecl) {
  const actuales = Array.isArray(ownerDeclaraciones) ? [...ownerDeclaraciones] : [];
  const anoNuevo = Number(nuevaDecl.anoGravable) || 0;
  const idxMismoAno = actuales.findIndex((d) => Number(d?.anoGravable) === anoNuevo);
  if (idxMismoAno >= 0) {
    actuales[idxMismoAno] = nuevaDecl;
  } else {
    actuales.push(nuevaDecl);
  }
  actuales.sort((a, b) => (Number(b?.anoGravable) || 0) - (Number(a?.anoGravable) || 0));
  return actuales.slice(0, 3);
}

test("FIFO: primera declaración queda al frente", () => {
  const r = simulateFifoHandler([], { tipo: "F210", anoGravable: 2024, renglones: {} });
  assertEq(r.length, 1);
  assertEq(r[0].anoGravable, 2024);
});

test("FIFO: mismo año reemplaza in-place (no duplica)", () => {
  const existente = [{ tipo: "F210", anoGravable: 2024, renglones: { x: 1 } }];
  const r = simulateFifoHandler(existente, { tipo: "F210", anoGravable: 2024, renglones: { x: 999 } });
  assertEq(r.length, 1);
  assertEq(r[0].renglones.x, 999);
});

test("FIFO: 4to año desplaza al más viejo", () => {
  const existente = [
    { tipo: "F210", anoGravable: 2024, renglones: {} },
    { tipo: "F210", anoGravable: 2023, renglones: {} },
    { tipo: "F210", anoGravable: 2022, renglones: {} },
  ];
  const r = simulateFifoHandler(existente, { tipo: "F210", anoGravable: 2025, renglones: {} });
  assertEq(r.length, 3);
  assertEq(r.map((d) => d.anoGravable), [2025, 2024, 2023]);
});

test("FIFO: insertar año intermedio mantiene orden descendente", () => {
  const existente = [
    { tipo: "F210", anoGravable: 2024, renglones: {} },
    { tipo: "F210", anoGravable: 2022, renglones: {} },
  ];
  const r = simulateFifoHandler(existente, { tipo: "F210", anoGravable: 2023, renglones: {} });
  assertEq(r.map((d) => d.anoGravable), [2024, 2023, 2022]);
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
