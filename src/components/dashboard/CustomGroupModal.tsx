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
  gray: { ring: 'ring-gray-500', bg: 'bg-gray-500' },
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
      className={`flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
        <span className="text-sm text-gray-800">{name}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {source}
        </span>
      </div>
      <span className="text-xs text-gray-500 tabular-nums">
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
      className={`flex-1 min-h-[200px] border-2 border-dashed rounded-lg p-3 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <p className="text-xs font-medium text-gray-500 mb-3">{label}</p>
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {existingGroup ? 'Edit Group' : 'Create New Group'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dividend Stocks, US Tech"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-2">
                {groupColorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`w-8 h-8 rounded-full ${colorStyles[opt.value].bg} transition-all ${
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
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
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
                  <div key={item.compositeId} onClick={() => handleToggle(item.compositeId)}>
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
                  <p className="text-sm text-gray-400 text-center py-4">
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
                  <div key={item.compositeId} onClick={() => handleToggle(item.compositeId)}>
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
                  <p className="text-sm text-gray-400 text-center py-4">
                    Drag or click to add assets
                  </p>
                )}
              </DroppableArea>
            </div>

            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center justify-between px-3 py-2 bg-white border border-blue-400 rounded-lg shadow-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>
                    <span className="text-sm text-gray-800">{activeItem.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {activeItem.source}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatCurrencyValue(activeItem.nav, displayCurrency)}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Stats Preview */}
          {selectedItems.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Preview</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Total: {formatCurrencyValue(stats.totalNav, displayCurrency)}
                </span>
                <span className="text-sm text-gray-500">
                  {formatCurrencyValue(stats.totalNavKRW, 'KRW')}
                </span>
              </div>
              {/* Mini allocation bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 mt-2">
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : existingGroup ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
