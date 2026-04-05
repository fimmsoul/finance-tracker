import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboard } from '@/hooks/useDashboard';
import { useCurrencyContext } from '@/hooks/CurrencyContext';
import { useSharedPortfolioViews } from '@/hooks/DataContext';
import { formatCurrencyValue } from '@/lib/currency';
import type { Position, DashboardItem } from '@/types/position';
import { positionLabels } from '@/types/position';
import CustomGroupsView from './CustomGroupsView';

type DashboardTab = 'position' | string; // 'position' or portfolio view id

const positionColors: Record<Position, { bg: string; text: string; badge: string; border: string }> = {
  attacker: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700', border: 'border-red-200' },
  midfielder: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
  defender: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
};

const sourceLabels: Record<string, string> = {
  stock: 'Stock',
  cash: 'Cash',
  asset: 'Asset',
  crypto: 'Crypto',
};

// Shared column widths (%) so all three tables align evenly
function SharedColGroup() {
  return (
    <colgroup>
      <col style={{ width: '3%' }} />
      <col style={{ width: '22%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '10%' }} />
    </colgroup>
  );
}

// Unique key for each item across all containers
function itemKey(item: DashboardItem) {
  return `${item.source}-${item.id}`;
}

function DraggableRow({
  item,
  totalNAV,
  displayCurrency,
}: {
  item: DashboardItem;
  totalNAV: number;
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

  const weight = totalNAV > 0 ? (item.nav / totalNAV) * 100 : 0;

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-[var(--color-border-light)] hover:bg-slate-50 transition-colors duration-200 group">
      <td className="py-2 px-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 touch-none"
          tabIndex={-1}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>
      </td>
      <td className="py-2 px-3 text-[13px] text-[var(--color-text)] truncate">{item.name}</td>
      <td className="py-2 px-3">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-border-light)] px-1.5 py-0.5 rounded">
          {sourceLabels[item.source]}
        </span>
      </td>
      <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)] font-medium">
        {weight.toFixed(1)}%
      </td>
      <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text)]">
        {formatCurrencyValue(item.nav, displayCurrency)}
      </td>
      <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
        {formatCurrencyValue(item.navKRW, 'KRW')}
      </td>
      <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
        {formatCurrencyValue(item.cost, displayCurrency)}
      </td>
      <td className={`py-2 px-3 text-right text-[13px] tabular-nums ${item.returnPct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
        {item.source === 'cash' ? '—' : `${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(1)}%`}
      </td>
    </tr>
  );
}

function OverlayRow({ item, totalNAV, displayCurrency }: { item: DashboardItem; totalNAV: number; displayCurrency: string }) {
  const weight = totalNAV > 0 ? (item.nav / totalNAV) * 100 : 0;
  return (
    <table className="w-full table-fixed bg-white shadow-[var(--shadow-md)] rounded-xl border border-[var(--color-border)]">
      <SharedColGroup />
      <tbody>
        <tr>
          <td className="py-2 px-1">
            <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </td>
          <td className="py-2 px-3 text-[13px] text-[var(--color-text)] truncate">{item.name}</td>
          <td className="py-2 px-3">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-border-light)] px-1.5 py-0.5 rounded">
              {sourceLabels[item.source]}
            </span>
          </td>
          <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)] font-medium">
            {weight.toFixed(1)}%
          </td>
          <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text)]">
            {formatCurrencyValue(item.nav, displayCurrency)}
          </td>
          <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
            {formatCurrencyValue(item.navKRW, 'KRW')}
          </td>
          <td className="py-2 px-3 text-right text-[13px] tabular-nums text-[var(--color-text-secondary)]">
            {formatCurrencyValue(item.cost, displayCurrency)}
          </td>
          <td className={`py-2 px-3 text-right text-[13px] tabular-nums ${item.returnPct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {item.source === 'cash' ? '—' : `${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(1)}%`}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function DroppableCategory({
  position,
  items,
  totalNAV,
  categoryNav,
  categoryNavKRW,
  categoryCost,
  categoryPct,
  displayCurrency,
  isOver,
}: {
  position: Position;
  items: DashboardItem[];
  totalNAV: number;
  categoryNav: number;
  categoryNavKRW: number;
  categoryCost: number;
  categoryPct: number;
  displayCurrency: string;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: position });
  const colors = positionColors[position];
  const categoryReturn = categoryCost > 0 ? ((categoryNav - categoryCost) / categoryCost) * 100 : 0;

  return (
    <div className={`mb-6 rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)] transition-all duration-200 ${isOver ? `ring-2 ${colors.border} ring-offset-1` : ''}`}>
      {/* Category Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-semibold uppercase tracking-wider ${colors.text}`}>
            {positionLabels[position]}
          </span>
          <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {categoryPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className={`tabular-nums font-medium ${colors.text}`}>
            {formatCurrencyValue(categoryNav, displayCurrency)}
          </span>
          <span className="tabular-nums text-[var(--color-text-muted)]">
            {formatCurrencyValue(categoryNavKRW, 'KRW')}
          </span>
          <span className={`tabular-nums ${categoryReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {categoryReturn >= 0 ? '+' : ''}{categoryReturn.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Table */}
      <div ref={setNodeRef} className="min-h-[48px]">
        <table className="w-full table-fixed">
          <SharedColGroup />
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 px-1"></th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Asset</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Type</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">% of NAV</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">NAV ({displayCurrency})</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">NAV (KRW)</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Cost</th>
              <th className="py-2 px-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">Return</th>
            </tr>
          </thead>
          <SortableContext items={items.map(itemKey)} strategy={verticalListSortingStrategy}>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[12px] text-[var(--color-text-muted)]">
                    Drag assets here
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <DraggableRow
                    key={itemKey(item)}
                    item={item}
                    totalNAV={totalNAV}
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

export default function DashboardView() {
  const { grouped, categoryStats, totalNAV, totalNAVKRW, loading, updatePosition, items } = useDashboard();
  const { displayCurrency, setDisplayCurrency, lastUpdated, rates } = useCurrencyContext();
  const { portfolioViews, loading: viewsLoading, addPortfolioView, updatePortfolioView, deletePortfolioView } = useSharedPortfolioViews();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainer, setOverContainer] = useState<Position | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('position');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Map from itemKey to item for quick lookup
  const itemMap = useMemo(() => {
    const map = new Map<string, DashboardItem>();
    for (const item of items) {
      map.set(itemKey(item), item);
    }
    return map;
  }, [items]);

  // Find which container an item key belongs to
  const findContainer = useCallback((id: string): Position | null => {
    for (const pos of ['attacker', 'midfielder', 'defender'] as Position[]) {
      if (grouped[pos].some((item) => itemKey(item) === id)) {
        return pos;
      }
    }
    // Check if id is a container id itself
    if (['attacker', 'midfielder', 'defender'].includes(id)) {
      return id as Position;
    }
    return null;
  }, [grouped]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { over } = event;
    if (!over) {
      setOverContainer(null);
      return;
    }
    // Determine the target container
    const overId = over.id as string;
    let container = findContainer(overId);
    // If over is a droppable container directly
    if (['attacker', 'midfielder', 'defender'].includes(overId)) {
      container = overId as Position;
    }
    setOverContainer(container);
  }, [findContainer]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverContainer(null);

    if (!over) return;

    const activeKey = active.id as string;
    const overId = over.id as string;
    const activeItem = itemMap.get(activeKey);
    if (!activeItem) return;

    // Determine target container
    let targetContainer: Position | null = null;
    if (['attacker', 'midfielder', 'defender'].includes(overId)) {
      targetContainer = overId as Position;
    } else {
      targetContainer = findContainer(overId);
    }

    if (!targetContainer) return;

    // If moved to a different container, update position
    if (activeItem.position !== targetContainer) {
      updatePosition(activeItem.id, activeItem.source, targetContainer);
    }
  }, [itemMap, findContainer, updatePosition]);

  const activeItem = activeId ? itemMap.get(activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  const isUSD = displayCurrency === 'USD';
  const totalCost = categoryStats.attacker.cost + categoryStats.midfielder.cost + categoryStats.defender.cost;
  const totalReturn = totalCost > 0 ? ((totalNAV - totalCost) / totalCost) * 100 : 0;

  return (
    <div>
      {/* Top Bar: NAV + Exchange Rate */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-10">
          {/* Total NAV */}
          <div>
            <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">Total NAV</p>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-light text-[var(--color-text)] tabular-nums">
                {formatCurrencyValue(totalNAV, displayCurrency)}
              </p>
              <span className="text-[13px] text-[var(--color-text-muted)] tabular-nums">
                {formatCurrencyValue(totalNAVKRW, 'KRW')}
              </span>
              <span className={`text-[13px] tabular-nums ${totalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
              </span>
            </div>
          </div>
          {/* Exchange Rate */}
          {rates.KRW && (
            <div>
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-widest mb-0.5">USD / KRW</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-light text-[var(--color-text)] tabular-nums">
                  {rates.KRW.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </p>
                {lastUpdated && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {new Date(lastUpdated).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Currency Toggle */}
        <div className="flex items-center gap-0">
          <button
            onClick={() => setDisplayCurrency('USD')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-l-lg border transition-colors duration-200 cursor-pointer ${
              isUSD
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-slate-50'
            }`}
          >
            $ USD
          </button>
          <button
            onClick={() => setDisplayCurrency('KRW')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-r-lg border -ml-px transition-colors duration-200 cursor-pointer ${
              !isUSD
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-slate-50'
            }`}
          >
            ₩ KRW
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border)]">
        {/* Fixed tab: Position Allocation */}
        <button
          onClick={() => setActiveTab('position')}
          className={`px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 relative cursor-pointer ${
            activeTab === 'position'
              ? 'text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          Position Allocation
          {activeTab === 'position' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
          )}
        </button>

        {/* Dynamic portfolio view tabs */}
        {portfolioViews.map((view) => (
          <div key={view.id} className="relative group">
            {editingTabId === view.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => {
                  if (editingName.trim()) {
                    updatePortfolioView(view.id, { name: editingName.trim() });
                  }
                  setEditingTabId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingName.trim()) {
                      updatePortfolioView(view.id, { name: editingName.trim() });
                    }
                    setEditingTabId(null);
                  } else if (e.key === 'Escape') {
                    setEditingTabId(null);
                  }
                }}
                className="px-2 py-1.5 text-[13px] font-medium border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-w-[80px]"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setActiveTab(view.id)}
                onDoubleClick={() => {
                  setEditingTabId(view.id);
                  setEditingName(view.name);
                }}
                className={`px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 relative cursor-pointer ${
                  activeTab === view.id
                    ? 'text-[var(--color-text)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {view.name}
                {activeTab === view.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
                )}
              </button>
            )}
            {/* Delete button - show on hover */}
            {editingTabId !== view.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${view.name}" tab? All groups included will also be deleted.`)) {
                    deletePortfolioView(view.id);
                    if (activeTab === view.id) {
                      setActiveTab('position');
                    }
                  }
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-text-muted)] hover:bg-[var(--color-negative)] text-white rounded-full text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Add new tab button */}
        <button
          onClick={async () => {
            const newView = await addPortfolioView('New Portfolio');
            if (newView) {
              setActiveTab(newView.id);
              setEditingTabId(newView.id);
              setEditingName(newView.name);
            }
          }}
          className="px-3 py-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-200 cursor-pointer"
          title="Add new portfolio tab"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab !== 'position' ? (
        <CustomGroupsView viewId={activeTab} />
      ) : (
        <>
          {/* Allocation Bar */}
      <div className="mb-6">
        <div className="flex h-4 rounded-full overflow-hidden bg-[var(--color-border-light)]">
          {categoryStats.attacker.pct > 0 && (
            <div
              className="bg-red-400 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${categoryStats.attacker.pct}%` }}
            >
              {categoryStats.attacker.pct > 8 && (
                <span className="text-[9px] text-white font-medium">{categoryStats.attacker.pct.toFixed(0)}%</span>
              )}
            </div>
          )}
          {categoryStats.midfielder.pct > 0 && (
            <div
              className="bg-amber-400 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${categoryStats.midfielder.pct}%` }}
            >
              {categoryStats.midfielder.pct > 8 && (
                <span className="text-[9px] text-white font-medium">{categoryStats.midfielder.pct.toFixed(0)}%</span>
              )}
            </div>
          )}
          {categoryStats.defender.pct > 0 && (
            <div
              className="bg-blue-400 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${categoryStats.defender.pct}%` }}
            >
              {categoryStats.defender.pct > 8 && (
                <span className="text-[9px] text-white font-medium">{categoryStats.defender.pct.toFixed(0)}%</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-[11px] text-[var(--color-text-muted)]">Attacker</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[11px] text-[var(--color-text-muted)]">Midfielder</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-[11px] text-[var(--color-text-muted)]">Defender</span>
          </div>
        </div>
      </div>

      {/* Category Tables with Drag & Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {(['attacker', 'midfielder', 'defender'] as Position[]).map((pos) => (
          <DroppableCategory
            key={pos}
            position={pos}
            items={grouped[pos]}
            totalNAV={totalNAV}
            categoryNav={categoryStats[pos].nav}
            categoryNavKRW={categoryStats[pos].navKRW}
            categoryCost={categoryStats[pos].cost}
            categoryPct={categoryStats[pos].pct}
            displayCurrency={displayCurrency}
            isOver={overContainer === pos}
          />
        ))}

        <DragOverlay>
          {activeItem ? (
            <OverlayRow item={activeItem} totalNAV={totalNAV} displayCurrency={displayCurrency} />
          ) : null}
        </DragOverlay>
      </DndContext>
        </>
      )}
    </div>
  );
}
