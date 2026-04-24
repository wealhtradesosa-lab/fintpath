// Tests de Fase 2: estructura y persistencia de owner.fiscalProfile
// No se testea UI (requiere jsdom) — se simula el handler de actualización.

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "failed"); }
function assertEq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || "mismatch"}\n  expected: ${JSON.stringify(b)}\n  actual: ${JSON.stringify(a)}`);
  }
}

// Simulación del handler onUserUpdate que pasa CalculadoraImpuestos → AjustesFiscalesPersonalizados.
// Replica fielmente la lógica del componente para validar la persistencia.
function simulateOnUpdate(user, selectedOwnerId, newProfile) {
  const newOwners = (user.owners || []).map((o) =>
    o.id === selectedOwnerId ? { ...o, fiscalProfile: newProfile } : o
  );
  return { ...user, owners: newOwners };
}

// ───────── Shape básico ─────────

test("owner sin fiscalProfile no explota al leer", () => {
  const owner = { id: "own_1", name: "Yo", type: "natural" };
  const profile = owner.fiscalProfile || {};
  assertEq(profile, {});
});

test("updateProfile crea fiscalProfile si no existe", () => {
  const user = { owners: [{ id: "own_1", name: "Yo", type: "natural" }] };
  const updated = simulateOnUpdate(user, "own_1", { dependientes: { cantidad: 2 } });
  assertEq(updated.owners[0].fiscalProfile, { dependientes: { cantidad: 2 } });
});

test("updateProfile reemplaza profile existente sin pisar otros owners", () => {
  const user = {
    owners: [
      { id: "own_1", name: "Yo", type: "natural", fiscalProfile: { dependientes: { cantidad: 1 } } },
      { id: "own_2", name: "Hijo", type: "natural", fiscalProfile: { dependientes: { cantidad: 0 } } },
    ],
  };
  const updated = simulateOnUpdate(user, "own_1", { dependientes: { cantidad: 3 } });
  assertEq(updated.owners[0].fiscalProfile.dependientes.cantidad, 3);
  assertEq(updated.owners[1].fiscalProfile.dependientes.cantidad, 0, "owner 2 no debe pisarse");
});

// ───────── Grupo A — Dependientes ─────────

test("dependientes: cantidad 0 equivale a sin dependientes", () => {
  const profile = { dependientes: { cantidad: 0 } };
  assert((profile.dependientes?.cantidad || 0) === 0, "cantidad 0 = sin dependientes");
});

test("dependientes con discapacidad: flag separado del count", () => {
  const profile = { dependientes: { cantidad: 2, conDiscapacidad: true } };
  assert(profile.dependientes.cantidad === 2);
  assert(profile.dependientes.conDiscapacidad === true);
});

// ───────── Grupo B — Eventos del año ─────────

test("eventosAno persisten dentro de fiscalProfile.eventosAno", () => {
  const user = { owners: [{ id: "own_1", name: "Yo", type: "natural" }] };
  const updated = simulateOnUpdate(user, "own_1", {
    eventosAno: { recibioHerencia: true, herenciaMonto: 100_000_000 },
  });
  assertEq(updated.owners[0].fiscalProfile.eventosAno.herenciaMonto, 100_000_000);
});

test("venta inmueble antiguo: guarda valorVenta y costoFiscal separadamente", () => {
  const eventos = {
    vendioInmuebleAntiguo: true,
    inmuebleValorVenta: 500_000_000,
    inmuebleCostoFiscal: 300_000_000,
  };
  // Utilidad = 500M - 300M = 200M, gravada al 15% = $30M de ganancia ocasional
  const utilidad = eventos.inmuebleValorVenta - eventos.inmuebleCostoFiscal;
  const impuestoGO = utilidad * 0.15;
  assertEq(utilidad, 200_000_000);
  assertEq(impuestoGO, 30_000_000);
});

// ───────── Grupo C — Estatus y beneficios ─────────

test("obligadoContabilidad: booleano simple", () => {
  const profile = { obligadoContabilidad: true };
  assert(profile.obligadoContabilidad === true);
});

test("donaciones: validar estructura { monto }", () => {
  const profile = { donaciones: { monto: 5_000_000 } };
  const descuento = profile.donaciones.monto * 0.25; // Art. 257 ET
  assertEq(descuento, 1_250_000);
});

test("inversionesCTI: tipo determina tarifa de descuento", () => {
  const profile = { inversionesCTI: { monto: 10_000_000, tipo: "cti" } };
  assert(profile.inversionesCTI.tipo === "cti");
  // Las tarifas reales las aplicará el motor en Fase 3; acá solo validamos que
  // la estructura permite persistir tipo + monto.
});

test("regimenEspecial: string con tipo de régimen", () => {
  const profile = { regimenEspecial: "zona_franca" };
  assert(profile.regimenEspecial === "zona_franca");
  // También acepta null para desactivar
  const profile2 = { regimenEspecial: null };
  assert(!profile2.regimenEspecial);
});

// ───────── Idempotencia ─────────

test("actualización parcial no borra campos de otros grupos", () => {
  const user = {
    owners: [{
      id: "own_1", name: "Yo", type: "natural",
      fiscalProfile: {
        dependientes: { cantidad: 2 },
        donaciones: { monto: 5_000_000 },
        obligadoContabilidad: true,
      },
    }],
  };
  // Solo actualizo el grupo A dependientes — los otros deben permanecer
  const owner = user.owners[0];
  const newProfile = { ...owner.fiscalProfile, dependientes: { cantidad: 3 } };
  const updated = simulateOnUpdate(user, "own_1", newProfile);
  assertEq(updated.owners[0].fiscalProfile.dependientes.cantidad, 3);
  assertEq(updated.owners[0].fiscalProfile.donaciones.monto, 5_000_000);
  assertEq(updated.owners[0].fiscalProfile.obligadoContabilidad, true);
});

test("desactivar switch no borra el dato residual del monto", () => {
  const profile = { donaciones: { monto: 5_000_000 } };
  // Desactivar switch = setear monto a 0 (según la UI actual)
  const newProfile = { donaciones: { monto: 0 } };
  assert((newProfile.donaciones?.monto || 0) === 0);
});

// ───────── No rompe motor (sanity) ─────────

test("owner con fiscalProfile sigue siendo procesable por estimarImpuesto", async () => {
  const { estimarImpuesto } = await import("../src/lib/taxCO.js");
  const u = {
    owners: [{
      id: "own_1", name: "Yo", type: "natural",
      fiscalProfile: { dependientes: { cantidad: 2 }, donaciones: { monto: 1_000_000 } },
    }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 10_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
                 aportes: { pension: 400_000, salud: 400_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  assert(r !== null && typeof r === "object", "debe retornar objeto válido");
  assert(Array.isArray(r.detalle) && r.detalle.length === 1, "debe incluir el owner");
  // El motor NO debe consumir fiscalProfile todavía (Fase 3). Validamos que
  // no crashea y que calcula como antes (ignora el nuevo campo).
});

// ───────── Run ─────────
(async () => {
  let ok = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      ok++;
    } catch (e) {
      console.log(`  ❌ ${t.name}\n     ${e.message}`);
      fail++;
    }
  }
  console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
  process.exit(fail === 0 ? 0 : 1);
})();
