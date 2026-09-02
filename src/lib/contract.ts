/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 가구 엔티티 (구현: 패킷 0001) */
export type Household = { id: string; name: string; members: string[]; createdAt: string };

/** 집안일 엔티티 (구현: 패킷 0001) */
export type Chore = { id: string; householdId: string; title: string; category: string; dueDate?: string; completed: boolean };

/** 동거인 엔티티 (구현: 패킷 0001) */
export type Member = { id: string; householdId: string; name: string; joinedAt: string };

/** 체크인 기록 (구현: 패킷 0001) */
export type CheckIn = { id: string; memberId: string; choreId: string; date: string; completed: boolean };

/** 주간 리포트 (구현: 패킷 0001) */
export type WeeklyReport = { week: number; startDate: string; endDate: string; stats: Record<string, { completed: number; total: number }> };

/** 정산 항목 (구현: 패킷 0001) */
export type Settlement = { fromMember: string; toMember: string; amountKrw: number; reason: string };

/** 라우트 상태 열거형 (구현: 패킷 0001) */
export type RouteState = 'onboarding' | 'home' | 'chores' | 'members' | 'report' | 'streak' | 'settings';

/** 집안일 추가 (구현: 패킷 0003) */
export type addChoreFn = (householdId: string, input: { title: string; category: string; dueDate?: string }) => { id: string; [key: string]: any };

/** 체크인 기록 (완료 표시) (구현: 패킷 0003) */
export type checkInFn = (householdId: string, choreId: string, memberId: string, date: string) => void;

/** 동거인 추가 (구현: 패킷 0003) */
export type addMemberFn = (householdId: string, name: string) => void;

/** 동거인 제거 (구현: 패킷 0003) */
export type removeMemberFn = (householdId: string, memberId: string) => void;

/** 주간 리포트 계산 (구현: 패킷 0004) */
export type calculateWeeklyReportFn = (householdId: string, startDate: string, endDate: string) => { week: number; stats: Record<string, { completed: number; total: number }> };

/** 정산 제안 계산 (구현: 패킷 0004) */
export type calculateSettlementFn = (members: string[], checkIns: any[]) => Array<{ fromMember: string; toMember: string; amountKrw: number }>;

/** 스트릭 계산 (구현: 패킷 0005) */
export type calculateStreakFn = (memberId: string, checkIns: any[], startDate: string) => number;

/** 랭킹 계산 (구현: 패킷 0005) */
export type calculateRankingFn = (members: Record<string, any>, checkIns: any[], period: string) => Array<{ memberId: string; rank: number; score: number }>;

/** 스토어 훅 (구현: 패킷 0006) */
export type useAppStoreFn = () => { household?: any; addChore: (input: any) => void; checkIn: (choreId: string, date: string) => void; getState: () => any };
