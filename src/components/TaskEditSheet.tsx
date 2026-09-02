import { useEffect, useState } from "react";
import { BottomSheet, TextField, Chip, ChipItem, Paragraph, Spacing, Button } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { ChoreTask, Difficulty, Weekday } from "@/lib/types";
import { MAX_FINE } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const EMOJI_OPTIONS = ["🧹", "🍽️", "🧺", "🗑️", "🛁", "🪣"];
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 1, label: "쉬움" },
  { value: 2, label: "보통" },
  { value: 3, label: "어려움" },
];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export function TaskEditSheet({
  open,
  taskId,
  onClose,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}) {
  const { household, tasks, settings, saveTask } = useAppStore();
  const editingTask = taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null;
  const members = household?.members ?? [];

  const [name, setName] = useState(editingTask?.name ?? "");
  const [emoji, setEmoji] = useState(editingTask?.emoji ?? EMOJI_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(editingTask?.difficulty ?? 2);
  const [repeatDays, setRepeatDays] = useState<Weekday[]>(editingTask?.repeatDays ?? []);
  const [assigneeId, setAssigneeId] = useState<string | null>(
    editingTask?.assigneeId ?? settings.activeMemberId ?? null,
  );
  const [fineAmountText, setFineAmountText] = useState(editingTask ? String(editingTask.fineAmount) : "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [fineError, setFineError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editingTask?.name ?? "");
    setEmoji(editingTask?.emoji ?? EMOJI_OPTIONS[0]);
    setDifficulty(editingTask?.difficulty ?? 2);
    setRepeatDays(editingTask?.repeatDays ?? []);
    setAssigneeId(editingTask?.assigneeId ?? settings.activeMemberId ?? null);
    setFineAmountText(editingTask ? String(editingTask.fineAmount) : "");
    setNameError(null);
    setFineError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  function toggleDay(day: Weekday) {
    fireHaptic("tickWeak");
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError("이름을 입력해주세요");
      return;
    }
    // 정확히 16자인 이름도 거부한다 — 실 최대 허용 길이는 15자(help 문구 "16자까지"는 상한 안내용)
    if (trimmed.length > 15) {
      setNameError("16자까지 입력할 수 있어요");
      return;
    }
    setNameError(null);

    const fineAmount = Number(fineAmountText || 0);
    if (fineAmount > MAX_FINE) {
      setFineError("벌금은 10,000원까지 입력할 수 있어요");
      return;
    }
    if (fineAmount % 100 !== 0) {
      setFineError("벌금은 100원 단위로 입력해주세요");
      return;
    }
    setFineError(null);

    const task: ChoreTask = {
      id: editingTask?.id ?? `tk_${Date.now()}`,
      name: trimmed,
      emoji,
      difficulty,
      repeatDays,
      assigneeId,
      fineAmount,
      archived: editingTask?.archived ?? false,
      updatedAt: Date.now(),
    };

    saveTask(task);
    fireHaptic("success");
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div
        style={{
          maxHeight: "70vh",
          overflowY: "auto",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        }}
      >
        <Paragraph.Text typography="t4">{editingTask ? "집안일 수정" : "집안일 추가"}</Paragraph.Text>
        <Spacing size={16} />

        <Chip>
          {EMOJI_OPTIONS.map((e) => (
            <ChipItem
              key={e}
              selected={emoji === e}
              onClick={() => {
                fireHaptic("tickWeak");
                setEmoji(e);
              }}
            >
              {e}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={8} />
        <TextField
          variant="box"
          label="이름"
          placeholder="예: 설거지"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hasError={!!nameError}
          help={nameError ?? undefined}
          maxLength={16}
        />
        <Spacing size={20} />

        <Paragraph.Text typography="st3">난이도</Paragraph.Text>
        <Spacing size={8} />
        <Chip>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <ChipItem
              key={opt.value}
              selected={difficulty === opt.value}
              onClick={() => {
                fireHaptic("tickWeak");
                setDifficulty(opt.value);
              }}
            >
              {opt.label}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={20} />

        <Paragraph.Text typography="st3">반복 요일</Paragraph.Text>
        <Spacing size={8} />
        <Chip>
          {WEEKDAY_LABELS.map((label, index) => (
            <ChipItem key={label} selected={repeatDays.includes(index as Weekday)} onClick={() => toggleDay(index as Weekday)}>
              {label}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={20} />

        <Paragraph.Text typography="st3">담당자</Paragraph.Text>
        <Spacing size={8} />
        <Chip>
          {members.map((member) => (
            <ChipItem
              key={member.id}
              selected={assigneeId === member.id}
              onClick={() => {
                fireHaptic("tickWeak");
                setAssigneeId(member.id);
              }}
            >
              {member.name}
            </ChipItem>
          ))}
          <ChipItem
            selected={assigneeId === null}
            onClick={() => {
              fireHaptic("tickWeak");
              setAssigneeId(null);
            }}
          >
            공동
          </ChipItem>
        </Chip>
        <Spacing size={20} />

        <TextField
          variant="box"
          label="미이행 벌금"
          placeholder="예: 500"
          inputMode="numeric"
          suffix="원"
          value={fineAmountText}
          onChange={(e) => setFineAmountText(e.target.value.replace(/[^0-9]/g, ""))}
          hasError={!!fineError}
          help={fineError ?? undefined}
        />
        <Spacing size={24} />

        <Button variant="fill" size="large" display="block" onClick={handleSubmit}>
          {editingTask ? "수정하기" : "추가하기"}
        </Button>
      </div>
    </BottomSheet>
  );
}
