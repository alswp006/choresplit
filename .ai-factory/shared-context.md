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
 */

/** 집안일 항목 (모든 패킷이 참조) (구현: 패킷 0001) */
export type Task = { id: string; assignee: string; description: string; frequency: 'daily'|'weekly'; category?: string; createdAt: number; archivedAt?: number };

/** 구성원 (0007, 0008에서 CRUD) (구현: 패킷 0001) */
export type Member = { id: string; name: string; joinedAt: number; shareCode?: string; targetRatio?: number };

/** 체크인 기록 (도메인 계산에 필요) (구현: 패킷 0001) */
export type CheckinLog = { id: string; taskId: string; memberId: string; date: string; completedAt: number };

/** 라우터 상태 (0021에서 사용, 0022에서 검증) (구현: 패킷 0001) */
export type RouteState = { type: string; params?: Record<string, any>; title?: string };

/** 스토어에서 값 읽기 (0007, 0008에서 사용) (구현: 패킷 0002) */
export type safeGetFn = <T>(key: string, fallback: T) => T;

/** 스토어에 값 저장 (0007, 0008에서 사용) (구현: 패킷 0002) */
export type safeSetFn = (key: string, value: any) => Promise<void>;

/** 오래된 로그 삭제 (0008에서 부팅 시 호출) (구현: 패킷 0002) */
export type pruneLogsFn = (beforeDays: number) => Promise<number>;

/** 현재 또는 주어진 시간의 KST 날짜 (구현: 패킷 0003) */
export type getKSTDateFn = (timestamp?: number) => Date;

/** 해당 주의 시작일 (월요일) (구현: 패킷 0003) */
export type getWeekStartFn = (date: Date) => Date;

/** 해당 주의 종료일 (일요일) (구현: 패킷 0003) */
export type getWeekEndFn = (date: Date) => Date;

/** 날짜 문자열 포맷팅 (UI에서 표시용) (구현: 패킷 0003) */
export type formatDateFn = (date: Date, format: 'YYYY-MM-DD'|'M월 D일') => string;

/** 공정성 점수 계산 (0006, 0015, 0016, 0018에서 사용) (구현: 패킷 0004) */
export type calculateFairnessScoreFn = (memberId: string, checkins: CheckinLog[], tasks: Task[]) => number;

/** 미이행으로 인한 벌금 계산 (0017에서 사용) (구현: 패킷 0005) */
export type calculateFinesOwedFn = (memberId: string, checkins: CheckinLog[], tasks: Task[], finePerMiss: number) => number;

/** 정산 제안 생성 (0017에서 사용) (구현: 패킷 0005) */
export type generateSettlementFn = (members: Member[], checkins: CheckinLog[], tasks: Task[]) => { from: string; to: string; amount: number }[];

/** 연속 완료 일수 (0018에서 표시) (구현: 패킷 0006) */
export type calculateStreakFn = (memberId: string, checkins: CheckinLog[], date?: Date) => number;

/** 주간 랭킹 계산 (0015, 0018에서 사용) (구현: 패킷 0006) */
export type getWeeklyRankingsFn = (members: Member[], checkins: CheckinLog[], tasks: Task[]) => { memberId: string; rank: number; score: number }[];

/** 새 항목 생성 (0008에서 액션 제공) (구현: 패킷 0007) */
export type createTaskFn = (task: Omit<Task, 'id'|'createdAt'>) => Promise<Task>;

/** 항목 수정 (0008에서 액션 제공) (구현: 패킷 0007) */
export type updateTaskFn = (id: string, updates: Partial<Task>) => Promise<void>;

/** 항목 삭제 (0008에서 액션 제공) (구현: 패킷 0007) */
export type deleteTaskFn = (id: string) => Promise<void>;

/** 초대 공유코드 생성 (0019에서 사용) (구현: 패킷 0007) */
export type generateShareCodeFn = (groupId: string) => string;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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
export const MAX_TASKS = 30 as cons
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
  domain/
    date.ts
  hooks/
  lib/
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  storage/
    storage.ts
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type Task =; export type Member =; export type CheckinLog =; export type RouteState =; export type safeGetFn = <T>(key: string, fallback: T) => T; export type safeSetFn = (key: string, value: any) => Promise<void>; export type pruneLogsFn = (beforeDays: number) => Promise<number>; export type getKSTDateFn = (timestamp?: number) => Date
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; export type Difficulty = 1 | 2 | 3; export interface Member; export interface Household; export interface ChoreTask; export interface ChoreLog; export interface AppSettings; export interface MemberShare
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
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + RouteState 정의 (files: src/lib/types.ts)
- 0002: storage.ts — safeGet/safeSet/pruneLogs/스키마 (files: src/storage/storage.ts)
- 0003: date.ts — KST 날짜/주 경계 유틸 (files: src/domain/date.ts)