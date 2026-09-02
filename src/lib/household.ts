/**
 * Household entity helpers (Packet 0003)
 *
 * createHousehold seeds a new household with 1 member (본인) + 6 default chores.
 * The rest of the functions mutate the passed-in ChoreSplitState in place and
 * return { ok: true } | { ok: false; error } so callers can surface validation
 * errors without re-deriving state — screens are expected to persist the same
 * `state` object back via saveState after a successful mutation.
 */

import type {
  ChoreSplitState,
  Household,
  Member,
  Chore,
  ChoreId,
  MemberId,
  CheckInId,
  ColorToken,
} from "./types";
import { newId, generateInviteCode, todayKST } from "./storage";

type Result = { ok: boolean; error?: string };

const COLOR_TOKENS: ColorToken[] = ["blue", "green", "orange", "purple"];

const MAX_MEMBERS = 4;
const MAX_CHORES = 20;
const MAX_PENALTY = 5000;

const SEED_CHORES: Array<{
  name: string;
  weight: 1 | 2 | 3;
  frequency: "daily" | "weekly";
  penaltyAmount: number;
}> = [
  { name: "설거지", weight: 2, frequency: "daily", penaltyAmount: 500 },
  { name: "청소", weight: 3, frequency: "daily", penaltyAmount: 500 },
  { name: "빨래", weight: 2, frequency: "weekly", penaltyAmount: 1000 },
  { name: "분리수거", weight: 1, frequency: "weekly", penaltyAmount: 500 },
  { name: "요리", weight: 3, frequency: "daily", penaltyAmount: 1000 },
  { name: "화장실청소", weight: 3, frequency: "weekly", penaltyAmount: 1000 },
];

/** 기본 집안일 6종 시드 (설거지/청소/빨래/분리수거/요리/화장실청소, 고정 순서) */
export function seedDefaultChores(): Chore[] {
  const now = new Date().toISOString();
  return SEED_CHORES.map((seed) => ({
    id: newId("c_"),
    name: seed.name,
    weight: seed.weight,
    frequency: seed.frequency,
    penaltyAmount: seed.penaltyAmount,
    active: true,
    createdAt: now,
  }));
}

/** 새 가구 생성 + 본인 멤버 + 집안일 6종 시드 */
export function createHousehold(
  name: string,
  myName: string
): ChoreSplitState & { household: Household } {
  const now = new Date().toISOString();

  const household: Household = {
    id: newId("h_"),
    name: name.trim(),
    inviteCode: generateInviteCode(),
    createdAt: now,
  };

  const me: Member = {
    id: newId("m_"),
    name: myName.trim(),
    colorToken: COLOR_TOKENS[0],
    isMe: true,
    createdAt: now,
  };

  const chores: Chore[] = seedDefaultChores();

  return {
    version: 1,
    household,
    members: [me],
    chores,
    checkIns: [],
    settings: {
      reminderEnabled: true,
      reminderHour: 21,
      penaltyEnabled: true,
      lastReminderShownDate: null,
    },
    settlements: [],
  };
}

/** 온보딩 입력값 검증 (가구 이름, 닉네임) */
export function validateOnboarding(
  householdName: string,
  memberName: string
): { ok: boolean; field?: "name" | "household"; error?: string } {
  if (householdName.trim() === "") {
    return { ok: false, field: "household", error: "가구 이름을 입력해주세요" };
  }
  if (memberName.trim() === "") {
    return { ok: false, field: "name", error: "닉네임을 입력해주세요" };
  }
  return { ok: true };
}

export interface AddChoreInput {
  name: string;
  weight: 1 | 2 | 3;
  frequency: "daily" | "weekly";
  penaltyAmount: number;
}

function validatePenalty(penaltyAmount: number): string | null {
  if (penaltyAmount < 0 || penaltyAmount > MAX_PENALTY) {
    return "벌금은 0원~5,000원 사이여야 해요";
  }
  if (penaltyAmount % 100 !== 0) {
    return "벌금은 100원 단위로 입력해주세요";
  }
  return null;
}

/** 집안일 항목 추가 (이름 중복·20개 상한·벌금 범위/단위 검증) */
export function addChore(state: ChoreSplitState, input: AddChoreInput): Result {
  const normalized = input.name.trim();

  if (state.chores.length >= MAX_CHORES) {
    return { ok: false, error: "집안일은 최대 20개까지 등록할 수 있어요" };
  }

  const isDuplicate = state.chores.some(
    (chore) => chore.name.trim().toLowerCase() === normalized.toLowerCase()
  );
  if (isDuplicate) {
    return { ok: false, error: "이미 있는 항목이에요" };
  }

  const penaltyError = validatePenalty(input.penaltyAmount);
  if (penaltyError) {
    return { ok: false, error: penaltyError };
  }

  state.chores.push({
    id: newId("c_"),
    name: normalized,
    weight: input.weight,
    frequency: input.frequency,
    penaltyAmount: input.penaltyAmount,
    active: true,
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}

/** 집안일 항목 수정 (이름/벌금 변경 시 동일 검증 재적용) */
export function updateChore(
  state: ChoreSplitState,
  choreId: ChoreId,
  patch: Partial<Pick<Chore, "name" | "weight" | "frequency" | "penaltyAmount">>
): Result {
  const chore = state.chores.find((c) => c.id === choreId);
  if (!chore) {
    return { ok: false, error: "항목을 찾을 수 없어요" };
  }

  if (patch.name !== undefined) {
    const normalized = patch.name.trim();
    const isDuplicate = state.chores.some(
      (c) => c.id !== choreId && c.name.trim().toLowerCase() === normalized.toLowerCase()
    );
    if (isDuplicate) {
      return { ok: false, error: "이미 있는 항목이에요" };
    }
    chore.name = normalized;
  }

  if (patch.penaltyAmount !== undefined) {
    const penaltyError = validatePenalty(patch.penaltyAmount);
    if (penaltyError) {
      return { ok: false, error: penaltyError };
    }
    chore.penaltyAmount = patch.penaltyAmount;
  }

  if (patch.weight !== undefined) {
    chore.weight = patch.weight;
  }
  if (patch.frequency !== undefined) {
    chore.frequency = patch.frequency;
  }

  return { ok: true };
}

/** 집안일 활성/비활성 토글 (비활성이면 체크인 목록에서 제외) */
export function toggleChoreActive(state: ChoreSplitState, choreId: ChoreId): Result {
  const chore = state.chores.find((c) => c.id === choreId);
  if (!chore) {
    return { ok: false, error: "항목을 찾을 수 없어요" };
  }
  chore.active = !chore.active;
  return { ok: true };
}

/** 동거인 추가 (최대 4명, 이름 중복 금지, 미사용 색상 토큰 우선 배정) */
export function addMember(state: ChoreSplitState, name: string): Result {
  if (state.members.length >= MAX_MEMBERS) {
    return { ok: false, error: "동거인은 최대 4명까지 등록할 수 있어요" };
  }

  const normalized = name.trim();
  const isDuplicate = state.members.some(
    (m) => m.name.trim().toLowerCase() === normalized.toLowerCase()
  );
  if (isDuplicate) {
    return { ok: false, error: "같은 이름이 이미 있어요" };
  }

  const usedColors = new Set(state.members.map((m) => m.colorToken));
  const colorToken = COLOR_TOKENS.find((c) => !usedColors.has(c)) ?? COLOR_TOKENS[0];

  state.members.push({
    id: newId("m_"),
    name: normalized,
    colorToken,
    isMe: false,
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}

/** 동거인 삭제 (본인 삭제 금지, 삭제 시 해당 멤버의 checkIns 동반 삭제) */
export function removeMember(state: ChoreSplitState, memberId: MemberId): Result {
  const idx = state.members.findIndex((m) => m.id === memberId);
  if (idx === -1) {
    return { ok: false, error: "동거인을 찾을 수 없어요" };
  }
  if (state.members[idx].isMe) {
    return { ok: false, error: "본인은 삭제할 수 없어요" };
  }

  state.members.splice(idx, 1);
  for (let i = state.checkIns.length - 1; i >= 0; i--) {
    if (state.checkIns[i].memberId === memberId) {
      state.checkIns.splice(i, 1);
    }
  }

  return { ok: true };
}

/** 특정 멤버의 전체 체크인 건수 */
export function countMemberCheckIns(state: ChoreSplitState, memberId: MemberId): number {
  return state.checkIns.filter((c) => c.memberId === memberId).length;
}

/** 체크인 토글 (id 규칙 기반) — 존재하면 삭제, 없으면 생성. 미래 날짜는 무시 */
export function toggleCheckIn(
  state: ChoreSplitState,
  date: string,
  choreId: ChoreId,
  memberId: MemberId
): Result {
  if (date > todayKST()) {
    return { ok: false, error: "미래 날짜는 기록할 수 없어요" };
  }

  const id = `${date}__${choreId}__${memberId}` as CheckInId;
  const idx = state.checkIns.findIndex((c) => c.id === id);

  if (idx >= 0) {
    state.checkIns.splice(idx, 1);
    return { ok: true };
  }

  const chore = state.chores.find((c) => c.id === choreId);
  const weightAtLog: 1 | 2 | 3 = chore ? chore.weight : 1;

  state.checkIns.push({
    id,
    date,
    choreId,
    memberId,
    weightAtLog,
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}
