export default async function handler(req) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  try {
    // 26-jul-2026 — LA CAUSA REAL DEL FALLO, y no era Yahoo.
    // La función solo leía `await req.json()`, es decir esperaba un POST con
    // cuerpo. Pero App.jsx la llama con GET y los tickers en la URL:
    //   fetch("/api/stock-price?tickers=AAPL,PLTR")
    // Sin cuerpo, req.json() lanza "Unexpected end of JSON input" — el error
    // exacto que veía Santiago cada vez que apretaba "Actualizar precios".
    // Quien llama y quien responde nunca estuvieron de acuerdo, así que el
    // botón jamás funcionó desde que se escribió así.
    // Ahora acepta las dos formas: query string (GET) y cuerpo (POST).
    let tickers = [];
    const url = new URL(req.url);
    const qs = url.searchParams.get("tickers");
    if (qs) {
      tickers = qs.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
    } else {
      try {
        const body = await req.json();
        tickers = (body.tickers || []).map((t) => String(t).trim().toUpperCase()).filter(Boolean);
      } catch { tickers = []; }
    }
    
    if (!tickers.length) {
      return new Response(JSON.stringify({ error: "No tickers" }), { headers: corsHeaders });
    }

    // Fetch from Yahoo Finance API (free, no key needed)
    const results = {};
    
    // Batch: fetch all at once using Yahoo quote endpoint
    // ⚠️ 26-jul-2026 — LIMITACIÓN CONFIRMADA, NO ES UN BUG DE ESTE CÓDIGO.
    // Yahoo responde HTTP 429 a TODAS las peticiones desde las IP de Netlify
    // (verificado en producción: AAPL:HTTP429, PLTR:HTTP429). Desde una IP
    // residencial responde normal, así que es bloqueo de datacenter, no un
    // problema de cabeceras ni de endpoint.
    // Para que esto funcione hace falta una fuente con API key —Finnhub o
    // Twelve Data tienen plan gratuito— o integrar IBKR, que además trae las
    // posiciones reales y no solo los precios.
    // Se deja el camino armado y con diagnóstico por ticker para que el día
    // que se cambie la fuente sea solo reemplazar la URL.
    //
    // POR QUÉ SE ELIMINÓ EL CAMINO v7.
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
        if (!cr.ok) { fallidos.push(tk + ":HTTP" + cr.status); return; }
        const texto = await cr.text();
        if (!texto) { fallidos.push(tk + ":vacio"); return; }
        const cd = JSON.parse(texto);
        const meta = cd?.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) { fallidos.push(tk + ":sinDato"); return; }
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
      } catch (e) {
        fallidos.push(tk + ":" + (e.message || "err").slice(0, 40));
      }
    }));

    return new Response(JSON.stringify({ prices: results, fallidos, updated: new Date().toISOString() }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
}
