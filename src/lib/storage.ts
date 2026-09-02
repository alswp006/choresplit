import type { ChoreSplitState, Settings, SaveResult } from "./types";

const STATE_KEY = "choresplit:v1";
const UNLOCKED_KEY = "choresplit:report-unlocked";
const ONBOARDED_KEY = "choresplit:onboarded";

const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderHour: 21,
  penaltyEnabled: true,
  lastReminderShownDate: null,
};

export const DEFAULT_STATE: ChoreSplitState = {
  version: 1,
  household: null,
  members: [],
  chores: [],
  checkIns: [],
  settings: DEFAULT_SETTINGS,
  settlements: [],
};

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Load full state from localStorage
 * - Returns DEFAULT_STATE if key is missing, JSON parse fails, or version mismatches
 * - Never throws or logs errors
 */
export function loadState(): ChoreSplitState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      (parsed as { version?: unknown }).version !== 1
    ) {
      return DEFAULT_STATE;
    }

    return parsed as ChoreSplitState;
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Save state to localStorage
 * - Removes checkIns older than 120 days before saving
 * - Returns { ok: false, error: "..." } on QuotaExceededError (no throw)
 * - Returns { ok: true } on success
 */
export function saveState(state: ChoreSplitState): SaveResult {
  try {
    const prunedState = pruneOlderThan(state, 120);
    localStorage.setItem(STATE_KEY, JSON.stringify(prunedState));
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === "QuotaExceededError") {
      return { ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" };
    }
    // Other errors also return failure
    return { ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" };
  }
}

/**
 * Load unlocked weeks (report detail unlock history)
 * Returns Record<weekStart, true> from localStorage
 */
export function loadUnlocked(): Record<string, true> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/**
 * Mark a week as unlocked
 */
export function unlockWeek(weekStart: string): void {
  const unlocked = loadUnlocked();
  unlocked[weekStart] = true;
  localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
}

/**
 * Mark app as onboarded
 */
export function setOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, "true");
}

/**
 * Check if app has been onboarded
 */
export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === "true";
}

/**
 * Generate a unique ID with given prefix
 * Format: prefix + 8 random base36 chars (lowercase alphanumeric)
 */
export function newId(prefix: string): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = prefix;
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate a 6-character invite code (uppercase alphanumeric)
 */
export function generateInviteCode(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get today's date in KST as YYYY-MM-DD
 */
export function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date string (YYYY-MM-DD) to human-readable Korean format
 */
export function formatDateKST(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  return `${m}월 ${d}일`;
}

/**
 * Remove checkIns older than N days (input state is not mutated)
 * Cutoff is computed as calendar days back from today in KST (checkIn.date is a
 * KST "YYYY-MM-DD" string) — using the real-time UTC instant here would drift by
 * a day near the KST midnight boundary (00:00~09:00 UTC+9 vs UTC calendar date).
 */
export function pruneOlderThan(state: ChoreSplitState, days: number): ChoreSplitState {
  const [y, m, d] = todayKST().split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d));
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDateStr = cutoff.toISOString().split("T")[0];

  const filtered = state.checkIns.filter((checkIn) => checkIn.date >= cutoffDateStr);

  return {
    ...state,
    checkIns: filtered,
  };
}
