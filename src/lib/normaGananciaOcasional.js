// ════════════════════════════════════════════════════════════════════════════
// Norma de ganancia ocasional por venta de inmuebles — Colombia
//
// 28-oct-2026 (Santiago: "una sección optimizador de ganancia ocasional… que
// conociendo exageradamente bien la norma la actualice incluso en tiempo real
// … que permita diseñar estrategias que ahorren mucho dinero").
//
// TODO lo que cambia por decreto vive AQUÍ, con fuente y fecha de verificación.
// Cuando salga el decreto nuevo (tabla del Art. 73 → abril/mayo de cada año;
// UVT → noviembre/diciembre), se actualiza este archivo y nada más.
// ════════════════════════════════════════════════════════════════════════════

export const NORMA_GO_VERIFICADA = "2026-10-28";

export const FUENTES_GO = [
  { norma: "Art. 300 ET", que: "Venta de activos fijos poseídos 2 años o más = ganancia ocasional" },
  { norma: "Arts. 313 y 314 ET", que: "Tarifa 15% (sociedades y personas naturales, Ley 2277 de 2022)" },
  { norma: "Arts. 69 y 70 ET", que: "Costo fiscal: compra + mejoras + valorización; reajuste anual (5,81% para 2025, Decreto 449 de 2026)" },
  { norma: "Art. 72 ET", que: "Avalúo catastral o autoavalúo del año anterior a la venta como costo (personas y sociedades). No sirve avalúo de perito" },
  { norma: "Art. 73 ET · Decreto 449 de 2026", que: "Solo personas naturales: costo de compra × factor según año de adquisición" },
  { norma: "Art. 311-1 ET", que: "Persona natural, casa o apto de habitación: primeras 5.000 UVT exentas si TODO el dinero va a cuenta AFC o al crédito hipotecario de esa vivienda" },
  { norma: "Concepto DIAN 820 de 2024", que: "Las 5.000 UVT son por la operación completa, no por cada copropietario" },
  { norma: "Arts. 195-196 ET", que: "Depreciación que se recupera al vender = renta ordinaria (35% en sociedades)" },
  { norma: "Art. 49 ET", que: "La ganancia ocasional de la sociedad, después del impuesto, se reparte como dividendo no gravado" },
  { norma: "Art. 90 ET", que: "Se escritura por el precio real; el valor de venta no puede ser menor al costo ni al avalúo catastral" },
  { norma: "Art. 398 ET", que: "Al escriturar, persona natural vendedora: retención del 1% del precio (anticipo del impuesto)" },
];

export const TARIFA_GO = 0.15;            // Arts. 313-314 ET
export const TARIFA_SOCIEDADES = 0.35;    // Art. 240 ET
export const EXENCION_311_1_UVT = 5000;   // Art. 311-1 ET (Ley 2277 de 2022)
export const RETENCION_398 = 0.01;        // Art. 398 ET
export const PCT_ART70_AG = { 2025: 0.0581 }; // Decreto 449 de 2026

// Tabla Art. 73 — año gravable 2025 (Decreto 449 del 27-abr-2026).
// Columnas: urbano · rural agropecuario · demás rural · acciones/aportes.
// Para ventas de 2026, el decreto de AG 2026 sale en 2027: se usa esta tabla
// (resultado conservador: el factor real de 2026 será un poco mayor).
export const TABLA_ART73_AG = 2025;
const T73 = {
  1955: [36085.10, 34963.67, 35631.92, 4664.64], 1956: [35363.86, 34264.84, 34919.74, 4571.26],
  1957: [32744.71, 31727.09, 32333.48, 4232.67], 1958: [27626.91, 26768.34, 27279.95, 3571.20],
  1959: [25257.62, 24472.68, 24940.42, 3264.90], 1960: [23574.13, 22841.51, 23278.07, 3047.31],
  1961: [21981.02, 21297.91, 21704.97, 2856.78], 1962: [20800.81, 20154.38, 20539.58, 2688.94],
  1963: [19429.21, 18825.40, 19185.21, 2511.50], 1964: [14857.22, 14395.49, 14670.63, 1920.42],
  1965: [13600.80, 13178.13, 13429.99, 1758.11], 1966: [11865.93, 11497.16, 11716.90, 1533.84],
  1967: [10462.43, 10137.28, 10331.03, 1352.33], 1968: [9714.61, 9412.70, 9592.60, 1255.75],
  1969: [9113.87, 8830.63, 8999.41, 1178.09], 1970: [8380.22, 8119.79, 8274.98, 1083.26],
  1971: [7823.78, 7580.64, 7725.53, 1011.41], 1972: [6934.19, 6718.70, 6847.11, 896.22],
  1973: [6097.77, 5908.26, 6021.19, 788.01], 1974: [4981.35, 4826.54, 4918.79, 643.73],
  1975: [3981.89, 3858.14, 3931.88, 514.87], 1976: [3386.47, 3281.22, 3343.94, 437.78],
  1977: [2698.90, 2615.02, 2665.00, 349.06], 1978: [2117.65, 2051.84, 2091.05, 273.72],
  1979: [1768.55, 1713.59, 1746.34, 228.64], 1980: [1398.18, 1354.73, 1380.62, 180.64],
  1981: [1121.73, 1086.87, 1107.65, 145.15], 1982: [893.13, 865.38, 881.92, 115.48],
  1983: [717.70, 695.39, 708.68, 92.79], 1984: [616.69, 597.52, 608.94, 79.70],
  1985: [535.17, 518.54, 528.45, 67.49], 1986: [443.02, 429.25, 437.46, 55.27],
  1987: [375.68, 364.01, 370.97, 45.67], 1988: [283.53, 274.72, 279.97, 37.23],
  1989: [176.77, 171.27, 174.55, 29.17], 1990: [122.25, 118.45, 120.71, 23.14],
  1991: [85.19, 82.54, 84.12, 17.54], 1992: [63.81, 61.83, 63.01, 13.82],
  1993: [45.35, 43.94, 44.78, 11.09], 1994: [32.98, 31.96, 32.57, 9.05],
  1995: [23.50, 22.77, 23.20, 7.41], 1996: [17.37, 16.83, 17.15, 6.28],
  1997: [14.41, 13.97, 14.23, 5.41], 1998: [11.07, 10.73, 10.93, 4.61],
  1999: [9.23, 8.94, 9.11, 3.97], 2000: [9.16, 8.88, 9.05, 3.64],
  2001: [8.86, 8.59, 8.75, 3.36], 2002: [8.19, 7.94, 8.09, 3.13],
  2003: [7.35, 7.12, 7.26, 2.93], 2004: [6.92, 6.70, 6.83, 2.75],
  2005: [6.50, 6.29, 6.41, 2.61], 2006: [6.15, 5.96, 6.07, 2.48],
  2007: [4.67, 4.53, 4.62, 2.37], 2008: [4.16, 4.03, 4.11, 2.24],
  2009: [3.43, 3.32, 3.38, 2.07], 2010: [3.12, 3.02, 3.08, 2.03],
  2011: [2.86, 2.77, 2.82, 1.97], 2012: [2.39, 2.32, 2.36, 1.90],
  2013: [2.05, 1.99, 2.03, 1.85], 2014: [1.81, 1.76, 1.79, 1.82],
  2015: [1.68, 1.63, 1.66, 1.75], 2016: [1.60, 1.55, 1.58, 1.64],
  2017: [1.52, 1.48, 1.50, 1.56], 2018: [1.41, 1.36, 1.39, 1.50],
  2019: [1.30, 1.26, 1.28, 1.45], 2020: [1.22, 1.18, 1.21, 1.40],
  2021: [1.16, 1.12, 1.14, 1.38], 2022: [1.12, 1.09, 1.11, 1.30],
  2023: [1.09, 1.06, 1.08, 1.15], 2024: [1.05, 1.03, 1.05, 1.05],
};
const COL = { urbano: 0, rural_agro: 1, rural_otro: 2, acciones: 3 };

/** Factor Art. 73 por año de compra y tipo. 1 si es posterior a la tabla. */
export function factorArt73(anoCompra, tipo = "urbano") {
  const a = Math.floor(Number(anoCompra));
  if (!Number.isFinite(a)) return 1;
  const col = COL[tipo] ?? 0;
  if (a <= 1955) return T73[1955][col];
  if (T73[a]) return T73[a][col];
  return 1;
}

// Reajuste fiscal Art. 70 por año gravable (un decreto cada año). El % del año
// Y aplica a lo poseído en Y y a las ventas hechas en Y. 2023 = 12,40% (Decreto
// 0128 de 2024), 2024 = 10,97% (Decreto 0174 de 2025), 2025 = 5,81% (Decreto 0449 de 2026).
export const PCT_ART70 = {
  1990: 26.64, 1991: 30.04, 1992: 29.81, 1993: 26.20, 1994: 22.08, 1995: 22.31, 1996: 18.00,
  1997: 16.00, 1998: 16.00, 1999: 17.07, 2000: 9.36, 2001: 8.96, 2002: 6.00, 2003: 6.00,
  2004: 6.95, 2005: 6.10, 2006: 4.87, 2007: 5.15, 2008: 7.75, 2009: 3.33, 2010: 2.35,
  2011: 3.65, 2012: 3.04, 2013: 2.40, 2014: 2.89, 2015: 5.21, 2016: 7.08, 2017: 4.07,
  2018: 4.07, 2019: 3.36, 2020: 3.90, 2021: 1.97, 2022: 4.67, 2023: 12.40, 2024: 10.97, 2025: 5.81,
};
export const ULTIMO_AG_ART70 = 2025;

/** Reajuste Art. 70 acumulado: desde el año siguiente a la compra hasta el último decreto. */
export function tablaArt70(anoCompra, costo) {
  const filas = [];
  let acum = Number(costo) || 0, f = 1;
  for (let y = Math.max(Number(anoCompra) + 1, 1990); y <= ULTIMO_AG_ART70; y++) {
    const pct = PCT_ART70[y] || 0;
    f *= 1 + pct / 100; acum *= 1 + pct / 100;
    filas.push({ ano: y, pct, costo: acum });
  }
  return { factor: f, costo: (Number(costo) || 0) * f, filas };
}
