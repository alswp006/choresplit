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
