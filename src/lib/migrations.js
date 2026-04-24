// Migraciones silenciosas del shape del user data.
//
// Cada función:
//   - Debe ser IDEMPOTENTE (correr dos veces produce el mismo resultado).
//   - Marca el user con un flag `migrated{Nombre}` = true cuando termina.
//   - Acepta y retorna el mismo objeto (mutado para preservar referencias).
//
// Se ejecutan dentro de sanitize() en App.jsx en cada carga del user (Supabase
// o localStorage), antes de que la UI o el motor vean los datos.

/**
 * Commit 1.7: migra PV voluntaria desde ow.aportes.pensionVoluntariaMensual
 * hacia un egreso en Gastos con fiscalCode AP_TRIB_PV.
 *
 * Motivo: post-1.7 el motor taxCO.js ya NO lee ow.aportes.pensionVoluntariaMensual.
 * Sin esta migración, usuarios que tenían PV configurada en el modal viejo
 * perderían su deducible silenciosamente.
 *
 * Reglas:
 *   1. Si ya existe un egreso AP_TRIB_PV para el mismo owner, NO duplicar
 *      (asumimos que cubre la intención del usuario).
 *   2. Siempre borrar ow.aportes.pensionVoluntariaMensual al terminar, aunque
 *      haya habido un egreso existente. Esto cierra cualquier posibilidad de
 *      doble-conteo si el motor o un componente futuro volviera a leer el campo.
 *   3. Marcar user.migratedAportesVoluntariosV17 = true para no reprocesar.
 */
export function migrateAportesVoluntariosV17(d) {
  if (!d || typeof d !== "object") return d;
  if (d.migratedAportesVoluntariosV17) return d;
  const gas = { ...(d.gas || {}) };
  for (const ow of (d.owners || [])) {
    const pvMensual = Number(ow.aportes?.pensionVoluntariaMensual) || 0;
    if (pvMensual > 0) {
      const existente = (gas["Aporte tributario"] || []).find(
        g => g.fiscalCode === "AP_TRIB_PV" && g.owner === ow.id
      );
      if (!existente) {
        gas["Aporte tributario"] = gas["Aporte tributario"] || [];
        gas["Aporte tributario"].push({
          c: "Pensión Voluntaria (migrada)",
          m: pvMensual,
          t: "f",
          freq: "mes",
          owner: ow.id,
          fiscalCode: "AP_TRIB_PV",
        });
      }
      delete ow.aportes.pensionVoluntariaMensual;
    }
  }
  d.gas = gas;
  d.migratedAportesVoluntariosV17 = true;
  return d;
}
