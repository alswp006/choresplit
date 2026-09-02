import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Top,
  Spacing,
  Paragraph,
  ListRow,
  Button,
  BottomSheet,
  TextField,
  AlertDialog,
  Toast,
  Asset,
} from "@toss/tds-mobile";
import { generateHapticFeedback, setClipboardText } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { EmptyState, LoadingState } from "@/components/StateView";
import { SubmitFooter } from "@/components/BottomCTA";
import { useAppState } from "@/lib/store";
import { countMemberCheckIns } from "@/lib/household";
import { buildWeeklyReport } from "@/lib/report";
import { todayKST } from "@/lib/storage";
import type { ColorToken, Member } from "@/lib/types";

const COLOR_VARS: Record<ColorToken, string> = {
  blue: "var(--adaptiveBlue500)",
  green: "var(--adaptiveGreen500)",
  orange: "var(--adaptiveOrange500)",
  purple: "var(--adaptivePurple500)",
};

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

function safeCopy(text: string) {
  try {
    Promise.resolve(setClipboardText(text)).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

export default function Members() {
  const navigate = useNavigate();
  const { ready, state, addMember, removeMember } = useAppState();

  useEffect(() => {
    if (ready && !state.household) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, state.household, navigate]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [target, setTarget] = useState<Member | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  function openToast(text: string) {
    setToastText(text);
    setToastOpen(true);
  }

  function openSheet() {
    setName("");
    setNameError(null);
    setSheetOpen(true);
  }

  function handleAdd() {
    setNameError(null);
    const result = addMember(name);
    if (!result.ok) {
      setNameError(result.error ?? "추가에 실패했어요");
      return;
    }
    safeHaptic("success");
    setSheetOpen(false);
    setName("");
    openToast(`${name.trim()}님을 추가했어요`);
  }

  function copyCode() {
    const code = state.household?.inviteCode;
    if (!code) return;
    safeCopy(code);
    safeHaptic("success");
    openToast("초대 코드를 복사했어요");
  }

  function askRemove(member: Member) {
    setTarget(member);
  }

  function confirmRemove() {
    if (!target) return;
    const removedName = target.name;
    const result = removeMember(target.id);
    setTarget(null);
    if (!result.ok) {
      openToast(result.error ?? "삭제에 실패했어요");
      return;
    }
    openToast(`${removedName}님을 삭제했어요`);
  }

  if (!ready || !state.household) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>동거인</Top.TitleParagraph>} />}>
        <LoadingState rows={3} testId="members-loading" />
      </ScreenScaffold>
    );
  }

  const { household, members } = state;
  const weekStart = todayKST();
  const report = buildWeeklyReport(state, weekStart);

  function weekCount(memberId: string): number {
    return report.stats.find((s) => s.memberId === memberId)?.count ?? 0;
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>동거인</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="동거인 추가" onClick={openSheet} />}
    >
      <Card>
        <Paragraph.Text typography="st11" color="var(--adaptiveGrey700)">
          우리집 초대 코드
        </Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="t3">{household.inviteCode}</Paragraph.Text>
        <Spacing size={12} />
        <Button variant="weak" size="medium" display="block" onClick={copyCode}>
          코드 복사
        </Button>
      </Card>

      <Spacing size={24} />

      {members.map((m) => (
        <ListRow
          key={m.id}
          left={
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLOR_VARS[m.colorToken],
              }}
            >
              <Paragraph.Text typography="st13" color="var(--adaptiveGrey50)">
                {m.name.slice(0, 1)}
              </Paragraph.Text>
            </div>
          }
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={m.isMe ? `${m.name} (나)` : m.name}
              bottom={`이번 주 ${weekCount(m.id)}건`}
            />
          }
          right={
            <Button variant="weak" size="small" disabled={m.isMe} onClick={() => askRemove(m)}>
              삭제
            </Button>
          }
        />
      ))}

      {members.length === 1 && (
        <>
          <Spacing size={24} />
          <EmptyState
            icon={<Asset.ContentIcon name="iconUserRegular" alt="동거인 없음" />}
            title="아직 나뿐이에요"
            description="초대 코드를 공유해 동거인을 추가해보세요"
          />
        </>
      )}

      <Spacing size={80} />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} header="동거인 추가">
        <TextField
          variant="box"
          label="이름"
          placeholder="예: 지민"
          value={name}
          onChange={(e) => setName(e.target.value)}
          enterKeyHint="done"
          hasError={!!nameError}
          help={nameError}
        />
        <Spacing size={24} />
        <Button variant="fill" size="large" display="block" onClick={handleAdd}>
          추가하기
        </Button>
        <Spacing size={24} />
      </BottomSheet>

      <AlertDialog
        open={!!target}
        title="동거인을 삭제할까요?"
        description={target ? `기록 ${countMemberCheckIns(state, target.id)}건이 함께 지워져요` : ""}
        alertButton={<AlertDialog.AlertButton onClick={confirmRemove}>삭제</AlertDialog.AlertButton>}
        onClose={() => setTarget(null)}
      />

      <Toast open={toastOpen} text={toastText} position="bottom" onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
