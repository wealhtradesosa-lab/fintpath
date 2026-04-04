export default async function handler(req) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tickers = url.searchParams.get("tickers");
    if (!tickers) {
      return new Response(JSON.stringify({ error: "No tickers provided" }), { headers: corsHeaders });
    }

    const symbols = tickers.split(",").map(t => t.trim().toUpperCase()).slice(0, 30);
    const results = {};

    // Fetch from Yahoo Finance API (free, no key needed)
    for (const sym of symbols) {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (r.ok) {
          const data = await r.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta) {
            results[sym] = {
              price: meta.regularMarketPrice || 0,
              prevClose: meta.chartPreviousClose || meta.previousClose || 0,
              currency: meta.currency || "USD",
              name: meta.shortName || meta.longName || sym,
            };
          }
        }
      } catch {}
    }

    return new Response(JSON.stringify({ prices: results, updated: new Date().toISOString() }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
}
