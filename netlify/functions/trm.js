export default async function handler(req) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde='${today}'&$limit=1`;
    const r = await fetch(url);
    const data = await r.json();
    
    if (data && data.length > 0) {
      return new Response(JSON.stringify({ trm: parseFloat(data[0].valor), source: "Banco de la República", date: today }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    const week = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const url2 = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde>='${week}'&$order=vigenciadesde DESC&$limit=1`;
    const r2 = await fetch(url2);
    const data2 = await r2.json();
    
    if (data2 && data2.length > 0) {
      return new Response(JSON.stringify({ trm: parseFloat(data2[0].valor), source: "Banco de la República", date: data2[0].vigenciadesde }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    return new Response(JSON.stringify({ trm: 4200, source: "default", date: today }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ trm: 4200, source: "default", error: err.message }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

export const config = { path: "/api/trm" };
