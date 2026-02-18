export type GroupColor = 'purple' | 'green' | 'blue' | 'orange' | 'pink' | 'gray';

export const groupColorOptions: { value: GroupColor; label: string; bgClass: string; textClass: string }[] = [
  { value: 'purple', label: 'Purple', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  { value: 'green', label: 'Green', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  { value: 'blue', label: 'Blue', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  { value: 'orange', label: 'Orange', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  { value: 'pink', label: 'Pink', bgClass: 'bg-pink-100', textClass: 'text-pink-700' },
  { value: 'gray', label: 'Gray', bgClass: 'bg-gray-100', textClass: 'text-gray-700' },
];

export interface CustomGroup {
  id: string;
  user_id: string;
  view_id: string | null; // which portfolio view this group belongs to
  name: string;
  color: GroupColor;
  asset_ids: string[]; // array of asset IDs (stock, cash, asset)
  created_at: string;
  updated_at: string;
}

export type CustomGroupInsert = Omit<CustomGroup, 'id' | 'created_at' | 'updated_at'>;
export type CustomGroupUpdate = Partial<Omit<CustomGroup, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
