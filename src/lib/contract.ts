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

/** 체크인 로그 엔티티 — 체크인 기록 (구현: 패킷 0002) */
export type CheckinLog = { id: string; taskId: string; memberId: string; date: string; completedAt: string };
