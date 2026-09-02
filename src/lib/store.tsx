import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Household, ChoreTask, ChoreLog, AppSettings, Difficulty } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";
import { safeSet, readSchema, consumeRecoveryFlags } from "@/storage/storage";
import { loadAll } from "@/storage/repository";

const TOAST_QUOTA = "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요";
const TOAST_RECOVERY = "일부 기록을 읽지 못했어요";

const DEFAULT_SETTINGS: AppSettings = {
  activeMemberId: null,
  reminderEnabled: true,
  reminderTime: "21:00",
  onboardingDone: false,
  lastReportWeekKey: null,
  reportUnlockedWeeks: [],
};

interface AppStoreState {
  booting: boolean;
  household: Household | null;
  tasks: ChoreTask[];
  logs: ChoreLog[];
  settings: AppSettings;
  schemaCompatible: boolean;
  toast: string | null;
}

interface AppStoreValue extends AppStoreState {
  toggleLog: (date: string, taskId: string, memberId: string) => void;
  saveTask: (task: ChoreTask) => void;
  saveSettings: (settings: AppSettings) => void;
}

const INITIAL_STATE: AppStoreState = {
  booting: true,
  household: null,
  tasks: [],
  logs: [],
  settings: DEFAULT_SETTINGS,
  schemaCompatible: false,
  toast: null,
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStoreState>(INITIAL_STATE);

  useEffect(() => {
    const { household, tasks, logs, settings } = loadAll();
    const { compatible } = readSchema();
    const recovered = consumeRecoveryFlags();
    setState({
      booting: false,
      household,
      tasks,
      logs,
      settings,
      schemaCompatible: compatible,
      toast: recovered.length > 0 ? TOAST_RECOVERY : null,
    });
  }, []);

  const toggleLog = useCallback((date: string, taskId: string, memberId: string) => {
    setState((prev) => {
      const id = `lg_${date}_${taskId}_${memberId}`;
      const exists = prev.logs.some((l) => l.id === id);
      let next: ChoreLog[];
      if (exists) {
        next = prev.logs.filter((l) => l.id !== id);
      } else {
        const task = prev.tasks.find((t) => t.id === taskId);
        const weight: Difficulty = task?.difficulty ?? 2;
        next = [...prev.logs, { id, date, taskId, memberId, weight, createdAt: Date.now() }];
      }

      const result = safeSet(STORAGE_KEYS.LOGS, next);
      if (!result.ok) {
        return { ...prev, toast: TOAST_QUOTA };
      }
      return { ...prev, logs: next, toast: null };
    });
  }, []);

  const saveTask = useCallback((task: ChoreTask) => {
    setState((prev) => {
      const index = prev.tasks.findIndex((t) => t.id === task.id);
      const next = index === -1 ? [...prev.tasks, task] : prev.tasks.map((t, i) => (i === index ? task : t));

      const result = safeSet(STORAGE_KEYS.TASKS, next);
      if (!result.ok) {
        return { ...prev, toast: TOAST_QUOTA };
      }
      return { ...prev, tasks: next, toast: null };
    });
  }, []);

  const saveSettings = useCallback((settings: AppSettings) => {
    setState((prev) => {
      const result = safeSet(STORAGE_KEYS.SETTINGS, settings);
      if (!result.ok) {
        return { ...prev, toast: TOAST_QUOTA };
      }
      return { ...prev, settings, toast: null };
    });
  }, []);

  const value: AppStoreValue = { ...state, toggleLog, saveTask, saveSettings };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within an AppStoreProvider");
  }
  return ctx;
}
