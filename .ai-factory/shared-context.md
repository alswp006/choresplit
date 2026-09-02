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

/** 가구 엔티티 - 모든 패킷의 데이터 루트 (구현: 패킷 0001) */
export type Household = { id: string; name: string; ownerId: string; members: Member[]; chores: Chore[]; createdAt: string };

/** 동거인 - Household.members[]에 포함 (구현: 패킷 0001) */
export type Member = { id: string; name: string; role: 'owner' | 'member'; joinedAt: string };

/** 집안일 - Household.chores[]에 포함 (구현: 패킷 0001) */
export type Chore = { id: string; name: string; frequency: 'daily' | 'weekly'; assignee?: string; lastCompleted?: string; createdAt: string };

/** 체크인 기록 - 리포트/스트릭 계산 입력 (구현: 패킷 0001) */
export type CheckIn = { id: string; choreId: string; memberId: string; date: string; completedAt: string };

/** 주간 리포트 요약 (구현: 패킷 0001) */
export type WeeklyReport = { week: string; householdId: string; choreStats: { choreId: string; completed: number; assigned: number }[]; memberEarnings: { memberId: string; earned: number }[]; penalties: { memberId: string; amount: number }[] };

/** 멤버 랭킹 엔트리 (구현: 패킷 0001) */
export type Ranking = { memberId: string; name: string; score: number; streak: number; position: number };

/** 앱 네비게이션 상태 (구현: 패킷 0001) */
export type RouteState = 'onboarding' | 'home' | 'chores' | 'members' | 'report' | 'report-detail' | 'settle' | 'streak' | 'settings';

/** localStorage에서 가구 로드 (구현: 패킷 0002) */
export type loadHouseholdFn = () => Household | null;

/** localStorage에 가구 저장 (구현: 패킷 0002) */
export type saveHouseholdFn = (household: Household) => void;

/** localStorage에서 체크인 목록 로드 (구현: 패킷 0002) */
export type loadCheckInsFn = () => CheckIn[];

/** localStorage에 체크인 목록 저장 (구현: 패킷 0002) */
export type saveCheckInsFn = (checkIns: CheckIn[]) => void;

/** 새 가구 생성 (Onboarding에서 사용) (구현: 패킷 0003) */
export type createHouseholdFn = (name: string, ownerName: string) => Household;

/** 기본 집안일 템플릿 추가 (구현: 패킷 0003) */
export type seedDefaultChoresFn = (household: Household) => Household;

/** 주간 리포트 계산 (구현: 패킷 0004) */
export type calculateWeeklyReportFn = (household: Household, checkIns: CheckIn[], weekStart: string) => WeeklyReport;

/** 벌금 정산액 계산 (구현: 패킷 0004) */
export type calculateSettlementsFn = (report: WeeklyReport, householdMembers: Member[]) => { memberId: string; amountKrw: number }[];

/** 멤버 연속 달성 일수 (구현: 패킷 0005) */
export type calculateStreakFn = (memberId: string, checkIns: CheckIn[]) => number;

/** 모든 멤버의 랭킹 순위 계산 (내림차순) (구현: 패킷 0005) */
export type calculateRankingsFn = (household: Household, checkIns: CheckIn[]) => Ranking[];

/** 전역 상태에서 가구 조회 훅 (구현: 패킷 0006) */
export type useHouseholdFn = () => Household | null;

/** 전역 상태에서 체크인 목록 조회 훅 (구현: 패킷 0006) */
export type useCheckInsFn = () => CheckIn[];

/** 전역 상태 변경 액션 훅 (구현: 패킷 0006) */
export type useStoreActionsFn = () => { addCheckIn: (choreId: string, memberId: string) => Promise<void>; updateHousehold: (updates: Partial<Household>) => Promise<void>; setRou
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here
export {};

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
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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