# TASK — choresplit

> **수정 사항 (validation fix):** 모든 `Covers` 항목을 `F{n}-AC-{m}` / `CK-{n}` **정규 ID 형식으로 개별 나열**(범위 표기 `AC-1~AC-8` 전면 제거)했다. 미커버로 지적된 **F1-AC-5, F1-AC-7, F3-AC-5, F5-AC-3**은 각각 Task 2.1 / 2.1 / 2.5·3.2 / 2.3의 Covers에 명시적 ID로 포함했고, DoD에 검증 조건을 남겼다.

---

## Epic 1. 타입 정의 (Types)

**Risk Assessment**
- Complexity: Low
- Risk factors: 페이지 간 `location.state` 계약이 흩어지면 새로고침·직접 진입 시 런타임 크래시(SplitMate 실사고 재현). 파생 타입(`WeeklyReport`)이 계산 모듈과 UI에서 각각 정의되면 필드 불일치 발생.
- Mitigation: 모든 엔티티·파생 타입·`RouteState`를 런타임 코드 0줄인 단일 파일에서 먼저 확정한 뒤, 하위 Epic은 import만 하게 한다.

### Task 1.1 엔티티 타입 + RouteState 정의
- Description: `src/lib/types.ts`에 SPEC Data Models의 모든 타입을 순수 타입으로 정의한다. 런타임 코드(함수/상수) 없음, `export type` / `export interface`만 사용.
  - 엔티티: `MemberId`, `ChoreId`, `CheckInId`, `Member`, `Chore`, `CheckIn`, `Household`, `Settings`, `SettlementRecord`, `ChoreSplitState`
  - 파생 타입: `MemberWeekStat`, `WeeklyReport`
  - 결과 타입: `export type SaveResult = { ok: true } | { ok: false; error: string }`
  - 색상 토큰: `export type ColorToken = 'blue' | 'green' | 'orange' | 'purple'` (HEX 금지, TDS 토큰 매핑 키)
  - `RouteState` (SPEC Screen Definitions의 incoming state와 1:1):
    ```ts
    export type RouteState = {
      '/': undefined;
      '/onboarding': undefined;
      '/chores': { openCreate: boolean } | undefined;
      '/members': undefined;
      '/report': undefined;
      '/report/detail': { weekStart: string } | undefined;
      '/settle': { weekStart: string } | undefined;
      '/streak': undefined;
      '/settings': undefined;
    };
    ```
  - 파일 상단 주석에 수신 규칙 명시: `const st = (useLocation().state as RouteState['/x']) ?? null;` 후 **null 체크 필수**, `as` 캐스팅은 방어가 아님.
- DoD:
  - `npx tsc --noEmit` 통과, 파일 내 `function` / `const` 런타임 선언 0개
  - `ChoreSplitState` 필드가 SPEC과 정확히 일치(`version: 1` 리터럴 타입 포함)
  - `Chore.weight`는 `1 | 2 | 3`, `Chore.frequency`는 `'daily' | 'weekly'` 유니온
  - `WeeklyReport`에 `weekStart`, `weekEnd`, `stats`, `fairnessScore`, `totalWeighted`, `topChores`, `dailyTrend`, `missedItems` 전부 존재
  - 소스에 `/#[0-9a-fA-F]{3,8}\b/` 매칭 0건
- Covers: [F1-AC-8]
- Files: `src/lib/types.ts`
- Depends on: none

---

## Epic 2. 데이터 레이어 (Storage / Calc / State)

**Risk Assessment**
- Complexity: Medium
- Risk factors: (1) 손상 JSON·`QuotaExceededError` 미처리 시 앱 전체 크래시, (2) 120일 자동 정리가 저장 경로에 없으면 localStorage 5MB 접근, (3) 공정성 점수를 2단계 반올림하면 1점 오차, (4) 계산 함수가 state를 mutate하면 UI 불일치, (5) 낙관적 업데이트 롤백 누락 시 화면과 저장값 불일치.
- Mitigation: storage(2.1) → 상태 변형 헬퍼(2.2) → 순수 계산(2.3, 2.4) → React 상태 컨테이너(2.5) 순으로 분리해 각각 UI 없이 독립 테스트한다. 계산 모듈은 UI import 0건으로 고정해 불변성을 `JSON.stringify` 비교로 검증한다.

### Task 2.1 localStorage 저장소 모듈
- Description: `src/lib/storage.ts` 구현.
  - `DEFAULT_STATE: ChoreSplitState` — `household: null`, 빈 배열들, `settings = { reminderEnabled: true, reminderHour: 21, penaltyEnabled: true, lastReminderShownDate: null }`
  - `loadState(): ChoreSplitState` — 키 없음 / JSON 파싱 실패 / `version !== 1` 시 `DEFAULT_STATE` 반환. `try/catch`로 감싸되 **`console.error` 호출 금지**
  - `saveState(state): SaveResult` — 저장 직전 `date < today-120일`인 `checkIns`를 제거한 뒤 직렬화. 모든 예외(`QuotaExceededError` 포함) 시 `{ ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" }` 반환, throw 금지
  - `loadUnlocked(): Record<string, true>` / `unlockWeek(weekStart): void` — 키 `choresplit:report-unlocked`
  - `setOnboarded(): void` / `isOnboarded(): boolean` — 키 `choresplit:onboarded`
  - `pruneOlderThan(state, days): ChoreSplitState` — 설정의 "오래된 기록 정리"(30일)용, 입력 불변
  - `newId(prefix: 'm_' | 'c_' | 'h_'): string` → prefix + base36 8자
  - `generateInviteCode(): string` → `[A-Z0-9]` 6자
  - `todayKST(): string`, `formatDateKST(d: Date): string` — `Asia/Seoul`, `YYYY-MM-DD`
- DoD:
  - `localStorage.setItem('choresplit:v1','{invalid json')` 후 `loadState()`가 예외 없이 `DEFAULT_STATE`(SPEC F1-AC-4 전체 필드 일치)를 반환하고 `console.error` 호출 0회
  - **`setItem`을 `QuotaExceededError` throw로 stub 했을 때 `saveState()` 반환값이 정확히 `{ ok: false, error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" }`이고 throw하지 않음 (F1-AC-5 저장소 계약)**
  - **121일 전 `date`를 가진 checkIn을 포함해 `saveState()` 호출 후 `loadState().checkIns`에 해당 레코드가 없고, 120일 이내 레코드는 전부 보존됨 (F1-AC-7)**
  - `newId('m_')`가 `/^m_[a-z0-9]{8}$/`, `newId('c_')`가 `/^c_[a-z0-9]{8}$/`, `generateInviteCode()`가 `/^[A-Z0-9]{6}$/`를 각 100회 반복 호출에서 모두 만족
  - `pruneOlderThan(state, 30)` 호출 전후 입력 `state`의 `JSON.stringify` 동일
  - 소스에 `Array.prototype.at` / `Object.groupBy` / `structuredClone` / `findLast` 사용 0건
- Covers: [F1-AC-4, F1-AC-5, F1-AC-7, CK-4]
- Files: `src/lib/storage.ts`
- Depends on: Task 1.1

### Task 2.2 가구 생성·시드 + 엔티티 mutation 헬퍼
- Description: `src/lib/household.ts` — 상태 변형 순수 함수(입력 state 불변, 새 객체 반환). 모든 함수 반환 타입은 `{ ok: true; state: ChoreSplitState } | { ok: false; error: string }`.
  - `createHousehold(name, myName)` — `Household`(inviteCode 생성) + 본인 `Member`(`isMe: true`, `colorToken: 'blue'`) + 시드 6종. 시드 순서 고정: 설거지(w2, daily, 500) / 청소(w3, daily, 500) / 빨래(w2, weekly, 1000) / 분리수거(w1, weekly, 500) / 요리(w3, daily, 1000) / 화장실청소(w3, weekly, 1000)
  - `validateOnboarding(householdName, myName)` — trim 후 빈값이면 `{ ok:false, field:'household', error:"가구 이름을 입력해주세요" }` / `{ ok:false, field:'name', error:"닉네임을 입력해주세요" }`
  - `addChore(state, input)` / `updateChore(state, id, patch)` / `toggleChoreActive(state, id)` — 이름 중복(trim+소문자 비교) `"이미 있는 항목이에요"`, 20개 초과 `"항목은 최대 20개까지 만들 수 있어요"`, 벌금 범위 밖 `"벌금은 0원~5,000원 사이여야 해요"`, 100원 단위 아님 `"벌금은 100원 단위로 입력해주세요"`
  - `addMember(state, name, colorToken)` — 4명 초과 `"동거인은 최대 4명까지 등록할 수 있어요"`, 이름 중복 `"같은 이름이 이미 있어요"`
  - `removeMember(state, id)` — `isMe`면 `{ ok:false, error:"본인은 삭제할 수 없어요" }`, 아니면 멤버 + 해당 `memberId` checkIns 전부 제거
  - `countMemberCheckIns(state, memberId): number` — 삭제 확인 다이얼로그 문구용
  - `toggleCheckIn(state, date, choreId, memberId)` — id `${date}__${choreId}__${memberId}` 기준 토글. 추가 시 `weightAtLog`에 현재 `chore.weight` 스냅샷. `date > todayKST()`면 상태 변경 없이 `{ ok:true, state }` 그대로 반환
- DoD:
  - `createHousehold("우리집","민수")` → `household.name === "우리집"`, `members.length === 1`, `members[0].name === "민수"`, `members[0].isMe === true`, `chores.map(c => c.name)`이 `["설거지","청소","빨래","분리수거","요리","화장실청소"]`와 정확히 일치, `inviteCode`가 `/^[A-Z0-9]{6}$/` 만족
  - `validateOnboarding("우리집","   ")` → `{ ok:false, field:'name', error:"닉네임을 입력해주세요" }`; `validateOnboarding("  ","민수")` → `"가구 이름을 입력해주세요"`
  - `addChore`에 `" 설거지 "` → `{ ok:false, error:"이미 있는 항목이에요" }`, `chores.length` 불변
  - `addChore` penaltyAmount `7000` → `"벌금은 0원~5,000원 사이여야 해요"`, `550` → `"벌금은 100원 단위로 입력해주세요"`
  - `chores.length === 20`에서 `addChore` → `"항목은 최대 20개까지 만들 수 있어요"`
  - `toggleChoreActive`로 "요리" 비활성화 후 `chores.find(c=>c.name==="요리").active === false`이고 `checkIns` 배열 길이 불변
  - `members.length === 4`에서 `addMember` → `"동거인은 최대 4명까지 등록할 수 있어요"`; `isMe` 멤버 `removeMember` → `"본인은 삭제할 수 없어요"`
  - checkIn 5건 보유 멤버 `removeMember` 후 members에서 제거 + 해당 memberId checkIns 5건 모두 제거, `countMemberCheckIns`가 삭제 전 `5` 반환
  - `toggleCheckIn` 2회 연속 호출 시 원상복귀(해당 레코드 0건); 미래 날짜 호출 시 `checkIns` 길이 불변
  - 모든 함수 호출 전후 입력 state의 `JSON.stringify` 동일(불변성)
- Covers: [F1-AC-1, F1-AC-3, F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-4, F4-AC-1, F4-AC-4, F4-AC-5, F4-AC-6]
- Files: `src/lib/household.ts`
- Depends on: Task 1.1, Task 2.1

### Task 2.3 주간 리포트 계산 엔진 (F5) + 정산 계산
- Description: `src/lib/report.ts` — UI import 0건인 순수 함수 모듈.
  - `getWeekStart(date: string): string` — 월요일 시작 주 식별자
  - `getWeekEnd(weekStart: string): string` — 일요일
  - `buildWeeklyReport(state, weekStart): WeeklyReport`
    - `stats`: 멤버별 `count`, `weightedScore = Σ weightAtLog`, `sharePct = Math.round(ws / total * 1000) / 10`, `weightedScore` 내림차순
    - `fairnessScore`: `members.length < 2` → `100`; `totalWeighted === 0` → `0`; 그 외 `Math.max(0, Math.round(100 - (maxSharePct - minSharePct)))` — **단일 반올림 식만 사용, `100 - Math.round(diff)` 2단계 계산 금지**
    - `dailyTrend`: 길이 7 정수 배열, index 0=월 … 6=일
    - `topChores`: 체크인 건수 내림차순 최대 3개, 동점 시 `choreName` 오름차순
    - `missedItems`: `active === true` 항목만 대상. daily는 주 7일 중 체크인 0건인 날 수, weekly는 주간 0건이면 1 / 아니면 0. `penalty = missedCount * penaltyAmount`
  - `computeSettlement(report, members)` → `{ totalPenalty, burdens: Array<{ memberId, amount }>, lines: Array<{ fromMemberId, toMemberId, amount }> }`
    - 부담액 = `totalPenalty × (1 - sharePct/100) / (members.length - 1)` → 100원 단위 반올림
    - 라인: 부담액이 평균 초과 멤버 → 미만 멤버로 차액 greedy 매칭, 100원 단위 양의 정수만
    - `members.length < 2` → `lines: []`
- DoD:
  - `getWeekStart("2026-09-03") === "2026-08-31"`, `getWeekStart("2026-08-31") === "2026-08-31"`, `getWeekStart("2026-09-06") === "2026-08-31"`
  - F5-AC-2 픽스처(민수 w2×3 + w3×1, 지영 w1×2) → `stats[0] = { count:4, weightedScore:9, sharePct:81.8 }`, `stats[1] = { count:2, weightedScore:2, sharePct:18.2 }`, `totalWeighted === 11`
  - **동일 픽스처에서 `fairnessScore === 36`이고, 소스에 `Math.round(100 - (max - min))` 형태가 존재하며 `100 - Math.round(` 형태 매칭 0건 (F5-AC-3)**
  - **두 멤버 `weightedScore`가 5 / 5로 동일하면 `fairnessScore === 100` (F5-AC-3 후단)**
  - checkIns 0건 주간 → `totalWeighted === 0`, `fairnessScore === 0`, 모든 멤버 stats가 `{ count:0, weightedScore:0, sharePct:0 }`, `dailyTrend`가 `[0,0,0,0,0,0,0]`, 예외 미발생
  - 멤버 1명 + 체크인 5건 → `fairnessScore === 100`, `stats.length === 1`, `stats[0].sharePct === 100`
  - 설거지(daily, 500) 4일 체크인 + 빨래(weekly, 1000) 0건 → `missedItems`에 `{ choreName:"설거지", missedCount:3, penalty:1500 }`, `{ choreName:"빨래", missedCount:1, penalty:1000 }` 포함
  - `dailyTrend.length === 7`이며 전부 정수, `topChores.length <= 3`이고 동점 시 이름 오름차순
  - `buildWeeklyReport` 호출 전후 `JSON.stringify(state)` 동일
  - `computeSettlement`: totalPenalty 2500 / 민수 80% / 지영 20% → burdens `민수 500`, `지영 2000`, lines `[{ from: 지영, to: 민수, amount: 1500 }]`
- Covers: [F5-AC-1, F5-AC-2, F5-AC-3, F5-AC-4, F5-AC-5, F5-AC-6, F5-AC-7, F5-AC-8, F7-AC-1]
- Files: `src/lib/report.ts`
- Depends on: Task 1.1

### Task 2.4 스트릭·랭킹 계산 + 리마인더 판정
- Description: `src/lib/streak.ts` — 순수 함수 모듈.
  - `getStreak(state, memberId, today = todayKST()): number` — 오늘 해당 멤버 체크인이 있으면 오늘부터, 없으면 어제부터 역순으로 체크인이 존재하는 연속 일수. 어제도 0건이면 `0`
  - `getRanking(state, days = 30): MemberWeekStat[]` — 최근 `days`일(오늘 포함) 가중 점수 내림차순, 동점 시 `memberName` 오름차순. `sharePct` 포함, 총합 0이면 전원 `sharePct: 0`
  - `countTodayCheckIns(state, memberId, today): number`
  - `shouldShowReminder(settings, now: Date, todayMyCheckInCount: number): boolean` — `reminderEnabled && now.getHours() >= reminderHour && todayMyCheckInCount === 0 && settings.lastReminderShownDate !== todayKST()`
- DoD:
  - 09-01 / 09-02 / 09-03 체크인, 08-31 없음, 오늘 09-03 → `getStreak === 3`
  - 09-01 / 09-02 체크인, 오늘 09-03 0건 → `getStreak === 2`; 09-02도 0건이면 `0`
  - 민수 24 / 지영 24 / 현우 10 → `getRanking` 순서 `[민수, 지영, 현우]`, 각 원소에 `weightedScore`·`sharePct` 존재
  - 최근 30일 체크인 0건 → `getRanking` 길이 = 멤버 수, 전원 `weightedScore: 0`, `sharePct: 0`
  - `shouldShowReminder`: `reminderHour 21` / `now 21:30` / 오늘 0건 / `lastReminderShownDate !== "2026-09-03"` → `true`; `lastReminderShownDate === "2026-09-03"`이고 오늘이 `2026-09-03`이면 `false`; `reminderEnabled === false`이면 시각 무관 `false`
  - 소스에 `Notification` / `requestPermission` / `serviceWorker` 문자열 0건
  - 입력 state 불변(`JSON.stringify` 동일)
- Covers: [F8-AC-1, F8-AC-2, F8-AC-3, F8-AC-4, F8-AC-5, F8-AC-6]
- Files: `src/lib/streak.ts`
- Depends on: Task 1.1

### Task 2.5 앱 전역 상태 컨테이너 (Context)
- Description: `src/lib/StateProvider.tsx` + `src/lib/useAppState.ts` — 얇은 React Context 스토어(UI 없음).
  - `AppStateProvider`: 마운트 시 `loadState()`·`loadUnlocked()` 1회 실행. 완료 전 `loading: true`
  - `useAppState()` → `{ state, loading, mutate, unlocked, unlock }`
  - `mutate(fn: (s) => { ok:true; state } | { ok:false; error:string }): { ok: boolean; error?: string }` — 낙관적 업데이트: 새 state를 즉시 `setState` → `saveState()` 실패 시 **이전 state로 롤백**하고 error 문자열 반환. 헬퍼가 `{ ok:false }`면 setState 없이 error만 반환
  - `unlock(weekStart)` — `unlockWeek()` 호출 + Context 반영
  - Toast는 Provider가 띄우지 않고 error 문자열만 반환(호출 화면이 표시)
  - `console.error` 사용 금지
- DoD:
  - 초기 마운트 시 `loading === true`인 프레임이 최소 1회 존재하고, 그 동안 children이 `state` 접근해도 크래시하지 않음
  - **`saveState`를 `{ ok:false, error:"저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요" }` 반환으로 stub 했을 때, `mutate` 후 `state`가 mutate 이전 값과 `JSON.stringify` 동일(롤백)하고 반환값이 동일 error 문자열을 담음 (F3-AC-5 롤백 계약 / F1-AC-5 전달 계약)**
  - `unlock("2026-08-31")` 후 `unlocked["2026-08-31"] === true`이고 localStorage `choresplit:report-unlocked`에도 반영됨
  - Provider·훅 전체에서 `console.error` 호출 0건
- Covers: [F1-AC-5, F1-AC-6, F3-AC-5, F6-AC-1]
- Files: `src/lib/StateProvider.tsx`, `src/lib/useAppState.ts`
- Depends on: Task 2.1, Task 2.2

---

## Epic 3. UI 페이지 (한 태스크 = 한 페이지)

**Risk Assessment**
- Complexity: High
- Risk factors: (1) `location.state` 없이 `/report/detail`·`/settle` 직접 진입 시 `.map()` 크래시(SplitMate 실사고), (2) TDS 컴포넌트에 인라인 padding/margin을 덮어써 검수 반려, (3) HEX 하드코딩으로 다크모드 파손, (4) 광고가 콘텐츠 위에 겹침, (5) 저장 실패 시 UI 상태가 롤백되지 않아 표시값과 저장값 불일치.
- Mitigation: Epic 2 완료 후 착수해 페이지는 계산/저장 로직을 전혀 포함하지 않게 한다. state 수신 페이지(3.3, 3.5, 3.6)는 DoD에 "state 없이 직접 진입해도 크래시 없음"을 필수 항목으로 명시. 여백은 `Spacing`만, 색상은 TDS 토큰만 사용하도록 각 DoD에 정규식 검사를 넣는다.

### Task 3.1 온보딩 페이지 `/onboarding` (S1)
- Description: `src/pages/OnboardingPage.tsx`.
  - `ScreenScaffold` + `Top`("집안일, 공정하게") + `Paragraph.Text` 설명
  - `TextField` 2개(가구 이름 기본값 "우리집" / 내 닉네임), 사이 `Spacing size={16}`
  - `SubmitFooter` + `Button display="block"`("시작하기", 높이 48px)
  - 제출: `validateOnboarding` → 실패 시 해당 TextField 하단 에러 메시지 / 성공 시 `mutate(createHousehold)` + `setOnboarded()` → `navigate('/', { replace: true })`
  - 저장 중 Button `loading` + `disabled`(재탭 무시), 저장 실패 시 Toast `"저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"`
  - 두 TextField 포커스 시 `scrollIntoView({ block: 'center' })`, 첫 필드 `enterKeyHint="next"`, 둘째 `enterKeyHint="done"` + 제출 트리거
  - `household !== null`이면 즉시 `<Navigate to="/" replace />`
- DoD:
  - 가구 이름 "우리집" + 닉네임 "민수" 제출 → `choresplit:v1`에 `household.name === "우리집"`, `members.length === 1`, `members[0].isMe === true`, chores 6종 이름 배열 일치, `inviteCode`가 `/^[A-Z0-9]{6}$/` 만족, `choresplit:onboarded === "true"`, 경로가 `/`로 변경
  - 닉네임 `"   "` 제출 → `"닉네임을 입력해주세요"` 렌더, `choresplit:v1` 미생성
  - 가구 이름 공백 제출 → `"가구 이름을 입력해주세요"` 렌더
  - `household !== null` 상태로 `/onboarding` 직접 진입 → `/`로 replace 리다이렉트
  - 제출 버튼 연속 2회 탭 시 `createHousehold`가 1회만 실행
  - **`saveState` 실패 stub 시 F1-AC-5 문구 Toast가 1개 표시되고 화면이 크래시하지 않음**
  - 소스 HEX 매칭 0건, 인라인 `padding`/`margin` 스타일 0건
- Covers: [F1-AC-1, F1-AC-2, F1-AC-3, F1-AC-5]
- Files: `src/pages/OnboardingPage.tsx`
- Depends on: Task 2.5

### Task 3.2 홈(오늘 체크인) `/` (S2, F3)
- Description: `src/pages/HomePage.tsx`.
  - `ScreenScaffold` + `Top`(타이틀 = `household.name`)
  - `SummaryHero data-testid="today-hero"` — CountUp value = 선택 날짜 총 체크인 수, label `"오늘 체크인"`
  - 리마인더 배너 `data-testid="reminder-banner"`: `shouldShowReminder()`가 true일 때만 렌더, 문구 `"오늘 집안일 기록을 잊지 않으셨나요?"` + "지금 기록하기"(리스트로 스크롤만, navigate 없음). 렌더 시 `settings.lastReminderShownDate = todayKST()` 저장
  - 날짜 Chip 행("어제"/"오늘"), "다음 날" 버튼은 선택 날짜가 오늘이면 `disabled`
  - 활성 chore별 `ListRow`(높이 ≥56px) + 우측 멤버 `Chip`(44×44px 이상). Chip 탭 → `mutate(toggleCheckIn)`, 성공 Toast `"체크인 완료!"` / `"체크인을 취소했어요"`
  - **저장 실패 시 에러 Toast 표시 + Chip 선택 상태를 탭 이전 값으로 롤백**
  - 빈 상태: 선택 날짜 체크인 0건 → `data-testid="today-empty"` + `Asset.ContentIcon` + `"오늘 첫 집안일을 기록해보세요"`. 활성 항목 0개 → `"집안일 항목을 먼저 추가해주세요"` + "항목 관리" 버튼 → `navigate('/chores', { state: { openCreate: true } })`
  - 로딩: `loading === true`면 `data-testid="app-loading"` Skeleton 4줄만 렌더(홈 콘텐츠 미렌더)
  - 활성 항목 50개 초과 시 윈도잉(초기 DOM 행 ≤20)
  - 리스트 마지막 행 아래 `Spacing size={24}` + `<AdSlot data-testid="home-ad" adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`
  - `household === null`이면 `<Navigate to="/onboarding" replace />`
- DoD:
  - 민수 Chip 탭 → checkIns에 `2026-09-03__c_xxx__m_xxx` id 레코드 생성 + `weightAtLog` = 현재 `chore.weight`, Toast `"체크인 완료!"`, hero 값 +1
  - 동일 Chip 재탭 → 레코드 제거 + Toast `"체크인을 취소했어요"`
  - 멤버 2명 각각 탭 → 해당 chore/날짜 레코드 2건, 두 Chip 모두 selected
  - **`saveState` 실패 stub 시 Chip이 탭 이전 selected 상태로 되돌아가고 `"저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"` Toast 1개 표시 (F3-AC-5)**
  - "다음 날" 버튼이 오늘 기준 `disabled` 속성 보유, 탭해도 날짜 문자열 불변, 레코드 생성 0건
  - `loading` 중 `app-loading` 존재 & `today-hero` 부재
  - 선택 날짜 체크인 0건 → `today-empty` 렌더
  - 활성 chore 60개 픽스처에서 초기 렌더 ListRow DOM 수 ≤20
  - `home-ad`가 마지막 ListRow 뒤 DOM 순서에 위치하고 `position: fixed/absolute` 스타일 0건
  - 21:30 / 오늘 0건 / `lastReminderShownDate ≠ 오늘` → `reminder-banner` 렌더 + 저장값이 오늘 날짜로 갱신; 동일 조건 재마운트 시 미렌더
  - `reminderEnabled === false`면 시각 무관 `reminder-banner` 미렌더
  - 파일 내 `window.open` / `window.location.href =` 0건, HEX 0건, 광고 ID 리터럴 0건
- Covers: [F1-AC-2, F1-AC-6, F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-4, F3-AC-5, F3-AC-6, F3-AC-7, F3-AC-8, F3-AC-9, F8-AC-4, F8-AC-5, CK-1, CK-12]
- Files: `src/pages/HomePage.tsx`
- Depends on: Task 2.4, Task 2.5

### Task 3.3 집안일 항목 관리 `/chores` (S3, F2)
- Description: `src/pages/ChoresPage.tsx`.
  - `ScreenScaffold` + `Top`("집안일 항목")
  - chore별 `ListRow`(좌: 이름, 우: `Switch`), 가중치 `Chip`(`"가벼움"|"보통"|"힘듦"`), 주기 `Chip`. 행 높이 ≥56px, Switch 터치 영역 44×44px
  - `SubmitFooter` + `Button display="block"`("항목 추가"). `chores.length === 20`이면 `disabled` + 안내 문구 `"항목은 최대 20개까지 만들 수 있어요"`
  - 추가/편집 `BottomSheet`: 이름 `TextField`, 가중치 `Chip` 3택, 주기 `Chip` 2택, 벌금 `TextField`(`inputMode="numeric"`, 포커스 시 `scrollIntoView({ block:'center' })`), 저장 버튼(저장 중 `loading` + `disabled`)
  - 저장은 `mutate(addChore/updateChore)`; error 문자열을 BottomSheet 내 에러 텍스트로 표시, 성공 시 Toast `"항목을 추가했어요"` + 시트 닫기
  - Switch 토글 → `mutate(toggleChoreActive)`
  - 빈 상태: `chores.every(c => !c.active)` → `data-testid="chores-empty"` + `Asset.ContentIcon` + `"활성화된 집안일이 없어요"` + `display="block"` "항목 추가" 버튼
  - Incoming state: `const st = (useLocation().state as RouteState['/chores']) ?? null; if (st?.openCreate) 시트 자동 오픈;`
- DoD:
  - `{ name:"화분 물주기", weight:1, frequency:"weekly", penaltyAmount:500 }` 저장 → `chores.length` 6→7, 새 항목 `active === true`, `id`가 `/^c_[a-z0-9]{8}$/`, Toast `"항목을 추가했어요"`, 시트 닫힘
  - "요리" Switch off → 저장된 `active === false`, `/`의 오늘 체크인 목록에서 "요리" 사라짐, 기존 "요리" checkIns 건수 불변
  - `" 설거지 "` 저장 → `"이미 있는 항목이에요"` 표시, `chores.length` 불변
  - 벌금 `7000` → `"벌금은 0원~5,000원 사이여야 해요"`, `550` → `"벌금은 100원 단위로 입력해주세요"`
  - `chores.length === 20`에서 "항목 추가" 버튼 `disabled` + 안내 문구 렌더
  - 모든 chore 비활성 시 `chores-empty` 렌더 + `Asset.ContentIcon` 존재
  - 각 chore 행에 가중치 Chip 문구가 weight 1/2/3에 대해 `"가벼움"/"보통"/"힘듦"`이고 행 높이 ≥44px
  - 벌금 input의 `inputMode === "numeric"`, 포커스 시 `scrollIntoView` 호출됨
  - **`state` 없이 `/chores` 직접 진입해도 크래시 없이 리스트가 렌더되고 시트는 닫힌 상태**
  - HEX 0건, 인라인 padding/margin 0건
- Covers: [F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-8]
- Files: `src/pages/ChoresPage.tsx`
- Depends on: Task 2.5

### Task 3.4 동거인 관리 `/members` (S4, F4)
- Description: `src/pages/MembersPage.tsx`.
  - `ScreenScaffold` + `Top`("동거인")
  - `Card data-testid="invite-card"` — `household.inviteCode`를 t2 강조 타이포로 표기 + `Button display="block"`("코드 복사", 높이 ≥48px)
  - 복사: `navigator.clipboard?.writeText(code)` → 성공 Toast `"초대 코드를 복사했어요"`. `navigator.clipboard`가 undefined이거나 reject 시 Toast `"코드를 길게 눌러 복사해주세요"` (catch에서 `console.error` 금지)
  - 멤버 `ListRow`(좌: 이름 + 색상 Chip, 우: 삭제 아이콘 버튼 44×44px). `isMe === true`인 행은 삭제 버튼 미렌더
  - 삭제: `AlertDialog` `"{name}님을 삭제하면 기록 {n}건도 함께 삭제돼요"`(n = `countMemberCheckIns`) → "삭제" 확인 시 `mutate(removeMember)`
  - `SubmitFooter` "동거인 추가" → `BottomSheet`(이름 `TextField` `enterKeyHint="done"` + 포커스 시 `scrollIntoView`, 색상 `Chip` 4택 44×44px). `members.length === 4`면 버튼 `disabled` + `"동거인은 최대 4명까지 등록할 수 있어요"`
  - 빈 상태: `members.length === 1` → `data-testid="members-solo"` + `Asset.ContentIcon` + `"아직 동거인이 없어요. 초대 코드를 공유해보세요"`
- DoD:
  - `{ name:"지영", colorToken:"green" }` 저장 → `members.length === 2`, 새 멤버 `isMe === false`, `id`가 `/^m_[a-z0-9]{8}$/`, 홈의 항목 행 멤버 Chip이 2개로 증가
  - "코드 복사" 탭 → `navigator.clipboard.writeText("K3M9QZ")` 호출 + Toast `"초대 코드를 복사했어요"`
  - `navigator.clipboard`를 undefined로, 또는 `writeText`를 reject로 stub → Toast `"코드를 길게 눌러 복사해주세요"`, `console.error` 0회, 크래시 없음
  - `members.length === 4`에서 추가 버튼 `disabled` + 안내 문구 렌더
  - `isMe` 행에 삭제 버튼 DOM 0개
  - 체크인 5건 보유 멤버 삭제 확인 → members에서 제거 + 해당 memberId checkIns 5건 제거, AlertDialog 문구에 `"기록 5건"` 포함
  - `members.length === 1`일 때 `members-solo` 렌더
  - `invite-card`가 TDS `Card`이고 코드가 t2 타이포, 복사 버튼이 `display="block"` + 높이 ≥48px
  - HEX 0건, 인라인 padding/margin 0건
- Covers: [F4-AC-1, F4-AC-2, F4-AC-3, F4-AC-4, F4-AC-5, F4-AC-6, F4-AC-7, F4-AC-8]
- Files: `src/pages/MembersPage.tsx`
- Depends on: Task 2.5

### Task 3.5 주간 리포트 게이트 `/report` (S5, F6 전반)
- Description: `src/pages/ReportPage.tsx`.
  - `ScreenScaffold` + `Top`("주간 리포트") + `Tab`("이번 주" / "지난 주", 각 항목 ≥44px)
  - `SummaryHero data-testid="fairness-hero"` — CountUp value = `fairnessScore`, suffix `"점"`, label `"이번 주 공정성 점수"` + 상태 `Chip`(90↑ `"공평해요"`, 60~89 `"조금 기울어요"`, 60 미만 `"많이 기울어요"`)
  - 요약 `Card` + `SubmitFooter` "상세 리포트 보기"(48px)
  - 잠금 상태(`unlocked[weekStart] !== true`)면 버튼을 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 감싸 시청 완료 시 `unlock(weekStart)` → `navigate('/report/detail', { state: { weekStart } })`
  - 이미 해제된 주면 `TossRewardAd` 렌더 없이 즉시 navigate
  - 광고 실패/중도 종료 → Toast `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"`, `report-unlocked` 불변, `/report` 유지, `console.error` 0회
  - `loading` 중 `data-testid="report-loading"` Skeleton 3줄(점수 Card 미렌더)
  - `totalWeighted === 0` → `data-testid="report-empty"` + `Asset.ContentIcon` + `"이번 주 기록이 아직 없어요"`, 버튼 `disabled`
- DoD:
  - 잠금 상태에서 "상세 리포트 보기" 탭 → 광고 시청 완료 콜백 후 `choresplit:report-unlocked`에 `{"2026-08-31":true}` 저장 + `/report/detail`로 이동(state `{ weekStart: "2026-08-31" }`)
  - `unlocked["2026-08-31"] === true` 상태에서 탭 → `TossRewardAd` 렌더/호출 없이 즉시 이동
  - 광고 실패 stub → Toast 문구 정확히 일치, `report-unlocked` 값 불변, 경로 `/report` 유지, `console.error` 0회
  - `loading` 중 `report-loading` 존재 + 점수 Card 부재
  - `totalWeighted === 0` → `report-empty` 렌더 + 버튼 `disabled`
  - fairnessScore 95 / 75 / 40에서 Chip 문구가 각각 `"공평해요"` / `"조금 기울어요"` / `"많이 기울어요"`
  - Tab "지난 주" 선택 시 hero 값이 지난 주 `fairnessScore`로 갱신되고 navigate 시 해당 `weekStart` 전달
  - 광고 슬롯 ID가 `import.meta.env.VITE_TOSS_AD_SLOT_ID`로만 참조(리터럴 0건), HEX 0건
- Covers: [F6-AC-1, F6-AC-2, F6-AC-3, F6-AC-5, F6-AC-6, F6-AC-8, CK-12]
- Files: `src/pages/ReportPage.tsx`
- Depends on: Task 2.3, Task 2.5

### Task 3.6 주간 리포트 상세 `/report/detail` (S6)
- Description: `src/pages/ReportDetailPage.tsx`.
  - Incoming: `const st = (useLocation().state as RouteState['/report/detail']) ?? null;` → `const weekStart = st?.weekStart ?? getWeekStart(todayKST());` → `if (!unlocked[weekStart]) return <Navigate to="/report" replace />;` (배열 사용 전 존재 확인 후 `.map()`)
  - `ScreenScaffold` + `Top`("상세 리포트")
  - `Card data-testid="report-card"` 3개: ① 멤버별 비중(`MiniBar data-testid="share-bar"` 멤버 수만큼, `sharePct` t3 강조) ② 요일 추이(`Sparkline data-testid="trend-spark"` 데이터 길이 7, 1개) ③ 미이행·벌금(`ListRow` + 벌금 `Chip`; 0건이면 `"모든 항목을 완수했어요"`)
  - 미이행 Card 아래 `Spacing size={24}` + `<AdSlot data-testid="report-ad" adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`
  - `SubmitFooter` "정산 보기"(48px) → `navigate('/settle', { state: { weekStart } })`
  - `loading` 중 `data-testid="report-loading"` Skeleton 3줄
- DoD:
  - **`location.state === null`로 `/report/detail` 직접 진입(새로고침 포함): 해당 주가 잠금이면 `/report`로 replace 리다이렉트, 해제된 주면 이번 주 리포트를 정상 렌더 — 어느 경우도 크래시하지 않음 (F6-AC-4)**
  - `report-card` 3개 이상 렌더, `share-bar` 개수 === 멤버 수, `trend-spark` 1개(데이터 길이 7)
  - 각 멤버 `sharePct`가 t3 강조 타이포로 표기
  - 미이행 0건 주간 → 미이행 Card 안에 `"모든 항목을 완수했어요"` 렌더
  - `report-ad`가 미이행 Card 뒤 DOM 순서에 정확히 1개 위치, 콘텐츠와 겹치는 `position: fixed/absolute` 0건
  - `loading` 중 `report-loading` 존재 + `report-card` 부재
  - "정산 보기" 탭 → `/settle`로 이동하며 state `{ weekStart }` 전달
  - 광고 ID 리터럴 0건(env 참조만), HEX 0건, 인라인 padding/margin 0건
- Covers: [F6-AC-4, F6-AC-5, F6-AC-7, F6-AC-9, CK-12]
- Files: `src/pages/ReportDetailPage.tsx`
- Depends on: Task 2.3, Task 2.5

### Task 3.7 벌금 정산 `/settle` (S7, F7)
- Description: `src/pages/SettlePage.tsx`.
  - Incoming: `const st = (useLocation().state as RouteState['/settle']) ?? null; const weekStart = st?.weekStart ?? getWeekStart(todayKST());`
  - `ScreenScaffold` + `Top`("정산") + `SummaryHero data-testid="settle-hero"`(CountUp = `totalPenalty`, suffix `"원"`, label `"이번 주 벌금 합계"`)
  - 송금 라인마다 `Card data-testid="settle-line-card"` — 금액 t3 강조 + `Chip` 배지, `"1,500원"` 천 단위 구분 포맷
  - 멤버별 부담액 `ListRow`(≥56px), 고지 `Paragraph.Text` `"실제 송금은 직접 진행해주세요"` 항상 렌더
  - `SubmitFooter` "정산 완료"(48px) → `AlertDialog` `"이번 주 정산을 마감할까요?"` → 확인 시 `mutate`로 `settlements`에 `SettlementRecord` 추가 + Toast `"정산을 마감했어요"`. 저장 실패 시 F1-AC-5 문구 Toast
  - 이미 마감된 주 → 버튼 `disabled` + `Chip` `"마감됨"`, 저장된 `lines`를 그대로 렌더(재계산 금지)
  - `settings.penaltyEnabled === false` → `data-testid="settle-disabled"` + `"벌금 기능이 꺼져 있어요"` + "설정으로 가기" 버튼(`navigate('/settings')`), 라인 미렌더
  - `totalPenalty === 0` 또는 `members.length === 1` → `data-testid="settle-empty"` + `Asset.ContentIcon` + `"이번 주 정산할 벌금이 없어요"`, 버튼 `disabled`
  - `loading` 중 `data-testid="settle-loading"` Skeleton 2줄
  - 파일 내 `IAP`, `TossPurchase`, `grantPromotionReward` 사용 0건
- DoD:
  - totalPenalty 2500 / 민수 80% / 지영 20% → `settle-line-card` 1개에 `"1,500원"` 표시, 부담액 ListRow에 `"500원"`(민수) `"2,000원"`(지영)
  - "정산 완료" → AlertDialog `"이번 주 정산을 마감할까요?"` → 확인 시 `settlements`에 `{ weekStart:"2026-08-31", totalPenalty:2500, lines:[{ fromMemberId: 지영, toMemberId: 민수, amount:1500 }] }` 저장 + Toast `"정산을 마감했어요"`
  - 마감된 주 재진입 → 버튼 `disabled`, `"마감됨"` Chip 렌더, 저장된 lines가 그대로 표시(재계산 결과와 무관)
  - `penaltyEnabled === false` → `settle-disabled` 렌더, `settle-line-card` DOM 0개
  - `totalPenalty === 0` 또는 멤버 1명 → `settle-empty` 렌더 + 버튼 `disabled`
  - `loading` 중 `settle-loading` Skeleton 2줄 존재 + `settle-hero` 부재
  - **`location.state === null`로 `/settle` 직접 진입 시 크래시 없이 이번 주 정산이 렌더됨**
  - **`saveState` 실패 stub 시 F1-AC-5 문구 Toast 표시 + 화면 상태 롤백, 크래시 없음**
  - `"실제 송금은 직접 진행해주세요"` 문구가 정상/빈/비활성 모든 상태에서 렌더
  - 파일 grep 결과 `IAP` / `TossPurchase` / `grantPromotionReward` 0건, HEX 0건
- Covers: [F1-AC-5, F7-AC-1, F7-AC-2, F7-AC-3, F7-AC-4, F7-AC-5, F7-AC-6, F7-AC-7, F7-AC-8, CK-9]
- Files: `src/pages/SettlePage.tsx`
- Depends on: Task 2.3, Task 2.5

### Task 3.8 스트릭·랭킹 `/streak` (S8, F8 렌더)
- Description: `src/pages/StreakPage.tsx`.
  - `ScreenScaffold` + `Top`("스트릭") + `SummaryHero data-testid="streak-hero"`(CountUp = 본인 `getStreak`, suffix `"일"`, label `"연속 기록"`)
  - `Card data-testid="ranking-card"` 1개 — 멤버당 `ListRow`(≥56px) + `MiniBar data-testid="ranking-bar"`, 1위 행에 `Chip` `"1위"`. 멤버 행 탭 → `navigate('/members')`(state 없음)
  - 랭킹 Card 아래 `Spacing size={24}` + `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`
  - 빈 상태: 최근 30일 체크인 0건 → `data-testid="ranking-empty"` + `Asset.ContentIcon` + `"아직 기록이 없어요"`, 스트릭 `0`
  - 로딩: `data-testid="streak-loading"` Skeleton 2줄, 이때 hero 미렌더
  - 계산 예외 시 랭킹 Card 대신 `"기록을 불러오지 못했어요"` 렌더(try/catch, `console.error` 금지)
- DoD:
  - 09-01~09-03 체크인 픽스처에서 `streak-hero` CountUp 목표값 3, suffix `"일"`
  - 랭킹 24/24/10 픽스처 → `ranking-card` 1개 안에 ListRow 3개가 `[민수, 지영, 현우]` 순, `ranking-bar` 3개, 첫 행에만 `"1위"` Chip
  - 최근 30일 0건 → `ranking-empty` 렌더 + hero 값 `0`
  - `loading` 중 `streak-loading` 존재 + `streak-hero` 부재
  - `getRanking`을 throw로 stub → `"기록을 불러오지 못했어요"` 렌더, `console.error` 0회, 앱 크래시 없음
  - 멤버 ListRow 탭 → 경로 `/members`, state 전달 없음
  - `AdSlot`이 랭킹 Card 뒤 DOM 순서에 1개, 광고 ID 리터럴 0건, HEX 0건
- Covers: [F8-AC-3, F8-AC-7, F8-AC-8, F8-AC-9]
- Files: `src/pages/StreakPage.tsx`
- Depends on: Task 2.4, Task 2.5

### Task 3.9 설정 `/settings` (S9)
- Description: `src/pages/SettingsPage.tsx`.
  - `ScreenScaffold` + `Top`("설정")
  - `ListRow` + `Switch`: 리마인더 on/off(`settings.reminderEnabled`), 벌금 기능 on/off(`settings.penaltyEnabled`). 저장 중 해당 Switch `disabled`
  - `ListRow`("리마인더 시간", 우측 `{hour}시`) → `BottomSheet`에서 0~23 `Chip` 선택 → `settings.reminderHour` 저장
  - `ListRow`("집안일 항목 관리" → `navigate('/chores')`), `ListRow`("동거인 관리" → `navigate('/members')`) — 모두 state 없음
  - `ListRow`("오래된 기록 정리") → `AlertDialog` 확인 시 `pruneOlderThan(state, 30)` 결과 저장 + Toast
  - 하단 `Paragraph.Text` 버전/고지. 저장 실패 시 F1-AC-5 문구 Toast
  - 모든 ListRow ≥56px, Switch 터치 영역 44×44px. `Card` / `SummaryHero` / 차트 미사용
- DoD:
  - 리마인더 Switch off → `settings.reminderEnabled === false` 저장, 이후 홈에서 시각 무관 `reminder-banner` 미렌더
  - 벌금 Switch off → `settings.penaltyEnabled === false` 저장, `/settle`에서 `settle-disabled` 렌더
  - 시간 BottomSheet에서 `9` 선택 → `settings.reminderHour === 9` 저장 및 ListRow 우측 `"9시"` 표시
  - "오래된 기록 정리" 확인 → 31일 이전 checkIns 제거, 30일 이내 레코드 보존
  - **`saveState` 실패 stub 시 Toast `"저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"` 표시, Switch 값 롤백, 크래시 없음 (F1-AC-5)**
  - "집안일 항목 관리" / "동거인 관리" 탭 시 각각 `/chores`, `/members`로 이동(state 없음)
  - `Card` / `SummaryHero` 사용 0건, HEX 0건, 인라인 padding/margin 0건
- Covers: [F1-AC-5, F7-AC-4, F8-AC-5]
- Files: `src/pages/SettingsPage.tsx`
- Depends on: Task 2.5

---

## Epic 4. 통합 + 폴리시

**Risk Assessment**
- Complexity: Medium
- Risk factors: (1) 온보딩 가드가 라우터에 없으면 `household === null` 상태로 홈이 렌더돼 크래시, (2) 검수 반려 항목(HEX, 외부 링크, `console.error`, es2019 타깃)이 개별 페이지 DoD만으로는 전역 검증되지 않음, (3) FloatingTabBar 미배치로 화면 간 이동 불가, (4) 120일 정리·용량 초과 처리가 실제 플로우에서 미검증.
- Mitigation: 모든 페이지 완성 후 라우팅 배선(4.1) → 전역 검수 스윕(4.2) 순으로 진행해, 가드·광고 위치·금지 패턴·저장 한도를 리포지토리 전체 grep + 실제 플로우 실행으로 한 번에 검증한다.

### Task 4.1 라우터 배선 + 온보딩 가드 + FloatingTabBar
- Description: `src/App.tsx`, `src/main.tsx`, `vite.config.ts`.
  - `BrowserRouter` + `AppStateProvider`로 앱 래핑
  - 9개 라우트 등록: `/`, `/onboarding`, `/members`, `/chores`, `/report`, `/report/detail`, `/settle`, `/streak`, `/settings`
  - `RequireHousehold` 가드: `loading`이면 `data-testid="app-loading"` Skeleton, `household === null`이면 `<Navigate to="/onboarding" replace />`. `/onboarding` 라우트는 반대로 `household !== null`이면 `<Navigate to="/" replace />`
  - `FloatingTabBar`(템플릿 제공) 배치 — 홈/리포트/스트릭/설정 4탭, 각 터치 타깃 ≥44px. `/onboarding`과 `/report/detail`에서는 미렌더
  - 알 수 없는 경로 → `<Navigate to="/" replace />`
  - `vite.config.ts`에 `build: { target: 'es2019' }` 설정
- DoD:
  - 저장소 비어있는 상태로 `/`, `/chores`, `/settle`, `/streak` 진입 시 모두 `/onboarding`으로 리다이렉트
  - household 존재 상태로 `/onboarding` 진입 시 `/`로 replace 리다이렉트
  - 9개 경로 모두 직접 URL 진입(새로고침 포함) 시 크래시 없이 렌더 또는 정의된 리다이렉트 수행
  - 초기 마운트 시 `app-loading` Skeleton이 최소 1프레임 렌더되고 그동안 홈 콘텐츠 미렌더
  - FloatingTabBar 4탭 탭 시 각각 `/`, `/report`, `/streak`, `/settings`로 이동, `/onboarding`·`/report/detail`에서는 DOM에 미존재
  - `/없는경로` → `/`로 replace 이동
  - `npm run build` 성공, 번들에 es2019 초과 문법 0건
- Covers: [F1-AC-2, F1-AC-6, CK-4]
- Files: `src/App.tsx`, `src/main.tsx`, `vite.config.ts`
- Depends on: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6, Task 3.7, Task 3.8, Task 3.9

### Task 4.2 검수 준수 스윕 (전역 정적 검사 + 플로우 검증)
- Description: 전체 소스 대상 검수 체크리스트 자동 검증 + 위반 수정.
  - `scripts/audit.mjs` 작성 — `src/**` 정적 검사 후 위반 시 exit 1:
    - `/#[0-9a-fA-F]{3,8}\b/` 0건 (색상은 `var(--tds-color-*)` 또는 TDS 기본값만)
    - `window.open(`, `window.location.href =`, `<a href="http` 0건
    - `console.error` 0건
    - `fetch(`, `XMLHttpRequest` 0건
    - `.at(`, `Object.groupBy`, `structuredClone`, `.findLast(` 0건
    - `"설치"`, `"다운로드"`, `"앱스토어"`, `"Play 스토어"` 0건
    - `google-analytics|gtag|amplitude|mixpanel|sentry` import/스크립트 0건
    - `grantPromotionReward`, `IAP`, `TossPurchase` 0건
    - 광고 ID 리터럴 0건 (`VITE_TOSS_AD_GROUP_ID` / `VITE_TOSS_AD_SLOT_ID` env 참조만)
    - `package.json` dependencies에 `@mui/`, `antd`, `@chakra-ui/`, `shadcn` 0건
    - TDS 컴포넌트에 인라인 `style={{ padding|margin` 0건
    - `Notification` / `requestPermission` / `serviceWorker.register` 0건
  - `npm run audit` 스크립트 등록, 검출된 위반 전부 수정
  - 프로덕션 빌드 후 전체 플로우(온보딩 → 체크인 → 리포트 게이트/상세 → 정산 → 스트릭 → 설정) 1회 실행하며 콘솔·네트워크 확인
  - **용량 시나리오 검증: `localStorage.setItem`을 QuotaExceededError로 강제한 상태에서 체크인/설정 저장 시 F1-AC-5 문구 Toast만 뜨고 앱이 크래시하지 않음**
  - **보관 정책 검증: 121일 전 checkIn 픽스처 주입 후 아무 mutation 1회 → 해당 레코드가 저장소에서 제거됨 (F1-AC-7)**
  - 인터랙티브 요소(버튼/칩/스위치/탭/ListRow) 렌더 크기 44×44px 이상 확인
- DoD:
  - `npm run audit` exit code 0
  - `npm run build` 성공 후 전체 플로우 실행 시 `console.error` 0건, 네트워크 요청은 토스 SDK 광고 외 0건(CORS 에러 0건)
  - QuotaExceededError 강제 시 Toast 1개 + 크래시 0회, 121일 초과 레코드 제거 확인
  - 다크모드 토글 시 전 화면 텍스트/배경이 TDS 토큰 기본값으로 렌더(가독 대비 유지)
  - 버튼/칩/스위치/탭/ListRow의 `getBoundingClientRect()` 최소변이 44px 이상
  - `.env.example`에 `VITE_TOSS_AD_GROUP_ID`, `VITE_TOSS_AD_SLOT_ID` 항목 존재
- Covers: [F1-AC-5, F1-AC-7, F1-AC-8, F3-AC-9, F8-AC-6, CK-1, CK-2, CK-3, CK-4, CK-5, CK-6, CK-7, CK-8, CK-9, CK-10, CK-11, CK-12]
- Files: `scripts/audit.mjs`, `package.json`, `.env.example`
- Depends on: Task 4.1

---

## AC Coverage

- **Total ACs in SPEC: 79** — 기능 AC 67개(F1: 8, F2: 8, F3: 9, F4: 8, F5: 8, F6: 9, F7: 8, F8: 9) + 검수 체크리스트 CK 12개
- **Covered by tasks: 79 (100%)**

| AC | Task(s) |
|---|---|
| F1-AC-1 | 2.2, 3.1 |
| F1-AC-2 | 3.1, 3.2, 4.1 |
| F1-AC-3 | 2.2, 3.1 |
| F1-AC-4 | 2.1 |
| **F1-AC-5** | **2.1, 2.5, 3.1, 3.7, 3.9, 4.2** |
| F1-AC-6 | 2.5, 3.2, 4.1 |
| **F1-AC-7** | **2.1, 4.2** |
| F1-AC-8 | 1.1, 4.2 |
| F2-AC-1 | 2.2, 3.3 |
| F2-AC-2 | 2.2, 3.3 |
| F2-AC-3 | 2.2, 3.3 |
| F2-AC-4 | 2.2, 3.3 |
| F2-AC-5 | 2.2, 3.3 |
| F2-AC-6 | 3.3 |
| F2-AC-7 | 3.3 |
| F2-AC-8 | 3.3 |
| F3-AC-1 | 2.2, 3.2 |
| F3-AC-2 | 2.2, 3.2 |
| F3-AC-3 | 2.2, 3.2 |
| F3-AC-4 | 2.2, 3.2 |
| **F3-AC-5** | **2.5, 3.2** |
| F3-AC-6 | 3.2 |
| F3-AC-7 | 3.2 |
| F3-AC-8 | 3.2 |
| F3-AC-9 | 3.2, 4.2 |
| F4-AC-1 | 2.2, 3.4 |
| F4-AC-2 | 3.4 |
| F4-AC-3 | 3.4 |
| F4-AC-4 | 2.2, 3.4 |
| F4-AC-5 | 2.2, 3.4 |
| F4-AC-6 | 2.2, 3.4 |
| F4-AC-7 | 3.4 |
| F4-AC-8 | 3.4 |
| F5-AC-1 | 2.3 |
| F5-AC-2 | 2.3 |
| **F5-AC-3** | **2.3** |
| F5-AC-4 | 2.3 |
| F5-AC-5 | 2.3 |
| F5-AC-6 | 2.3 |
| F5-AC-7 | 2.3 |
| F5-AC-8 | 2.3 |
| F6-AC-1 | 2.5, 3.5 |
| F6-AC-2 | 3.5 |
| F6-AC-3 | 3.5 |
| F6-AC-4 | 3.6 |
| F6-AC-5 | 3.5, 3.6 |
| F6-AC-6 | 3.5 |
| F6-AC-7 | 3.6 |
| F6-AC-8 | 3.5 |
| F6-AC-9 | 3.6 |
| F7-AC-1 | 2.3, 3.7 |
| F7-AC-2 | 3.7 |
| F7-AC-3 | 3.7 |
| F7-AC-4 | 3.7, 3.9 |
| F7-AC-5 | 3.7 |
| F7-AC-6 | 3.7 |
| F7-AC-7 | 3.7 |
| F7-AC-8 | 3.7 |
| F8-AC-1 | 2.4 |
| F8-AC-2 | 2.4 |
| F8-AC-3 | 2.4, 3.8 |
| F8-AC-4 | 2.4, 3.2 |
| F8-AC-5 | 2.4, 3.2, 3.9 |
| F8-AC-6 | 2.4, 4.2 |
| F8-AC-7 | 3.8 |
| F8-AC-8 | 3.8 |
| F8-AC-9 | 3.8 |
| CK-1 | 3.2, 4.2 |
| CK-2 | 4.2 |
| CK-3 | 4.2 |
| CK-4 | 2.1, 4.1, 4.2 |
| CK-5 | 4.2 |
| CK-6 | 4.2 |
| CK-7 | 4.2 |
| CK-8 | 4.2 |
| CK-9 | 3.7, 4.2 |
| CK-10 | 4.2 |
| CK-11 | 4.2 |
| CK-12 | 3.2, 3.5, 3.6, 4.2 |

- **Uncovered: 0**

**재발 방지 메모 (SplitMate 실사고)** — `location.state` 수신 화면 3곳 모두 DoD에 "state 없이 직접 진입해도 크래시하지 않는다"를 필수 항목으로 명시했다: Task 3.3(`/chores`), Task 3.6(`/report/detail`), Task 3.7(`/settle`).