"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  MessagesSquare,
  Search,
  ShieldCheck,
  LockKeyhole,
  Send,
  ExternalLink,
} from "lucide-react";
import useSavedWork, { flushPendingWork } from "./useSavedWork";
import LevelOneResult from "./LevelOneResult";

export function firstResearchReady(record) {
  const c = record.levelOne?.automatic?.checks;
  return Boolean(c?.checkpoints && c?.readable && c?.related);
}
export default function LevelOneJourney({
  record,
  act,
  now,
  open,
  onContinue,
  nextLevel,
  children,
}) {
  const [mission, setMission] = useState(null),
    [error, setError] = useState("");
  const researchReady = firstResearchReady(record),
    checkReady = Boolean(
      record.claimCheck?.at &&
      record.claimCheck.researchRevisionId === record.submissions.at(-1)?.id,
    ),
    completed = Boolean(record.levelOne?.result?.completed);
  const go = async (value) => {
    setError("");
    try {
      await flushPendingWork(record.userId);
      setMission(value);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section
      className={`first-discovery-journey ${mission ? "has-mission" : ""}`}
      aria-label="Level 1 two-mission journey"
    >
      {error && <p role="alert">{error}</p>}
      {mission && (
        <button className="discovery-back" onClick={() => go(null)}>
          <ArrowLeft size={14} /> Level 1 missions
        </button>
      )}
      {!mission ? (
        <div className="discovery-mission-hub">
          <header>
            <span>LEVEL 1 / FIRST DISCOVERY</span>
            <h3>Curiosity needs a second look.</h3>
            <p>Explore with AI. Then decide what deserves your trust.</p>
          </header>
          <div className="discovery-concept-cards">
            <button onClick={() => go(1)} data-pip-target="genres">
              <MessagesSquare size={44} />
              <span>MISSION 01 / EXPLORE</span>
              <h4>Ask. Follow up. Discover.</h4>
              <p>
                Choose your question, use AI to investigate, and bring back your
                shared conversation.
              </p>
              <strong>
                {researchReady ? (
                  <>
                    <Check size={16} /> Research secured
                  </>
                ) : record.startedAt ? (
                  "Continue your investigation"
                ) : (
                  "Chart your discovery"
                )}
                <ArrowRight size={17} />
              </strong>
            </button>
            <button
              data-pip-target="claim-check"
              disabled={!researchReady}
              onClick={() => go(2)}
            >
              <ShieldCheck size={44} />
              <span>MISSION 02 / VERIFY</span>
              <h4>Check before you trust.</h4>
              <p>
                Take one claim from your research. Check another source and
                explain what you would trust.
              </p>
              <strong>
                {!researchReady ? (
                  <>
                    <LockKeyhole size={15} /> Complete Mission 1 first
                  </>
                ) : checkReady ? (
                  <>
                    <Check size={16} /> Claim check recorded
                  </>
                ) : (
                  <>
                    Investigate one claim <ArrowRight size={17} />
                  </>
                )}
              </strong>
            </button>
          </div>
          <footer>
            <Search size={16} /> Two short missions. One discovery you can
            explain.
          </footer>
          {completed && (
            <div className="discovery-hub-result">
              <LevelOneResult level={record.levelOne} compact />
              {nextLevel?.available && (
                <button className="discovery-submit" onClick={onContinue}>
                  Continue to Level 2 <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : mission === 1 ? (
        children(() => go(2))
      ) : (
        <ClaimCheck
          key={record.submissions.at(-1)?.id}
          record={record}
          act={act}
          now={now}
          open={open}
          onContinue={onContinue}
          nextLevel={nextLevel}
        />
      )}
    </section>
  );
}

export function ClaimCheck({ record, act, now, open, onContinue, nextLevel }) {
  const current = record.submissions.at(-1),
    draft = record.claimCheckDraft,
    initial =
      draft?.researchRevisionId === current?.id
        ? draft.answers
        : record.claimCheck?.researchRevisionId === current?.id
          ? record.claimCheck
          : {};
  const [answers, setAnswers] = useState(() => ({
    claim: initial.claim || "",
    source: initial.source || "",
    verdict: initial.verdict || "",
    finding: initial.finding || "",
  }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revising, setRevising] = useState(false);
  const done = Boolean(
      record.claimCheck?.at &&
      record.claimCheck.researchRevisionId === current?.id,
    ),
    expired = new Date(now) > new Date(record.deadline),
    needsStart = ["mission-start-v1", "free-missions-v2"].includes(record.missionEnergy?.policy) && !record.missionEnergy.claim,
    readOnly = needsStart || !open || (done && !revising);
  const work = useSavedWork({
    value: answers,
    initialValue: answers,
    initialVersion: draft?.revision || 0,
    ownerId: record.userId,
    enabled: !busy && !readOnly,
    endpoint: "/api/day1/claim-check-draft",
    buildBody: (value, version) => ({
      ownerId: record.userId,
      researchRevisionId: current?.id,
      answers: value,
      draftVersion: version,
    }),
  });
  useEffect(() => work.syncVersion(draft?.revision || 0), [draft?.revision]);
  const visible = answers;
  const update = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));
  const submit = async () => {
    if (busy || !open) return;
    setError("");
    try {
      const pending = work.flush();
      setBusy(true);
      await pending;
      if (
        !(await act(
          "day1/claim-check-submit",
          {
            ownerId: record.userId,
            researchRevisionId: current?.id,
            answers: visible,
            draftVersion: work.getVersion(),
          },
          "Your claim check and Level 1 result are saved.",
        ))
      )
        throw Error(
          "Your check was not confirmed. Your notes are kept here; retry.",
        );
      setRevising(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!firstResearchReady(record))
    return (
      <div className="claim-check-locked">
        <LockKeyhole size={36} />
        <h3>Bring back your research first.</h3>
        <p>
          The system needs readable research about your question before you can
          check a claim.
        </p>
      </div>
    );
  if (needsStart) return (
    <div className="claim-check-board">
      <ShieldCheck size={45} />
      <h3>Check before you trust.</h3>
      <p>Starting, continuing and saving this mission are free. Energy is only deducted for confirmed rule breaches.</p>
      {error && <p role="alert">{error}</p>}
      <button className="discovery-submit" disabled={busy || !open} onClick={async () => {
        setBusy(true);
        setError("");
        try {
          if (!await act("day1/claim-check-start", { ownerId: record.userId, researchRevisionId: current?.id }, "Mission 2 started. Your energy is unchanged."))
            setError("Mission start was not confirmed. Try again or ask Help Desk for recovery.");
        } finally { setBusy(false); }
      }}>{busy ? "Starting…" : "Start Mission 2"}</button>
    </div>
  );
  return (
    <div className="claim-check-board">
      <header>
        <div>
          <span>MISSION 02 / INDEPENDENT CHECK</span>
          <h3>Would you trust that answer?</h3>
          <p>
            Pick one specific claim from your chat. Investigate it beyond the
            AI’s answer.
          </p>
        </div>
        <img
          src="/images/pip/pip-thinking.webp"
          alt="Kiko thinking"
          width="110"
          height="110"
        />
        <small
          className="claim-check-timer"
          role="timer"
          aria-label="Research time remaining"
        >
          {Math.max(
            0,
            Math.ceil((new Date(record.deadline) - new Date(now)) / 60000),
          )}{" "}
          min left
        </small>
      </header>
      {error && (
        <p className="claim-error" role="alert">
          {error}
        </p>
      )}
      {expired && !done && (
        <p className="claim-error">
          Your research window has ended. You can still finish this check; a
          late completion does not earn the on-time star.
        </p>
      )}
      {done && !revising ? (
        <div className="claim-check-result">
          <ShieldCheck size={45} />
          <h4>Your judgement is recorded.</h4>
          <p>{record.claimCheck.finding}</p>
          <LevelOneResult level={record.levelOne} compact />
          <div>
            <button onClick={() => setRevising(true)} disabled={!open}>
              Refine your check
            </button>
            {nextLevel?.available && onContinue && (
              <button className="discovery-submit" onClick={onContinue}>
                Continue to Level 2 <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="claim-evidence-pair">
            <section>
              <span>01 / THE CLAIM</span>
              <label htmlFor="claim-statement">What did the AI claim?</label>
              <textarea
                id="claim-statement"
                data-pip-target="claim-check"
                rows={2}
                maxLength={600}
                value={visible.claim}
                readOnly={readOnly}
                disabled={busy}
                onChange={(e) => update("claim", e.target.value)}
                placeholder="Choose one specific statement from your research…"
              />
              {current?.url && (
                <a href={current.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} /> Open your research chat
                </a>
              )}
            </section>
            <span className="claim-bridge" aria-hidden="true">
              <Search size={25} />
            </span>
            <section>
              <span>02 / YOUR CHECK</span>
              <label htmlFor="claim-source">Which source did you check?</label>
              <input
                id="claim-source"
                type="url"
                maxLength={2000}
                value={visible.source}
                readOnly={readOnly}
                disabled={busy}
                onChange={(e) => update("source", e.target.value)}
                placeholder="https://… independent source"
              />
              <p>
                Read the source yourself. Another AI conversation is not an
                independent check.
              </p>
            </section>
          </div>
          <section className="claim-judgement">
            <span>03 / MAKE YOUR CALL</span>
            <div role="group" aria-label="Your claim verdict">
              {[
                ["SUPPORTED", "Supported", "The source backs the claim."],
                [
                  "CHALLENGED",
                  "Challenged",
                  "The source contradicts or limits it.",
                ],
                [
                  "UNCERTAIN",
                  "Still uncertain",
                  "There is not enough evidence yet.",
                ],
              ].map(([id, title, description]) => (
                <button
                  key={id}
                  aria-pressed={visible.verdict === id}
                  disabled={readOnly || busy}
                  onClick={() => update("verdict", id)}
                >
                  <strong>{title}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
            <label htmlFor="claim-finding">
              What did you find, and what would you trust now?
            </label>
            <textarea
              id="claim-finding"
              rows={2}
              maxLength={1200}
              value={visible.finding}
              readOnly={readOnly}
              disabled={busy}
              onChange={(e) => update("finding", e.target.value)}
              placeholder="Explain the check and your judgement in a few sentences (at least 20 words)…"
            />
            <small>
              “Still uncertain” is a valid conclusion when you explain why.
            </small>
          </section>
          <footer>
            <small role="status">
              {busy
                ? "Saving your judgement…"
                : work.status ||
                  (draft
                    ? "Saved check restored"
                    : "Your notes save to your account")}
            </small>
            <button
              className="discovery-submit"
              disabled={busy || !open}
              onClick={submit}
            >
              <Send size={16} />
              Complete the claim check
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
