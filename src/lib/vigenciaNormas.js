// ════════════════════════════════════════════════════════════════════════════
// Vigencia de la norma que usa FINPATHIA (Colombia).
//
// 28-oct-2026 (Santiago: "cómo hacer que FINPATHIA esté actualizada según la
// DIAN… según todo lo que sale en normas"). Dos piezas:
//   1. Este registro: qué datos cambian por norma, cuándo suele salir el nuevo
//      y cuál es el último cargado. `normasPendientes(fecha)` dice qué está
//      vencido; lo muestra el panel de admin y lo vigilan las pruebas.
//   2. El revisor semanal (tarea programada) que busca normas nuevas, actualiza
//      estos archivos, corre las pruebas y deja la actualización para aprobar.
//      Al terminar cada revisión actualiza ULTIMA_REVISION_NORMATIVA.
// ════════════════════════════════════════════════════════════════════════════
import { UVT_BY_AG } from "./taxCO.js";
import { TABLA_ART73_AG, ULTIMO_AG_ART70, NORMA_GO_VERIFICADA } from "./normaGananciaOcasional.js";

/** Fecha de la última revisión completa de normas nuevas (la mueve el revisor semanal). */
export const ULTIMA_REVISION_NORMATIVA = "2026-10-28";

const d = (s) => new Date(s + "T12:00:00");

/** Qué datos normativos están vencidos a una fecha. Devuelve [{ id, titulo, detalle, gravedad }]. */
export function normasPendientes(hoy = new Date()) {
  const y = hoy.getFullYear();
  const out = [];
  const maxUvt = Math.max(...Object.keys(UVT_BY_AG).map(Number));

  // UVT: la del año siguiente sale en noviembre/diciembre; la del año en curso es obligatoria.
  if (maxUvt < y) {
    out.push({ id: "uvt", gravedad: "alta", titulo: `Falta la UVT ${y}`,
      detalle: `La app está calculando con la UVT ${maxUvt}. Cárgala en UVT_BY_AG (src/lib/taxCO.js) con la resolución de la DIAN.` });
  } else if (maxUvt < y + 1 && hoy >= d(`${y}-12-10`)) {
    out.push({ id: "uvt", gravedad: "media", titulo: `Falta la UVT ${y + 1}`,
      detalle: "La DIAN la publica en noviembre o diciembre. Cárgala antes del 1 de enero." });
  }

  // Reajuste Art. 70 y factores Art. 73 del año gravable anterior: salen entre febrero y mayo.
  if (hoy >= d(`${y}-06-30`)) {
    if (ULTIMO_AG_ART70 < y - 1) out.push({ id: "art70", gravedad: "media", titulo: `Falta el reajuste Art. 70 del año ${y - 1}`,
      detalle: "Sale por decreto entre febrero y mayo. Agrégalo en PCT_ART70 (src/lib/normaGananciaOcasional.js)." });
    if (TABLA_ART73_AG < y - 1) out.push({ id: "art73", gravedad: "media", titulo: `Falta la tabla del Art. 73 del año ${y - 1}`,
      detalle: "Sale en el mismo decreto del reajuste. Actualiza T73 y TABLA_ART73_AG (src/lib/normaGananciaOcasional.js)." });
  }

  // Revisión general (reformas, conceptos, sentencias): si pasan más de 21 días sin revisar, avisar.
  const dias = Math.floor((hoy - d(ULTIMA_REVISION_NORMATIVA)) / 86400000);
  if (dias > 21) out.push({ id: "revision", gravedad: dias > 45 ? "alta" : "baja", titulo: `Hace ${dias} días que no se revisan normas nuevas`,
    detalle: "El revisor semanal no ha corrido o falló. Revisa la tarea programada «Revisor de normas FINPATHIA»." });

  return out;
}

export const RESUMEN_VIGENCIA = () => ({
  ultimaRevision: ULTIMA_REVISION_NORMATIVA,
  uvtHasta: Math.max(...Object.keys(UVT_BY_AG).map(Number)),
  art70Hasta: ULTIMO_AG_ART70,
  art73Hasta: TABLA_ART73_AG,
  gananciaOcasionalVerificada: NORMA_GO_VERIFICADA,
});
