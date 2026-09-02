/**
 * Packet 0006 Tests: 앱 전역 상태 컨테이너 (Context)
 *
 * Tests for src/lib/store.tsx: AppStateProvider + useAppState()
 * - AC-1: ready flag lifecycle (false → true after loadState)
 * - AC-2: optimistic update + exact rollback on saveState failure
 * - AC-3: actions never throw, always return { ok, error? }
 * - AC-4: Provider boundary error + zero console.error in source
 *
 * TDD Red Phase: imports will fail until src/lib/store.tsx is implemented
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setItem } from "@/lib/storage";
import { createHousehold, addMember as addMemberDirect } from "@/lib/household";

// ── Partial mock of @/lib/storage: keep everything real, but let tests
//    control saveState's return value to simulate persistence failure. ──
const { mockSaveState, realSaveStateRef } = vi.hoisted(() => ({
  mockSaveState: vi.fn(),
  realSaveStateRef: { current: undefined as any },
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  realSaveStateRef.current = actual.saveState;
  mockSaveState.mockImplementation(actual.saveState);
  return { ...actual, saveState: mockSaveState };
});

import { AppStateProvider, useAppState } from "@/lib/store";

type Hook = ReturnType<typeof useAppState>;

function Probe({ onState }: { onState: (v: Hook) => void }) {
  const value = useAppState();
  onState(value);
  return null;
}

function renderProbe() {
  let latest!: Hook;
  render(
    React.createElement(
      AppStateProvider,
      null,
      React.createElement(Probe, {
        onState: (v: Hook) => {
          latest = v;
        },
      }),
    ),
  );
  return {
    get current() {
      return latest;
    },
  };
}

beforeEach(() => {
  mockSaveState.mockImplementation(realSaveStateRef.current);
});

describe("앱 전역 상태 컨테이너 (Context)", () => {
  describe("AC-1[P0]: ready flag lifecycle", () => {
    it("starts with ready=false on initial render and becomes true once loadState finishes", async () => {
      const seed = createHousehold("우리집", "민수");
      setItem("choresplit:v1", seed);

      const renderStates: boolean[] = [];
      render(
        React.createElement(
          AppStateProvider,
          null,
          React.createElement(Probe, {
            onState: (v: Hook) => {
              renderStates.push(v.ready);
            },
          }),
        ),
      );

      expect(renderStates[0]).toBe(false);

      await waitFor(() => {
        expect(renderStates[renderStates.length - 1]).toBe(true);
      });
    });

    it("exposes the persisted household state from storage once ready", async () => {
      const seed = createHousehold("우리집", "민수");
      setItem("choresplit:v1", seed);

      const probe = renderProbe();
      await waitFor(() => expect(probe.current.ready).toBe(true));

      expect(probe.current.state.household?.name).toBe("우리집");
      expect(probe.current.state.members).toHaveLength(1);
    });
  });

  describe("AC-2[P0]: optimistic update + rollback on save failure", () => {
    it("applies the checkIn immediately and keeps it when saveState succeeds", async () => {
      const seed = createHousehold("우리집", "민수");
      setItem("choresplit:v1", seed);

      const probe = renderProbe();
      await waitFor(() => expect(probe.current.ready).toBe(true));

      const choreId = probe.current.state.chores[0].id;
      const memberId = probe.current.state.members[0].id;
      const date = "2026-09-01";

      let result: { ok: boolean; error?: string } | undefined;
      act(() => {
        result = probe.current.toggleCheckIn(date, choreId, memberId);
      });

      expect(result).toEqual({ ok: true });
      expect(
        probe.current.state.checkIns.some(
          (c) => c.date === date && c.choreId === choreId && c.memberId === memberId,
        ),
      ).toBe(true);
    });

    it("rolls back state to its exact previous value when saveState returns ok:false", async () => {
      const seed = createHousehold("우리집", "민수");
      setItem("choresplit:v1", seed);

      const probe = renderProbe();
      await waitFor(() => expect(probe.current.ready).toBe(true));

      const stateBefore = probe.current.state;
      const choreId = stateBefore.chores[0].id;
      const memberId = stateBefore.members[0].id;
      const date = "2026-09-01";

      mockSaveState.mockReturnValueOnce({ ok: false, error: "저장 공간이 부족해요" });

      let result: { ok: boolean; error?: string } | undefined;
      act(() => {
        result = probe.current.toggleCheckIn(date, choreId, memberId);
      });

      // saveState must have been attempted with the optimistically-updated state
      expect(mockSaveState).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIns: expect.arrayContaining([
            expect.objectContaining({ date, choreId, memberId }),
          ]),
        }),
      );

      expect(result).toEqual({ ok: false, error: "저장 공간이 부족해요" });
      expect(probe.current.state.checkIns).toEqual(stateBefore.checkIns);
      expect(probe.current.error).toBe("저장 공간이 부족해요");
    });
  });

  describe("AC-3[P0]: actions never throw, always return a result object", () => {
    it("returns { ok: false, error } without throwing when the mutation is invalid", async () => {
      const seed = createHousehold("우리집", "민수");
      addMemberDirect(seed, "지영");
      addMemberDirect(seed, "준호");
      addMemberDirect(seed, "소진");
      setItem("choresplit:v1", seed);

      const probe = renderProbe();
      await waitFor(() => expect(probe.current.ready).toBe(true));
      expect(probe.current.state.members).toHaveLength(4);

      let result: { ok: boolean; error?: string } | undefined;
      expect(() => {
        act(() => {
          result = probe.current.addMember("철수");
        });
      }).not.toThrow();

      expect(result).toEqual({ ok: false, error: "동거인은 최대 4명까지 등록할 수 있어요" });
      expect(probe.current.state.members).toHaveLength(4);
    });

    it("returns { ok: true } without throwing when the mutation succeeds", async () => {
      const seed = createHousehold("우리집", "민수");
      setItem("choresplit:v1", seed);

      const probe = renderProbe();
      await waitFor(() => expect(probe.current.ready).toBe(true));

      let result: { ok: boolean; error?: string } | undefined;
      act(() => {
        result = probe.current.addMember("지영");
      });

      expect(result).toEqual({ ok: true });
      expect(probe.current.state.members).toHaveLength(2);
    });
  });

  describe("AC-4[P0]: Provider boundary + no console.error", () => {
    it("throws a clear error mentioning AppStateProvider when used outside the Provider", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      function Bare() {
        useAppState();
        return null;
      }

      expect(() => render(React.createElement(Bare))).toThrow(/AppStateProvider/);

      consoleErrorSpy.mockRestore();
    });

    it("never calls console.error in its own source code", () => {
      const sourcePath = fileURLToPath(new URL("../lib/store.tsx", import.meta.url));
      const source = readFileSync(sourcePath, "utf-8");

      expect(source.includes("console.error")).toBe(false);
    });
  });
});
