/**
 * 스냅샷 base64 인코딩/디코딩 & 병합.
 * localStorage에 직접 접근하지 않고 storage.ts(safeGet/safeSet)만 경유한다.
 */

import type { SnapshotV1, Household, ChoreTask, ChoreLog } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";
import { safeGet, safeSet, type SetResult } from "@/storage/storage";

export type DecodeResult = SnapshotV1 | { ok: false };

/** groupId → 발급된 공유코드 매핑. 초대 화면에서 재조회해도 같은 코드를 돌려주기 위한 저장소. */
const SHARE_CODES_KEY = "choresplit:sharecodes:v1";
const SHARE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 0/O, 1/I 제외
const SHARE_CODE_LENGTH = 6;

function randomShareCode(): string {
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)];
  }
  return code;
}

/** 초대 공유코드 생성 (계약: 패킷 0007). 같은 groupId로 다시 호출하면 기존 코드를 재사용한다. */
export function generateShareCode(groupId: string): string {
  const codes = safeGet<Record<string, string>>(SHARE_CODES_KEY, {});
  const existing = codes[groupId];
  if (existing) return existing;

  const code = randomShareCode();
  safeSet(SHARE_CODES_KEY, { ...codes, [groupId]: code });
  return code;
}

function utf8ToBase64(input: string): string {
  return btoa(
    encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

function base64ToUtf8(input: string): string {
  return decodeURIComponent(
    atob(input)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function encodeSnapshot(snapshot: SnapshotV1): string {
  return utf8ToBase64(JSON.stringify(snapshot));
}

function hasStringId(item: unknown): item is { id: string } {
  return (
    !!item &&
    typeof item === "object" &&
    typeof (item as Record<string, unknown>).id === "string" &&
    (item as Record<string, unknown>).id !== ""
  );
}

function isValidHousehold(value: unknown): value is Household {
  if (!value || typeof value !== "object") return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    h.id !== "" &&
    typeof h.name === "string" &&
    Array.isArray(h.members) &&
    h.members.every(hasStringId)
  );
}

function isValidSnapshot(value: unknown): value is SnapshotV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isValidHousehold(v.household) &&
    Array.isArray(v.tasks) &&
    v.tasks.every(hasStringId) &&
    Array.isArray(v.logs) &&
    v.logs.every(hasStringId) &&
    typeof v.savedAt === "number"
  );
}

export function decodeSnapshot(encoded: string): DecodeResult {
  try {
    const json = base64ToUtf8(encoded);
    const parsed: unknown = JSON.parse(json);
    if (!isValidSnapshot(parsed)) {
      return { ok: false };
    }
    return parsed;
  } catch {
    return { ok: false };
  }
}

function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
  resolve: (currentItem: T, incomingItem: T) => T
): T[] {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => {
    const existing = map.get(item.id);
    map.set(item.id, existing ? resolve(existing, item) : item);
  });
  return Array.from(map.values());
}

function mergeHousehold(current: Household | null, incoming: Household): Household {
  if (!current) return incoming;
  const members = mergeById(current.members, incoming.members, (existing) => existing);
  return { ...current, members };
}

export type MergeResult =
  | { ok: true; household: Household; tasks: ChoreTask[]; logs: ChoreLog[] }
  | { ok: false; reason: "invalid" | "storage" };

/** 병합 직전 현재 상태를 백업하고(1개만 유지), 로그는 id 기준 중복 제거, 과제는 updatedAt이 더 최신인 쪽을 채택하며 병합한다. */
export function mergeSnapshot(newSnapshot: SnapshotV1): MergeResult {
  try {
    const currentHousehold = safeGet<Household | null>(STORAGE_KEYS.HOUSEHOLD, null);
    const currentTasks = safeGet<ChoreTask[]>(STORAGE_KEYS.TASKS, []);
    const currentLogs = safeGet<ChoreLog[]>(STORAGE_KEYS.LOGS, []);

    // BACKUP은 최신 1건만 유지(덮어쓰기) — 병합 직전 상태로 롤백하기 위한 용도.
    const backupResult = safeSet(STORAGE_KEYS.BACKUP, {
      household: currentHousehold,
      tasks: currentTasks,
      logs: currentLogs,
      savedAt: Date.now(),
    });

    const mergedHousehold = mergeHousehold(currentHousehold, newSnapshot.household);
    const mergedTasks = mergeById(currentTasks, newSnapshot.tasks, (existing, incoming) =>
      incoming.updatedAt >= existing.updatedAt ? incoming : existing
    );
    const mergedLogs = mergeById(currentLogs, newSnapshot.logs, (existing) => existing);

    const results: SetResult[] = [
      backupResult,
      safeSet(STORAGE_KEYS.HOUSEHOLD, mergedHousehold),
      safeSet(STORAGE_KEYS.TASKS, mergedTasks),
      safeSet(STORAGE_KEYS.LOGS, mergedLogs),
    ];
    if (results.some((r) => !r.ok)) {
      return { ok: false, reason: "storage" };
    }

    return { ok: true, household: mergedHousehold, tasks: mergedTasks, logs: mergedLogs };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
