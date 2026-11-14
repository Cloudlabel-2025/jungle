"use client";
import { useEffect, useState } from "react";
import { Form } from "./ui";
import useSavedWork from "./useSavedWork";

export default function SavedReflectionForm({
  ownerId,
  draft,
  kind,
  day = 1,
  externalText,
  mode = "TEXT",
  onSubmit,
  ...props
}) {
  const initial = {
    text: draft?.text ?? draft?.value?.text ?? "",
    mode: draft?.mode || mode,
  };
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (externalText !== undefined && externalText !== "")
      setValue((v) => ({ ...v, text: externalText, mode }));
  }, [externalText, mode]);
  const work = useSavedWork({
    value,
    initialValue: initial,
    initialVersion: draft?.revision || 0,
    enabled: !busy,
    ownerId,
    endpoint:
      day === 1
        ? "/api/day1/reflection-draft"
        : "/api/week1/program/reflection-draft",
    payload: { kind, day },
  });
  return (
    <>
      <Form
        {...props}
        key={externalText || kind}
        initial={{ text: externalText || initial.text }}
        onDraftChange={(v) => setValue({ text: v.text || "", mode })}
        onSubmit={async (v) => {
          setError("");
          try {
            await work.flush({ text: v.text || "", mode });
            setBusy(true);
            return await onSubmit(v);
          } catch (e) {
            setError(e.message);
            return false;
          } finally {
            setBusy(false);
          }
        }}
      />
      <p className="muted" role="status">
        {work.status ||
          (draft
            ? "Saved draft restored"
            : "Your draft saves automatically.")}{" "}
        · Drafts are not submitted work.
      </p>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
