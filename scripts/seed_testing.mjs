// ═══════════════════════════════════════════════════════════════════════════
// SEED PARA TESTING: Santiago con 3 años de historial
// ─────────────────────────────────────────────────────────────────────────
// Carga un owner persona natural con declaraciones de 2022, 2023 y 2024
// importadas, algunos aportes capturados, y algunos campos faltantes
// INTENCIONALMENTE para que todos los warnings/patrones/tendencias
// disparen al abrir el Plan Tributario.
//
// USO:
//   1. Abrir https://finpathia.com/?debug=1
//   2. DevTools → Console
//   3. Pegar el código de este archivo
//   4. Navegar al tab 'Declaración completa' — verás el owner con
//      histórico y todas las alertas disparadas
//
// NO se ejecuta automáticamente — es un snippet manual para QA.
// ═══════════════════════════════════════════════════════════════════════════

export const SEED_TESTING = `
// ─── Snippet para pegar en Console ─────────────────────────────────────
(() => {
  const KEY = "fp3";
  const existing = JSON.parse(localStorage.getItem(KEY) || "{}");

  const testOwnerId = "test_sosa_natural";

  const declaracion2022 = {
    tipo: "F210",
    anoGravable: "2022",
    uvtDelAno: 38004,
    renglones: {
      salarios: 160_000_000,
      honorarios: 0,
      intereses: 2_400_000,
      arrendamientos: 84_000_000,
      dividendos: 8_000_000,
      aportesObligatorios: 6_400_000,
      exenta25: 28_000_000,
      pvAFC: 15_000_000,       // Aportaba a PV
      interesesVivienda: 8_500_000,
      dependientes: 14_000_000,
      saludPrepagada: 3_600_000,
      gmf50: 380_000,
      retenciones: 8_200_000,
      impuestoRenta: 36_000_000,
      anticipoGenerado: 3_200_000,
    },
    capturadoEn: new Date(2023, 5, 15).toISOString(),
  };

  const declaracion2023 = {
    tipo: "F210",
    anoGravable: "2023",
    uvtDelAno: 42412,
    renglones: {
      salarios: 180_000_000,
      honorarios: 0,
      intereses: 2_800_000,
      arrendamientos: 96_000_000,
      dividendos: 12_000_000,
      aportesObligatorios: 7_200_000,
      exenta25: 32_000_000,
      pvAFC: 18_000_000,       // Siguió aportando a PV
      interesesVivienda: 7_800_000,
      dependientes: 15_000_000,
      saludPrepagada: 4_200_000,
      gmf50: 430_000,
      retenciones: 9_500_000,
      impuestoRenta: 42_000_000,
      anticipoGenerado: 3_800_000,
    },
    capturadoEn: new Date(2024, 5, 15).toISOString(),
  };

  const declaracion2024 = {
    tipo: "F210",
    anoGravable: "2024",
    uvtDelAno: 47065,
    renglones: {
      salarios: 200_000_000,
      honorarios: 0,
      intereses: 3_200_000,
      arrendamientos: 108_000_000,
      dividendos: 15_000_000,
      aportesObligatorios: 8_000_000,
      exenta25: 36_000_000,
      pvAFC: 22_000_000,       // Siguió aportando a PV
      interesesVivienda: 7_200_000,
      dependientes: 16_000_000,
      saludPrepagada: 4_800_000,
      gmf50: 480_000,
      retenciones: 10_500_000,
      impuestoRenta: 48_000_000,
      anticipoGenerado: 4_200_000,
    },
    capturadoEn: new Date(2025, 5, 15).toISOString(),
  };

  const testOwner = {
    id: testOwnerId,
    name: "Santiago TEST",
    type: "natural",
    regimen: "ordinario",
    // INTENCIONALMENTE: no tiene owner.aportes para que dispare el
    // warning APORTES_VOLUNTARIOS_NO_CAPTURADOS (declaró \$22M en PV+AFC
    // en 2024 pero no capturó aportes manuales este año)
    // aportes: { pensionVoluntariaMensual: 0 },

    declaracionesAnteriores: [declaracion2024, declaracion2023, declaracion2022],
    declaracionAnterior: declaracion2024,
  };

  // Ingresos 2025 actuales: subieron 25% vs 2024 ← dispara tendencia
  const testIngresos = [
    { id: "test_ing_salario", categoria: "Salario", mensual: 20_800_000, owner: testOwnerId, moneda: "COP", fiscalCode: "LAB_SALARIO" },
    { id: "test_ing_arriendo", categoria: "Arriendo", mensual: 10_800_000, owner: testOwnerId, moneda: "COP", fiscalCode: "NOL_ARRIENDO_INMUEBLE" },
    // INTENCIONALMENTE: sin intereses ni dividendos este año
    // (año pasado había \$15M de dividendos → dispara patrón "Dividendos ausentes")
  ];

  // Merge con datos existentes sin destruir
  const newOwners = (existing.owners || []).filter(o => o.id !== testOwnerId);
  newOwners.push(testOwner);

  const newIngresos = (existing.ingresos || []).filter(i => i.owner !== testOwnerId);
  newIngresos.push(...testIngresos);

  const updated = {
    ...existing,
    owners: newOwners,
    ingresos: newIngresos,
    gas: existing.gas || {},
    deu: existing.deu || [],
    inv: existing.inv || [],
    trm: existing.trm || 4200,
  };

  localStorage.setItem(KEY, JSON.stringify(updated));
  console.log("%c✅ SEED aplicado", "color: #22c55e; font-weight: bold; font-size: 14px");
  console.log("Owner:", testOwnerId);
  console.log("Declaraciones:", testOwner.declaracionesAnteriores.length, "años de historial");
  console.log("Ingresos 2025:", testIngresos.length, "categorías");
  console.log("");
  console.log("NEXT: Recargar la página (F5) y navegar a:");
  console.log("  · 'Declaración completa' → card de 'Santiago TEST'");
  console.log("  · 'Plan Tributario' → Panel Revisión Fiscal (ver warnings)");
  console.log("  · Abrir F-210 → Paso 5 → ver alertas + patrones + tendencias + sparkline");
  console.log("");
  console.log("Para limpiar: localStorage.removeItem('fp3') y reload");
})();
`;

// Si se corre con node (no se espera, pero por si acaso)
if (typeof window === "undefined" && typeof process !== "undefined") {
  console.log("Este archivo es un snippet manual. Copiá el contenido de SEED_TESTING y pegalo en DevTools Console de finpathia.com");
  console.log("");
  console.log(SEED_TESTING);
}
