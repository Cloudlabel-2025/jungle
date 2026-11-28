"use client";
import { useState } from "react";
import { levelReward } from "@/lib/week-one-level-rules.js";
import { WeekPanel, Evidence, weekTime } from "./WeekOneShared";
import DayOneReviewEvidence from "./DayOneReviewEvidence";
import SubmissionHistory from "./SubmissionHistory";
import GameChoices from "./GameChoices";
import WorkspaceSelect from "./WorkspaceSelect";
import MissionStars from "./MissionStars";
import { trophyLeague } from "@/lib/trophy-leagues.js";
const readable = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).map(([key, answer]) => [
      key,
      answer && typeof answer === "object"
        ? JSON.stringify(answer, null, 2)
        : answer,
    ]),
  );

export default function PlayerResultReview({ data, act }) {
  const [userId, setUserId] = useState(()=>data.weekOneProgram?.levelTargets?.members?.[0]?._id || "");
  const [day, setDay] = useState(1);
  const p = data.weekOneProgram;
  const members = p.levelTargets?.members || [];
  if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(data.user.role))
    return null;
  const first = data.dayOne?.records?.find((r) => r.userId === userId);
  const row =
    day === 1
      ? first?.levelOne
      : p.levelResults?.find((r) => r.userId === userId && r.day === day);
  const attempts = (p.attempts || []).filter(
    (a) => a.userId === userId && a.day === day,
  );
  const evidenceKey =
    day === 1
      ? first?.version
      : attempts
          .map((a) => `${a._id}:${a.version}`)
          .sort()
          .join("|");
  return (
    <WeekPanel title="Automatic level results and staff review" className="staff-result-review">
      <p className="review-intro">Check the earned stars and submitted answers. Validate the result, or correct the actual stars with a reason.</p>
      {!members.length && (
        <p>
          No players are assigned to your review scope. Ask Centre Command to
          check your team assignments.
        </p>
      )}
      <div className="result-review-toolbar">
      <WorkspaceSelect label="Player to review" value={userId} onChange={setUserId} options={members.map(member=>({value:member._id,label:member.name}))}/>
      <GameChoices
        label="Flight level"
        value={day}
        onChange={(value) => setDay(Number(value))}
        options={[1, 2, 3, 4, 5].map((d) => ({
          value: d,
          label: `Level ${d}`,
        }))}
      />
      </div>
      {userId && (
        <Review
          key={`${userId}:${day}:${day === 1 ? first?.version : row?.version}:${evidenceKey}`}
          {...{ data, act, userId, day, first, row, attempts }}
          playerTotal={members.find((m) => m._id === userId)?.trophies || 0}
        />
      )}
    </WeekPanel>
  );
}

function Review({ data, act, userId, day, first, row, attempts, playerTotal }) {
  const [operation, setOperation] = useState("validate");
  const [stars, setStars] = useState(row?.result?.stars || 3);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const trophyDelta =
    operation === "validate"
      ? 0
      : (operation === "result" ? levelReward(stars, day).trophies : 0) -
        (row?.creditedTrophies || 0);
  const fromLeague = trophyLeague(playerTotal),
    toLeague = trophyLeague(playerTotal + trophyDelta);
  const p = data.weekOneProgram;
  const canWrite =
    !Array.isArray(data.user.permissions) ||
    data.user.permissions.includes("game:write");
  const locked =
    (p.locked && !p.correction) ||
    (day === 1 && Boolean(data.dayOne.champion?.releasedAt));
  const submitted =
    day === 1
      ? first?.submissions?.length > 0
      : attempts.some((a) => a.data.submittedAt);
  const validation = row?.validation;
  const automatic = row?.automatic;
  const earnedStars=automatic?.stars || 0;
  const actualStars=row?.result?.completed ? row.result.stars : 0;
  const currentValidation =
    validation &&
    (day === 1
      ? validation.evidenceVersion === first.version - 1
      : Object.keys(validation.evidenceVersions || {}).length ===
          attempts.length &&
        attempts.every(
          (a) => validation.evidenceVersions?.[a._id] === a.version,
        )) &&
    validation.result?.stars === row?.result?.stars &&
    validation.result?.completed === row?.result?.completed;
  return (
    <div className="result-review-workspace">
      <div className="result-review-evidence">
      <div className="result-review-heading"><span className="game-kicker">LEVEL {day} · {data.weekOneProgram.levelTargets?.members.find(member=>member._id===userId)?.name}</span>
      <h3>
        Evidence and result
      </h3>
      </div>
      <section className="result-score-comparison" aria-label="Automatic and current level result">
        <div>
        <span className="game-kicker">EARNED STARS</span>
        <MissionStars stars={earnedStars} size="result"/>
        <strong>{automatic ? `${automatic.stars || 0}/3 stars · ${automatic.completed?"Complete":"Incomplete"}` : "No automatic result yet"}</strong>
        <small>Calculated from the submitted work.</small>
        </div><div><span className="game-kicker">ACTUAL RESULT</span>
        <MissionStars stars={actualStars} size="result"/>
        <strong>Actual result: {row?.result?.completed?`${actualStars}/3 stars`:"Incomplete"}</strong><small>{row?.result?.source && row.result.source!=="SYSTEM" ? "Staff correction" : currentValidation?"Validated result":"Awaiting staff validation"}</small></div>
      </section>
      <details className="result-review-disclosure"><summary>Scoring explanation and checks</summary><p>{automatic?.reason || "An automatic result appears after the player submits mission evidence."}</p>{automatic?.verificationScope&&<p>{automatic.verificationScope}</p>}{automatic?.checks&&<ul>{Object.entries(automatic.checks).map(([name,value])=><li key={name}>{name.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase())}: {typeof value==="boolean"?value?"Met":"Not met":String(value)}</li>)}</ul>}</details>
      {validation && (
        <p className="result-review-validation">
          {currentValidation
            ? "Human review recorded"
            : "Previous human review — work or result has changed"}{" "}
          · {validation.role==="CENTRE_COMMAND"?"CC":"MC"} · {validation.actorName || validation.actorId} · {weekTime(validation.at)}
          <br />
          {validation.reason}
        </p>
      )}
      <details className="result-review-disclosure" open><summary>Submitted evidence · current attempt</summary><div className="result-review-evidence-content">
      {day === 1 ? (
        first ? (
          <>
            <DayOneReviewEvidence
              record={first}
              canVerify
              compact
              formatDate={weekTime}
            />
            <h4>Independent claim check</h4>
            {first.claimCheck || first.claimCheckDraft?<><p>{first.claimCheck?"Submitted claim check":"Draft only — not yet submitted"}</p><Evidence value={readable(first.claimCheck || first.claimCheckDraft)}/></>:<p>No claim check has been submitted yet.</p>}
          </>
        ) : (
          <p>This player has not started Level 1.</p>
        )
      ) : attempts.length ? (
        attempts.map((a) => (
          <section key={a._id} className="receipt">
            <h4>{a.data.activity.name}</h4>
            <p>
              {a.data.submittedAt
                ? `Submitted ${weekTime(a.data.submittedAt)}`
                : "Draft only — not submitted"}{" "}
              · Revision {a.version}
            </p>
            <p>{a.data.variant?.brief || a.data.activity.brief}</p>
            <Evidence
              value={readable(
                a.data.submissions?.at(-1)?.answers ||
                  a.data.draft || { status: "No answers saved" },
              )}
            />
            <details>
              <summary>Scoring checks and saved experiment</summary>
              <Evidence
                value={readable({
                  automatic: row?.automatic,
                  assessment: a.data.result,
                  experiment: a.data.gameState || a.data.labState,
                  reference: a.data.variant?.reference,
                })}
              />
            </details>
          </section>
        ))
      ) : (
        <p>No mission evidence has been saved for this level.</p>
      )}
      </div></details>
      {day!==1&&<SubmissionHistory userId={userId} day={day} revision={`${row?.version}:${attempts.map(attempt=>`${attempt._id}:${attempt.version}`).join("|")}`}/>}
      </div><aside className="result-review-sidebar">
      <form
        className="field-form result-review-decision"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const response = await act(
              day === 1 ? "day1/level-result" : "week1/program/level-result",
              {
                day,
                userId,
                members: [userId],
                versions: {
                  [userId]: day === 1 ? first.version : row?.version || 0,
                },
                operation,
                stars,
                reason,
                reviewedEvidence: reviewed,
                evidenceVersions: Object.fromEntries(
                  attempts.map((a) => [a._id, a.version]),
                ),
              },
              operation === "validate"
                ? currentValidation?"Result revalidated. Player notified.":"Result validated. Player notified."
                : "Player result updated. Player notified.",
            );
            if (!response)
              throw Error(
                "Result was not saved. Review any error, refresh and try again.",
              );
            setMessage(
              "Review saved. The player has been notified. Rewards were reconciled without spending player energy.",
            );
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Validate or correct result</h3>
        <p className="muted">Your name, decision and reason will appear in the player’s notifications.</p>
        <GameChoices
          label="Review decision"
          value={operation}
          onChange={setOperation}
          disabled={busy}
          options={[
            {
              value: "validate",
              label: currentValidation?"Revalidate result":"Validate result",
              description: "Confirm the saved stars are correct",
            },
            {
              value: "result",
              label: "Correct result",
              description: "Set the actual stars and give a reason",
            },
            {
              value: "reopen",
              label: "Return for revision",
              description: "Mark incomplete and request changes",
            },
          ]}
        />
        {operation === "result" && (
          <div className="result-star-picker"><GameChoices
            label="Select the actual stars earned"
            value={stars}
            onChange={(value) => setStars(Number(value))}
            disabled={busy}
            options={[1, 2, 3].map((n) => ({
              value: n,
              label: <span className="result-star-option"><MissionStars stars={n}/><span>{n} {n===1?"star":"stars"}</span></span>,
              description: `${levelReward(n, day).trophies} trophies · ${levelReward(n, day).xp} XP`,
            }))}
          /><p className="result-star-change">Actual result: {actualStars}/3 → {stars}/3 stars. The original earned stars stay saved.</p></div>
        )}
        <div
          className="result-impact"
          aria-label="Result reward and league impact"
        >
          <span className="game-kicker">{operation==="validate"?"VALIDATION PREVIEW":"RESULT CHANGE PREVIEW"}</span>
          <MissionStars stars={operation==="validate"?actualStars:operation==="result"?stars:0}/>
          <strong>
            {playerTotal} → {playerTotal + trophyDelta} trophies
          </strong>
          <p>
            {fromLeague.rankIndex === toLeague.rankIndex
              ? fromLeague.ranked
                ? `Keeps ${fromLeague.displayName}`
                : "No league yet"
              : `${trophyDelta > 0 ? "Promotion" : "Demotion"}: ${fromLeague.displayName} → ${toLeague.displayName}`}{" "}
            · Player energy is unchanged.
          </p>
        </div>
        <label>
          {operation==="result"?"Reason for correction":operation==="reopen"?"Reason for returning the work":"Validation notes"}
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            placeholder={operation==="result"?"Explain why the actual stars should change…":"Explain what you checked in the submitted work…"}
          />
        </label>
        <label className="result-review-confirm">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            disabled={busy}
          />{" "}
          I reviewed this player's submitted evidence for this level.
        </label>
        <button
          className="btn primary"
          disabled={
            busy ||
            !canWrite ||
            locked ||
            !reviewed ||
            !submitted ||
            (operation === "validate" && !row?.result?.completed)
          }
        >
          {busy ? "Saving review…" : operation==="validate"?currentValidation?"Revalidate result and notify":"Validate result and notify":operation==="result"?"Save corrected result and notify":"Return for revision and notify"}
        </button>
        {!submitted && <p>Submitted evidence is required for this review.</p>}
        {!canWrite && (
          <p>
            Your delegated access permits viewing only. Ask Centre Command for
            result-editing permission.
          </p>
        )}
        {locked && (
          <p>
            Results are locked. Centre Command must authorise a correction
            before editing.
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
      {row?.overrideHistory?.length > 0 && (
        <details>
          <summary>Previous result decisions</summary>
          <ol>{row.overrideHistory.map((entry,index)=>{const previous=entry.result || entry;return <li key={index}><strong>Previous result: {previous.completed?`${previous.stars}/3 stars`:"Incomplete"}</strong><p>{entry.reason}</p><small>{entry.actorId} · {weekTime(entry.at)}</small></li>;})}</ol>
        </details>
      )}
      </aside>
    </div>
  );
}
