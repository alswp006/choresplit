# UI Design Rules (App-in-Toss)

## TDS Design Principles
- TDS components have perfect built-in styles — no additional CSS needed
- Custom CSS is allowed ONLY for layouts TDS doesn't provide (flex, grid containers)
- Adding margin/padding to TDS components breaks the UI — NEVER do this
- Spacing: use TDS Spacing component only (size prop required) — ListRow has NO padding prop

## Mobile UX Requirements
- Touch targets: minimum 44px (TDS components meet this by default)
- Korean as default UI language (Toss user base)
- Loading: `LoadingState`(TDS Skeleton n줄, `src/components/StateView`) — 맨텍스트 "불러오는 중" 금지
- Error: error message + retry button (TDS Button)
- Empty: `EmptyState`(icon + description + 보조 CTA, `src/components/StateView`) — action은 **weak**. 하단 고정 1차 CTA와 같은 라벨·액션을 중복 노출하지 마라(비활성 버튼 중복 = 군더더기)
- 시각 앵커: 홈/결과 최상단에 핵심 숫자 하나를 크게(`SummaryHero`, t1) — '휑함'의 핵심 원인은 숫자 앵커 부재. 금액은 `Amount`(nowrap 줄바꿈 방지)
- 하단 탭 네비: `FloatingTabBar`(템플릿 제공). 활성탭=아이콘+라벨 컬러 틴트만(솔리드 알약/`variant="fill"` 금지). 'TDS TabBar'는 존재하지 않음
- Scroll: natural overscroll, consider pull-to-refresh patterns

## Colors & Dark Mode
- Toss brand primary: handled by TDS theme — NEVER hardcode #3182F6 or any HEX value
- TDS components apply appropriate colors automatically — NEVER hardcode hex values
- Use TDS semantic color tokens only: var(--tds-color-background), var(--tds-color-grey50), etc.
- Dark mode users are 상당수 — hardcoded white/black backgrounds BREAK dark mode
- No external font loading (Toss Products Sans auto-applied)

## Touch Targets (커스텀 요소만 — TDS 컴포넌트는 자체 보장)
- 직접 만드는 인터랙티브 요소(커스텀 카드 onClick·아이콘 탭 영역)는 **최소 44×44px**.
  글자만한 탭 영역은 데스크톱에선 보이지 않는 결함이고 폰에서만 미스탭으로 드러난다.
- 인접 탭 영역 사이 최소 8px 간격 — 오탭 방지.

## Form Behavior (완주를 막는 1순위 — 페르소나가 여기서 죽는다)
<!-- vercel-labs/web-interface-guidelines(MIT)에서 TDS 어휘로 큐레이션(2026-08-30).
     퀴즈·계산기·기록 저장이 전부 폼인 앱에서, 폼 동작 결함은 "화면은 있는데 완주 불가"의 주범이다. -->
- **모바일 키보드**: 모든 TextField에 용도 맞는 `inputMode`(금액/숫자=`numeric`·`decimal`)와
  `enterKeyHint`(다음 필드=`next`, 마지막=`done`)를 지정하라. 숫자 입력에 기본 키보드가 뜨면
  가상 사용자도 실사용자도 이탈한다.
- **자동완성**: 이름·연락처류에는 `autoComplete` 속성을 지정하라(`name`·`tel` 등). 끄지 마라.
- **제출 중 상태**: 제출 버튼은 누른 뒤 로딩 표시로 바뀌고(SubmitFooter의 `loading` prop —
  TDS loading 패스스루), 완료/실패 시 반드시 원상복구돼야 한다. "한 번 누르면 영구 비활성"은
  완주를 막는 가장 흔한 버그다 — disabled 조건이 다시 풀리는 경로가 코드에 실재하는지 확인하라.
- **인라인 에러**: 검증 실패는 alert가 아니라 해당 필드 옆 문구로. 첫 에러 필드로 포커스를
  옮겨라. 에러 문구는 원인+해결("금액을 입력해 주세요") — 필드가 비어 있는데 제출 버튼만
  비활성이고 이유를 안 말하면 사용자는 막힌 이유를 모른다.
- **붙여넣기 차단 금지**: 어떤 입력에서도 paste를 막지 마라.
- **Enter 제출**: 단일 필드 폼은 Enter로 제출돼야 한다(`onSubmit`이 있는 `<form>` 사용 —
  버튼 onClick만 배선하면 키보드 제출이 안 된다).
- **긴 텍스트**: 사용자가 넣은 긴 이름·메모는 `overflow-wrap: break-word` 또는 line-clamp로
  처리하라 — 레이아웃을 밀어내는 긴 문자열은 visual-smoke가 못 잡는 흔한 깨짐이다.
