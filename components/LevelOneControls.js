"use client";
import { useState } from "react";
import { levelOneReward } from "@/lib/level-one-rules.js";

export default function LevelOneControls({ data, act, initialUserId = "" }) {
  const [target, setTarget] = useState(
    initialUserId ? `member:${initialUserId}` : "",
  );
  const [operation, setOperation] = useState("result");
  const [stars, setStars] = useState(3);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const targets = data.dayOne?.levelOneTargets;
  if (
    !targets ||
    !["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(data.user.role)
  )
    return null;
  const kind = target.split(":")[0];
  // IDs can contain colons. The prefix is the only delimiter we own.
  const targetId = target.slice(target.indexOf(":") + 1);
  const members = targets.members.filter((p) =>
    kind === "team" ? p.teamId === targetId : p._id === targetId,
  );
  const records = members.map((p) =>
    data.dayOne.records.find((r) => r.userId === p._id),
  );
  const missing = records.some((r) => !r);
  return (
    <section className="level-one-controls" aria-label="Level 1 staff controls">
      <h3>Level 1 · Results and replay</h3>
      <p>
        Changes are audited. Rewards are adjusted by the difference, with 5 XP
        per trophy. Replay keeps the previous reward and question.
      </p>
      <form
        className="field-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const response = await act(
              "day1/level-result",
              {
                ...(kind === "team"
                  ? { teamId: targetId }
                  : { userId: targetId }),
                operation,
                stars,
                reason,
                members: members.map((p) => p._id),
                versions: Object.fromEntries(
                  records.filter(Boolean).map((r) => [r.userId, r.version]),
                ),
              },
              "Level 1 results updated.",
            );
            if (!response)
              throw Error(
                "Nothing was confirmed. Refresh the results and retry.",
              );
            setMessage(
              `Saved for ${response.affected} ${response.affected === 1 ? "member" : "members"}.`,
            );
            setReason("");
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Member or team
          <select
            required
            value={target}
            disabled={busy}
            onChange={(e) => {
              setTarget(e.target.value);
              setMessage("");
            }}
          >
            <option value="">Select a member or team</option>
            <optgroup label="Members">
              {targets.members.map((p) => (
                <option key={p._id} value={`member:${p._id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Teams">
              {targets.teams.map((t) => (
                <option key={t._id} value={`team:${t._id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          Action
          <select
            value={operation}
            disabled={busy}
            onChange={(e) => setOperation(e.target.value)}
          >
            <option value="result">Complete level / change stars</option>
            <option value="reopen">
              Reopen · revoke completion and level rewards
            </option>
            <option value="replay">Allow replay · keep previous rewards</option>
          </select>
        </label>
        {operation === "result" && (
          <label>
            Stars
            <select
              value={stars}
              disabled={busy}
              onChange={(e) => setStars(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "star" : "stars"} ·{" "}
                  {levelOneReward(n).trophies} trophies / {levelOneReward(n).xp}{" "}
                  XP
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Reason
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {!!members.length && (
          <div className="level-one-affected">
            <strong>Affected members ({members.length})</strong>
            {members.map((p, i) => (
              <p key={p._id}>
                {p.name} ·{" "}
                {records[i]
                  ? records[i].levelOne?.result?.completed
                    ? `${records[i].levelOne.result.stars} stars`
                    : "Not complete"
                  : "Must enter Level 1 first"}
              </p>
            ))}
          </div>
        )}
        {missing && (
          <p>
            All selected members must enter the game before you can change their Level
            1 results.
          </p>
        )}
        {operation === "replay" && data.dayOne.state !== "OPEN" && (
          <p>Open Day 1 before allowing a replay.</p>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={
            busy ||
            !members.length ||
            missing ||
            (operation === "replay" && data.dayOne.state !== "OPEN")
          }
        >
          {busy
            ? "Saving…"
            : `Confirm for ${members.length} ${members.length === 1 ? "member" : "members"}`}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
