"use client";
import { useState } from "react";
import { levelReward } from "@/lib/week-one-level-rules.js";
import { WeekPanel, Evidence, weekTime } from "./WeekOneShared";
import DayOneReviewEvidence from "./DayOneReviewEvidence";
import GameChoices from "./GameChoices";
import { LeagueBadge } from "./TrophyLeague";
import { Avatar } from "./ui";
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
  const [userId, setUserId] = useState("");
  const [day, setDay] = useState(1);
  const [search, setSearch] = useState("");
  const p = data.weekOneProgram;
  const members = p.levelTargets?.members || [];
  if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(data.user.role))
    return null;
  const first = data.dayOne?.records.find((r) => r.userId === userId);
  const row =
    day === 1
      ? first?.levelOne
      : p.levelResults.find((r) => r.userId === userId && r.day === day);
  const attempts = p.attempts.filter(
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
    <WeekPanel title="Review a player's result">
      <p>
        Choose a player and level. Inspect the submitted work, then validate the
        current stars or record a correction. Every decision keeps the reviewer,
        reason and previous result.
      </p>
      {!members.length && (
        <p>
          No players are assigned to your review scope. Ask Centre Command to
          check your team assignments.
        </p>
      )}
      <div className="crew-dossiers">
        <label className="crew-search">
          Find a player
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your crew"
          />
        </label>
        <div className="crew-dossier-list" aria-label="Choose a player dossier">
          {members
            .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
            .map((m) => (
              <button
                key={m._id}
                className={`crew-dossier ${userId === m._id ? "is-selected" : ""}`}
                onClick={() => setUserId(m._id)}
                aria-pressed={userId === m._id}
                aria-label={`Review ${m.name}`}
              >
                <Avatar name={m.name} small />
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {userId === m._id ? "DOSSIER OPEN" : "OPEN DOSSIER"}
                  </small>
                </span>
                <LeagueBadge trophies={m.trophies} />
              </button>
            ))}
        </div>
        {members.length > 0 &&
          !members.some((m) =>
            m.name.toLowerCase().includes(search.toLowerCase()),
          ) && <p>No matching crew members.</p>}
      </div>
      <GameChoices
        label="Flight level"
        value={day}
        onChange={(value) => setDay(Number(value))}
        options={[1, 2, 3, 4, 5].map((d) => ({
          value: d,
          label: `Level ${d}`,
        }))}
      />
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
    <>
      <h3>
        {row?.result?.completed
          ? `Current result: ${row.result.stars}/3 stars`
          : "Current result: incomplete"}
      </h3>
      {validation && (
        <p>
          {currentValidation
            ? "Human review recorded"
            : "Previous human review — work or result has changed"}{" "}
          · {validation.role} · {validation.actorId} · {weekTime(validation.at)}
          <br />
          {validation.reason}
        </p>
      )}
      {day === 1 ? (
        first ? (
          <>
            <DayOneReviewEvidence
              record={first}
              canVerify
              formatDate={weekTime}
            />
            <h4>Independent claim check</h4>
            <Evidence
              value={readable(
                first.claimCheck ||
                  first.claimCheckDraft || { status: "No claim check saved" },
              )}
            />
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
      <form
        className="field-form"
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
                ? "Player result validated."
                : "Reviewed player result updated.",
            );
            if (!response)
              throw Error(
                "Result was not saved. Review any error, refresh and try again.",
              );
            setMessage(
              "Review saved. Rewards were reconciled without spending player energy.",
            );
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <GameChoices
          label="Review decision"
          value={operation}
          onChange={setOperation}
          disabled={busy}
          options={[
            {
              value: "validate",
              label: "Validate",
              description: "Keep the earned stars",
            },
            {
              value: "result",
              label: "Correct result",
              description: "Set the reviewed stars",
            },
            {
              value: "reopen",
              label: "Return for revision",
              description: "Revoke completion and rewards",
            },
          ]}
        />
        {operation === "result" && (
          <GameChoices
            label="Corrected stars"
            value={stars}
            onChange={(value) => setStars(Number(value))}
            disabled={busy}
            options={[1, 2, 3].map((n) => ({
              value: n,
              label: `${n} ${n === 1 ? "star" : "stars"}`,
              description: `${levelReward(n, day).trophies} trophies · ${levelReward(n, day).xp} XP`,
            }))}
          />
        )}
        <div
          className="result-impact"
          aria-label="Result reward and league impact"
        >
          <span className="game-kicker">DECISION PREVIEW</span>
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
          Evidence review and reason
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
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
          {busy ? "Saving review…" : "Save reviewed result"}
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
          <Evidence value={readable({ history: row.overrideHistory })} />
        </details>
      )}
    </>
  );
}
