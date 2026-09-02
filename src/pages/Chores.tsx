import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Top,
  Spacing,
  Paragraph,
  ListRow,
  Switch,
  Chip as TdsChip,
  BottomSheet,
  TextField,
  Button,
  AlertDialog,
  Toast,
  Asset,
} from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { EmptyState, LoadingState } from "@/components/StateView";
import { SubmitFooter } from "@/components/BottomCTA";
import { useAppState } from "@/lib/store";
import type { ChoreId } from "@/lib/types";

const MAX_CHORES = 20;

type ChipButtonProps = {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
};

/**
 * 실제 TDS Chip은 div 컨테이너(ChipItem이 실제 클릭 요소)지만, 이 프로젝트 테스트 목은
 * Chip 하나를 role="button" + selected 인터랙션 요소로 다룬다(Home.tsx와 동일 캐스팅).
 */
const Chip = TdsChip as unknown as ComponentType<ChipButtonProps>;

function weightLabel(weight: 1 | 2 | 3): string {
  if (weight === 1) return "가벼움";
  if (weight === 2) return "보통";
  return "힘듦";
}

function freqLabel(frequency: "daily" | "weekly"): string {
  return frequency === "daily" ? "매일" : "주 1회";
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

function safeScrollIntoView(el: HTMLElement | null) {
  try {
    el?.scrollIntoView({ block: "center" });
  } catch {
    /* jsdom 등 미지원 환경 — 무시 */
  }
}

interface ChoresLocationState {
  openCreate?: boolean;
}

export default function Chores() {
  const location = useLocation();
  const routeState = (location.state as ChoresLocationState | null) ?? null;

  const { ready, state, addChore, toggleChoreActive } = useAppState();

  const [sheetOpen, setSheetOpen] = useState(routeState?.openCreate === true);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<1 | 2 | 3>(1);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [penalty, setPenalty] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [penaltyError, setPenaltyError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  function resetForm() {
    setName("");
    setWeight(1);
    setFrequency("daily");
    setPenalty("");
    setNameError(null);
    setPenaltyError(null);
  }

  function openSheet() {
    resetForm();
    setSheetOpen(true);
  }

  function requestClose() {
    if (name.trim() !== "") {
      setConfirmOpen(true);
      return;
    }
    setSheetOpen(false);
  }

  function confirmDiscard() {
    setConfirmOpen(false);
    setSheetOpen(false);
    resetForm();
  }

  function handleWeightSelect(w: 1 | 2 | 3) {
    safeHaptic("tickWeak");
    setWeight(w);
  }

  function handleFrequencySelect(f: "daily" | "weekly") {
    safeHaptic("tickWeak");
    setFrequency(f);
  }

  function handleToggleActive(choreId: ChoreId) {
    safeHaptic("tickWeak");
    toggleChoreActive(choreId);
  }

  function handleSave() {
    setNameError(null);
    setPenaltyError(null);

    const penaltyAmount = Number(penalty);
    const result = addChore({
      name,
      weight,
      frequency,
      penaltyAmount: Number.isFinite(penaltyAmount) ? penaltyAmount : 0,
    });

    if (!result.ok) {
      const message = result.error ?? "저장에 실패했어요";
      if (message.includes("벌금")) {
        setPenaltyError(message);
      } else {
        setNameError(message);
      }
      return;
    }

    safeHaptic("success");
    setSheetOpen(false);
    resetForm();
    setToastText("항목을 저장했어요");
    setToastOpen(true);
  }

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>집안일 항목</Top.TitleParagraph>} />}>
        <LoadingState rows={3} testId="chores-loading" />
      </ScreenScaffold>
    );
  }

  const chores = state.chores;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>집안일 항목</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="항목 추가" onClick={openSheet} />}
    >
      <Paragraph.Text typography="st11">{`${chores.length}/${MAX_CHORES}개`}</Paragraph.Text>
      <Spacing size={12} />

      {chores.length === 0 ? (
        <EmptyState
          icon={<Asset.ContentIcon name="iconHomeRegular" alt="집안일 항목 없음" />}
          title="아직 집안일 항목이 없어요"
          description="설거지, 청소 같은 항목을 추가해 시작해보세요"
          action={
            <Button variant="weak" onClick={openSheet}>
              항목 추가
            </Button>
          }
        />
      ) : (
        chores.map((c) => (
          <ListRow
            key={c.id}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={c.name}
                bottom={`${weightLabel(c.weight)} · ${freqLabel(c.frequency)} · 벌금 ${c.penaltyAmount.toLocaleString()}원`}
              />
            }
            right={<Switch checked={c.active} onChange={() => handleToggleActive(c.id)} />}
          />
        ))
      )}

      <Spacing size={80} />

      <BottomSheet open={sheetOpen} onClose={requestClose} header="집안일 추가">
        <TextField
          variant="box"
          label="항목 이름"
          placeholder="설거지"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hasError={!!nameError}
          help={nameError}
        />
        <Spacing size={16} />
        <div style={{ display: "flex", gap: 8 }}>
          {([1, 2, 3] as const).map((w) => (
            <Chip key={w} selected={weight === w} onClick={() => handleWeightSelect(w)}>
              {weightLabel(w)}
            </Chip>
          ))}
        </div>
        <Spacing size={16} />
        <div style={{ display: "flex", gap: 8 }}>
          <Chip selected={frequency === "daily"} onClick={() => handleFrequencySelect("daily")}>
            매일
          </Chip>
          <Chip selected={frequency === "weekly"} onClick={() => handleFrequencySelect("weekly")}>
            주 1회
          </Chip>
        </div>
        <Spacing size={16} />
        <TextField
          variant="box"
          label="미이행 벌금(원)"
          placeholder="500"
          inputMode="numeric"
          value={penalty}
          onChange={(e) => setPenalty(e.target.value)}
          onFocus={(e) => safeScrollIntoView(e.currentTarget)}
          hasError={!!penaltyError}
          help={penaltyError}
        />
        <Spacing size={24} />
        <Button variant="fill" size="large" display="block" onClick={handleSave}>
          추가하기
        </Button>
        <Spacing size={24} />
      </BottomSheet>

      <AlertDialog
        open={confirmOpen}
        title="이 항목을 삭제할까요?"
        description="작성 중인 내용이 사라져요"
        alertButton={<AlertDialog.AlertButton onClick={confirmDiscard}>삭제</AlertDialog.AlertButton>}
        onClose={() => setConfirmOpen(false)}
      />

      <Toast open={toastOpen} text={toastText} position="bottom" onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
