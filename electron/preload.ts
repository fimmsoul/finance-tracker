import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onAuthCallback: (callback: (url: string) => void) => {
    ipcRenderer.on('auth-callback', (_event, url: string) => callback(url));
  },
  openExternal: (url: string) => {
    ipcRenderer.send('open-external', url);
  },
  fetchStockPrices: (tickers: string[]) => {
    return ipcRenderer.invoke('fetch-stock-prices', tickers);
  },
});
