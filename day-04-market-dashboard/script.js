// ========== YOUR API KEYS (already inserted) ==========
const FCS_API_KEY = "lOBY2kjUuIAK9qEXCBHo3KI6g";
const COINGECKO_API_KEY = "CG-Q68NvDLp71AUzdMNJAYTYDfB";

// Asset lists
const cryptoAssets = [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
    { id: "ethereum", symbol: "ETH", name: "Ethereum" },
    { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
    { id: "ripple", symbol: "XRP", name: "Ripple" },
    { id: "cardano", symbol: "ADA", name: "Cardano" },
    { id: "solana", symbol: "SOL", name: "Solana" }
];

const fiatAssets = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "CNY", name: "Chinese Yuan" }
];

const vsCurrencies = ["USD", "EUR", "GBP", "JPY"];

// State
let currentAssetType = "crypto";
let currentAssetId = "bitcoin";
let currentVs = "USD";
let currentDays = 7;
let chart = null;
let series = null;

// DOM elements
const assetSelect = document.getElementById("assetSelect");
const vsSelect = document.getElementById("vsSelect");
const btnCrypto = document.getElementById("btnCrypto");
const btnFiat = document.getElementById("btnFiat");
const timeframeBtns = document.querySelectorAll(".timeframe button");
const currentPriceSpan = document.getElementById("currentPrice");
const changePercentSpan = document.getElementById("changePercent");
const loadingMsg = document.getElementById("loadingMsg");
const errorMsg = document.getElementById("errorMsg");

function setLoading(show) {
    loadingMsg.style.display = show ? "block" : "none";
}
function setError(text) {
    errorMsg.style.display = "block";
    errorMsg.innerText = text;
    setTimeout(() => { errorMsg.style.display = "none"; }, 4000);
}
function clearError() { errorMsg.style.display = "none"; }

function populateDropdowns() {
    assetSelect.innerHTML = "";
    if (currentAssetType === "crypto") {
        cryptoAssets.forEach(asset => {
            const option = document.createElement("option");
            option.value = asset.id;
            option.textContent = `${asset.name} (${asset.symbol})`;
            if (asset.id === currentAssetId) option.selected = true;
            assetSelect.appendChild(option);
        });
    } else {
        fiatAssets.forEach(asset => {
            const option = document.createElement("option");
            option.value = asset.code;
            option.textContent = `${asset.name} (${asset.code})`;
            if (asset.code === currentAssetId) option.selected = true;
            assetSelect.appendChild(option);
        });
    }
    vsSelect.innerHTML = "";
    vsCurrencies.forEach(vs => {
        const option = document.createElement("option");
        option.value = vs;
        option.textContent = vs;
        if (vs === currentVs) option.selected = true;
        vsSelect.appendChild(option);
    });
}

async function fetchCurrentPrice() {
    try {
        if (currentAssetType === "crypto") {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${currentAssetId}&vs_currencies=${currentVs.toLowerCase()}&include_24hr_change=true`;
            const headers = { "x-cg-demo-api-key": COINGECKO_API_KEY };
            const response = await fetch(url, { headers });
            const data = await response.json();
            if (data[currentAssetId]) {
                const price = data[currentAssetId][currentVs.toLowerCase()];
                const change = data[currentAssetId][`${currentVs.toLowerCase()}_24h_change`];
                currentPriceSpan.innerText = `${price?.toFixed(2) || "?"} ${currentVs}`;
                if (change !== undefined) {
                    changePercentSpan.innerText = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
                    changePercentSpan.className = `change-percent ${change >= 0 ? "positive" : "negative"}`;
                }
            } else throw new Error("No price data");
        } else {
            const url = `https://fcsapi.com/api-v3/forex/latest?symbol=${currentAssetId}/${currentVs}&access_key=${FCS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.response && data.response.length > 0) {
                const rate = parseFloat(data.response[0].rate);
                currentPriceSpan.innerText = `${rate.toFixed(4)} ${currentVs}`;
                changePercentSpan.innerText = "N/A";
                changePercentSpan.className = "change-percent";
            } else throw new Error("No fiat rate");
        }
    } catch (err) {
        console.error(err);
        currentPriceSpan.innerText = `-- ${currentVs}`;
        changePercentSpan.innerText = "--";
    }
}

async function fetchHistoricalData() {
    setLoading(true);
    clearError();
    try {
        let dataPoints = [];
        if (currentAssetType === "crypto") {
            let daysParam = currentDays === "max" ? "max" : currentDays.toString();
            const url = `https://api.coingecko.com/api/v3/coins/${currentAssetId}/market_chart?vs_currency=${currentVs.toLowerCase()}&days=${daysParam}&interval=daily`;
            const headers = { "x-cg-demo-api-key": COINGECKO_API_KEY };
            const response = await fetch(url, { headers });
            const result = await response.json();
            if (result.prices && result.prices.length > 0) {
                dataPoints = result.prices.map(item => ({ time: Math.floor(item[0] / 1000), value: item[1] }));
            } else throw new Error("No crypto history");
        } else {
            let end = new Date();
            let start = new Date();
            if (currentDays === "max") start.setFullYear(end.getFullYear() - 5);
            else start.setDate(end.getDate() - currentDays);
            const fromDate = start.toISOString().split('T')[0];
            const toDate = end.toISOString().split('T')[0];
            const url = `https://fcsapi.com/api-v3/forex/history?symbol=${currentAssetId}/${currentVs}&from=${fromDate}&to=${toDate}&access_key=${FCS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.response && data.response.history && data.response.history.length > 0) {
                dataPoints = data.response.history.map(item => ({ time: Math.floor(new Date(item.date).getTime() / 1000), value: parseFloat(item.close) }));
            } else throw new Error("No fiat history");
        }

        if (!chart) {
            chart = LightweightCharts.createChart(document.getElementById("chartContainer"), {
                width: document.getElementById("chartContainer").clientWidth,
                height: 400,
                layout: { backgroundColor: "#ffffff", textColor: "#333" },
                grid: { vertLines: { color: "#f0f0f0" }, horzLines: { color: "#f0f0f0" } },
                crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                rightPriceScale: { borderColor: "#e2e8f0" },
                timeScale: { borderColor: "#e2e8f0", timeVisible: true, secondsVisible: false }
            });
            series = chart.addLineSeries({ color: "#2c7da0", lineWidth: 2 });
        }
        series.setData(dataPoints);
        chart.timeScale().fitContent();
    } catch (err) {
        console.error(err);
        setError("Failed to load chart data. Check API keys or try different pair.");
    } finally {
        setLoading(false);
    }
}

async function refreshAll() {
    await fetchCurrentPrice();
    await fetchHistoricalData();
}

function onAssetTypeChange(type) {
    currentAssetType = type;
    if (type === "crypto") currentAssetId = cryptoAssets[0].id;
    else currentAssetId = fiatAssets[0].code;
    btnCrypto.classList.toggle("active", type === "crypto");
    btnFiat.classList.toggle("active", type === "fiat");
    populateDropdowns();
    refreshAll();
}

function onAssetChange() { currentAssetId = assetSelect.value; refreshAll(); }
function onVsChange() { currentVs = vsSelect.value; refreshAll(); }
function onTimeframeChange(days) {
    currentDays = days;
    timeframeBtns.forEach(btn => {
        const btnDays = btn.getAttribute("data-days");
        if ((btnDays === days.toString()) || (days === "max" && btnDays === "max")) btn.classList.add("active");
        else btn.classList.remove("active");
    });
    refreshAll();
}

// Event listeners
btnCrypto.addEventListener("click", () => onAssetTypeChange("crypto"));
btnFiat.addEventListener("click", () => onAssetTypeChange("fiat"));
assetSelect.addEventListener("change", onAssetChange);
vsSelect.addEventListener("change", onVsChange);
timeframeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const days = btn.getAttribute("data-days");
        onTimeframeChange(days === "max" ? "max" : parseInt(days));
    });
});

// Initial load
populateDropdowns();
refreshAll();
window.addEventListener("resize", () => {
    if (chart) chart.applyOptions({ width: document.getElementById("chartContainer").clientWidth });
});