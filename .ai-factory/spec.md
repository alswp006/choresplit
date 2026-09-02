# SPEC — choresplit

> **변경 사항 (contract fix):** F5 AC-3의 `fairnessScore` 기대값을 `37` → **`36`**으로 정정. 구현식 `Math.round(100 - (maxSharePct - minSharePct))`와 문서 말미 정정 노트에 일치시켰다. 그 외 API/DB/타입 계약 불일치는 발견되지 않았다(외부 API·DB 없음, localStorage 단일 상태).

## Common Principles

**CP-1. 플랫폼/스택**
- Vite + React 18 + TypeScript, React Router(`react-router-dom`) 클라이언트 라우팅, 데이터 영속화는 localStorage.
- 모든 UI는 TDS(`@toss/tds-mobile`) 컴포넌트로 조립한다. shadcn/ui, MUI, Ant Design, Chakra UI 사용 금지.
- 서버 코드 없음. 외부 API 없음(MVP). 모든 상태는 기기 로컬에 저장된다.

**CP-2. 인증**
- 토스 앱이 세션을 자동 제공한다. 로그인 함수 호출/커스텀 인증 없음.
- 사용자 식별이 필요할 때만 `getIsTossLoginIntegratedService()`로 연동 상태를 확인한다. 미연동이면 로컬 프로필(`me`)로 동작한다.

**CP-3. 여백/스타일**
- 간격은 TDS `Spacing`(size prop 필수)만 사용. TDS 컴포넌트의 내장 padding/margin을 Tailwind·인라인 스타일로 덮어쓰지 않는다.
- 커스텀 CSS는 TDS가 제공하지 않는 레이아웃(flex/grid 배치)에만 허용.
- HEX 색상 하드코딩 금지 → `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용(다크모드 대응).

**CP-4. 페이지 골격**
- 모든 화면은 `ScreenScaffold`(템플릿 제공 페이지 셸)로 감싼다. raw `div` 골격 금지.
- 1차 액션은 `SubmitFooter`(하단 고정) 또는 `display="block"` TDS Button. 좌측 글자폭 버튼 금지.
- 결과/비교/지표 화면의 핵심 정보는 TDS `Card`로 묶어 위계를 만든다. 핵심 값은 t2~t3 강조 타이포 + 배지.

**CP-5. 터치/모바일**
- 모든 인터랙티브 요소의 터치 타깃은 최소 44×44px.
- 입력 폼은 모바일 키보드 대응: 숫자 입력은 `inputMode="numeric"`, 포커스 시 입력 필드가 키보드에 가려지지 않도록 `scrollIntoView({ block: 'center' })` 실행, 키보드 열림 시 `SubmitFooter`는 문서 흐름 하단으로 이동.
- 리스트 항목 50개 초과 시 가상 스크롤(윈도잉) 적용.

**CP-6. 광고**
- 배너: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` — 콘텐츠 섹션 사이 또는 리스트 하단에만 배치. 콘텐츠 위에 겹치지 않는다.
- 리워드: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>` — 주간 리포트 상세를 게이팅한다.
- 광고/슬롯 ID는 앱인토스 콘솔 발급 값을 env로 주입한다(재빌드 불필요).

**CP-7. 수익화 범위**
- MVP 수익화는 광고만. IAP(`TossPurchase`) 미사용. 프로모션 리워드(`grantPromotionReward`) 미사용(사용 시 `amount ≤ 5000` 검증 필수).

**CP-8. 검수 준수**
- `window.location.href` / `window.open`으로 외부 URL 이동 금지. 앱 설치 유도 문구/배너/링크 금지.
- 외부 분석 솔루션(GA, Amplitude 등) 사용 금지.
- 프로덕션 빌드에서 `console.error` 출력 0개, CORS 에러 0개.
- Android 7+ / iOS 16+ 호환: `Array.prototype.at`, `Object.groupBy`, `structuredClone`, optional chaining 이후 최신 API 미사용(빌드 타깃 es2019).

**CP-9. AI 미사용**
- MVP에는 생성형 AI 기능이 없다. 공정성 점수·정산 제안은 모두 결정론적 규칙 기반 계산이며, "AI", "추천 엔진" 등의 표현을 UI에 노출하지 않는다. 따라서 생성형 AI 고지 의무 대상이 아니다. (F3/F4 계산식은 본 SPEC에 명시된 순수 함수로 구현한다.)

**CP-10. 시간/날짜**
- 모든 날짜는 `YYYY-MM-DD`(KST, `Asia/Seoul`) 문자열로 저장한다.
- 주(week) 단위는 월요일 시작. 주 식별자는 해당 주 월요일의 `YYYY-MM-DD`.

**CP-11. 라우트 목록**
| 경로 | 화면 |
|---|---|
| `/` | 홈(오늘 체크인) |
| `/onboarding` | 초기 설정(가구 생성) |
| `/members` | 동거인 관리/초대 |
| `/chores` | 집안일 항목 관리 |
| `/report` | 주간 리포트 게이트 |
| `/report/detail` | 주간 리포트 상세(리워드 광고 이후) |
| `/settle` | 벌금 정산 제안 |
| `/streak` | 스트릭·랭킹 |
| `/settings` | 설정(리마인더 포함) |

---

## Data Models

모든 데이터는 단일 루트 객체 `ChoreSplitState`로 묶어 localStorage 키 `choresplit:v1`에 JSON 직렬화 저장한다. 부수적으로 UI 플래그는 별도 키를 사용한다.

### Member — 동거인

```ts
export type MemberId = string; // "m_" + 8자리 base36

export interface Member {
  id: MemberId;
  name: string;          // 1~10자, 공백 trim 후 검증
  colorToken: 'blue' | 'green' | 'orange' | 'purple'; // TDS 색 토큰 매핑 키 (HEX 금지)
  isMe: boolean;         // 본인 여부. 정확히 1명만 true
  createdAt: string;     // ISO8601
}
```
- 제약: 가구당 최소 1명, 최대 4명. `name` 중복 불가(대소문자·공백 무시 비교).

### Chore — 집안일 항목

```ts
export type ChoreId = string; // "c_" + 8자리 base36

export interface Chore {
  id: ChoreId;
  name: string;          // 1~12자
  weight: 1 | 2 | 3;     // 난이도 가중치 (1=가벼움, 2=보통, 3=힘듦)
  frequency: 'daily' | 'weekly'; // daily=매일 대상, weekly=주 1회 대상
  penaltyAmount: number; // 미이행 1회당 벌금(원), 0~5000, 100원 단위
  active: boolean;       // false면 체크인 목록에서 제외
  createdAt: string;
}
```
- 기본 시드 6종: 설거지(w2, daily, 500), 청소(w3, daily, 500), 빨래(w2, weekly, 1000), 분리수거(w1, weekly, 500), 요리(w3, daily, 1000), 화장실청소(w3, weekly, 1000).
- 제약: 최대 20개. `name` 중복 불가.

### CheckIn — 일일 체크인 로그

```ts
export type CheckInId = string; // `${date}__${choreId}__${memberId}`

export interface CheckIn {
  id: CheckInId;
  date: string;        // "YYYY-MM-DD" (KST)
  choreId: ChoreId;
  memberId: MemberId;
  weightAtLog: 1 | 2 | 3; // 기록 시점 가중치 스냅샷
  createdAt: string;      // ISO8601
}
```
- 제약: 동일 `(date, choreId, memberId)` 중복 저장 불가(id가 유니크 키). 미래 날짜 저장 불가.
- 보관 정책: 최근 120일 초과 레코드는 저장 시점에 자동 삭제.

### Household — 가구 설정

```ts
export interface Household {
  id: string;            // "h_" + 8자리 base36
  name: string;          // 1~15자, 기본 "우리집"
  inviteCode: string;    // 6자리 대문자+숫자 (예: "K3M9QZ")
  createdAt: string;
}
```

### Settings — 앱 설정

```ts
export interface Settings {
  reminderEnabled: boolean;   // 기본 true
  reminderHour: number;       // 0~23, 기본 21
  penaltyEnabled: boolean;    // 기본 true
  lastReminderShownDate: string | null; // "YYYY-MM-DD"
}
```

### SettlementRecord — 정산 확정 기록

```ts
export interface SettlementRecord {
  weekStart: string;               // 월요일 "YYYY-MM-DD"
  settledAt: string;               // ISO8601
  lines: Array<{
    fromMemberId: MemberId;
    toMemberId: MemberId;
    amount: number;                // 원, 양의 정수
  }>;
  totalPenalty: number;            // 원
}
```

### 루트 상태

```ts
export interface ChoreSplitState {
  version: 1;
  household: Household | null;
  members: Member[];
  chores: Chore[];
  checkIns: CheckIn[];
  settings: Settings;
  settlements: SettlementRecord[];
}
```

### 파생 타입 (저장하지 않음)

```ts
export interface MemberWeekStat {
  memberId: MemberId;
  memberName: string;
  count: number;          // 주간 체크인 건수
  weightedScore: number;  // Σ weightAtLog
  sharePct: number;       // weightedScore / total * 100, 소수 1자리 반올림
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;                 // 일요일 "YYYY-MM-DD"
  stats: MemberWeekStat[];         // weightedScore 내림차순
  fairnessScore: number;           // 0~100 정수
  totalWeighted: number;
  topChores: Array<{ choreId: ChoreId; choreName: string; count: number }>; // 상위 3
  dailyTrend: number[];            // 길이 7, 요일별 총 체크인 수(월~일)
  missedItems: Array<{ choreId: ChoreId; choreName: string; missedCount: number; penalty: number }>;
}
```

### localStorage 키 & 용량 추정

| 키 | 값 | 추정 크기 |
|---|---|---|
| `choresplit:v1` | `ChoreSplitState` JSON | 아래 계산 |
| `choresplit:report-unlocked` | `{ [weekStart: string]: true }` JSON | ≤ 1KB (52주 × ~15B) |
| `choresplit:onboarded` | `"true"` | ≤ 10B |

- `CheckIn` 1건 직렬화 ≈ 150B. 최악 케이스: 4명 × 6항목 × 120일 = 2,880건 × 150B ≈ **432KB**.
- `members`(4×120B) + `chores`(20×140B) + `settlements`(52×250B) + `household`/`settings` ≈ **17KB**.
- **총 ≈ 450KB < 5MB.** 여유 10배 이상.

---

## Feature List

### F1. 데이터 레이어 & 가구 온보딩

- **Description:** localStorage 기반 저장소 모듈(`storage.ts`)과 가구/멤버/집안일 시드 초기화를 구현한다. 앱 최초 실행 시 온보딩 화면에서 가구 이름과 본인 닉네임을 받아 `ChoreSplitState`를 생성하고 기본 집안일 6종을 시드한다. 이후 모든 화면은 이 저장소의 read/write API만 사용한다.
- **Data:** `ChoreSplitState`, `Household`, `Member`, `Chore`, `Settings`
- **API:** 없음(로컬 전용)
- **Requirements:**
  - `loadState(): ChoreSplitState` — 키 없으면 기본값 반환, JSON 파싱 실패 시 기본값 반환
  - `saveState(state): { ok: true } | { ok: false; error: string }` — QuotaExceededError 처리
  - `createHousehold(name, myName): ChoreSplitState`
  - 초대 코드 생성기: `[A-Z0-9]` 6자리

- **AC-1 [E][P0]: Scenario: 가구 최초 생성**
  - Given `localStorage`에 `choresplit:v1` 키가 없을 때
  - When 사용자가 `/onboarding`에서 `{ householdName: "우리집", myName: "민수" }`를 입력하고 "시작하기" 버튼을 탭
  - Then `choresplit:v1`에 `household.name === "우리집"`, `members.length === 1`, `members[0].name === "민수"`, `members[0].isMe === true`가 저장됨
  - And `chores.length === 6`이고 이름 배열이 `["설거지","청소","빨래","분리수거","요리","화장실청소"]`와 일치함
  - And `household.inviteCode`가 `/^[A-Z0-9]{6}$/`를 만족함
  - And `choresplit:onboarded`가 `"true"`로 저장되고 `/`로 이동함

- **AC-2 [U][P0]:** The system shall always route to `/onboarding` when `loadState().household === null`, 그리고 `household !== null`이면 `/onboarding` 접근 시 `/`로 리다이렉트한다.

- **AC-3 [W][P1]: Scenario: 빈 닉네임 거부**
  - Given 온보딩 화면일 때
  - When `{ householdName: "우리집", myName: "   " }`로 "시작하기"를 탭
  - Then 에러 메시지 `"닉네임을 입력해주세요"`가 표시되고 `choresplit:v1`은 생성되지 않음

- **AC-4 [W][P1]: Scenario: 손상된 저장 데이터 복구**
  - Given `localStorage.setItem('choresplit:v1', '{invalid json')`인 상태에서
  - When `loadState()`가 호출됨
  - Then 예외를 던지지 않고 `{ version: 1, household: null, members: [], chores: [], checkIns: [], settlements: [], settings: { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null } }`를 반환하고 `console.error`를 호출하지 않음

- **AC-5 [W][P1]: Scenario: 저장 용량 초과**
  - Given `saveState()` 호출 시 `localStorage.setItem`이 `QuotaExceededError`를 던질 때
  - Then 반환값이 `{ ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" }`이고
  - And 호출한 화면에서 동일 문구의 TDS Toast가 표시되며 앱이 크래시하지 않음

- **AC-6 [S][P1]: Scenario: 초기 로딩 상태**
  - While `loadState()` 실행이 완료되지 않은 상태(초기 마운트 1프레임)
  - Then `data-testid="app-loading"`인 TDS Skeleton(또는 Loader)이 표시되고 홈 콘텐츠는 렌더되지 않음

- **AC-7 [U][P0]:** The system shall always persist `CheckIn` records for at most 120 days — `saveState()` 시 `date < today - 120일`인 `checkIns` 레코드를 제거한 뒤 저장한다.

- **AC-8 [U][P1]:** The system shall never hardcode HEX colors — 전체 소스에서 `/#[0-9a-fA-F]{3,8}\b/` 정규식 매칭이 0건이어야 한다(색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값 사용).

---

### F2. 집안일 항목 관리

- **Description:** 사용자가 집안일 항목을 추가·수정·비활성화하고 가중치(1~3)·주기(daily/weekly)·벌금액을 설정한다. 시드된 6종을 그대로 쓰거나 커스텀 항목을 추가할 수 있다. 비활성화된 항목은 오늘의 체크인 목록에서 제외되되 과거 로그는 유지된다.
- **Data:** `Chore`
- **API:** 없음
- **Requirements:** 항목 추가/편집 BottomSheet, 가중치 Chip 선택, 주기 Chip 선택, 벌금 TextField(숫자), 활성 Switch

- **AC-1 [E][P0]: Scenario: 집안일 항목 추가**
  - Given `/chores` 화면에서 기존 항목이 6개일 때
  - When "항목 추가" BottomSheet에서 `{ name: "화분 물주기", weight: 1, frequency: "weekly", penaltyAmount: 500 }`를 입력하고 "저장"을 탭
  - Then `chores.length === 7`이 되고 새 항목의 `active === true`, `id`가 `/^c_[a-z0-9]{8}$/`를 만족함
  - And TDS Toast `"항목을 추가했어요"`가 표시되고 BottomSheet가 닫힘

- **AC-2 [E][P0]: Scenario: 항목 비활성화**
  - Given `chores`에 `{ name: "요리", active: true }`가 있을 때
  - When 해당 ListRow의 TDS Switch를 off로 토글
  - Then 해당 `chore.active === false`로 저장되고, 홈(`/`)의 오늘 체크인 목록에서 "요리"가 사라짐
  - And 기존 "요리" `CheckIn` 레코드 수는 변하지 않음

- **AC-3 [W][P1]: Scenario: 중복 이름 거부**
  - Given `chores`에 `"설거지"`가 있을 때
  - When 항목 추가에서 `{ name: " 설거지 ", weight: 2, frequency: "daily", penaltyAmount: 500 }`를 저장
  - Then 에러 메시지 `"이미 있는 항목이에요"`가 표시되고 `chores.length`는 증가하지 않음

- **AC-4 [W][P1]: Scenario: 벌금 범위 초과 거부**
  - Given 항목 편집 BottomSheet일 때
  - When `penaltyAmount`에 `7000`을 입력하고 "저장"을 탭
  - Then 에러 메시지 `"벌금은 0원~5,000원 사이여야 해요"`가 표시되고 저장되지 않음
  - And `penaltyAmount`에 `550`(100원 단위 아님)을 입력하면 `"벌금은 100원 단위로 입력해주세요"`가 표시됨

- **AC-5 [W][P1]: Scenario: 항목 개수 상한**
  - Given `chores.length === 20`일 때
  - When "항목 추가" 버튼을 탭
  - Then 버튼이 `disabled` 상태이고 안내 문구 `"항목은 최대 20개까지 만들 수 있어요"`가 표시됨

- **AC-6 [S][P1]: Scenario: 빈 상태**
  - While 모든 항목이 비활성(`chores.every(c => !c.active)`)인 상태
  - Then `/chores`에 `data-testid="chores-empty"` 영역이 표시되고 TDS `Asset.ContentIcon` + 문구 `"활성화된 집안일이 없어요"` + `display="block"` "항목 추가" 버튼이 렌더됨

- **AC-7 [U][P0]:** The system shall render each chore row with TDS `ListRow`(좌: 이름, 우: `Switch`), 가중치는 TDS `Chip`(`"가벼움"|"보통"|"힘듦"`)으로 표기하며 모든 행의 터치 타깃 높이는 44px 이상이다.

- **AC-8 [E][P1]: Scenario: 숫자 키보드**
  - When 벌금 TextField에 포커스가 들어옴
  - Then 해당 input의 `inputMode === "numeric"`이고, 필드가 `scrollIntoView({ block: 'center' })`로 화면 중앙에 노출됨

---

### F3. 일일 체크인 (홈)

- **Description:** 홈 화면에서 오늘 날짜 기준으로 활성 집안일 목록을 보여주고, 각 항목을 "누가 했는지" 멤버 칩으로 선택해 1탭 체크인한다. 이미 체크인한 항목은 완료 표시되며 재탭으로 취소할 수 있다. 날짜 이동(어제/오늘)으로 지난 기록을 보정할 수 있다.
- **Data:** `CheckIn`, `Chore`, `Member`
- **API:** 없음
- **Requirements:** 오늘 요약 히어로(총 체크인 수 CountUp), 항목 리스트, 멤버 선택 Chip, 날짜 네비게이션

- **AC-1 [E][P0]: Scenario: 체크인 성공**
  - Given 오늘이 `2026-09-03`이고 멤버 `민수(m_aaaa1111)`, 항목 `설거지(c_bbbb2222, weight 2)`가 있을 때
  - When 홈에서 "설거지" 행의 `민수` Chip을 탭
  - Then `checkIns`에 `{ id: "2026-09-03__c_bbbb2222__m_aaaa1111", date: "2026-09-03", choreId: "c_bbbb2222", memberId: "m_aaaa1111", weightAtLog: 2 }`가 저장됨
  - And TDS Toast `"체크인 완료!"`가 표시되고 해당 Chip이 선택 상태로 렌더됨
  - And 상단 요약의 오늘 총 체크인 수가 1 증가함

- **AC-2 [E][P0]: Scenario: 체크인 취소**
  - Given `checkIns`에 `"2026-09-03__c_bbbb2222__m_aaaa1111"`이 있을 때
  - When 동일한 `민수` Chip을 다시 탭
  - Then 해당 레코드가 `checkIns`에서 제거되고 Toast `"체크인을 취소했어요"`가 표시됨

- **AC-3 [E][P0]: Scenario: 여러 멤버 동시 체크인**
  - Given 멤버가 `민수`, `지영` 2명일 때
  - When "청소" 행에서 `민수` Chip과 `지영` Chip을 각각 탭
  - Then `checkIns`에 청소/오늘 관련 레코드가 2건 저장되고 두 Chip 모두 선택 상태로 표시됨

- **AC-4 [W][P1]: Scenario: 미래 날짜 차단**
  - Given 오늘이 `2026-09-03`일 때
  - When 날짜 네비게이션에서 "다음 날" 버튼을 탭
  - Then 버튼이 `disabled` 상태이며 날짜는 `2026-09-03`으로 유지되고 체크인 레코드는 생성되지 않음

- **AC-5 [W][P1]: Scenario: 저장 실패 롤백**
  - Given `saveState()`가 `{ ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" }`를 반환할 때
  - When 사용자가 Chip을 탭해 체크인을 시도
  - Then 해당 문구의 Toast가 표시되고 Chip 선택 상태는 탭 이전 값으로 되돌아감(낙관적 업데이트 롤백)

- **AC-6 [S][P1]: Scenario: 오늘 기록 없음 빈 상태**
  - While 선택된 날짜의 `checkIns` 건수가 0인 상태
  - Then 요약 영역에 `data-testid="today-empty"`가 렌더되고 TDS `Asset.ContentIcon`과 문구 `"오늘 첫 집안일을 기록해보세요"`가 표시됨

- **AC-7 [U][P0]:** 홈 화면은 `ScreenScaffold`로 감싸고, 상단에 `data-testid="today-hero"`인 `SummaryHero`(CountUp `value` = 오늘 총 체크인 수, label `"오늘 체크인"`)를 1개 렌더하며, 하단에 `data-testid="home-ad"`인 `<AdSlot />`을 리스트 아래(콘텐츠와 겹치지 않는 위치)에 1개 배치한다.

- **AC-8 [U][P1]:** 활성 항목이 50개를 초과할 경우 리스트는 가상 스크롤(윈도잉)로 렌더하고, 초기 렌더 DOM 행 수는 20개 이하이다.

- **AC-9 [W][P1]:** The system shall never navigate outside the app — 홈 및 전체 화면 코드에서 `window.open` 호출과 `window.location.href = <외부 URL>` 할당이 0건이며, 외부 URL 이동 시도는 무시된다.

---

### F4. 동거인 초대 & 관리

- **Description:** 가구에 동거인을 추가하고(최대 4명) 각 멤버의 이름·색상 토큰을 관리한다. 초대는 6자리 초대 코드를 화면에 표시하고 코드 복사(클립보드)로 공유하며, 상대는 자신의 기기에서 코드를 입력해 동일한 가구 이름/멤버 구성을 로컬로 재현한다(MVP는 서버 동기화 없이 로컬 멤버 등록 방식). 멤버 삭제 시 해당 멤버의 체크인 로그 처리 방식을 명시한다.
- **Data:** `Member`, `Household`
- **API:** 없음(서버 동기화는 Open Question O-1)
- **Requirements:** 멤버 리스트, 멤버 추가 BottomSheet, 초대 코드 카드 + 복사 버튼, 삭제 AlertDialog

- **AC-1 [E][P0]: Scenario: 동거인 추가**
  - Given `members`가 `[민수(isMe:true)]` 1명일 때
  - When 멤버 추가 BottomSheet에서 `{ name: "지영", colorToken: "green" }`을 저장
  - Then `members.length === 2`, 새 멤버의 `isMe === false`, `id`가 `/^m_[a-z0-9]{8}$/`를 만족함
  - And 홈 화면 각 항목 행의 멤버 Chip이 2개로 늘어남

- **AC-2 [E][P0]: Scenario: 초대 코드 복사**
  - Given `household.inviteCode === "K3M9QZ"`일 때
  - When `/members`의 "코드 복사" 버튼을 탭
  - Then `navigator.clipboard.writeText("K3M9QZ")`가 호출되고 Toast `"초대 코드를 복사했어요"`가 표시됨

- **AC-3 [W][P1]: Scenario: 클립보드 미지원 폴백**
  - Given `navigator.clipboard`가 `undefined`이거나 `writeText`가 reject할 때
  - When "코드 복사" 버튼을 탭
  - Then Toast `"코드를 길게 눌러 복사해주세요"`가 표시되고 `console.error`가 호출되지 않으며 앱이 크래시하지 않음

- **AC-4 [W][P1]: Scenario: 멤버 수 상한**
  - Given `members.length === 4`일 때
  - When "동거인 추가" 버튼을 탭
  - Then 버튼이 `disabled`이고 안내 문구 `"동거인은 최대 4명까지 등록할 수 있어요"`가 표시됨

- **AC-5 [W][P1]: Scenario: 본인 삭제 차단**
  - Given `isMe === true`인 멤버 `민수`가 있을 때
  - When `민수` 행에서 삭제를 시도
  - Then 삭제 버튼이 렌더되지 않고, 프로그램적으로 호출 시 `{ ok: false, error: "본인은 삭제할 수 없어요" }`를 반환함

- **AC-6 [E][P0]: Scenario: 멤버 삭제 확인**
  - Given `지영(m_cccc3333)`에게 체크인 로그가 5건 있을 때
  - When 삭제 버튼 탭 → TDS AlertDialog `"지영님을 삭제하면 기록 5건도 함께 삭제돼요"`에서 "삭제"를 탭
  - Then `members`에서 해당 멤버가 제거되고 `memberId === "m_cccc3333"`인 `checkIns` 5건이 모두 제거됨

- **AC-7 [S][P1]: Scenario: 혼자 사용 중 상태**
  - While `members.length === 1`인 상태
  - Then `/members`에 `data-testid="members-solo"` 영역이 표시되고 `Asset.ContentIcon` + 문구 `"아직 동거인이 없어요. 초대 코드를 공유해보세요"`가 렌더됨

- **AC-8 [U][P0]:** 초대 코드는 `data-testid="invite-card"`인 TDS `Card` 안에 t2 강조 타이포로 표기하고, "코드 복사" 1차 액션은 `display="block"` TDS Button(높이 ≥ 48px)으로 렌더한다.

---

### F5. 주간 공정성 점수 계산 엔진

- **Description:** 지정한 주(월~일)의 체크인 로그를 집계해 멤버별 가중 점수·비중, 0~100 공정성 점수, 요일별 추이, 상위 집안일, 미이행 항목을 계산하는 순수 함수 모듈(`report.ts`)을 구현한다. 계산은 결정론적이며 동일 입력에 항상 동일 출력을 낸다. UI를 포함하지 않는 계산 레이어 전용 피처다.
- **Data:** `CheckIn`, `Member`, `Chore` → `WeeklyReport`, `MemberWeekStat`
- **API:** 없음
- **Requirements:**
  - `getWeekStart(date: string): string` — 월요일 반환
  - `buildWeeklyReport(state: ChoreSplitState, weekStart: string): WeeklyReport`
  - 공정성 점수 공식: `members.length < 2`이면 `100`. 그 외 `fairnessScore = Math.round(100 - (maxSharePct - minSharePct))`(단일 반올림), 하한 0. `totalWeighted === 0`이면 `0`.
  - 미이행 계산: `frequency === 'daily'`인 항목은 주 7일 중 체크인 없는 날 수, `frequency === 'weekly'`인 항목은 주간 체크인 0건이면 1, 아니면 0. `penalty = missedCount * chore.penaltyAmount`.

- **AC-1 [U][P0]: Scenario: 주 시작일 계산**
  - Given 날짜 `"2026-09-03"`(목요일)
  - When `getWeekStart("2026-09-03")` 호출
  - Then `"2026-08-31"`을 반환하고, `getWeekStart("2026-08-31")`은 `"2026-08-31"`, `getWeekStart("2026-09-06")`(일요일)은 `"2026-08-31"`을 반환함

- **AC-2 [E][P0]: Scenario: 가중 점수 집계**
  - Given 주 `2026-08-31` 범위에 `민수`가 weight2 항목 3건, weight3 항목 1건 / `지영`이 weight1 항목 2건 체크인했을 때
  - When `buildWeeklyReport(state, "2026-08-31")` 호출
  - Then `stats[0] === { memberId: 민수.id, memberName: "민수", count: 4, weightedScore: 9, sharePct: 81.8 }`
  - And `stats[1] === { memberId: 지영.id, memberName: "지영", count: 2, weightedScore: 2, sharePct: 18.2 }`
  - And `totalWeighted === 11`

- **AC-3 [E][P0]: Scenario: 공정성 점수 산출**
  - Given AC-2와 동일한 데이터(`maxSharePct = 81.8`, `minSharePct = 18.2`)
  - When `buildWeeklyReport(state, "2026-08-31")` 호출
  - Then `fairnessScore === 36`
  - And 구현은 `Math.round(100 - (maxSharePct - minSharePct))` **단일 반올림 식**을 사용한다 — `Math.round(100 - 63.6) === Math.round(36.4) === 36`. `100 - Math.round(63.6) = 36`처럼 차이값을 먼저 반올림하는 2단계 계산은 금지한다(다른 입력에서 1점 오차 발생).
  - And 두 멤버의 `weightedScore`가 동일(`5`, `5`)하면 `fairnessScore === 100`

- **AC-4 [W][P1]: Scenario: 기록 0건 주간**
  - Given 주 `2026-08-31` 범위에 `checkIns`가 0건일 때
  - When `buildWeeklyReport(state, "2026-08-31")` 호출
  - Then `totalWeighted === 0`, `fairnessScore === 0`, `stats`는 모든 멤버에 대해 `{ count: 0, weightedScore: 0, sharePct: 0 }`을 포함하고 `dailyTrend === [0,0,0,0,0,0,0]`이며 예외를 던지지 않음

- **AC-5 [W][P1]: Scenario: 혼자 사용 시 점수**
  - Given `members.length === 1`이고 체크인 5건이 있을 때
  - Then `fairnessScore === 100`이고 `stats.length === 1`, `stats[0].sharePct === 100`

- **AC-6 [E][P0]: Scenario: 미이행 벌금 계산**
  - Given `설거지(daily, penaltyAmount 500)`가 주 7일 중 4일만 체크인되고, `빨래(weekly, penaltyAmount 1000)`는 주간 체크인 0건일 때
  - When `buildWeeklyReport` 호출
  - Then `missedItems`에 `{ choreName: "설거지", missedCount: 3, penalty: 1500 }`와 `{ choreName: "빨래", missedCount: 1, penalty: 1000 }`가 포함됨

- **AC-7 [U][P0]:** `dailyTrend`는 항상 길이 7의 정수 배열이며 index 0=월요일 … 6=일요일의 총 체크인 건수를 담는다. `topChores`는 체크인 건수 내림차순 최대 3개이며 동점 시 `chore.name` 오름차순으로 정렬한다.

- **AC-8 [U][P1]:** `buildWeeklyReport`는 순수 함수로서 입력 `state`를 변형하지 않는다 — 호출 전후 `JSON.stringify(state)`가 동일하다.

---

### F6. 주간 리포트 화면 (리워드 광고 게이트)

- **Description:** 주간 공정성 점수 요약을 게이트 화면에 보여주고, "상세 리포트 보기" 탭 시 `TossRewardAd` 광고 시청 후 상세 화면(멤버별 비중, 요일 추이, 상위 항목, 미이행 목록)을 공개한다. 한 번 해제한 주는 `choresplit:report-unlocked`에 기록해 재시청 없이 열람한다.
- **Data:** `WeeklyReport`(F5 계산), `choresplit:report-unlocked`
- **API:** 없음
- **Requirements:** 주 선택(이번 주/지난 주), 게이트 화면, 상세 화면, 배너 광고

- **AC-1 [E][P0]: Scenario: 리워드 광고 시청 후 상세 리포트 열람**
  - Given `/report`에서 이번 주(`2026-08-31`)가 잠금 상태(`choresplit:report-unlocked["2026-08-31"]` 미존재)일 때
  - When 사용자가 "상세 리포트 보기" 버튼을 탭하고 `TossRewardAd` 광고 시청이 완료됨
  - Then `choresplit:report-unlocked`에 `{"2026-08-31": true}`가 저장되고 `navigate('/report/detail', { state: { weekStart: "2026-08-31" } })`로 이동해 상세 리포트가 표시됨

- **AC-2 [S][P0]: Scenario: 이미 해제한 주 재열람**
  - While `choresplit:report-unlocked["2026-08-31"] === true`인 상태
  - When "상세 리포트 보기"를 탭
  - Then `TossRewardAd` 광고 없이 즉시 `/report/detail`로 이동함

- **AC-3 [W][P1]: Scenario: 광고 로드/시청 실패**
  - Given 광고 시청 도중 사용자가 중도 종료하거나 광고 로드가 실패했을 때
  - Then Toast `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"`가 표시되고
  - And `choresplit:report-unlocked`는 변경되지 않으며 `/report`에 머무름(`console.error` 미호출)

- **AC-4 [W][P1]: Scenario: state 없이 상세 진입**
  - Given 사용자가 `/report/detail`에 `location.state === null`로 직접 진입했을 때
  - Then `getWeekStart(오늘)`을 기본값으로 사용하되 해당 주가 잠금 상태면 `/report`로 리다이렉트함

- **AC-5 [S][P1]: Scenario: 리포트 계산 로딩**
  - While `buildWeeklyReport` 결과가 준비되지 않은 상태
  - Then `data-testid="report-loading"`인 TDS Skeleton 3줄이 표시되고 점수 Card는 렌더되지 않음

- **AC-6 [U][P0]:** `/report` 게이트 화면은 `ScreenScaffold`로 감싸고, `data-testid="fairness-hero"`인 `SummaryHero`(CountUp `value` = `fairnessScore`, suffix `"점"`, label `"이번 주 공정성 점수"`)를 렌더하며, 1차 액션 "상세 리포트 보기"는 `SubmitFooter` 하단 고정 버튼으로 배치한다.

- **AC-7 [U][P0]:** `/report/detail`은 `data-testid="report-card"`인 TDS `Card`를 최소 3개(멤버별 비중 / 요일 추이 / 미이행·벌금) 렌더한다. 멤버별 비중 Card는 `data-testid="share-bar"`인 `MiniBar`를 멤버 수만큼, 요일 추이 Card는 `data-testid="trend-spark"`인 `Sparkline`(데이터 길이 7)을 1개 포함하고, 각 멤버 `sharePct`는 t3 강조 타이포로 표기한다.

- **AC-8 [S][P1]: Scenario: 빈 리포트**
  - While 해당 주 `totalWeighted === 0`인 상태
  - Then `/report`에 `data-testid="report-empty"`가 렌더되고 `Asset.ContentIcon` + 문구 `"이번 주 기록이 아직 없어요"`가 표시되며 "상세 리포트 보기" 버튼은 `disabled`가 됨

- **AC-9 [U][P1]:** `/report/detail` 하단(미이행 Card 아래, 콘텐츠와 겹치지 않는 위치)에 `data-testid="report-ad"`인 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`을 1개 배치한다.

---

### F7. 벌금 정산 제안 & 확정

- **Description:** F5가 계산한 미이행 벌금 총액을 기반으로 "누가 누구에게 얼마를 보내면 되는지" 최소 송금 라인을 제안한다. 정산은 각 멤버의 벌금 부담액(미이행 항목은 전원 공동 책임으로 간주해 균등 배분 후 기여도 보정)으로 산출하며, 사용자가 "정산 완료"를 탭하면 `SettlementRecord`로 확정 저장한다. 실제 송금은 하지 않고 금액 제안만 제공한다.
- **Data:** `SettlementRecord`, `WeeklyReport`
- **API:** 없음
- **Requirements:**
  - 부담액 계산: `totalPenalty`(주간 미이행 벌금 합) × `(1 - member.sharePct/100)` / `(members.length - 1)` → 100원 단위 반올림. `members.length < 2`면 정산 없음.
  - 송금 라인: 부담액이 평균보다 큰 멤버 → 작은 멤버로, 차액 기준 greedy 매칭.

- **AC-1 [E][P0]: Scenario: 정산 제안 계산**
  - Given `members = [민수, 지영]`, 주간 `totalPenalty === 2500`, `민수.sharePct === 80`, `지영.sharePct === 20`일 때
  - When `/settle`에 진입
  - Then 제안 라인이 `[{ from: 지영, to: 민수, amount: 1500 }]` 1건으로 표시되고, 금액이 `"1,500원"` 형식으로 렌더됨
  - And 부담액 표기는 `민수 500원`, `지영 2,000원`임

- **AC-2 [E][P0]: Scenario: 정산 확정 저장**
  - Given AC-1 제안이 표시된 상태에서
  - When "정산 완료" 버튼 탭 → AlertDialog `"이번 주 정산을 마감할까요?"`에서 "확인"을 탭
  - Then `settlements`에 `{ weekStart: "2026-08-31", totalPenalty: 2500, lines: [{ fromMemberId: 지영.id, toMemberId: 민수.id, amount: 1500 }] }`가 추가되고 Toast `"정산을 마감했어요"`가 표시됨

- **AC-3 [S][P0]: Scenario: 이미 마감된 주**
  - While `settlements`에 `weekStart === "2026-08-31"` 레코드가 존재하는 상태
  - Then "정산 완료" 버튼이 `disabled`이고 배지 `"마감됨"`이 표시되며, 확정 당시 저장된 `lines`가 그대로 렌더됨

- **AC-4 [W][P1]: Scenario: 벌금 기능 비활성**
  - Given `settings.penaltyEnabled === false`일 때
  - When `/settle`에 진입
  - Then `data-testid="settle-disabled"` 영역과 문구 `"벌금 기능이 꺼져 있어요"` + "설정으로 가기" 버튼이 표시되고 정산 라인은 렌더되지 않음

- **AC-5 [W][P1]: Scenario: 정산 대상 없음**
  - Given `totalPenalty === 0`이거나 `members.length === 1`일 때
  - Then `data-testid="settle-empty"`가 렌더되고 `Asset.ContentIcon` + 문구 `"이번 주 정산할 벌금이 없어요"`가 표시되며 "정산 완료" 버튼은 `disabled`가 됨

- **AC-6 [S][P1]: Scenario: 계산 로딩**
  - While 정산 계산이 완료되지 않은 상태
  - Then `data-testid="settle-loading"`인 TDS Skeleton 2줄이 표시됨

- **AC-7 [U][P0]:** `/settle`은 `ScreenScaffold`로 감싸고 `data-testid="settle-hero"`인 `SummaryHero`(CountUp `value` = `totalPenalty`, suffix `"원"`, label `"이번 주 벌금 합계"`)와 `data-testid="settle-line-card"`인 TDS `Card`(송금 라인당 1개)를 렌더하며, 송금 금액은 t3 강조 타이포 + `Chip` 배지로 표기한다. 1차 액션 "정산 완료"는 `SubmitFooter` 하단 고정이다.

- **AC-8 [U][P0]:** The system shall never execute an actual money transfer — 정산 화면 코드에서 `IAP`, `TossPurchase`, `grantPromotionReward` 호출이 0건이며, 화면에 `"실제 송금은 직접 진행해주세요"` 안내 문구가 항상 표시된다.

---

### F8. 스트릭·랭킹 & 체크인 리마인더

- **Description:** 연속 체크인 일수(스트릭)와 멤버별 누적 랭킹을 계산해 게임화 요소를 제공한다. 또한 `settings.reminderHour` 이후 앱을 열었는데 오늘 체크인이 0건이면 인앱 리마인더 배너를 1일 1회 표시한다. 푸시 알림은 사용하지 않는다(인앱 배너만).
- **Data:** `CheckIn`, `Member`, `Settings`
- **API:** 없음
- **Requirements:**
  - `getStreak(state, memberId): number` — 오늘(또는 오늘 체크인 0건이면 어제)부터 역순으로 체크인이 존재하는 연속 일수
  - `getRanking(state, days: 30): MemberWeekStat[]` — 최근 30일 가중 점수 내림차순

- **AC-1 [E][P0]: Scenario: 스트릭 계산**
  - Given `민수`가 `2026-09-01`, `2026-09-02`, `2026-09-03`에 각각 1건 이상 체크인하고 `2026-08-31`에는 0건일 때 (오늘 = `2026-09-03`)
  - When `getStreak(state, 민수.id)` 호출
  - Then `3`을 반환함

- **AC-2 [E][P0]: Scenario: 오늘 미체크인 시 스트릭 유지**
  - Given `민수`가 `2026-09-01`, `2026-09-02`에 체크인하고 오늘(`2026-09-03`)은 0건일 때
  - When `getStreak(state, 민수.id)` 호출
  - Then `2`를 반환함(오늘 미기록은 스트릭을 끊지 않음)
  - And `2026-09-02`에도 0건이면 `0`을 반환함

- **AC-3 [E][P0]: Scenario: 랭킹 정렬**
  - Given 최근 30일 가중 점수가 `민수 24`, `지영 24`, `현우 10`일 때
  - When `getRanking(state, 30)` 호출
  - Then 반환 배열이 `[민수, 지영, 현우]` 순이며(동점은 `memberName` 오름차순) 각 원소에 `weightedScore`와 `sharePct`가 포함됨

- **AC-4 [E][P1]: Scenario: 리마인더 배너 표시**
  - Given `settings.reminderEnabled === true`, `settings.reminderHour === 21`, 현재 시각이 `2026-09-03 21:30`(KST), 오늘 내 체크인 0건, `settings.lastReminderShownDate !== "2026-09-03"`일 때
  - When 홈(`/`)이 마운트됨
  - Then `data-testid="reminder-banner"` 영역에 문구 `"오늘 집안일 기록을 잊지 않으셨나요?"`와 "지금 기록하기" 버튼이 표시되고
  - And `settings.lastReminderShownDate === "2026-09-03"`으로 저장됨

- **AC-5 [W][P1]: Scenario: 리마인더 중복 표시 방지**
  - Given `settings.lastReminderShownDate === "2026-09-03"`이고 오늘이 `2026-09-03`일 때
  - When 홈을 다시 마운트
  - Then `data-testid="reminder-banner"`가 렌더되지 않음
  - And `settings.reminderEnabled === false`이면 시각과 무관하게 렌더되지 않음

- **AC-6 [W][P1]: Scenario: 푸시 알림 미사용**
  - Given 앱 전체 소스에서
  - Then `Notification`, `requestPermission`, `serviceWorker.register` 호출이 0건이며 리마인더는 인앱 배너로만 동작함

- **AC-7 [S][P1]: Scenario: 랭킹 빈 상태**
  - While 최근 30일 체크인이 0건인 상태
  - Then `/streak`에 `data-testid="ranking-empty"`가 렌더되고 `Asset.ContentIcon` + 문구 `"아직 기록이 없어요"`가 표시되며 스트릭 값은 `0`으로 표기됨

- **AC-8 [U][P0]:** `/streak`은 `ScreenScaffold`로 감싸고 `data-testid="streak-hero"`인 `SummaryHero`(CountUp `value` = 본인 스트릭, suffix `"일"`, label `"연속 기록"`)를 렌더하며, 랭킹은 `data-testid="ranking-card"`인 TDS `Card` 1개 안에 멤버당 `ListRow` + `MiniBar`(`data-testid="ranking-bar"`)로 구성하고 1위 행에 `Chip` 배지 `"1위"`를 표시한다.

- **AC-9 [S][P1]: Scenario: 계산 로딩**
  - While 스트릭/랭킹 계산이 완료되지 않은 상태
  - Then `data-testid="streak-loading"`인 TDS Skeleton 2줄이 표시되고 히어로는 렌더되지 않음

---

## Screen Definitions

전 화면 공통: `ScreenScaffold`로 감싸고 상단은 TDS `Top`(타이틀 + 뒤로가기), 하단 탭 네비게이션은 템플릿 제공 `src/components/FloatingTabBar`(홈 / 리포트 / 스트릭 / 설정 4탭, 각 탭 터치 타깃 ≥ 44px)를 사용한다. 모든 에러는 TDS `Toast`, 파괴적 확인은 TDS `AlertDialog`, 폼 입력은 TDS `BottomSheet` 안에서 처리한다.

### S1. 온보딩 — `/onboarding`
- **TDS 컴포넌트:** `Top`(타이틀 "집안일, 공정하게"), `Paragraph.Text`(설명), `TextField`×2(가구 이름 / 내 닉네임), `Spacing size={16}`, `SubmitFooter` + TDS `Button`(display="block", "시작하기")
- **로딩:** 저장 중 `Button`이 `loading` 상태이며 재탭이 무시됨(`disabled`)
- **빈 상태:** 해당 없음(최초 진입 전용)
- **에러:** 닉네임 공백 → TextField 하단 `"닉네임을 입력해주세요"`, 가구 이름 공백 → `"가구 이름을 입력해주세요"`, 저장 실패 → Toast `"저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"`
- **터치:** 버튼 높이 48px, TextField 높이 52px
- **키보드:** 두 TextField 모두 포커스 시 `scrollIntoView({ block: 'center' })`, 첫 필드 `enterKeyHint="next"`, 둘째 `enterKeyHint="done"` + 제출 트리거
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing: 성공 시 `navigate('/', { replace: true })` — state 없음
- **Layout contract:** `ScreenScaffold` > `Card`(입력 그룹) + `SubmitFooter`. 1차 액션은 하단 고정 `display="block"`.

### S2. 홈(오늘 체크인) — `/`
- **TDS 컴포넌트:** `Top`(타이틀 = `household.name`), `SummaryHero`(`data-testid="today-hero"`, CountUp), `Chip`(날짜 이동 "어제"/"오늘", 멤버 선택), `ListRow`(집안일 행), `Asset.ContentIcon`(빈 상태), `Toast`, `AdSlot`(`data-testid="home-ad"`), `Spacing`
- **로딩:** 초기 마운트 시 `data-testid="app-loading"` Skeleton 4줄
- **빈 상태:** 선택 날짜 체크인 0건 → `data-testid="today-empty"` + `"오늘 첫 집안일을 기록해보세요"`; 활성 항목 0개 → `"집안일 항목을 먼저 추가해주세요"` + "항목 관리" 버튼
- **에러:** 저장 실패 Toast + Chip 상태 롤백(F3 AC-5)
- **스크롤:** 세로 리스트. 활성 항목 50개 초과 시 가상 스크롤(초기 DOM 행 ≤ 20)
- **터치:** 멤버 Chip 44×44px 이상, ListRow 높이 ≥ 56px, 날짜 이동 버튼 44×44px
- **광고:** 리스트 최하단, 마지막 `ListRow` 아래 `Spacing size={24}` 후 `AdSlot` 1개(콘텐츠 오버레이 금지)
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing:
    - "항목 관리" → `navigate('/chores')` (state 없음)
    - 멤버 아바타 영역 → `navigate('/members')` (state 없음)
    - 리마인더 "지금 기록하기" → 앱 내 스크롤만 수행, navigate 없음
    - FloatingTabBar 리포트 탭 → `navigate('/report')` (state 없음)
- **Layout contract:** `ScreenScaffold` > `SummaryHero` 1개 > (리마인더 배너) > 날짜 Chip 행 > 집안일 `ListRow` 리스트 > `AdSlot`.

### S3. 집안일 항목 관리 — `/chores`
- **TDS 컴포넌트:** `Top`("집안일 항목"), `ListRow`(이름 + 우측 `Switch`), `Chip`(가중치/주기 표기), `BottomSheet`(추가/편집 폼), `TextField`(이름, 벌금), `Button`(display="block", "항목 추가"), `AlertDialog`(삭제 확인), `Toast`, `Asset.ContentIcon`
- **로딩:** 저장 중 BottomSheet 저장 버튼 `loading` + `disabled`
- **빈 상태:** `data-testid="chores-empty"` + `"활성화된 집안일이 없어요"`
- **에러:** 중복 `"이미 있는 항목이에요"`, 범위 `"벌금은 0원~5,000원 사이여야 해요"`, 단위 `"벌금은 100원 단위로 입력해주세요"`, 상한 `"항목은 최대 20개까지 만들 수 있어요"`
- **스크롤:** 최대 20개이므로 일반 스크롤(가상 스크롤 불필요)
- **터치:** `Switch` 터치 영역 44×44px, ListRow ≥ 56px
- **키보드:** 벌금 TextField `inputMode="numeric"`, BottomSheet 오픈 시 폼이 키보드 위로 밀려 올라가고 저장 버튼이 키보드에 가려지지 않음
- **Navigation state contract:**
  - Incoming: `location.state = { openCreate: boolean } | null` (홈 빈 상태에서 진입 시 `{ openCreate: true }`면 추가 BottomSheet 자동 오픈)
  - Outgoing: 뒤로가기 → `navigate(-1)`
- **Layout contract:** `ScreenScaffold` > `ListRow` 리스트 > `SubmitFooter`("항목 추가", `display="block"`).

### S4. 동거인 관리 — `/members`
- **TDS 컴포넌트:** `Top`("동거인"), `Card`(`data-testid="invite-card"`, 초대 코드), `Button`(display="block", "코드 복사"), `ListRow`(멤버 행 + 삭제 아이콘), `Chip`(색상 토큰 선택), `BottomSheet`(멤버 추가), `TextField`(이름), `AlertDialog`(삭제 확인), `Toast`, `Asset.ContentIcon`
- **로딩:** 저장 중 저장 버튼 `loading`
- **빈 상태:** `members.length === 1` → `data-testid="members-solo"` + `"아직 동거인이 없어요. 초대 코드를 공유해보세요"`
- **에러:** 상한 `"동거인은 최대 4명까지 등록할 수 있어요"`, 중복 이름 `"같은 이름이 이미 있어요"`, 클립보드 실패 `"코드를 길게 눌러 복사해주세요"`
- **스크롤:** 최대 4명 — 일반 스크롤
- **터치:** 삭제 아이콘 버튼 44×44px, 색상 Chip 44×44px
- **키보드:** 이름 TextField `enterKeyHint="done"`, 포커스 시 `scrollIntoView({ block: 'center' })`
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing: 뒤로가기 → `navigate(-1)`
- **Layout contract:** `ScreenScaffold` > 초대 코드 `Card`(코드 t2 강조) > 멤버 `ListRow` 리스트 > `SubmitFooter`("동거인 추가").

### S5. 주간 리포트 게이트 — `/report`
- **TDS 컴포넌트:** `Top`("주간 리포트"), `Tab`(상단 "이번 주" / "지난 주" 전환), `SummaryHero`(`data-testid="fairness-hero"`), `Card`(멤버 요약), `TossRewardAd`(상세 게이트), `SubmitFooter` + `Button`("상세 리포트 보기"), `Asset.ContentIcon`, `Toast`
- **로딩:** `data-testid="report-loading"` Skeleton 3줄
- **빈 상태:** `data-testid="report-empty"` + `"이번 주 기록이 아직 없어요"`, 버튼 `disabled`
- **에러:** 광고 실패 Toast `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"`
- **터치:** Tab 각 항목 44px 이상, 하단 버튼 48px
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing: 광고 시청 완료(또는 기해제) → `navigate('/report/detail', { state: { weekStart: string } })`
- **Layout contract:** `ScreenScaffold` > `Tab` > `SummaryHero`(공정성 점수 CountUp + 상태 배지 `Chip`: 90↑ `"공평해요"`, 60~89 `"조금 기울어요"`, 60 미만 `"많이 기울어요"`) > 요약 `Card` > `SubmitFooter`.

### S6. 주간 리포트 상세 — `/report/detail`
- **TDS 컴포넌트:** `Top`("상세 리포트"), `Card`×3+(`data-testid="report-card"`), `MiniBar`(`data-testid="share-bar"`), `Sparkline`(`data-testid="trend-spark"`), `ListRow`(미이행 항목), `Chip`(벌금 배지), `AdSlot`(`data-testid="report-ad"`), `Paragraph.Text`
- **로딩:** `data-testid="report-loading"` Skeleton 3줄
- **빈 상태:** 미이행 0건 → 미이행 Card 안에 `"모든 항목을 완수했어요"` 표시
- **에러:** `location.state` 없고 해당 주 잠금 → `/report`로 `navigate('/report', { replace: true })`
- **스크롤:** 세로 스크롤, 미이행 항목 20개 이하이므로 일반 스크롤
- **터치:** "정산 보기" 버튼 48px
- **광고:** 미이행 Card 아래 `Spacing size={24}` 후 `AdSlot` 1개
- **Navigation state contract:**
  - Incoming: `location.state = { weekStart: string } | null`
  - Outgoing: "정산 보기" → `navigate('/settle', { state: { weekStart: string } })`
- **Layout contract:** `ScreenScaffold` > 비중 `Card`(멤버별 `MiniBar` + `sharePct` t3) > 추이 `Card`(`Sparkline` 7포인트) > 미이행 `Card`(`ListRow` + 벌금 `Chip`) > `AdSlot` > `SubmitFooter`("정산 보기").

### S7. 벌금 정산 — `/settle`
- **TDS 컴포넌트:** `Top`("정산"), `SummaryHero`(`data-testid="settle-hero"`), `Card`(`data-testid="settle-line-card"`, 송금 라인), `Chip`(금액 배지 / `"마감됨"` 배지), `ListRow`(멤버별 부담액), `AlertDialog`(마감 확인), `SubmitFooter` + `Button`("정산 완료"), `Toast`, `Asset.ContentIcon`, `Paragraph.Text`(`"실제 송금은 직접 진행해주세요"`)
- **로딩:** `data-testid="settle-loading"` Skeleton 2줄
- **빈 상태:** `data-testid="settle-empty"` + `"이번 주 정산할 벌금이 없어요"`; 벌금 비활성 → `data-testid="settle-disabled"` + `"벌금 기능이 꺼져 있어요"`
- **에러:** 저장 실패 Toast(F1 AC-5 문구)
- **터치:** 하단 버튼 48px, ListRow ≥ 56px
- **Navigation state contract:**
  - Incoming: `location.state = { weekStart: string } | null` (없으면 `getWeekStart(오늘)` 사용)
  - Outgoing: "설정으로 가기" → `navigate('/settings')` (state 없음)
- **Layout contract:** `ScreenScaffold` > `SummaryHero`(벌금 합계 CountUp) > 송금 라인 `Card` 목록(금액 t3 + `Chip`) > 부담액 `ListRow` > 고지 문구 > `SubmitFooter`.

### S8. 스트릭·랭킹 — `/streak`
- **TDS 컴포넌트:** `Top`("스트릭"), `SummaryHero`(`data-testid="streak-hero"`), `Card`(`data-testid="ranking-card"`), `ListRow`(멤버 랭킹), `MiniBar`(`data-testid="ranking-bar"`), `Chip`(`"1위"` 배지), `Asset.ContentIcon`, `AdSlot`
- **로딩:** `data-testid="streak-loading"` Skeleton 2줄
- **빈 상태:** `data-testid="ranking-empty"` + `"아직 기록이 없어요"`, 스트릭 `0일`
- **에러:** 계산 예외 시 랭킹 Card 대신 `"기록을 불러오지 못했어요"` 표시(`console.error` 미호출)
- **스크롤:** 최대 4명 — 일반 스크롤
- **터치:** ListRow ≥ 56px
- **광고:** 랭킹 Card 아래 `Spacing size={24}` 후 `AdSlot` 1개
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing: 멤버 행 탭 → `navigate('/members')` (state 없음)
- **Layout contract:** `ScreenScaffold` > `SummaryHero`(연속 기록 CountUp) > 랭킹 `Card`(멤버당 `ListRow` + `MiniBar`) > `AdSlot`.

### S9. 설정 — `/settings`
- **TDS 컴포넌트:** `Top`("설정"), `ListRow`+`Switch`(리마인더 on/off, 벌금 기능 on/off), `ListRow`(리마인더 시간 → `BottomSheet` 시간 선택), `Chip`(시간 선택 0~23), `ListRow`("오래된 기록 정리"), `AlertDialog`(정리 확인), `Toast`, `Paragraph.Text`(버전/고지)
- **로딩:** 저장 중 해당 `Switch` `disabled`
- **빈 상태:** 해당 없음
- **에러:** 저장 실패 Toast(F1 AC-5 문구)
- **터치:** `Switch` 44×44px, ListRow ≥ 56px
- **Navigation state contract:**
  - Incoming: `location.state = null`
  - Outgoing: "집안일 항목 관리" → `navigate('/chores')`, "동거인 관리" → `navigate('/members')` (모두 state 없음)
- **Layout contract:** `ScreenScaffold` > 설정 `ListRow` 그룹(`Card` 없이 리스트) > 고지 `Paragraph.Text`. (단순 설정 화면이므로 SummaryHero/차트 미사용.)

---

## Data Storage

### 저장 키 정의

| 키 | 타입 | 형태 | 쓰기 시점 |
|---|---|---|---|
| `choresplit:v1` | `ChoreSplitState` | JSON 문자열 | 모든 mutation |
| `choresplit:report-unlocked` | `Record<string, true>` | `{"2026-08-31":true}` | 리워드 광고 시청 완료 |
| `choresplit:onboarded` | `"true"` | 평문 | 온보딩 완료 |

### 예시 저장 값

```json
{
  "version": 1,
  "household": { "id": "h_a1b2c3d4", "name": "우리집", "inviteCode": "K3M9QZ", "createdAt": "2026-09-01T10:00:00.000Z" },
  "members": [
    { "id": "m_aaaa1111", "name": "민수", "colorToken": "blue", "isMe": true, "createdAt": "2026-09-01T10:00:00.000Z" },
    { "id": "m_cccc3333", "name": "지영", "colorToken": "green", "isMe": false, "createdAt": "2026-09-01T10:05:00.000Z" }
  ],
  "chores": [
    { "id": "c_bbbb2222", "name": "설거지", "weight": 2, "frequency": "daily", "penaltyAmount": 500, "active": true, "createdAt": "2026-09-01T10:00:00.000Z" }
  ],
  "checkIns": [
    { "id": "2026-09-03__c_bbbb2222__m_aaaa1111", "date": "2026-09-03", "choreId": "c_bbbb2222", "memberId": "m_aaaa1111", "weightAtLog": 2, "createdAt": "2026-09-03T21:10:00.000Z" }
  ],
  "settings": { "reminderEnabled": true, "reminderHour": 21, "penaltyEnabled": true, "lastReminderShownDate": "2026-09-03" },
  "settlements": []
}
```

### 용량 추정 (총 ≈ 450KB, 한도 5MB의 9%)

| 항목 | 건수(최악) | 건당 | 소계 |
|---|---|---|---|
| `checkIns` | 2,880 (4명×6항목×120일) | ~150B | ~432KB |
| `chores` | 20 | ~140B | ~3KB |
| `members` | 4 | ~120B | ~0.5KB |
| `settlements` | 52 | ~250B | ~13KB |
| `household`+`settings` | 1 | ~250B | ~0.3KB |
| `report-unlocked` | 52 | ~15B | ~1KB |
| **합계** | | | **~450KB** |

- 120일 자동 정리(F1 AC-7)로 상한이 고정된다. 설정 화면의 "오래된 기록 정리"는 30일 초과 레코드를 삭제한다.

---

## API Contract

**MVP에는 외부 API 호출이 없다.** 모든 계산과 저장은 클라이언트 로컬에서 수행되므로 CORS 이슈가 발생하지 않는다(검수 AC: 네트워크 요청 0건 — `fetch`/`XMLHttpRequest` 호출이 앱 코드에서 0건이며, 유일한 외부 통신은 토스 SDK의 광고 로딩이다).

향후 멤버 간 실시간 동기화가 필요할 경우(Open Question O-1) 별도 Railway 배포 API 서버를 다음 계약으로 설계한다 — **MVP 범위 밖**.

```ts
// POST /households/:inviteCode/checkins
interface SyncCheckInRequest {
  date: string;        // "YYYY-MM-DD"
  choreId: string;
  memberId: string;
  weightAtLog: 1 | 2 | 3;
}
interface SyncCheckInResponse {
  id: string;
  syncedAt: string;    // ISO8601
}
// errors: 400 { error: "invalid_payload" } | 404 { error: "household_not_found" } | 409 { error: "duplicate_checkin" } | 500 { error: "internal_error" }
```
- 통합 에러 형태: `{ error: string }`.

---

## 검수 준수 체크리스트 (전 화면 공통 AC)

- **CK-1 [W][P0]: Scenario: 외부 도메인 이탈 차단**
  - Given 앱 전체 소스에서
  - Then `window.open(` 호출 0건, `window.location.href =` 할당 0건, `<a href="http...` 외부 링크 0건이며, 앱 내 이동은 모두 `react-router-dom`의 `navigate()`를 사용함

- **CK-2 [U][P0]:** The system shall produce zero `console.error` output in a production build — `npm run build` 후 전체 플로우(온보딩 → 체크인 → 리포트 → 정산 → 설정) 실행 시 `console.error` 호출 0건.

- **CK-3 [U][P0]:** The system shall make zero cross-origin `fetch`/`XMLHttpRequest` calls from app code — CORS 에러 0건.

- **CK-4 [U][P0]:** The system shall target Android 7+ / iOS 16+ — Vite `build.target === 'es2019'`이며 `Array.prototype.at`, `Object.groupBy`, `structuredClone`, `Array.prototype.findLast` 사용 0건.

- **CK-5 [W][P0]:** The system shall never prompt app installation — `"설치"`, `"다운로드"`, `"앱스토어"`, `"Play 스토어"` 문구와 스토어 링크가 UI에 0건.

- **CK-6 [W][P0]:** The system shall never link to external web/app destinations — 법률 고지·공공기관 링크를 포함해 MVP에는 외부 링크가 0건.

- **CK-7 [W][P0]:** The system shall never use external analytics — `google-analytics`, `gtag`, `amplitude`, `mixpanel`, `sentry` 관련 import 및 스크립트 태그 0건.

- **CK-8 [W][P0]:** The system shall never hardcode HEX colors — 소스 전체에서 `/#[0-9a-fA-F]{3,8}\b/` 매칭 0건, 다크모드에서 모든 텍스트/배경 대비가 TDS 토큰 기본값으로 유지됨.

- **CK-9 [U][P0]:** The system shall not call `grantPromotionReward` in MVP — 호출 0건. (향후 도입 시 `amount ≤ 5000` 검증 필수.)

- **CK-10 [U][P0]:** The system shall not use non-TDS UI libraries — `package.json` dependencies에 `@mui/*`, `antd`, `@chakra-ui/*`, `shadcn` 관련 패키지 0건.

- **CK-11 [U][P1]:** 모든 인터랙티브 요소(버튼/칩/스위치/탭/리스트 행)의 렌더 크기가 최소 44×44px 이상이다.

- **CK-12 [U][P0]:** 광고 ID는 `import.meta.env.VITE_TOSS_AD_GROUP_ID`(배너), `import.meta.env.VITE_TOSS_AD_SLOT_ID`(리워드)로만 참조하며 소스에 리터럴 ID 하드코딩 0건.

---

## Assumptions

1. **A-1.** MVP는 기기 로컬 단독 동작이다. "동거인 초대"는 초대 코드 표시/복사와 로컬 멤버 등록까지만 지원하며, 두 기기 간 실시간 데이터 동기화는 제공하지 않는다(한 기기에서 두 사람 분을 기록하는 "공용 기록" 모델). PRD의 "실시간 반영"은 동일 기기 내 즉시 반영으로 해석한다.
2. **A-2.** PRD의 "매일 체크인 리마인더"는 푸시 알림 없이 인앱 배너로 구현한다(MVP 제약: 푸시 알림 미사용).
3. **A-3.** "소액 벌금 정산"은 금액 제안만 제공하며 실제 송금·결제 기능은 포함하지 않는다(IAP 미사용).
4. **A-4.** 공정성 점수 공식은 가중 기여 비중 격차 기반(`Math.round(100 - (max - min))`, 단일 반올림)으로 정의한다. PRD에 구체 공식이 없어 본 SPEC에서 확정한다.
5. **A-5.** 가구 인원 상한 4명, 집안일 항목 상한 20개는 1-2인 가구 타깃과 localStorage 용량을 근거로 본 SPEC에서 확정한다.
6. **A-6.** 시간대는 `Asia/Seoul` 고정이며 기기 시간을 신뢰한다.
7. **A-7.** `SummaryHero`, `Sparkline`, `MiniBar`, `ScreenScaffold`, `SubmitFooter`, `FloatingTabBar`는 템플릿 제공 프로젝트 로컬 컴포넌트이며 신규 설계 대상이 아니다.
8. **A-8.** 수익화는 배너 + 리워드 광고만 사용한다(PRD Monetization: ads).

## Open Questions

1. **O-1.** 두 기기 간 실시간 동기화가 필요한가? 필요하다면 별도 Railway API 서버 + 초대 코드 기반 가구 조인이 필요하다(현재 API Contract 초안 참고). MVP 이후 판단.
2. **O-2.** 벌금 부담 배분 규칙 — 현재는 "미이행 벌금 총액을 기여도 역순으로 배분"이다. "미이행 항목별로 담당자를 지정"하는 방식(항목별 당번 배정)이 더 공정한지 사용자 검증 필요.
3. **O-3.** 주간 리포트 리워드 광고 게이트를 "주 1회"로 둘지, "주별 개별 해제"로 둘지 — 현재 SPEC은 주별 개별 해제(해제한 주는 영구 무료 열람).
4. **O-4.** 스트릭 기준이 "가구 전체 체크인"인지 "개인 체크인"인지 — 현재 SPEC은 개인(본인) 기준.
5. **O-5.** 리마인더 시간 기본값 21시가 적절한가? 사용자 조사 필요.