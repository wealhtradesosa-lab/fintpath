// 24-oct-2026 — El fiscalCode de un activo sigue a su Tipo.
// Bug: el formulario arrancaba con INV_INMUEBLE_HABITACIONAL y no lo cambiaba
// al elegir otro tipo, así que Acciones/CDT/Crypto quedaban como inmueble.
export const TIPOS_INMUEBLE = ["Real Estate", "Bodega", "Lote", "Local Comercial"];
export const esTipoInmueble = (tipo) => TIPOS_INMUEBLE.includes(String(tipo || "").trim());
export const esCodigoInmueble = (fc) => typeof fc === "string" && fc.startsWith("INV_INMUEBLE_");

// Código inequívoco para un tipo no inmueble; null si el tipo no alcanza
// (Negocio, Renta Fija, Otro…) y el usuario debe revisarlo.
export function codigoPorTipo(tipo, owner) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t === "cdt") return "INV_CDT";
  if (t === "cash" || t === "efectivo") return "INV_EFECTIVO";
  if (t === "fondo de inversión" || t === "fondo de inversion") return "INV_FIC";
  if (t === "acciones") return "INV_ACCIONES";
  if (t === "crypto" || t === "cripto") return "INV_CRYPTO";
  if (t === "vehículo" || t === "vehiculo") return owner && owner.type === "juridica" ? "INV_VEHICULO_PRODUCTIVO" : "INV_VEHICULO_PERSONAL";
  return null;
}

// Para el formulario: el código que corresponde al tipo elegido.
export function fiscalCodeParaTipo(tipo, prev, owner) {
  if (esTipoInmueble(tipo)) return esCodigoInmueble(prev) ? prev : "INV_INMUEBLE_HABITACIONAL";
  return codigoPorTipo(tipo, owner) || undefined;
}

// Al cargar: corrige ítems no inmueble guardados con código de inmueble.
// Idempotente: tras una pasada ningún ítem vuelve a cumplir la condición.
export function migrateInvFiscalCodeTipo(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.inv)) return d;
  const owners = Array.isArray(d.owners) ? d.owners : [];
  let cambio = false;
  const inv = d.inv.map((i) => {
    if (!i || typeof i !== "object") return i;
    const tipo = i.tipo || i.tp || "";
    if (!tipo || esTipoInmueble(tipo) || !esCodigoInmueble(i.fiscalCode)) return i;
    cambio = true;
    const code = codigoPorTipo(tipo, owners.find((o) => o && o.id === i.owner));
    const { fiscalCode, ...resto } = i;
    return code ? { ...resto, fiscalCode: code } : { ...resto, revisarFiscal: true };
  });
  return cambio ? { ...d, inv } : d;
}
