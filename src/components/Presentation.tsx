import type { ReactNode } from "react";
import { Asset, Button, Paragraph, Spacing } from "@toss/tds-mobile";

/**
 * 공용 표현 컴포넌트 — SummaryHero(숫자 앵커) / Sparkline(막대 추이) /
 * MiniBar(비율 진행바) / EmptyState(빈 상태). 색은 var(--adaptive*)만 사용.
 */
export function SummaryHero({
  label,
  value,
  caption,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
    >
      <Paragraph.Text typography="st11">{label}</Paragraph.Text>
      <Spacing size={4} />
      <Paragraph.Text typography="t1">{value}</Paragraph.Text>
      {caption ? (
        <>
          <Spacing size={4} />
          <Paragraph.Text typography="t6">{caption}</Paragraph.Text>
        </>
      ) : null}
    </div>
  );
}

export function Sparkline({
  data,
  height = 64,
  testId,
}: {
  /** 길이 7 숫자 배열 (요일별 값 등) */
  data: number[];
  height?: number;
  testId?: string;
}) {
  const max = Math.max(0, ...data);
  return (
    <div data-testid={testId} style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((value, index) => {
        const barHeight = max > 0 ? Math.max((value / max) * height, 4) : 4;
        return (
          <div
            key={index}
            data-testid="sparkline-bar"
            style={{
              flex: 1,
              height: barHeight,
              borderRadius: 2,
              backgroundColor: "var(--adaptiveBlue500)",
            }}
          />
        );
      })}
    </div>
  );
}

export function MiniBar({
  ratio,
  testId,
}: {
  /** 0..1 (범위 밖은 클램프) */
  ratio: number;
  testId?: string;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      data-testid={testId}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: "100%",
        height: 8,
        borderRadius: 4,
        backgroundColor: "var(--adaptiveGrey200)",
        overflow: "hidden",
      }}
    >
      <div
        data-testid="mini-fill"
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 4,
          backgroundColor: "var(--adaptiveBlue500)",
        }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: {
  title: ReactNode;
  description?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
    >
      <Asset.ContentIcon
        name="iconEmptyRegular"
        alt={typeof title === "string" ? title : "빈 상태"}
        style={{ width: 48, height: 48 }}
      />
      <Spacing size={12} />
      <Paragraph.Text typography="t4">{title}</Paragraph.Text>
      {description ? (
        <>
          <Spacing size={4} />
          <Paragraph.Text typography="t6">{description}</Paragraph.Text>
        </>
      ) : null}
      <Spacing size={16} />
      <Button variant="weak" display="block" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
