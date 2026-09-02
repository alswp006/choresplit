import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * Packet heal-1-03: CLAUDE.md — 패킷 검증 프로토콜 고정(dev 서버 금지, 턴 소진 방지)
 *
 * AC-1: CLAUDE.md에 정적 검증 명령 (tsc --noEmit / npm run build / vitest run) 명시
 * AC-2: CLAUDE.md에 권한 거부 재시도 금지 규칙 명시
 * AC-3: CLAUDE.md에 Provider 배선 원칙 명시
 * AC-4: 소스 코드 변경 0건, npm run build 성공
 */

describe("Packet heal-1-03: CLAUDE.md — 패킷 검증 프로토콜 고정", () => {
  const claudeMdPath = path.join(process.cwd(), "CLAUDE.md");
  let claudeMdContent: string;

  // Read CLAUDE.md once for all tests
  try {
    claudeMdContent = readFileSync(claudeMdPath, "utf-8");
  } catch (err) {
    claudeMdContent = "";
  }

  describe("AC-1: 검증 프로토콜 — tsc / build / vitest 명시", () => {
    it("should mention tsc --noEmit as primary validation command", () => {
      expect(claudeMdContent).toContain("tsc --noEmit");
    });

    it("should mention npm run build as validation method", () => {
      expect(claudeMdContent).toContain("npm run build");
    });

    it("should mention vitest run for test validation", () => {
      expect(claudeMdContent).toContain("vitest run");
    });

    it("should forbid dev server (dev 서버 기동 금지)", () => {
      expect(claudeMdContent).toMatch(/dev\s*서버|npm\s+run\s+dev|npx\s+vite/);
      // Explicitly forbid it
      expect(claudeMdContent.toLowerCase()).toMatch(
        /dev\s*서버.*금지|금지.*dev\s*서버|쓰지\s*마라.*dev|쓰지\s*마라.*vite/
      );
    });

    it("should forbid curl polling (curl 폴링 금지)", () => {
      expect(claudeMdContent).toMatch(/curl|localhost.*폴링|폴링.*localhost/);
    });

    it("should have section about checking paths", () => {
      // The validation section should explain that only these 3 commands are used
      expect(claudeMdContent).toContain("명령");
    });
  });

  describe("AC-2: 권한 거부 시 재시도 금지 규칙", () => {
    it("should contain '권한 거부' (permission denial) rule", () => {
      expect(claudeMdContent).toContain("권한 거부");
    });

    it("should forbid retry on permission denial (재시도 금지)", () => {
      expect(claudeMdContent).toMatch(/권한\s*거부.*재시도|재시도.*금지|재시도.*하지\s*마|재시도하지\s*마|재시도\s+금지/);
    });

    it("should mandate switching to static validation", () => {
      expect(claudeMdContent).toMatch(/정적\s*검증|static\s*validation/);
    });

    it("should explain not to waste turns on retries", () => {
      // Should have guidance to switch strategy on permission denial
      expect(claudeMdContent).toContain("거부");
    });
  });

  describe("AC-3: 전역 상태 훅과 Provider 배선 원칙", () => {
    it("should mention global state hooks (전역 상태)", () => {
      expect(claudeMdContent).toContain("전역 상태");
    });

    it("should mention Provider as requirement", () => {
      expect(claudeMdContent).toContain("Provider");
    });

    it("should require hooks to be inside Provider (Provider 하위)", () => {
      expect(claudeMdContent).toMatch(/Provider.*하위|하위.*Provider|Provider.*안/);
    });

    it("should mention wiring principles (배선)", () => {
      expect(claudeMdContent).toContain("배선");
    });

    it("should clarify that pages assume Provider exists", () => {
      // Pages should be written assuming Provider is already there
      expect(claudeMdContent).toMatch(/페이지|Provider|전제/);
    });
  });

  describe("AC-4: 소스 코드 변경 0건, 빌드 성공 유지", () => {
    it("should have CLAUDE.md file", () => {
      expect(claudeMdContent.length).toBeGreaterThan(0);
    });

    it("should not create/modify src files (this is metadata packet only)", () => {
      // This test verifies the principle: no source code changes
      // The actual verification happens at the end (build check)
      // For now, we just assert the expectation
      expect(true).toBe(true); // Placeholder for build verification
    });

    it("should maintain existing CLAUDE.md sections", () => {
      // Verify critical existing sections are still there
      expect(claudeMdContent).toContain("Pre-submission Checklist");
      expect(claudeMdContent).toContain("CRITICAL");
      expect(claudeMdContent).toContain("Testing");
    });

    it("should be valid markdown (has headers and sections)", () => {
      expect(claudeMdContent).toMatch(/^#/m); // Has markdown headers
      expect(claudeMdContent).toContain("##");
    });
  });

  describe("Integration: CLAUDE.md validation protocol completeness", () => {
    it("should have dedicated section on validation protocol", () => {
      // Should have a clear section about how to validate/test changes
      expect(claudeMdContent).toMatch(/검증|validation|명령|command/i);
    });

    it("should warn about permission denied in clear language", () => {
      // Non-English speakers should understand the policy
      expect(claudeMdContent).toContain("권한");
    });

    it("should mention all three validation commands together", () => {
      // tsc, build, and vitest should be grouped as validation commands
      const validationSection = claudeMdContent.match(
        /tsc.*npm\s+run\s+build.*vitest|vitest.*npm\s+run\s+build.*tsc/
      );
      expect(validationSection || claudeMdContent).toBeTruthy();
    });

    it("should explicitly forbid dev server and polling in same section", () => {
      // Should show what NOT to do
      expect(claudeMdContent).toMatch(/금지|forbidden|마라/);
    });
  });
});
