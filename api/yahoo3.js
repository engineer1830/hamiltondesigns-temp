// /api/yahoo.js
export default async function handler(req, res) {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: "Ticker is required." });
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=max&interval=1d`;

        const response = await fetch(url, {
            cache: "no-store",
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const data = await response.json();

        // debug line
        console.log("Yahoo raw response:", data);
        // end debug line

        const result = data?.chart?.result?.[0];
        if (!result) {
            return res.status(404).json({ error: "No data returned from Yahoo Finance." });
        }

        const timestamps = result.timestamp;
        const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

        if (!timestamps || !adjClose) {
            return res.status(404).json({ error: "Missing adjusted close data." });
        }

        // Normalize into your simulator's expected format
        const finalData = timestamps.map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split("T")[0],
            close: adjClose[i]
        })).filter(row => row.close !== null);

        return res.status(200).json(finalData);

    } catch (err) {
        console.error("Yahoo Finance error:", err);
        return res.status(500).json({ error: "Failed to fetch Yahoo Finance data." });
    }
}
