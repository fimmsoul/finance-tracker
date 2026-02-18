import { useState, useEffect } from 'react';
import { useStockRefresh } from '@/hooks/StockRefreshContext';

function formatLastUpdated(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'no-update' | 'error';

export default function SettingsView() {
  const {
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    marketOpen,
    lastUpdated,
  } = useStockRefresh();

  const [appVersion, setAppVersion] = useState<string>('');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [newVersion, setNewVersion] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    window.electronAPI?.getAppVersion().then((v: string) => setAppVersion(v));

    window.electronAPI?.onUpdateAvailable((version: string) => {
      setNewVersion(version);
      setUpdateState('available');
    });

    window.electronAPI?.onUpdateDownloadProgress((percent: number) => {
      setDownloadProgress(Math.round(percent));
    });

    window.electronAPI?.onUpdateDownloaded(() => {
      setUpdateState('ready');
    });

    window.electronAPI?.onUpdateError((error: string) => {
      setErrorMsg(error);
      setUpdateState('error');
    });
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateState('checking');
    setErrorMsg('');
    try {
      const result = await window.electronAPI?.checkForUpdates();
      if (result?.available) {
        setNewVersion(result.version || '');
        setUpdateState('available');
      } else {
        setUpdateState('no-update');
        setTimeout(() => setUpdateState('idle'), 3000);
      }
    } catch (err) {
      setErrorMsg(String(err));
      setUpdateState('error');
    }
  };

  const handleDownload = async () => {
    setUpdateState('downloading');
    setDownloadProgress(0);
    await window.electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI?.installUpdate();
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Stock Price Settings */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-900 mb-4">Stock Price Settings</h2>

          <div className="space-y-4">
            {/* Auto-refresh toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-refresh</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically update prices during US market hours
                </p>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoRefresh ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Interval selector */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Refresh Interval</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Set the price update frequency
                </p>
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value) as 30 | 60 | 300)}
                disabled={!autoRefresh}
                className="text-sm border border-gray-200 rounded-md px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={30}>30 sec</option>
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
              </select>
            </div>

            {/* Market status */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700">US Market Status</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  NYSE/NASDAQ: Mon-Fri 9:30 AM - 4:00 PM (ET)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${marketOpen ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm text-gray-600">
                  {marketOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>

            {/* Last updated */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Last Updated</label>
              </div>
              <span className="text-sm text-gray-600 tabular-nums">
                {formatLastUpdated(lastUpdated)}
              </span>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="text-xs text-gray-500 leading-relaxed">
              <p>
                Stock prices are fetched via Yahoo Finance API.
                Auto-refresh is only active during US market hours (Mon-Fri 9:30 AM - 4:00 PM ET).
              </p>
              <p className="mt-1">
                Auto-refresh is automatically paused when the market closes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* App Version Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
        <div className="p-6">
          <h2 className="text-base font-medium text-gray-900 mb-4">App Version</h2>

          <div className="space-y-4">
            {/* Current version */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Current Version</label>
                <p className="text-xs text-gray-500 mt-0.5">Installed version of the app</p>
              </div>
              <span className="text-sm font-mono text-gray-600">v{appVersion || '...'}</span>
            </div>

            {/* Update check */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700">Updates</label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {updateState === 'no-update' && 'You have the latest version'}
                  {updateState === 'available' && `New version ${newVersion} available`}
                  {updateState === 'downloading' && `Downloading... ${downloadProgress}%`}
                  {updateState === 'ready' && 'Update ready to install'}
                  {updateState === 'error' && <span className="text-red-500">{errorMsg || 'Update check failed'}</span>}
                  {(updateState === 'idle' || updateState === 'checking') && 'Check for available updates'}
                </p>
              </div>
              <div>
                {updateState === 'idle' && (
                  <button
                    onClick={handleCheckUpdate}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Check for Updates
                  </button>
                )}
                {updateState === 'checking' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Checking...
                  </div>
                )}
                {updateState === 'no-update' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Up to date
                  </span>
                )}
                {updateState === 'available' && (
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors"
                  >
                    Download Update
                  </button>
                )}
                {updateState === 'downloading' && (
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
                {updateState === 'ready' && (
                  <button
                    onClick={handleInstall}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors"
                  >
                    Restart & Update
                  </button>
                )}
                {updateState === 'error' && (
                  <button
                    onClick={handleCheckUpdate}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
