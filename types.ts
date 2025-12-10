
export enum Position {
  GOLEIRO = 'Goleiro',
  DEFENSOR = 'Defensor',
  MEIO = 'Meio-Campo',
  ATACANTE = 'Atacante'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  // Extended Profile Data
  nickname?: string;
  birthDate?: string;
  phone?: string;
  favoriteTeam?: string;
  position?: Position;
}

export interface Player {
  id: string;
  groupId: string; // Links player to a specific group
  userId?: string; // Links player to a global User account (if they are a member)
  name: string;
  nickname: string;
  birthDate: string;
  email: string;
  phone?: string; // WhatsApp
  favoriteTeam: string;
  position: Position;
  rating: number; // 1 to 5 stars
  matchesPlayed: number;
  avatar?: string; // Base64 string of the uploaded image
  isMonthlySubscriber?: boolean; // New: Is this player a monthly payer?
  monthlyStartMonth?: string; // YYYY-MM from when monthly starts
  isGuest?: boolean; // New: Guest profile without linked user
}

export interface Comment {
  id: string;
  groupId: string;
  matchId: string;
  parentId?: string;
  authorPlayerId: string;
  content: string;
  createdAt: string;
}

export interface Group {
  id: string;
  adminId: string; // User who created/owns the group (Super Admin)
  admins?: string[]; // List of User IDs who have admin privileges
  name: string;
  sport: string;
  inviteCode: string;
  createdAt: string;
  members: string[]; // List of User IDs who are members
  pendingRequests: string[]; // List of User IDs waiting for approval
  logo?: string; // Base64 image string for group logo
  paymentMode?: 'split' | 'fixed';
  fixedAmount?: number;
  monthlyFee?: number;
  city?: string;
}

export interface Field {
  id: string;
  groupId: string; // Links field to a specific group
  name: string;
  location: string;
  contactName?: string;
  contactPhone?: string;
  hourlyRate: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Team {
  name: string;
  players: Player[];
}

export interface Match {
  id: string;
  groupId: string; // Links match to a specific group
  date: string; // ISO string
  time: string;
  fieldId: string;
  confirmedPlayerIds: string[];
  paidPlayerIds?: string[]; // New: List of players who paid for this specific match
  teamA: Player[];
  teamB: Player[];
  scoreA: number;
  scoreB: number;
  finished: boolean;
  mvpId?: string; // ID of the "Man of the Match"
}

// New Financial Types
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  // Expanded Categories
  category: 
    | 'MATCH_REVENUE' 
    | 'MONTHLY_FEE' 
    | 'FIELD_RENT' 
    | 'EQUIPMENT' 
    | 'EVENT_BBQ' 
    | 'GIFTS' 
    | 'DONATION' 
    | 'SPONSORSHIP' 
    | 'OTHER';
  relatedPlayerId?: string; // If related to a specific player paying monthly fee
  relatedMatchId?: string; // NEW: If related to a specific match aggregation
}

export type ViewState = 'dashboard' | 'players' | 'fields' | 'matches' | 'groups' | 'profile' | 'financial';
