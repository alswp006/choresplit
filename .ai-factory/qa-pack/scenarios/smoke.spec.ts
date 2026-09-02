import { test, expect } from '@playwright/test';

// nightcrew Sentinel smoke 팩 — Factory 산출(§7.1)
// 핵심 막: 집안일 항목별 일일 체크인 로그(설거지·청소·빨래 등), 동거인 초대 후 각자 기여도 실시간 반영, 주간 공정성 점수+상세 리포트(리워드 광고 시청 후 열람), 미이행 항목 소액 벌금 설정 및 정산 제안, 스트릭·랭킹으로 게임화된 습관 형성
// 토스 브릿지 의존 구간(로그인·결제)은 외부 재현 불가 — 화면 도달 확인까지만.
const ROUTES = ["/","/Chores","/Home","/Members","/Onboarding"];
// WebView 밖 실행에서만 나는 콘솔 에러는 무시(앱인토스 관례 — toss visual-smoke 템플릿 계승)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /granite/i, /apps-in-toss/i];

for (const route of ROUTES) {
  test(`smoke: ${route} 렌더링과 콘솔 에러 없음`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
