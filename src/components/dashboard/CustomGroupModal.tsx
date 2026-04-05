import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useSharedCustomGroups } from '@/hooks/DataContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { formatCurrencyValue } from '@/lib/currency';
import { groupColorOptions, type GroupColor } from '@/types/customGroup';

interface CustomGroupModalProps {
  viewId: string; // which portfolio view this group belongs to
  groupId: string | null; // null = create new
  onClose: () => void;
}

const colorStyles: Record<GroupColor, { ring: string; bg: string }> = {
  purple: { ring: 'ring-purple-500', bg: 'bg-purple-500' },
  green: { ring: 'ring-green-500', bg: 'bg-green-500' },
  blue: { ring: 'ring-blue-500', bg: 'bg-blue-500' },
  orange: { ring: 'ring-orange-500', bg: 'bg-orange-500' },
  pink: { ring: 'ring-pink-500', bg: 'bg-pink-500' },
  gray: { ring: 'ring-slate-500', bg: 'bg-slate-500' },
};

function DraggableAssetItem({
  id,
  name,
  source,
  nav,
  displayCurrency,
  isDragging,
}: {
  id: string;
  name: string;
  source: string;
  nav: number;
  displayCurrency: string;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg cursor-grab active:cursor-grabbing hover:border-[var(--color-text-muted)] transition-colors duration-200 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
        <span className="text-[13px] text-[var(--color-text)]">{name}</span>
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-border-light)] px-1.5 py-0.5 rounded">
          {source}
        </span>
      </div>
      <span className="text-[12px] text-[var(--color-text-secondary)] tabular-nums">
        {formatCurrencyValue(nav, displayCurrency)}
      </span>
    </div>
  );
}

function DroppableArea({
  id,
  children,
  isOver,
  label,
}: {
  id: string;
  children: React.ReactNode;
  isOver: boolean;
  label: string;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[200px] border-2 border-dashed rounded-xl p-3 transition-colors duration-200 ${
        isOver ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-border-light)]'
      }`}
    >
      <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mb-3">{label}</p>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function CustomGroupModal({ viewId, groupId, onClose }: CustomGroupModalProps) {
  const { customGroups, addCustomGroup, updateCustomGroup } = useSharedCustomGroups();
  const { items } = useDashboard();
  const { displayCurrency } = useCurrencyContext();

  const existingGroup = groupId ? customGroups.find((g) => g.id === groupId) : null;

  // Asset IDs already in other groups within the same view (excluding current group being edited)
  const usedAssetIds = useMemo(() => {
    const used = new Set<string>();
    for (const group of customGroups) {
      // Ignore groups from other views (same asset can be used in different views)
      if (group.view_id !== viewId) continue;
      // Exclude the group currently being edited
      if (group.id === groupId) continue;
      for (const assetId of group.asset_ids) {
        used.add(assetId);
      }
    }
    return used;
  }, [customGroups, groupId, viewId]);

  const [name, setName] = useState(existingGroup?.name || '');
  const [color, setColor] = useState<GroupColor>(existingGroup?.color || 'purple');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(existingGroup?.asset_ids || [])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainer, setOverContainer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // All items with composite key (excluding items already in other groups)
  const allItems = useMemo(() => {
    return items
      .map((item) => ({
        ...item,
        compositeId: `${item.source}-${item.id}`,
      }))
      .filter((item) => !usedAssetIds.has(item.compositeId));
  }, [items, usedAssetIds]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  // Split into available and selected
  const availableItems = useMemo(() => {
    return filteredItems.filter((item) => !selectedIds.has(item.compositeId));
  }, [filteredItems, selectedIds]);

  const selectedItems = useMemo(() => {
    return allItems.filter((item) => selectedIds.has(item.compositeId));
  }, [allItems, selectedIds]);

  // Calculate stats for selected items
  const stats = useMemo(() => {
    const totalNav = selectedItems.reduce((sum, item) => sum + item.nav, 0);
    const totalNavKRW = selectedItems.reduce((sum, item) => sum + item.navKRW, 0);
    return { totalNav, totalNavKRW };
  }, [selectedItems]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { over } = event;
    if (!over) {
      setOverContainer(null);
      return;
    }
    setOverContainer(over.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverContainer(null);

    if (!over) return;

    const activeKey = active.id as string;
    const overId = over.id as string;

    if (overId === 'selected' && !selectedIds.has(activeKey)) {
      setSelectedIds((prev) => new Set([...prev, activeKey]));
    } else if (overId === 'available' && selectedIds.has(activeKey)) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(activeKey);
        return next;
      });
    }
  }, [selectedIds]);

  // Click to toggle selection
  const handleToggle = useCallback((compositeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(compositeId)) {
        next.delete(compositeId);
      } else {
        next.add(compositeId);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const assetIds = Array.from(selectedIds);

      if (existingGroup) {
        await updateCustomGroup(existingGroup.id, {
          name: name.trim(),
          color,
          asset_ids: assetIds,
        });
      } else {
        await addCustomGroup({
          view_id: viewId,
          name: name.trim(),
          color,
          asset_ids: assetIds,
        });
      }
      onClose();
    } catch (error) {
      console.error('Error saving group:', error);
    } finally {
      setSaving(false);
    }
  };

  const activeItem = activeId ? allItems.find((item) => item.compositeId === activeId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-[var(--shadow-md)] w-full max-w-3xl max-h-[90vh] flex flex-col border border-[var(--color-border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {existingGroup ? 'Edit Group' : 'Create New Group'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)] rounded-lg transition-colors duration-200 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Name & Color */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dividend Stocks, US Tech"
                className="w-full px-3 py-2 text-[13px] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-shadow duration-200"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-2">
                {groupColorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`w-8 h-8 rounded-full ${colorStyles[opt.value].bg} transition-all duration-200 cursor-pointer ${
                      color === opt.value ? `ring-2 ${colorStyles[opt.value].ring} ring-offset-2` : 'hover:scale-110'
                    }`}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full pl-10 pr-4 py-2 text-[13px] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-shadow duration-200"
              />
            </div>
          </div>

          {/* Drag and Drop Areas */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4">
              {/* Available Items */}
              <DroppableArea
                id="available"
                isOver={overContainer === 'available'}
                label={`All Assets (${availableItems.length})`}
              >
                {availableItems.map((item) => (
                  <div key={item.compositeId} onClick={() => handleToggle(item.compositeId)} className="cursor-pointer">
                    <DraggableAssetItem
                      id={item.compositeId}
                      name={item.name}
                      source={item.source}
                      nav={item.nav}
                      displayCurrency={displayCurrency}
                      isDragging={activeId === item.compositeId}
                    />
                  </div>
                ))}
                {availableItems.length === 0 && (
                  <p className="text-[13px] text-[var(--color-text-muted)] text-center py-4">
                    {searchQuery ? 'No results found' : 'All assets selected'}
                  </p>
                )}
              </DroppableArea>

              {/* Selected Items */}
              <DroppableArea
                id="selected"
                isOver={overContainer === 'selected'}
                label={`Added to Group (${selectedItems.length})`}
              >
                {selectedItems.map((item) => (
                  <div key={item.compositeId} onClick={() => handleToggle(item.compositeId)} className="cursor-pointer">
                    <DraggableAssetItem
                      id={item.compositeId}
                      name={item.name}
                      source={item.source}
                      nav={item.nav}
                      displayCurrency={displayCurrency}
                      isDragging={activeId === item.compositeId}
                    />
                  </div>
                ))}
                {selectedItems.length === 0 && (
                  <p className="text-[13px] text-[var(--color-text-muted)] text-center py-4">
                    Drag or click to add assets
                  </p>
                )}
              </DroppableArea>
            </div>

            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center justify-between px-3 py-2 bg-white border border-[var(--color-primary)] rounded-lg shadow-[var(--shadow-md)]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>
                    <span className="text-[13px] text-[var(--color-text)]">{activeItem.name}</span>
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-border-light)] px-1.5 py-0.5 rounded">
                      {activeItem.source}
                    </span>
                  </div>
                  <span className="text-[12px] text-[var(--color-text-secondary)] tabular-nums">
                    {formatCurrencyValue(activeItem.nav, displayCurrency)}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Stats Preview */}
          {selectedItems.length > 0 && (
            <div className="mt-4 p-4 bg-[var(--color-border-light)] rounded-xl border border-[var(--color-border)]">
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Preview</p>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                  Total: {formatCurrencyValue(stats.totalNav, displayCurrency)}
                </span>
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {formatCurrencyValue(stats.totalNavKRW, 'KRW')}
                </span>
              </div>
              {/* Mini allocation bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-border)] mt-2">
                {selectedItems.map((item, index) => {
                  const pct = stats.totalNav > 0 ? (item.nav / stats.totalNav) * 100 : 0;
                  const opacity = 1 - (index * 0.1);
                  return (
                    <div
                      key={item.compositeId}
                      className={`${colorStyles[color].bg} transition-all duration-300`}
                      style={{ width: `${pct}%`, opacity: Math.max(0.4, opacity) }}
                      title={`${item.name}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-border-light)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] bg-white border border-[var(--color-border)] rounded-lg hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-[13px] font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
          >
            {saving ? 'Saving...' : existingGroup ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
