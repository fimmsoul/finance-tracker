export type Relationship = 'self' | 'spouse' | 'child' | 'parent' | 'sibling' | 'other';

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: Relationship;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type FamilyMemberInsert = Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>;
export type FamilyMemberUpdate = Partial<Omit<FamilyMember, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// 'all' means show combined family view
export type ActiveMemberFilter = string | 'all';
