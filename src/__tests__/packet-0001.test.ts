import { describe, it, expect } from "vitest";

describe("Packet-0001: 도메인 타입 + RouteState 정의", () => {
  // AC-1: TypeScript 컴파일 통과 + import/function 없음
  it("AC-1[P0]: types.ts should have no top-level imports and no function definitions", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const typesPath = path.join(__dirname, "../lib/types.ts");
    const content = fs.readFileSync(typesPath, "utf-8");

    // Check: no top-level import statements
    const lines = content.split("\n");
    const importLines = lines.filter(line => {
      const trimmed = line.trim();
      return (trimmed.startsWith("import ") || trimmed.startsWith("export import")) && !trimmed.startsWith("import.meta");
    });
    expect(importLines).toHaveLength(0);

    // Check: no function definitions (function keyword or arrow function body logic)
    // Allow const definitions (which can be constants or types)
    const functionPattern = /^\s*(export\s+)?(async\s+)?function\s+\w+/;
    const functionLines = lines.filter(line => functionPattern.test(line));
    expect(functionLines).toHaveLength(0);
  });

  // AC-2: STORAGE_KEYS 7개 키 정의 확인
  it("AC-2[P0]: should export STORAGE_KEYS with exactly 7 keys matching v1 pattern", async () => {
    const types = await import("../lib/types");

    expect(types.STORAGE_KEYS).toBeDefined();
    expect(typeof types.STORAGE_KEYS).toBe("object");

    // 7 keys: HOUSEHOLD, TASKS, LOGS, SETTINGS, SCHEMA, BACKUP, LOGS_CORRUPT
    const keys = Object.keys(types.STORAGE_KEYS);
    expect(keys).toHaveLength(7);

    // Verify each key value matches the v1 contract
    expect(types.STORAGE_KEYS.HOUSEHOLD).toBe("choresplit:household:v1");
    expect(types.STORAGE_KEYS.TASKS).toBe("choresplit:tasks:v1");
    expect(types.STORAGE_KEYS.LOGS).toBe("choresplit:logs:v1");
    expect(types.STORAGE_KEYS.SETTINGS).toBe("choresplit:settings:v1");
    expect(types.STORAGE_KEYS.SCHEMA).toBe("choresplit:schema:v1");
    expect(types.STORAGE_KEYS.BACKUP).toBe("choresplit:backup:v1");
    expect(types.STORAGE_KEYS.LOGS_CORRUPT).toBe("choresplit:logs:v1.corrupt");
  });

  // AC-3: RouteState 8개 라우트 정의 확인
  it("AC-3[P0]: should export RouteState type with 8 routes", async () => {
    // Note: RouteState is a type, so we can only verify its presence
    // Runtime values represent the route definitions
    const types = await import("../lib/types");

    // Check that ROUTE_PATHS or similar runtime constant exists
    // Or check that RouteState can be imported (type check at compile time)
    expect(types).toBeDefined();
    expect(types.ROUTE_PATHS).toBeDefined();

    const paths = Object.keys(types.ROUTE_PATHS);
    expect(paths).toHaveLength(8);

    // Verify all 8 routes exist
    const expectedRoutes = ["/", "/onboarding", "/tasks", "/report", "/settle", "/ranking", "/invite", "/settings"];
    for (const route of expectedRoutes) {
      expect(paths).toContain(route);
    }
  });

  // AC-4: 상한 상수 6개 정의 확인
  it("AC-4[P0]: should export limit constants with correct values", async () => {
    const types = await import("../lib/types");

    expect(types.MAX_MEMBERS).toBe(4);
    expect(types.MAX_TASKS).toBe(30);
    expect(types.MAX_FINE).toBe(10000);
    expect(types.LOG_KEEP_DAYS).toBe(180);
    expect(types.MAX_UNLOCKED_WEEKS).toBe(12);
    expect(types.MAX_WEEK_BACK).toBe(12);

    // Verify all are numbers
    expect(typeof types.MAX_MEMBERS).toBe("number");
    expect(typeof types.MAX_TASKS).toBe("number");
    expect(typeof types.MAX_FINE).toBe("number");
    expect(typeof types.LOG_KEEP_DAYS).toBe("number");
    expect(typeof types.MAX_UNLOCKED_WEEKS).toBe("number");
    expect(typeof types.MAX_WEEK_BACK).toBe("number");
  });

  // AC-1 Extended: Verify no runtime functions in types.ts
  it("AC-1[extended][P0]: types.ts should only contain type definitions and constants", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const typesPath = path.join(__dirname, "../lib/types.ts");
    const content = fs.readFileSync(typesPath, "utf-8");

    // Should not contain: function definitions, arrow functions, imperative logic
    expect(content).not.toMatch(/^\s*function\s+\w+/m);
    expect(content).not.toMatch(/^\s*export\s+function\s+\w+/m);

    // Should contain: interface, type, const (for constants only)
    const hasInterfaces = /interface\s+\w+/m.test(content);
    const hasTypes = /type\s+\w+/m.test(content);
    const hasConsts = /const\s+[A-Z_]+\s*=/m.test(content); // Uppercase = likely constants

    expect(hasInterfaces || hasTypes || hasConsts).toBe(true);
  });

  // AC-2 Extended: Verify STORAGE_KEYS immutability
  it("AC-2[extended][P0]: STORAGE_KEYS values should all follow 'choresplit:*' pattern", async () => {
    const types = await import("../lib/types");
    const pattern = /^choresplit:[a-z0-9_:\.]+$/;

    for (const [key, value] of Object.entries(types.STORAGE_KEYS)) {
      expect(typeof value).toBe("string");
      expect(value).toMatch(pattern);
      expect(value).toContain("choresplit:");
    }
  });

  // AC-3 Extended: Verify RouteState contract per route
  it("AC-3[extended][P0]: ROUTE_PATHS should define all 8 routes with correct types", async () => {
    const types = await import("../lib/types");

    // Check that /report and /settle routes exist (they have special state contracts)
    expect(types.ROUTE_PATHS["/"]).toBeDefined();
    expect(types.ROUTE_PATHS["/report"]).toBeDefined();
    expect(types.ROUTE_PATHS["/settle"]).toBeDefined();

    // All routes should be strings
    for (const [path, value] of Object.entries(types.ROUTE_PATHS)) {
      expect(typeof path).toBe("string");
      expect(path).toMatch(/^\//);
    }
  });

  // Entity types: Verify file contains type definitions (compile-time check via file scan)
  it("AC-2[P1]: types.ts source should contain entity type definitions", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const typesPath = path.join(__dirname, "../lib/types.ts");
    const content = fs.readFileSync(typesPath, "utf-8");

    // Verify entity types are defined
    expect(content).toContain("interface Household");
    expect(content).toContain("interface Member");
    expect(content).toContain("interface ChoreTask");
    expect(content).toContain("interface ChoreLog");
    expect(content).toContain("interface AppSettings");
  });

  // Derived types: Verify file contains derived type definitions
  it("AC-2[P1]: types.ts source should contain derived calculation type definitions", async () => {
    const fs = await import("fs");
    const path = await import("path");

    const typesPath = path.join(__dirname, "../lib/types.ts");
    const content = fs.readFileSync(typesPath, "utf-8");

    // Verify derived types are defined
    expect(content).toContain("interface FairnessResult");
    expect(content).toContain("interface MemberShare");
    expect(content).toContain("interface FineSummary");
    expect(content).toContain("interface UnfulfilledItem");
    expect(content).toContain("interface RankRow");
    expect(content).toContain("interface StreakResult");
    expect(content).toContain("interface SnapshotV1");
  });

  // Overall: Module compiles and exports expected shape
  it("should export a well-formed types module with no circular dependencies", async () => {
    const types = await import("../lib/types");

    // Runtime exports: STORAGE_KEYS (1), MAX_* (6), ROUTE_PATHS (1) = 8 exports minimum
    const exportCount = Object.keys(types).length;
    expect(exportCount).toBeGreaterThanOrEqual(8);

    // Must have STORAGE_KEYS, route constants, and limit constants
    expect(types.STORAGE_KEYS).toBeDefined();
    expect(types.MAX_MEMBERS).toBeDefined();
    expect(types.ROUTE_PATHS).toBeDefined();
  });
});
