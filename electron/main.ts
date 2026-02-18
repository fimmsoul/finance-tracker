import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';

const PROTOCOL_NAME = 'financetracker';
const isDev = !app.isPackaged;

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
