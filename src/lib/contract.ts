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
