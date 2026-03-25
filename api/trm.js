export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  
  try {
    // Try Banco de la República API
    const today = new Date().toISOString().split("T")[0];
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde='${today}'&$limit=1`;
    const r = await fetch(url);
    const data = await r.json();
    
    if (data && data.length > 0) {
      return res.status(200).json({ trm: parseFloat(data[0].valor), source: "Banco de la República", date: today });
    }
    
    // Fallback: last 7 days
    const week = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const url2 = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde>='${week}'&$order=vigenciadesde DESC&$limit=1`;
    const r2 = await fetch(url2);
    const data2 = await r2.json();
    
    if (data2 && data2.length > 0) {
      return res.status(200).json({ trm: parseFloat(data2[0].valor), source: "Banco de la República", date: data2[0].vigenciadesde });
    }
    
    return res.status(200).json({ trm: 4200, source: "default", date: today });
  } catch (err) {
    return res.status(200).json({ trm: 4200, source: "default", error: err.message });
  }
}
