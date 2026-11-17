"use client";
import { useState } from "react";
import { levelReward } from "@/lib/week-one-level-rules.js";
export default function WeekOneLevelControls({ data, act }) {
  const [day, setDay] = useState(2),
    [target, setTarget] = useState(""),
    [operation, setOperation] = useState("result"),
    [stars, setStars] = useState(3),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const p = data.weekOneProgram,
    targets = p.levelTargets;
  if (
    !targets ||
    !["MISSION_COMMANDER", "CENTRE_COMMAND"].includes(data.user.role)
  )
    return null;
  const team = target.startsWith("team:"),
    id = target.slice(target.indexOf(":") + 1);
  const members = targets.members.filter((m) =>
    team ? m.teamId === id : m._id === id,
  );
  const rows = members.map((m) =>
    p.levelResults?.find((r) => r.userId === m._id && r.day === day),
  );
  return (
    <section
      className="level-one-controls"
      aria-label="Week 1 level results and replay"
    >
      <h3>Levels 2–5 · Stars, rewards and replay</h3>
      <p>
        Changes are audited. Replay keeps the best reward and archives the old
        work. Reopen revokes this level’s completion and reward. Level 1 keeps
        its existing controls in the Day 1 review.
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
              "week1/program/level-result",
              {
                day,
                ...(team ? { teamId: id } : { userId: id }),
                operation,
                stars,
                reason,
                members: members.map((m) => m._id),
                versions: Object.fromEntries(
                  members.map((m, i) => [m._id, rows[i]?.version || 0]),
                ),
              },
              "Level result saved.",
            );
            if (!response)
              throw Error("Result was not confirmed. Refresh and retry.");
            setMessage(`Saved for ${response.affected} members.`);
            setReason("");
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Level
          <select
            value={day}
            disabled={busy}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Member or team
          <select
            required
            disabled={busy}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Select a member or team</option>
            <optgroup label="Members">
              {targets.members.map((m) => (
                <option key={m._id} value={`member:${m._id}`}>
                  {m.name}
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
            disabled={busy}
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          >
            <option value="result">Complete level / change stars</option>
            <option value="reopen">Reopen · revoke this level’s reward</option>
            <option value="replay">Allow replay · keep best reward</option>
          </select>
        </label>
        {operation === "result" && (
          <label>
            Stars
            <select
              disabled={busy}
              value={stars}
              onChange={(e) => setStars(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} stars · {levelReward(n, day).trophies} trophies /{" "}
                  {levelReward(n, day).xp} XP
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
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {!!members.length && (
          <div className="level-one-affected">
            <strong>Affected members ({members.length})</strong>
            {members.map((m, i) => (
              <p key={m._id}>
                {m.name} ·{" "}
                {rows[i]?.result?.completed
                  ? `${rows[i].result.stars}/3 stars`
                  : "Not complete"}
                {rows[i]?.replayPending ? " · replay ready" : ""}
              </p>
            ))}
          </div>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !members.length || (p.locked && !p.correction)}
        >
          {busy ? "Saving…" : `Confirm for ${members.length} members`}
        </button>
        {p.locked && !p.correction && <p>Week 1 results are finalised.</p>}
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
