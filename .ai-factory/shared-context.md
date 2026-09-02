# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 *
 * 엔티티/파생 타입은 src/lib/types.ts(SPEC Data Models 원본)를 그대로 재노출한다 —
 * 이 파일에서 별도로 재정의하지 않아 두 파일이 어긋날 수 없다.
 */

export type {
  MemberId,
  ChoreId,
  CheckInId,
  ColorToken,
  Member,
  Chore,
  CheckIn,
  Household,
  Settings,
  SettlementRecord,
  ChoreSplitState,
  MemberWeekStat,
  WeeklyReport,
  SaveResult,
  RouteState,
} from './types';

import type {
  ChoreSplitState,
  Member,
  MemberWeekStat,
  SettlementRecord,
  Settings,
  SaveResult,
  WeeklyReport,
} from './types';

/** localStorage에서 전체 상태 로드 — 키 없음/파싱 실패 시 기본값 반환 (구현: 패킷 0002) */
export type loadStateFn = () => ChoreSplitState;

/** localStorage에 전체 상태 저장 — 120일 초과 checkIns 정리 후 직렬화 (구현: 패킷 0002) */
export type saveStateFn = (state: ChoreSplitState) => SaveResult;

/** 새 가구 생성 + 본인 멤버 + 기본 집안일 6종 시드 (Onboarding에서 사용) (구현: 패킷 0003) */
export type createHouseholdFn = (name: string, myName: string) => ChoreSplitState;

/** 주간 리포트 계산 (구현: 패킷 0004) */
export type buildWeeklyReportFn = (state: ChoreSplitState, weekStart: string) => WeeklyReport;

/** 벌금 정산 계산 — 누가 누구에게 얼마를 보내야 하는지(SettlementRecord.lines와 동일 모양) (구현: 패킷 0004) */
export type computeSettlementFn = (
  report: WeeklyReport,
  members: Member[]
) => {
  totalPenalty: number;
  burdens: Array<{ memberId: string; amount: number }>;
  lines: SettlementRecord['lines'];
};

/** 멤버 연속 달성 일수 (구현: 패킷 0005) */
export type getStreakFn = (state: ChoreSplitState, memberId: string, today?: string) => number;

/** 최근 N일 랭킹 — 가중 점수 내림차순 (구현: 패킷 0005) */
export type getRankingFn = (state: ChoreSplitState, days?: number) => MemberWeekStat[];

/** 전역 상태 훅 — loading/mutate(낙관적 업데이트+롤백)/unlocked 포함 (구현: 패킷 0006) */
export type useAppStateFn = () => {
  state: ChoreSplitState;
  loading: boolean;
  mutate: (
    fn: (s: ChoreSplitState) => { ok: true; state: ChoreSplitState } | { ok: false; error: string }
  ) => { ok: boolean; error?: string };
  unlocked: Record<string, true>;
  unlock: (weekStart: string) => void;
};

/** Settings 참조용 별칭 (일부 화면 패킷의 setter 시그니처에서 사용) (구현: 패킷 0002) */
export type SettingsPatch = Partial<Settings>;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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
 * Derived: Weekly
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    contract.ts
    household.ts
    report.ts
    storage.ts
    store.tsx
    streak.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Chores.tsx
    Home.tsx
    Onboarding.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type loadStateFn = () => ChoreSplitState; export type saveStateFn = (state: ChoreSplitState) => SaveResult; export type createHouseholdFn = (name: string, myName: string) => ChoreSplitState; export type buildWeeklyReportFn = (state: ChoreSplitState, weekStart: string) => WeeklyReport; export type computeSettlementFn = ( report: WeeklyReport, members: Member[] ) =>; export type getStreakFn = (state: ChoreSplitState, memberId: string, today?: string) => number; export type getRankingFn = (state: ChoreSplitState, days?: number) => MemberWeekStat[]; export type useAppStateFn = () =>
- household.ts: export function seedDefaultChores(): Chore[]; export function createHousehold( name: string, myName: string ): ChoreSplitState &; export function validateOnboarding( householdName: string, memberName: string ):; export interface AddChoreInput; export function addChore(state: ChoreSplitState, input: AddChoreInput): Result; export function updateChore( state: ChoreSplitState, choreId: ChoreId, patch: Partial<Pick<Chore, "name" | "weight" | "f; export function toggleChoreActive(state: ChoreSplitState, choreId: ChoreId): Result; export function addMember(state: ChoreSplitState, name: string): Result
- report.ts: export function getWeekStart(date: string): string; export function getWeekEnd(date: string): string; export function buildWeeklyReport( state: ChoreSplitState, weekStart: string ): WeeklyReport; export function computeSettlement( report: WeeklyReport, members: Member[] ):; export function buildSettlement( state: ChoreSplitState, weekStart: string ):
- storage.ts: export const DEFAULT_STATE: ChoreSplitState =; export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void; export function loadState(): ChoreSplitState; export function saveState(state: ChoreSplitState): SaveResult; export function loadUnlocked(): Record<string, true>; export function unlockWeek(weekStart: string): void
- streak.ts: export function getStreak( state: ChoreSplitState, memberId: string, today: string = todayKST() ): number; export function getRanking( state: ChoreSplitState, days: number = 30 ): MemberWeekStat[]; export function countTodayCheckIns( state: ChoreSplitState, memberId: string, today: string ): number; export function shouldShowReminder( settings: Settings, now: Date, todayMyCheckInCount: number ): boolean
- types.ts: export type MemberId = string; export type ChoreId = string; export type CheckInId = string; export type ColorToken = "blue" | "green" | "orange" | "purple"; export interface Member; export interface Chore; export interface CheckIn; export interface Household
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  lib/streak.ts → imports: lib/types
  pages/Chores.tsx → imports: components/ScreenScaffold, components/StateView, components/BottomCTA, lib/store, lib/types
  pages/Home.tsx → imports: components/ScreenScaffold, components/SummaryHero, components/Card, components/CountUp, components/StateView, components/AdSlot, components/FloatingTabBar, lib/store, lib/storage, lib/streak, lib/types
  pages/Onboarding.tsx → imports: components/ScreenScaffold, components/Card, components/BottomCTA, lib/store, lib/household
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 타입 정의 (엔티티 + 파생 + RouteState) (files: src/lib/types.ts)
- 0002: localStorage 저장소 모듈 (storage.ts) (files: src/lib/storage.ts)
- 0003: 가구 생성·시드 + 엔티티 mutation 헬퍼 (files: src/lib/household.ts)
- 0004: 주간 리포트 계산 엔진 + 정산 계산 (files: src/lib/report.ts)
- 0005: 스트릭·랭킹 계산 + 리마인더 판정 (files: src/lib/streak.ts)
- 0006: 앱 전역 상태 컨테이너 (Context) (files: src/lib/store.tsx)
- 0007: 온보딩 페이지 /onboarding (S1) (files: src/pages/Onboarding.tsx)
- 0008: 홈(오늘 체크인) / (S2) (files: src/pages/Home.tsx)
- 0009: 집안일 항목 관리 /chores (S3) (files: src/pages/Chores.tsx)
- 0010: 동거인 관리 /members (S4) (files: src/pages/Members.tsx)
- 0011: 주간 리포트 게이트 /report (S5) (files: src/pages/Report.tsx)