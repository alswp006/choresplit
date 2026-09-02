import { useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Top, TextField, Button, Spacing, ListRow, Paragraph } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { Card } from "@/components/Card";
import { createHousehold, seedDefaultTasks, saveSettings } from "@/storage/repository";
import { MAX_MEMBERS, type AppSettings } from "@/lib/types";

const ROW_EMOJIS = ["🙂", "😀", "🐱", "🐶", "🐰", "🦊", "🐼", "🐨"];

function fireHaptic(type: "tickWeak" | "success" | "basicWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function scrollFieldIntoView(e: FocusEvent<HTMLInputElement>) {
  try {
    e.currentTarget.scrollIntoView?.({ block: "center" });
  } catch {
    /* jsdom 등 미구현 환경 — 무시 */
  }
}

interface MemberRow {
  key: string;
  name: string;
}

/**
 * 최초 실행 온보딩 — 가구 이름 + 구성원(최대 4명) 등록 후 홈으로 이동.
 * 저장은 store를 거치지 않고 repository 함수를 직접 호출한다(부팅 전 단계라 AppStoreProvider 밖).
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const memberKeyCounter = useRef(2);

  const [householdName, setHouseholdName] = useState("");
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([
    { key: "m-0", name: "" },
    { key: "m-1", name: "" },
  ]);
  const [memberErrors, setMemberErrors] = useState<(string | null)[]>([null, null]);
  const [saving, setSaving] = useState(false);

  function updateMemberName(index: number, value: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, name: value } : m)));
    setMemberErrors((prev) => prev.map((e, i) => (i === index ? null : e)));
  }

  function handleAddMember() {
    if (members.length >= MAX_MEMBERS) return;
    fireHaptic("tickWeak");
    setMembers((prev) => [...prev, { key: `m-${memberKeyCounter.current++}`, name: "" }]);
    setMemberErrors((prev) => [...prev, null]);
  }

  function handleRemoveMember(index: number) {
    if (members.length <= 1) return;
    fireHaptic("basicWeak");
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setMemberErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function validateMemberNames(names: string[]): (string | null)[] {
    const trimmed = names.map((n) => n.trim());
    return trimmed.map((name, i) => {
      if (!name) return "이름을 입력해주세요";
      if (trimmed.some((other, j) => j !== i && other === name)) return "이름이 중복돼요";
      return null;
    });
  }

  function handleSubmit() {
    if (saving) return;

    const nameErr = householdName.trim() ? null : "가구 이름을 입력해주세요";
    const memberErrs = validateMemberNames(members.map((m) => m.name));

    if (nameErr || memberErrs.some((e) => e)) {
      setHouseholdError(nameErr);
      setMemberErrors(memberErrs);
      return;
    }

    setSaving(true);

    const household = createHousehold(
      householdName.trim(),
      members.map((m) => m.name.trim()),
    );
    seedDefaultTasks();

    const settings: AppSettings = {
      activeMemberId: household.members[0]?.id ?? null,
      reminderEnabled: true,
      reminderTime: "21:00",
      onboardingDone: true,
      lastReportWeekKey: null,
      reportUnlockedWeeks: [],
    };
    saveSettings(settings);

    fireHaptic("success");
    navigate("/", { replace: true });
  }

  const atMaxMembers = members.length >= MAX_MEMBERS;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>우리집 만들기</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter label="시작하기" onClick={handleSubmit} disabled={saving} loading={saving} />
      }
    >
      <Spacing size={16} />
      <Card>
        <TextField
          variant="box"
          label="가구 이름"
          placeholder="예: 우리집"
          value={householdName}
          onChange={(e) => {
            setHouseholdName(e.target.value);
            if (householdError) setHouseholdError(null);
          }}
          onFocus={scrollFieldIntoView}
          help={householdError ?? "1~20자로 입력해주세요"}
          hasError={!!householdError}
          inputMode="text"
          enterKeyHint="next"
          maxLength={20}
          disabled={saving}
        />
      </Card>

      <Spacing size={24} />
      <Paragraph.Text typography="t4">함께 사는 사람</Paragraph.Text>
      <Spacing size={12} />

      <Card>
        {members.map((m, idx) => (
          <ListRow
            key={m.key}
            left={
              <div aria-hidden style={{ width: 32, textAlign: "center", fontSize: 20 }}>
                {ROW_EMOJIS[idx % ROW_EMOJIS.length]}
              </div>
            }
            contents={
              <TextField
                variant="line"
                placeholder="이름을 입력해주세요"
                value={m.name}
                onChange={(e) => updateMemberName(idx, e.target.value)}
                onFocus={scrollFieldIntoView}
                help={memberErrors[idx] ?? undefined}
                hasError={!!memberErrors[idx]}
                inputMode="text"
                enterKeyHint={idx === members.length - 1 ? "done" : "next"}
                autoComplete="name"
                disabled={saving}
              />
            }
            right={
              idx > 0 ? (
                <Button
                  aria-label="구성원 삭제"
                  variant="weak"
                  size="small"
                  onClick={() => handleRemoveMember(idx)}
                  disabled={saving}
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  삭제
                </Button>
              ) : undefined
            }
          />
        ))}
      </Card>

      <Spacing size={12} />
      <Button
        variant="weak"
        size="medium"
        display="block"
        onClick={handleAddMember}
        disabled={atMaxMembers || saving}
      >
        구성원 추가
      </Button>
      {atMaxMembers && (
        <>
          <Spacing size={8} />
          <Paragraph.Text typography="st13">
            구성원은 최대 4명까지 등록할 수 있어요
          </Paragraph.Text>
        </>
      )}

      <Spacing size={100} />
    </ScreenScaffold>
  );
}
