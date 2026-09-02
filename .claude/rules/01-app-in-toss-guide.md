# App-in-Toss Development Master Guide for AI Agents

This document contains the absolute rules from the latest official Toss documentation (2026) for developing mini-apps that run inside the Toss app. The AI MUST prioritize these rules above all else when generating code.

## GROUND TRUTH
**For exact SDK API usage, read `.ai-factory/apps-in-toss-essential.txt` — it contains verified exports from the installed `@apps-in-toss/web-framework` `.d.ts` files.** Do not guess SDK API names; if not in that reference, it doesn't exist.

## 1. Architecture & Runtime Environment
- **Rendering:** App-in-Toss WebView supports SSG or CSR ONLY. **Dynamic SSR strictly forbidden.** Next.js requires `output: 'export'` in `next.config.mjs`.
- **Minimum OS support:** Android 7+, iOS 16+.
- **Routing scheme:** `intoss://{appName}` for sandbox and production testing.

## 2. Dependencies & Package Installation
- **Package name:** `@apps-in-toss/web-framework` (NOT `@apps-in-toss/framework` — that's a legacy/wrong name)
- **Install command:** `npm install @apps-in-toss/web-framework@latest @toss/tds-mobile@latest @emotion/react@^11`
- Always use `@latest` for Toss packages — hardcoded old versions cause ETARGET errors.
- **TDS is mandatory:** Custom UI to mimic TDS components → instant review rejection.

## 3. Configuration (`apps-in-toss.config.ts` — SDK v3, 2026-07-31~)
- 설정 파일명이 v3에서 `granite.config.ts` → `apps-in-toss.config.ts`로 바뀌었다. **이 파일을 수정하거나 granite.config.ts를 새로 만들지 마라** — 스캐폴드가 이미 올바른 값으로 생성했다.
- `appName`: English app ID registered in console (case-sensitive — mismatch causes 4031 deploy error). **수정 금지.**
- `brand.primaryColor`: TDS theme color (RGB HEX, e.g., `#3182F6`)
- `permissions`: Device permissions array (e.g., `{ name: "clipboard", access: "write" }`)
- v2에 있던 `displayName`·`icon`은 v3에서 **콘솔 등록 정보로 이관** — config에 넣어도 무시된다.

## 4. TDS (Toss Design System) Absolute Rules
- **NEVER override margin/padding:** TDS components have built-in padding. Use TDS `Spacing` (size prop required) for gaps. ListRow has NO padding prop.
- **Use auto-layout:** Flexbox `gap` only.
- **No external fonts:** Toss Products Sans auto-applied.

## 5. Core API & SDK Integration

**Import from `@apps-in-toss/web-framework`.** All SDK APIs are **imperative functions with `onEvent`/`onError` callbacks**, not React hooks.

**There are NO `useTossLogin`, `useTossAd`, `useTossPayment` hooks in the SDK.**

### Haptic feedback
```typescript
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
generateHapticFeedback({ type: "tickWeak" });    // Toggle, Chip
generateHapticFeedback({ type: "success" });      // Major CTA
```

### Storage (native persistence)
```typescript
import { Storage } from '@apps-in-toss/web-framework';
await Storage.setItem('key', 'stringValue');
const value = await Storage.getItem('key');  // string | null
await Storage.removeItem('key');
```

### Promotion (user rewards)
```typescript
import { grantPromotionReward } from '@apps-in-toss/web-framework';
await grantPromotionReward({
  promotionCode: 'CONSOLE_CODE',    // from 앱인토스 콘솔
  amount: 1000,                       // ≤ 5000 per user (cumulative)
});
```

### Ads — imperative only, NOT React components
- Banner: `TossAds` namespace — `TossAds.initialize({})` once, then `TossAds.attachBanner(adGroupId, targetEl, options?)` returns `{ destroy }` for cleanup
- Reward/Interstitial: `loadFullScreenAd` + `showFullScreenAd` — top-level functions with `onEvent` / `onError` callbacks
- All TossAds methods have `.isSupported()` for capability check before use
- **NO `loadAdMob` / `showAdMob` / `isAdMobLoaded` exports** — those names do not exist in the SDK
- **NO `TossRewardAd` or `AdSlot` in the SDK.** If needed as React component, wrap the imperative API in `src/components/` yourself. See `.ai-factory/apps-in-toss-essential.txt`.

### Login — no SDK API
Toss app provides user session automatically. NO `useTossLogin` or `login()` to call. Use `getIsTossLoginIntegratedService()` to check integration status (configured in 앱인토스 콘솔).

### In-App Purchase (IAP)
```typescript
// ⚠️ IAP는 `IAP` 네임스페이스 아래에 있다. 최상위 createOneTimePurchaseOrder import는 존재하지 않음.
import { IAP } from '@apps-in-toss/web-framework';
const cleanup = IAP.createOneTimePurchaseOrder({   // 반환: cleanup 함수 (종료 시 호출)
  options: {
    sku: 'product-id',
    processProductGrant: async ({ orderId }) => true,  // backend call
  },
  onEvent: (event) => { /* event.type==='success', event.data */ },
  onError: (error) => { /* ... */ },
});
```
Subscriptions: `IAP.createSubscriptionPurchaseOrder` (same shape + `offerId`).
NO `useTossPayment` hook. React 앱은 `src/components/TossPurchase.tsx` 래퍼 권장.

### Analytics (SDK only — external tools forbidden)
```typescript
import { Analytics } from '@apps-in-toss/web-framework';
Analytics.screen({ log_name: 'Home' });
Analytics.click({ log_name: 'CTA', salary: 50000000 });
```

## 6. 인앱광고 수수료 정책 (2026.04.01~)
- 인앱광고(IAA) 수수료 15% 적용 — 수익 UI에 순수익/총수익 구분 표시 권장
- 순수익 = 총수익 × 0.85
- 외부 로깅/분석 솔루션 (GA, Amplitude 등) 금지 — 반드시 SDK `Analytics` 사용

## 7. Deployment
- Deploy to Toss CDN (NOT Vercel, AWS, external clouds).
- 배포는 **파이프라인이 실행한다** — `ait` 명령을 직접 실행하지 마라(이 환경에 설치돼 있지 않아 시도는 턴만 태운다). 참고용 명령: ait deploy --api-key <KEY>

## 8. Review Checklist (Must Pass All)
- Users must be 19+ — no minor-targeted content
- No external domain navigation (outlinks) — all flows within the app
- Zero console.error in production build
- Zero CORS errors on external API calls
  - SDK v3 앱의 실행 origin은 두 개다 — 외부 API 서버를 쓰는 설계라면 그쪽 CORS 허용목록에 **둘 다** 있어야 한다:
    운영 `https://<appName>.web.tossmini.com` · QR 테스트 `https://<appName>.private-web.tossmini.com`
    (테스트에서만 CORS로 죽는 앱은 이 둘 중 private-web이 빠진 것)
- Android 7+ / iOS 16+ compatible Web APIs only
- 외부 로깅/분석 솔루션 사용 금지 — SDK `Analytics`만
- HEX 색상 하드코딩 금지 — TDS 컴포넌트 또는 `var(--tds-color-*)` CSS 변수만 (다크모드 필수)
- 앱 설치 유도 금지
- 프로모션 지급 한도 — `grantPromotionReward` amount ≤ 5000
