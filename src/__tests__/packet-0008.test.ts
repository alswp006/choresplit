import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockRouter } from "@/__tests__/__helpers__/mocks";
import type { AppSettings, ChoreTask } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

/**
 * PACKET 0008: src/lib/store.tsx — AppStore (전역 상태 / 부팅 / 저장 실패 알림)
 *
 * Expected exports from src/lib/store.tsx (NOT YET IMPLEMENTED — this is the red phase):
 *
 *   export function AppStoreProvider({ children }: { children: React.ReactNode }): JSX.Element
 *   export function useAppStore(): {
 *     booting: boolean;
 *     household: Household | null;
 *     tasks: ChoreTask[];
 *     logs: ChoreLog[];
 *     settings: AppSettings;
 *     schemaCompatible: boolean;
 *     toast: string | null;
 *     toggleLog: (date: string, taskId: string, memberId: string) => void;
 *     saveTask: (task: ChoreTask) => void;
 *     saveSettings: (settings: AppSettings) => void;
 *   }
 *
 * Boot sequence: on mount, reads repository.loadAll() (household/tasks/logs/settings),
 * readSchema() (schemaCompatible), and consumeRecoveryFlags() (corrupted-key recovery toast).
 * booting starts true and flips to false once boot finishes.
 *
 * Any write action (toggleLog / saveTask / saveSettings) that fails at the storage boundary
 * (@/storage/storage safeSet returning { ok: false }) must:
 *   - set toast to a fixed Korean message depending on failure reason
 *   - roll the in-memory state back to what it was before the failed action
 *
 * useAppStore() called outside AppStoreProvider must throw a clear error.
 */

mockTds();
mockRouter();

// Wrap @/storage/storage so we can force a single safeSet() call to fail on demand,
// while every other call (safeGet, other safeSet calls) keeps its real localStorage-backed behavior.
vi.mock("@/storage/storage", async () => {
  const actual = await vi.importActual<typeof import("@/storage/storage")>("@/storage/storage");
  return { ...actual, safeSet: vi.fn(actual.safeSet) };
});

import { safeSet, consumeRecoveryFlags } from "@/storage/storage";
import { AppStoreProvider, useAppStore } from "@/lib/store";

type StoreSnapshot = ReturnType<typeof useAppStore>;

function renderStore() {
  const renderLog: StoreSnapshot[] = [];
  function Probe() {
    const store = useAppStore();
    renderLog.push(store);
    return React.createElement(
      "div",
      null,
      React.createElement("span", { "data-testid": "booting" }, String(store.booting)),
      React.createElement("span", { "data-testid": "toast" }, store.toast ?? ""),
    );
  }
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AppStoreProvider, null, React.createElement(Probe)),
    ),
  );
  return renderLog;
}

async function waitForBootDone() {
  await waitFor(() => {
    expect(screen.getByTestId("booting").textContent).toBe("false");
  });
}

describe("AppStore — 전역 상태 / 부팅 / 저장 실패 알림", () => {
  it("AC-1[P0]: booting은 true로 시작해 loadAll 완료 후 false가 되고 필드를 노출한다", async () => {
    const renderLog = renderStore();

    // First render (before boot effect resolves) must reflect the initial state contract.
    expect(renderLog[0].booting).toBe(true);

    await waitForBootDone();

    const settled = renderLog[renderLog.length - 1];
    expect(settled.booting).toBe(false);
    expect(settled.household).toBeNull();
    expect(settled.tasks).toEqual([]);
    expect(settled.logs).toEqual([]);
    expect(settled.settings.reminderTime).toBe("21:00");
    expect(settled.settings.onboardingDone).toBe(false);
    expect(settled.schemaCompatible).toBe(false);
    expect(settled.toast).toBeNull();
  });

  it("AC-2[P0]: 체크인 토글 저장 실패 시 toast가 정확한 문구로 설정되고 이전 상태로 롤백된다", async () => {
    const renderLog = renderStore();
    await waitForBootDone();

    // First toggle succeeds (real safeSet) — establishes the "previous state" to roll back to.
    await act(async () => {
      renderLog[renderLog.length - 1].toggleLog("2026-09-01", "ct_task0001", "mb_member01");
    });
    await waitFor(() => {
      expect(renderLog[renderLog.length - 1].logs.length).toBe(1);
    });
    const beforeFailure = renderLog[renderLog.length - 1].logs;

    // Second toggle: force the underlying persistence write to fail with a quota error.
    vi.mocked(safeSet).mockReturnValueOnce({ ok: false, reason: "quota" });
    await act(async () => {
      renderLog[renderLog.length - 1].toggleLog("2026-09-02", "ct_task0002", "mb_member02");
    });

    await waitFor(() => {
      expect(screen.getByTestId("toast").textContent).toBe(
        "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      );
    });

    const settled = renderLog[renderLog.length - 1];
    expect(settled.toast).toBe("저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요");
    expect(settled.logs.length).toBe(1);
    expect(settled.logs).toEqual(beforeFailure);
  });

  it("AC-2[P0]: 설정 저장 실패 시 toast가 노출되고 settings가 이전 값으로 롤백된다", async () => {
    const renderLog = renderStore();
    await waitForBootDone();
    const previousSettings = renderLog[renderLog.length - 1].settings;

    vi.mocked(safeSet).mockReturnValueOnce({ ok: false, reason: "quota" });
    const nextSettings: AppSettings = {
      ...previousSettings,
      reminderTime: "08:30",
      activeMemberId: "mb_member01",
    };
    await act(async () => {
      renderLog[renderLog.length - 1].saveSettings(nextSettings);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toast").textContent).toBe(
        "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      );
    });

    const settled = renderLog[renderLog.length - 1];
    expect(settled.settings.reminderTime).toBe(previousSettings.reminderTime);
    expect(settled.settings.activeMemberId).toBe(previousSettings.activeMemberId);
  });

  it("AC-2: 항목(과제) 저장 실패 시 toast가 노출되고 tasks가 이전 값으로 롤백된다", async () => {
    const renderLog = renderStore();
    await waitForBootDone();

    vi.mocked(safeSet).mockReturnValueOnce({ ok: false, reason: "quota" });
    const task: ChoreTask = {
      id: "ct_test0001",
      name: "청소",
      emoji: "🧹",
      difficulty: 2,
      repeatDays: [],
      assigneeId: null,
      fineAmount: 0,
      archived: false,
      updatedAt: Date.now(),
    };
    await act(async () => {
      renderLog[renderLog.length - 1].saveTask(task);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toast").textContent).toBe(
        "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요",
      );
    });

    const settled = renderLog[renderLog.length - 1];
    expect(settled.tasks).toEqual([]);
  });

  it("AC-3[P0]: 손상 복구 시 '일부 기록을 읽지 못했어요' 토스트가 정확히 1회 노출되고 큐가 소진된다", async () => {
    localStorage.setItem(STORAGE_KEYS.LOGS, "{not-valid-json");

    const renderLog = renderStore();
    await waitForBootDone();

    expect(screen.getByTestId("toast").textContent).toBe("일부 기록을 읽지 못했어요");
    const settled = renderLog[renderLog.length - 1];
    expect(settled.toast).toBe("일부 기록을 읽지 못했어요");
    expect(settled.logs).toEqual([]); // corrupted key falls back to []

    // The store must have already drained the recovery queue during boot —
    // calling it again directly must come back empty (consumed exactly once).
    expect(consumeRecoveryFlags()).toEqual([]);
  });

  it("AC-4: AppStoreProvider 밖에서 useAppStore()를 호출하면 명확한 에러를 던진다", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useAppStore();
      return null;
    }
    expect(() => render(React.createElement(Bad))).toThrow(/AppStoreProvider/);
    consoleSpy.mockRestore();
  });
});
