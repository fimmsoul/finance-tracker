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
  // Auto-update functions
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (_event, version) => callback(version));
  },
  onUpdateDownloadProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on('update-download-progress', (_event, percent) => callback(percent));
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },
});
