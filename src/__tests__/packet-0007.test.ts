/**
 * Packet 0007 Tests: 온보딩 페이지 /onboarding (S1)
 *
 * Tests for src/pages/Onboarding.tsx (NOT YET IMPLEMENTED — TDD red phase)
 * - AC-1: happy path — creates household + navigates to '/' with replace
 * - AC-2: blank nickname shows inline field error, does not persist
 * - AC-3: loading disables re-tap; save failure shows Toast
 * - AC-4: existing household redirects immediately on mount
 * - AC-5: haptic feedback fires on submit tap; no HEX/Tailwind in source
 *
 * useAppState() is mocked at "@/lib/store" (the project's actual state path —
 * NOT "@/state/AppStateContext", which this project does not use). The mock's
 * default `createHousehold` implementation delegates to the REAL
 * @/lib/household + @/lib/storage so AC-1's localStorage assertions exercise
 * real persistence logic, not a stub.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { createHousehold as createHouseholdImpl, validateOnboarding } from "@/lib/household";
import { saveState } from "@/lib/storage";
import type { ChoreSplitState } from "@/lib/types";

mockAll();

// ── Mock @/lib/store (this project's real state path) ──
const { storeRef } = vi.hoisted(() => ({
  storeRef: {
    ready: true as boolean,
    state: { household: null as any },
    error: null as string | null,
    createHousehold: vi.fn() as any,
  },
}));

vi.mock("@/lib/store", () => ({
  useAppState: () => storeRef,
  AppStateProvider: ({ children }: any) => children,
}));

// Real household creation + real persistence — used as the default mock
// implementation so AC-1 exercises actual localStorage writes.
function defaultCreateHousehold(name: string, myName: string) {
  const validation = validateOnboarding(name, myName);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const next: ChoreSplitState = createHouseholdImpl(name, myName);
  const result = saveState(next);
  if (!result.ok) {
    return result;
  }
  storeRef.state = { ...storeRef.state, household: next.household };
  return { ok: true };
}

beforeEach(() => {
  storeRef.ready = true;
  storeRef.state = { household: null };
  storeRef.error = null;
  storeRef.createHousehold = vi.fn(defaultCreateHousehold);
});

// Lazily imported so the vi.mock("@/lib/store") above is in effect first.
async function loadOnboarding() {
  const mod = await import("@/pages/Onboarding");
  return mod.default;
}

function fillForm(householdName: string, nickname: string) {
  const inputs = screen.getAllByRole("textbox");
  expect(inputs.length).toBeGreaterThanOrEqual(2);
  fireEvent.change(inputs[0], { target: { value: householdName } });
  fireEvent.change(inputs[1], { target: { value: nickname } });
  return inputs;
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
}

describe("온보딩 페이지 /onboarding (S1)", () => {
  describe("AC-1[P0]: happy path creates household and navigates home", () => {
    it("saves members[0].name='민수' and 6 seeded chores, then navigates('/', { replace: true })", async () => {
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "민수");
      submit();

      const saved = JSON.parse(localStorage.getItem("choresplit:v1") ?? "null");
      expect(saved).not.toBeNull();
      expect(saved.members[0].name).toBe("민수");
      expect(saved.chores.length).toBe(6);
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    it("calls the store's createHousehold with the trimmed form values", async () => {
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "민수");
      submit();

      expect(storeRef.createHousehold).toHaveBeenCalledTimes(1);
      expect(storeRef.createHousehold).toHaveBeenCalledWith("우리집", "민수");
    });
  });

  describe("AC-2[P0]: blank nickname shows inline field error", () => {
    it("shows hasError + help='닉네임을 입력해주세요' and does not persist state", async () => {
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "   ");
      submit();

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("닉네임을 입력해주세요");
      expect(localStorage.getItem("choresplit:v1")).toBeNull();
      expect(storeRef.createHousehold).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("AC-3[P0]: submit loading state + save-failure toast", () => {
    it("disables the submit button after the first tap so a second tap is ignored", async () => {
      storeRef.createHousehold = vi.fn(() => ({ ok: true }));
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "민수");
      const button = screen.getByRole("button", { name: "시작하기" });

      fireEvent.click(button);
      expect(storeRef.createHousehold).toHaveBeenCalledTimes(1);
      expect(button).toHaveProperty("disabled", true);

      fireEvent.click(button);
      expect(storeRef.createHousehold).toHaveBeenCalledTimes(1);
    });

    it("shows Toast '저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요' when save fails", async () => {
      storeRef.createHousehold = vi.fn(() => ({
        ok: false,
        error: "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      }));
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "민수");
      submit();

      const toast = screen.getByRole("status");
      expect(toast.textContent).toBe("저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("AC-4[P0]: existing household redirects immediately on mount", () => {
    it("navigates('/', { replace: true }) on mount without any user interaction", async () => {
      storeRef.state = {
        household: { id: "h_existing1", name: "기존가구", inviteCode: "ABC123", createdAt: "2026-01-01T00:00:00.000Z" },
      };
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-5: haptic feedback on submit + copy/style hygiene", () => {
    it("calls generateHapticFeedback({ type: 'success' }) when '시작하기' is tapped", async () => {
      const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
      const Onboarding = await loadOnboarding();
      renderWithRouter(React.createElement(Onboarding));

      fillForm("우리집", "민수");
      submit();

      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    });

    it("contains zero HEX color literals and zero Tailwind spacing classes", () => {
      const sourcePath = fileURLToPath(new URL("../pages/Onboarding.tsx", import.meta.url));
      const source = readFileSync(sourcePath, "utf-8");

      expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
      expect(/className=["'][^"']*\b[mp][xytrbl]?-\d/.test(source)).toBe(false);
    });
  });
});
