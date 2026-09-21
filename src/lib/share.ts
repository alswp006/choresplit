import { getTossShareLink, share } from "@apps-in-toss/web-framework";

/**
 * 공유 — 미니앱의 유일한 무료 유통 경로다.
 *
 * `getTossShareLink(path, ogImageUrl?)`이 만드는 토스 인앱 링크를 메시지에 붙이면
 * 수신자가 **그 화면으로 바로** 들어온다(홈이 아니라). ogImageUrl은 카카오톡·문자의
 * **링크 미리보기**에 쓰인다(docs).
 *
 * 절대 throw하지 않는다(reject도 하지 않는다) — 공유 버튼 하나가 화면을 죽이면 안 된다.
 */

/** 메시지와 링크 사이 구분자. 메신저가 링크를 따로 인식하도록 줄을 바꾼다. */
const MESSAGE_LINK_SEPARATOR = "\n";

/**
 * OG 이미지 기본값. 빌드 시 주입된 값이 없으면 **undefined**다 —
 * 없는 URL을 지어내면 미리보기가 깨진 채로 유통된다(3-상태: 미측정은 0이 아니다).
 */
const DEFAULT_OG_IMAGE_URL: string | undefined =
  (import.meta.env.VITE_SHARE_OG_URL as string | undefined) || undefined;

export interface ShareAppOptions {
  /** 공유 시트에 실릴 본문. */
  message: string;
  /** 미니앱 내 경로(예: "/result"). 주면 딥링크를 만들어 붙인다. */
  path?: string;
  /** 링크 미리보기 이미지. 생략하면 VITE_SHARE_OG_URL, 그것도 없으면 붙이지 않는다. */
  ogImageUrl?: string;
}

/**
 * 링크 생성. 실패하면 null — **공유 자체를 잃지 않는다**(링크 없는 공유 > 공유 없음).
 * 브릿지 없는 환경에서는 호출이 동기 throw일 수도, 거부일 수도 있어 둘 다 잡는다.
 */
async function resolveShareLink(path: string, ogImageUrl?: string): Promise<string | null> {
  try {
    const link = await getTossShareLink(path, ogImageUrl);
    return typeof link === "string" && link.length > 0 ? link : null;
  } catch {
    return null;
  }
}

export async function shareApp(opts: ShareAppOptions): Promise<void> {
  const { message, path, ogImageUrl } = opts;

  let text = message;
  if (path) {
    const link = await resolveShareLink(path, ogImageUrl ?? DEFAULT_OG_IMAGE_URL);
    if (link) text = `${message}${MESSAGE_LINK_SEPARATOR}${link}`;
  }

  // fireAndForget을 쓰지 않는 이유: 호출부가 await로 "시트가 열렸다"를 기다릴 수 있어야 한다.
  // 실패는 여기서 삼킨다 — 사용자가 공유를 취소해도 reject되지 않는다(docs).
  try {
    await share({ message: text });
  } catch {
    // 브릿지 없음 / 공유 시트 미지원 — 조용히 degrade.
  }
}
