export type Position = 'attacker' | 'midfielder' | 'defender';

export const positionLabels: Record<Position, string> = {
  attacker: 'Attacker',
  midfielder: 'Midfielder',
  defender: 'Defender',
};

export const positionOptions: { value: Position; label: string }[] = [
  { value: 'attacker', label: 'Attacker' },
  { value: 'midfielder', label: 'Midfielder' },
  { value: 'defender', label: 'Defender' },
];

// Unified asset item for the dashboard
export interface DashboardItem {
  id: string;
  source: 'stock' | 'cash' | 'asset' | 'crypto';
  name: string;
  position: Position;
  nav: number;        // current value in display currency
  cost: number;       // cost basis in display currency
  returnPct: number;  // (nav - cost) / cost * 100
  navKRW: number;     // current value in KRW
  currency: string;   // original currency
}
