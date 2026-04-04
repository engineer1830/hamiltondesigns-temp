export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: "Missing symbol parameter" });
    }

    const API_KEY = process.env.EODHD_API_KEY;
    const url = `https://eodhd.com/api/eod/${symbol}.US?api_token=${API_KEY}&fmt=json&order=a`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            return res.status(500).json({ error: "EODHD request failed" });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: "Server error", details: err.message });
    }
}
