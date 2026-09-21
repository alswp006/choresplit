import { requestReview } from "@apps-in-toss/web-framework";
import { getItem, removeItem, setItem } from "./storage";

/**
 * 앱 스토어 리뷰 요청 — **호출 시점이 전부다.**
 *
 * 실측(앱인토스 웨비나 2026-09): 같은 앱에서 `requestReview` 호출 시점만 바꿔
 * 리뷰가 100 → 1,314 → 6,000개가 됐다. [8-27] 개편으로 평점·리뷰가 미니앱
 * **상세 페이지에 공개**되므로 유통에 직결된다. 그래서 규칙은 하나다:
 * **핵심 태스크를 끝낸 직후**(결과를 본 순간)에 부르고, 진입·이탈 시점에는 부르지 않는다.
 *
 * OS(iOS StoreKit / Android Play)가 단기 반복을 스로틀하므로 **표시는 보장되지 않는다**
 * (docs). 그래서 "떴는지"를 묻지 않고 "물어봤는지"만 기록한다.
 */

/** 기본 가드 키. 앱 생애 1회 — 값이 있으면 다시 묻지 않는다. */
const REVIEW_REQUESTED_KEY = "ait:review-requested";

/**
 * 리뷰 요청을 **앱 생애 1회만** 실제로 보낸다(localStorage 가드).
 * 저장 판정기는 `lib/storage.ts` 하나를 재사용한다.
 *
 * 저장이 막힌 환경(프라이빗 모드·용량 초과)에서는 가드 없이 1회 요청하는 쪽으로 degrade한다 —
 * 기록 실패 때문에 리뷰를 영영 안 묻는 것보다 낫고, 중복은 OS 스로틀이 흡수한다.
 * 절대 throw하지 않는다.
 *
 * **호출이 실패하면 가드를 되돌린다.** 가드를 찍고 끝내면 반대 방향이 열린다 — 브릿지가 아직
 * 없거나 구버전 토스 앱이라 호출이 던지거나 거부하면, 아무 일도 안 일어난 채 플래그만 남아
 * **그 사용자에게 다시는 리뷰를 묻지 못한다.** 리뷰는 호출 시점만 바꿔 100→6,000개가 된 축이고
 * [8-27] 개편으로 평점이 상세 페이지에 공개되므로, 유일한 기회를 실패한 콜에 버릴 수 없다.
 * 반대 위험(한 번 더 묻기)은 OS 스로틀이 흡수한다 — **묻지 못하는 것 > 한 번 더 묻는 것**.
 *
 * 가드를 **먼저** 찍고 실패 시 지우는 순서인 이유: 결과를 기다렸다가 찍으면 같은 틱에서 두 번
 * 부른 호출(결과 화면의 이중 렌더)이 둘 다 통과한다. 동기 중복은 막고, 실패만 되돌린다.
 */
export function requestReviewOnce(key: string = REVIEW_REQUESTED_KEY): void {
  if (getItem<boolean>(key) === true) return;

  try {
    setItem(key, true);
  } catch {
    // storage.setItem은 가드가 없다(직접 localStorage에 쓴다) — 저장 불가 환경은 가드 없이 degrade.
  }

  /** 호출이 실패했다 — 묻지 못했으므로 기회를 되돌려 준다. 지우기 실패는 무시한다(현상 유지). */
  const rollback = (): void => {
    try {
      removeItem(key);
    } catch {
      // 저장소 자체가 막힌 환경 — 되돌릴 수 없다. 던지지는 않는다.
    }
  };

  try {
    const r: unknown = requestReview();
    // 반환이 `undefined`일 수 있다(문서) — thenable일 때만 거부를 지켜본다.
    if (r && typeof (r as Promise<void>).then === "function") {
      (r as Promise<void>).then(undefined, rollback);
    }
  } catch {
    rollback();   // 브릿지 없음(동기 throw)
  }
}
