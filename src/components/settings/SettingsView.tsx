import { useState, useEffect } from 'react';
import { useStockRefresh } from '@/hooks/StockRefreshContext';
import { useFamilyContext } from '@/hooks/FamilyContext';
import type { Relationship } from '@/types/family';

const relationshipLabels: Record<Relationship, string> = {
  self: 'Me',
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  sibling: 'Sibling',
  other: 'Other',
};

const addableRelationships: Exclude<Relationship, 'self'>[] = [
  'spouse',
  'child',
  'parent',
  'sibling',
  'other',
];

// Compare semver versions: returns true if newVer > currentVer
function isNewerVersion(newVer: string, currentVer: string): boolean {
  const parseVersion = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [newMajor, newMinor = 0, newPatch = 0] = parseVersion(newVer);
  const [curMajor, curMinor = 0, curPatch = 0] = parseVersion(currentVer);

  if (newMajor !== curMajor) return newMajor > curMajor;
  if (newMinor !== curMinor) return newMinor > curMinor;
  return newPatch > curPatch;
}

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

  const {
    members,
    addMember,
    updateMember,
    deleteMember,
  } = useFamilyContext();

  const [appVersion, setAppVersion] = useState<string>('');
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [newVersion, setNewVersion] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Family member form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState<Exclude<Relationship, 'self'>>('spouse');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState<Relationship>('self');

  useEffect(() => {
    window.electronAPI?.getAppVersion().then((v: string) => setAppVersion(v));

    window.electronAPI?.onUpdateAvailable((version: string) => {
      // Only show update if new version is higher than current
      window.electronAPI?.getAppVersion().then((current: string) => {
        if (isNewerVersion(version, current)) {
          setNewVersion(version);
          setUpdateState('available');
        }
      });
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
      const currentVer = await window.electronAPI?.getAppVersion();
      if (result?.available && result.version && currentVer && isNewerVersion(result.version, currentVer)) {
        setNewVersion(result.version);
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

  const handleAddMember = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addMember(trimmed, newRelationship);
    setNewName('');
    setNewRelationship('spouse');
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setNewName('');
    setNewRelationship('spouse');
    setIsAdding(false);
  };

  const handleStartEdit = (id: string, name: string, relationship: Relationship) => {
    setEditingId(id);
    setEditName(name);
    setEditRelationship(relationship);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const member = members.find((m) => m.id === editingId);
    if (!member) return;

    const updates: Record<string, string> = {};
    if (trimmed !== member.name) updates.name = trimmed;
    if (editRelationship !== member.relationship && member.relationship !== 'self') {
      updates.relationship = editRelationship;
    }

    if (Object.keys(updates).length > 0) {
      await updateMember(editingId, updates);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteMember = async (id: string) => {
    await deleteMember(id);
  };

  return (
    <div className="max-w-2xl">
      {/* Family Members Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)] overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">Family Members</h2>

          <div className="space-y-0">
            {members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center py-3 ${
                  idx < members.length - 1 ? 'border-b border-[var(--color-border-light)]' : ''
                }`}
              >
                {editingId === member.id ? (
                  /* Editing mode */
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                      className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none w-32"
                    />
                    {member.relationship !== 'self' ? (
                      <select
                        value={editRelationship}
                        onChange={(e) => setEditRelationship(e.target.value as Relationship)}
                        className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none cursor-pointer"
                      >
                        {addableRelationships.map((rel) => (
                          <option key={rel} value={rel}>
                            {relationshipLabels[rel]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[12px] text-[var(--color-text-muted)] px-3 py-1.5">
                        {relationshipLabels.self}
                      </span>
                    )}
                    <button
                      onClick={handleSaveEdit}
                      className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors duration-150 cursor-pointer"
                      aria-label="Save"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 text-[var(--color-text-muted)] hover:bg-slate-100 rounded-lg transition-colors duration-150 cursor-pointer"
                      aria-label="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex items-center flex-1 min-w-0">
                    <button
                      onClick={() => handleStartEdit(member.id, member.name, member.relationship)}
                      className="text-[13px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors duration-150 cursor-pointer truncate text-left"
                    >
                      {member.name}
                    </button>
                    <span className="text-[12px] text-[var(--color-text-muted)] ml-3 flex-shrink-0">
                      {relationshipLabels[member.relationship]}
                    </span>
                  </div>
                )}

                {/* Actions (only show when not editing) */}
                {editingId !== member.id && member.relationship !== 'self' && (
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] rounded-lg transition-colors duration-150 cursor-pointer ml-2 flex-shrink-0"
                    aria-label={`Delete ${member.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Member Form */}
          {isAdding ? (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMember();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                placeholder="Name"
                autoFocus
                className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none w-32"
              />
              <select
                value={newRelationship}
                onChange={(e) => setNewRelationship(e.target.value as Exclude<Relationship, 'self'>)}
                className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none cursor-pointer"
              >
                {addableRelationships.map((rel) => (
                  <option key={rel} value={rel}>
                    {relationshipLabels[rel]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors duration-200 cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={handleCancelAdd}
                className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-sidebar)] hover:bg-slate-200 rounded-lg transition-colors duration-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors duration-200 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Family Member
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)] overflow-hidden">
        {/* Stock Price Settings */}
        <div className="p-6 border-b border-[var(--color-border-light)]">
          <h2 className="text-base font-medium text-[var(--color-text)] mb-4">Stock Price Settings</h2>

          <div className="space-y-4">
            {/* Auto-refresh toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">Auto-refresh</label>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                  Automatically update prices during US market hours
                </p>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                  autoRefresh ? 'bg-[var(--color-primary)]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Interval selector */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">Refresh Interval</label>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                  Set the price update frequency
                </p>
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value) as 30 | 60 | 300)}
                disabled={!autoRefresh}
                className="text-[13px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
              >
                <option value={30}>30 sec</option>
                <option value={60}>1 min</option>
                <option value={300}>5 min</option>
              </select>
            </div>

            {/* Market status */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-light)]">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">US Market Status</label>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                  NYSE/NASDAQ: Mon-Fri 9:30 AM - 4:00 PM (ET)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${marketOpen ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-text-muted)]'}`} />
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {marketOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>

            {/* Last updated */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">Last Updated</label>
              </div>
              <span className="text-[13px] text-[var(--color-text-secondary)] tabular-nums">
                {formatLastUpdated(lastUpdated)}
              </span>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="px-6 py-4 bg-[var(--color-bg-sidebar)]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
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
      <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)] overflow-hidden mt-6">
        <div className="p-6">
          <h2 className="text-base font-medium text-[var(--color-text)] mb-4">App Version</h2>

          <div className="space-y-4">
            {/* Current version */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">Current Version</label>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">Installed version of the app</p>
              </div>
              <span className="text-[13px] font-mono text-[var(--color-text-secondary)]">v{appVersion || '...'}</span>
            </div>

            {/* Update check */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-light)]">
              <div>
                <label className="text-[13px] font-medium text-[var(--color-text)]">Updates</label>
                <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                  {updateState === 'no-update' && 'You have the latest version'}
                  {updateState === 'available' && `New version ${newVersion} available`}
                  {updateState === 'downloading' && `Downloading... ${downloadProgress}%`}
                  {updateState === 'ready' && 'Update ready to install'}
                  {updateState === 'error' && <span className="text-[var(--color-negative)]">{errorMsg || 'Update check failed'}</span>}
                  {(updateState === 'idle' || updateState === 'checking') && 'Check for available updates'}
                </p>
              </div>
              <div>
                {updateState === 'idle' && (
                  <button
                    onClick={handleCheckUpdate}
                    className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-sidebar)] hover:bg-slate-200 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    Check for Updates
                  </button>
                )}
                {updateState === 'checking' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--color-text-muted)]">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Checking...
                  </div>
                )}
                {updateState === 'no-update' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-positive)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Up to date
                  </span>
                )}
                {updateState === 'available' && (
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    Download Update
                  </button>
                )}
                {updateState === 'downloading' && (
                  <div className="w-24 h-2 bg-[var(--color-bg-sidebar)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-primary)] transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}
                {updateState === 'ready' && (
                  <button
                    onClick={handleInstall}
                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    Restart & Update
                  </button>
                )}
                {updateState === 'error' && (
                  <button
                    onClick={handleCheckUpdate}
                    className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-sidebar)] hover:bg-slate-200 rounded-lg transition-colors duration-200 cursor-pointer"
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
