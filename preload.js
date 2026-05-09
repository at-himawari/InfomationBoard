const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hud", {
  getNews: () => ipcRenderer.invoke("hud:getNews"),
  getMarketNews: () => ipcRenderer.invoke("hud:getMarketNews"),
  getMarkets: () => ipcRenderer.invoke("hud:getMarkets"),
  getEarthquakes: () => ipcRenderer.invoke("hud:getEarthquakes"),
  getWeather: () => ipcRenderer.invoke("hud:getWeather"),
  toggleFullscreen: () => ipcRenderer.invoke("hud:toggleFullscreen")
});
