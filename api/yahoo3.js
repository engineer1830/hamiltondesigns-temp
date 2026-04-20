// /api/yahoo3.js
export default async function handler(req, res) {

    // --- CORS ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const { ticker, start, end, interval = "1d" } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
    }

    // Default: 20 years of data
    const period1 = start
        ? Math.floor(new Date(start).getTime() / 1000)
        : Math.floor(new Date("2000-01-01").getTime() / 1000);

    const period2 = end
        ? Math.floor(new Date(end).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

    console.log("YAHOO3 API CALL:", { ticker, period1, period2, interval });

    try {
        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
            `?interval=${interval}&period1=${period1}&period2=${period2}&includeAdjustedClose=true`;

        const response = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Yahoo Finance request failed (${response.status})`
            });
        }

        const json = await response.json();

        if (!json.chart || !json.chart.result || !json.chart.result[0]) {
            return res.status(404).json({ error: "No data found" });
        }

        const result = json.chart.result[0];
        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];

        const prices = timestamps
            .map((ts, i) => ({
                date: new Date(ts * 1000).toISOString().split("T")[0],
                close: closes[i]
            }))
            .filter(p => p.close !== null && !isNaN(p.close));

        return res.status(200).json(prices);

    } catch (err) {
        console.error("Yahoo Finance API error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

