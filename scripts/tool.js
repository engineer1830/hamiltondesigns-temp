/* --------------------------------------------------
 *  LOCAL STORAGE HELPERS
-------------------------------------------------- */

function saveInputs() {
    const inputs = {
        currentAge: document.getElementById("currentAge").value,
        retireAge: document.getElementById("retireAge").value,
        currentLump: document.getElementById("currentLump").value,
        currentSalary: document.getElementById("currentSalary").value,
        investmentPct: document.getElementById("investmentPct").value,
        salaryGrowth: document.getElementById("salaryGrowth").value,
        withdrawRate: document.getElementById("withdrawRate").value,
        inflation: document.getElementById("inflation").value,
        stockVol: document.getElementById("stockVol").value,
        bondVol: document.getElementById("bondVol").value,
        mcRuns: document.getElementById("mcRuns").value,
        tickers: document.getElementById("tickers").value
    };

    localStorage.setItem("retirementInputs", JSON.stringify(inputs));
}

function loadInputs() {
    const saved = JSON.parse(localStorage.getItem("retirementInputs"));
    if (!saved) return;

    for (const key in saved) {
        const el = document.getElementById(key);
        if (el) el.value = saved[key];
    }
}

function saveLastTimeline(timeline) {
    localStorage.setItem("lastTimeline", JSON.stringify(timeline));
}

function restoreLastTimeline(ctx) {
    const saved = JSON.parse(localStorage.getItem("lastTimeline"));
    if (saved) {
        renderBalanceChart(ctx, saved);
    }
}

/* --------------------------------------------------
 *  NUMBER FORMATTING
-------------------------------------------------- */
function formatNumberInput(input) {
    let raw = input.value.replace(/,/g, "");
    if (raw === "" || isNaN(raw)) return;
    input.value = Number(raw).toLocaleString();
}

const BOND_TICKERS = [
    "FXNAX", "BND", "AGG", "IEF", "SHY", "LQD", "VBTLX", "BNDX", "TIP"
];

function computeAnnualReturn(history) {
    if (history.length < 2) return null;

    const first = history[history.length - 1].close;
    const last = history[0].close;

    const years = history.length / 252;
    return Math.pow(last / first, 1 / years) - 1;
}

/* --------------------------------------------------
 *  FINANCIAL DATA (YAHOO FINANCE)
-------------------------------------------------- */

async function getYahooHistorical(ticker) {
    try {
        const base = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=max`;
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`;

        const res = await fetch(url);
        const data = await res.json();

        const result = data?.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp;
        const closes = result.indicators?.quote?.[0]?.close;

        if (!timestamps || !closes) return [];

        const history = timestamps.map((ts, i) => ({
            date: new Date(ts * 1000),
            close: closes[i]
        })).filter(d => d.close != null);

        return history;
    } catch (err) {
        console.error("Yahoo fetch error:", err);
        return [];
    }
}

async function financialPerformance(tickers) {
    const stockReturns = [];
    const bondReturns = [];

    for (const t of tickers) {
        const hist = await getYahooHistorical(t);
        const annual = computeAnnualReturn(hist);
        if (annual === null) continue;

        if (BOND_TICKERS.includes(t.toUpperCase())) {
            bondReturns.push(annual);
        } else {
            stockReturns.push(annual);
        }
    }

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
        avgStock: stockReturns.length ? avg(stockReturns) : null,
        avgBond: bondReturns.length ? avg(bondReturns) : null,
        stockList: tickers.filter(t => !BOND_TICKERS.includes(t)),
        bondList: tickers.filter(t => BOND_TICKERS.includes(t)),
        stockReturns,
        bondReturns
    };
}

/* --------------------------------------------------
 *  GROWTH ENGINE
-------------------------------------------------- */

function randn_bm() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function growYearsWithTimeline({
    lumpValue,
    salary,
    investmentPct,
    stockRate,
    bondRate,
    stockWeight,
    bondWeight,
    salaryGrowth,
    years,
    randomize,
    stockVol,
    bondVol
}) {
    let balance = lumpValue;
    let currentSalary = salary;
    const timeline = [];

    for (let i = 0; i < years; i++) {
        currentSalary *= (1 + salaryGrowth);

        const contribution = currentSalary * investmentPct;
        balance += contribution;

        let expectedReturn =
            stockWeight * stockRate +
            bondWeight * bondRate;

        if (randomize) {
            const stockShock = stockVol * randn_bm();
            const bondShock = bondVol * randn_bm();
            expectedReturn =
                stockWeight * (stockRate + stockShock) +
                bondWeight * (bondRate + bondShock);
        }

        balance *= (1 + expectedReturn);
        timeline.push(balance);
    }

    return {
        futureNominal: balance,
        nextSalary: currentSalary,
        timeline
    };
}

/* --------------------------------------------------
 *  RETIREMENT SIMULATION
-------------------------------------------------- */

function simulateRetirement({
    age,
    gender,
    retireAge,
    lumpValue,
    salary,
    investmentPct,
    stockRate,
    bondRate,
    salaryGrowth,
    inflation,
    withdrawRate,
    monteCarlo = false,
    stockVol = 0.15,
    bondVol = 0.05
}) {
    let currentAge = age;
    let currentLump = lumpValue;
    let currentSalary = salary;

    const balanceTimeline = [];
    const withdrawTimeline = [];
    const legacyData = [];
    const legacyDataReal = [];

    balanceTimeline.push({ age: currentAge, balance: currentLump });

    function runPhase(startAge, endAge, stockWeight, bondWeight) {
        const years = Math.max(0, endAge - startAge);
        if (years <= 0) return;

        const { futureNominal, nextSalary, timeline } = growYearsWithTimeline({
            lumpValue: currentLump,
            salary: currentSalary,
            investmentPct,
            stockRate,
            bondRate,
            stockWeight,
            bondWeight,
            salaryGrowth,
            years,
            randomize: monteCarlo,
            stockVol,
            bondVol
        });

        for (let i = 0; i < timeline.length; i++) {
            balanceTimeline.push({
                age: startAge + (i + 1),
                balance: timeline[i]
            });
        }

        currentAge = startAge + years;
        currentLump = futureNominal;
        currentSalary = nextSalary;
    }

    runPhase(Math.max(currentAge, 20), Math.min(retireAge, 50), 1.0, 0.0);
    runPhase(Math.max(currentAge, 50), Math.min(retireAge, 60), 0.65, 0.35);
    runPhase(Math.max(currentAge, 60), retireAge, 0.5, 0.5);

    const lumpAtRetire = currentLump;

    while (currentAge < 70) {
        const { futureNominal } = growYearsWithTimeline({
            lumpValue: currentLump,
            salary: 0,
            investmentPct: 0,
            stockRate,
            bondRate,
            stockWeight: 0.5,
            bondWeight: 0.5,
            salaryGrowth: 0,
            years: 1,
            randomize: monteCarlo,
            stockVol,
            bondVol
        });

        currentLump = futureNominal;

        const withdrawNominal = currentLump * withdrawRate;
        currentLump -= withdrawNominal;
        currentAge++;

        const discount = Math.pow(1 + inflation, currentAge - retireAge);

        withdrawTimeline.push({
            age: currentAge,
            withdrawn: withdrawNominal,
            withdrawnReal: withdrawNominal / discount,
            balance: currentLump,
            balanceReal: currentLump / discount
        });

        legacyData.push([currentAge, withdrawNominal, currentLump]);
        legacyDataReal.push([
            currentAge,
            withdrawNominal / discount,
            currentLump / discount
        ]);

        balanceTimeline.push({ age: currentAge, balance: currentLump });
    }

    const lifeExpectancy = gender === "m" ? 84 : 86;

    while (currentAge < lifeExpectancy) {
        const { futureNominal } = growYearsWithTimeline({
            lumpValue: currentLump,
            salary: 0,
            investmentPct: 0,
            stockRate,
            bondRate,
            stockWeight: 0.35,
            bondWeight: 0.65,
            salaryGrowth: 0,
            years: 1,
            randomize: monteCarlo,
            stockVol,
            bondVol
        });

        currentLump = futureNominal;

        const withdrawNominal = currentLump * withdrawRate;
        currentLump -= withdrawNominal;
        currentAge++;

        const discount = Math.pow(1 + inflation, currentAge - retireAge);

        withdrawTimeline.push({
            age: currentAge,
            withdrawn: withdrawNominal,
            withdrawnReal: withdrawNominal / discount,
            balance: currentLump,
            balanceReal: currentLump / discount
        });

        legacyData.push([currentAge, withdrawNominal, currentLump]);
        legacyDataReal.push([
            currentAge,
            withdrawNominal / discount,
            currentLump / discount
        ]);

        balanceTimeline.push({ age: currentAge, balance: currentLump });
    }

    const finalLegacyReal =
        currentLump / Math.pow(1 + inflation, currentAge - retireAge);

    return {
        lumpAtRetire,
        finalLegacyReal,
        balanceTimeline,
        withdrawTimeline,
        legacyData,
        legacyDataReal
    };
}
/* --------------------------------------------------
 *  MONTE CARLO
-------------------------------------------------- */

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const idx = (p / 100) * (arr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return arr[lower];
    return arr[lower] * (1 - (idx - lower)) + arr[upper] * (idx - lower);
}

function monteCarloSimulation({
    nRuns,
    age,
    gender,
    retireAge,
    lumpValue,
    salary,
    investmentPct,
    stockRate,
    bondRate,
    salaryGrowth,
    inflation,
    withdrawRate,
    stockVol,
    bondVol
}) {
    const results = [];

    for (let i = 0; i < nRuns; i++) {
        const sim = simulateRetirement({
            age,
            gender,
            retireAge,
            lumpValue,
            salary,
            investmentPct,
            stockRate,
            bondRate,
            salaryGrowth,
            inflation,
            withdrawRate,
            monteCarlo: true,
            stockVol,
            bondVol
        });
        results.push(sim.finalLegacyReal);
    }

    results.sort((a, b) => a - b);

    return {
        median: percentile(results, 50),
        p10: percentile(results, 10),
        p90: percentile(results, 90),
        probRuin: results.filter(x => x <= 0).length / results.length,
        allResults: results
    };
}
/* --------------------------------------------------
 *  FORMATTING HELPERS
-------------------------------------------------- */

function formatCurrency(x) {
    return `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatLegacyTable(legacyData) {
    let out = "| Age | Withdrawn (Nominal) | Balance (Nominal) |\n";
    out += "| --- | --- | --- |\n";
    for (const [age, w, b] of legacyData) {
        out += `| ${age} | ${formatCurrency(w)} | ${formatCurrency(b)} |\n`;
    }
    return out;
}

function formatLegacyTableReal(legacyDataReal) {
    let out = "| Age | Withdrawn (Real) | Balance (Real) |\n";
    out += "| --- | --- | --- |\n";
    for (const [age, w, b] of legacyDataReal) {
        out += `| ${age} | ${formatCurrency(w)} | ${formatCurrency(b)} |\n`;
    }
    return out;
}
/* --------------------------------------------------
 *  CHARTS
-------------------------------------------------- */

let balanceChart = null;
let withdrawChart = null;
let withdrawChartReal = null;
let mcChart = null;

function renderBalanceChart(ctx, timeline) {
    const labels = timeline.map(d => d.age);
    const data = timeline.map(d => d.balance);

    if (balanceChart) balanceChart.destroy();

    balanceChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Balance (Nominal)",
                data,
                borderColor: "rgba(74,108,247,1)",
                backgroundColor: "rgba(74,108,247,0.15)",
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { ticks: { callback: v => formatCurrency(v) } }
            }
        }
    });
}

function renderWithdrawChart(ctx, timeline) {
    const labels = timeline.map(d => d.age);
    const data = timeline.map(d => d.withdrawn);

    if (withdrawChart) withdrawChart.destroy();

    withdrawChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Withdrawn (Nominal)",
                data,
                backgroundColor: "rgba(255,159,64,0.7)"
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { ticks: { callback: v => formatCurrency(v) } }
            }
        }
    });
}

function renderWithdrawChartReal(ctx, timeline, inflation) {
    const labels = timeline.map(d => d.age);
    const withdrawnReal = timeline.map(d => d.withdrawnReal);
    const balanceReal = timeline.map(d => d.balanceReal);

    if (withdrawChartReal) withdrawChartReal.destroy();

    withdrawChartReal = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    type: "bar",
                    label: "Withdrawn (Real)",
                    data: withdrawnReal,
                    backgroundColor: "rgba(255,159,64,0.7)"
                },
                {
                    type: "line",
                    label: "Balance (Real)",
                    data: balanceReal,
                    borderColor: "rgba(54,162,235,1)",
                    backgroundColor: "rgba(54,162,235,0.15)",
                    tension: 0.2,
                    yAxisID: "y"
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { ticks: { callback: v => formatCurrency(v) } }
            }
        }
    });

    const header = document.getElementById("realChartHeader");
    header.textContent =
        `Withdrawals & Balance (Real Dollars, Inflation Adjusted at ${(inflation * 100).toFixed(1)}%)`;
}

function renderMcChart(ctx, results) {
    if (mcChart) mcChart.destroy();

    if (results.length === 0) {
        mcChart = new Chart(ctx, { type: "bar", data: {}, options: {} });
        return;
    }

    const bins = 30;
    const min = results[0];
    const max = results[results.length - 1];
    const width = (max - min) / bins;
    const counts = new Array(bins).fill(0);

    for (const r of results) {
        let idx = Math.floor((r - min) / width);
        if (idx >= bins) idx = bins - 1;
        counts[idx]++;
    }

    const labels = [];
    for (let i = 0; i < bins; i++) {
        const start = min + i * width;
        const end = start + width;
        labels.push(`${formatCurrency(start)}–${formatCurrency(end)}`);
    }

    mcChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Frequency",
                data: counts,
                backgroundColor: "rgba(54,162,235,0.7)"
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { maxRotation: 90, minRotation: 45 } }
            }
        }
    });
}
/* --------------------------------------------------
 *  UI SETUP & EVENT HANDLING
-------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("retirement-form");
    const resultsText = document.getElementById("resultsText");

    const balanceCtx = document.getElementById("balanceChart").getContext("2d");
    const withdrawCtx = document.getElementById("withdrawChart").getContext("2d");
    const withdrawCtxReal = document.getElementById("withdrawChartReal").getContext("2d");
    const mcCtx = document.getElementById("mcChart").getContext("2d");

    /* -----------------------------------------
     *  Load saved inputs on page load
     ----------------------------------------- */
    loadInputs();

    /* -----------------------------------------
     *  Format number inputs on load + typing
     ----------------------------------------- */
    ["currentLump", "currentSalary"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => formatNumberInput(el));
        if (el.value) formatNumberInput(el);
    });

    /* -----------------------------------------
     *  FORM SUBMIT HANDLER
     ----------------------------------------- */
    form.addEventListener("submit", async e => {
        e.preventDefault();
        resultsText.value = "";

        /* -----------------------------------------
         *  Read Inputs
         ----------------------------------------- */
        const currentAge = parseInt(document.getElementById("currentAge").value, 10);
        const gender = document.getElementById("gender").value.trim().toLowerCase();
        const retireAge = parseInt(document.getElementById("retireAge").value, 10);

        const lumpValue = parseFloat(document.getElementById("currentLump").value.replace(/,/g, ""));
        const salary = parseFloat(document.getElementById("currentSalary").value.replace(/,/g, ""));

        const investmentPct = parseFloat(document.getElementById("investmentPct").value) / 100;
        const salaryGrowth = parseFloat(document.getElementById("salaryGrowth").value) / 100;
        const withdrawRate = parseFloat(document.getElementById("withdrawRate").value) / 100;
        const inflation = parseFloat(document.getElementById("inflation").value) / 100;

        const stockVol = parseFloat(document.getElementById("stockVol").value) / 100;
        const bondVol = parseFloat(document.getElementById("bondVol").value) / 100;

        const mcRuns = parseInt(document.getElementById("mcRuns").value.replace(/,/g, ""), 10);

        /* -----------------------------------------
         *  Ticker Logic
         ----------------------------------------- */
        const tickersRaw = document.getElementById("tickers").value.trim();
        let tickers = [];

        if (tickersRaw.length === 0) {
            tickers = ["FXAIX", "FXNAX"];
        } else {
            tickers = tickersRaw.split(",").map(t => t.trim().toUpperCase());
        }

        /* -----------------------------------------
         *  Default fallback values
         ----------------------------------------- */
        let stockRate = 0.08;
        let bondRate = 0.04;

        /* -----------------------------------------
         *  Fetch real performance
         ----------------------------------------- */
        const perf = await financialPerformance(tickers);

        stockRate = perf.avgStock ?? 0.08;
        bondRate = perf.avgBond ?? 0.04;

        /* -----------------------------------------
         *  Build Ticker Report (BEFORE charts)
         ----------------------------------------- */
        let tickerReport = "";
        tickerReport += "Ticker Analysis:\n";
        tickerReport += `  User Input: ${tickers.join(", ")}\n\n`;

        tickerReport += "  Classified:\n";
        tickerReport += `    Stocks: ${perf.stockList.join(", ") || "None"}\n`;
        tickerReport += `    Bonds: ${perf.bondList.join(", ") || "None"}\n\n`;

        tickerReport += "  Annualized Returns:\n";
        tickerReport += `    Stocks: ${perf.stockReturns.length ? perf.stockReturns.map(r => (r * 100).toFixed(2) + "%").join(", ") : "None"
            }\n`;
        tickerReport += `    Bonds: ${perf.bondReturns.length ? perf.bondReturns.map(r => (r * 100).toFixed(2) + "%").join(", ") : "None"
            }\n\n`;

        tickerReport += "  Averages:\n";
        tickerReport += `    Stock Avg: ${(stockRate * 100).toFixed(2)}%\n`;
        tickerReport += `    Bond Avg: ${(bondRate * 100).toFixed(2)}%\n\n`;

        /* -----------------------------------------
         *  Run Core Simulation
         ----------------------------------------- */
        const sim = simulateRetirement({
            age: currentAge,
            gender,
            retireAge,
            lumpValue,
            salary,
            investmentPct,
            stockRate,
            bondRate,
            salaryGrowth,
            inflation,
            withdrawRate,
            monteCarlo: false,
            stockVol,
            bondVol
        });

        /* -----------------------------------------
         *  Run Monte Carlo
         ----------------------------------------- */
        const mc = monteCarloSimulation({
            nRuns: mcRuns,
            age: currentAge,
            gender,
            retireAge,
            lumpValue,
            salary,
            investmentPct,
            stockRate,
            bondRate,
            salaryGrowth,
            inflation,
            withdrawRate,
            stockVol,
            bondVol
        });

        /* -----------------------------------------
         *  SAVE INPUTS (Option B)
         ----------------------------------------- */
        saveInputs();

        /* -----------------------------------------
         *  Build Results Text (Ticker Report FIRST)
         ----------------------------------------- */
        let out = "";
        out += tickerReport;
        out += `Lump sum at retirement (nominal): ${formatCurrency(sim.lumpAtRetire)}\n`;
        out += `Final legacy (real): ${formatCurrency(sim.finalLegacyReal)}\n\n`;

        out += "Monte Carlo Results:\n";
        out += `  Median final legacy: ${formatCurrency(mc.median)}\n`;
        out += `  10th percentile: ${formatCurrency(mc.p10)}\n`;
        out += `  90th percentile: ${formatCurrency(mc.p90)}\n`;
        out += `  Probability of ruin: ${(mc.probRuin * 100).toFixed(2)}%\n\n`;

        out += "Legacy Table (Nominal):\n";
        out += formatLegacyTable(sim.legacyData) + "\n\n";

        out += "Legacy Table (Real):\n";
        out += formatLegacyTableReal(sim.legacyDataReal) + "\n";

        resultsText.value = out;

        /* -----------------------------------------
         *  Render Charts (AFTER ticker report)
         ----------------------------------------- */
        renderBalanceChart(balanceCtx, sim.balanceTimeline);
        renderWithdrawChart(withdrawCtx, sim.withdrawTimeline);
        renderWithdrawChartReal(withdrawCtxReal, sim.withdrawTimeline, inflation);
        renderMcChart(mcCtx, mc.allResults);
    });

    /* -----------------------------------------
     *  Footer Date Logic
     ----------------------------------------- */
    const yearSpan = document.getElementById("currentyear");
    const modSpan = document.getElementById("lastModified");

    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    if (modSpan) modSpan.textContent = document.lastModified;
});