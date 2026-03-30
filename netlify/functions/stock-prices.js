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
    const symbols = tickers.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    if (r.ok) {
      const data = await r.json();
      const quotes = data?.quoteResponse?.result || [];
      for (const q of quotes) {
        results[q.symbol] = {
          price: q.regularMarketPrice || 0,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          name: q.shortName || q.longName || "",
          currency: q.currency || "USD",
          marketState: q.marketState || "CLOSED",
          previousClose: q.regularMarketPreviousClose || 0,
        };
      }
    } else {
      // Fallback: try individual fetches via chart API
      for (const tk of tickers.slice(0, 20)) {
        try {
          const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?interval=1d&range=1d`;
          const cr = await fetch(chartUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (cr.ok) {
            const cd = await cr.json();
            const meta = cd?.chart?.result?.[0]?.meta;
            if (meta) {
              results[tk] = {
                price: meta.regularMarketPrice || 0,
                change: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
                changePercent: meta.previousClose ? (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100) : 0,
                name: "",
                currency: meta.currency || "USD",
              };
            }
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify({ prices: results, updated: new Date().toISOString() }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
}
