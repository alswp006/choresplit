/**
 * KST(UTC+9) 고정 날짜/주 경계 유틸.
 * 실행 환경의 로컬 타임존과 무관하게 항상 KST 기준으로 계산한다.
 * 순수 함수만 존재 — localStorage 접근 없음.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const; // index = getUTCDay()

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDateKey(dateKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { y, m, d };
}

/** dateKey(YYYY-MM-DD)를 "달력 날짜"로 취급해 UTC 자정 타임스탬프로 매핑(타임존 계산용 앵커일 뿐, 실제 UTC 시각 아님). */
function dateKeyToAnchorMs(dateKey: string): number {
  const { y, m, d } = parseDateKey(dateKey);
  return Date.UTC(y, m - 1, d);
}

function anchorMsToDateKey(ms: number): string {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 임의 시각(epoch ms)을 KST 달력 날짜의 dateKey로 변환 */
export function toDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** 현재(또는 지정 시각)의 KST 날짜 키 */
export function todayKST(timestamp?: number): string {
  return toDateKey(new Date(timestamp ?? Date.now()));
}

/** dateKey의 요일 한글 라벨 (일/월/화/수/목/금/토) */
export function weekdayOf(dateKey: string): string {
  const ms = dateKeyToAnchorMs(dateKey);
  return WEEKDAY_LABELS[new Date(ms).getUTCDay()];
}

/** ISO 8601 스타일 주차 키 (월요일 시작, 목요일 규칙): 'YYYY-Www' */
export function weekKeyOf(dateKey: string): string {
  const { y, m, d } = parseDateKey(dateKey);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (anchor.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  anchor.setUTCDate(anchor.getUTCDate() - dayNum + 3); // 그 주의 목요일로 이동
  const isoYear = anchor.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((anchor.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${pad2(weekNum)}`;
}

/** weekKey('YYYY-Www')의 월요일 시작일 */
function weekStartMs(weekKey: string): number {
  const [yearStr, weekStr] = weekKey.split("-W");
  const isoYear = Number(yearStr);
  const week = Number(weekStr);
  const simple = new Date(Date.UTC(isoYear, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const start = new Date(simple);
  if (dow <= 4) {
    start.setUTCDate(simple.getUTCDate() - dow + 1);
  } else {
    start.setUTCDate(simple.getUTCDate() + 8 - dow);
  }
  return start.getTime();
}

/** weekKey의 월~일 범위: { start, end, days(7개) } */
export function weekRange(weekKey: string): { start: string; end: string; days: string[] } {
  const startMs = weekStartMs(weekKey);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(anchorMsToDateKey(startMs + i * DAY_MS));
  }
  return { start: days[0], end: days[6], days };
}

/**
 * 주차를 delta만큼 이동. 1년 = 52주로 단순화한 산술 wraparound(실제 ISO 53주 해는
 * 다음 해로 넘겨버린다 — 정산 앱에서 필요한 건 일관된 이동이지 ISO 정밀도가 아니다).
 */
export function shiftWeek(weekKey: string, delta: number): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  let year = Number(yearStr);
  let week = Number(weekStr) + delta;
  while (week > 52) {
    week -= 52;
    year += 1;
  }
  while (week < 1) {
    week += 52;
    year -= 1;
  }
  return `${year}-W${pad2(week)}`;
}

/** 두 dateKey 사이의 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateKeyToAnchorMs(b) - dateKeyToAnchorMs(a)) / DAY_MS);
}

/** dateKey가 오늘(KST)보다 미래인지 */
export function isFutureDate(dateKey: string): boolean {
  return dateKey > todayKST();
}

/**
 * 리마인더 노출 여부: 활성 상태이고, 아직 경과 시간이 없고(elapsedHours===0),
 * 현재 시각이 목표 시각 이후("HH:MM" 사전식 비교로 충분 — 24시간 zero-padded 형식)일 때.
 */
export function shouldShowReminder(
  currentTime: string,
  targetTime: string,
  elapsedHours: number,
  active: boolean,
): boolean {
  return active && elapsedHours === 0 && currentTime >= targetTime;
}

/** dateKey를 'MM/DD(요일)' 형식으로 포맷 */
export function formatDateLabel(dateKey: string): string {
  const { m, d } = parseDateKey(dateKey);
  return `${pad2(m)}/${pad2(d)}(${weekdayOf(dateKey)})`;
}

/**
 * 현재(또는 지정 timestamp)의 KST 날짜를 Date로 반환.
 * 반환된 Date의 UTC 필드(getUTCFullYear 등)가 KST 벽시계 값이다 —
 * 실행 환경 로컬 타임존과 무관하게 이 파일의 다른 함수들과 동일한 표현을 쓴다.
 */
export function getKSTDate(timestamp?: number): Date {
  return new Date((timestamp ?? Date.now()) + KST_OFFSET_MS);
}

/** getKSTDate() 결과 기준, 해당 주의 시작일(월요일) 00:00을 같은 표현으로 반환 */
export function getWeekStart(date: Date): Date {
  const dow = date.getUTCDay(); // 0=일 .. 6=토
  const diffFromMonday = (dow + 6) % 7;
  const start = new Date(date.getTime());
  start.setUTCDate(start.getUTCDate() - diffFromMonday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/** getKSTDate() 결과 기준, 해당 주의 종료일(일요일) 23:59:59.999를 같은 표현으로 반환 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Date를 'YYYY-MM-DD' 또는 'M월 D일' 형식으로 포맷(UTC 필드 기준 — getKSTDate와 동일 표현 가정) */
export function formatDate(date: Date, format: "YYYY-MM-DD" | "M월 D일"): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return format === "YYYY-MM-DD" ? `${y}-${pad2(m)}-${pad2(d)}` : `${m}월 ${d}일`;
}

/** 기준 시각(기본: 지금)이 속한 KST 주의 경계(월요일 00:00 ~ 일요일 23:59:59.999) */
export function getWeekBoundary(date?: Date): { start: Date; end: Date } {
  const base = date ?? getKSTDate();
  return { start: getWeekStart(base), end: getWeekEnd(base) };
}

/**
 * Date를 KST 표현으로 포맷(UTC 필드 기준 — getKSTDate와 동일 표현 가정). 기본 포맷은 'YYYY-MM-DD'.
 * 'YYYY-MM-DD'/'M월 D일'은 formatDate로 위임하고, 그 외 커스텀 포맷 문자열은 토큰(YYYY/MM/DD) 치환으로 처리한다.
 */
export function formatDateKST(date: Date, format: string = "YYYY-MM-DD"): string {
  if (format === "YYYY-MM-DD" || format === "M월 D일") {
    return formatDate(date, format);
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return format.replace(/YYYY/g, String(y)).replace(/MM/g, pad2(m)).replace(/DD/g, pad2(d));
}
