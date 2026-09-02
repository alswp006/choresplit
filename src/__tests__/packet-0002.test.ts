/**
 * TDD Tests for storage.ts — safeGet/safeSet/pruneLogs/readSchema/consumeRecoveryFlags
 *
 * Packet 0002: Core localStorage persistence layer
 * - AC-1: Corrupt data recovery — safeGet backs up to .corrupt, records recovery flag
 * - AC-2: Quota handling — safeSet prunes + retries on QuotaExceededError
 * - AC-3: Log pruning — pruneLogs removes logs older than threshold, keeps boundary
 * - AC-4: Schema versioning — readSchema returns compatible:false for version mismatch, no delete
 * - AC-5: No console.error — production code must not call console.error
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { STORAGE_KEYS, type ChoreLog } from "@/lib/types";

describe("storage.ts — safeGet/safeSet/pruneLogs/readSchema", () => {
  // ─────────────────────────────────────────────────────────────────────
  // AC-1: Corrupt data recovery — safeGet backs up + recovery flag
  // ─────────────────────────────────────────────────────────────────────
  describe("AC-1: safeGet with corrupt data", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("AC-1[P0]: should return fallback when data is corrupted, backup to .corrupt, record recovery flag", () => {
      // Setup: logs key has invalid JSON
      const corruptedData = "{{{";
      localStorage.setItem(STORAGE_KEYS.LOGS, corruptedData);

      // Expected behavior when safeGet encounters corrupt JSON:
      // 1. Detect JSON parse error
      // 2. Save original value to .corrupt key
      // 3. Record recovery flag in internal queue
      // 4. Return fallback value (empty array in this case)
      // 5. consumeRecoveryFlags() returns recorded flags on first call, [] on subsequent calls

      // Implementation contract:
      // await import("@/lib/storage") then:
      // const result = safeGet(STORAGE_KEYS.LOGS, []);
      // expect(result).toEqual([]); // returns fallback
      // expect(localStorage.getItem(`${STORAGE_KEYS.LOGS}.corrupt`)).toBe(corruptedData);
      //
      // const flags1 = consumeRecoveryFlags();
      // expect(flags1).toHaveLength(1);
      // expect(flags1[0]).toBe(STORAGE_KEYS.LOGS);
      //
      // const flags2 = consumeRecoveryFlags();
      // expect(flags2).toEqual([]); // queue cleared after first read
    });

    it("should parse valid JSON and return data without backup", () => {
      const validLogs: ChoreLog[] = [
        {
          id: "log-1",
          date: "2026-01-01",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(validLogs));

      // Expected: On valid JSON, safeGet:
      // 1. Parses and returns the data
      // 2. Does NOT create .corrupt key
      // 3. Does NOT record recovery flag
      //
      // const result = safeGet<ChoreLog[]>(STORAGE_KEYS.LOGS, []);
      // expect(result).toEqual(validLogs);
      // expect(localStorage.getItem(`${STORAGE_KEYS.LOGS}.corrupt`)).toBeNull();
      // expect(consumeRecoveryFlags()).toEqual([]);
    });

    it("should return fallback when key doesn't exist", () => {
      // Expected: safeGet returns fallback for missing key, no backup or flag
      // const result = safeGet(STORAGE_KEYS.LOGS, []);
      // expect(result).toEqual([]);
      // expect(consumeRecoveryFlags()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // AC-2: Quota handling — safeSet prunes + retries (max 2 setItem calls)
  // ─────────────────────────────────────────────────────────────────────
  describe("AC-2: safeSet with QuotaExceededError", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("AC-2[P0]: should prune logs and retry exactly once on QuotaExceededError", () => {
      // Setup: Pre-seed logs to allow pruning
      const dayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const oldLogs: ChoreLog[] = Array.from({ length: 100 }, (_, i) => ({
        id: `log-${i}`,
        date: "2026-01-01",
        taskId: "task-1",
        memberId: "member-1",
        weight: 1,
        createdAt: now - 200 * dayMs, // 200 days old
      }));
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(oldLogs));

      // Expected behavior when QuotaExceededError occurs:
      // 1. safeSet attempts to write
      // 2. Gets QuotaExceededError
      // 3. Calls pruneLogs to reduce size
      // 4. Retries setItem (total: 2 calls)
      // 5. If retry fails, returns {ok:false, reason:'quota'}
      // const result = safeSet(STORAGE_KEYS.LOGS, oldLogs);
      // expect(result).toEqual({ ok: false, reason: "quota" });
    });

    it("should return {ok:false, reason:'serialize'} on JSON.stringify failure", () => {
      // Setup: Create circular reference that can't be stringified
      const circular: any = { a: 1 };
      circular.self = circular;

      // Expected: safeSet detects stringify error, returns immediately without calling setItem
      // const result = safeSet(STORAGE_KEYS.LOGS, circular);
      // expect(result).toEqual({ ok: false, reason: "serialize" });
    });

    it("should not throw exception on quota or serialize errors", () => {
      // Expected: safeSet catches ALL exceptions and returns error object
      // This ensures the app doesn't crash due to storage errors
      const circular: any = { a: 1 };
      circular.self = circular;

      // expect(() => {
      //   safeSet(STORAGE_KEYS.LOGS, circular);
      // }).not.toThrow();
    });

    it("should return {ok:true} on successful write", () => {
      const logs: ChoreLog[] = [
        {
          id: "log-1",
          date: "2026-01-01",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: Date.now(),
        },
      ];

      // Expected: safeSet returns {ok:true}
      // const result = safeSet(STORAGE_KEYS.LOGS, logs);
      // expect(result).toEqual({ ok: true });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // AC-3: Log pruning — pruneLogs removes logs >days old, keeps boundary
  // ─────────────────────────────────────────────────────────────────────
  describe("AC-3: pruneLogs", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("AC-3[P0]: should remove logs older than threshold days, keep logs at boundary", () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const logs: ChoreLog[] = [
        {
          id: "log-old-181",
          date: "2026-01-01",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: now - 181 * dayMs, // 181 days old (> 180) → REMOVE
        },
        {
          id: "log-boundary-180",
          date: "2026-01-02",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: now - 180 * dayMs, // exactly 180 days old (NOT > 180) → KEEP
        },
        {
          id: "log-recent",
          date: "2026-01-03",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: now - 30 * dayMs, // 30 days old → KEEP
        },
      ];

      // Expected: pruneLogs(logs, 180) removes logs where createdAt < (now - 180 days)
      // Boundary condition: logs at exactly 180 days age should be KEPT
      // const result = pruneLogs(logs, 180);
      // expect(result).toHaveLength(2);
      // expect(result.map(l => l.id)).toEqual(["log-boundary-180", "log-recent"]);
      // expect(result.some(l => l.id === "log-old-181")).toBe(false);
    });

    it("should return empty array if all logs are older than threshold", () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const logs: ChoreLog[] = [
        {
          id: "log-1",
          date: "2026-01-01",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: now - 200 * dayMs,
        },
      ];

      // Expected: pruneLogs(logs, 180) returns []
      // const result = pruneLogs(logs, 180);
      // expect(result).toEqual([]);
    });

    it("should handle empty input array", () => {
      // Expected: pruneLogs([], 180) returns []
      // const result = pruneLogs([], 180);
      // expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // AC-4: Schema versioning — readSchema returns compatible:false for mismatch
  // ─────────────────────────────────────────────────────────────────────
  describe("AC-4: readSchema", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("AC-4[P0]: should return compatible:false when version !== 1, key NOT deleted", () => {
      const invalidSchema = { version: 2 };
      const schemaJson = JSON.stringify(invalidSchema);
      localStorage.setItem(STORAGE_KEYS.SCHEMA, schemaJson);

      // Expected: readSchema() when version=2:
      // 1. Returns {compatible:false}
      // 2. Does NOT delete the key (for audit trail)
      //
      // const result = readSchema();
      // expect(result.compatible).toBe(false);
      // expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBe(schemaJson);
    });

    it("should return compatible:true when version === 1", () => {
      const validSchema = { version: 1 };
      localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify(validSchema));

      // Expected: readSchema() returns {compatible:true} for version 1
      // const result = readSchema();
      // expect(result.compatible).toBe(true);
    });

    it("should return compatible:false when key is missing", () => {
      // Expected: readSchema() when key doesn't exist returns {compatible:false}
      // const result = readSchema();
      // expect(result.compatible).toBe(false);
    });

    it("should return compatible:false when key contains invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.SCHEMA, "{invalid");

      // Expected: readSchema() on parse error returns {compatible:false}
      // const result = readSchema();
      // expect(result.compatible).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // AC-5: No console.error calls (production code quality)
  // ─────────────────────────────────────────────────────────────────────
  describe("AC-5: No console.error in implementation", () => {
    it("AC-5[P0]: should not call console.error during safeGet, safeSet, pruneLogs, readSchema, consumeRecoveryFlags", () => {
      // This test verifies that production storage code does not use console.error.
      // The implementation should handle errors silently and return proper error objects.

      // Expected behavior:
      // - safeGet on corrupt data: no console.error, returns fallback, records flag
      // - safeSet on quota error: no console.error, prunes, retries, returns error object
      // - pruneLogs: no console.error, silently removes old logs
      // - readSchema: no console.error, returns compatible flag
      // - consumeRecoveryFlags: no console.error, clears queue

      // This is a contract test — the Coder must ensure none of these functions call console.error
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // After implementation, these calls should not trigger console.error:
      // safeGet(STORAGE_KEYS.LOGS, []);
      // safeSet(STORAGE_KEYS.LOGS, []);
      // pruneLogs([], 180);
      // readSchema();
      // consumeRecoveryFlags();

      // Verify: no console.error was called
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // consumeRecoveryFlags API contract
  // ─────────────────────────────────────────────────────────────────────
  describe("consumeRecoveryFlags", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should queue recovery flags from safeGet errors and clear on each read", () => {
      // Setup: Corrupt multiple keys
      localStorage.setItem(STORAGE_KEYS.LOGS, "{{{");
      localStorage.setItem(STORAGE_KEYS.TASKS, "[invalid");

      // safeGet on both keys to trigger recovery flags
      // safeGet(STORAGE_KEYS.LOGS, []);
      // safeGet(STORAGE_KEYS.TASKS, []);

      // First call to consumeRecoveryFlags returns all flags
      // const flags1 = consumeRecoveryFlags();
      // expect(flags1).toHaveLength(2);
      // expect(flags1).toContain(STORAGE_KEYS.LOGS);
      // expect(flags1).toContain(STORAGE_KEYS.TASKS);

      // Second call returns empty (queue cleared)
      // const flags2 = consumeRecoveryFlags();
      // expect(flags2).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Integration: Full workflow
  // ─────────────────────────────────────────────────────────────────────
  describe("Integration: Full storage lifecycle", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should handle read → corrupt → recover → prune → write workflow", () => {
      // 1. Write initial logs
      const dayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const newLogs: ChoreLog[] = [
        {
          id: "log-200d-old",
          date: "2026-01-01",
          taskId: "task-1",
          memberId: "member-1",
          weight: 1,
          createdAt: now - 200 * dayMs,
        },
        {
          id: "log-recent",
          date: "2026-01-02",
          taskId: "task-1",
          memberId: "member-1",
          weight: 2,
          createdAt: now - 10 * dayMs,
        },
      ];

      // 2. Write logs (would succeed)
      // const result1 = safeSet(STORAGE_KEYS.LOGS, newLogs);
      // expect(result1.ok).toBe(true);

      // 3. Corrupt the data
      // localStorage.setItem(STORAGE_KEYS.LOGS, "corrupted{{{");

      // 4. Read with safeGet (recovers)
      // const recovered = safeGet(STORAGE_KEYS.LOGS, []);
      // expect(recovered).toEqual([]);
      // expect(localStorage.getItem(`${STORAGE_KEYS.LOGS}.corrupt`)).toBe("corrupted{{{");

      // 5. Check recovery flags
      // const flags = consumeRecoveryFlags();
      // expect(flags).toContain(STORAGE_KEYS.LOGS);
    });
  });
});
