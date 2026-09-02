#!/usr/bin/env node
// Stop hook: 금지 패턴 전수 스캔이 통과해야 종료 허용. 실패면 exit 2(종료 차단).
// 게이트 인프라 자체 오류는 exit 0(fail-open).
//
// ── 2026-08-17에 셋을 뺐다 ──
//
// 1. `stop_hook_active` 미확인 → **무한 재차단**. 예전엔 stdin을 드레인만 하고
//    파싱하지 않아 이 필드를 절대 못 봤다. 고칠 수 없는 위반이 하나라도 남으면
//    종료 시도마다 게이트가 다시 돌고, 멈추는 유일한 수단이 max_turns였다.
//    (같은 환경의 개인 Stop hook은 맨 앞에서 이 필드로 재귀를 끊는다.)
//
// 2. `npx tsc --noEmit` 제거. 워크트리 **전체** tsc라 남의 패킷 오류로 내 종료가
//    막혔다 — "재시도에 남의 에러를 주지 마라"와 같은 병이다. 판정 권한까지 가진
//    진짜 대응물은 quality-gates.ts의 checkTsc다.
//
// 3. `npm run test:visual` 제거. playwright.config.ts가 baseURL을 localhost:5173으로
//    고정하고 `reuseExistingServer: true`라, tier1 병렬 워크트리에서는 **남의 앱**을
//    재거나 못 붙어 대기 후 실패한다. 신호가 아니라 오염이다.
//
// 남긴 것: 금지 패턴 스캔. 서브프로세스 0·순수 정규식이라 사실상 무료이고,
// 파이프라인에 대응물이 없는 패턴들(button 중첩, placeholder 없는 TextField,
// 맨텍스트 로딩)을 유일하게 잡는다.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { scanContent } from "./forbidden-patterns.mjs";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([".tsx", ".ts", ".jsx", ".css"].includes(extname(name))) out.push(full);
  }
  return out;
}

function scanSrc(root) {
  const srcDir = join(root, "src");
  if (!existsSync(srcDir)) return [];
  const out = [];
  for (const file of walk(srcDir)) {
    const rel = file.slice(root.length + 1);
    for (const v of scanContent(readFileSync(file, "utf8"), rel)) out.push({ ...v, file: rel });
  }
  return out;
}

/** stdin의 hook 페이로드를 **읽고 파싱한다**(드레인만 하면 stop_hook_active를 못 본다). */
async function readHookPayload() {
  try {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

try {
  const payload = await readHookPayload();

  // 이미 이 훅 때문에 한 번 막힌 상태라면 더 막지 않는다.
  // 고칠 수 없는 위반이 남았을 때 무한 재차단으로 턴을 태우는 것을 끊는 유일한 장치다.
  if (payload.stop_hook_active === true) {
    process.stderr.write("⚠️ 게이트 미통과지만 1회로 종료 허용 — 나머지는 파이프라인이 이어받는다.\n");
    process.exit(0);
  }

  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const failures = [];

  const violations = scanSrc(root);
  // severity 존중(2026-09-01 적대 리뷰): "warn"이라 쓰고 차단으로 동작하는 사문을 없앤다.
  // error만 종료를 막고, warn은 안내만 한다 — 광폭·medium 신뢰 패턴이 차단 게이트에
  // 슬그머니 들어가는 것을 구조로 막는다(차단하고 싶으면 severity:"error"로 선언하라).
  const errors = violations.filter((v) => v.severity !== "warn");
  const warns = violations.filter((v) => v.severity === "warn");
  if (errors.length) {
    failures.push("■ 금지 패턴:\n" + errors.slice(0, 30).map((v) => `  ✗ [${v.patternId}] ${v.file}:${v.line} — ${v.message}`).join("\n"));
  }

  if (failures.length === 0) {
    if (warns.length) {
      process.stderr.write("ℹ️ 권고(차단 아님):\n" + warns.slice(0, 10).map((v) => `  · [${v.patternId}] ${v.file}:${v.line} — ${v.message}`).join("\n") + "\n");
    }
    process.exit(0);
  }
  process.stderr.write("🛑 완료할 수 없습니다 — 아래를 고치고 계속하세요:\n\n" + failures.join("\n\n") + "\n");
  process.exit(2);
} catch {
  process.exit(0); // fail-open
}
