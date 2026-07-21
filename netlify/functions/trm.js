export default async function handler(req) {
  try {
    const today = new Date().toISOString().split("T")[0];
    // Última TRM vigente ≤ hoy (robusto a fines de semana y festivos: la TRM
    // del viernes rige sáb/dom, así que 'exacto hoy' fallaba y caía al fallback).
    const where = encodeURIComponent(`vigenciadesde <= '${today}T23:59:59'`);
    const order = encodeURIComponent("vigenciadesde DESC");
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${where}&$order=${order}&$limit=1`;
    const r = await fetch(url);
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0 && data[0].valor) {
      return new Response(JSON.stringify({ trm: parseFloat(data[0].valor), source: "Banco de la República", date: data[0].vigenciadesde }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response(JSON.stringify({ trm: 4200, source: "default", date: today }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ trm: 4200, source: "default", error: err.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
