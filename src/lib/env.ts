/**
 * Vite 환경변수 안전 리더 — 값이 없거나 import.meta.env 접근이 실패해도 절대 throw하지 않는다.
 * 광고 그룹/슬롯 ID는 앱인토스 콘솔에서 발급받아 .env로 주입한다(재빌드 불필요).
 */
function readEnv(key: string): string | undefined {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

export const AD_GROUP_ID: string | undefined = readEnv("VITE_TOSS_AD_GROUP_ID");
export const AD_SLOT_ID: string | undefined = readEnv("VITE_TOSS_AD_SLOT_ID");
