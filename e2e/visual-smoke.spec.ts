import { test, expect, type Page } from "@playwright/test";

/**
 * 제네릭 구조 스모크 — 이 앱 지식 없이도 jsdom이 못 보는 렌더 버그를 잡는다:
 *  · 흰 화면(#root 비어있음)        · <button> 안에 <button>(무효 HTML, 예: FixedBottomCTA 안에 Button)
 *  · 빈 입력칸(placeholder 없음)     · 콘솔 에러
 * 픽셀 베이스라인 없음(OS 안정). 각 화면 스크린샷을 e2e/__shots__/에 저장 → 끝내기 전 직접 열어 자가 리뷰.
 *
 * ▶ 이 앱에 맞게 customize:
 *   1) ROUTES에 핵심 화면을 추가(폼/결과/목록/설정 등)
 *   2) 데이터가 필요한 화면은 seed()에서 localStorage를 채워라
 */
const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/onboarding", name: "onboarding" },
  { path: "/chores", name: "chores" },
  { path: "/members", name: "members" },
  { path: "/report/detail", name: "report-detail" },
  { path: "/settle", name: "settle" },
  { path: "/streak", name: "streak" },
  // { path: "/result", name: "result" },   // ← 이 앱의 라우트를 추가
  // { path: "/settings", name: "settings" },
];

/** /members는 household가 없으면 /onboarding으로 리다이렉트하므로 가구+동거인을 시드한다. */
const MEMBERS_SEED_STATE = {
  version: 1,
  household: { id: "h_smoke01", name: "우리집", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
  members: [
    { id: "m_smoke1", name: "민수", colorToken: "blue", isMe: true, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "m_smoke2", name: "지민", colorToken: "green", isMe: false, createdAt: "2026-01-02T00:00:00.000Z" },
  ],
  chores: [],
  checkIns: [],
  settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
  settlements: [],
};

/** 데이터가 필요한 화면용 localStorage 시드(앱에 맞게 채워라). 앱 스크립트보다 먼저 실행된다. */
async function seed(page: Page): Promise<void> {
  await page.addInitScript((state) => {
    if (window.location.pathname === "/members") {
      window.localStorage.setItem("choresplit:v1", JSON.stringify(state));
    }
  }, MEMBERS_SEED_STATE);

  // /report/detail, /settle은 household+members+chores+checkIns가 있어야 빈 상태가 아니라 실제
  // 데이터를 렌더한다. /report/detail은 추가로 이번 주가 "choresplit:report-unlocked"에 잠금
  // 해제돼 있어야 /report로 리다이렉트되지 않는다. 날짜는 실행 시점(KST) 기준으로 브라우저 안에서 계산한다.
  await page.addInitScript(() => {
    if (
      window.location.pathname !== "/report/detail" &&
      window.location.pathname !== "/settle" &&
      window.location.pathname !== "/streak"
    )
      return;

    const todayKST = () => {
      const now = new Date();
      const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const y = kst.getFullYear();
      const m = String(kst.getMonth() + 1).padStart(2, "0");
      const d = String(kst.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    const parseDate = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };
    const formatDate = (dt: Date) => {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    const addDays = (s: string, n: number) => formatDate(new Date(parseDate(s).getTime() + n * 86400000));
    const getWeekStart = (s: string) => {
      const d = parseDate(s);
      const dow = d.getUTCDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      return formatDate(new Date(d.getTime() + diff * 86400000));
    };

    const weekStart = getWeekStart(todayKST());
    const day1 = addDays(weekStart, 1);

    const state = {
      version: 1,
      household: { id: "h_smoke02", name: "우리집", inviteCode: "AB12CD", createdAt: "2026-01-01T00:00:00.000Z" },
      members: [
        { id: "m_smoke1", name: "민수", colorToken: "blue", isMe: true, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "m_smoke2", name: "지민", colorToken: "green", isMe: false, createdAt: "2026-01-02T00:00:00.000Z" },
      ],
      chores: [
        { id: "c_1", name: "설거지", weight: 2, frequency: "daily", penaltyAmount: 300, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "c_2", name: "분리수거", weight: 1, frequency: "daily", penaltyAmount: 200, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "c_3", name: "빨래", weight: 3, frequency: "weekly", penaltyAmount: 1000, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      checkIns: [
        { id: `${weekStart}__c_1__m_smoke1`, date: weekStart, choreId: "c_1", memberId: "m_smoke1", weightAtLog: 2, createdAt: `${weekStart}T00:00:00.000Z` },
        { id: `${day1}__c_1__m_smoke1`, date: day1, choreId: "c_1", memberId: "m_smoke1", weightAtLog: 2, createdAt: `${day1}T00:00:00.000Z` },
        { id: `${day1}__c_2__m_smoke2`, date: day1, choreId: "c_2", memberId: "m_smoke2", weightAtLog: 1, createdAt: `${day1}T00:00:00.000Z` },
        { id: `${weekStart}__c_3__m_smoke1`, date: weekStart, choreId: "c_3", memberId: "m_smoke1", weightAtLog: 3, createdAt: `${weekStart}T00:00:00.000Z` },
      ],
      settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null },
      settlements: [],
    };

    window.localStorage.setItem("choresplit:v1", JSON.stringify(state));
    window.localStorage.setItem("choresplit:report-unlocked", JSON.stringify({ [weekStart]: true }));
  });
}

// 토스 WebView 밖(일반 브라우저)에서만 나는 알려진 dev 에러 — 무시(실기기 WebView엔 안 남)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /getSafeAreaInsets/i];

for (const route of ROUTES) {
  test(`visual smoke: ${route.name} (${route.path})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await seed(page);
    await page.goto(route.path);
    await page.waitForTimeout(1000); // React 렌더 + effect 정착

    // 1) 흰 화면 방지 — #root에 실제 콘텐츠가 있어야(SDK 가드 누락 시 트리 언마운트 → 흰 화면)
    const rootText = (await page.locator("#root").innerText().catch(() => "")).trim();
    expect(rootText.length, `${route.name}: #root가 비어있음 → 흰 화면`).toBeGreaterThan(0);

    // 2) <button> 안에 <button> 금지 — 무효 HTML. FixedBottomCTA/BottomCTA/CTAButton은 자체가 button이니
    //    안에 Button을 넣지 마라(SubmitFooter는 올바르게 처리됨).
    expect(
      await page.locator("button button").count(),
      `${route.name}: <button> 안에 <button>(무효 HTML — CTA류 안에 Button 중첩)`,
    ).toBe(0);

    // 3) 입력칸은 placeholder가 보여야 — box/line variant는 빈 칸+비포커스에서 라벨이 떠 숨어 빈 회색 박스가 됨
    const inputs = page.getByRole("textbox");
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const ph = (await inputs.nth(i).getAttribute("placeholder")) ?? "";
      expect(ph.trim().length, `${route.name}: 입력칸 #${i}에 placeholder 없음 → 빈 회색 박스`).toBeGreaterThan(0);
    }

    // 4) 콘솔 에러 0 (알려진 dev 에러 제외) — 토스 검수는 console.error 0개 요구
    expect(errors, `${route.name}: 콘솔 에러`).toEqual([]);

    // 5) 스크린샷 저장 → 끝내기 전 직접 열어 자가 리뷰(휑함/솔리드 알약 탭/부유 CTA/앵커 없음)
    await page.screenshot({ path: `e2e/__shots__/${route.name}.png`, fullPage: true });
  });
}
