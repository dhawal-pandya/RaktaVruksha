export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  alive: boolean;
  gender: 'male' | 'female';
  parents?: string[]; // IDs of parents
  spouses?: string[]; // IDs of spouses
  children?: string[]; // IDs of children (for easier data input, but hierarchy built from parent links)
  birth_family_id: string;
  current_family_id: string;
}

export interface FamilyTreeNode {
  id: string;
  first_name: string;
  last_name: string;
  alive: boolean;
  gender?: 'male' | 'female';
  parents?: string[];
  spouses?: string[];
  birth_family_id: string;
  current_family_id: string;
  generation?: number; // Added for generational layout
}

export interface MarriageNode {
  id: string;
  type: 'marriage';
  spouses: string[];
  generation?: number; // Marriage nodes also get a generation
}

export type GraphNode = FamilyTreeNode | MarriageNode;

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'parent-child' | 'spouse-spouse' | 'marriage-child' | 'parent-marriage';
}