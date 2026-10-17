// FINPATHIA · ¿La persona ya cargó su primer activo? (activation, copy v3)
//
// Lo comprueba el SERVIDOR con la service key; no se le cree al navegador.
// Nunca se lee el valor de un activo: las dos consultas devuelven solo el id
// de la fila o la bandera _encrypted, nunca el contenido de data.inv.
//   1. user_data?id=eq.<uid>&data->inv->0=not.is.null&select=id
//      → hay fila si la lista de activos (Patrimonio, data.inv) tiene al
//        menos un elemento. PostgREST evalúa el filtro en la base.
//   2. Si no, user_data?id=eq.<uid>&select=enc:data->>_encrypted
//      → "true" si el blob está cifrado. Ahí el servidor no puede ver la
//        lista, así que se acepta la señal del navegador (con sesión
//        verificada, y una sola vez porque activated_at solo se escribe si
//        está vacío). Hoy hay 0 filas cifradas en prod.
// Devuelve "si" | "cifrado" | "no" | "error".
async function activoCargado({ url, key, userId, fetchFn = fetch }) {
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const id = encodeURIComponent(userId);
  try {
    const r1 = await fetchFn(`${url}/rest/v1/user_data?select=id&id=eq.${id}&data->inv->0=not.is.null`, { headers: h });
    if (!r1.ok) return "error";
    const f1 = await r1.json();
    if (Array.isArray(f1) && f1.length > 0) return "si";
    const r2 = await fetchFn(`${url}/rest/v1/user_data?select=enc:data->>_encrypted&id=eq.${id}`, { headers: h });
    if (!r2.ok) return "error";
    const f2 = await r2.json();
    if (Array.isArray(f2) && f2[0] && String(f2[0].enc) === "true") return "cifrado";
    return "no";
  } catch {
    return "error";
  }
}

module.exports = { activoCargado };
