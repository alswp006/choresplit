import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Paragraph, TextField, Spacing, Toast } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { SubmitFooter } from "@/components/BottomCTA";
import { useAppState } from "@/lib/store";
import { validateOnboarding } from "@/lib/household";

function focusCenter(e: FocusEvent<HTMLInputElement>) {
  try {
    e.currentTarget.scrollIntoView?.({ block: "center" });
  } catch {
    /* 일부 환경(jsdom 등)엔 scrollIntoView가 없음 — 무시 */
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { ready, state, createHousehold } = useAppState();

  const [householdName, setHouseholdName] = useState("");
  const [myName, setMyName] = useState("");
  const [hhError, setHhError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  const nicknameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && state.household) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, navigate]);

  function handleSubmit() {
    if (saving) return;

    const validation = validateOnboarding(householdName, myName);
    if (!validation.ok) {
      setHhError(validation.field === "household" ? (validation.error ?? "") : null);
      setNameError(validation.field === "name" ? (validation.error ?? "") : null);
      return;
    }
    setHhError(null);
    setNameError(null);

    setSaving(true);
    const result = createHousehold(householdName.trim(), myName.trim());
    if (result.ok) {
      navigate("/", { replace: true });
      return;
    }
    setSaving(false);
    setToastText(result.error ?? "저장에 실패했어요. 다시 시도해주세요");
    setToastOpen(true);
  }

  function handleHouseholdKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      nicknameRef.current?.focus();
    }
  }

  function handleNicknameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>집안일, 공정하게</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter label="시작하기" onClick={handleSubmit} disabled={saving} loading={saving} />
      }
    >
      <Spacing size={8} />
      <Paragraph.Text typography="st11" color="secondary">
        가구 이름과 내 닉네임만 정하면 바로 시작해요
      </Paragraph.Text>
      <Spacing size={24} />
      <Card>
        <TextField
          variant="box"
          label="가구 이름"
          placeholder="예: 우리집"
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
          onFocus={focusCenter}
          onKeyDown={handleHouseholdKeyDown}
          hasError={!!hhError}
          help={hhError ?? undefined}
          enterKeyHint="next"
        />
        <Spacing size={16} />
        <TextField
          ref={nicknameRef}
          variant="box"
          label="내 닉네임"
          placeholder="예: 민수"
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          onFocus={focusCenter}
          onKeyDown={handleNicknameKeyDown}
          hasError={!!nameError}
          help={nameError ?? undefined}
          enterKeyHint="done"
        />
      </Card>
      <Toast open={toastOpen} text={toastText} position="bottom" onClose={() => setToastOpen(false)} />
    </ScreenScaffold>
  );
}
