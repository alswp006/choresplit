# CLAUDE.md — 앱인토스 미니앱 코딩 규칙

## MANDATORY: Pre-submission Checklist (run BEFORE finishing)
1. **Run `npx tsc --noEmit`** — fix ALL TypeScript errors before finishing
2. **Run `npx vitest run`** (if test file exists) — fix failing tests
3. **Verify imports** — check that all imports resolve to existing files
4. **Check for duplicates** — ensure you didn't recreate something that already exists
5. **main.tsx 수정 금지** — @AI:ANCHOR 파일. TDSMobileAITProvider/BrowserRouter가 이미 설정됨
6. **App.tsx Route 확인** — navigate()로 이동하는 모든 경로에 Route가 있는지 확인
7. **RouteState 타입 확인** — navigate state가 types.ts의 RouteState와 일치하는지 확인
8. **비주얼 골격 확인** — 모든 페이지가 ScreenScaffold/PageShell로 감싸졌는가, 1차 CTA가 SubmitFooter 또는 display="block"인가(좌측 글자폭 금지), 결과/비교는 Card로 묶였는가
9. **SDK 가드 확인** — 마운트시 SDK 호출(광고 등)·이벤트 핸들러(haptic/clipboard)가 try/catch 가드됐는가(흰 화면 방지)
10. **레이아웃 테스트 확인** — 핵심 가치 화면(결과/비교/지표/대시보드)에 레이아웃 AC가 있으면, 대응 테스트(카드 개수·전체폭 CTA·골격)가 src/__tests__에 있는가. Card/핵심 요소에 testId를 부여하고 getAllByTestId로 검증. .claude/rules/testing.md "레이아웃 검증" 참조 — 행위만 테스트하면 비주얼이 조용히 무너진다.
11. **버튼 중첩 확인** — FixedBottomCTA/BottomCTA/CTAButton은 자체가 `<button>`이다 → 안에 `<Button>`을 넣지 마라(button>button 무효 HTML). children에 라벨 직접 또는 SubmitFooter 사용. 입력 필드는 `placeholder`를 반드시 줘라(box/line variant는 빈 칸에서 라벨이 숨음). (ListRow onClick + 내부 버튼은 li>button이라 무효는 아니나 a11y상 right 슬롯 IconButton 권장.)
12. **비주얼 스모크 (UI)** — `npm run test:visual` 통과 + e2e/__shots__/*.png 를 Read로 직접 열어 자가 리뷰(.claude/rules/visual-review.md). jsdom이 못 보는 흰 화면/버튼 중첩/빈 입력칸/휑함/솔리드 알약 탭을 잡는다. (최초 1회 `npx playwright install chromium`.) **새 화면을 만들었으면 e2e/visual-smoke.spec.ts의 ROUTES에 경로를 등록하라** — 기본은 "/" 하나뿐이라 등록 안 된 화면은 스모크가 아예 안 본다.
13. **(데이터/결과 화면만) 표현 풍부함** — 핵심 숫자는 CountUp 히어로(SummaryHero), 추이/비중 데이터가 있으면 Sparkline/MiniBar로 시각화, 빈 상태엔 Asset.ContentIcon. 단순 유틸리티엔 불필요 — 장식을 위한 장식 금지.

14. **카피 자가 검사 (탈-AI)** — 아래 "카피 규칙" 위반 문구가 없는지 전 페이지 훑기. 사용자가 "AI가 만든 앱" 티를 느끼는 1순위는 문구다.

If any check fails, fix it BEFORE completing. Finishing with known errors is a failure.

## 카피 규칙 — AI 냄새 금지 (토스 톤)
모든 UI 텍스트(제목·본문·버튼·에러·빈 상태·placeholder)에 적용:
- **금지 표현**: "환영합니다", "~해 보세요!"류 권유 남발, "당신(의)", "멋진/놀라운/완벽한", 번역투("~하는 것을 도와드립니다"), 기능 나열식 소개("이 앱은 ~을 제공합니다")
- **이모지**: 화면당 최대 1개(빈 상태 Asset 아이콘 제외). 리스트 항목마다 이모지 금지
- **느낌표**: 화면당 최대 1개
- **버튼**: 맥락 있는 동사 — "확인"/"제출" 대신 "계산하기"/"기록 저장"/"결과 보기"
- **에러/안내**: "오류가 발생했습니다" 금지 — 무엇이 왜 안 됐고 뭘 하면 되는지("금액을 입력해 주세요")
- **예시 데이터**: "홍길동"/"user@example.com"/"Lorem" 금지 — 실제 같은 값("월 320만 원")
- **톤**: 토스처럼 — 짧게, 능동태, 구체적 숫자. 설명이 두 문장 넘으면 줄여라

## CRITICAL: STANDALONE Vite + React app
- INDEPENDENT app, NOT monorepo. Only import from node_modules or src/
- No @ai-factory/*, drizzle-orm, @libsql/client, better-sqlite3
- No Next.js — this is a Vite + React app
- State: useState, useReducer, or localStorage
- ALWAYS check existing code before creating new files — avoid duplicates

## CRITICAL: package.json의 플랫폼 의존성은 절대 제거하지 마라
- 아래는 **플랫폼 필수**다. 기능을 걷어내는 작업(결제 제거, 광고 제거, 금전→비금전 전환)
  중에도 `dependencies`에서 빼지 마라 — 템플릿이 선언한 런타임 의존성 전부가 계약이다:
  `react` · `react-dom` · `react-router-dom` · `@toss/tds-mobile` · `@toss/tds-mobile-ait` ·
  `@toss/tds-colors` · `@apps-in-toss/web-framework` · `@emotion/*` · `lucide-react`
- 제거하면 빌드가 **QUALITY_GATE_FAIL로 즉시 중단**되고, 파이프라인이 어차피 되돌린다 —
  지워봐야 앱만 죽고 제거는 남지 않는다.
  TDS 없는 앱은 토스 검수에서 100% 반려되므로 이 게이트는 완화되지 않는다.
- 결제·광고 **UI를 지우는 것**과 **SDK 의존성을 지우는 것**은 다른 일이다.
  화면에서 안 쓰더라도 패키지는 남겨라.
- 버전도 임의로 바꾸지 마라 — 다운그레이드나 `0.0.0` 같은 자리표시자는 설치를 깨뜨린다.
- `node_modules/` 안의 파일은 **절대 수정하지 마라** — `pnpm install` 한 번에 사라지는
  헛수고이고, 그 파일은 네 것이 아니다. 벤더 코드가 문제로 보이면 십중팔구 사용법이
  틀린 것이다 — 공식 API 문서(.ai-factory/tds-essential.txt)를 다시 읽어라.

## CRITICAL: 배포 설정 (4031 에러 방지)
- apps-in-toss.config.ts의 appName은 앱인토스 콘솔에 등록된 앱 이름과 대소문자까지 완벽히 일치해야 함(수정 금지 — 스캐폴드가 채운 값)
- appName을 절대 임의로 변경하지 마라 — 변경 시 배포 실패 (4031 에러)
- package.json의 name 필드도 동일하게 유지
- 빌드 결과물은 토스 CDN에 호스팅됨 — 동적 SSR 불가, 정적 빌드(CSR/SSG)만 가능

## CRITICAL: vite.config.ts — external 절대 금지
- `@apps-in-toss/web-framework`를 rollupOptions.external에 추가하지 마라
- 추가하면 번들 첫 줄에 bare specifier가 남아 브라우저가 JS를 한 줄도 실행 못함 → 흰 화면
- SDK는 importmap이 아닌 window.ReactNativeWebView 글로벌로 통신하므로 번들에 포함해야 정상 동작
- rollupOptions는 빈 객체 `{}` 또는 아예 없어야 함

## CRITICAL: 토스 검수 통과 필수 규칙
- 만 19세 이상 유저만 이용 가능 — 미성년자 타겟 콘텐츠/UI 금지
- 외부 도메인 이탈(Outlink) 금지 — window.location.href, window.open으로 외부 URL 이동 금지
- 외부 링크 필요 시 토스 SDK의 네비게이션 API 사용
- 콘솔 에러(console.error) 0개 보장 — 검수 시 콘솔 에러가 있으면 반려
- CORS 에러 0개 보장 — 외부 API 호출 시 CORS 설정 필수 확인
- Android 7+, iOS 16+ 호환 — 구버전 전용 API 사용 주의

## CRITICAL: TDS 컴포넌트 API (최우선 참조)
- `.ai-factory/tds-reference.txt` — 토스 공식 TDS LLM 문서. **파일이 크다 — 통독 금지.** 맨 위 "수록 컴포넌트 색인"을 먼저 보고, 쓸 컴포넌트명으로 Grep해서 그 절만 읽어라
- `.ai-factory/tds-essential.txt` — 실제 .d.ts에서 검증된 핵심 API 요약
- 이 두 파일이 CLAUDE.md 또는 다른 문서와 충돌하면, 이 두 파일이 우선

## CRITICAL: @apps-in-toss/web-framework SDK API (최우선 참조)
- `.ai-factory/apps-in-toss-essential.txt` — 실제 설치된 SDK의 .d.ts에서 검증된 API 목록
- SDK는 **imperative 함수**만 제공 (useTossLogin/useTossAd/useTossPayment 같은 React 훅 없음)
- React 래퍼(TossRewardAd, AdSlot)가 필요하면 `src/components/`에 직접 구현 (템플릿에 참고 구현 있음)

## CRITICAL: SDK 환각 방지 — "모르면 지어내지 말고 확인하라"
- tds-essential.txt에 없는 prop/컴포넌트 → tds-reference.txt **색인** 확인 → 색인에 없으면 존재하지 않음
- apps-in-toss-essential.txt에 없는 SDK API → 존재하지 않음 (import 에러 발생시킬 것)
- 존재하지 않는 API를 추측해서 사용하면 즉시 FAIL
- SDK로 구현 불확실 → imperative API를 래퍼 컴포넌트로 감싸서 사용

## Testing
- .claude/rules/testing.md에 테스트 규칙 + mock 패턴 있음 (반드시 참조)
- .claude/rules/ui-design.md에 UI·**폼 동작** 규칙 있음 (화면·폼을 만들면 **반드시 참조** —
  특히 "Form Behavior" 섹션: inputMode/enterKeyHint·제출 중 상태·인라인 에러. 폼 동작 결함이
  가상 사용자 완주 실패의 1순위다)
- CRITICAL: TDS 컴포넌트는 jsdom에서 충돌 — testing.md의 mock 패턴 반드시 사용
- **비주얼(필수)**: e2e/visual-smoke.spec.ts(Playwright)는 jsdom이 못 보는 렌더 버그(흰 화면/버튼 중첩/빈 입력칸/휑함)를 잡는다. UI 작업 후 `npm run test:visual` 실행 + e2e/__shots__ 스크린샷을 .claude/rules/visual-review.md 루브릭으로 자가 리뷰. 최초 1회 `npx playwright install chromium`.

## 파일 구조
- src/App.tsx: 메인 앱 + React Router 라우팅
- src/pages/: 페이지 컴포넌트 — 파일명은 PascalCase, "Page" 접미사 금지 (Home.tsx ✅, HomePage.tsx ❌)
- src/components/: 재사용 컴포넌트 (TDS 래핑)
- src/hooks/: 커스텀 훅 (선택 — imperative SDK를 감싼 래퍼 등)
- src/lib/: 유틸리티, 타입, 스토리지 헬퍼
- src/__tests__/: vitest 테스트

## Routing (React Router)
```tsx
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
// 네비게이션: useNavigate() 훅 사용
// 파라미터: useParams() 훅 사용
// Link: import { Link } from 'react-router-dom'
```

## SDK는 imperative API — React 훅 없음 (.claude/rules/toss-mini-app.md 우선)
- useTossLogin/useTossAd/useTossPayment 같은 훅은 존재하지 않음 → import 시 즉시 FAIL
- 로그인: 세션 자동. 필요 시 getIsTossLoginIntegratedService()
- 광고: loadFullScreenAd/showFullScreenAd(리워드·전면), TossAds.attachBanner(배너)
- 결제: createOneTimePurchaseOrder / createSubscriptionPurchaseOrder
- 정확한 시그니처는 .ai-factory/apps-in-toss-essential.txt(실제 .d.ts)에서 확인
- React 래퍼가 필요하면 src/components/에 imperative API를 직접 감싸 구현

## Pre-built UI 컴포넌트 (이미 구현됨 — import해서 쓰고 재구현 금지)
새 페이지는 raw div로 골격을 짜지 말고 아래를 조립하라(마찰 줄이려 미리 만들어둠):
- src/components/PageShell.tsx — 페이지 SafeArea 래퍼(100dvh + safe-area + adaptive 배경)
- src/components/ScreenScaffold.tsx — 골든 골격: PageShell + 헤더(top) + 본문 + 하단 CTA(bottom) 슬롯
- src/components/BottomCTA.tsx — SubmitFooter(단일 1차 CTA, FixedBottomCTA 기반, 클릭 시 success 햅틱 자동) / ButtonStack(1·2차 CTA)
- src/components/Card.tsx — 카드 컨테이너(결과/비교/지표는 raw div 말고 Card로 묶어 위계 생성). testId prop으로 레이아웃 테스트.
- src/components/SummaryHero.tsx — 요약 히어로 카드(핵심 숫자 t1 + 카드 내 진입 버튼 + AI 라벨). 홈/결과 최상단 시각 앵커 — '휑함' 제거의 핵심.
- src/components/Amount.tsx — 금액/지표 1줄 표시(nowrap + tabular-nums + 단위 분리, 좁은 폭 줄바꿈 방지). 금액·핵심 숫자는 raw Paragraph.Text 대신 Amount.
- src/components/StateView.tsx — EmptyState(아이콘+설명+보조 weak CTA) / LoadingState(Skeleton n줄). 빈/로딩을 맨텍스트("불러오는 중")로 두지 마라.
- src/components/FloatingTabBar.tsx — 하단 탭 네비(2~5탭). 'TDS TabBar'는 존재하지 않음 — 직접 만들지 말고 이걸 써라(활성탭=컬러 틴트, 솔리드 알약/fill 버튼 금지).
- src/components/CountUp.tsx — 카운트업 히어로 숫자(0→값 애니메이션, reduced-motion 자동). 결과/대시보드의 핵심 숫자에 Amount 대신 SummaryHero value로.
- src/components/MiniBar.tsx — 진행률 바(0..1, 상환률·비중). 카드/행에 정보 밀도 추가.
- src/components/Sparkline.tsx — 추이 인라인 SVG(상환 곡선 등). D3/차트 라이브러리 금지·번들 제한 → 이걸로(의존성 0).
- src/components/AdSlot.tsx, TossRewardAd.tsx — 광고(이미 SDK 가드됨)
골든 조합(폼/결과 화면): ScreenScaffold(top=Top, bottom=SubmitFooter) 안에 본문 + Card/SummaryHero로 핵심정보 묶기.
골든 조합(탭-루트 홈, 하단 FloatingTabBar 있음): ScreenScaffold(top=Top) + SummaryHero(요약 숫자 + 카드 내 진입 버튼) + 하단 FloatingTabBar. 탭-루트엔 SubmitFooter 금지(탭바와 겹침 — 진입 액션은 카드 안에).

## CRITICAL: 버튼 전체폭 함정 (좌측 글자폭 깨짐 방지)
- TDS Button 기본 display는 'inline'(글자폭·좌측정렬). 1차/단독 CTA는 반드시 display="block" 또는 SubmitFooter/ButtonStack 사용.
- 하단 1차 액션은 손수 position:fixed 금지 → SubmitFooter(FixedBottomCTA)로.

## Data Storage (localStorage)
- src/lib/storage.ts — getItem/setItem/removeItem 헬퍼 (이미 존재)
- 복잡한 상태: useState + localStorage 동기화
- 서버가 필요하면 외부 API 서버를 fetch()로 호출

## Design Documents
- `.ai-factory/spec.md` — Full SPEC with features, ACs, data models
- `.ai-factory/prd.md` — Product Requirements Document
- `.ai-factory/task.md` — Epic/Task breakdown
- When implementing a packet, ALWAYS read `.ai-factory/spec.md` first.
- Do NOT modify any files in `.ai-factory/`.

## Code Context Tags
- `@AI:ANCHOR` — NEVER modify these lines or functions.
- `@AI:WARN` — Modify only if absolutely necessary.
- `@AI:NOTE` — Business logic with specific reasoning.

## Git Context Memory
- Recent commits contain `## Context (AI-Developer Memory)` sections
- ALWAYS respect decisions from previous packets

## Commands
- npm install (NOT pnpm)
- npx tsc --noEmit (typecheck)
- npx vitest run (tests)
- npx vite build (production build)
- dev 서버·watch 모드(`npx vite`, `vitest --watch`)는 **쓰지 마라** — 끝나지 않는 명령이라
  무인 호출이 통째로 타임아웃까지 붙잡힌다. 확인은 build와 `npx vitest run`으로 한다.

## Shared Types (CRITICAL)
- src/lib/types.ts — 모든 도메인 타입 정의
- ALWAYS: import type { ... } from "@/lib/types"
- NEVER: 같은 타입을 다른 파일에서 재정의

## 공식 문서 검색 (ax CLI — 허용된 명령)
- essential.txt에 없는 API를 지어내기 전에 검색하라: `ax search docs --query "키워드"` → 결과의 id로 `ax get doc --id <id>`
- 출력은 JSON이다. 검색해도 없으면 그 API는 존재하지 않는 것이다 — 다른 방법을 설계하라.


## Learned Patterns (자동 학습된 규칙 — 위 규칙보다 우선순위 낮음)
- ⚠️ 문구가 모호해 사용자가 무엇을 하는지 이해 못 함 반복 → 화면 패킷 프롬프트에 '레이블·버튼 문구는 결과를 말할 것("확인"이 아니라 "3만원 저축하기") — 플레이스홀더 문구 금지' 경고 추가 (신뢰도 95%, 74회 관찰)
- ⚠️ 빠져나갈 길이 없는 화면(막다른 길) 반복 → 화면 패킷 프롬프트에 '모든 화면에 돌아가거나 진행할 경로를 둘 것 — 뒤로가기·홈·다음 중 최소 하나' 경고 추가 (신뢰도 95%, 250회 관찰)
- ⚠️ 가상 사용자가 화면에서 다음 행동을 못 찾음 (길 잃음) 반복 → 화면 패킷 프롬프트에 '모든 화면에 다음 행동이 보이는 단일 주요 CTA를 둘 것 — 사용자가 무엇을 눌러야 할지 추측하게 하지 말 것' 경고 추가 (신뢰도 95%, 84회 관찰)
- ⚠️ 레이아웃 깨짐·겹침·잘림 반복 → 화면 패킷 프롬프트에 '모바일 폭(360px)에서 겹침·가로 스크롤·잘린 텍스트가 없는지 확인할 것' 경고 추가 (신뢰도 95%, 133회 관찰)
- ⚠️ 화면 이동 후 입력·선택이 사라짐 반복 → 패킷 프롬프트에 '사용자 입력은 화면 이동을 넘어 유지할 것 — 라우트 전환 시 초기화되는 지역 상태에 담지 말 것' 경고 추가 (신뢰도 93%, 49회 관찰)

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(1), general(10), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 정책·기능 제거형 리팩터링은 화면과 도메인 로직 레이어에서만 수행하고, package.json의 플랫폼 필수 의존성(디자인 시스템·플랫폼 SDK·프레임워크 코어)은 어떤 경우에도 삭제하지 말 것 — 필수 패키지 화이트리스트를 빌드 전 가드로 검증하라. (60% · 타 앱 1회 — 맹신 금지)