import { useEffect } from "react";
import { Analytics } from "@apps-in-toss/web-framework";

/**
 * 런타임 행동 로그 — 앱인토스 `Analytics` SDK의 **단일 창구**.
 *
 * 왜 래퍼를 두는가(셋 다 docs가 명시한 주의사항이다):
 *  1) **흰 화면 방지.** 토스 네이티브 브릿지가 없는 환경(로컬 브라우저·검수자 PC·jsdom)에서
 *     SDK는 false를 *반환*하는 게 아니라 **throw**한다. 로그 한 줄이 render/effect를 탈출하면
 *     React 트리가 통째로 언마운트되어 첫 화면부터 흰 화면이 된다(검수 즉시 반려).
 *     여기서 전부 삼킨다 — 호출부는 try/catch를 하지 않아도 된다.
 *  2) **반환이 `Promise<void> | undefined`다.** 그냥 `.catch`를 붙이면 undefined에서 터진다.
 *     `Promise.resolve()`로 감싸는 것이 핵심이다.
 *  3) **`log_name` 일관성.** 이벤트명이 바뀌면 대시보드에서 어제까지의 히스토리와 오늘의
 *     이벤트가 다른 계열이 되어 퍼널 비교(예: 83%→31% 절벽 찾기)가 불가능해진다.
 *     접두사는 **코드가 붙인다** — 호출부가 자유 문자열을 넣어도 계열은 흔들리지 않는다.
 *
 * 외부 로깅 툴(GA·Amplitude)은 앱인토스 정책상 금지다. 행동 로그는 이 파일만 남긴다.
 */

/** 로그에 실을 수 있는 추가 필드 — SDK가 원시값만 받는다. */
export type LogFields = Record<string, string | number | boolean | null>;

/** SDK `LoggerParams`(docs 원문)와 같은 모양. 여기서 만들어 그대로 넘긴다. */
type LoggerParams = { log_name?: string } & { [key: string]: string | number | boolean | null };

/**
 * log_name 접두사. **바꾸지 마라** — 바꾸는 순간 그 이벤트의 히스토리가 끊긴다.
 * 네 계열은 발표(2026-09) 로그 4축과 1:1이다: 화면 이동 · 버튼 클릭 · 노출 · 체류.
 */
const SCREEN_PREFIX = "screen";
const CLICK_PREFIX = "click";
const IMPRESSION_PREFIX = "impression";
const DWELL_PREFIX = "dwell";
const LOG_NAME_SEPARATOR = "_";
/** 정규화 후 남는 글자가 없을 때(예: page가 "/") 쓰는 이름. */
const ROOT_LOG_SEGMENT = "root";

/** 3초 이상 머물면 "실제로 본 화면"으로 친다(발표 로그 4축의 체류 시간). */
export const DWELL_MS = 3000;

/**
 * 자유 문자열 → 안정적인 log_name. 판정기는 이 함수 하나다.
 *
 * 경로("/savings/result")·한국어 라벨("계산하기") 둘 다 들어온다. 한글을 버리면
 * 서로 다른 버튼이 같은 이름으로 뭉쳐 대시보드에서 구분되지 않으므로
 * 유니코드 글자·숫자는 남긴다(`\p{L}\p{N}`).
 */
function toLogName(prefix: string, raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(LOG_NAME_SEPARATOR);
  return `${prefix}${LOG_NAME_SEPARATOR}${slug || ROOT_LOG_SEGMENT}`;
}

/**
 * SDK 호출 가드 — 호출 자체의 throw와 비동기 거부를 둘 다 삼킨다.
 * 로깅·리뷰 요청처럼 "실패해도 사용자 여정은 계속되어야 하는" 호출에만 쓴다.
 *
 * 파라미터가 `() => unknown`인 이유: 문서가 적은 반환형은 `Promise<void> | undefined`이지만
 * 그 항목은 **설치본 `.d.ts` 대조를 거치지 않았다**(존재 신탁의 '출처 표기' 절). 실제가
 * `void`거나 `Promise<unknown>`이면 좁은 파라미터 타입이 TS2345를 내고, 이 파일은 **모든 생성 앱**에
 * 실리므로 첫 tsc부터 전부 빨개진다 — 에이전트는 자기가 만들지 않은 파일을 고치려 턴을 태운다.
 * **못 재면 좁히지 마라**(3-상태 규율의 타입 판본). 동작은 같다: `Promise.resolve`가 무엇이 오든 흡수한다.
 */
export function fireAndForget(call: () => unknown): void {
  try {
    Promise.resolve(call()).catch(() => {});
  } catch {
    // 브릿지 없는 환경에서는 호출 자체가 동기 throw다 — 여기서 끊는다.
  }
}

/**
 * 화면 진입. `extra`가 log_name을 덮지 못하도록 **뒤에** 고정 필드를 둔다
 * (호출부 실수 하나로 계열이 갈리는 것을 막는다).
 */
export function logScreen(page: string, extra?: LogFields): void {
  const params: LoggerParams = { ...extra, log_name: toLogName(SCREEN_PREFIX, page), page };
  fireAndForget(() => Analytics.screen(params));
}

/** 버튼·카드 클릭. **이벤트 핸들러 안**에서 부른다(docs). */
export function logClick(name: string, extra?: LogFields): void {
  const params: LoggerParams = { ...extra, log_name: toLogName(CLICK_PREFIX, name), target: name };
  fireAndForget(() => Analytics.click(params));
}

/**
 * 노출. **뷰포트 진입 시점**에 부른다(docs) — 마운트 즉시 부르면 사용자가 보지 못한 것까지
 * 집계되어 CTR 분모가 부풀고, 그 위에서 내린 퍼널 판단이 전부 틀어진다.
 */
export function logImpression(name: string, extra?: LogFields): void {
  const params: LoggerParams = {
    ...extra,
    log_name: toLogName(IMPRESSION_PREFIX, name),
    target: name,
  };
  fireAndForget(() => Analytics.impression(params));
}

/**
 * 체류. 별도 API(`eventLog`)를 쓰지 않고 `Analytics.screen`에 필드로 싣는다 —
 * log_type 열거를 확인하지 못한 API를 무인 경로에 넣지 않는다.
 */
function logDwell(page: string): void {
  const params: LoggerParams = {
    log_name: toLogName(DWELL_PREFIX, page),
    page,
    dwell_ms: DWELL_MS,
  };
  fireAndForget(() => Analytics.screen(params));
}

/**
 * 마운트 시 화면 로그 + `DWELL_MS` 이상 머물면 체류 로그(각 1회).
 * PageShell이 자동으로 부르므로 페이지가 직접 부를 일은 없다.
 *
 * 의존성이 `[page]`라 **같은 page로 재마운트되면 다시 1회** 남는다 — 라우트 이동은
 * 방문 횟수로 세어야 퍼널의 절벽(어디서 멈췄는지)이 보인다.
 * 언마운트에서 타이머를 지운다: 떠난 화면의 체류 로그는 거짓이다.
 */
export function useScreenLog(page: string): void {
  useEffect(() => {
    logScreen(page);
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => logDwell(page), DWELL_MS);
    return () => clearTimeout(timer);
  }, [page]);
}
