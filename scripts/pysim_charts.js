let balanceChartInstance = null;
let withdrawChartInstance = null;
let withdrawRealChartInstance = null;
let mcChartInstance = null;

function makeOrUpdateChart(ctx, config, existing) {
    if (existing) {
        existing.data = config.data;
        existing.options = config.options;
        existing.update();
        return existing;
    }
    return new Chart(ctx, config);
}

window.updateCharts = function (chartsData) {
    const det = chartsData.deterministic;
    const mc = chartsData.monte_carlo;

    const labels = det.balances.map((_, i) => i + 1);

    const balanceCtx = document.getElementById("balanceChart").getContext("2d");
    balanceChartInstance = makeOrUpdateChart(balanceCtx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Balance",
                data: det.balances,
                borderColor: "blue",
                fill: false
            }]
        },
        options: { responsive: true }
    }, balanceChartInstance);

    const withdrawCtx = document.getElementById("withdrawChart").getContext("2d");
    withdrawChartInstance = makeOrUpdateChart(withdrawCtx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Withdrawals",
                data: det.withdrawals,
                borderColor: "red",
                fill: false
            }]
        },
        options: { responsive: true }
    }, withdrawChartInstance);

    // For now, reuse same data for "real" chart; later you can pass real-dollar arrays
    const withdrawRealCtx = document.getElementById("withdrawChartReal").getContext("2d");
    withdrawRealChartInstance = makeOrUpdateChart(withdrawRealCtx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Balance (Real)",
                    data: det.balances,
                    borderColor: "green",
                    fill: false
                },
                {
                    label: "Withdrawals (Real)",
                    data: det.withdrawals,
                    borderColor: "orange",
                    fill: false
                }
            ]
        },
        options: { responsive: true }
    }, withdrawRealChartInstance);

    const mcCtx = document.getElementById("mcChart").getContext("2d");
    mcChartInstance = makeOrUpdateChart(mcCtx, {
        type: "bar",
        data: {
            labels: mc.final_legacy.map((_, i) => i + 1),
            datasets: [{
                label: "Final Legacy",
                data: mc.final_legacy,
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { display: false }
            }
        }
    }, mcChartInstance);
};
