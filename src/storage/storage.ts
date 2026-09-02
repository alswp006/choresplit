import { STORAGE_KEYS, LOG_KEEP_DAYS } from "@/lib/types";

export type SetResult = { ok: true } | { ok: false; reason: "serialize" | "quota" };

let recoveryQueue: string[] = [];

function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function safeGet<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      localStorage.setItem(`${key}.corrupt`, raw);
    } catch {
      // ignore backup failure — still fall back below
    }
    recoveryQueue.push(key);
    return fallback;
  }
}

export function consumeRecoveryFlags(): string[] {
  const flags = recoveryQueue;
  recoveryQueue = [];
  return flags;
}

export function pruneLogs<T extends { createdAt: number }>(logs: T[], keepDays: number): T[] {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  return logs.filter((log) => log.createdAt >= cutoff);
}

export function safeSet<T>(key: string, value: T): SetResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, reason: "serialize" };
  }

  try {
    localStorage.setItem(key, serialized);
    return { ok: true };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      return { ok: false, reason: "quota" };
    }
  }

  // Prune the value itself (if it's the logs collection) and retry exactly once —
  // no extra localStorage reads/writes here, to keep the retry budget at 2 setItem calls.
  let retrySerialized = serialized;
  if (key === STORAGE_KEYS.LOGS && Array.isArray(value)) {
    try {
      const pruned = pruneLogs(value as unknown as { createdAt: number }[], LOG_KEEP_DAYS);
      retrySerialized = JSON.stringify(pruned);
    } catch {
      retrySerialized = serialized;
    }
  }

  try {
    localStorage.setItem(key, retrySerialized);
    return { ok: true };
  } catch {
    return { ok: false, reason: "quota" };
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

export function readSchema(): { compatible: boolean } {
  const raw = localStorage.getItem(STORAGE_KEYS.SCHEMA);
  if (raw === null) return { compatible: false };

  try {
    const parsed = JSON.parse(raw) as { version?: number };
    return { compatible: parsed.version === 1 };
  } catch {
    return { compatible: false };
  }
}
