import { useState } from "react";
import { Top, Paragraph, Spacing, ListRow, Switch, BottomSheet, AlertDialog, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { LoadingState } from "@/components/StateView";
import { FloatingTabBar, type TabItem } from "@/components/FloatingTabBar";
import { useAppState } from "@/lib/store";

const TAB_ITEMS: TabItem[] = [
  { label: "홈", path: "/" },
  { label: "리포트", path: "/report" },
  { label: "스트릭", path: "/streak" },
  { label: "설정", path: "/settings" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const PRUNE_DAYS = 30;
const APP_VERSION = "1.0.0";

function formatHour(h: number): string {
  const period = h < 12 ? "오전" : "오후";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${display}시`;
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

export default function Settings() {
  const { ready, state, error, updateSettings, pruneCheckIns } = useAppState();

  const [hourSheetOpen, setHourSheetOpen] = useState(false);
  const [pruneOpen, setPruneOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />}>
        <LoadingState rows={4} testId="settings-loading" />
      </ScreenScaffold>
    );
  }

  const settings = state.settings;

  function toggleReminder() {
    safeHaptic("tickWeak");
    const result = updateSettings({ reminderEnabled: !settings.reminderEnabled });
    if (!result.ok) {
      setToastText(result.error ?? "저장에 실패했어요");
      setToastOpen(true);
    }
  }

  function togglePenalty() {
    safeHaptic("tickWeak");
    const result = updateSettings({ penaltyEnabled: !settings.penaltyEnabled });
    if (!result.ok) {
      setToastText(result.error ?? "저장에 실패했어요");
      setToastOpen(true);
    }
  }

  function pickHour(h: number) {
    safeHaptic("tickWeak");
    const result = updateSettings({ reminderHour: h });
    setHourSheetOpen(false);
    if (!result.ok) {
      setToastText(result.error ?? "저장에 실패했어요");
      setToastOpen(true);
    }
  }

  function handlePrune() {
    const result = pruneCheckIns(PRUNE_DAYS);
    setPruneOpen(false);
    if (!result.ok) {
      setToastText(result.error ?? "저장 공간이 부족해요. 설정에서 오래된 기록을 정리해주세요");
      setToastOpen(true);
      return;
    }
    safeHaptic("success");
    setToastText("오래된 기록을 정리했어요");
    setToastOpen(true);
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={TAB_ITEMS} />}
    >
      <div data-testid="settings-reminder-toggle" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="체크인 리마인더"
              bottom="정한 시간에 홈 배너로 알려드려요"
            />
          }
          right={<Switch checked={settings.reminderEnabled} onChange={toggleReminder} />}
        />
      </div>

      <ListRow
        data-testid="settings-hour-row"
        onClick={() => setHourSheetOpen(true)}
        contents={
          <ListRow.Texts type="2RowTypeA" top="리마인더 시간" bottom={formatHour(settings.reminderHour)} />
        }
      />

      <div data-testid="settings-penalty-toggle" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
        <ListRow
          contents={
            <ListRow.Texts type="2RowTypeA" top="벌금 기능" bottom="미이행 항목에 벌금을 계산해요" />
          }
          right={<Switch checked={settings.penaltyEnabled} onChange={togglePenalty} />}
        />
      </div>

      <Spacing size={24} />

      <ListRow
        data-testid="settings-cleanup-row"
        onClick={() => setPruneOpen(true)}
        contents={
          <ListRow.Texts type="2RowTypeA" top="오래된 기록 정리" bottom="30일 이전 체크인을 지워요" />
        }
      />

      <Spacing size={24} />

      <ListRow
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top="우리집"
            bottom={`${state.household?.name ?? ""} · 초대 코드 ${state.household?.inviteCode ?? ""}`}
          />
        }
      />

      <Spacing size={16} />
      <Paragraph.Text typography="st12" color="secondary">{`버전 ${APP_VERSION}`}</Paragraph.Text>
      <Spacing size={80} />

      <BottomSheet open={hourSheetOpen} onClose={() => setHourSheetOpen(false)} header="리마인더 시간">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              data-testid={`hour-option-${h}`}
              aria-pressed={h === settings.reminderHour}
              onClick={() => pickHour(h)}
              style={{
                minHeight: 44,
                padding: "0 12px",
                borderRadius: 12,
                border: "none",
                background:
                  h === settings.reminderHour
                    ? "var(--adaptiveBlue100)"
                    : "var(--adaptiveLayeredBackground)",
                color: h === settings.reminderHour ? "var(--adaptiveBlue500)" : "var(--adaptiveGrey700)",
                cursor: "pointer",
              }}
            >
              {formatHour(h)}
            </button>
          ))}
        </div>
      </BottomSheet>

      <AlertDialog
        open={pruneOpen}
        title="오래된 기록을 정리할까요?"
        description="30일 이전 체크인이 지워져요"
        alertButton={<AlertDialog.AlertButton onClick={handlePrune}>정리</AlertDialog.AlertButton>}
        onClose={() => setPruneOpen(false)}
      />

      <Toast
        open={toastOpen || Boolean(error)}
        text={toastText || error || ""}
        position="bottom"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
