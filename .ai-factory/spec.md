# SPEC — choresplit

> 동거인과 집안일 기여도를 매일 기록해 공정하게 정산해주는 가사분담 트래커
> Platform: 앱인토스 (Vite + React + TypeScript + TDS + React Router + localStorage)

---

## Common Principles

### 기술 원칙
1. **UI는 100% TDS (`@toss/tds-mobile`)**. shadcn/ui, MUI, Ant Design, Chakra 사용 금지. 하단 탭 네비게이션은 템플릿 제공 `src/components/FloatingTabBar` 사용(TDS에 TabBar 없음). 상단 콘텐츠 전환만 TDS `Tab`.
2. **여백은 TDS `Spacing`(size 필수)으로만 조절**. TDS 컴포넌트의 내장 padding/margin을 Tailwind·인라인 스타일로 덮어쓰지 않는다. 커스텀 CSS는 flex/grid 배치에만 허용.
3. **색상 하드코딩 금지**. `#FFFFFF`, `#333` 등 HEX 직접 사용 금지 → `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값. 다크모드 필수 지원.
4. **모든 화면은 `ScreenScaffold`(템플릿 페이지 골격)로 감싼다.** raw `<div>` 골격 금지. 1차 액션은 하단 고정 `SubmitFooter` 또는 `display="block"` 버튼(좌측 글자폭 버튼 금지).
5. **모든 터치 타겟 ≥ 44×44px** (TDS `ListRow`, `Button` 기본 높이 사용 시 충족).
6. **인증 없음**. 토스 앱이 세션을 자동 제공. 로그인 함수 호출 없음. 구성원 식별이 필요한 경우 `getIsTossLoginIntegratedService()`로 연동 여부만 확인.
7. **서버 없음**. 모든 데이터는 localStorage. 외부 API 호출 0건 (F4 공유 코드는 클라이언트 인코딩/디코딩).
8. **결제 없음**. 벌금은 앱 내 기록·정산 "제안"일 뿐 실제 송금/IAP를 수행하지 않는다. `TossPurchase` 미사용.
9. **광고**: 배너 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`, 리워드 게이트 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`. 광고는 콘텐츠 위에 겹치지 않고 섹션 사이/결과 하단에만 배치.
10. **AI 미사용**. 공정성 점수·정산 제안은 전부 결정론적 산술 규칙(본 문서 §계산 규칙)으로 계산한다. 따라서 생성형 AI 고지 의무 대상이 아니며 "AI가 생성한 결과입니다" 라벨을 표시하지 않는다. (규칙 변경으로 AI 도입 시 고지 AC 추가 필요 — Open Questions Q3)
11. **외부 이탈 금지**. `window.open`, `window.location.href`로 외부 URL 이동 금지. 앱 설치 유도 문구/배너 금지. 외부 분석 SDK(GA, Amplitude 등) 금지.
12. **호환성**: Android 7+, iOS 16+. `Array.prototype.at`, `Object.groupBy`, `structuredClone`, `Intl.Segmenter`, CSS `:has()` 사용 금지. 날짜는 `Date` + 자체 유틸(`date-fns` 미사용 가능하나 사용 시 ES5 타깃 번들 확인).

### 계산 규칙 (전 기능 공통 · 순수 함수, `src/domain/*.ts`)

| 규칙 | 정의 |
|---|---|
| 주 경계 | 월요일 00:00 ~ 일요일 23:59:59 (KST 고정, `weekKey = "YYYY-Www"`) |
| 로그 가중치 | `weight = task.difficulty` (1=쉬움, 2=보통, 3=힘듦) |
| 구성원 기여 | `weight_i = Σ(해당 주 · 해당 구성원 로그의 weight)` |
| 기여율 | `share_i = weight_i / totalWeight` (totalWeight=0이면 전원 0) |
| 목표 지분 | `target_i = member.targetShare` (기본 `1 / memberCount`, 합계 1.0) |
| **공정성 점수** | `fairness = max(0, Math.round(100 - Σ_i |share_i - target_i| × 100))` |
| 예) 2인 60:40, 목표 50:50 | Σ\|diff\| = 0.1+0.1 = 0.2 → **80점** |
| 미이행 건수 | 해당 주 각 날짜 d에 대해, `task.repeatDays.includes(weekday(d)) && task.assigneeId === m.id && 해당 (taskId,memberId,date) 로그 없음` 인 건수 |
| 벌금 | `fine_i = Σ(미이행 건 × task.fineAmount)` |
| 정산 제안 | 2인 기준 `net = fine_A - fine_B`; `net > 0` → "A가 B에게 `net`원", `net === 0` → "정산할 금액이 없어요" |
| 스트릭 | 구성원별 로그가 1건 이상 있는 날이 오늘(또는 어제)부터 역순으로 연속된 일수. 오늘 로그가 없으면 어제까지의 연속 일수를 유지하고 오늘 자정 경과 시 0으로 리셋 |
| 랭킹 | 해당 주 `weight_i` 내림차순, 동점 시 로그 건수 내림차순, 그래도 동점이면 `member.createdAt` 오름차순 |

---

## Data Models

### Household (가구)
```ts
export interface Household {
  id: string;              // "hh_" + 8자리 base36, 생성 시 1회 발급
  name: string;            // 1~20자, 예: "우리집"
  createdAt: number;       // epoch ms
  members: Member[];       // 길이 1~4 (MVP 상한 4)
}

export interface Member {
  id: string;              // "mb_" + 8자리 base36
  name: string;            // 1~10자, 가구 내 중복 불가
  emoji: string;           // 1글자 이모지, 기본 "🙂"
  targetShare: number;     // 0.1 ~ 0.9, 가구 합계 1.0 (±0.01 허용)
  createdAt: number;
}
```

### ChoreTask (집안일 항목)
```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=일 … 6=토
export type Difficulty = 1 | 2 | 3;

export interface ChoreTask {
  id: string;              // "tk_" + 8자리 base36
  name: string;            // 1~16자, 예: "설거지"
  emoji: string;           // 1글자, 기본 "🧹"
  difficulty: Difficulty;  // 가중치
  repeatDays: Weekday[];   // 빈 배열 = 반복 없음(수시 항목)
  assigneeId: string | null; // 담당자 memberId, null = 공동
  fineAmount: number;      // 0 ~ 10000, 100원 단위, 기본 0
  archived: boolean;       // true면 목록/체크인에서 숨김(로그는 보존)
  updatedAt: number;
}
```

### ChoreLog (체크인 로그)
```ts
export interface ChoreLog {
  id: string;              // "lg_" + `${date}_${taskId}_${memberId}` 해시(멱등)
  date: string;            // "YYYY-MM-DD" (KST)
  taskId: string;
  memberId: string;
  weight: Difficulty;      // 기록 시점의 task.difficulty 스냅샷
  createdAt: number;
}
```

### AppSettings
```ts
export interface AppSettings {
  activeMemberId: string | null; // 현재 기기에서 기록 중인 구성원
  reminderEnabled: boolean;      // 기본 true
  reminderTime: string;          // "HH:mm", 기본 "21:00"
  onboardingDone: boolean;       // 기본 false
  lastReportWeekKey: string | null; // 리워드 광고 해제 캐시용
  reportUnlockedWeeks: string[];    // 광고 시청으로 해제된 weekKey 목록(최대 12개 유지)
}
```

### localStorage 키 / 형태 / 용량

| 키 | 값 shape | 예상 크기 | 상한 정책 |
|---|---|---|---|
| `choresplit:household:v1` | `Household` | ~600B (4인) | — |
| `choresplit:tasks:v1` | `ChoreTask[]` | ~200B × 30 = 6KB | 항목 최대 30개 |
| `choresplit:logs:v1` | `ChoreLog[]` | ~130B × 최대 8,000 = **~1.0MB** | 최근 **180일** 초과 로그는 저장 시 자동 삭제(pruneLogs) |
| `choresplit:settings:v1` | `AppSettings` | ~300B | `reportUnlockedWeeks` 12개 초과 시 오래된 것부터 제거 |
| `choresplit:schema:v1` | `{ version: 1 }` | ~20B | 마이그레이션 판별용 |

**총 예상 최대 ≈ 1.1MB (< 5MB)**. 모든 쓰기는 `storage.ts`의 `safeSet<T>(key, value): { ok: true } | { ok: false; reason: 'quota' | 'serialize' }` 를 경유하며, `QuotaExceededError` 발생 시 180일 → 90일로 prune 후 1회 재시도한다.

---

## Feature List

### F1. 데이터 저장소 계층 & 온보딩

- **Description**: localStorage 읽기/쓰기 래퍼(`storage.ts`), 도메인 순수 함수(`fairness.ts`, `fine.ts`, `streak.ts`), 그리고 최초 실행 시 가구 이름·구성원(1~4명)을 등록하는 온보딩 화면을 제공한다. 온보딩 완료 시 기본 집안일 6종(설거지·청소·빨래·분리수거·요리·화장실청소)이 자동 시딩된다. 이후 모든 기능은 이 저장소 계층만 통해 데이터에 접근한다.
- **Data**: `Household`, `Member`, `ChoreTask`, `AppSettings`, `choresplit:schema:v1`
- **API**: 없음 (전부 로컬)
- **Requirements**: 저장 실패는 조용히 무시하지 않고 사용자에게 노출한다. 스키마 버전 불일치 시 데이터를 파괴하지 않는다.

**Acceptance Criteria**

- **AC-1 [E][P0]: Scenario: 온보딩 완료 시 가구 생성 + 기본 항목 시딩**
  Given `choresplit:household:v1`가 없는 최초 실행 상태일 때
  When `/onboarding`에서 `{ name: "우리집", members: [{name:"민지",emoji:"🐰"},{name:"현우",emoji:"🐻"}] }` 입력 후 "시작하기" 탭
  Then `choresplit:household:v1`에 `members.length === 2`, 각 `targetShare === 0.5`인 Household가 저장됨
  And `choresplit:tasks:v1`에 기본 항목 6개(설거지·청소·빨래·분리수거·요리·화장실청소)가 저장됨
  And `choresplit:settings:v1.onboardingDone === true`, `activeMemberId`가 첫 구성원 id로 설정됨
  And `/`(홈)으로 `navigate('/', { replace: true })` 이동

- **AC-2 [S][P0]: Scenario: 온보딩 미완료 시 강제 리다이렉트**
  Given `settings.onboardingDone === false`인 상태에서
  When 사용자가 `/`, `/tasks`, `/report`, `/ranking`, `/settle` 중 아무 경로로 진입할 때
  Then 즉시 `/onboarding`으로 `replace` 이동되고 FloatingTabBar는 렌더링되지 않음

- **AC-3 [W][P1]: Scenario: 구성원 이름 중복/공백 거부**
  Given 온보딩 폼에 구성원 2명이 있을 때
  When `{ members: [{name:"민지"},{name:"민지"}] }` 로 "시작하기" 탭
  Then 에러 메시지 "이름이 중복돼요"가 표시되고 저장이 수행되지 않음
  And `{ members: [{name:""},{name:"현우"}] }` 제출 시 "이름을 입력해주세요" 표시

- **AC-4 [W][P1]: Scenario: localStorage 용량 초과 처리**
  Given `safeSet` 호출 시 `QuotaExceededError`가 발생할 때
  When 저장 재시도(180일 → 90일 prune)마저 실패하면
  Then Toast "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"가 표시되고
  And `console.error`는 호출하지 않으며 앱은 크래시 없이 이전 화면 상태를 유지함

- **AC-5 [W][P1]: Scenario: 손상된 JSON 복구**
  Given `choresplit:logs:v1`의 값이 `"{{{"` 처럼 파싱 불가일 때
  When 앱이 부팅되어 로그를 읽을 때
  Then `JSON.parse` 예외를 잡아 빈 배열 `[]`을 반환하고, 원본 값을 `choresplit:logs:v1.corrupt`로 백업한 뒤
  And 홈에 Toast "일부 기록을 읽지 못했어요"를 1회 표시함 (앱 크래시 없음)

- **AC-6 [U][P1]: Scenario: 부팅 로딩 상태**
  Given 앱이 저장소를 읽는 동안
  Then 각 화면은 TDS `Skeleton` 기반 로딩 뷰(`data-testid="boot-skeleton"`)를 표시하고, 읽기 완료 후 200ms 이내에 실제 콘텐츠로 교체됨

- **AC-7 [U][P0]: Scenario: 공정성 점수 순수 함수 검증**
  Given `calcFairness([{memberId:"a",weight:6},{memberId:"b",weight:4}], {a:0.5,b:0.5})` 호출
  Then 반환값 `{ fairness: 80, shares: { a: 0.6, b: 0.4 } }`
  And `totalWeight === 0`이면 `{ fairness: 0, shares: { a: 0, b: 0 }, isEmpty: true }` 반환

- **AC-8 [U][P2]: Scenario: 스키마 버전 보존**
  Given `choresplit:schema:v1`이 `{version:1}`이 아닌 값일 때
  Then 기존 키를 삭제하지 않고 읽기 전용으로 취급하며, 홈에 "기록 형식이 달라 일부 기능이 제한돼요" 안내 배너를 표시함

---

### F2. 집안일 항목 관리

- **Description**: 집안일 항목의 생성·수정·보관(archive)을 담당한다. 각 항목은 이름, 이모지, 난이도(1~3), 반복 요일, 담당자, 벌금액을 가지며 이 값들이 F3 체크인과 F5·F6 계산의 입력이 된다. 항목은 최대 30개까지 등록 가능하다.
- **Data**: `ChoreTask`, `Household.members`(담당자 선택)
- **API**: 없음
- **Requirements**: 항목 삭제 시 기존 로그는 절대 삭제하지 않는다(archive 처리).

**Acceptance Criteria**

- **AC-1 [E][P0]: Scenario: 항목 추가 성공**
  Given `/tasks`에서 "항목 추가" 버튼을 탭해 BottomSheet가 열렸을 때
  When `{ name: "설거지", emoji: "🍽️", difficulty: 2, repeatDays: [1,3,5], assigneeId: "mb_민지", fineAmount: 1000 }` 저장
  Then `choresplit:tasks:v1`에 항목이 추가되고 Toast "항목을 추가했어요" 표시
  And `/tasks` 목록 맨 위에 해당 ListRow가 나타남

- **AC-2 [E][P0]: Scenario: 항목 수정 시 updatedAt 갱신**
  Given `tk_1`의 `difficulty === 1`일 때
  When 편집 시트에서 `difficulty: 3`으로 변경 후 저장
  Then 저장된 `tk_1.difficulty === 3`, `updatedAt`이 이전 값보다 큼
  And 이미 기록된 과거 `ChoreLog.weight`는 변경되지 않음(스냅샷 유지)

- **AC-3 [E][P0]: Scenario: 항목 보관(삭제 대체)**
  Given `tk_1`에 로그 5건이 존재할 때
  When 항목 상세에서 "삭제" 탭 → TDS `AlertDialog` "기록은 남고 목록에서만 숨겨져요"에서 "숨기기" 확인
  Then `tk_1.archived === true`가 되고 홈 체크인 목록에서 사라짐
  And `choresplit:logs:v1`의 로그 5건은 그대로 유지됨

- **AC-4 [W][P1]: Scenario: 잘못된 입력 거부**
  Given 항목 추가 시트가 열려 있을 때
  When `{ name: "", difficulty: 2 }` 저장 → 에러 "항목 이름을 입력해주세요"
  And `{ name: "17자를넘어가는아주긴집안일이름입니다", ... }` 저장 → 에러 "16자 이내로 입력해주세요"
  And `{ name: "빨래", fineAmount: 12000 }` 저장 → 에러 "벌금은 10,000원 이하로 입력해주세요"
  Then 각 경우 저장이 수행되지 않고 시트가 닫히지 않음

- **AC-5 [W][P1]: Scenario: 항목 30개 상한**
  Given `archived === false`인 항목이 30개일 때
  When "항목 추가" 버튼 탭
  Then 버튼이 `disabled` 상태이고 하단에 "항목은 최대 30개까지 등록할 수 있어요" 문구가 표시됨

- **AC-6 [S][P1]: Scenario: 빈 목록 상태**
  Given 모든 항목이 `archived === true`일 때
  When `/tasks` 진입
  Then `data-testid="tasks-empty"` 영역에 TDS `Asset.ContentIcon`과 "등록된 집안일이 없어요" + `display="block"` "항목 추가하기" 버튼이 표시됨

- **AC-7 [U][P2]: Scenario: 난이도 표기**
  Given 항목 목록이 렌더링될 때
  Then 각 ListRow 우측에 난이도 Chip이 `1 → "쉬움"`, `2 → "보통"`, `3 → "힘듦"` 텍스트로 표시됨

---

### F3. 오늘의 체크인 (홈)

- **Description**: 홈 화면에서 오늘 날짜 기준으로 활성 구성원이 수행한 집안일을 탭 한 번으로 기록/취소한다. 상단에는 오늘 획득 가중치와 누적 스트릭이 히어로로 표시되고, 하단에는 항목별 체크 리스트가 놓인다. 구성원 전환은 상단 세그먼트로 즉시 가능하다.
- **Data**: `ChoreLog`(생성/삭제), `ChoreTask`(목록), `AppSettings.activeMemberId`
- **API**: 없음
- **Requirements**: 체크인은 `(date, taskId, memberId)` 기준 멱등. 오늘 이전 날짜는 최대 7일 전까지 소급 기록 가능.

**Acceptance Criteria**

- **AC-1 [E][P0]: Scenario: 체크인 기록 성공**
  Given `activeMemberId === "mb_민지"`, 오늘이 `2026-09-02`, 항목 `tk_설거지(difficulty:2)`가 미체크일 때
  When 홈에서 `data-testid="chore-check-row-tk_설거지"` 행의 체크 버튼 탭
  Then `choresplit:logs:v1`에 `{ date:"2026-09-02", taskId:"tk_설거지", memberId:"mb_민지", weight:2 }` 로그가 1건 추가되고
  And 행이 체크 상태로 바뀌며 Toast "설거지 완료!" 표시
  And 상단 `data-testid="today-summary-hero"`의 오늘 점수가 CountUp으로 `+2` 증가함

- **AC-2 [E][P0]: Scenario: 체크인 취소(토글)**
  Given 위 로그가 존재하는 상태에서
  When 같은 행의 체크 버튼을 다시 탭
  Then 해당 로그 1건이 삭제되고 오늘 점수가 `-2` 감소하며 Toast "기록을 취소했어요" 표시

- **AC-3 [W][P1]: Scenario: 중복 체크인 방지 (멱등)**
  Given 동일 `(2026-09-02, tk_설거지, mb_민지)` 로그가 이미 있을 때
  When 더블탭 등으로 추가 기록 요청이 발생하면
  Then 로그 배열 길이는 증가하지 않고(정확히 1건 유지), 에러 Toast도 표시하지 않음

- **AC-4 [E][P0]: Scenario: 구성원 전환**
  Given 홈 상단 구성원 세그먼트에 `민지 / 현우`가 있을 때
  When "현우" 탭
  Then `settings.activeMemberId === "mb_현우"`로 저장되고 체크 상태가 현우 기준으로 300ms 이내 재계산되어 표시됨

- **AC-5 [W][P1]: Scenario: 소급 기록 범위 제한**
  Given 홈 상단 날짜 선택에서 오늘로부터 8일 전 날짜를 선택했을 때
  Then 체크 버튼이 모두 `disabled`가 되고 "7일 이내 기록만 수정할 수 있어요" 안내가 표시됨

- **AC-6 [S][P1]: Scenario: 빈 상태 / 전부 완료 상태**
  Given 등록된 활성 항목이 0개일 때 → `data-testid="home-empty"`에 `Asset.ContentIcon` + "집안일을 먼저 등록해주세요" + "항목 등록하기" 버튼(`navigate('/tasks')`)
  And 오늘 모든 항목이 체크된 경우 → 리스트 하단에 "오늘 할 일 다 했어요 🎉" 문구가 표시됨

- **AC-7 [U][P1]: Scenario: 홈 레이아웃 계약**
  Given 홈이 렌더링될 때
  Then `ScreenScaffold` 안에 (1) `data-testid="today-summary-hero"` SummaryHero(오늘 가중치 CountUp + 스트릭 배지), (2) `data-testid="week-sparkline"` Sparkline(최근 7일 일별 가중치), (3) 항목 체크 `Card`가 이 순서로 존재하며, 모든 체크 행의 클릭 영역 높이는 ≥ 44px임

- **AC-8 [U][P2]: Scenario: 배너 광고 배치**
  Given 홈이 렌더링될 때
  Then `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`가 체크 리스트 Card **아래**, FloatingTabBar와 겹치지 않는 위치에 1개만 렌더링됨

---

### F4. 동거인 초대 & 공유 코드 병합

- **Description**: 서버 없이 두 기기의 기록을 합치기 위해 가구·항목·로그 스냅샷을 base64url 문자열("CS1-" 접두)로 내보내고, 상대 기기에서 붙여넣어 병합한다. 병합은 id 기준 합집합이며 충돌 시 `updatedAt`이 큰 쪽이 승리한다. 초대 코드는 앱 내 복사 버튼으로만 전달하며 외부 링크·앱 설치 유도를 하지 않는다.
- **Data**: `Household`, `ChoreTask[]`, `ChoreLog[]`
- **API**: 없음 (클라이언트 인코딩)
- **Requirements**: 병합은 파괴적이지 않아야 하며, 병합 전 스냅샷을 `choresplit:backup:v1`에 1개 보관한다.

**Acceptance Criteria**

- **AC-1 [E][P0]: Scenario: 공유 코드 생성 및 복사**
  Given `/invite`에서 구성원 2명·항목 6개·로그 20건이 있을 때
  When "코드 만들기" 버튼 탭
  Then `CS1-`로 시작하는 base64url 문자열이 `data-testid="share-code-box"`에 표시되고
  And "복사하기" 탭 시 `navigator.clipboard.writeText` 성공 후 Toast "코드를 복사했어요" 표시

- **AC-2 [E][P0]: Scenario: 코드 병합 성공**
  Given 내 기기 로그가 20건이고, 붙여넣은 코드에 로그 30건(그중 12건은 동일 id)이 들어 있을 때
  When "합치기" 버튼 탭 → AlertDialog "기존 기록에 상대방 기록을 합칠까요?"에서 "합치기" 확인
  Then 최종 로그 건수는 `20 + 30 - 12 = 38`건이 되고 Toast "38건의 기록을 합쳤어요" 표시
  And 동일 id 항목은 `updatedAt`이 큰 쪽 값으로 덮어써짐
  And 병합 직전 상태가 `choresplit:backup:v1`에 저장됨

- **AC-3 [W][P1]: Scenario: 잘못된 코드 거부**
  Given `/invite` 붙여넣기 필드에
  When `"hello world"` 입력 후 "합치기" 탭 → 에러 "코드 형식이 올바르지 않아요"
  And `"CS1-" + "!!!!"` (base64 디코딩 실패) 입력 → 에러 "코드가 손상됐어요. 다시 복사해주세요"
  Then 어느 경우에도 기존 localStorage 데이터는 변경되지 않음

- **AC-4 [W][P1]: Scenario: 코드 길이 상한**
  Given 붙여넣은 코드 길이가 4,000자를 초과할 때
  When "합치기" 탭
  Then 에러 "기록이 너무 많아요. 상대방 앱 설정에서 오래된 기록을 정리한 뒤 다시 시도해주세요" 표시되고 병합이 중단됨

- **AC-5 [E][P1]: Scenario: 병합 되돌리기**
  Given 직전 병합이 수행되어 `choresplit:backup:v1`가 존재할 때
  When `/invite`의 "직전 합치기 되돌리기" 버튼 탭
  Then 백업 스냅샷으로 복원되어 로그 건수가 20건으로 돌아가고 Toast "되돌렸어요" 표시
  And 백업이 없으면 해당 버튼은 렌더링되지 않음

- **AC-6 [S][P1]: Scenario: 병합 진행 상태**
  Given "합치기"를 확인한 직후
  Then 버튼이 TDS `Button` `loading` 상태로 바뀌고 중복 탭이 차단되며, 완료 후 원상 복구됨

- **AC-7 [W][P0]: Scenario: 외부 이탈 금지**
  Given `/invite` 화면의 어떤 요소를 탭하더라도
  Then `window.open` 또는 `window.location.href`를 통한 외부 도메인 이동이 발생하지 않고, "앱 설치", "다운로드" 문구가 화면에 존재하지 않음

---

### F5. 주간 공정성 리포트 (리워드 광고 게이트)

- **Description**: 선택한 주(기본: 이번 주)의 공정성 점수, 구성원별 기여율, 항목별·요일별 분포를 보여주는 핵심 가치 화면이다. 요약(점수 1개)은 무료로 노출하고, 상세 리포트는 `TossRewardAd` 시청 후 해당 주(weekKey) 단위로 해제된다. 해제 상태는 `settings.reportUnlockedWeeks`에 저장되어 같은 주 재방문 시 광고를 다시 보지 않는다.
- **Data**: `ChoreLog`, `ChoreTask`, `Household.members`, `AppSettings.reportUnlockedWeeks`
- **API**: 없음
- **Requirements**: 점수 계산은 F1 `calcFairness` 순수 함수만 사용한다.

**Acceptance Criteria**

- **AC-1 [E][P0]: Scenario: 상세 리포트 리워드 광고 게이트**
  Given 이번 주 `weekKey === "2026-W36"`가 `settings.reportUnlockedWeeks`에 없을 때
  When 사용자가 `/report`에서 "상세 리포트 보기" 버튼 탭
  And `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 광고 시청이 완료되면
  Then 상세 리포트(`data-testid="report-detail"`)가 표시되고 `reportUnlockedWeeks`에 `"2026-W36"`이 추가됨

- **AC-2 [S][P0]: Scenario: 해제된 주 재방문**
  Given `reportUnlockedWeeks`에 `"2026-W36"`이 포함된 상태에서
  When `/report?week=2026-W36` 진입
  Then 광고 없이 즉시 상세 리포트가 표시되고 "상세 리포트 보기" 버튼은 렌더링되지 않음

- **AC-3 [U][P0]: Scenario: 공정성 점수 정확성**
  Given 이번 주 로그가 민지 weight합 6, 현우 weight합 4이고 `targetShare`가 각 0.5일 때
  When `/report` 진입
  Then `data-testid="fairness-hero"`에 `80`이 CountUp으로 표시되고
  And 구성원 카드에 "민지 60%", "현우 40%"가 표시됨

- **AC-4 [U][P0]: Scenario: 리포트 레이아웃 계약**
  Given 상세 리포트가 표시될 때
  Then `ScreenScaffold` 안에 (1) `data-testid="fairness-hero"` SummaryHero(점수 CountUp + 등급 배지: 90↑ "완벽", 70~89 "양호", 40~69 "주의", 40미만 "불균형"), (2) `data-testid="member-card-{memberId}"` Card가 구성원 수만큼, (3) `data-testid="category-minibar"` MiniBar(항목별 기여 비율), (4) `data-testid="weekly-sparkline"` Sparkline(요일별 총 가중치 7포인트)이 존재함
  And 구성원 카드의 기여율 수치는 t2~t3 강조 타이포로 표기됨

- **AC-5 [S][P1]: Scenario: 기록 없는 주 (빈 상태)**
  Given 선택한 주의 로그가 0건일 때
  When `/report` 진입
  Then 광고 게이트 없이 `data-testid="report-empty"`에 `Asset.ContentIcon` + "이번 주 기록이 아직 없어요" + "체크인하러 가기" 버튼(`navigate('/')`)이 표시되고, `fairness-hero`는 렌더링되지 않음

- **AC-6 [W][P1]: Scenario: 광고 로드 실패**
  Given 리워드 광고 로드/노출이 실패했을 때
  When 실패 콜백이 호출되면
  Then Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"가 표시되고 버튼이 재시도 가능한 상태로 복귀하며
  And `reportUnlockedWeeks`는 변경되지 않고 `console.error`는 호출되지 않음

- **AC-7 [W][P1]: Scenario: 광고 중도 이탈**
  Given 사용자가 리워드 광고를 끝까지 보지 않고 닫았을 때
  Then 상세 리포트는 표시되지 않고 요약 화면이 유지되며 Toast "끝까지 시청해야 리포트가 열려요" 표시

- **AC-8 [E][P2]: Scenario: 이전 주 탐색**
  Given `/report`에 주 이동 컨트롤이 있을 때
  When "이전 주" 탭
  Then `weekKey`가 1주 감소하며 URL이 `/report?week=2026-W35`로 바뀌고, 최대 12주 이전까지만 이동 가능(그 이상은 버튼 `disabled`)

---

### F6. 벌금 설정 & 정산 제안

- **Description**: 항목별 `fineAmount`와 반복 요일·담당자 설정을 근거로, 해당 주 미이행 건수를 집계해 구성원별 벌금과 순정산액을 계산해 보여준다. 실제 송금·결제는 수행하지 않으며 "누가 누구에게 얼마"라는 제안 문구와 미이행 상세 목록만 제공한다.
- **Data**: `ChoreLog`, `ChoreTask`(repeatDays, assigneeId, fineAmount), `Household.members`
- **API**: 없음
- **Requirements**: 벌금이 설정된 항목이 하나도 없으면 화면은 설정 유도 상태를 보여준다.

**Acceptance Criteria**

- **AC-1 [U][P0]: Scenario: 미이행 벌금 계산**
  Given 이번 주에 `tk_설거지(repeatDays:[1,3,5], assigneeId:"mb_민지", fineAmount:1000)`가 있고 월·수요일만 체크인되었을 때
  When `/settle` 진입
  Then 민지 미이행 1건, 민지 벌금 `1,000원`이 `data-testid="fine-list-row-mb_민지"`에 표시됨

- **AC-2 [U][P0]: Scenario: 순정산 제안 문구**
  Given 민지 벌금 3,000원, 현우 벌금 0원일 때
  Then `data-testid="settlement-card"`에 "민지님이 현우님에게 **3,000원**" 문구가 t2 강조 타이포로 표시되고, 금액은 `toLocaleString('ko-KR')` 형식(쉼표 포함)임

- **AC-3 [S][P0]: Scenario: 정산액 0원**
  Given 두 구성원의 벌금이 각각 2,000원으로 동일할 때
  Then `settlement-card`에 "정산할 금액이 없어요"가 표시되고 송금 유도 문구·외부 링크는 표시되지 않음

- **AC-4 [W][P1]: Scenario: 벌금 미설정 (빈 상태)**
  Given 모든 활성 항목의 `fineAmount === 0`일 때
  When `/settle` 진입
  Then `data-testid="settle-empty"`에 `Asset.ContentIcon` + "벌금이 설정된 항목이 없어요" + `display="block"` "항목에서 벌금 설정하기" 버튼(`navigate('/tasks')`)이 표시됨

- **AC-5 [W][P1]: Scenario: 담당자 없는 항목 제외**
  Given `assigneeId === null`(공동 항목)이고 `fineAmount === 2000`인 항목이 미이행일 때
  Then 해당 항목은 벌금 계산에서 제외되고, 하단 안내 "담당자가 없는 항목은 벌금에서 제외돼요"가 표시됨

- **AC-6 [U][P1]: Scenario: 미이행 상세 목록**
  Given 미이행 건이 3건일 때
  Then 각 건이 TDS `ListRow`로 "09/01(월) · 설거지 · 민지 · 1,000원" 형식으로 표시되고 행 높이 ≥ 44px임

- **AC-7 [W][P2]: Scenario: 3인 이상 가구 처리**
  Given 구성원이 3명 이상일 때
  Then 순정산 2자 매칭 대신 구성원별 벌금 합계 목록만 표시하고 "3인 이상 가구는 개인별 금액만 안내해요" 문구가 표시됨

- **AC-8 [U][P2]: Scenario: 배너 광고 배치**
  Given `/settle`이 렌더링될 때
  Then `<AdSlot />`이 미이행 상세 목록 **아래**에 1개 렌더링되고, `settlement-card`를 가리지 않음

---

### F7. 스트릭 & 랭킹 게임화

- **Description**: 구성원별 연속 체크인 일수(스트릭)와 이번 주 기여 랭킹을 보여준다. 스트릭 7일·30일 달성 시 배지를 부여하고, 랭킹 1위에게 왕관 표기를 한다. 순수 계산 결과만 표시하며 별도 저장 데이터는 로그에서 파생한다.
- **Data**: `ChoreLog`(파생), `Household.members`
- **API**: 없음
- **Requirements**: 스트릭·랭킹 값은 저장하지 않고 렌더 시 로그에서 계산한다(중복 진실 원천 방지).

**Acceptance Criteria**

- **AC-1 [U][P0]: Scenario: 스트릭 계산**
  Given 민지의 로그가 `2026-08-31, 2026-09-01, 2026-09-02`에 각 1건 이상 있고 오늘이 `2026-09-02`일 때
  When `/ranking` 진입
  Then `data-testid="streak-hero"`에 `3`일이 CountUp으로 표시됨

- **AC-2 [U][P0]: Scenario: 스트릭 끊김**
  Given 민지의 마지막 로그가 `2026-08-30`이고 오늘이 `2026-09-02`일 때
  Then 스트릭은 `0`으로 표시되고 "오늘 체크인하면 다시 시작돼요" 문구가 표시됨

- **AC-3 [U][P0]: Scenario: 주간 랭킹 정렬**
  Given 이번 주 weight합이 민지 6, 현우 4일 때
  Then `data-testid="rank-row-mb_민지"`가 1위(👑 배지 포함), `data-testid="rank-row-mb_현우"`가 2위로 렌더링되고, 각 행에 `MiniBar`로 상대 비율(100%, 67%)이 표시됨

- **AC-4 [U][P1]: Scenario: 동점 처리**
  Given 민지·현우의 weight합이 모두 4이고 로그 건수가 민지 2건, 현우 4건일 때
  Then 현우가 1위(로그 건수 내림차순), 민지가 2위로 표시되고 두 행 모두 👑는 1위에만 표시됨

- **AC-5 [S][P1]: Scenario: 이번 주 기록 없음 (빈 상태)**
  Given 이번 주 로그가 0건일 때
  Then `data-testid="ranking-empty"`에 `Asset.ContentIcon` + "이번 주 기록이 없어요"가 표시되고 순위 행은 렌더링되지 않음

- **AC-6 [E][P2]: Scenario: 배지 획득 표시**
  Given 스트릭이 7일에 도달했을 때
  When `/ranking` 진입
  Then "7일 연속 달성 🔥" Chip이 `streak-hero` 하단에 표시되고, 30일 도달 시 "30일 연속 🏆" Chip으로 대체됨

- **AC-7 [W][P1]: Scenario: 미래 날짜 로그 무시**
  Given 기기 시간 변경 등으로 오늘보다 미래인 `date`의 로그가 존재할 때
  Then 해당 로그는 스트릭·랭킹 계산에서 제외되고 앱은 예외 없이 렌더링됨

---

### F8. 체크인 리마인더 (인앱) & 설정

- **Description**: 푸시 알림 없이, 설정한 시각 이후 앱에 진입했을 때 오늘 체크인이 0건이면 홈 상단에 리마인더 배너를 노출한다. 설정 화면에서는 리마인더 on/off·시각, 구성원 목표 지분, 오래된 기록 정리, 전체 초기화를 제공한다.
- **Data**: `AppSettings`, `Member.targetShare`, `ChoreLog`(정리)
- **API**: 없음
- **Requirements**: 푸시 알림 API·백그라운드 작업을 사용하지 않는다(MVP 범위 외).

**Acceptance Criteria**

- **AC-1 [S][P0]: Scenario: 리마인더 배너 노출**
  Given `settings.reminderEnabled === true`, `reminderTime === "21:00"`, 현재 시각 `21:30`, 활성 구성원의 오늘 로그 0건일 때
  When 홈에 진입
  Then `data-testid="reminder-banner"`에 "오늘 아직 체크인하지 않았어요"가 홈 최상단에 표시됨

- **AC-2 [S][P1]: Scenario: 배너 미노출 조건**
  Given 현재 시각이 `20:00`(리마인더 시각 이전)이거나 오늘 로그가 1건 이상일 때
  Then `data-testid="reminder-banner"`는 DOM에 존재하지 않음

- **AC-3 [E][P0]: Scenario: 리마인더 시각 변경**
  Given `/settings`에서 리마인더 시각 선택 BottomSheet를 열었을 때
  When `"08:30"` 선택 후 확인
  Then `settings.reminderTime === "08:30"`으로 저장되고 Toast "리마인더 시각을 변경했어요" 표시

- **AC-4 [E][P0]: Scenario: 목표 지분 조정**
  Given 구성원 2명의 `targetShare`가 각 0.5일 때
  When `/settings`에서 민지 지분을 `0.6`으로 조정
  Then 현우가 자동으로 `0.4`가 되어 합계 1.0이 유지되고 저장됨
  And 3인 이상 가구에서 합계가 1.0 ±0.01을 벗어나면 "지분 합이 100%가 되어야 해요" 에러 표시 후 저장이 차단됨

- **AC-5 [E][P1]: Scenario: 오래된 기록 정리**
  Given 로그 500건 중 180일 이전 로그가 120건일 때
  When "오래된 기록 정리" 탭 → AlertDialog 확인
  Then 로그가 380건으로 줄고 Toast "120건을 정리했어요" 표시

- **AC-6 [W][P0]: Scenario: 전체 초기화 오조작 방지**
  Given `/settings`에서 "전체 초기화" 탭
  When AlertDialog "모든 기록이 삭제돼요. 되돌릴 수 없어요"에서 "취소" 탭
  Then 어떤 localStorage 키도 삭제되지 않음
  And "삭제" 탭 시 `choresplit:*` 키가 모두 제거되고 `/onboarding`으로 `replace` 이동됨

- **AC-7 [U][P1]: Scenario: 설정 로딩 상태**
  Given 설정 값을 읽는 동안
  Then 각 `ListRow`의 우측 값 영역이 TDS `Skeleton`으로 표시되고, 읽기 완료 시 실제 값으로 교체됨

- **AC-8 [W][P0]: Scenario: 검수 규칙 준수 (전역)**
  Given 프로덕션 빌드(`vite build`)로 앱을 실행하고 F1~F8의 주요 플로우를 1회씩 수행할 때
  Then `console.error` 호출 0건이며 CORS 에러 0건(외부 네트워크 요청 0건)이고
  And 소스 전체에 `#`으로 시작하는 HEX 색상 리터럴이 0개이며(`grep -rE "#[0-9a-fA-F]{3,8}" src/` 결과 없음), 색상은 `var(--tds-color-*)`/TDS 컴포넌트로만 지정됨
  And `window.open` / `window.location.href` 호출이 0건이고, 외부 분석 SDK(GA·Amplitude 등) 임포트가 0건임

---

## Screen Definitions

공통: 모든 화면은 `ScreenScaffold`로 감싸며 상단은 TDS `Top`(제목/뒤로가기), 1차 액션은 `SubmitFooter`(하단 고정) 또는 `display="block"` TDS `Button`. `/onboarding`을 제외한 모든 화면 하단에 템플릿 `FloatingTabBar`(홈 · 리포트 · 랭킹 · 설정) 노출. 라우터는 `react-router-dom` `BrowserRouter`.

### S1. 온보딩 — `/onboarding`
- **TDS 컴포넌트**: `Top`(타이틀 "우리집 만들기"), `TextField`(가구 이름, 구성원 이름 ×N), `Chip`(이모지 선택), `Button`(구성원 추가, secondary), `SubmitFooter` + `Button display="block"`("시작하기"), `Toast`, `Spacing`
- **로딩**: 저장 중 "시작하기" `Button loading`, 중복 탭 차단
- **빈 상태**: 최초 진입 시 구성원 입력 행 2개가 기본 제공(본인 + 동거인)
- **에러**: 필드 하단 `TextField` `error`/`helperText`로 "이름을 입력해주세요" / "이름이 중복돼요" 표시
- **터치**: 이모지 Chip 44×44px, 구성원 삭제 버튼 44×44px
- **키보드**: `TextField` 포커스 시 `scrollIntoView({ block: 'center' })`, `enterKeyHint="next"`, 마지막 필드는 `"done"`. 키보드 노출 시 `SubmitFooter`는 키보드 위로 밀림(`env(safe-area-inset-bottom)` + visualViewport 리사이즈 대응)
- **Navigation state contract**
  - Incoming: `location.state = undefined`
  - Outgoing: `navigate('/', { replace: true })` — state 없음
- **Layout contract**: `ScreenScaffold` > `Top` > 입력 `Card` 1개 > `SubmitFooter`. 구성원 입력은 `ListRow` 나열, raw div 골격 금지

### S2. 홈(오늘의 체크인) — `/`
- **TDS 컴포넌트**: `Top`, `Tab`(구성원 세그먼트), `Card`, `ListRow`(항목 행 + 우측 체크 컨트롤), `Chip`(난이도), `Badge`(스트릭), `Toast`, `Spacing`, `Skeleton`, `Asset.ContentIcon`(빈 상태)
- **커스텀 표현 컴포넌트**: `SummaryHero`(value=오늘 가중치, CountUp), `Sparkline`(최근 7일)
- **로딩**: `data-testid="boot-skeleton"` — 히어로 1개 + ListRow 5개 스켈레톤
- **빈 상태**: `data-testid="home-empty"` — `Asset.ContentIcon` + "집안일을 먼저 등록해주세요" + `display="block"` "항목 등록하기"
- **에러**: 저장 실패 시 Toast "저장 공간이 부족해요…", 체크 상태는 이전 값으로 롤백
- **스크롤**: 항목 최대 30개이므로 일반 스크롤. 단, 로그 상세 등 100행 초과 리스트에는 `react-window` 가상 스크롤 적용(현 화면 해당 없음)
- **터치**: 체크 행 전체가 탭 영역, 높이 ≥ 56px. 구성원 세그먼트 탭 ≥ 44px
- **광고**: `<AdSlot />` — 체크 리스트 Card 아래, FloatingTabBar 위 `Spacing size={16}` 확보(겹침 금지)
- **Navigation state contract**
  - Incoming: `location.state = { toast?: string } | undefined` (예: 병합 완료 후 복귀)
  - Outgoing: `navigate('/tasks')` (빈 상태 CTA, state 없음) / `navigate('/report', { state: { weekKey: string } })` (히어로 탭)
- **Layout contract**: `ScreenScaffold` > (조건부 `reminder-banner`) > `today-summary-hero` > `week-sparkline` > 체크 `Card` > `AdSlot`

### S3. 집안일 항목 관리 — `/tasks`
- **TDS 컴포넌트**: `Top`(뒤로가기), `ListRow`(항목), `Chip`(난이도/반복 요일), `Switch`(반복 사용 여부), `BottomSheet`(추가·편집 폼), `TextField`(이름, 벌금액 `inputMode="numeric"`), `AlertDialog`(숨기기 확인), `Button`, `SubmitFooter`, `Toast`, `Asset.ContentIcon`
- **로딩**: 목록 스켈레톤 ListRow 4개
- **빈 상태**: `data-testid="tasks-empty"`
- **에러**: 시트 내 `TextField error` — "항목 이름을 입력해주세요" / "16자 이내로 입력해주세요" / "벌금은 10,000원 이하로 입력해주세요"; 30개 초과 시 추가 버튼 `disabled` + 안내 문구
- **터치**: 요일 선택 Chip 7개 각 44×44px, ListRow 높이 ≥ 56px
- **키보드**: BottomSheet 내 입력 포커스 시 시트가 키보드 높이만큼 상승(visualViewport), 벌금 필드는 숫자 키패드
- **Navigation state contract**
  - Incoming: `location.state = { openCreate?: boolean; focusTaskId?: string } | undefined` — `openCreate === true`면 진입 즉시 추가 시트 오픈
  - Outgoing: `navigate(-1)` 만 사용 (state 없음)
- **Layout contract**: `ScreenScaffold` > 항목 `Card`(ListRow 목록) > `SubmitFooter`("항목 추가", `display="block"`)

### S4. 초대 & 합치기 — `/invite`
- **TDS 컴포넌트**: `Top`, `Card`, `TextField`(multiline, 코드 붙여넣기), `Button`("코드 만들기", "복사하기", "합치기", "직전 합치기 되돌리기"), `AlertDialog`, `Toast`, `Spacing`
- **로딩**: "합치기" `Button loading`, 코드 생성 중 코드 박스 `Skeleton`
- **빈 상태**: 코드 미생성 시 `data-testid="share-code-empty"` — "코드를 만들어 상대방에게 보내세요"
- **에러**: "코드 형식이 올바르지 않아요" / "코드가 손상됐어요. 다시 복사해주세요" / "기록이 너무 많아요…"
- **터치**: 복사 버튼 ≥ 44px, 코드 박스 탭 시 전체 선택
- **키보드**: 붙여넣기 필드는 `readOnly=false`, `enterKeyHint="done"`, 포커스 시 하단 버튼이 키보드 위로 유지
- **Navigation state contract**
  - Incoming: `location.state = undefined`
  - Outgoing: 병합 성공 시 `navigate('/', { replace: true, state: { toast: "38건의 기록을 합쳤어요" } })` — 홈의 Incoming 타입 `{ toast?: string }`과 일치
- **Layout contract**: `ScreenScaffold` > 내보내기 `Card` > `Spacing size={16}` > 합치기 `Card` > `SubmitFooter`

### S5. 주간 리포트 — `/report` (쿼리 `?week=YYYY-Www`)
- **TDS 컴포넌트**: `Top`, `Tab`(주 이동: 이전/이번 주), `Card`, `Badge`(등급), `Button`("상세 리포트 보기", `display="block"`), `Toast`, `Skeleton`, `Asset.ContentIcon`
- **커스텀 표현 컴포넌트**: `SummaryHero`(fairness CountUp), `Sparkline`(요일별 총 가중치 7포인트), `MiniBar`(항목별 비율)
- **리워드 광고 게이트**: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{<ReportDetail />}</TossRewardAd>` — 게이트 대상은 구성원별 상세 카드·MiniBar·Sparkline. 점수 히어로는 게이트 밖(무료)
- **로딩**: 계산/광고 대기 중 상세 영역 `Skeleton` 3블록
- **빈 상태**: `data-testid="report-empty"`
- **에러**: "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" / "끝까지 시청해야 리포트가 열려요"
- **터치**: 주 이동 버튼 44×44px, "상세 리포트 보기" 높이 ≥ 48px
- **광고**: `<AdSlot />` 배너는 상세 리포트 **하단 끝**에 1개 (히어로/카드와 겹치지 않음)
- **Navigation state contract**
  - Incoming: `location.state = { weekKey: string } | undefined`; 없으면 `searchParams.week` → 둘 다 없으면 이번 주
  - Outgoing: `navigate('/settle', { state: { weekKey: string } })` ("벌금 정산 보기") / `navigate('/', { state: undefined })`
- **Layout contract**: `ScreenScaffold` > `fairness-hero` > `member-card-{memberId}` Card 2개(구성원 수만큼) > `category-minibar` > `weekly-sparkline` > `AdSlot`. 기여율은 t2~t3 강조 타이포 + 등급 `Badge`

### S6. 벌금 정산 — `/settle` (쿼리 `?week=YYYY-Www`)
- **TDS 컴포넌트**: `Top`, `Card`, `ListRow`(미이행 상세), `Badge`, `Button`(`display="block"` "항목에서 벌금 설정하기"), `Asset.ContentIcon`, `Skeleton`, `Spacing`
- **로딩**: 정산 카드 + ListRow 3개 스켈레톤
- **빈 상태**: `data-testid="settle-empty"`
- **에러**: 담당자 없는 항목 제외 안내 문구, 3인 이상 가구 안내 문구
- **스크롤**: 미이행 목록이 100행 초과 시 `react-window` 가상 스크롤 적용
- **터치**: ListRow 높이 ≥ 44px
- **광고**: `<AdSlot />` — 미이행 목록 아래
- **Navigation state contract**
  - Incoming: `location.state = { weekKey: string } | undefined` (S5 Outgoing과 타입 일치)
  - Outgoing: `navigate('/tasks', { state: { openCreate: false } })` — S3 Incoming 타입 `{ openCreate?: boolean; focusTaskId?: string }`과 일치
- **Layout contract**: `ScreenScaffold` > `settlement-card` Card(순정산액 t2 강조) > `fine-list-row-{memberId}` 요약 Card > 미이행 상세 Card > `AdSlot`

### S7. 랭킹 & 스트릭 — `/ranking`
- **TDS 컴포넌트**: `Top`, `Card`, `ListRow`(순위 행), `Chip`(배지), `Badge`(👑), `Asset.ContentIcon`, `Skeleton`
- **커스텀 표현 컴포넌트**: `SummaryHero`(스트릭 CountUp), `MiniBar`(구성원 상대 기여 비율)
- **로딩**: 히어로 + 순위 행 2개 스켈레톤
- **빈 상태**: `data-testid="ranking-empty"`
- **에러**: 미래 날짜 로그는 계산에서 제외(무음 처리, 화면 크래시 없음)
- **터치**: 순위 행 높이 ≥ 56px
- **광고**: `<AdSlot />` — 순위 목록 아래
- **Navigation state contract**
  - Incoming: `location.state = undefined`
  - Outgoing: `navigate('/report', { state: { weekKey: string } })` ("이번 주 리포트 보기") — S5 Incoming과 타입 일치
- **Layout contract**: `ScreenScaffold` > `streak-hero`(CountUp + 배지 Chip) > 순위 `Card`(`rank-row-{memberId}` + MiniBar) > `AdSlot`

### S8. 설정 — `/settings`
- **TDS 컴포넌트**: `Top`, `ListRow`(설정 항목), `Switch`(리마인더 on/off — Toggle 아님), `BottomSheet`(시각 선택, 목표 지분 조정), `TextField`(지분 %, `inputMode="numeric"`), `AlertDialog`(정리·초기화 확인), `Button`, `Toast`, `Skeleton`
- **로딩**: 각 ListRow 우측 값 `Skeleton`
- **빈 상태**: 해당 없음(설정 항목 고정)
- **에러**: "지분 합이 100%가 되어야 해요"
- **터치**: `Switch` 및 모든 ListRow ≥ 44px
- **키보드**: 지분 입력은 숫자 키패드, 시트가 키보드 위로 상승
- **Navigation state contract**
  - Incoming: `location.state = undefined`
  - Outgoing: `navigate('/invite')` / 초기화 시 `navigate('/onboarding', { replace: true })` — 둘 다 state 없음
- **Layout contract**: `ScreenScaffold` > 리마인더 `Card` > 가구/지분 `Card` > 데이터 관리 `Card`(정리·초기화) > 앱 정보 `Card`. 파괴적 액션은 마지막 Card에만 배치

---

## Data Storage

| 모델 | localStorage 키 | 값 형태 | 단건 크기 | 최대 건수 | 최대 용량 |
|---|---|---|---|---|---|
| Household | `choresplit:household:v1` | `Household` 객체 JSON | ~600B | 1 | 0.6KB |
| ChoreTask | `choresplit:tasks:v1` | `ChoreTask[]` | ~200B | 30 | 6KB |
| ChoreLog | `choresplit:logs:v1` | `ChoreLog[]` | ~130B | 8,000 (180일 × 4인 × ~11건/일 상한) | ~1.0MB |
| AppSettings | `choresplit:settings:v1` | `AppSettings` | ~300B | 1 | 0.3KB |
| 병합 백업 | `choresplit:backup:v1` | `{ household, tasks, logs, savedAt }` | 위 합계 스냅샷 1개 | 1 | ~1.0MB |
| 스키마 버전 | `choresplit:schema:v1` | `{ version: 1 }` | ~20B | 1 | 0.02KB |
| 손상 백업 | `choresplit:logs:v1.corrupt` | 원본 문자열 | 최대 1.0MB | 1 | ~1.0MB |

**총 상한 ≈ 3.1MB (< 5MB)**. 백업 키는 다음 병합 시 덮어쓰며, `choresplit:logs:v1.corrupt`는 사용자가 "오래된 기록 정리" 실행 시 함께 제거된다.

**접근 계약 (`src/storage/storage.ts`)**
```ts
export function safeGet<T>(key: string, fallback: T): T;            // JSON 파싱 실패 시 fallback + .corrupt 백업
export function safeSet<T>(key: string, value: T):
  { ok: true } | { ok: false; reason: 'quota' | 'serialize' };      // quota 시 prune(90일) 후 1회 재시도
export function pruneLogs(logs: ChoreLog[], keepDays: number): ChoreLog[];
```

---

## API Contract

**MVP 범위에서 외부 API 호출은 0건이다.** 모든 데이터는 localStorage에 저장되고, 동거인 간 데이터 공유는 F4의 클라이언트 사이드 base64url 코드 교환으로 처리한다. 따라서 endpoint/CORS/에러 코드 정의가 필요한 외부 계약은 없다.

> 참고: 향후 실시간 동기화가 필요해질 경우에만 별도 Railway 배포 API 서버를 도입한다. 그 경우의 계약 초안은 Open Questions Q1 참조. MVP 구현 시에는 어떤 `fetch`/`XMLHttpRequest`도 작성하지 않는다(검수 AC F8-AC8과 연동).

---

## Assumptions

1. **PRD의 "실시간 반영"은 MVP에서 공유 코드 병합(F4)으로 대체한다.** 서버 없이 실시간 동기화는 불가능하며, 본 SPEC 규칙("NO server-side code")과 MVP 범위를 우선했다. 실시간 동기화는 별도 API 서버 도입 후 2차 범위로 본다.
2. **PRD의 "매일 체크인 리마인더"는 푸시 알림이 아닌 인앱 배너(F8)로 구현한다.** 푸시 알림은 MVP 제외 항목이다.
3. **"소액 벌금"은 실제 결제/송금이 아니라 기록 및 정산 제안이다.** IAP·외부 송금 링크를 사용하지 않는다(외부 이탈 금지 정책 준수).
4. 시간대는 KST(UTC+9) 고정으로 가정한다. 기기 로케일이 다르더라도 `date` 문자열은 KST 기준으로 생성한다.
5. 가구 구성원은 1~4명, 집안일 항목은 최대 30개로 제한한다(PRD의 "1-2인 동거 가구" 기준에 여유를 둔 상한).
6. 토스 앱이 사용자 세션을 자동 제공하므로 별도 로그인 UI·인증 로직은 구현하지 않는다. 구성원 식별은 앱 내 로컬 프로필(`Member`)로만 수행한다.
7. 광고 그룹 ID / 슬롯 ID는 앱인토스 콘솔에서 발급받아 `VITE_TOSS_AD_GROUP_ID`, `VITE_TOSS_AD_SLOT_ID` 환경변수로 주입한다(재빌드 없이 교체 가능).
8. 프로모션(`grantPromotionReward`) 및 IAP(`TossPurchase`)는 MVP에서 사용하지 않는다. 향후 도입 시 `amount ≤ 5,000` 검증 AC를 추가한다.
9. 공정성 점수 공식(§계산 규칙)은 제품 정의값이며, 별도 검증 데이터 없이 본 문서의 정의를 단일 진실 원천으로 삼는다.

---

## Open Questions

- **Q1. 실시간 동기화 서버 도입 여부** — 2인 이상 동시 사용 시 공유 코드 수동 교환이 마찰이 될 수 있다. 도입 시 예상 계약: `POST /households/{id}/logs { logs: ChoreLog[] } → { synced: number }`, `GET /households/{id}/logs?since={epochMs} → { logs: ChoreLog[] }`, 에러 `{ error: string }` (400 invalid_payload / 404 household_not_found / 429 rate_limited). 별도 Railway 배포 + CORS allow-origin 설정 필요. **MVP 이후 결정.**
- **Q2. 리워드 광고 해제 단위** — 현재 "주(weekKey) 단위 1회 시청"으로 정의했다. 수익(약 58만원/월 목표) 관점에서 "방문 세션당 1회"로 바꿀지 검토 필요. 세션당으로 바꾸면 전환은 늘지만 이탈 위험이 있다.
- **Q3. 개인화 코칭 문구(AI) 도입 여부** — 리포트에 "이번 주는 빨래가 한쪽에 몰렸어요" 같은 문구를 규칙 기반이 아닌 생성형 AI로 만들 경우, 생성형 AI 사전 고지 다이얼로그 + 결과물 "AI가 생성한 결과입니다" 라벨 AC가 **필수 추가**된다(미준수 시 과태료 3,000만원). MVP는 규칙 기반으로만 진행.
- **Q4. 3인 이상 가구의 벌금 정산 매칭 알고리즘** — 현재는 개인별 금액만 표시(F6-AC7). 다자간 최소 송금 횟수 매칭이 필요한지 사용자 피드백으로 확인.
- **Q5. 스트릭 기준** — "구성원 개인의 연속 체크인"과 "가구 전체의 연속 체크인" 중 어느 쪽이 습관 형성에 효과적인지. 현재 개인 기준으로 정의했다.