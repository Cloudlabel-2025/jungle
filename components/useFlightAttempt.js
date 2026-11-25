"use client";
import { useEffect, useState } from "react";
import useSavedWork from "./useSavedWork";
import { attemptComplete, firstUnanswered } from "@/lib/final-flight-games.js";

export default function useFlightAttempt({ record, ownerId, now, open, act }) {
  const d = record.data,
    quiz = d.activity.kind === "QUIZ";
  const [answers, setAnswers] = useState(d.draft || {}),
    [board, setBoard] = useState(d.gameState || {});
  const [saved, setSaved] = useState({
    answers: d.draft || {},
    board: d.gameState || {},
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revising, setRevising] = useState(false);
  const expired = new Date(now) > new Date(d.deadline),
    complete = attemptComplete(record),
    sealed = quiz && Boolean(d.submittedAt);
  const canWrite =
    open || d.extensions?.some((e) => new Date(now) <= new Date(e.deadline));
  const readOnly = expired || !canWrite || sealed || (complete && !revising);
  const work = useSavedWork({
    value: { answers, board },
    initialValue: { answers: d.draft || {}, board: d.gameState || {} },
    initialVersion: record.version,
    ownerId,
    enabled: !readOnly && !busy,
    endpoint: "/api/week1/program/attempt-save",
    onSaved: setSaved,
    buildBody: (value, version) => ({
      attemptId: record._id,
      attemptVersion: version,
      answers: value.answers,
      gameState: value.board,
    }),
  });
  useEffect(() => work.syncVersion(record.version), [record.version]);
  const visible = expired ? saved.answers : answers,
    state = expired ? saved.board : board;
  const [cursor, setCursor] = useState(() =>
    Math.min(
      d.gameState?.cursor ?? firstUnanswered(d.activity, d.draft),
      Math.max(
        0,
        (quiz ? d.activity.questions.length : d.activity.fields.length) - 1,
      ),
    ),
  );
  const update = (key, value) => {
    if (readOnly || busy) return;
    setAnswers((a) => ({ ...a, [key]: value }));
  };
  const patch = (value) => {
    if (readOnly || busy) return;
    setBoard((s) => ({ ...s, ...value }));
  };
  const move = (index) => {
    if (busy) return;
    setError("");
    // Cursor changes join the existing debounced draft save. Rapid navigation
    // must not enqueue one database transaction per card. Submit/leave flush it.
    setCursor(index);
    if (!readOnly) setBoard(previous => ({ ...previous, cursor: index }));
  };
  const submit = async () => {
    if (busy || !canWrite || sealed) return;
    setError("");
    try {
      const pending = work.flush();
      setBusy(true);
      await pending;
      const ok = await act(
        "week1/program/attempt-submit",
        {
          attemptId: record._id,
          attemptVersion: work.getVersion(),
          answers: expired ? saved.answers : answers,
        },
        "Your mission result is saved.",
      );
      if (!ok)
        throw Error(
          "Submission was not confirmed. Your work is kept here; try again.",
        );
      setRevising(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const total = quiz ? d.activity.questions.length : d.activity.fields.length;
  const count = quiz
    ? d.activity.questions.filter(
        (q) =>
          Number.isInteger(visible[q.id]) &&
          visible[q.id] >= 0 &&
          visible[q.id] < q.options.length,
      ).length
    : d.activity.fields.filter((k) => String(visible[k] || "").trim()).length;
  return {
    answers: visible,
    state,
    cursor,
    move,
    patch,
    update,
    submit,
    busy,
    error,
    readOnly,
    expired,
    complete,
    sealed,
    count,
    total,
    canWrite,
    revising,
    setRevising,
    status:
      work.status ||
      (d.savedAt ? "Saved mission restored" : "Auto-save active"),
  };
}
