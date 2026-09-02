// 금지 패턴 단일 소스. precheck(high만)·finish-gate(전체)가 공유. 의존성 0(순수 node ESM).
// 각 패턴: { id, confidence, severity, appliesTo(file), message, scan(content)=>[{line,text}] }

function hasAllowMarker(line) {
  return /\/\/\s*gate-allow:/.test(line);
}

/**
 * 주석 줄인가 — 규칙을 **설명하는 문장**이 규칙 위반으로 잡히는 것을 막는다.
 *
 * 실측(2026-08-17): 갓 스캐폴드한 템플릿이 자기 게이트에 10건 걸렸는데 대부분
 * 이 종류였다. PageShell의 `100dvh(NOT 100vh)`라는 주석이 viewport-100vh로,
 * StateView의 `맨텍스트("데이터 없음") 대신 사용`이 raw-loading-text로 잡혔다.
 * 코딩 에이전트는 자기가 쓰지도 않은 템플릿 파일 위반 10건을 보고 턴을 태웠다.
 */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("<!--");
}

function eachLine(content, fn) {
  const out = [];
  content.split("\n").forEach((line, i) => {
    if (isCommentLine(line)) return;
    const hit = fn(line, i + 1);
    if (hit) out.push({ line: i + 1, text: line.trim().slice(0, 100) });
  });
  return out;
}

export const PATTERNS = [
  {
    id: "off-scale-spacing",
    confidence: "medium",
    severity: "warn",
    appliesTo: (f) => /\.(tsx|jsx)$/.test(f),
    message: "간격 리터럴이 2·4배수 스케일 밖(홀수 px) — TDS 간격 리듬이 흐트러진다(8·12·16·20·24 권장). .claude/rules/ui-design.md",
    // padding/margin/gap **속성의 값만** 본다(적대 리뷰 2026-09-01 확정 오탐 4부류의 수복):
    //  - top/left/right/bottom 제외 — 포지셔닝 오프셋은 간격 리듬이 아니다(배지 3px 정렬이 위반이 됐다)
    //  - 속성 앞 경계 필수 — border-top·scroll-margin-top의 부분일치 차단
    //  - 값 추출은 그 속성의 값 구간만 — 같은 줄 borderRadius:"9px"가 잡히던 줄 단위 수집 금지
    //  - camelCase(paddingTop)·숫자형(padding: 13)·shorthand("8px 15px")는 잡는다(JSX 지배 표기)
    // 1px(헤어라인)·0·음수(abs)·소수(의도적 half-pixel)는 통과. 2배수까지 허용(TDS Spacing 최소 단위).
    scan: (c) => eachLine(c, (l) => {
      const props = l.matchAll(/(?:^|[^\w-])(?:padding|margin|rowGap|columnGap|gap)(?:[A-Z][a-zA-Z]*|-[a-z]+(?:-[a-z]+)?)?\s*:\s*([^,;}`\n]*)/g);
      for (const m of props) {
        for (const v of m[1].matchAll(/-?(\d{1,3})(\.\d+)?(?:px)?(?=["'\s]|$)/g)) {
          if (v[2]) continue;                       // 소수는 의도적 — 통과
          const n = Number(v[1]);                   // 음수는 캡처가 abs
          if (n > 1 && n % 4 !== 0 && n % 4 !== 2) return true;
        }
      }
      return false;
    }),
  },

  {
    id: "hardcoded-hex",
    confidence: "high",
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx|css)$/.test(f) && !/(granite|apps-in-toss)\.config\./.test(f),
    message: "하드코딩 hex 색상 — var(--adaptive*)/var(--tds-color-*) 사용(다크모드 깨짐). .claude/rules/ui-design.md",
    // `var(--tds-color-grey500, #6B7684)`의 hex는 **CSS 변수 폴백**이라 올바른 사용법이다.
    // 폴백을 지우고 남는 hex만 본다 — 안 그러면 템플릿의 정석 코드가 위반으로 잡힌다.
    scan: (c) => eachLine(c, (l) => {
      const bare = l.replace(/var\(\s*--[\w-]+\s*,[^)]*\)/g, "var(--x)");
      return /#[0-9a-fA-F]{3,8}\b/.test(bare) && /(color|background|fill|stroke|border)/i.test(bare);
    }),
  },
  {
    id: "viewport-100vh",
    confidence: "high",
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx|css)$/.test(f),
    message: "100vh — 100dvh 사용(모바일 주소창 보정). .claude/rules/ui-design.md",
    // `min-height: 100vh; min-height: 100dvh;`는 **점진적 향상 폴백**이라 정석이다.
    // 이웃 줄에 같은 속성의 100dvh가 있으면 위반이 아니다.
    scan: (c) => {
      const lines = c.split("\n");
      return eachLine(c, (l, n) => {
        if (!/\b100vh\b/.test(l)) return false;
        const prop = (l.match(/([\w-]+)\s*:/) ?? [])[1];
        return ![lines[n - 2] ?? "", lines[n] ?? ""].some(
          (x) => /\b100dvh\b/.test(x) && (!prop || x.includes(prop)),
        );
      });
    },
  },
  {
    id: "external-nav",
    confidence: "high",
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx|ts)$/.test(f),
    message: "외부 이탈(window.open/location) — openURL SDK 사용(검수 반려). .claude/rules/toss-mini-app.md",
    scan: (c) =>
      eachLine(c, (l) => /window\s*\.\s*open\s*\(|(?:^|[^\w$.])(?:(?:window|self|top|parent|globalThis|document)\s*\.\s*)?location\s*\.\s*(?:href\s*=|assign\s*\(|replace\s*\()/.test(l)),
  },
  {
    id: "fixedbottomcta-nested-button",
    confidence: "high",
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx)$/.test(f),
    message:
      "FixedBottomCTA/BottomCTA/CTAButton 안에 <Button> 중첩(button>button 무효 HTML) — children에 라벨 직접 또는 SubmitFooter. .ai-factory/tds-patterns.md Pattern 9",
    scan: (c) => {
      const out = [];
      const re = /<(FixedBottomCTA|BottomCTA|CTAButton)\b(?:(?!<\/\1>)[\s\S])*?<Button\b(?:(?!<\/\1>)[\s\S])*?<\/\1>/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        out.push({ line: c.slice(0, m.index).split("\n").length, text: m[0].split("\n")[0].trim().slice(0, 80) });
      }
      return out;
    },
  },
  {
    id: "textfield-no-placeholder",
    confidence: "medium",
    // warn→error(2026-09-01): finish-gate가 severity를 존중하게 되면서, 원래부터
    // 차단으로 동작하던 이 패턴의 현행 동작을 보존한다(좁은 정탐 — 실제 나쁜 UX만 걸린다).
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx)$/.test(f),
    message: "TextField placeholder 없음 — box/line variant는 빈 칸에서 라벨이 숨어 빈 박스가 됨.",
    scan: (c) => {
      const out = [];
      const re = /<TextField\b([\s\S]*?)\/?>/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        if (!/placeholder\s*=/.test(m[1])) {
          out.push({ line: c.slice(0, m.index).split("\n").length, text: m[0].split("\n")[0].trim().slice(0, 80) });
        }
      }
      return out;
    },
  },
  {
    id: "raw-loading-text",
    confidence: "medium",
    // warn→error(2026-09-01): 위와 같은 이유 — 현행 차단 동작 보존.
    severity: "error",
    appliesTo: (f) => /\.(tsx|jsx)$/.test(f),
    message: "맨텍스트 로딩/빈상태 — LoadingState/EmptyState(StateView) 사용.",
    scan: (c) =>
      eachLine(c, (l) => /(불러오는\s*중|데이터가?\s*없|로딩\s*중)/.test(l) && !/EmptyState|LoadingState|Skeleton/.test(l)),
  },
];

/**
 * @param {string} content
 * @param {string} filePath  레포 기준 또는 임의 식별자(확장자로 appliesTo 판정)
 * @param {{minConfidence?: "high"}} [opts]  "high"면 high 패턴만
 * @returns {Array<{patternId,line,text,message,confidence,severity}>}
 */
export function scanContent(content, filePath, opts = {}) {
  const onlyHigh = opts.minConfidence === "high";
  const lines = content.split("\n");
  const out = [];
  for (const p of PATTERNS) {
    if (onlyHigh && p.confidence !== "high") continue;
    if (!p.appliesTo(filePath)) continue;
    for (const v of p.scan(content)) {
      if (hasAllowMarker(lines[v.line - 1] ?? "")) continue;
      out.push({ patternId: p.id, line: v.line, text: v.text, message: p.message, confidence: p.confidence, severity: p.severity });
    }
  }
  return out;
}
