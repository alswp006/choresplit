/**
 * localStorage 기반 CRUD 저장소.
 * localStorage에 직접 접근하지 않고 storage.ts(safeGet/safeSet/removeItem)만 경유한다.
 */

import type { Household, Member, ChoreTask, ChoreLog, AppSettings, Difficulty } from "@/lib/types";
import { STORAGE_KEYS, LOG_KEEP_DAYS } from "@/lib/types";
import { safeGet, safeSet, removeItem, type SetResult } from "@/storage/storage";
import { todayKST, daysBetween } from "@/domain/date";
import type { Task } from "@/lib/contract";

/** 계약(Task) 타입 CRUD 전용 키 — ChoreTask(STORAGE_KEYS.TASKS)와 별개 저장소. */
const CONTRACT_TASKS_KEY = "choresplit:contract-tasks:v1";

const MEMBER_EMOJIS = ["🙂", "😀", "🐱", "🐶", "🐰", "🦊", "🐼", "🐨"];

const DEFAULT_TASKS: { name: string; emoji: string }[] = [
  { name: "설거지", emoji: "🍽️" },
  { name: "청소", emoji: "🧹" },
  { name: "빨래", emoji: "🧺" },
  { name: "분리수거", emoji: "♻️" },
  { name: "요리", emoji: "🍳" },
  { name: "화장실청소", emoji: "🚽" },
];

const DEFAULT_SETTINGS: AppSettings = {
  activeMemberId: null,
  reminderEnabled: true,
  reminderTime: "21:00",
  onboardingDone: false,
  lastReportWeekKey: null,
  reportUnlockedWeeks: [],
};

function randomBase36(length: number): string {
  let result = "";
  while (result.length < length) {
    result += Math.random().toString(36).slice(2);
  }
  return result.slice(0, length);
}

function makeId(prefix: string): string {
  return `${prefix}_${randomBase36(8)}`;
}

export function loadAll(): {
  household: Household | null;
  tasks: ChoreTask[];
  logs: ChoreLog[];
  settings: AppSettings;
} {
  return {
    household: safeGet<Household | null>(STORAGE_KEYS.HOUSEHOLD, null),
    tasks: safeGet<ChoreTask[]>(STORAGE_KEYS.TASKS, []),
    logs: safeGet<ChoreLog[]>(STORAGE_KEYS.LOGS, []),
    settings: safeGet<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
  };
}

export function createHousehold(name: string, memberNames: string[]): Household {
  const now = Date.now();
  const targetShare = memberNames.length > 0 ? 1 / memberNames.length : 0;
  const members: Member[] = memberNames.map((memberName, index) => ({
    id: makeId("mb"),
    name: memberName,
    emoji: MEMBER_EMOJIS[index % MEMBER_EMOJIS.length],
    targetShare,
    createdAt: now,
  }));

  const household: Household = {
    id: makeId("hh"),
    name,
    createdAt: now,
    members,
  };

  safeSet(STORAGE_KEYS.HOUSEHOLD, household);
  return household;
}

export function seedDefaultTasks(): ChoreTask[] {
  const now = Date.now();
  const tasks: ChoreTask[] = DEFAULT_TASKS.map(({ name, emoji }) => ({
    id: makeId("ct"),
    name,
    emoji,
    difficulty: 2 as Difficulty,
    repeatDays: [],
    assigneeId: null,
    fineAmount: 0,
    archived: false,
    updatedAt: now,
  }));

  safeSet(STORAGE_KEYS.TASKS, tasks);
  return tasks;
}

export function upsertTask(task: ChoreTask): ChoreTask[] {
  const tasks = safeGet<ChoreTask[]>(STORAGE_KEYS.TASKS, []);
  const index = tasks.findIndex((t) => t.id === task.id);
  const next = index === -1 ? [...tasks, task] : tasks.map((t, i) => (i === index ? task : t));
  safeSet(STORAGE_KEYS.TASKS, next);
  return next;
}

export function archiveTask(taskId: string): ChoreTask[] {
  const tasks = safeGet<ChoreTask[]>(STORAGE_KEYS.TASKS, []);
  const next = tasks.map((t) => (t.id === taskId ? { ...t, archived: true, updatedAt: Date.now() } : t));
  safeSet(STORAGE_KEYS.TASKS, next);
  return next;
}

/** 같은 (date, taskId, memberId)로 반복 호출하면 로그 생성/삭제를 토글한다 (멱등). */
export function toggleLog(date: string, taskId: string, memberId: string): ChoreLog[] {
  const logs = safeGet<ChoreLog[]>(STORAGE_KEYS.LOGS, []);
  const id = `lg_${date}_${taskId}_${memberId}`;
  const exists = logs.some((l) => l.id === id);

  let next: ChoreLog[];
  if (exists) {
    next = logs.filter((l) => l.id !== id);
  } else {
    const tasks = safeGet<ChoreTask[]>(STORAGE_KEYS.TASKS, []);
    const task = tasks.find((t) => t.id === taskId);
    const weight: Difficulty = task?.difficulty ?? 2;
    next = [...logs, { id, date, taskId, memberId, weight, createdAt: Date.now() }];
  }

  safeSet(STORAGE_KEYS.LOGS, next);
  return next;
}

export function saveSettings(settings: AppSettings): void {
  safeSet(STORAGE_KEYS.SETTINGS, settings);
}

/** LOG_KEEP_DAYS(180일)보다 오래된 로그를 제거하고 제거된 개수를 반환한다. */
export function pruneOldLogs(): number {
  const logs = safeGet<ChoreLog[]>(STORAGE_KEYS.LOGS, []);
  const today = todayKST();
  const remaining = logs.filter((log) => daysBetween(log.date, today) <= LOG_KEEP_DAYS);
  safeSet(STORAGE_KEYS.LOGS, remaining);
  return logs.length - remaining.length;
}

export function resetAll(): void {
  Object.values(STORAGE_KEYS).forEach((key) => removeItem(key));
}

/** 새 항목 생성 (계약: 패킷 0007). */
export async function createTask(task: Omit<Task, "id" | "createdAt">): Promise<Task> {
  const tasks = safeGet<Task[]>(CONTRACT_TASKS_KEY, []);
  const created: Task = { ...task, id: makeId("tk"), createdAt: Date.now() };
  safeSet(CONTRACT_TASKS_KEY, [...tasks, created]);
  return created;
}

/** 항목 수정 (계약: 패킷 0007). id·createdAt은 덮어쓸 수 없다. */
export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const tasks = safeGet<Task[]>(CONTRACT_TASKS_KEY, []);
  const next = tasks.map((t) =>
    t.id === id ? { ...t, ...updates, id: t.id, createdAt: t.createdAt } : t
  );
  safeSet(CONTRACT_TASKS_KEY, next);
}

/** 항목 삭제 (계약: 패킷 0007). */
export async function deleteTask(id: string): Promise<void> {
  const tasks = safeGet<Task[]>(CONTRACT_TASKS_KEY, []);
  safeSet(CONTRACT_TASKS_KEY, tasks.filter((t) => t.id !== id));
}
