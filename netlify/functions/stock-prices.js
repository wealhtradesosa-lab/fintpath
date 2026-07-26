export default async function handler(req) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const tickers = body.tickers || [];
    
    if (!tickers.length) {
      return new Response(JSON.stringify({ error: "No tickers" }), { headers: corsHeaders });
    }

    // Fetch from Yahoo Finance API (free, no key needed)
    const results = {};
    
    // Batch: fetch all at once using Yahoo quote endpoint
    // 26-jul-2026 — POR QUÉ SE ELIMINÓ EL CAMINO v7.
    // El código pedía primero /v7/finance/quote y, si fallaba, caía al v8 por
    // ticker. Pero Yahoo dejó de servir v7 sin cookie/crumb y responde
    // HTTP 200 CON EL CUERPO VACÍO. Como r.ok daba true, se entraba a
    // r.json(), que reventaba con "Unexpected end of JSON input" — y el
    // respaldo del v8 NUNCA se ejecutaba, porque vivía en el else.
    // Un fallo silencioso: la app mostraba "Error" y los precios quedaban
    // congelados en lo último cargado a mano. En la cuenta de Santiago eso
    // dejó el portafolio en $24.229 cuando vale unos $108 millones.
    // El v8 (chart) sí responde de forma estable, así que ahora es el único
    // camino, con manejo de error por ticker: si uno falla, los demás siguen.
    const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const fallidos = [];

    await Promise.all(tickers.slice(0, 30).map(async (tk) => {
      try {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?interval=1d&range=1d`;
        const cr = await fetch(chartUrl, { headers: { "User-Agent": UA } });
        if (!cr.ok) { fallidos.push(tk); return; }
        const texto = await cr.text();
        if (!texto) { fallidos.push(tk); return; }   // 200 con cuerpo vacío
        const cd = JSON.parse(texto);
        const meta = cd?.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) { fallidos.push(tk); return; }
        const previo = meta.previousClose || meta.chartPreviousClose || 0;
        results[tk] = {
          price: meta.regularMarketPrice,
          change: meta.regularMarketPrice - previo,
          changePercent: previo ? ((meta.regularMarketPrice - previo) / previo) * 100 : 0,
          name: meta.longName || meta.shortName || "",
          currency: meta.currency || "USD",
          marketState: meta.marketState || "",
          previousClose: previo,
        };
      } catch {
        fallidos.push(tk);
      }
    }));

    return new Response(JSON.stringify({ prices: results, fallidos, updated: new Date().toISOString() }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
}
