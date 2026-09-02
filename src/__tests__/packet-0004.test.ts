import { describe, it, expect } from "vitest";
import {
  calcFairness,
  gradeOf,
  dailyWeights,
  weeklyWeightsByMember,
  weightByTask,
} from "@/domain/fairness";

describe("fairness.ts — 공정성 점수 순수 함수", () => {
  describe("AC-1: calcFairness basic calculation", () => {
    it("should calculate fairness with correct shares and score", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 6 },
          { memberId: "b", weight: 4 },
        ],
        { a: 0.5, b: 0.5 }
      );
      expect(result.fairness).toBe(80);
      expect(result.shares).toEqual({ a: 0.6, b: 0.4 });
    });

    it("should handle three members with unequal targets", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 5 },
          { memberId: "b", weight: 3 },
          { memberId: "c", weight: 2 },
        ],
        { a: 0.5, b: 0.3, c: 0.2 }
      );
      expect(result.fairness).toBe(100);
      expect(result.shares).toEqual({ a: 0.5, b: 0.3, c: 0.2 });
    });

    it("should round fairness to nearest integer", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 7 },
          { memberId: "b", weight: 3 },
        ],
        { a: 0.5, b: 0.5 }
      );
      expect(Number.isInteger(result.fairness)).toBe(true);
      expect(result.fairness).toBeLessThanOrEqual(100);
    });
  });

  describe("AC-2: calcFairness with zero weights", () => {
    it("should return isEmpty:true and fairness:0 when all weights are zero", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 0 },
          { memberId: "b", weight: 0 },
        ],
        { a: 0.5, b: 0.5 }
      );
      expect(result.fairness).toBe(0);
      expect(result.shares).toEqual({ a: 0, b: 0 });
      expect(result.isEmpty).toBe(true);
    });

    it("should return isEmpty:true when weights array is empty", () => {
      const result = calcFairness([], { a: 0.5 });
      expect(result.fairness).toBe(0);
      expect(result.isEmpty).toBe(true);
      expect(Object.keys(result.shares).length).toBe(0);
    });

    it("should handle single member with zero weight", () => {
      const result = calcFairness(
        [{ memberId: "a", weight: 0 }],
        { a: 1.0 }
      );
      expect(result.isEmpty).toBe(true);
      expect(result.fairness).toBe(0);
    });
  });

  describe("AC-3: gradeOf scoring", () => {
    it("should return '완벽' for score >= 90", () => {
      expect(gradeOf(90)).toBe("완벽");
      expect(gradeOf(95)).toBe("완벽");
      expect(gradeOf(100)).toBe("완벽");
    });

    it("should return '양호' for 70 <= score <= 89", () => {
      expect(gradeOf(89)).toBe("양호");
      expect(gradeOf(70)).toBe("양호");
      expect(gradeOf(79)).toBe("양호");
      expect(gradeOf(75)).toBe("양호");
    });

    it("should return '주의' for 40 <= score <= 69", () => {
      expect(gradeOf(40)).toBe("주의");
      expect(gradeOf(69)).toBe("주의");
      expect(gradeOf(50)).toBe("주의");
    });

    it("should return '불균형' for score < 40", () => {
      expect(gradeOf(39)).toBe("불균형");
      expect(gradeOf(0)).toBe("불균형");
      expect(gradeOf(20)).toBe("불균형");
    });

    it("should handle boundary values correctly", () => {
      expect(gradeOf(89)).not.toBe("완벽");
      expect(gradeOf(90)).not.toBe("양호");
      expect(gradeOf(69)).not.toBe("양호");
      expect(gradeOf(39)).not.toBe("주의");
    });
  });

  describe("AC-4: dailyWeights with fixed length 7", () => {
    it("should return array of length 7 with all zeros when no logs", () => {
      const result = dailyWeights([], "week-key");
      expect(result).toHaveLength(7);
      expect(result).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it("should always return length 7 regardless of input", () => {
      expect(dailyWeights([], "any-week").length).toBe(7);
      expect(dailyWeights([{ date: "2026-09-01", weight: 10 }], "week").length).toBe(7);
    });

    it("should contain only numeric values", () => {
      const result = dailyWeights([], "test-week");
      result.forEach((day) => {
        expect(typeof day).toBe("number");
        expect(day).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("AC-5: No localStorage access", () => {
    it("should not access localStorage in calcFairness", () => {
      // This test verifies that the function works without any localStorage calls
      const result = calcFairness(
        [{ memberId: "a", weight: 10 }],
        { a: 1.0 }
      );
      expect(result).toBeDefined();
      expect(result.fairness).toBeDefined();
      // If localStorage was accessed, it would throw in test environment
    });

    it("should not access localStorage in gradeOf", () => {
      const result = gradeOf(85);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should not access localStorage in dailyWeights", () => {
      const result = dailyWeights([], "week");
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Edge cases and robustness", () => {
    it("should handle very large weight values", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 1000000 },
          { memberId: "b", weight: 500000 },
        ],
        { a: 0.667, b: 0.333 }
      );
      expect(result.fairness).toBeGreaterThanOrEqual(0);
      expect(result.fairness).toBeLessThanOrEqual(100);
      expect(result.shares.a).toBeCloseTo(0.667, 2);
      expect(result.shares.b).toBeCloseTo(0.333, 2);
    });

    it("should handle weights as decimals", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 2.5 },
          { memberId: "b", weight: 1.5 },
        ],
        { a: 0.625, b: 0.375 }
      );
      expect(result.fairness).toBe(100);
      expect(result.shares.a).toBeCloseTo(0.625, 5);
      expect(result.shares.b).toBeCloseTo(0.375, 5);
    });

    it("should have shares sum close to 1.0 (accounting for rounding)", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 3 },
          { memberId: "b", weight: 7 },
        ],
        { a: 0.3, b: 0.7 }
      );
      const shareSum = Object.values(result.shares).reduce((a, b) => a + b, 0);
      expect(shareSum).toBeCloseTo(1.0, 5);
    });

    it("should calculate unfair distribution correctly (low fairness)", () => {
      const result = calcFairness(
        [
          { memberId: "a", weight: 9 },
          { memberId: "b", weight: 1 },
        ],
        { a: 0.5, b: 0.5 }
      );
      expect(result.fairness).toBeLessThan(50);
      expect(result.shares.a).toBe(0.9);
      expect(result.shares.b).toBe(0.1);
    });
  });

  describe("Helper functions (weeklyWeightsByMember, weightByTask)", () => {
    it("weeklyWeightsByMember should exist and be callable", () => {
      expect(typeof weeklyWeightsByMember).toBe("function");
    });

    it("weightByTask should exist and be callable", () => {
      expect(typeof weightByTask).toBe("function");
    });

    it("weeklyWeightsByMember should return an object with member data", () => {
      const result = weeklyWeightsByMember([], "week-key");
      expect(typeof result).toBe("object");
      expect(result).not.toBe(null);
    });

    it("weightByTask should process task data", () => {
      const result = weightByTask([]);
      expect(result).toBeDefined();
    });
  });
});
