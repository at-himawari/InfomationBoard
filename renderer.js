const state = {
  lastNews: [],
  lastMarkets: [],
  lastQuakes: [],
  weather: null,
  newsIndex: 0
};

const formatTime = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

const formatDateTime = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const yenSymbols = new Set(["USD/JPY", "EUR/JPY"]);

start();

function start() {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("dblclick", () => window.hud.toggleFullscreen());
  tickClock();
  renderNowPanel();
  refreshNews();
  refreshMarkets();
  refreshQuakes();
  refreshWeather();

  setInterval(tickClock, 1000);
  setInterval(refreshNews, 180000);
  setInterval(refreshMarkets, 10000);
  setInterval(refreshQuakes, 30000);
  setInterval(refreshWeather, 600000);
  setInterval(advanceNews, 8000);
}

function handleKeydown(event) {
  if (event.key === "F11" || (event.key.toLowerCase() === "f" && event.metaKey && event.ctrlKey)) {
    event.preventDefault();
    window.hud.toggleFullscreen();
  }
}

function tickClock() {
  text("#clock", formatTime.format(new Date()));
  text("#todayDate", formatToday(new Date()));
}

async function refreshNews() {
  try {
    state.lastNews = await window.hud.getNews();
    state.newsIndex = 0;
    renderNews();
    text("#newsUpdated", `NEWS ${formatDateTime.format(new Date())}`);
    renderNowPanel();
  } catch (error) {
    renderError("#news", "ニュースを取得できません");
  }
}

async function refreshMarkets() {
  try {
    state.lastMarkets = await window.hud.getMarkets();
    renderMarkets();
    text("#marketUpdated", `MARKETS ${formatDateTime.format(new Date())}`);
    renderNowPanel();
  } catch (error) {
    renderError("#markets", "市況を取得できません");
  }
}

async function refreshQuakes() {
  try {
    state.lastQuakes = await window.hud.getEarthquakes();
    renderQuakes();
    text("#quakeUpdated", `QUAKE ${formatDateTime.format(new Date())}`);
    renderNowPanel();
  } catch (error) {
    renderError("#quakes", "地震情報を取得できません");
  }
}

async function refreshWeather() {
  try {
    state.weather = await window.hud.getWeather();
    renderWeather();
    text("#weatherUpdated", formatDateTime.format(new Date()));
  } catch (error) {
    renderError("#weather", "天気予報を取得できません");
    text("#weatherUpdated", "--");
  }
}

function renderNowPanel() {
  text("#marketPulse", buildMarketPulse());
  text("#topNews", state.lastNews[0]?.title || "ニュースを取得しています。");
  text("#quakeWatch", buildQuakeWatch());
}

function buildMarketPulse() {
  if (!state.lastMarkets.length) return "市況を取得しています。";

  const sorted = [...state.lastMarkets].sort(
    (a, b) => Math.abs(Number(b.changePercent)) - Math.abs(Number(a.changePercent))
  );
  const leader = sorted[0];
  const usdJpy = state.lastMarkets.find((item) => item.label === "USD/JPY");
  const direction = Number(leader.changePercent) >= 0 ? "上昇" : "下落";
  const fx = usdJpy ? `USD/JPY ${formatPrice(usdJpy.label, usdJpy.price)}` : "";

  return `${leader.label}が${Math.abs(Number(leader.changePercent)).toFixed(2)}% ${direction}。${fx}`;
}

function buildQuakeWatch() {
  const latest = state.lastQuakes[0];
  if (!latest) return "直近の地震情報はありません。";
  return `最新: 震度${latest.maxScale} / M${latest.magnitude ?? "?"} ${latest.area}`;
}

function renderMarkets() {
  const root = document.querySelector("#markets");
  root.replaceChildren(
    ...state.lastMarkets.map((item) => {
      const change = Number(item.changePercent);
      const direction = change >= 0 ? "up" : "down";
      const card = el("article", `market-card ${direction}`);
      card.append(
        el("span", "market-label", item.label),
        el("strong", "market-price", formatPrice(item.label, item.price)),
        el("span", "market-change", `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`)
      );
      return card;
    })
  );
}

function renderNews() {
  const root = document.querySelector("#news");
  if (!state.lastNews.length) {
    root.replaceChildren(el("div", "feed-muted", "ニュースを取得しています"));
    return;
  }

  const item = state.lastNews[state.newsIndex % state.lastNews.length];
  const card = el("a", "news-card");
  card.href = item.link;
  card.target = "_blank";
  card.rel = "noreferrer";
  card.append(
    el("span", "news-count", `${state.newsIndex + 1} / ${state.lastNews.length}`),
    el("strong", "", item.title),
    el("small", "", item.pubDate ? formatNewsDate(item.pubDate) : "NHK NEWS")
  );

  const dots = el("div", "news-dots");
  dots.replaceChildren(
    ...state.lastNews.map((_, index) => el("span", index === state.newsIndex ? "active" : ""))
  );

  root.replaceChildren(card, dots);
}

function renderQuakes() {
  const root = document.querySelector("#quakes");
  if (!state.lastQuakes.length) {
    root.replaceChildren(el("div", "feed-muted", "直近の地震情報はありません"));
    return;
  }

  root.replaceChildren(
    ...state.lastQuakes.map((item) => {
      const row = el("article", "quake-item");
      row.append(
        el("strong", "", `震度${item.maxScale} / M${item.magnitude ?? "?"}`),
        el("span", "", `${item.area} ${formatDateTime.format(new Date(item.time))}`),
        el("small", "", item.points.join("、") || "観測地点情報なし")
      );
      return row;
    })
  );
}

function renderWeather() {
  const root = document.querySelector("#weather");
  const weather = state.weather;
  if (!weather) {
    root.replaceChildren(el("div", "feed-muted", "天気予報を取得しています"));
    return;
  }

  const current = el("article", "weather-current");
  current.append(
    el("span", "weather-icon", weatherIcon(weather.current.code)),
    el("span", "weather-city", weather.city),
    el("strong", "weather-temp", `${round(weather.current.temperature)}°`),
    el("span", "weather-desc", `${weather.current.label} / 体感 ${round(weather.current.apparent)}°`),
    el("small", "", `湿度 ${weather.current.humidity ?? "--"}%  風 ${round(weather.current.wind)}km/h`)
  );

  const forecast = el("div", "weather-days");
  forecast.replaceChildren(
    ...weather.forecast.slice(0, 4).map((day) => {
      const card = el("article", "weather-day");
      card.append(
        el("span", "weather-day-icon", weatherIcon(day.code)),
        el("span", "", formatWeatherDay(day.date)),
        el("strong", "", day.label),
        el("small", "", `${round(day.min)}° / ${round(day.max)}°  降水 ${day.rain ?? "--"}%`)
      );
      return card;
    })
  );

  root.replaceChildren(current, forecast);
}

function advanceNews() {
  if (!state.lastNews.length) return;
  state.newsIndex = (state.newsIndex + 1) % state.lastNews.length;
  renderNews();
  renderNowPanel();
}

function formatPrice(label, value) {
  const number = Number(value);
  if (yenSymbols.has(label)) return number.toFixed(3);
  if (number >= 1000) return number.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  return number.toLocaleString("ja-JP", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatToday(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatWeatherDay(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

function formatNewsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "NHK NEWS";
  return formatDateTime.format(date);
}

function weatherIcon(code) {
  if ([0, 1].includes(code)) return "☀";
  if (code === 2) return "◐";
  if ([3, 45, 48].includes(code)) return "☁";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "⚡";
  return "○";
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Math.round(number);
}

function renderError(selector, message) {
  document.querySelector(selector).replaceChildren(el("div", "feed-muted", message));
}

function text(selector, value) {
  document.querySelector(selector).textContent = value;
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}
