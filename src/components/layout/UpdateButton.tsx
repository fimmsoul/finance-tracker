import { useState, useEffect } from 'react';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready';

export default function UpdateButton() {
  const [state, setState] = useState<UpdateState>('idle');
  const [newVersion, setNewVersion] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Get current app version
    window.electronAPI?.getAppVersion().then((v: string) => setCurrentVersion(v));

    // Listen for update events
    window.electronAPI?.onUpdateAvailable((version) => {
      // Only show update if new version is different from current
      window.electronAPI?.getAppVersion().then((current: string) => {
        if (version !== current) {
          setNewVersion(version);
          setState('available');
        }
      });
    });

    window.electronAPI.onUpdateDownloadProgress((percent) => {
      setProgress(Math.round(percent));
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setState('ready');
    });

    window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
      setState('idle');
    });
  }, []);

  const handleDownload = async () => {
    setState('downloading');
    setProgress(0);
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  if (state === 'idle') return null;

  return (
    <div className="flex items-center">
      {state === 'available' && (
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Update {newVersion}
        </button>
      )}

      {state === 'downloading' && (
        <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-gray-500 bg-gray-100 rounded-md">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Downloading {progress}%
        </div>
      )}

      {state === 'ready' && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restart to Update
        </button>
      )}
    </div>
  );
}
