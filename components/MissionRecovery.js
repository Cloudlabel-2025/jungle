"use client";
import { useEffect, useState } from "react";
import fetch from "@/lib/college-fetch.js";
import AvatarReaction from "./AvatarReaction";
import { WeekPanel } from "./WeekOneShared";

const drill = [
  [
    "Your energy is empty. What can you do now?",
    [
      "Reset your progress",
      "Continue saved work and recover energy",
      "Keep clicking Start",
    ],
  ],
  [
    "An AI claim sounds convincing. What do you do?",
    [
      "Check an independent source",
      "Trust the tone of the answer",
      "Copy it without checking",
    ],
  ],
  [
    "A mission is blocked. What helps your MC?",
    [
      "Send only “broken”",
      "Delete the evidence",
      "Describe the step, what happened and what you expected",
    ],
  ],
];
export default function MissionRecovery({ data, act }) {
  const [cases, setCases] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({}),
    [reason, setReason] = useState("");
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const gamer = data.user.role === "GAMER";
  const load = async () => {
    try {
      const response = await fetch("/api/player/mission-recovery", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Recovery status could not be loaded.");
      setCases(result.cases);
      setNeedsRecovery(result.needsRecovery);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    void load();
  }, [data.user._id, data.user.hp, data.user.energy]);
  const recover = async (row) => {
    setBusy(true);
    setError("");
    try {
      if (
        !(await act(
          "player/mission-recovery",
          {
            rescueId: row.id,
            ...(gamer
              ? { answers: drill.map((_, i) => answers[i]) }
              : { reason }),
          },
          "Recovery complete. You have 1 or more lives and 3 energy. Your progress is kept.",
        ))
      )
        throw Error(
          "Recovery was not confirmed. Check your choices or ask Centre Command for help.",
        );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (cases?.length === 0 && !needsRecovery) return null;
  return (
    <WeekPanel
      title={gamer ? "Recovery camp" : "Energy recovery queue"}
      kicker="KEEP YOUR PROGRESS"
    >
      {gamer && data.user.hp === 0 && (
        <AvatarReaction
          player={data.user}
          mood="sad"
          caption="Rest, recover, return."
          detail="Your progress is safe. Follow the recovery steps below."
        />
      )}
      <p>
        Recovery restores 1 life if needed and 3 energy. Your missions, rewards
        and conduct history stay saved.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="btn small" onClick={load}>
            Reload recovery status
          </button>
        </p>
      )}
      {!cases && !error && <p role="status">Checking recovery status…</p>}
      {gamer && needsRecovery && cases?.length === 0 && (
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (
                !(await act(
                  "player/mission-recovery",
                  { action: "request" },
                  "Recovery review requested. Centre Command can restore your energy from the support queue.",
                ))
              )
                throw Error("Your request was not confirmed. Please retry.");
              await load();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Request energy recovery review
        </button>
      )}
      {cases?.map((row) => (
        <section className="recovery-drill" key={row.id}>
          {!gamer && (
            <h3>
              {row.name} · {row.hp} lives / {row.energy} energy
            </h3>
          )}
          {gamer && row.selfService ? (
            <>
              <p>
                Complete these three choices to return to the trail. There is no
                energy cost.
              </p>
              {drill.map(([question, options], i) => (
                <fieldset key={question}>
                  <legend>
                    {i + 1}. {question}
                  </legend>
                  {options.map((option, j) => (
                    <button
                      type="button"
                      key={option}
                      className={`btn ${answers[i] === j ? "primary" : ""}`}
                      aria-pressed={answers[i] === j}
                      disabled={busy}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    >
                      {option}
                    </button>
                  ))}
                </fieldset>
              ))}
              <button
                className="btn primary"
                disabled={
                  busy || drill.some((_, i) => !Number.isInteger(answers[i]))
                }
                onClick={() => recover(row)}
              >
                {busy ? "Recovering…" : "Finish recovery · restore energy"}
              </button>
            </>
          ) : gamer ? (
            <p>
              Your case needs staff review. Send an essential-support question
              below and ask Centre Command to approve energy recovery. Saved
              missions remain available.
            </p>
          ) : (
            <>
              <label>
                Reason for approving recovery
                <textarea
                  minLength={20}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="btn primary"
                disabled={busy || reason.trim().length < 20}
                onClick={() => recover(row)}
              >
                {busy ? "Recovering…" : "Approve recovery · restore energy"}
              </button>
            </>
          )}
        </section>
      ))}
    </WeekPanel>
  );
}
