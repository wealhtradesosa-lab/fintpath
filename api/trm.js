export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const today = new Date().toISOString().split("T")[0];
    // Última TRM vigente ≤ hoy (robusto a fines de semana y festivos).
    const where = encodeURIComponent(`vigenciadesde <= '${today}T23:59:59'`);
    const order = encodeURIComponent("vigenciadesde DESC");
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${where}&$order=${order}&$limit=1`;
    const r = await fetch(url);
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0 && data[0].valor) {
      return res.status(200).json({ trm: parseFloat(data[0].valor), source: "Banco de la República", date: data[0].vigenciadesde });
    }
    return res.status(200).json({ trm: 4200, source: "default", date: today });
  } catch (err) {
    return res.status(200).json({ trm: 4200, source: "default", error: err.message });
  }
}
