import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Badge, AlertDialog, Toast, Asset } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { EmptyState, LoadingState } from "@/components/StateView";
import { AdSlot } from "@/components/AdSlot";
import { SubmitFooter } from "@/components/BottomCTA";
import { useAppState } from "@/lib/store";
import { todayKST } from "@/lib/storage";
import { buildSettlement, getWeekEnd, getWeekStart } from "@/lib/report";
import { formatNumber } from "@/lib/utils";
import type { SettlementRecord } from "@/lib/types";

interface SettleLocationState {
  weekStart?: string;
}

function safeHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 앱인토스 WebView 밖 — 무시 */
  }
}

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? "settle-banner";

export default function Settle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, state, addSettlement } = useAppState();

  const routeState = (location.state as SettleLocationState | null) ?? null;
  const weekStart =
    routeState?.weekStart && routeState.weekStart.length > 0
      ? getWeekStart(routeState.weekStart)
      : getWeekStart(todayKST());
  const weekEnd = getWeekEnd(weekStart);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  if (!ready) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>벌금 정산</Top.TitleParagraph>} />}>
        <LoadingState rows={4} testId="settle-loading" />
      </ScreenScaffold>
    );
  }

  if (!state.household) {
    navigate("/onboarding", { replace: true });
    return null;
  }

  const nameOf = (memberId: string) =>
    state.members.find((m) => m.id === memberId)?.name ?? "알 수 없음";

  const settlement = buildSettlement(state, weekStart);
  const existing = state.settlements.find((s) => s.weekStart === weekStart) ?? null;
  const settled = existing != null;
  const isEmpty = !state.settings.penaltyEnabled || settlement.totalPenalty === 0;
  const ctaDisabled = settled || isEmpty;

  function handleConfirm() {
    if (settled || isEmpty) return;
    const record: SettlementRecord = {
      weekStart,
      settledAt: new Date().toISOString(),
      lines: settlement.lines,
      totalPenalty: settlement.totalPenalty,
    };
    const result = addSettlement(record);
    setConfirmOpen(false);
    if (!result.ok) {
      setToastText(result.error ?? "정산 확정에 실패했어요");
      setToastOpen(true);
      return;
    }
    safeHaptic("success");
    setToastText("정산을 확정했어요");
    setToastOpen(true);
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>벌금 정산</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="정산 확정" disabled={ctaDisabled} onClick={() => setConfirmOpen(true)} />}
    >
      <Card testId="settle-hero">
        <Paragraph.Text typography="st11">이번 주 벌금</Paragraph.Text>
        <Spacing size={4} />
        <CountUp value={settlement.totalPenalty} unit="원" typography="t1" testId="settle-total-penalty" />
        <Spacing size={4} />
        <Paragraph.Text typography="t6">{`${weekStart} ~ ${weekEnd}`}</Paragraph.Text>
        {settled ? (
          <>
            <Spacing size={12} />
            <Badge size="medium" variant="weak" color="blue">
              {`확정됨 · ${existing!.settledAt}`}
            </Badge>
            <Spacing size={4} />
            <span data-testid="settle-settled-at">{existing!.settledAt}</span>
          </>
        ) : null}
      </Card>
      <Spacing size={24} />

      {isEmpty ? (
        <EmptyState
          icon={<Asset.ContentIcon name="iconWalletRegular" alt="정산 없음" />}
          title="이번 주는 정산할 벌금이 없어요"
          description="벌금이 쌓이면 여기서 정산을 제안해드려요"
          testId="settle-empty"
        />
      ) : (
        <Card>
          <Paragraph.Text typography="st11">정산 제안</Paragraph.Text>
          <Spacing size={12} />
          {settlement.lines.map((l, i) => (
            <div key={i} data-testid="settlement-line">
              <ListRow
                contents={
                  <ListRow.Texts
                    type="1RowTypeA"
                    top={`${nameOf(l.fromMemberId)} → ${nameOf(l.toMemberId)} ${formatNumber(l.amount)}원`}
                  />
                }
              />
            </div>
          ))}
          <Spacing size={12} />
          <Paragraph.Text typography="st12" color="secondary">
            실제 송금은 앱에서 처리하지 않아요. 금액 제안만 도와드려요
          </Paragraph.Text>
        </Card>
      )}
      <Spacing size={24} />

      <AdSlot adGroupId={AD_GROUP_ID} />
      <Spacing size={80} />

      <AlertDialog
        open={confirmOpen}
        title="이 금액으로 정산할까요?"
        description="확정하면 이번 주 정산 기록이 저장돼요"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirm}>확정</AlertDialog.AlertButton>}
        onClose={() => setConfirmOpen(false)}
      />

      <Toast open={toastOpen} text={toastText} position="bottom" onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
