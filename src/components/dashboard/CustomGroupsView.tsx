import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSharedCustomGroups } from '@/hooks/DataContext';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { useDashboard } from '@/hooks/useDashboard';
import { formatCurrencyValue } from '@/lib/currency';
import { type GroupColor } from '@/types/customGroup';
import type { DashboardItem } from '@/types/position';
import CustomGroupModal from './CustomGroupModal';

const colorStyles: Record<GroupColor, { bg: string; text: string; badge: string; border: string }> = {
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700', border: 'border-green-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700', border: 'border-pink-200' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', border: 'border-gray-200' },
};

const barColors: Record<GroupColor, string> = {
  purple: 'bg-purple-400',
  green: 'bg-green-400',
  blue: 'bg-blue-400',
  orange: 'bg-orange-400',
  pink: 'bg-pink-400',
  gray: 'bg-gray-400',
};

const sourceLabels: Record<string, string> = {
  stock: 'Stock',
  cash: 'Cash',
  asset: 'Asset',
};

// Shared column widths - same as DashboardView
function SharedColGroup() {
  return (
    <colgroup>
      <col style={{ width: '3%' }} />   {/* drag */}
      <col style={{ width: '22%' }} />  {/* asset */}
      <col style={{ width: '7%' }} />   {/* type */}
      <col style={{ width: '11%' }} />  {/* % of NAV */}
      <col style={{ width: '15%' }} />  {/* nav */}
      <col style={{ width: '17%' }} />  {/* nav KRW */}
      <col style={{ width: '15%' }} />  {/* cost */}
      <col style={{ width: '10%' }} />  {/* return */}
    </colgroup>
  );
}

function itemKey(item: DashboardItem) {
  return `${item.source}-${item.id}`;
}

function DraggableRow({
  item,
  grandTotalNav,
  displayCurrency,
}: {
  item: DashboardItem;
  grandTotalNav: number;
  displayCurrency: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemKey(item) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const pct = grandTotalNav > 0 ? (item.nav / grandTotalNav) * 100 : 0;

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-50 hover:bg-gray-100/60 transition-colors group">
      <td className="py-2 px-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>
      </td>
      <td className="py-2 px-3 text-sm text-gray-800 truncate">{item.name}</td>
      <td className="py-2 px-3">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {sourceLabels[item.source]}
        </span>
      </td>
      <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-600 font-medium">
        {pct.toFixed(1)}%
      </td>
      <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-800">
        {formatCurrencyValue(item.nav, displayCurrency)}
      </td>
      <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-500">
        {formatCurrencyValue(item.navKRW, 'KRW')}
      </td>
      <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-500">
        {formatCurrencyValue(item.cost, displayCurrency)}
      </td>
      <td className={`py-2 px-3 text-right text-sm tabular-nums ${item.returnPct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
        {item.source === 'cash' ? '—' : `${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(1)}%`}
      </td>
    </tr>
  );
}

function OverlayRow({ item, grandTotalNav, displayCurrency }: { item: DashboardItem; grandTotalNav: number; displayCurrency: string }) {
  const pct = grandTotalNav > 0 ? (item.nav / grandTotalNav) * 100 : 0;
  return (
    <table className="w-full table-fixed bg-white shadow-lg rounded-lg border border-gray-200">
      <SharedColGroup />
      <tbody>
        <tr>
          <td className="py-2 px-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </td>
          <td className="py-2 px-3 text-sm text-gray-800 truncate">{item.name}</td>
          <td className="py-2 px-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {sourceLabels[item.source]}
            </span>
          </td>
          <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-600 font-medium">
            {pct.toFixed(1)}%
          </td>
          <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-800">
            {formatCurrencyValue(item.nav, displayCurrency)}
          </td>
          <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-500">
            {formatCurrencyValue(item.navKRW, 'KRW')}
          </td>
          <td className="py-2 px-3 text-right text-sm tabular-nums text-gray-500">
            {formatCurrencyValue(item.cost, displayCurrency)}
          </td>
          <td className={`py-2 px-3 text-right text-sm tabular-nums ${item.returnPct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {item.source === 'cash' ? '—' : `${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(1)}%`}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

interface GroupStat {
  id: string;
  name: string;
  color: GroupColor;
  asset_ids: string[];
  items: DashboardItem[];
  totalNav: number;
  totalNavKRW: number;
  totalCost: number;
  returnPct: number;
}

function DroppableGroup({
  group,
  grandTotalNav,
  displayCurrency,
  isOver,
  onEdit,
  onDelete,
}: {
  group: GroupStat;
  grandTotalNav: number;
  displayCurrency: string;
  isOver: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: group.id });
  const colors = colorStyles[group.color];
  const groupPct = grandTotalNav > 0 ? (group.totalNav / grandTotalNav) * 100 : 0;

  return (
    <div className={`mb-6 rounded-lg transition-all ${isOver ? `ring-2 ${colors.border} ring-offset-1` : ''}`}>
      {/* Category Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-lg ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold uppercase tracking-wider ${colors.text}`}>
            {group.name}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {groupPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className={`tabular-nums font-medium ${colors.text}`}>
            {formatCurrencyValue(group.totalNav, displayCurrency)}
          </span>
          <span className="tabular-nums text-gray-400">
            {formatCurrencyValue(group.totalNavKRW, 'KRW')}
          </span>
          <span className={`tabular-nums ${group.returnPct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {group.returnPct >= 0 ? '+' : ''}{group.returnPct.toFixed(1)}%
          </span>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => onEdit(group.id)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(group.id)}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div ref={setNodeRef} className="min-h-[48px]">
        <table className="w-full table-fixed">
          <SharedColGroup />
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 px-1"></th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Asset</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Type</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider text-right">% of NAV</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider text-right">NAV ({displayCurrency})</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider text-right">NAV (KRW)</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider text-right">Cost</th>
              <th className="py-2 px-3 text-[10px] font-medium text-gray-400 uppercase tracking-wider text-right">Return</th>
            </tr>
          </thead>
          <SortableContext items={group.items.map(itemKey)} strategy={verticalListSortingStrategy}>
            <tbody>
              {group.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-xs text-gray-300">
                    Drag assets here
                  </td>
                </tr>
              ) : (
                group.items.map((item) => (
                  <DraggableRow
                    key={itemKey(item)}
                    item={item}
                    grandTotalNav={grandTotalNav}
                    displayCurrency={displayCurrency}
                  />
                ))
              )}
            </tbody>
          </SortableContext>
        </table>
      </div>
    </div>
  );
}

interface CustomGroupsViewProps {
  viewId: string; // which portfolio view this belongs to
}

export default function CustomGroupsView({ viewId }: CustomGroupsViewProps) {
  const { customGroups, loading, updateCustomGroup, deleteCustomGroup } = useSharedCustomGroups();
  const { items } = useDashboard();
  const { displayCurrency } = useCurrencyContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);

  // Filter groups by view_id
  const viewGroups = useMemo(() => {
    return customGroups.filter((g) => g.view_id === viewId);
  }, [customGroups, viewId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Map items by their composite key (source-id)
  const itemMap = useMemo(() => {
    const map = new Map<string, DashboardItem>();
    for (const item of items) {
      map.set(`${item.source}-${item.id}`, item);
    }
    return map;
  }, [items]);

  // Calculate group stats
  const groupStats = useMemo((): GroupStat[] => {
    return viewGroups.map((group) => {
      const groupItems = group.asset_ids
        .map((id) => itemMap.get(id))
        .filter((item): item is DashboardItem => item !== undefined);

      const totalNav = groupItems.reduce((sum, item) => sum + item.nav, 0);
      const totalNavKRW = groupItems.reduce((sum, item) => sum + item.navKRW, 0);
      const totalCost = groupItems.reduce((sum, item) => sum + item.cost, 0);
      const returnPct = totalCost > 0 ? ((totalNav - totalCost) / totalCost) * 100 : 0;

      return {
        ...group,
        items: groupItems,
        totalNav,
        totalNavKRW,
        totalCost,
        returnPct,
      };
    });
  }, [viewGroups, itemMap]);

  // Total NAV of all custom groups
  const grandTotalNav = useMemo(() => {
    return groupStats.reduce((sum, group) => sum + group.totalNav, 0);
  }, [groupStats]);

  const grandTotalNavKRW = useMemo(() => {
    return groupStats.reduce((sum, group) => sum + group.totalNavKRW, 0);
  }, [groupStats]);

  const grandTotalCost = useMemo(() => {
    return groupStats.reduce((sum, group) => sum + group.totalCost, 0);
  }, [groupStats]);

  const grandTotalReturn = grandTotalCost > 0
    ? ((grandTotalNav - grandTotalCost) / grandTotalCost) * 100
    : 0;

  // Find which group contains an item
  const findGroupForItem = useCallback((itemId: string): string | null => {
    for (const group of viewGroups) {
      if (group.asset_ids.includes(itemId)) {
        return group.id;
      }
    }
    return null;
  }, [viewGroups]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { over } = event;
    if (!over) {
      setOverGroupId(null);
      return;
    }

    const overId = over.id as string;
    // Check if over is a group directly
    const isGroup = viewGroups.some((g) => g.id === overId);
    if (isGroup) {
      setOverGroupId(overId);
    } else {
      // Over is an item, find its group
      const groupId = findGroupForItem(overId);
      setOverGroupId(groupId);
    }
  }, [viewGroups, findGroupForItem]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverGroupId(null);

    if (!over) return;

    const activeKey = active.id as string;
    const overId = over.id as string;

    // Find source group
    const sourceGroupId = findGroupForItem(activeKey);
    if (!sourceGroupId) return;

    // Find target group
    let targetGroupId: string | null = null;
    const isGroup = viewGroups.some((g) => g.id === overId);
    if (isGroup) {
      targetGroupId = overId;
    } else {
      targetGroupId = findGroupForItem(overId);
    }

    if (!targetGroupId) return;

    const sourceGroup = viewGroups.find((g) => g.id === sourceGroupId);
    const targetGroup = viewGroups.find((g) => g.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;

    // Same group: reorder within group
    if (sourceGroupId === targetGroupId) {
      if (activeKey === overId) return; // Dropped on itself, no change

      const oldIndex = sourceGroup.asset_ids.indexOf(activeKey);
      const newIndex = sourceGroup.asset_ids.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedIds = arrayMove(sourceGroup.asset_ids, oldIndex, newIndex);
      updateCustomGroup(sourceGroupId, { asset_ids: reorderedIds });
      return;
    }

    // Different group: move item from source to target
    const newSourceAssetIds = sourceGroup.asset_ids.filter((id) => id !== activeKey);

    // Insert at the position of overId if dropping on an item, otherwise append
    let newTargetAssetIds: string[];
    if (isGroup) {
      // Dropped on the group header/empty area, append to end
      newTargetAssetIds = [...targetGroup.asset_ids, activeKey];
    } else {
      // Dropped on a specific item, insert at that position
      const insertIndex = targetGroup.asset_ids.indexOf(overId);
      if (insertIndex === -1) {
        newTargetAssetIds = [...targetGroup.asset_ids, activeKey];
      } else {
        newTargetAssetIds = [...targetGroup.asset_ids];
        newTargetAssetIds.splice(insertIndex, 0, activeKey);
      }
    }

    // Run both updates in parallel (optimistic updates happen immediately in updateCustomGroup)
    Promise.all([
      updateCustomGroup(sourceGroupId, { asset_ids: newSourceAssetIds }),
      updateCustomGroup(targetGroupId, { asset_ids: newTargetAssetIds }),
    ]);
  }, [viewGroups, findGroupForItem, updateCustomGroup]);

  const activeItem = activeId ? itemMap.get(activeId) : null;

  const handleEdit = (groupId: string) => {
    setEditingGroupId(groupId);
    setModalOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (window.confirm('Delete this group?')) {
      await deleteCustomGroup(groupId);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingGroupId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header - always visible, sticky */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#FAFAF8] z-20 py-2 -mt-2">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Custom Groups Total</p>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-light text-gray-800 tabular-nums">
              {formatCurrencyValue(grandTotalNav, displayCurrency)}
            </p>
            <span className="text-sm text-gray-400 tabular-nums">
              {formatCurrencyValue(grandTotalNavKRW, 'KRW')}
            </span>
            {groupStats.length > 0 && (
              <span className={`text-sm tabular-nums ${grandTotalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {grandTotalReturn >= 0 ? '+' : ''}{grandTotalReturn.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          + New Group
        </button>
      </div>

      {/* Allocation Bar - only shown when groups exist */}
      {groupStats.length > 0 && (
        <div className="mb-6">
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            {groupStats.map((group) => {
              const pct = grandTotalNav > 0 ? (group.totalNav / grandTotalNav) * 100 : 0;
              return (
                <div
                  key={group.id}
                  className={`${barColors[group.color]} transition-all duration-500 flex items-center justify-center`}
                  style={{ width: `${pct}%` }}
                >
                  {pct > 8 && (
                    <span className="text-[9px] text-white font-medium">{pct.toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {groupStats.map((group) => (
              <div key={group.id} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${barColors[group.color]}`} />
                <span className="text-[10px] text-gray-400">{group.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State - message when no groups */}
      {groupStats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-1">No custom groups</p>
          <p className="text-sm text-gray-400">Bundle assets as you like for analysis</p>
        </div>
      )}

      {/* Group Tables with Drag & Drop */}
      {groupStats.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {groupStats.map((group) => (
            <DroppableGroup
              key={group.id}
              group={group}
              grandTotalNav={grandTotalNav}
              displayCurrency={displayCurrency}
              isOver={overGroupId === group.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          <DragOverlay>
            {activeItem ? (
              <OverlayRow item={activeItem} grandTotalNav={grandTotalNav} displayCurrency={displayCurrency} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal */}
      {modalOpen && (
        <CustomGroupModal
          viewId={viewId}
          groupId={editingGroupId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
