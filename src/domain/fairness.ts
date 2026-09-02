/**
 * 공정성 점수 계산 순수 함수.
 * localStorage 접근 없음 — 입력을 받아 값을 반환하는 순수 함수만 존재한다.
 */

import type { ChoreLog, FairnessResult } from "@/lib/types";
import type { Task, CheckinLog } from "@/lib/contract";
import { weekKeyOf, weekRange } from "@/domain/date";

/** 가중치 목록과 목표 비율로 공정성 점수를 계산 (share_i = weight_i/total, fairness = max(0, round(100 - Σ|share_i-target_i|*100))) */
export function calcFairness(
  weights: { memberId: string; weight: number }[],
  targets: Record<string, number>
): FairnessResult {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);

  if (total === 0) {
    const shares: Record<string, number> = {};
    for (const w of weights) {
      shares[w.memberId] = 0;
    }
    return { fairness: 0, shares, isEmpty: true };
  }

  const shares: Record<string, number> = {};
  let diffSum = 0;
  for (const w of weights) {
    const share = w.weight / total;
    shares[w.memberId] = share;
    const target = targets[w.memberId] ?? 0;
    diffSum += Math.abs(share - target);
  }

  const fairness = Math.max(0, Math.round(100 - diffSum * 100));
  return { fairness, shares };
}

/** 공정성 점수 등급: 90↑완벽 / 70~89양호 / 40~69주의 / 미만 불균형 */
export function gradeOf(score: number): "완벽" | "양호" | "주의" | "불균형" {
  if (score >= 90) return "완벽";
  if (score >= 70) return "양호";
  if (score >= 40) return "주의";
  return "불균형";
}

/** 특정 주(weekKey)의 로그를 구성원별 가중치 합계로 집계 */
export function weeklyWeightsByMember(
  logs: ChoreLog[],
  weekKey: string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const log of logs) {
    if (weekKeyOf(log.date) !== weekKey) continue;
    result[log.memberId] = (result[log.memberId] ?? 0) + log.weight;
  }
  return result;
}

/** 로그를 항목(taskId)별 가중치 합계로 집계 */
export function weightByTask(logs: ChoreLog[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const log of logs) {
    result[log.taskId] = (result[log.taskId] ?? 0) + log.weight;
  }
  return result;
}

/**
 * 특정 구성원의 공정성 점수 (계약: 패킷 0004).
 * tasks에 속한 checkins만 대상으로, 참여 구성원 수 기준 목표 지분(1/n) 대비
 * 이 구성원의 체크인 지분 편차로 점수를 계산한다.
 * fairness_i = max(0, round(100 - |share_i - target_i| * 100))
 */
export function calculateFairnessScore(
  memberId: string,
  checkins: CheckinLog[],
  tasks: Task[]
): number {
  const taskIds = new Set(tasks.map((t) => t.id));
  const relevant = checkins.filter((c) => taskIds.has(c.taskId));
  const total = relevant.length;
  if (total === 0) return 0;

  const counts: Record<string, number> = {};
  for (const c of relevant) {
    counts[c.memberId] = (counts[c.memberId] ?? 0) + 1;
  }

  const memberCount = Object.keys(counts).length;
  const target = 1 / memberCount;
  const share = (counts[memberId] ?? 0) / total;

  return Math.max(0, Math.round(100 - Math.abs(share - target) * 100));
}

/** 특정 주(weekKey)의 요일별(월~일) 가중치 합계 — 항상 길이 7 */
export function dailyWeights(
  logs: { date: string; weight: number }[],
  weekKey: string
): number[] {
  const { days } = weekRange(weekKey);
  return days.map((dateKey) =>
    logs.reduce((sum, log) => (log.date === dateKey ? sum + log.weight : sum), 0)
  );
}
