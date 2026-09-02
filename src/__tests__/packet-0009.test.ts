import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { mockTds } from "@/__tests__/__helpers__/mocks";

mockTds();

import { SummaryHero, Sparkline, MiniBar, EmptyState } from "@/components/Presentation";

describe("공용 표현 컴포넌트 (SummaryHero / Sparkline / MiniBar / EmptyState)", () => {
  it("AC-1[P0]: SummaryHero가 label/value/caption을 렌더하고 testId를 DOM에 노출한다", () => {
    render(
      React.createElement(SummaryHero, {
        testId: "hero-card",
        label: "이번 달 정산",
        value: "128,000원",
        caption: "4명 참여",
      }),
    );

    expect(screen.getByTestId("hero-card")).toBeInTheDocument();
    expect(screen.getByText("이번 달 정산")).toBeInTheDocument();
    expect(screen.getByText("128,000원")).toBeInTheDocument();
    expect(screen.getByText("4명 참여")).toBeInTheDocument();
  });

  it("AC-2[P0]: Sparkline이 7개 포인트 배열을 받아 막대 7개를 렌더한다", () => {
    render(React.createElement(Sparkline, { testId: "spark", data: [1, 3, 2, 5, 4, 6, 3] }));

    const bars = screen.getAllByTestId("sparkline-bar");
    expect(bars).toHaveLength(7);
    expect(screen.getByTestId("spark")).toBeInTheDocument();
  });

  it("AC-2: 모든 값이 0이어도 예외 없이 최소 높이 막대 7개를 렌더한다", () => {
    expect(() =>
      render(React.createElement(Sparkline, { testId: "spark-zero", data: [0, 0, 0, 0, 0, 0, 0] })),
    ).not.toThrow();

    const bars = screen.getAllByTestId("sparkline-bar");
    expect(bars).toHaveLength(7);
    bars.forEach((bar) => {
      const height = parseFloat((bar as HTMLElement).style.height || "0");
      expect(height).toBeGreaterThan(0);
    });
  });

  it("AC-3[P0]: MiniBar가 ratio 0일 때 폭 0%, 1일 때 100%로 렌더한다", () => {
    const { rerender } = render(React.createElement(MiniBar, { testId: "mini", ratio: 0 }));
    expect(screen.getByTestId("mini-fill")).toHaveStyle({ width: "0%" });

    rerender(React.createElement(MiniBar, { testId: "mini", ratio: 1 }));
    expect(screen.getByTestId("mini-fill")).toHaveStyle({ width: "100%" });
  });

  it("AC-3: MiniBar는 1을 초과하는 ratio를 100%로 클램프한다", () => {
    render(React.createElement(MiniBar, { testId: "mini-over", ratio: 2.5 }));
    expect(screen.getByTestId("mini-fill")).toHaveStyle({ width: "100%" });
    expect(screen.getByTestId("mini-over")).toBeInTheDocument();
  });

  it("AC-4[P0]: EmptyState가 아이콘 + 설명 + weak/block CTA 버튼을 렌더한다", () => {
    render(
      React.createElement(EmptyState, {
        testId: "empty",
        title: "아직 기록이 없어요",
        description: "지출을 추가하면 여기 표시돼요",
        actionLabel: "지출 추가하기",
        onAction: () => {},
      }),
    );

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("지출을 추가하면 여기 표시돼요")).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: "지출 추가하기" });
    expect(cta).toHaveAttribute("variant", "weak");
    expect(cta).toHaveAttribute("display", "block");
  });

  it("AC-5: 파일 내 HEX 색상과 Tailwind 여백 클래스가 0건이다", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/Presentation.tsx"),
      "utf-8",
    );

    const hexMatches = source.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    const tailwindSpacingMatches =
      source.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\d+\b/g) ?? [];

    expect(hexMatches).toHaveLength(0);
    expect(tailwindSpacingMatches).toHaveLength(0);
  });
});
