// Datos de mercado para «Mi futuro a 10 años»: IPC anual (BanRep, serie 15270
// «Inflación total anual») y TRM (datos.gov.co). Caché de 24 h en el CDN.
// Si BanRep no responde, devolvemos el valor manual y lo marcamos así: la
// pantalla muestra siempre la fuente y la fecha.
export const IPC_MANUAL = { pct: 6.29, fuente: "DANE, IPC anual", fecha: "sep-2026", manual: true };
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const SUAMECA = "https://suameca.banrep.gov.co/estadisticas-economicas-back/rest/estadisticaEconomicaRestService/consultaDatosSerie?idSerie=15270";

const conTimeout = async (url, ms = 6000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal, headers: { Accept: "application/json" } }); } finally { clearTimeout(t); }
};

// Acepta [[ms, valor], …] o {data:[[ms, valor]]} o [{fecha, valor}].
export function ultimoDato(j) {
  const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.datos) ? j.datos : [];
  const pts = arr.map((x) => (Array.isArray(x) ? { t: x[0], v: x[1] } : { t: x?.fecha ?? x?.date, v: x?.valor ?? x?.value }))
    .filter((p) => Number.isFinite(Number(p.v)) && p.t != null);
  if (!pts.length) return null;
  const p = pts[pts.length - 1];
  const d = new Date(typeof p.t === "number" ? p.t : String(p.t));
  const fecha = Number.isNaN(d.getTime()) ? String(p.t) : d.toLocaleDateString("es-CO", { month: "short", year: "numeric", timeZone: "America/Bogota" }).replace(/\.| de /g, (m) => (m === "." ? "" : "-"));
  return { pct: Number(p.v), fecha };
}

async function ipc() {
  try {
    const r = await conTimeout(SUAMECA);
    if (r.ok) { const d = ultimoDato(await r.json()); if (d && d.pct > 0 && d.pct < 50) return { ...d, fuente: "Banco de la República, inflación total anual (serie 15270)" }; }
  } catch { /* cae al manual */ }
  return IPC_MANUAL;
}

async function trm() {
  try {
    const order = encodeURIComponent("vigenciadesde DESC");
    const r = await conTimeout(`https://www.datos.gov.co/resource/32sa-8pi3.json?$order=${order}&$limit=1`);
    const d = await r.json();
    if (Array.isArray(d) && d[0]?.valor) return { valor: parseFloat(d[0].valor), fuente: "Banco de la República (datos.gov.co)", fecha: String(d[0].vigenciadesde).slice(0, 10) };
  } catch { /* sin TRM */ }
  return null;
}

export default async function handler() {
  const [i, t] = await Promise.all([ipc(), trm()]);
  return new Response(JSON.stringify({ ipc: i, trm: t, actualizado: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": CACHE, "Netlify-CDN-Cache-Control": CACHE },
  });
}
