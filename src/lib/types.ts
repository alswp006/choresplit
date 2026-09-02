// ============================================================================
// Weekday & Difficulty Type Definitions
// ============================================================================

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Difficulty = 1 | 2 | 3;

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Member {
  id: string;
  name: string;
  emoji: string;
  targetShare: number;
  createdAt: number;
}

export interface Household {
  id: string;
  name: string;
  createdAt: number;
  members: Member[];
}

export interface ChoreTask {
  id: string;
  name: string;
  emoji: string;
  difficulty: Difficulty;
  repeatDays: Weekday[];
  assigneeId: string | null;
  fineAmount: number;
  archived: boolean;
  updatedAt: number;
}

export interface ChoreLog {
  id: string;
  date: string;
  taskId: string;
  memberId: string;
  weight: Difficulty;
  createdAt: number;
}

export interface AppSettings {
  activeMemberId: string | null;
  reminderEnabled: boolean;
  reminderTime: string;
  onboardingDone: boolean;
  lastReportWeekKey: string | null;
  reportUnlockedWeeks: string[];
}

// ============================================================================
// Derived Calculation Types
// ============================================================================

export interface MemberShare {
  memberId: string;
  share: number;
  weight: number;
}

export interface FairnessResult {
  fairness: number;
  shares: Record<string, number>;
  isEmpty?: boolean;
}

export interface UnfulfilledItem {
  date: string;
  taskId: string;
  taskName: string;
  memberId: string;
  fineAmount: number;
}

export interface FineSummary {
  memberId: string;
  fineAmount: number;
  unfulfilledCount: number;
}

export interface RankRow {
  memberId: string;
  weight: number;
  logCount: number;
  rank: number;
}

export interface StreakResult {
  memberId: string;
  streakDays: number;
  lastCheckinDate: string | null;
}

export interface SnapshotV1 {
  household: Household;
  tasks: ChoreTask[];
  logs: ChoreLog[];
  savedAt: number;
}

// ============================================================================
// Storage Keys (7 keys, v1 contract)
// ============================================================================

export const STORAGE_KEYS = {
  HOUSEHOLD: "choresplit:household:v1",
  TASKS: "choresplit:tasks:v1",
  LOGS: "choresplit:logs:v1",
  SETTINGS: "choresplit:settings:v1",
  SCHEMA: "choresplit:schema:v1",
  BACKUP: "choresplit:backup:v1",
  LOGS_CORRUPT: "choresplit:logs:v1.corrupt",
} as const;

// ============================================================================
// Limit Constants (6 constants)
// ============================================================================

export const MAX_MEMBERS = 4 as const;
export const MAX_TASKS = 30 as const;
export const MAX_FINE = 10000 as const;
export const LOG_KEEP_DAYS = 180 as const;
export const MAX_UNLOCKED_WEEKS = 12 as const;
export const MAX_WEEK_BACK = 12 as const;

// ============================================================================
// Route Paths (8 routes, runtime definition for validation)
// ============================================================================

export const ROUTE_PATHS = {
  "/": true,
  "/onboarding": true,
  "/tasks": true,
  "/report": true,
  "/settle": true,
  "/ranking": true,
  "/invite": true,
  "/settings": true,
} as const;

// ============================================================================
// Route State Type Definition (type-level contract per route)
// ============================================================================

export type RouteState = {
  "/": { toast?: string } | undefined;
  "/onboarding": undefined;
  "/tasks": { openCreate?: boolean; focusTaskId?: string } | undefined;
  "/report": { weekKey: string } | undefined;
  "/settle": { weekKey: string } | undefined;
  "/ranking": undefined;
  "/invite": undefined;
  "/settings": undefined;
};
