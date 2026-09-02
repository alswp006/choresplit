// SDK v3(2026-07-31)부터 설정 파일은 apps-in-toss.config.ts다 — granite.config.ts는
// ait build가 인식하지 않는다(실측: "apps-in-toss.config에 appName이 설정되어야 합니다").
// v3에서 displayName·icon은 콘솔 등록 정보로 이관됐다 — 여기 다시 넣지 마라(무시된다).
//
// @apps-in-toss/web-framework가 설치된 환경에서는 해당 패키지의 defineConfig를 사용합니다.
// Railway 등 외부 빌드 환경에서는 로컬 identity 함수로 대체합니다.
const defineConfig = <T>(config: T): T => config;

export default defineConfig({
  // 콘솔에 등록된 앱 이름과 대소문자까지 완벽 일치해야 한다(불일치 = 배포 4031)
  appName: 'choresplit',
  brand: {
    primaryColor: '#3182F6',
  },
  permissions: [],
});
