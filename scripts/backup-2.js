/* --------------------------------------------------
 *  Financial Data (FMP)
 *  - FXAIX + FXNAX defaults
 *  - User tickers override defaults
 *  - Automatic stock/bond classification
 *  - Annualized return calculation
-------------------------------------------------- */

const FMP_API_KEY = "YOUR_API_KEY_HERE";

/* Known bond tickers for classification */
const BOND_TICKERS = [
    "FXNAX", "BND", "AGG", "IEF", "SHY", "LQD", "VBTLX", "BNDX", "TIP"
];

/* Fetch real-time quote (optional, not used for return calc) */
async function getFmpQuote(ticker) {
    try {
        const url = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${FMP_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.[0]?.price ?? null;
    } catch {
        return null;
    }
}

/* Fetch full historical OHLCV */
async function getFmpHistorical(ticker) {
    try {
        const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?apikey=${FMP_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.historical ?? [];
    } catch {
        return [];
    }
}

/* Compute annualized return from historical data */
function computeAnnualReturn(history) {
    if (history.length < 2) return null;

    const first = history[history.length - 1].close; // oldest
    const last = history[0].close; // newest

    const years = history.length / 252; // ~252 trading days per year
    return Math.pow(last / first, 1 / years) - 1;
}

/* --------------------------------------------------
 *  financialPerformance(tickers)
 *  - Classifies tickers into stocks vs bonds
 *  - Computes annualized returns
 *  - Falls back to defaults if needed
-------------------------------------------------- */
async function financialPerformance(tickers) {
    const stockReturns = [];
    const bondReturns = [];

    for (const t of tickers) {
        const hist = await getFmpHistorical(t);
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
        avgBond: bondReturns.length ? avg(bondReturns) : null
    };
}
/* --------------------------------------------------
 *  Core Growth Engine (helper for accumulation & withdrawals)
-------------------------------------------------- */
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
        // Salary grows annually
        currentSalary *= (1 + salaryGrowth);

        // Contribution
        const contribution = currentSalary * investmentPct;
        balance += contribution;

        // Expected blended return
        let expectedReturn =
            stockWeight * stockRate +
            bondWeight * bondRate;

        // Monte Carlo randomization
        if (randomize) {
            const stockShock = stockVol * randn_bm();
            const bondShock = bondVol * randn_bm();
            expectedReturn =
                stockWeight * (stockRate + stockShock) +
                bondWeight * (bondRate + bondShock);
        }

        // Apply growth
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
 *  Normal distribution helper for Monte Carlo
-------------------------------------------------- */
function randn_bm() {
    // Box–Muller transform
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/* --------------------------------------------------
 *  Core Retirement Simulation
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

    /* --------------------------------------------------
     *  Accumulation Phases
    -------------------------------------------------- */
    runPhase(Math.max(currentAge, 20), Math.min(retireAge, 50), 1.0, 0.0);
    runPhase(Math.max(currentAge, 50), Math.min(retireAge, 60), 0.65, 0.35);
    runPhase(Math.max(currentAge, 60), retireAge, 0.5, 0.5);

    const lumpAtRetire = currentLump;

    /* --------------------------------------------------
     *  Withdrawal Phase (retireAge → 70)
    -------------------------------------------------- */
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

    /* --------------------------------------------------
     *  Legacy Phase (70 → life expectancy)
    -------------------------------------------------- */
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
 *  Monte Carlo Simulation
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
 *  Formatting & Tables
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
 *  Charts
-------------------------------------------------- */
let balanceChart = null;
let withdrawChart = null;
let withdrawChartReal = null;
let mcChart = null;

/* ------------------------------
 *  Balance Chart (Nominal)
------------------------------ */
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

/* ------------------------------
 *  Withdrawals (Nominal)
------------------------------ */
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

/* ------------------------------
 *  Withdrawals + Balance (Real)
------------------------------ */
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

/* ------------------------------
 *  Monte Carlo Histogram
------------------------------ */
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
 *  UI Setup & Event Handling
-------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("retirement-form");
    const resultsText = document.getElementById("resultsText");

    const balanceCtx = document.getElementById("balanceChart").getContext("2d");
    const withdrawCtx = document.getElementById("withdrawChart").getContext("2d");
    const withdrawCtxReal = document.getElementById("withdrawChartReal").getContext("2d");
    const mcCtx = document.getElementById("mcChart").getContext("2d");

    loadInputs();
    restoreLastTimeline(balanceCtx);

    ["currentLump", "currentSalary"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => formatNumberInput(el));
        if (el.value) formatNumberInput(el);
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        resultsText.value = "";

        /* ------------------------------
         *  Read Inputs
        ------------------------------ */
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

        /* ------------------------------
         *  Ticker Logic
         *  - Blank → FXAIX + FXNAX
         *  - User input → override defaults
         *  - Auto classify stock vs bond
        ------------------------------ */
        const tickersRaw = document.getElementById("tickers").value.trim();

        let tickers = [];
        if (tickersRaw.length === 0) {
            tickers = ["FXAIX", "FXNAX"];
        } else {
            tickers = tickersRaw.split(",").map(t => t.trim().toUpperCase());
        }

        /* ------------------------------
         *  Default fallback values
        ------------------------------ */
        let stockRate = 0.08;
        let bondRate = 0.04;

        /* ------------------------------
        *  Prepare perf object for ticker report
       ------------------------------ */
        let perf = {
            avgStock: null,
            avgBond: null,
            stockList: [],
            bondList: [],
            stockReturns: [],
            bondReturns: []
       };

        /* ------------------------------
         *  Fetch real performance if tickers exist
        ------------------------------ */
        if (tickers.length > 0) {
            perf = await financialPerformance(tickers);

            stockRate = perf.avgStock ?? 0.08;
            bondRate = perf.avgBond ?? 0.04;
        }

        /* ------------------------------
         *  Run Core Simulation
        ------------------------------ */
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

        /* ------------------------------
         *  Render Charts
        ------------------------------ */
        renderBalanceChart(balanceCtx, sim.balanceTimeline);
        renderWithdrawChart(withdrawCtx, sim.withdrawTimeline);
        renderWithdrawChartReal(withdrawCtxReal, sim.withdrawTimeline, inflation);

        /* ------------------------------
         *  Monte Carlo Simulation
        ------------------------------ */
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

        renderMcChart(mcCtx, mc.allResults);

        /* ------------------------------
         *  Build Results Text
        ------------------------------ */
        let out = "";
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
    });

    /* --------------------------------------------------
     *  Footer Date Logic
    -------------------------------------------------- */
    const yearSpan = document.getElementById("currentyear");
    const modSpan = document.getElementById("lastModified");

    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
    if (modSpan) modSpan.textContent = document.lastModified;
});
