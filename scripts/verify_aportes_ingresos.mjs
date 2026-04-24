// Verificación aislada de la lógica de Commit 1.5
// Replica handleEdit y handleSave de IngresosModule.jsx y prueba invariantes.

function simulateHandleEdit(item) {
  const isSalario = item.categoria === "Salario";
  const mensualNum = Number(item.mensual) || 0;
  const aportePensionGuardado = item.aportes?.pension;
  const aporteSaludGuardado   = item.aportes?.salud;
  const aportePensionForm =
    aportePensionGuardado != null ? String(aportePensionGuardado)
    : (isSalario && mensualNum > 0) ? String(Math.round(mensualNum * 0.04))
    : "";
  const aporteSaludForm =
    aporteSaludGuardado != null ? String(aporteSaludGuardado)
    : (isSalario && mensualNum > 0) ? String(Math.round(mensualNum * 0.04))
    : "";
  return {
    nombre: item.nombre,
    categoria: item.categoria,
    mensual: item.mensual,
    aportePension: aportePensionForm,
    aporteSalud: aporteSaludForm,
  };
}

function simulateHandleSave(form) {
  const isSalario = form.categoria === "Salario";
  // Fix bug rendimiento: derivar mensual si quedó en 0 con capital + tasa
  let mensualFinal = Number(form.mensual) || 0;
  const capitalFinal = Number(form.capital) || 0;
  const tasaFinal = Number(form.tasa) || 0;
  if (mensualFinal === 0 && capitalFinal > 0 && tasaFinal > 0) {
    mensualFinal = Math.round((capitalFinal * tasaFinal / 100) / 12);
  }
  const item = { ...form, mensual: mensualFinal, capital: capitalFinal, tasa: tasaFinal };
  if (isSalario) {
    item.aportes = {
      pension: Number(form.aportePension) || 0,
      salud: Number(form.aporteSalud) || 0,
    };
  }
  delete item.aportePension;
  delete item.aporteSalud;
  return item;
}

// Auto-prefill al cambiar monto (replica el onChange del input)
function simulateOnChangeMonto(form, newMensual) {
  const nf = { mensual: newMensual };
  const m = Number(newMensual) || 0;
  if (form.categoria === "Salario" && m > 0) {
    if (!form.aportePension) nf.aportePension = String(Math.round(m * 0.04));
    if (!form.aporteSalud)   nf.aporteSalud   = String(Math.round(m * 0.04));
  }
  return { ...form, ...nf };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || "mismatch"}\n  expected: ${e}\n  actual:   ${a}`);
}

// ───────── Tests ─────────

test("handleEdit: salario viejo SIN aportes → form se rellena a 4%+4%", () => {
  const viejoSalario = { id: "ing_001", nombre: "Nómina", categoria: "Salario", mensual: 10_000_000 };
  const f = simulateHandleEdit(viejoSalario);
  assertEq(f.aportePension, "400000", "pensión prefill 4%");
  assertEq(f.aporteSalud, "400000", "salud prefill 4%");
});

test("handleEdit: salario nuevo CON aportes explícitos → se respetan", () => {
  const item = { id: "x", nombre: "Nómina", categoria: "Salario", mensual: 10_000_000, aportes: { pension: 350_000, salud: 420_000 } };
  const f = simulateHandleEdit(item);
  assertEq(f.aportePension, "350000");
  assertEq(f.aporteSalud, "420000");
});

test("handleEdit: salario con aporte explícito $0 → se respeta (no vuelve a 4%)", () => {
  const item = { id: "x", nombre: "Indep", categoria: "Salario", mensual: 5_000_000, aportes: { pension: 0, salud: 0 } };
  const f = simulateHandleEdit(item);
  assertEq(f.aportePension, "0");
  assertEq(f.aporteSalud, "0");
});

test("handleEdit: no-salario NO prefillea aportes", () => {
  const arriendo = { id: "x", nombre: "Apto 301", categoria: "Arriendo", mensual: 3_000_000 };
  const f = simulateHandleEdit(arriendo);
  assertEq(f.aportePension, "");
  assertEq(f.aporteSalud, "");
});

test("handleSave: Salario persiste item.aportes y no deja aportePension top-level", () => {
  const form = { nombre: "Nómina", categoria: "Salario", mensual: "10000000", aportePension: "400000", aporteSalud: "400000" };
  const item = simulateHandleSave(form);
  assertEq(item.aportes, { pension: 400000, salud: 400000 });
  if ("aportePension" in item) throw new Error("aportePension no debe persistir top-level");
  if ("aporteSalud" in item) throw new Error("aporteSalud no debe persistir top-level");
});

test("handleSave: no-Salario NO crea item.aportes", () => {
  const form = { nombre: "Arriendo", categoria: "Arriendo", mensual: "3000000", aportePension: "", aporteSalud: "" };
  const item = simulateHandleSave(form);
  if ("aportes" in item) throw new Error("no-Salario no debe tener item.aportes");
});

test("onChange monto: prefillea 4%+4% si categoría Salario y campos vacíos", () => {
  const form = { categoria: "Salario", mensual: "", aportePension: "", aporteSalud: "" };
  const next = simulateOnChangeMonto(form, "8500000");
  assertEq(next.aportePension, "340000");
  assertEq(next.aporteSalud, "340000");
});

test("onChange monto: NO pisa si usuario ya editó aportes", () => {
  const form = { categoria: "Salario", mensual: "5000000", aportePension: "300000", aporteSalud: "200000" };
  const next = simulateOnChangeMonto(form, "7000000");
  assertEq(next.aportePension, "300000", "no debe pisar pensión editada");
  assertEq(next.aporteSalud, "200000", "no debe pisar salud editada");
});

test("onChange monto: no-Salario no prefillea (mantiene campos previos del form)", () => {
  const form = { categoria: "Arriendo", mensual: "", aportePension: "", aporteSalud: "" };
  const next = simulateOnChangeMonto(form, "3000000");
  assertEq(next.aportePension, "", "aportePension no debe cambiarse");
  assertEq(next.aporteSalud, "", "aporteSalud no debe cambiarse");
});

test("cálculo de salario gravable: bruto − aportes", () => {
  const bruto = 10_000_000, pen = 400_000, sal = 400_000;
  const gravable = Math.max(0, bruto - pen - sal);
  assertEq(gravable, 9_200_000);
});

test("FIX bug rendimiento: handleSave deriva mensual si quedó en 0 con capital+tasa", () => {
  // Reproduce el bug reportado: edito un ingreso, pongo %, pero mensual queda en 0.
  // El handler de guardar debe derivarlo como red de seguridad.
  const form = {
    nombre: "CDT Bancolombia",
    categoria: "Rendimientos",
    mensual: "",          // ← quedó vacío, no se recalculó
    capital: "10000000",
    tasa: "15",
  };
  const item = simulateHandleSave(form);
  // Esperado: 10_000_000 * 15 / 100 / 12 = 125_000
  assertEq(item.mensual, 125000, "handleSave debe derivar mensual = capital×tasa/100/12");
});

test("FIX bug rendimiento: mensual=0 numérico también se deriva", () => {
  const form = { nombre: "CDT", categoria: "Rendimientos", mensual: 0, capital: "5000000", tasa: "10" };
  const item = simulateHandleSave(form);
  assertEq(item.mensual, 41667, "5M×10%/100/12 redondeado");
});

test("FIX bug rendimiento: si ya hay mensual cargado, NO lo pisa", () => {
  const form = { nombre: "CDT", categoria: "Rendimientos", mensual: 200000, capital: "10000000", tasa: "15" };
  const item = simulateHandleSave(form);
  // Esperado: respetar el mensual del usuario (200k), no pisar con el cálculo (125k)
  assertEq(item.mensual, 200000, "no pisa mensual existente");
});

test("FIX bug rendimiento: sin capital o sin tasa, no inventa mensual", () => {
  const form1 = { nombre: "x", categoria: "Salario", mensual: 0, capital: "10000000", tasa: "" };
  assertEq(simulateHandleSave(form1).mensual, 0, "sin tasa, mensual queda 0");
  const form2 = { nombre: "x", categoria: "Salario", mensual: 0, capital: "", tasa: "15" };
  assertEq(simulateHandleSave(form2).mensual, 0, "sin capital, mensual queda 0");
});


let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
