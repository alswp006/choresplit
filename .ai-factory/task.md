# TASK — choresplit

> SPEC 기준 구현 작업 분해. 각 Task = 1 코딩 세션(<10분). 순서 엄수: 타입 → 데이터/도메인 → 스토어 → 페이지 → 통합.
> 공통 전제: 템플릿이 이미 제공하는 것(TDS 셋업, `AdSlot`, `TossRewardAd`, `TossPurchase`, `FloatingTabBar`, `ScreenScaffold`, 토스 세션 자동 제공)은 재구현하지 않는다.

---

## Epic 1. TypeScript 타입 & 인터페이스

**Risk Assessment**
- Complexity: **Low**
- Risk factors: 페이지 간 `location.state` 형태 불일치(S5→S6 `weekKey`, S4→S2 `toast`, S6→S3 `openCreate`)로 런타임 크래시. 타입이 늦게 정의되면 각 페이지가 임의 shape를 만들어 나중에 전면 수정 필요.
- Mitigation: 모든 엔티티 + `RouteState`를 **최초 Task**에서 단일 파일에 고정하고, 이후 모든 페이지 패킷이 이 파일만 import하도록 강제한다.

### Task 1.1 도메인 타입 + RouteState 정의
- **Description**: `src/lib/types.ts`에 SPEC Data Models 전체(`Household`, `Member`, `Weekday`, `Difficulty`, `ChoreTask`, `ChoreLog`, `AppSettings`)와 파생 계산 타입(`FairnessResult`, `MemberShare`, `FineSummary`, `UnfulfilledItem`, `RankRow`, `StreakResult`, `SnapshotV1`), localStorage 키 상수(`STORAGE_KEYS`), 상한 상수(`MAX_MEMBERS=4`, `MAX_TASKS=30`, `MAX_FINE=10000`, `LOG_KEEP_DAYS=180`, `BACKFILL_DAYS=7`, `MAX_CODE_LENGTH=4000`, `MAX_UNLOCKED_WEEKS=12`, `MAX_WEEK_BACK=12`)를 정의한다. **런타임 로직 0줄**(타입 + `as const` 상수만).
- **DoD**:
  - `npx tsc --noEmit` 통과.
  - `RouteState`가 아래 형태로 정확히 export 된다:
    ```ts
    export type RouteState = {
      "/": { toast?: string } | undefined;
      "/onboarding": undefined;
      "/tasks": { openCreate?: boolean; focusTaskId?: string } | undefined;
      "/report": { weekKey: string } | undefined;
      "/settle": { weekKey: string } | undefined;
      "/ranking": undefined;
      "/invite": undefined;
      "/settings": undefined;
    };
    ```
  - `STORAGE_KEYS`에 `household/tasks/logs/settings/schema/backup/logsCorrupt` 7개 키가 SPEC 문자열과 1:1 일치.
  - 파일에 `import` 문이 0개, `function`/`const 값 계산` 없음(상수 리터럴 제외).
- **Covers**: (기반 타입 — 전 AC의 전제. 직접 검증 AC 없음)
- **Files**: `src/lib/types.ts`
- **Depends on**: none

---

## Epic 2. 데이터 레이어 (storage / domain / repository / store)

**Risk Assessment**
- Complexity: **High**
- Risk factors:
  - localStorage 5MB 상한 — 로그 8,000건(~1.0MB) + 병합 백업(~1.0MB) + corrupt 백업(~1.0MB) 동시 존재 시 3.1MB까지 상승, 저사양 기기 quota 초과 가능.
  - 손상 JSON(`"{{{"`)이 부팅 시 앱 전체를 크래시시킬 수 있음.
  - 주 경계(KST 월요일 시작) 계산 오류 시 F5·F6·F7 결과가 전부 함께 틀어짐.
  - 계산 로직이 페이지에 흩어지면 공정성 점수가 화면마다 달라짐(진실 원천 중복).
- Mitigation: `safeGet/safeSet`을 **모든 쓰기의 단일 관문**으로 먼저 만들고(2.1), 주 경계 유틸(2.2)을 fairness/fine/streak(2.3~2.5)보다 먼저 확정한다. 계산은 전부 순수 함수로 분리해 페이지는 렌더만 담당하게 하고, 파생값(스트릭·랭킹)은 저장하지 않는다.

### Task 2.1 storage.ts — safeGet / safeSet / pruneLogs / 스키마 버전
- **Description**: `src/storage/storage.ts`에 SPEC "접근 계약" 3개 함수 구현. `safeGet<T>`은 `JSON.parse` 실패 시 원본 문자열을 `<key>.corrupt`에 백업 후 fallback 반환하고 `didRecover` 플래그를 모듈 내 큐에 기록. `safeSet<T>`은 직렬화 실패 → `{ok:false, reason:'serialize'}`, `QuotaExceededError` → 로그 키를 90일로 prune 후 **정확히 1회** 재시도, 그래도 실패 시 `{ok:false, reason:'quota'}`. `pruneLogs(logs, keepDays)`는 KST 기준 오늘 - keepDays 이전 로그 제거. `readSchema()`는 `{version:1}`이 아니면 키를 **삭제하지 않고** `{ compatible:false }` 반환.
- **DoD**:
  - `safeGet(LOGS, [])`에 `"{{{"`가 저장돼 있으면 `[]` 반환 + `localStorage['choresplit:logs:v1.corrupt'] === "{{{"` + `consumeRecoveryFlags()`가 `['choresplit:logs:v1']` 1회 반환(2회째 빈 배열).
  - `setItem`이 항상 `QuotaExceededError`를 던지는 목에서 `safeSet`이 `{ok:false, reason:'quota'}`를 반환하고 예외를 밖으로 던지지 않으며 `setItem` 호출 횟수가 2회(원본+재시도) 이하.
  - `pruneLogs(logs, 180)`가 181일 전 로그를 제거, 180일 전 로그는 유지.
  - 파일 어디에도 `console.error` 없음.
- **Covers**: [F1-AC4, F1-AC5, F1-AC8]
- **Files**: `src/storage/storage.ts`
- **Depends on**: Task 1.1

### Task 2.2 date.ts — KST 날짜/주 경계 유틸
- **Description**: `src/domain/date.ts`에 `todayKST(): string("YYYY-MM-DD")`, `toDateKey(d: Date)`, `weekdayOf(dateKey): Weekday`, `weekKeyOf(dateKey): "YYYY-Www"`(월요일 시작), `weekRange(weekKey): { start, end, days: string[7] }`, `shiftWeek(weekKey, delta)`, `daysBetween(a,b)`, `isFutureDate(dateKey)`, `shouldShowReminder(nowHHmm, reminderTime, todayLogCount, enabled): boolean`, `formatDateLabel(dateKey): "09/01(월)"` 구현. **금지 API 미사용**: `Array.prototype.at`, `Object.groupBy`, `structuredClone`, `Intl.Segmenter`.
- **DoD**:
  - `weekKeyOf('2026-09-02') === '2026-W36'`, `weekRange('2026-W36').days[0] === '2026-08-31'`(월), `.days[6] === '2026-09-06'`(일).
  - `shiftWeek('2026-W36', -1) === '2026-W35'`, `shiftWeek('2026-W01', -1)`이 전년도 마지막 주를 반환하며 예외 없음.
  - `shouldShowReminder('21:30','21:00',0,true) === true`, `('20:00','21:00',0,true) === false`, `('21:30','21:00',1,true) === false`, `(*, *, 0, false) === false`.
  - `isFutureDate(내일) === true`.
  - `grep -n "\.at(\|Object.groupBy\|structuredClone" src/domain/date.ts` 결과 0건.
- **Covers**: [F8-AC1, F8-AC2]
- **Depends on**: Task 1.1
- **Files**: `src/domain/date.ts`

### Task 2.3 fairness.ts — 공정성 점수 순수 함수
- **Description**: `src/domain/fairness.ts`에 `calcFairness(weights: {memberId,weight}[], targets: Record<string,number>): FairnessResult` 구현. `share_i = weight_i/total`, `fairness = max(0, round(100 - Σ|share_i - target_i|*100))`, `total===0`이면 `{fairness:0, shares:{모두 0}, isEmpty:true}`. 부수 함수 `gradeOf(fairness): '완벽'|'양호'|'주의'|'불균형'`(90↑/70~89/40~69/40미만), `weeklyWeightsByMember(logs, members, weekKey)`, `weightByTask(logs, tasks, weekKey)`, `dailyWeights(logs, weekKey): number[7]` 포함.
- **DoD**:
  - `calcFairness([{memberId:'a',weight:6},{memberId:'b',weight:4}], {a:0.5,b:0.5})` → `{ fairness: 80, shares:{a:0.6,b:0.4} }` (정확히 일치).
  - `calcFairness([{a,0},{b,0}], {a:0.5,b:0.5})` → `{ fairness:0, shares:{a:0,b:0}, isEmpty:true }`.
  - `gradeOf(90)==='완벽'`, `gradeOf(89)==='양호'`, `gradeOf(40)==='주의'`, `gradeOf(39)==='불균형'`.
  - `dailyWeights`가 항상 길이 7 배열 반환(로그 0건이면 `[0,0,0,0,0,0,0]`).
  - 파일에 `localStorage` 접근 0건(순수 함수).
- **Covers**: [F1-AC7, F5-AC3]
- **Files**: `src/domain/fairness.ts`
- **Depends on**: Task 1.1, Task 2.2

### Task 2.4 fine.ts — 미이행 집계 & 정산 제안
- **Description**: `src/domain/fine.ts`에 `calcUnfulfilled(tasks, logs, members, weekKey): UnfulfilledItem[]`(주의 각 날짜 d에 대해 `task.repeatDays.includes(weekdayOf(d)) && task.assigneeId === m.id && 해당 (taskId,memberId,d) 로그 없음`, `assigneeId === null`이면 **제외**, `archived === true`이면 제외, 미래 날짜 제외), `calcFines(items): FineSummary[]`(구성원별 합계), `calcSettlement(fines, memberCount)` 구현 — 2인이면 `net = fine_A - fine_B`로 `{type:'transfer', from, to, amount}` 또는 `{type:'none'}`, 3인 이상이면 `{type:'listOnly'}`.
- **DoD**:
  - `tk_설거지(repeatDays:[1,3,5], assignee:mb_민지, fine:1000)`이고 월·수만 체크인된 주 → `calcUnfulfilled` 길이 1, `calcFines` → `[{memberId:'mb_민지', amount:1000, count:1}]`.
  - `assigneeId === null` + `fineAmount:2000` 미이행 항목은 결과 배열에 포함되지 않고, `hasUnassignedFineTask === true` 플래그가 반환됨.
  - 민지 3000 / 현우 0 → `{type:'transfer', from:'mb_민지', to:'mb_현우', amount:3000}`.
  - 민지 2000 / 현우 2000 → `{type:'none'}`.
  - 구성원 3명 → `{type:'listOnly'}`.
- **Covers**: [F6-AC1, F6-AC3, F6-AC5, F6-AC7]
- **Files**: `src/domain/fine.ts`
- **Depends on**: Task 1.1, Task 2.2

### Task 2.5 streak.ts + ranking.ts — 스트릭 / 주간 랭킹
- **Description**: `src/domain/streak.ts`에 `calcStreak(logs, memberId, todayKey): StreakResult`(오늘 또는 어제부터 역순 연속 일수, 오늘 로그 없으면 어제까지 유지, 마지막 로그가 이틀 이상 전이면 0, `badge: null|'7일 연속 달성 🔥'|'30일 연속 🏆'`). `src/domain/ranking.ts`에 `calcRanking(logs, members, weekKey): RankRow[]`(weight 내림차순 → 로그 건수 내림차순 → `createdAt` 오름차순, `ratio = weight / maxWeight`, `isTop`은 1위만 true). **두 함수 모두 `isFutureDate(log.date)`인 로그를 입력에서 제외**.
- **DoD**:
  - 로그가 `08-31, 09-01, 09-02`, 오늘 `2026-09-02` → `streak === 3`.
  - 마지막 로그 `08-30`, 오늘 `09-02` → `streak === 0`.
  - 마지막 로그가 어제(`09-01`), 오늘 로그 0건 → `streak >= 1`(유지).
  - 민지 weight 4/로그 2건, 현우 weight 4/로그 4건 → `calcRanking()[0].memberId === 'mb_현우'`, `[0].isTop === true`, `[1].isTop === false`.
  - 민지 6 / 현우 4 → ratio가 각각 `1`, `0.67`(소수 2자리 반올림).
  - 미래 날짜 로그 1건을 섞어도 두 함수 모두 예외 없이 동일 결과 반환.
- **Covers**: [F7-AC1, F7-AC2, F7-AC3, F7-AC4, F7-AC7]
- **Files**: `src/domain/streak.ts`, `src/domain/ranking.ts`
- **Depends on**: Task 1.1, Task 2.2

### Task 2.6 repository.ts — 엔티티 CRUD + 기본 항목 시딩
- **Description**: `src/storage/repository.ts`에 `storage.ts`만 경유하는 CRUD 구현: `loadAll(): {household, tasks, logs, settings, schemaCompatible, recoveredKeys}`, `createHousehold(name, memberInputs)`(id는 `hh_`/`mb_` + 8자리 base36, `targetShare = 1/n`), `seedDefaultTasks()`(설거지 🍽️ / 청소 🧹 / 빨래 🧺 / 분리수거 ♻️ / 요리 🍳 / 화장실청소 🚽, `difficulty:2`, `repeatDays:[]`, `assigneeId:null`, `fineAmount:0`), `upsertTask`, `archiveTask`, `toggleLog(date, taskId, memberId, weight)`(로그 id = `lg_${date}_${taskId}_${memberId}` **멱등**), `saveSettings`, `pruneOldLogs(keepDays)`, `resetAll()`(`choresplit:` 접두 키 전부 제거).
- **DoD**:
  - `createHousehold('우리집',[민지,현우])` 후 저장된 `members.length === 2`이고 각 `targetShare === 0.5`, `settings.onboardingDone === true`, `settings.activeMemberId === members[0].id`.
  - `seedDefaultTasks()` 후 `tasks.length === 6`이고 이름 6종이 SPEC과 일치.
  - `toggleLog` 동일 인자 3회 연속 호출 → 로그 배열 길이 `1 → 0 → 1`, 절대 2가 되지 않음.
  - `archiveTask('tk_1')` 후 `tasks.find(id==='tk_1').archived === true`이고 `logs.length` 변화 0.
  - `upsertTask`가 `updatedAt`을 `Date.now()`로 갱신하고 기존 `ChoreLog.weight`는 수정하지 않음.
  - `resetAll()` 후 `Object.keys(localStorage).filter(k=>k.startsWith('choresplit:')).length === 0`.
- **Covers**: [F1-AC1, F2-AC3, F3-AC3, F8-AC5]
- **Files**: `src/storage/repository.ts`
- **Depends on**: Task 2.1, Task 2.2

### Task 2.7 AppStore — 전역 상태 / 부팅 / 저장 실패 알림
- **Description**: `src/store/AppStore.tsx`에 React Context + `useReducer` 기반 스토어 구현. `status: 'booting'|'ready'`, 상태로 `household/tasks/logs/settings/schemaCompatible` 보유. 마운트 시 `loadAll()` 1회 호출 후 `ready`. 모든 뮤테이션 액션은 repository 결과가 `{ok:false}`면 **상태를 롤백**하고 `reason`에 따라 Toast 문구를 큐에 넣는다(`quota` → "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요"). 복구 플래그가 있으면 "일부 기록을 읽지 못했어요" Toast를 **1회만** 큐잉. `useApp()` 훅 export.
- **DoD**:
  - `useApp()`을 Provider 밖에서 호출하면 명확한 에러 메시지를 던짐.
  - 부팅 중 `status === 'booting'`, `loadAll` 완료 후 `'ready'`이며 재마운트 없이 `loadAll` 호출 횟수 1회.
  - `safeSet`이 `{ok:false,reason:'quota'}`를 반환하는 목에서 `toggleLog` 디스패치 → 상태의 `logs`가 호출 전과 **동일**(롤백)하고 Toast 큐에 quota 문구 1건.
  - corrupt 복구 플래그가 있는 부팅에서 Toast 큐에 "일부 기록을 읽지 못했어요"가 정확히 1건(리렌더 10회 후에도 1건 유지).
  - 스토어 파일에 `console.error` 0건.
- **Covers**: [F1-AC4, F1-AC5, F1-AC6]
- **Files**: `src/store/AppStore.tsx`
- **Depends on**: Task 2.6

### Task 2.8 sharecode.ts — 공유 코드 인코딩/디코딩/병합
- **Description**: `src/domain/sharecode.ts`에 `encodeSnapshot({household,tasks,logs}): string`(`"CS1-" + base64url(JSON)`, UTF-8 안전 인코딩), `decodeSnapshot(code): {ok:true, data} | {ok:false, reason:'format'|'corrupt'|'tooLong'}`(접두사 불일치/공백 문자열 → `format`, base64 또는 JSON 실패 → `corrupt`, 길이 > 4000 → `tooLong`), `mergeSnapshot(local, incoming): {household, tasks, logs, mergedLogCount}`(id 기준 합집합, 동일 id는 `updatedAt` 큰 쪽 승리, 로그는 id 중복 제거) 구현. 순수 함수 — localStorage 접근 0건.
- **DoD**:
  - `decodeSnapshot(encodeSnapshot(x))`가 `{ok:true}`이고 `data`가 `x`와 깊은 값 일치(한글 이름·이모지 포함).
  - `decodeSnapshot('hello world')` → `{ok:false, reason:'format'}`, `decodeSnapshot('CS1-!!!!')` → `{ok:false, reason:'corrupt'}`, 4001자 코드 → `{ok:false, reason:'tooLong'}`.
  - 로컬 로그 20건 + 수신 로그 30건(동일 id 12건) → `logs.length === 38`, `mergedLogCount === 38`.
  - 동일 `taskId`에 대해 `updatedAt`이 큰 쪽 `difficulty`가 결과에 남음.
  - 실패 케이스에서 반환 객체 외에 어떤 입력 배열도 변형(mutate)되지 않음.
- **Covers**: [F4-AC2(계산부), F4-AC3, F4-AC4]
- **Files**: `src/domain/sharecode.ts`
- **Depends on**: Task 1.1

---

## Epic 3. UI 페이지 (한 Task = 한 화면 단위)

**Risk Assessment**
- Complexity: **High**
- Risk factors:
  - `location.state`가 없는 상태(새로고침·직접 진입)에서 `.map()` 호출 → 화면 크래시(2026-08-03 SplitMate 실사고: 완주율 0%).
  - TDS 컴포넌트 여백을 Tailwind/인라인 스타일로 덮어써 검수 반려.
  - HEX 색상 하드코딩 → 검수 즉시 반려(F8-AC8).
  - 리워드 광고 콜백(실패/중도이탈)을 성공과 동일 처리하면 해제 상태가 오염됨.
- Mitigation: 페이지는 Epic 2의 순수 함수/스토어만 소비하고 자체 계산·저장을 하지 않는다. state 수신 페이지는 **캐스팅 전 null 체크 → 안전 기본값(이번 주) 또는 `<Navigate to="/" replace />`** 를 DoD로 강제하고, 각 페이지에 "state 없이 직접 진입해도 크래시하지 않는다" AC를 별도로 넣는다.

### Task 3.1 공용 표현 컴포넌트 (SummaryHero / Sparkline / MiniBar)
- **Description**: `src/components/SummaryHero.tsx`(큰 수치 CountUp + 라벨 + 우측 배지 슬롯), `Sparkline.tsx`(number[] → SVG 라인/바, 7포인트), `MiniBar.tsx`(0~1 비율 바 + 우측 퍼센트 텍스트) 구현. 색상은 `var(--tds-color-*)`만 사용, 여백은 TDS `Spacing`으로만 제어, 외부 차트 라이브러리 미사용.
- **DoD**:
  - `<SummaryHero value={80} />`가 0→80 CountUp 후 `80` 텍스트 노출, `prefers-reduced-motion` 시 즉시 최종값 표시.
  - `<Sparkline data={[0,0,0,0,0,0,0]} />`가 예외 없이 렌더(전부 0일 때 division-by-zero 없음), `data.length !== 7`이어도 크래시 없음.
  - `<MiniBar ratio={0.67} />`의 바 너비가 67%, `ratio` undefined/NaN이면 0%로 렌더.
  - `grep -E "#[0-9a-fA-F]{3,8}" src/components/{SummaryHero,Sparkline,MiniBar}.tsx` 결과 0건.
  - 세 컴포넌트 모두 다크모드에서 텍스트/배경 대비가 유지됨(TDS 토큰만 사용해 자동 대응).
- **Covers**: (F3-AC7, F5-AC4, F7-AC3의 구성 요소 — 각 페이지 Task에서 배치 검증)
- **Files**: `src/components/SummaryHero.tsx`, `src/components/Sparkline.tsx`, `src/components/MiniBar.tsx`
- **Depends on**: Task 1.1

### Task 3.2 온보딩 화면 `/onboarding`
- **Description**: `src/pages/OnboardingPage.tsx` 구현. `ScreenScaffold` > `Top`("우리집 만들기") > 입력 `Card`(가구 이름 `TextField`, 구성원 행 `ListRow` + 이름 `TextField` + 이모지 `Chip` 선택 + 삭제 버튼) > `SubmitFooter`의 `display="block"` "시작하기". 기본 구성원 입력 행 2개 제공, 최대 4명. 제출 시 `createHousehold` + `seedDefaultTasks` 후 `navigate('/', { replace: true })`.
- **DoD**:
  - 가구명 "우리집" + 민지🐰/현우🐻 입력 후 제출 → `household.members.length === 2`, 각 `targetShare === 0.5`, `tasks.length === 6`, `settings.onboardingDone === true`, `activeMemberId === members[0].id`, 라우터가 `/`로 `replace` 이동.
  - 이름 중복 제출 → 해당 `TextField`에 `error` + "이름이 중복돼요" 표시, `localStorage['choresplit:household:v1'] === null`.
  - 빈 이름 제출 → "이름을 입력해주세요" 표시, 저장 미수행.
  - 제출 중 "시작하기" 버튼 `loading`이며 연속 5회 탭에도 `createHousehold` 호출 1회.
  - 구성원 추가 버튼은 4명일 때 `disabled`, 이모지 Chip과 삭제 버튼의 렌더 크기 ≥ 44×44px.
  - `FloatingTabBar`가 이 화면에 렌더되지 않음.
  - 인라인 style/Tailwind로 TDS 컴포넌트 padding·margin을 덮어쓴 코드 0건(간격은 `Spacing size=` 만 사용).
- **Covers**: [F1-AC1, F1-AC3]
- **Files**: `src/pages/OnboardingPage.tsx`
- **Depends on**: Task 2.7

### Task 3.3 홈 상단부 — 리마인더/스키마 배너 + 구성원 세그먼트 + 날짜 + 히어로
- **Description**: `src/pages/home/HomeHeader.tsx` 구현 후 `HomePage`에 배치. 순서: (조건부)`data-testid="reminder-banner"` → (조건부)스키마 비호환 배너 → 구성원 `Tab` 세그먼트 → 날짜 선택(오늘 ~ 7일 전) → `data-testid="today-summary-hero"` SummaryHero(오늘 가중치 CountUp + 스트릭 `Badge`) → `data-testid="week-sparkline"` Sparkline(최근 7일). 부팅 중에는 `data-testid="boot-skeleton"`(히어로 1 + ListRow 5 스켈레톤) 렌더.
- **DoD**:
  - `reminderEnabled:true`, `reminderTime:"21:00"`, 현재 `21:30`, 오늘 로그 0건 → `reminder-banner`에 "오늘 아직 체크인하지 않았어요" 표시, 홈 **최상단** DOM 위치.
  - 현재 `20:00`이거나 오늘 로그 ≥ 1건이면 `queryByTestId('reminder-banner') === null`.
  - `schemaCompatible === false`면 "기록 형식이 달라 일부 기능이 제한돼요" 배너 표시, `true`면 미표시.
  - "현우" 세그먼트 탭 → `settings.activeMemberId === 'mb_현우'`로 저장되고 히어로 값이 300ms 이내 현우 기준으로 재계산.
  - `status === 'booting'` 동안 `boot-skeleton` 존재, `ready` 전환 후 200ms 이내 사라지고 실제 값 표시.
  - 히어로 탭 시 `navigate('/report', { state: { weekKey } })` — `RouteState["/report"]` 타입으로 컴파일 통과.
  - 세그먼트 탭·날짜 칩 터치 타겟 ≥ 44×44px.
- **Covers**: [F1-AC6, F1-AC8, F3-AC4, F3-AC7(1·2번 블록), F8-AC1, F8-AC2]
- **Files**: `src/pages/home/HomeHeader.tsx`, `src/pages/HomePage.tsx`
- **Depends on**: Task 2.7, Task 3.1

### Task 3.4 홈 체크인 리스트 + 빈 상태 + 배너 광고
- **Description**: `src/pages/home/ChoreCheckList.tsx` 구현 후 `HomePage` 하단에 배치. 활성(`archived === false`) 항목을 `Card` 안 `ListRow`로 나열(`data-testid="chore-check-row-{taskId}"`, 좌측 이모지+이름, 우측 난이도 `Chip` + 체크 컨트롤). 탭 시 `toggleLog` 디스패치. 리스트 `Card` **아래**에 `Spacing size={16}` + `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 1개. 홈 진입 시 `location.state?.toast`가 있으면 Toast 1회 표시 후 state 소거.
- **DoD**:
  - `activeMemberId='mb_민지'`, 오늘 `2026-09-02`, `tk_설거지(difficulty:2)` 체크 → 로그 1건 추가(`weight:2`), 행이 체크 상태, Toast "설거지 완료!", 히어로 값 `+2`.
  - 같은 행 재탭 → 로그 삭제, 히어로 `-2`, Toast "기록을 취소했어요".
  - 동일 행 더블탭(150ms 간격) → 최종 로그 배열 길이가 `1` 또는 `0`이며 **절대 2 이상이 되지 않고** 에러 Toast 미표시.
  - 8일 전 날짜 선택 시 모든 체크 버튼 `disabled` + "7일 이내 기록만 수정할 수 있어요" 표시.
  - 활성 항목 0개 → `data-testid="home-empty"`에 `Asset.ContentIcon` + "집안일을 먼저 등록해주세요" + `display="block"` "항목 등록하기"(탭 → `/tasks`).
  - 오늘 모든 항목 체크 완료 → 리스트 하단 "오늘 할 일 다 했어요 🎉" 표시.
  - `AdSlot`이 화면에 정확히 1개, DOM 순서상 체크 `Card` 뒤이며 `FloatingTabBar`와 겹치지 않음.
  - 체크 행 렌더 높이 ≥ 56px.
  - **state 없이 `/`로 직접 진입해도 크래시하지 않음**(`const s = (useLocation().state as RouteState["/"]) ?? null;` 패턴, `s?.toast`만 접근).
- **Covers**: [F3-AC1, F3-AC2, F3-AC3, F3-AC5, F3-AC6, F3-AC7(3번 블록), F3-AC8]
- **Files**: `src/pages/home/ChoreCheckList.tsx`, `src/pages/HomePage.tsx`
- **Depends on**: Task 3.3

### Task 3.5 집안일 목록 화면 `/tasks` (목록 · 보관 · 상한 · 빈 상태)
- **Description**: `src/pages/TasksPage.tsx` 구현. `ScreenScaffold` > `Top`(뒤로가기) > 항목 `Card`(`ListRow` 목록: 이모지+이름, 우측 난이도 `Chip`, 반복 요일 `Chip`) > `SubmitFooter`의 "항목 추가"(`display="block"`). 행 탭 → 편집 시트 오픈(3.6이 제공), 행 내 "삭제" → `AlertDialog` "기록은 남고 목록에서만 숨겨져요" → "숨기기" 시 `archiveTask`. 목록 스켈레톤 `ListRow` 4개.
- **DoD**:
  - 로그 5건이 있는 `tk_1` 보관 → `tk_1.archived === true`, 목록·홈 체크리스트에서 사라지고 `logs.length` 변화 0.
  - `AlertDialog`에서 "취소" 선택 시 `archived` 변화 없음.
  - 활성 항목 30개일 때 "항목 추가" 버튼 `disabled` + "항목은 최대 30개까지 등록할 수 있어요" 표시, 29개면 `enabled`.
  - 모든 항목이 `archived`면 `data-testid="tasks-empty"`에 `Asset.ContentIcon` + "등록된 집안일이 없어요" + `display="block"` "항목 추가하기".
  - 각 `ListRow` 우측 난이도 Chip 텍스트가 `1→"쉬움"`, `2→"보통"`, `3→"힘듦"`.
  - `ListRow` 렌더 높이 ≥ 56px, `ListRow`에 `padding` prop이나 인라인 여백 지정 0건.
  - **state 없이 `/tasks` 직접 진입 시 크래시 없이 목록 렌더**(`(state as RouteState["/tasks"]) ?? null` 후 `openCreate` 옵셔널 접근).
- **Covers**: [F2-AC3, F2-AC5, F2-AC6, F2-AC7]
- **Files**: `src/pages/TasksPage.tsx`
- **Depends on**: Task 2.7

### Task 3.6 항목 추가/편집 BottomSheet + 검증
- **Description**: `src/pages/tasks/TaskFormSheet.tsx` 구현. TDS `BottomSheet` 안에 이름 `TextField`, 이모지 `Chip`, 난이도 세그먼트(1~3), 반복 사용 `Switch` + 요일 `Chip` 7개, 담당자 선택(구성원 + "공동"), 벌금 `TextField`(`inputMode="numeric"`, 100원 단위), 저장 버튼. 저장 시 `upsertTask`. `location.state.openCreate === true`면 진입 즉시 추가 모드로 오픈.
- **DoD**:
  - `{name:"설거지", emoji:"🍽️", difficulty:2, repeatDays:[1,3,5], assigneeId:"mb_민지", fineAmount:1000}` 저장 → tasks에 추가, Toast "항목을 추가했어요", `/tasks` 목록 **맨 위**에 해당 행 표시, 시트 닫힘.
  - `tk_1.difficulty`를 1→3으로 수정 저장 → `difficulty === 3`, `updatedAt > 이전값`, 기존 `ChoreLog.weight`는 변경 없음.
  - `name:""` → "항목 이름을 입력해주세요", 17자 이름 → "16자 이내로 입력해주세요", `fineAmount:12000` → "벌금은 10,000원 이하로 입력해주세요" — 세 경우 모두 저장 미수행 + 시트 유지(`onClose` 미호출).
  - 요일 Chip 7개 각 ≥ 44×44px, 벌금 필드 포커스 시 숫자 키패드(`inputMode="numeric"`), 시트가 visualViewport 리사이즈에 맞춰 키보드 위로 상승.
  - `openCreate:true` state로 `/tasks` 진입 시 시트가 자동 오픈되고, state 없이 진입하면 오픈되지 않으며 크래시 없음.
- **Covers**: [F2-AC1, F2-AC2, F2-AC4]
- **Files**: `src/pages/tasks/TaskFormSheet.tsx`, `src/pages/TasksPage.tsx`
- **Depends on**: Task 3.5

### Task 3.7 주간 리포트 요약 `/report` (히어로 · 주 이동 · 빈 상태)
- **Description**: `src/pages/ReportPage.tsx` 구현. weekKey 결정 순서: `location.state?.weekKey` → `searchParams.get('week')` → 이번 주. `ScreenScaffold` > `Top` > 주 이동 컨트롤(이전/다음, 최대 12주 이전까지) > `data-testid="fairness-hero"` SummaryHero(점수 CountUp + 등급 `Badge`) > 상세 영역 슬롯(3.8이 채움). 해당 주 로그 0건이면 히어로 대신 `report-empty`.
- **DoD**:
  - 민지 6 / 현우 4, target 0.5:0.5 → `fairness-hero`에 `80`이 CountUp으로 표시되고 등급 `Badge`가 "양호".
  - "이전 주" 탭 → URL이 `/report?week=2026-W35`로 변경, 히어로 값이 해당 주 기준 재계산.
  - 12주 이전에 도달하면 "이전 주" 버튼 `disabled`, 이번 주에서 "다음 주" `disabled`.
  - 해당 주 로그 0건 → `data-testid="report-empty"`에 `Asset.ContentIcon` + "이번 주 기록이 아직 없어요" + "체크인하러 가기"(→ `/`), 이때 `queryByTestId('fairness-hero') === null`이며 광고 게이트 버튼도 렌더되지 않음.
  - 주 이동 버튼 ≥ 44×44px.
  - **`/report`에 state·쿼리 없이 직접 진입해도 크래시 없이 이번 주가 표시됨**(`(state as RouteState["/report"]) ?? null` 후 fallback).
- **Covers**: [F5-AC3, F5-AC5, F5-AC8]
- **Files**: `src/pages/ReportPage.tsx`
- **Depends on**: Task 2.7, Task 3.1

### Task 3.8 리포트 상세 + 리워드 광고 게이트
- **Description**: `src/pages/report/ReportDetail.tsx` 구현 후 `ReportPage` 하단에 연결. `settings.reportUnlockedWeeks`에 현재 weekKey가 없으면 `display="block"` "상세 리포트 보기" 버튼 + `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{<ReportDetail/>}</TossRewardAd>` 게이트. 시청 완료 콜백에서만 weekKey를 `reportUnlockedWeeks`에 추가(최대 12개, 초과 시 오래된 것부터 제거). 상세 내용: `member-card-{memberId}` Card × 구성원 수, `category-minibar`, `weekly-sparkline`, 최하단 `<AdSlot />` 1개. 대기 중 `Skeleton` 3블록. 하단에 "벌금 정산 보기" → `navigate('/settle', { state: { weekKey } })`.
- **DoD**:
  - `"2026-W36"`가 unlocked에 없는 상태에서 "상세 리포트 보기" → 광고 시청 완료 콜백 후 `data-testid="report-detail"` 표시 + `reportUnlockedWeeks`에 `"2026-W36"` 추가.
  - unlocked에 포함된 주로 `/report?week=2026-W36` 진입 → 광고 호출 0회, 상세 즉시 표시, "상세 리포트 보기" 버튼 미렌더.
  - 광고 실패 콜백 → Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요", 버튼이 재탭 가능 상태로 복귀, `reportUnlockedWeeks` 변화 0, `console.error` 호출 0회.
  - 중도 이탈 콜백 → `report-detail` 미표시 + 요약 유지 + Toast "끝까지 시청해야 리포트가 열려요", unlocked 변화 0.
  - 상세 DOM 순서: `fairness-hero` → `member-card-*`(구성원 수와 개수 일치) → `category-minibar` → `weekly-sparkline` → `AdSlot`(정확히 1개, 최하단).
  - 구성원 카드에 "민지 60%", "현우 40%"가 t2~t3 강조 타이포로 표시.
  - `unlockedWeeks` 13개째 추가 시 배열 길이가 12로 유지되고 가장 오래된 항목이 제거됨.
- **Covers**: [F5-AC1, F5-AC2, F5-AC4, F5-AC6, F5-AC7]
- **Files**: `src/pages/report/ReportDetail.tsx`, `src/pages/ReportPage.tsx`
- **Depends on**: Task 3.7

### Task 3.9 벌금 정산 상단 `/settle` (정산 카드 · 구성원 요약 · 빈 상태)
- **Description**: `src/pages/SettlePage.tsx` 구현. weekKey는 `location.state?.weekKey` → `?week=` → 이번 주. `ScreenScaffold` > `Top` > `data-testid="settlement-card"`(순정산 문구, t2 강조) > `data-testid="fine-list-row-{memberId}"` 구성원별 벌금 요약 `Card`. 벌금 설정 항목이 0개면 `settle-empty`. 3인 이상이면 정산 문구 대신 개인별 목록 + 안내 문구. 로딩 시 정산 카드 + `ListRow` 3개 스켈레톤.
- **DoD**:
  - `tk_설거지(repeatDays:[1,3,5], assignee:mb_민지, fine:1000)`, 월·수만 체크인 → `fine-list-row-mb_민지`에 "1,000원"과 미이행 1건 표시.
  - 민지 3,000 / 현우 0 → `settlement-card`에 "민지님이 현우님에게 3,000원"(금액 `toLocaleString('ko-KR')`로 쉼표 포함, t2 강조).
  - 양쪽 2,000원 동일 → "정산할 금액이 없어요" 표시, 송금 유도 문구·외부 링크 0건.
  - 모든 활성 항목 `fineAmount === 0` → `data-testid="settle-empty"`에 `Asset.ContentIcon` + "벌금이 설정된 항목이 없어요" + `display="block"` "항목에서 벌금 설정하기"(탭 → `navigate('/tasks', { state: { openCreate: false } })`, `RouteState["/tasks"]`와 타입 일치).
  - 구성원 3명 → `settlement-card`에 "3인 이상 가구는 개인별 금액만 안내해요" + 개인별 합계 목록만 표시.
  - **`/settle`에 state 없이 직접 진입해도 크래시 없이 이번 주 정산이 표시됨.**
- **Covers**: [F6-AC1, F6-AC2, F6-AC3, F6-AC4, F6-AC7]
- **Files**: `src/pages/SettlePage.tsx`
- **Depends on**: Task 2.4, Task 2.7

### Task 3.10 미이행 상세 목록 + 안내 + 배너 광고
- **Description**: `src/pages/settle/UnfulfilledList.tsx` 구현 후 `SettlePage` 하단에 배치. `calcUnfulfilled` 결과를 `ListRow`로 "09/01(월) · 설거지 · 민지 · 1,000원" 형식 렌더. `hasUnassignedFineTask`면 하단에 "담당자가 없는 항목은 벌금에서 제외돼요" 안내. 목록 100행 초과 시 `react-window` 가상 스크롤. 목록 **아래**에 `<AdSlot />` 1개.
- **DoD**:
  - 미이행 3건 → `ListRow` 3개가 정확한 문자열 포맷으로 렌더, 각 행 높이 ≥ 44px.
  - 담당자 없는 벌금 항목이 미이행일 때 목록에 포함되지 않고 안내 문구가 표시됨.
  - 미이행 0건이면 목록 영역 대신 "미이행 항목이 없어요" 표시(크래시 없음).
  - 미이행 120건 입력 시 `react-window`가 적용되어 초기 렌더 DOM 행 수 < 30.
  - `AdSlot`이 DOM 순서상 미이행 목록 뒤, `settlement-card`를 가리지 않으며 화면 내 정확히 1개.
- **Covers**: [F6-AC5, F6-AC6, F6-AC8]
- **Files**: `src/pages/settle/UnfulfilledList.tsx`, `src/pages/SettlePage.tsx`
- **Depends on**: Task 3.9

### Task 3.11 랭킹 & 스트릭 화면 `/ranking`
- **Description**: `src/pages/RankingPage.tsx` 구현. `ScreenScaffold` > `Top` > `data-testid="streak-hero"` SummaryHero(활성 구성원 스트릭 CountUp + 배지 `Chip`) > 순위 `Card`(`data-testid="rank-row-{memberId}"` + `MiniBar` + 1위 👑 `Badge`) > `<AdSlot />`. 이번 주 로그 0건이면 `ranking-empty`. "이번 주 리포트 보기" → `navigate('/report', { state: { weekKey } })`. 로딩 시 히어로 + 순위 행 2개 스켈레톤.
- **DoD**:
  - 민지 로그가 `08-31/09-01/09-02`, 오늘 `09-02` → `streak-hero`에 `3`이 CountUp 표시.
  - 마지막 로그 `08-30`, 오늘 `09-02` → `0` 표시 + "오늘 체크인하면 다시 시작돼요" 문구.
  - 민지 6 / 현우 4 → `rank-row-mb_민지`가 1위(👑 포함), `rank-row-mb_현우` 2위, MiniBar 비율 100% / 67%.
  - 동점(둘 다 4)에 로그 건수 민지 2 / 현우 4 → 현우 1위, 👑는 현우 행에만 1개.
  - 스트릭 7일 → "7일 연속 달성 🔥" `Chip`이 `streak-hero` 하단에 표시, 30일 → "30일 연속 🏆" `Chip`으로 **대체**(두 개 동시 표시 안 됨).
  - 이번 주 로그 0건 → `data-testid="ranking-empty"` + `Asset.ContentIcon` + "이번 주 기록이 없어요", `rank-row-*` 0개.
  - 미래 날짜 로그가 포함돼도 예외 없이 렌더되고 해당 로그가 순위·스트릭에 반영되지 않음.
  - 순위 행 높이 ≥ 56px.
- **Covers**: [F7-AC1, F7-AC2, F7-AC3, F7-AC4, F7-AC5, F7-AC6, F7-AC7]
- **Files**: `src/pages/RankingPage.tsx`
- **Depends on**: Task 2.5, Task 3.1

### Task 3.12 초대 화면 — 코드 생성 & 복사 `/invite`
- **Description**: `src/pages/InvitePage.tsx` 상단부 구현. `ScreenScaffold` > `Top` > 내보내기 `Card`("코드 만들기" 버튼, `data-testid="share-code-box"`, "복사하기" 버튼) > `Spacing size={16}` > 합치기 `Card` 슬롯(3.13). 코드 생성 중 코드 박스 `Skeleton`. 미생성 상태는 `data-testid="share-code-empty"`.
- **DoD**:
  - 구성원 2 / 항목 6 / 로그 20건 상태에서 "코드 만들기" 탭 → `share-code-box`에 `CS1-`로 시작하는 문자열 표시.
  - "복사하기" 탭 → `navigator.clipboard.writeText`가 해당 코드로 1회 호출되고 Toast "코드를 복사했어요"; 클립보드 API 실패 시에도 크래시 없이 Toast "복사에 실패했어요. 코드를 길게 눌러 복사해주세요" 표시.
  - 코드 미생성 시 `share-code-empty`에 "코드를 만들어 상대방에게 보내세요" 표시.
  - 코드 박스 탭 시 전체 선택, 복사 버튼 ≥ 44×44px.
  - 화면 전체에 `window.open` / `window.location.href` 호출 0건, "앱 설치"·"다운로드" 문자열 0건.
  - `grep -E "#[0-9a-fA-F]{3,8}" src/pages/InvitePage.tsx` 결과 0건.
- **Covers**: [F4-AC1, F4-AC7]
- **Files**: `src/pages/InvitePage.tsx`
- **Depends on**: Task 2.8, Task 2.7

### Task 3.13 초대 화면 — 병합 & 되돌리기
- **Description**: `src/pages/invite/MergeCard.tsx` 구현 후 `InvitePage`에 배치. multiline `TextField`(붙여넣기) + "합치기" 버튼 → `AlertDialog` "기존 기록에 상대방 기록을 합칠까요?" → 확인 시 현재 스냅샷을 `choresplit:backup:v1`에 저장하고 `mergeSnapshot` 적용, 성공 시 `navigate('/', { replace:true, state:{ toast: "N건의 기록을 합쳤어요" } })`. 백업 존재 시에만 "직전 합치기 되돌리기" 버튼 렌더.
- **DoD**:
  - 로컬 20건 + 코드 30건(중복 12건) 병합 → 최종 로그 38건, 홈 이동 후 Toast "38건의 기록을 합쳤어요"(`RouteState["/"]` 타입과 일치).
  - 동일 id 항목은 `updatedAt` 큰 쪽 값으로 덮어써짐.
  - 병합 직전 상태가 `choresplit:backup:v1`에 저장됨(`{household,tasks,logs,savedAt}`).
  - `"hello world"` → "코드 형식이 올바르지 않아요", `"CS1-!!!!"` → "코드가 손상됐어요. 다시 복사해주세요" — 두 경우 모두 `logs.length` 변화 0.
  - 4,001자 코드 → "기록이 너무 많아요. 상대방 앱 설정에서 오래된 기록을 정리한 뒤 다시 시도해주세요" 표시 후 병합 중단.
  - "합치기" 확인 직후 버튼 `loading`이며 연속 5회 탭에도 병합 1회만 수행, 완료 후 원상 복구.
  - "되돌리기" 탭 → 로그 20건 복원 + Toast "되돌렸어요"; `choresplit:backup:v1` 없으면 버튼이 DOM에 존재하지 않음.
- **Covers**: [F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6]
- **Files**: `src/pages/invite/MergeCard.tsx`, `src/pages/InvitePage.tsx`
- **Depends on**: Task 3.12

### Task 3.14 설정 화면 (1) — 리마인더 · 목표 지분 · 로딩
- **Description**: `src/pages/SettingsPage.tsx` 구현(상단 2개 Card). 리마인더 `Card`: on/off `Switch`(Toggle 아님) + 시각 `ListRow` → `BottomSheet` 시각 선택. 가구/지분 `Card`: 구성원별 지분 `TextField`(`inputMode="numeric"`, %) → 저장. `/invite` 이동 `ListRow` 포함. 값 로딩 중 각 `ListRow` 우측을 `Skeleton`으로 렌더.
- **DoD**:
  - 시각 시트에서 `"08:30"` 선택 확인 → `settings.reminderTime === "08:30"` 저장 + Toast "리마인더 시각을 변경했어요".
  - `Switch` off → `reminderEnabled === false` 저장, 홈에서 `reminder-banner` 미렌더.
  - 2인 가구에서 민지 지분을 0.6으로 조정 → 현우가 자동 0.4로 계산되어 합계 1.0 유지, 저장 성공.
  - 3인 가구에서 합계가 1.0 ±0.01을 벗어나면 "지분 합이 100%가 되어야 해요" 에러 표시 + 저장 차단(`household` 변화 0).
  - `status === 'booting'` 동안 모든 설정 `ListRow` 우측이 `Skeleton`, `ready` 후 실제 값으로 교체.
  - `Switch`·모든 `ListRow` 터치 타겟 ≥ 44px, 지분 입력 시 숫자 키패드 + 시트가 키보드 위로 상승.
  - "동거인 초대" 탭 → `navigate('/invite')`(state 없음).
- **Covers**: [F8-AC3, F8-AC4, F8-AC7]
- **Files**: `src/pages/SettingsPage.tsx`
- **Depends on**: Task 2.7

### Task 3.15 설정 화면 (2) — 데이터 관리 (정리 · 전체 초기화)
- **Description**: `SettingsPage` 하단 데이터 관리 `Card` + 앱 정보 `Card` 구현. "오래된 기록 정리" → `AlertDialog` 확인 시 `pruneOldLogs(180)` 실행 + `choresplit:logs:v1.corrupt` 함께 제거. "전체 초기화" → `AlertDialog` "모든 기록이 삭제돼요. 되돌릴 수 없어요" → "삭제" 시 `resetAll()` + `navigate('/onboarding', { replace: true })`. 파괴적 액션은 마지막 Card에만 배치.
- **DoD**:
  - 로그 500건 중 180일 이전 120건 → "정리" 확인 시 로그 380건 + Toast "120건을 정리했어요"; 정리 대상 0건이면 Toast "정리할 기록이 없어요".
  - 정리 후 `localStorage['choresplit:logs:v1.corrupt'] === null`.
  - 전체 초기화 `AlertDialog`에서 "취소" → `choresplit:` 접두 키 개수 변화 0.
  - "삭제" → `choresplit:` 접두 키 전부 제거 + `/onboarding`으로 `replace` 이동(뒤로가기로 `/settings` 복귀 불가).
  - 파괴적 액션 2개가 모두 마지막 데이터 관리 `Card`에 위치하고 그 위 Card에는 없음.
- **Covers**: [F8-AC5, F8-AC6]
- **Files**: `src/pages/SettingsPage.tsx`
- **Depends on**: Task 3.14

---

## Epic 4. 통합 + 폴리시 (라우팅 · 가드 · 검수)

**Risk Assessment**
- Complexity: **Medium**
- Risk factors:
  - 온보딩 미완료 상태에서 홈이 `household === null`을 참조해 크래시 → 신규 사용자 100% 이탈.
  - `FloatingTabBar`가 온보딩에도 렌더되면 미완료 상태로 다른 탭 진입 가능.
  - 검수 반려 요인(HEX 리터럴, `console.error`, `window.open`, 외부 분석 SDK, 외부 네트워크 요청)이 여러 파일에 흩어져 뒤늦게 발견됨.
- Mitigation: 페이지 구현이 모두 끝난 뒤 라우팅 가드를 한 번에 적용해 리다이렉트 규칙을 단일 지점에 모으고, 마지막 Task에서 grep 기반 자동 검사로 검수 규칙 위반을 0건으로 만든다.

### Task 4.1 라우터 구성 + 온보딩 가드 + FloatingTabBar
- **Description**: `src/router.tsx` / `src/App.tsx`에 `BrowserRouter` + 8개 라우트(`/onboarding`, `/`, `/tasks`, `/invite`, `/report`, `/settle`, `/ranking`, `/settings`) 등록. `src/components/OnboardingGuard.tsx`: `status === 'booting'`이면 `boot-skeleton`, `settings.onboardingDone === false`면 `<Navigate to="/onboarding" replace />`. `AppStore` Provider로 전체 감싸고 `FloatingTabBar`(홈·리포트·랭킹·설정)는 `/onboarding` 제외 전 화면에만 렌더. 알 수 없는 경로는 `/`로 replace.
- **DoD**:
  - `onboardingDone === false` 상태에서 `/`, `/tasks`, `/report`, `/ranking`, `/settle`, `/invite`, `/settings` 각각 진입 → 전부 `/onboarding`으로 `replace` 이동하고 `FloatingTabBar`가 DOM에 없음.
  - `onboardingDone === true`이면 `/onboarding` 진입 시 `/`로 `replace` 이동.
  - `/onboarding` 외 모든 화면에서 `FloatingTabBar` 렌더, 탭 4개가 각각 `/`, `/report`, `/ranking`, `/settings`로 이동.
  - 존재하지 않는 경로(`/zzz`) 진입 시 크래시 없이 `/`로 이동.
  - `npx tsc --noEmit` 및 `npx vite build` 성공.
- **Covers**: [F1-AC2]
- **Files**: `src/App.tsx`, `src/router.tsx`, `src/components/OnboardingGuard.tsx`
- **Depends on**: Task 3.2 ~ Task 3.15

### Task 4.2 라우트 state 방어 & 새로고침 내성 점검
- **Description**: `location.state`를 수신하는 모든 화면(`/`, `/tasks`, `/report`, `/settle`)에 대해 SPEC의 필수 패턴(`const s = (useLocation().state as RouteState["/x"]) ?? null;` + null 분기)이 적용됐는지 일괄 점검·수정한다. 구조 분해 캐스팅(`const { x } = useLocation().state as T`)과 체이닝 캐스팅(`(useLocation().state as T).items.map`)을 전부 제거하고, state 없는 진입은 안전 기본값(이번 주 / 빈 토스트 / 목록 렌더)으로 처리한다.
- **DoD**:
  - `grep -nE "useLocation\(\)\.state as [A-Za-z\[\"/]+\)?\." src/` 결과 0건, `grep -nE "const \{[^}]+\} = useLocation\(\)\.state" src/` 결과 0건.
  - `/`, `/tasks`, `/report`, `/settle`을 각각 **state 없이 직접 렌더**했을 때 4개 화면 모두 throw 없이 마운트되고 주요 콘텐츠 또는 빈 상태가 표시됨.
  - `/report`, `/settle`은 state·쿼리 모두 없을 때 이번 주(`weekKeyOf(todayKST())`) 데이터를 표시.
  - `/`는 state 없을 때 Toast 미표시, 그 외 정상 동작.
  - 각 화면의 `navigate(...)` 호출 인자가 `RouteState`의 해당 키 타입에 대입 가능함이 `tsc --noEmit`으로 검증됨.
- **Covers**: (F3-AC7, F5-AC8, F6-AC4의 state 안정성 보강 — 전 화면 크래시 방지)
- **Files**: `src/pages/HomePage.tsx`, `src/pages/TasksPage.tsx`, `src/pages/ReportPage.tsx`, `src/pages/SettlePage.tsx`
- **Depends on**: Task 4.1

### Task 4.3 검수 규칙 준수 스윕 (HEX · console.error · 외부 이탈 · 광고 배치)
- **Description**: 전 소스에 대해 검수 반려 요인을 제거한다. HEX 리터럴 → `var(--tds-color-*)` 치환, `console.error`/`console.warn` 제거(Toast로 대체), `window.open`/`window.location.href` 제거, 외부 분석 SDK·`fetch`/`XMLHttpRequest` 임포트 제거, TDS 컴포넌트 여백을 덮어쓴 Tailwind/인라인 스타일 제거(간격은 `Spacing size=`로 통일), `AdSlot`이 화면당 1개이며 `FloatingTabBar`·콘텐츠와 겹치지 않는지 확인. 다크모드 전 화면 육안 확인.
- **DoD**:
  - `grep -rE "#[0-9a-fA-F]{3,8}" src/` 결과 **0건**.
  - `grep -rn "console\.error\|console\.warn" src/` 결과 0건.
  - `grep -rn "window\.open\|window\.location\.href" src/` 결과 0건.
  - `grep -rn "fetch(\|XMLHttpRequest\|amplitude\|gtag\|google-analytics" src/` 결과 0건.
  - `grep -rn "shadcn\|@mui\|antd\|@chakra-ui" src/ package.json` 결과 0건.
  - `npx vite build` 후 프로덕션 실행에서 F1~F8 주요 플로우 1회씩 수행 시 콘솔 error 0건, 네트워크 탭의 외부 도메인 요청 0건(광고 SDK 제외), CORS 에러 0건.
  - 홈·리포트·정산·랭킹 각 화면에서 `AdSlot` 개수 정확히 1개이며 `FloatingTabBar`와 겹치지 않음(하단 `Spacing size={16}` 이상 확보).
  - 라이트/다크 모드 전환 시 8개 화면 모두 텍스트가 배경에 묻히지 않음.
- **Covers**: [F8-AC8, F4-AC7(전역 재확인), F3-AC8·F5-AC4·F6-AC8·F7 광고 배치 재확인]
- **Files**: `src/**/*.tsx`, `src/**/*.ts`
- **Depends on**: Task 4.2

---

## AC Coverage

- **Total ACs in SPEC: 61** (F1 8 · F2 7 · F3 8 · F4 7 · F5 8 · F6 8 · F7 7 · F8 8)
- **Covered by tasks: 61**

| Feature | AC | 담당 Task |
|---|---|---|
| F1 | AC-1 | 2.6, 3.2 |
| F1 | AC-2 | 4.1 |
| F1 | AC-3 | 3.2 |
| F1 | AC-4 | 2.1, 2.7 |
| F1 | AC-5 | 2.1, 2.7 |
| F1 | AC-6 | 2.7, 3.3 |
| F1 | AC-7 | 2.3 |
| F1 | AC-8 | 2.1, 3.3 |
| F2 | AC-1 | 3.6 |
| F2 | AC-2 | 3.6 |
| F2 | AC-3 | 2.6, 3.5 |
| F2 | AC-4 | 3.6 |
| F2 | AC-5 | 3.5 |
| F2 | AC-6 | 3.5 |
| F2 | AC-7 | 3.5 |
| F3 | AC-1 | 3.4 |
| F3 | AC-2 | 3.4 |
| F3 | AC-3 | 2.6, 3.4 |
| F3 | AC-4 | 3.3 |
| F3 | AC-5 | 3.4 |
| F3 | AC-6 | 3.4 |
| F3 | AC-7 | 3.3, 3.4, 4.2 |
| F3 | AC-8 | 3.4, 4.3 |
| F4 | AC-1 | 3.12 |
| F4 | AC-2 | 2.8, 3.13 |
| F4 | AC-3 | 2.8, 3.13 |
| F4 | AC-4 | 2.8, 3.13 |
| F4 | AC-5 | 3.13 |
| F4 | AC-6 | 3.13 |
| F4 | AC-7 | 3.12, 4.3 |
| F5 | AC-1 | 3.8 |
| F5 | AC-2 | 3.8 |
| F5 | AC-3 | 2.3, 3.7 |
| F5 | AC-4 | 3.1, 3.8, 4.3 |
| F5 | AC-5 | 3.7 |
| F5 | AC-6 | 3.8 |
| F5 | AC-7 | 3.8 |
| F5 | AC-8 | 3.7, 4.2 |
| F6 | AC-1 | 2.4, 3.9 |
| F6 | AC-2 | 3.9 |
| F6 | AC-3 | 2.4, 3.9 |
| F6 | AC-4 | 3.9, 4.2 |
| F6 | AC-5 | 2.4, 3.10 |
| F6 | AC-6 | 3.10 |
| F6 | AC-7 | 2.4, 3.9 |
| F6 | AC-8 | 3.10, 4.3 |
| F7 | AC-1 | 2.5, 3.11 |
| F7 | AC-2 | 2.5, 3.11 |
| F7 | AC-3 | 2.5, 3.1, 3.11 |
| F7 | AC-4 | 2.5, 3.11 |
| F7 | AC-5 | 3.11 |
| F7 | AC-6 | 3.11 |
| F7 | AC-7 | 2.5, 3.11 |
| F8 | AC-1 | 2.2, 3.3 |
| F8 | AC-2 | 2.2, 3.3 |
| F8 | AC-3 | 3.14 |
| F8 | AC-4 | 3.14 |
| F8 | AC-5 | 2.6, 3.15 |
| F8 | AC-6 | 3.15 |
| F8 | AC-7 | 3.14 |
| F8 | AC-8 | 4.3 |

- **Uncovered: 0**