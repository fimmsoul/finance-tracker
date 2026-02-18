import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

const PROTOCOL_NAME = 'financetracker';
const isDev = !app.isPackaged;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#FAFAF8',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle opening external URLs (for OAuth)
ipcMain.on('open-external', (_event, url: string) => {
  shell.openExternal(url);
});

// Handle Yahoo Finance stock price fetching
ipcMain.handle('fetch-stock-prices', async (_event, tickers: string[]) => {
  try {
    const YahooFinance = require('yahoo-finance2').default;
    const yahooFinance = new YahooFinance();
    const results: Record<string, { price: number; currency: string } | null> = {};

    // Fetch quotes for all tickers in parallel
    const promises = tickers.map(async (ticker: string) => {
      try {
        const quote = await yahooFinance.quote(ticker);
        if (quote && quote.regularMarketPrice) {
          results[ticker] = {
            price: quote.regularMarketPrice,
            currency: quote.currency || 'USD',
          };
        } else {
          results[ticker] = null;
        }
      } catch (err: any) {
        console.error(`Failed to fetch price for ${ticker}:`, err?.message || err);
        results[ticker] = null;
      }
    });

    await Promise.all(promises);
    return { success: true, data: results };
  } catch (err: any) {
    console.error('Failed to fetch stock prices:', err?.message || err);
    return { success: false, error: String(err) };
  }
});

// Handle auth callback URL
function handleAuthCallback(url: string) {
  mainWindow?.webContents.send('auth-callback', url);
}

// macOS: handle custom protocol URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Windows: single instance lock + deep link handling
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_NAME}://`));
    if (url) handleAuthCallback(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Auto Updater ───────────────────────────────────────────────────────────

// Check for updates when app is ready (only in production)
app.whenReady().then(() => {
  if (!isDev) {
    // Check for updates after a short delay
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Failed to check for updates:', err);
      });
    }, 3000);
  }
});

// Send update status to renderer
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-download-progress', progress.percent);
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
  mainWindow?.webContents.send('update-error', err.message);
});

// IPC handlers for update actions
ipcMain.handle('check-for-updates', async () => {
  if (isDev) return { available: false };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result?.updateInfo, version: result?.updateInfo?.version };
  } catch (err) {
    console.error('Check for updates failed:', err);
    return { available: false, error: String(err) };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error('Download update failed:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
