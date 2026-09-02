import { describe, it, expect } from "vitest";
import {
  weekKeyOf,
  weekRange,
  shiftWeek,
  shouldShowReminder,
  isFutureDate,
  todayKST,
  toDateKey,
  weekdayOf,
  daysBetween,
  formatDateLabel,
} from "@/domain/date";

describe("date.ts — KST 날짜/주 경계 유틸", () => {
  // ============ AC-1: weekKeyOf & weekRange ============
  describe("AC-1: weekKeyOf and weekRange", () => {
    it("AC-1[P0]: weekKeyOf('2026-09-02') should return '2026-W36'", () => {
      const result = weekKeyOf("2026-09-02");
      expect(result).toBe("2026-W36");
    });

    it("AC-1[P0]: weekRange('2026-W36') should return object with start/end/days", () => {
      const range = weekRange("2026-W36");
      expect(range).toHaveProperty("start");
      expect(range).toHaveProperty("end");
      expect(range).toHaveProperty("days");
      expect(range.start).toBe("2026-08-31");
      expect(range.end).toBe("2026-09-06");
    });

    it("AC-1[P0]: weekRange days array should have exactly 7 entries, Mon-Sun", () => {
      const range = weekRange("2026-W36");
      expect(range.days.length).toBe(7);
      expect(range.days[0]).toBe("2026-08-31"); // Monday
      expect(range.days[1]).toBe("2026-09-01"); // Tuesday
      expect(range.days[2]).toBe("2026-09-02"); // Wednesday
      expect(range.days[3]).toBe("2026-09-03"); // Thursday
      expect(range.days[4]).toBe("2026-09-04"); // Friday
      expect(range.days[5]).toBe("2026-09-05"); // Saturday
      expect(range.days[6]).toBe("2026-09-06"); // Sunday
    });

    it("AC-1[P0]: weekKeyOf should handle various dates in the same week", () => {
      // All dates in W36 should map to same week key
      expect(weekKeyOf("2026-08-31")).toBe("2026-W36"); // Monday
      expect(weekKeyOf("2026-09-02")).toBe("2026-W36"); // Wednesday
      expect(weekKeyOf("2026-09-06")).toBe("2026-W36"); // Sunday
    });
  });

  // ============ AC-2: shiftWeek ============
  describe("AC-2: shiftWeek", () => {
    it("AC-2[P0]: shiftWeek('2026-W36', -1) should return '2026-W35'", () => {
      const result = shiftWeek("2026-W36", -1);
      expect(result).toBe("2026-W35");
    });

    it("AC-2[P0]: shiftWeek('2026-W01', -1) should wrap to previous year's last week", () => {
      const result = shiftWeek("2026-W01", -1);
      // 2025 has 52 weeks (standard 52-week year)
      expect(result).toBe("2025-W52");
    });

    it("AC-2[P0]: shiftWeek forward should increment week correctly", () => {
      const result = shiftWeek("2026-W36", 1);
      expect(result).toBe("2026-W37");
    });

    it("AC-2[P0]: shiftWeek near year end should wrap to next year", () => {
      // Assume 2026 has 52 weeks
      const result = shiftWeek("2026-W52", 1);
      expect(result).toBe("2027-W01");
    });

    it("AC-2[P0]: shiftWeek with +5 should shift multiple weeks", () => {
      const result = shiftWeek("2026-W36", 5);
      expect(result).toBe("2026-W41");
    });

    it("AC-2[P0]: shiftWeek with -5 should shift backwards multiple weeks", () => {
      const result = shiftWeek("2026-W10", -5);
      expect(result).toBe("2026-W05");
    });
  });

  // ============ AC-3: shouldShowReminder ============
  describe("AC-3: shouldShowReminder", () => {
    it("AC-3[P0]: shouldShowReminder('21:30', '21:00', 0, true) should return true", () => {
      const result = shouldShowReminder("21:30", "21:00", 0, true);
      expect(result).toBe(true);
    });

    it("AC-3[P0]: shouldShowReminder('20:00', '21:00', 0, true) should return false", () => {
      // Current time 20:00 is before target time 21:00
      const result = shouldShowReminder("20:00", "21:00", 0, true);
      expect(result).toBe(false);
    });

    it("AC-3[P0]: shouldShowReminder with elapsedHours=1 should return false", () => {
      const result = shouldShowReminder("21:30", "21:00", 1, true);
      expect(result).toBe(false);
    });

    it("AC-3[P0]: shouldShowReminder with active=false should return false", () => {
      const result = shouldShowReminder("21:30", "21:00", 0, false);
      expect(result).toBe(false);
    });

    it("AC-3[P0]: shouldShowReminder at exact target time should return true", () => {
      const result = shouldShowReminder("21:00", "21:00", 0, true);
      expect(result).toBe(true);
    });

    it("AC-3[P0]: shouldShowReminder with multiple elapsed hours should be false", () => {
      const result = shouldShowReminder("21:30", "21:00", 5, true);
      expect(result).toBe(false);
    });
  });

  // ============ AC-4: isFutureDate ============
  describe("AC-4: isFutureDate", () => {
    it("AC-4[P0]: isFutureDate with tomorrow's date should return true", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = toDateKey(tomorrow);
      const result = isFutureDate(tomorrowKey);
      expect(result).toBe(true);
    });

    it("AC-4[P0]: isFutureDate with today's date should return false", () => {
      const today = toDateKey(new Date());
      const result = isFutureDate(today);
      expect(result).toBe(false);
    });

    it("AC-4[P0]: isFutureDate with yesterday's date should return false", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = toDateKey(yesterday);
      const result = isFutureDate(yesterdayKey);
      expect(result).toBe(false);
    });

    it("AC-4[P0]: isFutureDate with date 30 days in future should return true", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateKey = toDateKey(futureDate);
      const result = isFutureDate(futureDateKey);
      expect(result).toBe(true);
    });
  });

  // ============ AC-5: No forbidden APIs ============
  // These checks will be verified by grepping the actual source file
  // Test structure to ensure the functions exist and are callable
  describe("AC-5: Function exports and basic structure", () => {
    it("AC-5[P0]: all required functions should be exported", () => {
      expect(typeof weekKeyOf).toBe("function");
      expect(typeof weekRange).toBe("function");
      expect(typeof shiftWeek).toBe("function");
      expect(typeof shouldShowReminder).toBe("function");
      expect(typeof isFutureDate).toBe("function");
      expect(typeof todayKST).toBe("function");
      expect(typeof toDateKey).toBe("function");
      expect(typeof weekdayOf).toBe("function");
      expect(typeof daysBetween).toBe("function");
      expect(typeof formatDateLabel).toBe("function");
    });
  });

  // ============ Additional helper tests ============
  describe("Helper utilities", () => {
    it("toDateKey should convert Date to YYYY-MM-DD string", () => {
      const date = new Date("2026-09-02");
      const result = toDateKey(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result.length).toBe(10);
    });

    it("weekdayOf should return weekday name for a date key", () => {
      // 2026-09-02 is a Wednesday
      const result = weekdayOf("2026-09-02");
      expect(["월", "화", "수", "목", "금", "토", "일"]).toContain(result);
    });

    it("daysBetween should calculate days between two dates", () => {
      const result = daysBetween("2026-09-02", "2026-09-09");
      expect(result).toBe(7);
    });

    it("formatDateLabel should format date as MM/DD(요일)", () => {
      const result = formatDateLabel("2026-09-02");
      // Expected format: "09/02(수)" or similar
      expect(result).toMatch(/\d{2}\/\d{2}\([가-힣]\)/);
    });

    it("todayKST should return today's date in YYYY-MM-DD format", () => {
      const result = todayKST();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result.length).toBe(10);
    });
  });

  // ============ Edge cases ============
  describe("Edge cases", () => {
    it("weekRange should handle W01 correctly", () => {
      const range = weekRange("2026-W01");
      expect(range.days.length).toBe(7);
      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
    });

    it("weekRange should handle last week of year", () => {
      const range = weekRange("2025-W52");
      expect(range.days.length).toBe(7);
      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
    });

    it("daysBetween with same date should return 0", () => {
      const result = daysBetween("2026-09-02", "2026-09-02");
      expect(result).toBe(0);
    });

    it("formatDateLabel should work for all months", () => {
      const dates = [
        "2026-01-15",
        "2026-02-28",
        "2026-12-31",
      ];
      dates.forEach((date) => {
        const result = formatDateLabel(date);
        expect(result).toMatch(/\d{2}\/\d{2}\([가-힣]\)/);
      });
    });
  });
});
