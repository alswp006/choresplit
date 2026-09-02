/**
 * Type Definitions for choresplit (Packet 0001)
 *
 * CRITICAL: location.state handling rules
 * - Always check `location.state == null` before accessing properties
 * - Each route expects a specific state type; mismatched states are ignored
 * - See RouteState type for route contracts below
 *
 * Storage contracts:
 * - localStorage key: "choresplit:v1" → ChoreSplitState (JSON)
 * - localStorage key: "choresplit:report-unlocked" → Record<weekStart, true> (JSON)
 * - localStorage key: "choresplit:onboarded" → "true" (plain string)
 *
 * This file contains ONLY type/interface exports (zero runtime code).
 */

/**
 * ID Type Aliases
 */
export type MemberId = string; // "m_" + 8-char base36
export type ChoreId = string; // "c_" + 8-char base36
export type CheckInId = string; // "${date}__${choreId}__${memberId}"

/**
 * Color Token Union (TDS color mapping, no HEX)
 */
export type ColorToken = "blue" | "green" | "orange" | "purple";

/**
 * Entity: Member (동거인)
 */
export interface Member {
  id: MemberId;
  name: string; // 1~10자
  colorToken: ColorToken; // TDS 색상 토큰 (HEX 금지)
  isMe: boolean; // 본인 여부 (가구당 정확히 1명만 true)
  createdAt: string; // ISO8601
}

/**
 * Entity: Chore (집안일 항목)
 */
export interface Chore {
  id: ChoreId;
  name: string; // 1~12자
  weight: 1 | 2 | 3; // 난이도 가중치
  frequency: "daily" | "weekly"; // 주기
  penaltyAmount: number; // 미이행 1회당 벌금(원), 0~5000, 100원 단위
  active: boolean; // false면 체크인 목록에서 제외
  createdAt: string; // ISO8601
}

/**
 * Entity: CheckIn (일일 체크인 로그)
 */
export interface CheckIn {
  id: CheckInId;
  date: string; // "YYYY-MM-DD" (KST)
  choreId: ChoreId;
  memberId: MemberId;
  weightAtLog: 1 | 2 | 3; // 기록 시점 가중치 스냅샷
  createdAt: string; // ISO8601
}

/**
 * Entity: Household (가구 설정)
 */
export interface Household {
  id: string; // "h_" + 8자리 base36
  name: string; // 1~15자
  inviteCode: string; // 6자리 대문자+숫자
  createdAt: string; // ISO8601
}

/**
 * Entity: Settings (앱 설정)
 */
export interface Settings {
  reminderEnabled: boolean; // 기본 true
  reminderHour: number; // 0~23, 기본 21
  penaltyEnabled: boolean; // 기본 true
  lastReminderShownDate: string | null; // "YYYY-MM-DD" 또는 null
}

/**
 * Entity: SettlementRecord (정산 확정 기록)
 */
export interface SettlementRecord {
  weekStart: string; // 월요일 "YYYY-MM-DD"
  settledAt: string; // ISO8601
  lines: Array<{
    fromMemberId: MemberId;
    toMemberId: MemberId;
    amount: number; // 원, 양의 정수
  }>;
  totalPenalty: number; // 원
}

/**
 * Root State (single localStorage entry)
 */
export interface ChoreSplitState {
  version: 1;
  household: Household | null;
  members: Member[];
  chores: Chore[];
  checkIns: CheckIn[];
  settings: Settings;
  settlements: SettlementRecord[];
}

/**
 * Derived: Member Weekly Statistics
 */
export interface MemberWeekStat {
  memberId: MemberId;
  memberName: string;
  count: number; // 주간 체크인 건수
  weightedScore: number; // Σ weightAtLog
  sharePct: number; // weightedScore / total * 100, 소수 1자리 반올림
}

/**
 * Derived: Weekly Report (F5 계산 결과)
 */
export interface WeeklyReport {
  weekStart: string; // 월요일 "YYYY-MM-DD"
  weekEnd: string; // 일요일 "YYYY-MM-DD"
  stats: MemberWeekStat[]; // weightedScore 내림차순
  fairnessScore: number; // 0~100 정수
  totalWeighted: number;
  topChores: Array<{
    choreId: ChoreId;
    choreName: string;
    count: number;
  }>; // 상위 3
  dailyTrend: number[]; // 길이 7, 요일별 총 체크인 수 (월~일)
  missedItems: Array<{
    choreId: ChoreId;
    choreName: string;
    missedCount: number;
    penalty: number;
  }>;
}

/**
 * Storage Operation Result
 */
export type SaveResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Route State Contracts
 * Defines navigate(path, { state }) types for each route
 *
 * Rules:
 * - Each route receives exactly one state type or undefined
 * - Mismatched state types are silently ignored by the route
 * - Always check `location.state` for null before accessing
 */
export type RouteState =
  | { type: "report-detail"; weekStart?: string }
  | { type: "settle"; weekStart?: string }
  | { type: "chores"; openCreate?: boolean }
  | { type: "home" }
  | { type: "onboarding" }
  | { type: "members" }
  | { type: "report" }
  | { type: "streak" }
  | { type: "settings" };
