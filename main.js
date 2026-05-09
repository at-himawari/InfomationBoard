const { app, BrowserWindow, ipcMain, screen } = require("electron");

const NEWS_RSS_URL = "https://www3.nhk.or.jp/rss/news/cat0.xml";
const EARTHQUAKE_URL = "https://api.p2pquake.net/v2/history?codes=551&limit=5";
const MARKET_SYMBOLS = ["usdjpy", "eurjpy", "^nkx", "^spx", "aapl.us", "tsla.us"];
const WEATHER_CITY = process.env.HUD_WEATHER_CITY || "札幌";
const WEATHER_LAT = process.env.HUD_WEATHER_LAT || "43.0642";
const WEATHER_LON = process.env.HUD_WEATHER_LON || "141.3469";

let mainWindow;

function createWindow() {
  const targetDisplay = getTargetDisplay();
  const { x, y, width, height } = targetDisplay.workArea;

  mainWindow = new BrowserWindow({
    x,
    y,
    width: Math.max(1280, width),
    height: Math.max(720, height),
    minWidth: 960,
    minHeight: 540,
    title: "HUD",
    backgroundColor: "#08090b",
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.key.toLowerCase() === "f" && input.control && input.meta)) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if (input.key === "Escape" && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
      event.preventDefault();
    }
  });

  mainWindow.loadFile("index.html");

  if (process.env.HUD_FULLSCREEN === "1") {
    mainWindow.once("ready-to-show", () => mainWindow.setFullScreen(true));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("hud:toggleFullscreen", () => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  if (process.env.HUD_DISPLAY === "primary") return primary;
  if (process.env.HUD_DISPLAY_ID) {
    const match = displays.find((display) => String(display.id) === process.env.HUD_DISPLAY_ID);
    if (match) return match;
  }
  return displays.find((display) => display.id !== primary.id) || primary;
}

ipcMain.handle("hud:getNews", async () => {
  const xml = await fetchText(NEWS_RSS_URL);
  return parseRss(xml).slice(0, 8);
});

ipcMain.handle("hud:getMarkets", async () => {
  const rows = await Promise.allSettled(
    MARKET_SYMBOLS.map(async (symbol) => {
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
      const csv = await fetchText(url);
      return parseStooq(csv)[0];
    })
  );

  return rows.map((row) => (row.status === "fulfilled" ? row.value : null)).filter(Boolean);
});

ipcMain.handle("hud:getEarthquakes", async () => {
  const res = await fetch(EARTHQUAKE_URL, { headers: { "user-agent": "sub-display-hud" } });
  if (!res.ok) throw new Error(`Earthquake API failed: ${res.status}`);
  const rows = await res.json();

  return rows.map((row) => {
    const quake = row.earthquake || {};
    const hypo = quake.hypocenter || {};
    return {
      id: row.id,
      time: quake.time || row.time,
      area: hypo.name || "震源不明",
      magnitude: hypo.magnitude ?? null,
      depth: hypo.depth ?? null,
      maxScale: formatJmaScale(row.points),
      points: (row.points || []).slice(0, 5).map((point) => point.addr).filter(Boolean)
    };
  });
});

ipcMain.handle("hud:getWeather", async () => {
  const params = new URLSearchParams({
    latitude: WEATHER_LAT,
    longitude: WEATHER_LON,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Asia/Tokyo",
    forecast_days: "4"
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { "user-agent": "sub-display-hud" }
  });
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  const row = await res.json();
  const daily = row.daily || {};

  return {
    city: WEATHER_CITY,
    updatedAt: row.current?.time || new Date().toISOString(),
    current: {
      temperature: row.current?.temperature_2m ?? null,
      apparent: row.current?.apparent_temperature ?? null,
      humidity: row.current?.relative_humidity_2m ?? null,
      wind: row.current?.wind_speed_10m ?? null,
      code: row.current?.weather_code ?? null,
      label: weatherLabel(row.current?.weather_code)
    },
    forecast: (daily.time || []).map((date, index) => ({
      date,
      code: daily.weather_code?.[index] ?? null,
      label: weatherLabel(daily.weather_code?.[index]),
      max: daily.temperature_2m_max?.[index] ?? null,
      min: daily.temperature_2m_min?.[index] ?? null,
      rain: daily.precipitation_probability_max?.[index] ?? null
    }))
  };
});

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "sub-display-hud" } });
  if (!res.ok) throw new Error(`Fetch failed: ${url} ${res.status}`);
  return res.text();
}

function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const item = match[1];
    return {
      title: decodeXml(readTag(item, "title")),
      link: decodeXml(readTag(item, "link")),
      pubDate: readTag(item, "pubDate")
    };
  });
}

function parseStooq(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const rows = lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });

  return rows
    .filter((row) => row.Close && row.Close !== "N/D")
    .map((row) => {
      const open = Number(row.Open);
      const close = Number(row.Close);
      const change = Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : 0;
      return {
        symbol: row.Symbol,
        label: labelMarket(row.Symbol),
        price: close,
        changePercent: change,
        time: `${row.Date || ""} ${row.Time || ""}`.trim()
      };
    });
}

function labelMarket(symbol) {
  const labels = {
    usdjpy: "USD/JPY",
    eurjpy: "EUR/JPY",
    "^nkx": "日経平均",
    "^spx": "S&P 500",
    "aapl.us": "Apple",
    "tsla.us": "Tesla"
  };
  return labels[symbol.toLowerCase()] || symbol.toUpperCase();
}

function formatJmaScale(points = []) {
  const max = points.reduce((value, point) => Math.max(value, Number(point.scale || 0)), 0);
  if (!max) return "不明";
  const table = {
    10: "1",
    20: "2",
    30: "3",
    40: "4",
    45: "5弱",
    50: "5強",
    55: "6弱",
    60: "6強",
    70: "7"
  };
  return table[max] || String(max);
}

function weatherLabel(code) {
  const labels = {
    0: "快晴",
    1: "晴れ",
    2: "薄曇り",
    3: "曇り",
    45: "霧",
    48: "霧氷",
    51: "霧雨",
    53: "霧雨",
    55: "強い霧雨",
    56: "凍る霧雨",
    57: "強い凍る霧雨",
    61: "小雨",
    63: "雨",
    65: "強い雨",
    66: "凍る雨",
    67: "強い凍る雨",
    71: "小雪",
    73: "雪",
    75: "大雪",
    77: "雪粒",
    80: "にわか雨",
    81: "にわか雨",
    82: "強いにわか雨",
    85: "にわか雪",
    86: "強いにわか雪",
    95: "雷雨",
    96: "雷雨・雹",
    99: "強い雷雨・雹"
  };
  return labels[code] || "天気不明";
}

function readTag(input, tag) {
  const match = input.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() : "";
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
