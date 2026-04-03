/* -----------------------------
 *   LOCAL STORAGE setup
 * ----------------------------- */

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
 *  Number Formatting
-------------------------------------------------- */
function formatNumberInput(input) {
    let raw = input.value.replace(/,/g, "");
    if (raw === "" || isNaN(raw)) return;
    input.value = Number(raw).toLocaleString();
}

/* --------------------------------------------------
 *  Financial Math
-------------------------------------------------- */
function fv(rate, nper, pmt, pv) {
    if (rate === 0) return -pv - pmt * nper;
    const factor = Math.pow(1 + rate, nper);
    return -pv * factor - pmt * (factor - 1) / rate;
}

function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleReturns(stockRate, bondRate, stockVol = 0.15, bondVol = 0.05) {
    return [
        stockRate + stockVol * randn(),
        bondRate + bondVol * randn()
    ];
}

/* --------------------------------------------------
 *  Growth Engine
-------------------------------------------------- */
function growYearsWithTimeline({
    lumpValue,
    salary,
    investmentPct,
    stockRate,
    bondRate,
    stockWeight,
    bondWeight,
    salaryGrowth = 0.02,
    years = 1,
    randomize = false,
    stockVol = 0.15,
    bondVol = 0.05
}) {
    let currentLump = lumpValue;
    let currentSalary = salary;
    const timeline = [];

    for (let y = 0; y < years; y++) {
        let sr = stockRate;
        let br = bondRate;

        if (randomize) {
            const [rs, rb] = sampleReturns(stockRate, bondRate, stockVol, bondVol);
            sr = rs;
            br = rb;
        }

        const monthlyContribution = (currentSalary / 12) * (investmentPct / 100);

        const stockLump = currentLump * stockWeight;
        const bondLump = currentLump * bondWeight;

        const stockContrib = monthlyContribution * stockWeight;
        const bondContrib = monthlyContribution * bondWeight;

        const stockFuture = fv(sr / 12, 12, -stockContrib, -stockLump);
        const bondFuture = fv(br / 12, 12, -bondContrib, -bondLump);

        currentLump = stockFuture + bondFuture;
        currentSalary *= (1 + salaryGrowth);

        timeline.push(currentLump);
    }

    return {
        futureNominal: currentLump,
        nextSalary: currentSalary,
        timeline
    };
}

/* --------------------------------------------------
 *  Fund Performance (Simulated)
-------------------------------------------------- */
async function fetchFundData(ticker) {
    const t = ticker.toUpperCase();

    const fundMap = {
        "FXAIX": 0.10, "VFIAX": 0.10, "VOO": 0.10,
        "VTSAX": 0.09, "VTI": 0.09,
        "FXNAX": 0.04, "BND": 0.04, "AGG": 0.04, "VBTLX": 0.04
    };

    let avgAnnual =
        fundMap[t] ??
        (t.includes("BND") || t.includes("AGG") || t.includes("BOND") ? 0.04 : 0.08);

    return {
        ticker: t,
        avgAnnual,
        start: "Simulated",
        end: "Simulated"
    };
}

async function financialPerformance(tickers) {
    const funds = {};

    for (const t of tickers) {
        const info = await fetchFundData(t);
        funds[t] = {
            avg_annual: info.avgAnnual,
            start: info.start,
            end: info.end
        };
    }

    const sortedFunds = Object.entries(funds).sort(
        (a, b) => a[1].avg_annual - b[1].avg_annual
    );

    const conservative = [];
    const moderateAggressive = [];

    for (const [ticker, info] of sortedFunds) {
        if (info.avg_annual < 0.06) conservative.push([ticker, info.avg_annual]);
        else moderateAggressive.push([ticker, info.avg_annual]);
    }

    const avgConservative =
        conservative.length > 0
            ? conservative.reduce((t, [, r]) => t + r, 0) / conservative.length
            : 0;

    const avgModerateAggressive =
        moderateAggressive.length > 0
            ? moderateAggressive.reduce((t, [, r]) => t + r, 0) /
            moderateAggressive.length
            : 0;

    return {
        sortedFunds,
        conservative,
        moderateAggressive,
        avgConservative,
        avgModerateAggressive
    };
}

/* --------------------------------------------------
 *  Core Simulation (Part 1)
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

    // Accumulation phases
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

document.querySelectorAll("#retirement-form input")
    .forEach(el => el.addEventListener("input", saveInputs));

    
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

        const tickersRaw = document.getElementById("tickers").value.trim();
        const tickers = tickersRaw ? tickersRaw.split(",").map(t => t.trim()) : [];

        let stockRate = 0.08;
        let bondRate = 0.04;

        if (tickers.length > 0) {
            const perf = await financialPerformance(tickers);
            stockRate = perf.avgModerateAggressive || 0.08;
            bondRate = perf.avgConservative || 0.04;
        }

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

        renderBalanceChart(balanceCtx, sim.balanceTimeline);
        renderWithdrawChart(withdrawCtx, sim.withdrawTimeline);
        renderWithdrawChartReal(withdrawCtxReal, sim.withdrawTimeline, inflation);

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

