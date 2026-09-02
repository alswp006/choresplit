# choresplit

앱인토스 (Vite + React + TDS) 동거인과 집안일 기여도를 매일 기록해 공정하게 정산해주는 가사분담 트래커 룸메이트·동거 커플·신혼부부 사이 가사노동 분담 불균형으로 갈등이 발생하지만 이를 객관적으로 기록·정산할 도구가 없다

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Chores` | Chores |
| `/Home` | Home |
| `/Members` | Members |
| `/Onboarding` | Onboarding |
| `/Report` | Report |
| `/ReportDetail` | ReportDetail |
| `/Settings` | Settings |
| `/Settle` | Settle |
| `/Streak` | Streak |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-02
