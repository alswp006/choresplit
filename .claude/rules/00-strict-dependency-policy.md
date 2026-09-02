# STRICT POLICY: No Lazy Fallbacks for Core SDK Dependencies

The AI agent MUST follow these absolute rules during coding and package installation. Any work packet that violates these rules will be immediately marked as FAIL.

## 1. NEVER Create Fallback UI When Core SDK Installation Fails
If App-in-Toss SDK (`@apps-in-toss/web-framework`), TDS (`@toss/tds-mobile`), or any platform-required design system fails to install, **NEVER build custom UI (Custom CSS, Tailwind) or mock the functionality as a workaround.**
- FORBIDDEN: "The package is missing, so I'll create similar-looking HTML/CSS components instead."
- FORBIDDEN: Removing the dependency from `package.json` to make the build pass.

## 2. ETARGET / Package Not Found Error Resolution Manual
When `No matching version found` or `ETARGET` error occurs, DO NOT assume the package is private.
1. **Check versions:** Verify if a specific version (e.g., `^1.0.0`) is hardcoded. Run `npm view [package-name] versions` to see available versions.
2. **Use latest:** Install with `npm install [package-name]@latest`.
3. **Do NOT fall back to scaffolding CLIs:** `ait` 같은 스캐폴딩 CLI는 이 환경에 설치돼 있지 않다 — 시도는 턴만 태운다.
4. **그래도 실패하면 패키지 종류로 갈린다:** §1의 핵심 SDK(플랫폼 필수 의존성)라면 §3 Escalation을 따르라 — 하키 코드 금지, `[CRITICAL_DEPENDENCY_ERROR]` 태그. 그 외 보조 패키지라면 그것 없이 구현하고 실패 사실을 결과에 남겨라.

## 3. Escalation Obligation
If the dependency issue is not resolved after 2+ attempts, **DO NOT write hacky code to pass tests. Abort the pipeline immediately.**
- Tag the error log with `[CRITICAL_DEPENDENCY_ERROR]` and escalate to Opus model or request human intervention.
- In the Toss ecosystem (App-in-Toss), apps without TDS are 100% rejected during review. A clean abort is always better than "working garbage."
