/**
 * Weekly report calculation engine + settlement (Packet 0004)
 *
 * Pure functions only — zero UI imports. All functions read `state` without mutating it.
 */

import type {
  ChoreSplitState,
  Member,
  MemberWeekStat,
  SettlementRecord,
  WeeklyReport,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 월요일 시작 주 식별자 — 입력 날짜가 속한 주의 월요일 "YYYY-MM-DD" */
export function getWeekStart(date: string): string {
  const d = parseDate(date);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d.getTime() + diffToMonday * DAY_MS);
  return formatDate(monday);
}

/** 해당 주의 일요일 "YYYY-MM-DD" (입력은 주 중 아무 날짜여도 됨) */
export function getWeekEnd(date: string): string {
  const monday = parseDate(getWeekStart(date));
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return formatDate(sunday);
}

function weekDates(weekStart: string): string[] {
  const monday = parseDate(weekStart);
  return Array.from({ length: 7 }, (_, i) =>
    formatDate(new Date(monday.getTime() + i * DAY_MS))
  );
}

/** 주간 리포트 계산 — stats/fairnessScore/dailyTrend/topChores/missedItems */
export function buildWeeklyReport(
  state: ChoreSplitState,
  weekStart: string
): WeeklyReport {
  const normalizedStart = getWeekStart(weekStart);
  const weekEnd = getWeekEnd(normalizedStart);
  const dates = weekDates(normalizedStart);
  const dateSet = new Set(dates);

  const weekCheckIns = state.checkIns.filter((c) => dateSet.has(c.date));

  const rawByMember = new Map<string, { count: number; weightedScore: number }>();
  for (const m of state.members) {
    rawByMember.set(m.id, { count: 0, weightedScore: 0 });
  }
  for (const c of weekCheckIns) {
    const entry = rawByMember.get(c.memberId);
    if (!entry) continue;
    entry.count += 1;
    entry.weightedScore += c.weightAtLog;
  }

  const totalWeighted = Array.from(rawByMember.values()).reduce(
    (sum, v) => sum + v.weightedScore,
    0
  );

  const stats: MemberWeekStat[] = state.members.map((m) => {
    const entry = rawByMember.get(m.id)!;
    const sharePct =
      totalWeighted === 0
        ? 0
        : Math.round((entry.weightedScore / totalWeighted) * 1000) / 10;
    return {
      memberId: m.id,
      memberName: m.name,
      count: entry.count,
      weightedScore: entry.weightedScore,
      sharePct,
    };
  });
  stats.sort((a, b) => b.weightedScore - a.weightedScore);

  let fairnessScore: number;
  if (state.members.length < 2) {
    fairnessScore = 100;
  } else if (totalWeighted === 0) {
    fairnessScore = 0;
  } else {
    const sharePcts = stats.map((s) => s.sharePct);
    const maxSharePct = Math.max(...sharePcts);
    const minSharePct = Math.min(...sharePcts);
    fairnessScore = Math.max(0, Math.round(100 - (maxSharePct - minSharePct)));
  }

  const dailyTrend = dates.map(
    (date) => weekCheckIns.filter((c) => c.date === date).length
  );

  const choreCounts = new Map<string, number>();
  for (const c of weekCheckIns) {
    choreCounts.set(c.choreId, (choreCounts.get(c.choreId) ?? 0) + 1);
  }
  const choreNameById = new Map(state.chores.map((c) => [c.id, c.name]));
  const topChores = Array.from(choreCounts.entries())
    .map(([choreId, count]) => ({
      choreId,
      choreName: choreNameById.get(choreId) ?? "",
      count,
    }))
    .sort((a, b) => b.count - a.count || a.choreName.localeCompare(b.choreName))
    .slice(0, 3);

  const missedItems = state.chores
    .filter((chore) => chore.active)
    .map((chore) => {
      const checkedDates = new Set(
        weekCheckIns.filter((c) => c.choreId === chore.id).map((c) => c.date)
      );
      const missedCount =
        chore.frequency === "daily"
          ? dates.filter((d) => !checkedDates.has(d)).length
          : checkedDates.size === 0
            ? 1
            : 0;
      return {
        choreId: chore.id,
        choreName: chore.name,
        missedCount,
        penalty: missedCount * chore.penaltyAmount,
      };
    });

  return {
    weekStart: normalizedStart,
    weekEnd,
    stats,
    fairnessScore,
    totalWeighted,
    topChores,
    dailyTrend,
    missedItems,
  };
}

const roundTo100 = (n: number) => Math.round(n / 100) * 100;

/**
 * 정산 계산 — 미이행 벌금 총액(report.missedItems 합)을 기여도 역순으로 배분한다.
 * burden_i(부담액) = totalPenalty × (1 − sharePct_i/100) / (N−1): 기여도가 낮을수록 더 많이 부담.
 * receive_i(보상) = totalPenalty × sharePct_i/100: 기여도가 높을수록 더 많이 보상받는다.
 * net_i = receive_i − burden_i 를 채무자(net<0)→채권자(net>0) greedy 매칭해 송금 라인을 만든다.
 */
export function computeSettlement(
  report: WeeklyReport,
  members: Member[]
): {
  totalPenalty: number;
  burdens: Array<{ memberId: string; amount: number }>;
  lines: SettlementRecord["lines"];
} {
  const totalPenalty = report.missedItems.reduce((sum, item) => sum + item.penalty, 0);
  const n = members.length;

  if (n < 2 || totalPenalty <= 0) {
    return { totalPenalty, burdens: [], lines: [] };
  }

  const statByMember = new Map(report.stats.map((s) => [s.memberId, s.sharePct]));
  const totalWeighted = report.totalWeighted;
  const sharePctOf = (memberId: string) =>
    totalWeighted === 0 ? 100 / n : (statByMember.get(memberId) ?? 0);

  const burdens = members.map((m) => {
    const sharePct = sharePctOf(m.id);
    const raw = (totalPenalty * (1 - sharePct / 100)) / (n - 1);
    return { memberId: m.id, amount: roundTo100(raw) };
  });
  const burdenByMember = new Map(burdens.map((b) => [b.memberId, b.amount]));

  const nets = members.map((m) => {
    const sharePct = sharePctOf(m.id);
    const receive = roundTo100(totalPenalty * (sharePct / 100));
    const burden = burdenByMember.get(m.id)!;
    return { memberId: m.id, net: receive - burden };
  });

  const creditors = nets
    .filter((x) => x.net > 0)
    .map((x) => ({ ...x }))
    .sort((a, b) => b.net - a.net);
  const debtors = nets
    .filter((x) => x.net < 0)
    .map((x) => ({ memberId: x.memberId, net: -x.net }))
    .sort((a, b) => b.net - a.net);

  const lines: SettlementRecord["lines"] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.net, d.net);
    if (amount > 0) {
      lines.push({ fromMemberId: d.memberId, toMemberId: c.memberId, amount });
    }
    c.net -= amount;
    d.net -= amount;
    if (c.net <= 0) ci += 1;
    if (d.net <= 0) di += 1;
  }

  return { totalPenalty, burdens, lines };
}

/** buildWeeklyReport + computeSettlement 조합 — 화면에서 state와 weekStart만으로 정산을 얻는다 */
export function buildSettlement(
  state: ChoreSplitState,
  weekStart: string
): {
  totalPenalty: number;
  burdens: Array<{ memberId: string; amount: number }>;
  lines: SettlementRecord["lines"];
} {
  const report = buildWeeklyReport(state, weekStart);
  return computeSettlement(report, state.members);
}
