// Migraciones silenciosas del shape del user data.
//
// Cada función:
//   - Debe ser IDEMPOTENTE (correr dos veces produce el mismo resultado).
//   - Marca el user con un flag `migrated{Nombre}` = true cuando termina.
//   - Acepta y retorna el mismo objeto (mutado para preservar referencias).
//
// Se ejecutan dentro de sanitize() en App.jsx en cada carga del user (Supabase
// o localStorage), antes de que la UI o el motor vean los datos.

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

// ─────────────────────────────────────────────────────────────────────────
// Commit 5.5: migra owner.declaracionAnterior (singular) a
// owner.declaraciones (array con máximo 3 entries, más recientes primero).
//
// Motivo: el shape singular pisa cada upload nuevo. El array permite
// historial de hasta 3 años para comparaciones y timeline.
//
// Reglas:
//   1. Si owner.declaracionAnterior existe y owner.declaraciones no, crear
//      owner.declaraciones = [declaracionAnterior].
//   2. Si owner.declaraciones ya existe, respetarlo (idempotencia).
//   3. Siempre borrar owner.declaracionAnterior al terminar para evitar
//      confusión futura sobre cuál es la fuente de verdad.
//   4. Ordenar descendente por anoGravable (más reciente primero).
//   5. Recortar a MAX_DECLARACIONES si acumuló más que eso.
//   6. Marcar user.migratedDeclaracionesV55 = true para no reprocesar.
// ─────────────────────────────────────────────────────────────────────────
export const MAX_DECLARACIONES = 3;

export function migrateDeclaracionesV55(d) {
  if (!d || typeof d !== "object") return d;
  if (d.migratedDeclaracionesV55) return d;
  for (const ow of (d.owners || [])) {
    const singular = ow.declaracionAnterior;
    if (singular && (!ow.declaraciones || !Array.isArray(ow.declaraciones))) {
      ow.declaraciones = [singular];
    }
    if (ow.declaraciones && Array.isArray(ow.declaraciones)) {
      // Ordenar descendente por anoGravable (null/undefined al final)
      ow.declaraciones.sort((a, b) => (Number(b?.anoGravable) || 0) - (Number(a?.anoGravable) || 0));
      // Recortar a MAX
      if (ow.declaraciones.length > MAX_DECLARACIONES) {
        ow.declaraciones = ow.declaraciones.slice(0, MAX_DECLARACIONES);
      }
    }
    // Siempre borrar singular al final, exista o no el nuevo array
    delete ow.declaracionAnterior;
  }
  d.migratedDeclaracionesV55 = true;
  return d;
}
