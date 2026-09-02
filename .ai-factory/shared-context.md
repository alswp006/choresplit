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

/** 과제 기본 도메인 엔티티 — 모든 패킷에서 참조 (구현: 패킷 0001) */
export type Task = { id: string; name: string; assigneeId: string; frequencyDays: number; description?: string; createdAt: string; updatedAt: string };

/** 가구원 도메인 엔티티 (구현: 패킷 0001) */
export type Member = { id: string; name: string; householdId: string; joinedAt: string };

/** 가구 도메인 엔티티 (구현: 패킷 0001) */
export type Household = { id: string; name: string; createdAt: string; memberIds: string[] };

/** 라우트 간 상태 전달 용 제네릭 dict (구현: 패킷 0001) */
export type RouteState = { [key: string]: string | number | boolean | null };

/** 로컬 스토리지 안전 읽기 — 스키마 검증 포함 (구현: 패킷 0002) */
export type safeGetFn = <T = any>(key: string) => Promise<T | null>;

/** 로컬 스토리지 안전 쓰기 (구현: 패킷 0002) */
export type safeSetFn = <T = any>(key: string, value: T) => Promise<void>;

/** 만료된 로그 삭제 — 반환값은 삭제된 레코드 수 (구현: 패킷 0002) */
export type pruneLogsFn = (olderThanDays: number) => Promise<number>;

/** KST 기준 주 경계(월~일) 계산 (구현: 패킷 0003) */
export type getWeekBoundaryFn = (date?: Date) => { start: Date; end: Date };

/** KST 타임존 포맷팅 — 기본값 'YYYY-MM-DD' (구현: 패킷 0003) */
export type formatDateKSTFn = (date: Date, format?: string) => string;

/** 구성원 공정성 점수(0~100) — 순수 함수 (구현: 패킷 0004) */
export type calculateFairnessFn = (tasks: Task[], memberId: string, weekStartDate: Date) => number;

/** 미이행 집계 — 리스트 반환 (구현: 패킷 0005) */
export type aggregateFinesFn = (period: { start: Date; end: Date }) => Array<{ memberId: string; amountKrw: number; reason: string }>;

/** 정산 제안 — 이체 순서 (구현: 패킷 0005) */
export type proposeLedgerFn = (fines: Array<{ memberId: string; amountKrw: number }>) => Array<{ from: string; to: string; amountKrw: number }>;

/** 연속 체크인 일수 — 오늘 기준 (구현: 패킷 0006) */
export type calculateStreakFn = (memberId: string, endDate?: Date) => number;

/** 주간 랭킹 정렬 리스트 — 점수 내림차순 (구현: 패킷 0006) */
export type calculateWeeklyRankingFn = (weekStartDate: Date, householdId: string) => Array<{ rank: number; memberId: string; score: number }>;

/** 전역 앱 상태 훅 — 모든 페이지에서 필수 (구현: 패킷 0008) */
export type useAppStateFn = () => { household: Household | null; members: Member[]; tasks: Task[]; checkins: Array<{ taskId: string; memberId: string; date: string }> };

/** 저장 실패 알림 용 훅 (구현: 패킷 0008) */
export type useSaveErrorFn = () => { error: Error | null; clear: () => void };

/** 라우트 간 전달 상태 접근 — useSearchParams 기반 (구현: 패킷 0022) */
export type useRouteStateFn = <T = RouteState>(name: string) => T | null;

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
    CheckinList.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    Presentation.tsx
    ReportDetail.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TaskEditSheet.tsx
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
    store.tsx
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    Onboarding.tsx
    Report.tsx
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
- CheckinList.tsx: CheckinList
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- Presentation.tsx: SummaryHero, Sparkline, MiniBar, EmptyState
- ReportDetail.tsx: ReportDetail
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TaskEditSheet.tsx: TaskEditSheet
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  pages/Home.tsx → imports: lib/store, components/ScreenScaffold, components/SummaryHero, components/Card, components/Amount, components/Sparkline, components/StateView, domain/date, domain/streak
  pages/Onboarding.tsx → imports: components/ScreenScaffold, components/BottomCTA, components/Card, storage/repository, lib/types
  pages/Report.tsx → imports: lib/store, components/ScreenScaffold, components/SummaryHero, components/Card, components/CountUp, components/MiniBar, components/StateView, components/FloatingTabBar, domain/date, domain/fairness, lib/types, lib/types
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + RouteState 정의 (files: src/lib/types.ts)
- 0002: storage.ts — safeGet/safeSet/pruneLogs/스키마 (files: src/storage/storage.ts)
- 0003: date.ts — KST 날짜/주 경계 유틸 (files: src/domain/date.ts)
- 0004: fairness.ts — 공정성 점수 순수 함수 (files: src/domain/fairness.ts)
- 0005: fine.ts — 미이행 집계 & 정산 제안 (files: src/domain/fine.ts)
- 0006: streak.ts + ranking.ts — 스트릭 / 주간 랭킹 (files: src/domain/streak.ts, src/domain/ranking.ts)
- 0007: repository.ts + sharecode.ts — CRUD/시딩 & 공유 코드 (files: src/storage/repository.ts, src/storage/sharecode.ts)
- 0008: AppStore — 전역 상태 / 부팅 / 저장 실패 알림 (files: src/lib/store.tsx)
- 0009: 공용 표현 컴포넌트 (SummaryHero / Sparkline / MiniBar / EmptyState) (files: src/components/Presentation.tsx)
- 0012: 홈 체크인 리스트 + 빈 상태 + 배너 광고 (files: src/components/CheckinList.tsx)
- 0014: 항목 추가/편집 BottomSheet + 검증 (files: src/components/TaskEditSheet.tsx)
- 0016: 리포트 상세 + 리워드 광고 게이트 (files: src/components/ReportDetail.tsx)
- 0010: 온보딩 화면 /onboarding (files: src/pages/Onboarding.tsx)
- 0011: 홈 상단부 — 리마인더 배너 · 구성원 탭 · 히어로 (files: src/pages/Home.tsx)
- 0015: 주간 리포트 요약 /report (히어로 · 주 이동 · 빈 상태) (files: src/pages/Report.tsx)
- 0001: 도메인 타입 + RouteState 정의 (files: src/lib/types.ts)
- 0002: storage.ts — safeGet/safeSet/pruneLogs/스키마 (files: src/storage/storage.ts)
- 0003: date.ts — KST 날짜/주 경계 유틸 (files: src/domain/date.ts)
- 0004: fairness.ts — 공정성 점수 순수 함수 (files: src/domain/fairness.ts)
- 0005: fine.ts — 미이행 집계 & 정산 제안 (files: src/domain/fine.ts)
- 0006: streak.ts + ranking.ts — 스트릭 / 주간 랭킹 (files: src/domain/streak.ts, src/domain/ranking.ts)
- 0007: repository.ts + sharecode.ts — CRUD/시딩 & 공유 코드 (files: src/storage/repository.ts, src/storage/sharecode.ts)
- 0008: AppStore — 전역 상태 / 부팅 / 저장 실패 알림 (files: src/lib/store.tsx)
- 0009: 공용 표현 컴포넌트 (SummaryHero / Sparkline / MiniBar / EmptyState) (files: src/components/Presentation.tsx)
- 0010: 온보딩 화면 /onboarding (files: src/pages/Onboarding.tsx)
- 0011: 홈 상단부 — 리마인더 배너 · 구성원 탭 · 히어로 (files: src/pages/Home.tsx)
- 0012: 홈 체크인 리스트 + 빈 상태 + 배너 광고 (files: src/components/CheckinList.tsx)
- 0014: 항목 추가/편집 BottomSheet + 검증 (files: src/components/TaskEditSheet.tsx)
- 0015: 주간 리포트 요약 /report (히어로 · 주 이동 · 빈 상태) (files: src/pages/Report.tsx)
- 0016: 리포트 상세 + 리워드 광고 게이트 (files: src/components/ReportDetail.tsx)

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

// src/components/CheckinList.tsx
export function CheckinList() {

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/Presentation.tsx
export function SummaryHero({
export function Sparkline({
export function MiniBar({
export function EmptyState({

// src/components/ReportDetail.tsx
export function ReportDetail({ weekKey, contributions, dailyTrend }: ReportDetailProps) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TaskEditSheet.tsx
export function TaskEditSheet({

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
expor

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(1), general(10), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 정책·기능 제거형 리팩터링은 화면과 도메인 로직 레이어에서만 수행하고, package.json의 플랫폼 필수 의존성(디자인 시스템·플랫폼 SDK·프레임워크 코어)은 어떤 경우에도 삭제하지 말 것 — 필수 패키지 화이트리스트를 빌드 전 가드로 검증하라. (60% · 타 앱 1회 — 맹신 금지)