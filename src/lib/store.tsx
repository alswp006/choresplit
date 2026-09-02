/**
 * App-wide state container (Packet 0006)
 *
 * AppStateProvider loads ChoreSplitState once on mount and exposes it through
 * useAppState(). Every mutation follows the same shape: call the matching
 * household.ts helper on a clone of the current state (optimistic update),
 * then saveState() it. If saveState fails, the optimistic update is rolled
 * back to the exact previous state and the error is surfaced via `error`.
 *
 * State-only module: no TDS imports, no JSX beyond the Provider wrapper.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Chore,
  ChoreId,
  ChoreSplitState,
  MemberId,
  Settings,
  SettlementRecord,
} from "./types";
import { DEFAULT_STATE, loadState, loadUnlocked, pruneOlderThan, saveState, unlockWeek } from "./storage";
import {
  addChore as addChoreImpl,
  addMember as addMemberImpl,
  createHousehold as createHouseholdImpl,
  removeMember as removeMemberImpl,
  toggleChoreActive as toggleChoreActiveImpl,
  toggleCheckIn as toggleCheckInImpl,
  updateChore as updateChoreImpl,
  validateOnboarding,
  type AddChoreInput,
} from "./household";

export type ActionResult = { ok: boolean; error?: string };

export type ChorePatch = Partial<Pick<Chore, "name" | "weight" | "frequency" | "penaltyAmount">>;

export interface AppStateValue {
  state: ChoreSplitState;
  ready: boolean;
  error: string | null;
  unlocked: Record<string, true>;
  createHousehold: (name: string, myName: string) => ActionResult;
  addChore: (input: AddChoreInput) => ActionResult;
  updateChore: (choreId: ChoreId, patch: ChorePatch) => ActionResult;
  toggleChoreActive: (choreId: ChoreId) => ActionResult;
  addMember: (name: string) => ActionResult;
  removeMember: (memberId: MemberId) => ActionResult;
  toggleCheckIn: (date: string, choreId: ChoreId, memberId: MemberId) => ActionResult;
  updateSettings: (patch: Partial<Settings>) => ActionResult;
  addSettlement: (record: SettlementRecord) => ActionResult;
  pruneCheckIns: (days: number) => ActionResult;
  unlock: (weekStart: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function cloneState(state: ChoreSplitState): ChoreSplitState {
  return JSON.parse(JSON.stringify(state)) as ChoreSplitState;
}

function addSettlementToState(state: ChoreSplitState, record: SettlementRecord): ActionResult {
  if (!record.weekStart) {
    return { ok: false, error: "정산 정보가 올바르지 않아요" };
  }
  const idx = state.settlements.findIndex((s) => s.weekStart === record.weekStart);
  if (idx >= 0) {
    state.settlements[idx] = record;
  } else {
    state.settlements.push(record);
  }
  return { ok: true };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChoreSplitState>(() => cloneState(DEFAULT_STATE));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Record<string, true>>({});
  const stateRef = useRef<ChoreSplitState>(state);

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded;
    setState(loaded);
    setUnlocked(loadUnlocked());
    setReady(true);
  }, []);

  const commit = useCallback((nextState: ChoreSplitState): ActionResult => {
    const prev = stateRef.current;
    stateRef.current = nextState;
    setState(nextState);

    const saveResult = saveState(nextState);
    if (!saveResult.ok) {
      stateRef.current = prev;
      setState(prev);
      setError(saveResult.error);
      return { ok: false, error: saveResult.error };
    }

    setError(null);
    return { ok: true };
  }, []);

  const mutate = useCallback(
    (fn: (draft: ChoreSplitState) => ActionResult): ActionResult => {
      const draft = cloneState(stateRef.current);
      const result = fn(draft);
      if (!result.ok) {
        return result;
      }
      return commit(draft);
    },
    [commit],
  );

  const createHouseholdAction = useCallback(
    (name: string, myName: string): ActionResult => {
      const validation = validateOnboarding(name, myName);
      if (!validation.ok) {
        return { ok: false, error: validation.error ?? "입력값을 확인해주세요" };
      }
      const nextState = createHouseholdImpl(name, myName);
      return commit(nextState);
    },
    [commit],
  );

  const addChoreAction = useCallback(
    (input: AddChoreInput): ActionResult => mutate((draft) => addChoreImpl(draft, input)),
    [mutate],
  );

  const updateChoreAction = useCallback(
    (choreId: ChoreId, patch: ChorePatch): ActionResult =>
      mutate((draft) => updateChoreImpl(draft, choreId, patch)),
    [mutate],
  );

  const toggleChoreActiveAction = useCallback(
    (choreId: ChoreId): ActionResult => mutate((draft) => toggleChoreActiveImpl(draft, choreId)),
    [mutate],
  );

  const addMemberAction = useCallback(
    (name: string): ActionResult => mutate((draft) => addMemberImpl(draft, name)),
    [mutate],
  );

  const removeMemberAction = useCallback(
    (memberId: MemberId): ActionResult => mutate((draft) => removeMemberImpl(draft, memberId)),
    [mutate],
  );

  const toggleCheckInAction = useCallback(
    (date: string, choreId: ChoreId, memberId: MemberId): ActionResult =>
      mutate((draft) => toggleCheckInImpl(draft, date, choreId, memberId)),
    [mutate],
  );

  const updateSettingsAction = useCallback(
    (patch: Partial<Settings>): ActionResult =>
      mutate((draft) => {
        draft.settings = { ...draft.settings, ...patch };
        return { ok: true };
      }),
    [mutate],
  );

  const addSettlementAction = useCallback(
    (record: SettlementRecord): ActionResult =>
      mutate((draft) => addSettlementToState(draft, record)),
    [mutate],
  );

  const pruneCheckInsAction = useCallback(
    (days: number): ActionResult =>
      mutate((draft) => {
        draft.checkIns = pruneOlderThan(draft, days).checkIns;
        return { ok: true };
      }),
    [mutate],
  );

  const unlockAction = useCallback((weekStart: string) => {
    unlockWeek(weekStart);
    setUnlocked((prev) => ({ ...prev, [weekStart]: true }));
  }, []);

  const value: AppStateValue = {
    state,
    ready,
    error,
    unlocked,
    createHousehold: createHouseholdAction,
    addChore: addChoreAction,
    updateChore: updateChoreAction,
    toggleChoreActive: toggleChoreActiveAction,
    addMember: addMemberAction,
    removeMember: removeMemberAction,
    toggleCheckIn: toggleCheckInAction,
    updateSettings: updateSettingsAction,
    addSettlement: addSettlementAction,
    pruneCheckIns: pruneCheckInsAction,
    unlock: unlockAction,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
