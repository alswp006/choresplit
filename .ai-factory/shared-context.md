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
    fairness.ts
    fine.ts
    ranking.ts
    streak.ts
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
    repository.ts
    sharecode.ts
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
- 0004: fairness.ts — 공정성 점수 순수 함수 (files: src/domain/fairness.ts)
- 0005: fine.ts — 미이행 집계 & 정산 제안 (files: src/domain/fine.ts)
- 0006: streak.ts + ranking.ts — 스트릭 / 주간 랭킹 (files: src/domain/streak.ts, src/domain/ranking.ts)
- 0007: repository.ts + sharecode.ts — CRUD/시딩 & 공유 코드 (files: src/storage/repository.ts, src/storage/sharecode.ts)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/domain/date.ts
export function toDateKey(date: Date): string {
export function todayKST(timestamp?: number): string {
export function weekdayOf(dateKey: string): string {
export function weekKeyOf(dateKey: string): string {
export function weekRange(weekKey: string): { start: string; end: string; days: string[] } {
export function shiftWeek(weekKey: string, delta: number): string {
export function daysBetween(a: string, b: string): number {
export function isFutureDate(dateKey: string): boolean {
export function shouldShowReminder(
export function formatDateLabel(dateKey: string): string {

// src/domain/fairness.ts
export function calcFairness(
export function gradeOf(score: number): "완벽" | "양호" | "주의" | "불균형" {
export function weeklyWeightsByMember(
export function weightByTask(logs: Chor

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(1), general(10), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 정책·기능 제거형 리팩터링은 화면과 도메인 로직 레이어에서만 수행하고, package.json의 플랫폼 필수 의존성(디자인 시스템·플랫폼 SDK·프레임워크 코어)은 어떤 경우에도 삭제하지 말 것 — 필수 패키지 화이트리스트를 빌드 전 가드로 검증하라. (60% · 타 앱 1회 — 맹신 금지)