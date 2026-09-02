/**
 * Packet 0017 Tests: 광고/햅틱 공용 모듈 + 검수 준수 스윕
 *
 * Tests for (NOT YET IMPLEMENTED — TDD red phase):
 * - src/lib/env.ts — VITE_TOSS_AD_GROUP_ID / VITE_TOSS_AD_SLOT_ID reader, never throws
 * - src/components/BannerSection.tsx — AdSlot wrapped top/bottom in Spacing, null when unset
 * - src/hooks/useHaptic.ts — success()/tickWeak(), safe no-op when SDK haptic is unavailable
 * - AC-3/AC-4: whole-src grep sweep for review-blocking patterns. This is ALSO currently RED
 *   independent of the new files above — src/styles/reward-ad.css hardcodes HEX fallback
 *   values inside var(--x, #fallback), which the sweep must fix.
 *
 * The sweep tests below walk the real src/ tree (excluding __tests__, which legitimately
 * contains these substrings as test fixtures/regex literals) rather than checking one file,
 * because the packet's scope is "src 전체".
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, renderHook } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mockAll } from "@/__tests__/__helpers__/mocks";
import { BannerSection } from "@/components/BannerSection";

mockAll();

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

function collectSourceFiles(
  dir: string,
  exts: string[],
  exclude: string[] = ["__tests__"],
): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (exclude.includes(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full, exts, exclude));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("광고/햅틱 공용 모듈 + 검수 준수 스윕 (0017)", () => {
  describe("AC-1[P0]: env.ts exposes AD_GROUP_ID/AD_SLOT_ID without throwing", () => {
    it("returns undefined for both when VITE_TOSS_AD_GROUP_ID/VITE_TOSS_AD_SLOT_ID are unset", async () => {
      vi.unstubAllEnvs();
      vi.resetModules();

      const mod = await import("@/lib/env");

      expect(mod.AD_GROUP_ID).toBeUndefined();
      expect(mod.AD_SLOT_ID).toBeUndefined();
    });

    it("returns the configured string values without throwing when the env vars ARE set", async () => {
      vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "home-bottom-group");
      vi.stubEnv("VITE_TOSS_AD_SLOT_ID", "report-unlock-slot");
      vi.resetModules();

      const mod = await import("@/lib/env");

      expect(mod.AD_GROUP_ID).toBe("home-bottom-group");
      expect(mod.AD_SLOT_ID).toBe("report-unlock-slot");
    });
  });

  describe("AC-2[P0]: BannerSection wraps AdSlot in top/bottom Spacing", () => {
    it("renders a Spacing before and after the AdSlot when adGroupId is configured", () => {
      const { container } = render(
        React.createElement(BannerSection, { adGroupId: "home-bottom" }),
      );

      const spacers = container.querySelectorAll("[data-spacing]");
      expect(spacers.length).toBe(2);
      expect(container.querySelector('[data-ad-group-id="home-bottom"]')).not.toBeNull();
    });

    it("renders nothing when adGroupId is not configured", () => {
      const { container } = render(
        React.createElement(BannerSection, { adGroupId: undefined }),
      );

      expect(container.innerHTML).toBe("");
      expect(container.querySelectorAll("[data-spacing]").length).toBe(0);
    });
  });

  describe("AC-2[P0]: useHaptic exposes success/tickWeak and no-ops when unsupported", () => {
    it("calls generateHapticFeedback with type 'success' and 'tickWeak' respectively", async () => {
      vi.resetModules();
      const sdk = await import("@apps-in-toss/web-framework");
      const { useHaptic } = await import("@/hooks/useHaptic");

      const { result } = renderHook(() => useHaptic());
      result.current.success();
      result.current.tickWeak();

      expect(sdk.generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
      expect(sdk.generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    });

    it("does not throw when generateHapticFeedback is unavailable in the current environment", async () => {
      vi.resetModules();
      vi.doMock("@apps-in-toss/web-framework", () => ({
        generateHapticFeedback: () => {
          throw new Error("bridge unavailable outside Toss WebView");
        },
      }));

      const { useHaptic } = await import("@/hooks/useHaptic");
      const { result } = renderHook(() => useHaptic());

      expect(typeof result.current.success).toBe("function");
      let threw = false;
      try {
        result.current.success();
        result.current.tickWeak();
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);

      vi.doUnmock("@apps-in-toss/web-framework");
      vi.resetModules();
    });
  });

  describe("AC-3[P0]: 검수 위반 패턴 0건 — HEX 하드코딩 / console.error / 외부 이탈", () => {
    it("contains zero raw HEX color literals across .ts/.tsx/.css source files", () => {
      const files = collectSourceFiles(SRC_DIR, [".ts", ".tsx", ".css"]);
      const offenders = files
        .filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(f, "utf-8")))
        .map((f) => path.relative(SRC_DIR, f));

      expect(files.length).toBeGreaterThan(0);
      expect(offenders).toEqual([]);
    });

    it("contains zero console.error calls and zero window.location.href/window.open usages", () => {
      const files = collectSourceFiles(SRC_DIR, [".ts", ".tsx"]);
      const consoleOffenders = files
        .filter((f) => /console\.error/.test(readFileSync(f, "utf-8")))
        .map((f) => path.relative(SRC_DIR, f));
      const outlinkOffenders = files
        .filter((f) => /window\.location\.href|window\.open\(/.test(readFileSync(f, "utf-8")))
        .map((f) => path.relative(SRC_DIR, f));

      expect(consoleOffenders).toEqual([]);
      expect(outlinkOffenders).toEqual([]);
    });
  });

  describe("AC-4[P0]: 금지 UI 라이브러리 0건, TDS는 @toss/tds-mobile에서만", () => {
    it("imports zero shadcn/mui/antd/chakra/stripe/iamport/admob/firebase packages and uses @toss/tds-mobile at least once", () => {
      const files = collectSourceFiles(SRC_DIR, [".ts", ".tsx"]);
      const forbidden =
        /from\s+["'](?:shadcn|@\/components\/ui\/|@mui\/|antd|@chakra-ui\/|stripe|@stripe\/|iamport|react-iamport|admob|react-native-admob|firebase|@firebase\/)/i;
      const offenders: string[] = [];
      let tdsMobileImportCount = 0;

      for (const f of files) {
        const src = readFileSync(f, "utf-8");
        if (forbidden.test(src)) offenders.push(path.relative(SRC_DIR, f));
        if (/from\s+["']@toss\/tds-mobile["']/.test(src)) tdsMobileImportCount += 1;
      }

      expect(offenders).toEqual([]);
      expect(tdsMobileImportCount).toBeGreaterThan(0);
    });
  });
});
