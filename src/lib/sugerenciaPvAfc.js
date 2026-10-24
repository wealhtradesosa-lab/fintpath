// sugerenciaPvAfc.js — fuente única del aporte sugerido a PV/AFC y su ahorro.
// Acuerdo (Tributario, Finanzas, Cosmo): la tarjeta del simulador y las
// recomendaciones estratégicas muestran el MISMO aporte y el MISMO ahorro.
//   aporte = aporte optimizado de taxCO (detalle.pensionVol)
//   ahorro = impuesto a cargo sin aporte − con ese aporte (impBruto − impOptBruto)
export function sugerenciaPvAfcDe(det) {
  if (!det) return { aporte: 0, ahorro: 0 };
  const sin = Number(det.impBruto ?? det.impuesto) || 0;
  const con = Number(det.impOptBruto ?? det.impOptimizado) || 0;
  return { aporte: Math.round(Number(det.pensionVol) || 0), ahorro: Math.max(0, sin - con) };
}
