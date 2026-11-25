"use client";
import { useEffect, useState, useRef } from "react";
import fetch from "@/lib/college-fetch.js";
import { WeekPanel, weekTime } from "./WeekOneShared";

// Historical receipts stay readable. There are no warning/deduction controls.
export default function TrophyConduct({ data, act }) {
  const cc = data.user.role === "CENTRE_COMMAND",
    own = data.user.role === "GAMER";
  const [state, setState] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [originalId, setOriginalId] = useState(""),
    [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState("");
  const key = useRef(null);
  async function load() {
    try {
      const response = await fetch("/api/trophies/conduct", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setState(result);
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
  }, [data.user._id, data.user.trophies]);
  useEffect(() => {
    key.current = null;
  }, [originalId, reason, evidence]);
  if (!state) return error ? <p role="alert">{error}</p> : null;
  if (!state.decisions.length) return null;
  const restored = new Set(
    state.decisions
      .filter((row) => row.action === "RESTORE")
      .map((row) => row.originalId),
  );
  const original = state.decisions.find((row) => row._id === originalId),
    player = state.players.find((p) => p._id === original?.userId);
  return (
    <details className="game-rule-disclosure">
      <summary>
        {own
          ? "Your historical trophy records"
          : "Historical trophy records and reversals"}
      </summary>
      <WeekPanel title="Historical trophy records">
        <p>
          Conduct trophy penalties have been removed. These older receipts
          remain for audit; CC can reverse an outstanding historical deduction.
        </p>
        {error && <p role="alert">{error}</p>}
        {cc && state.decisions.some((row)=>row.action === "DEDUCT" && !restored.has(row._id)) && (
          <form
            className="field-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!original || !player || busy) return;
              setBusy(true);
              setError("");
              key.current ||= crypto.randomUUID();
              try {
                const result = await act(
                  "trophies/conduct",
                  {
                    action: "RESTORE",
                    userId: player._id,
                    originalId,
                    eventKey: key.current,
                    reason,
                    evidence,
                    balanceBefore: player.trophies,
                    balanceVersion: player.trophyConductRevision || 0,
                  },
                  "Historical deduction reversed.",
                );
                if (!result)
                  throw Error(
                    "Reversal not confirmed. Entries are kept; reload the receipts before retrying.",
                  );
                setOriginalId("");
                setReason("");
                setEvidence("");
                await load();
              } catch (error) {
                setError(error.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Historical deduction to reverse
              <select
                required
                value={originalId}
                onChange={(event) => setOriginalId(event.target.value)}
                disabled={busy}
              >
                <option value="">
                  Choose an outstanding historical deduction
                </option>
                {state.decisions
                  .filter(
                    (row) => row.action === "DEDUCT" && !restored.has(row._id),
                  )
                  .map((row) => (
                    <option key={row._id} value={row._id}>
                      {state.players.find((p) => p._id === row.userId)?.name ||
                        "Player"}{" "}
                      · {row.incidentRef} · {row.amount} trophies
                    </option>
                  ))}
              </select>
            </label>
            {original && (
              <>
                <label>
                  Reversal reason
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Evidence and reference
                  <textarea
                    required
                    minLength={20}
                    maxLength={4000}
                    value={evidence}
                    onChange={(event) => setEvidence(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <p>
                  Restore exactly {-original.amount} trophies. XP and energy
                  stay unchanged.
                </p>
                <button className="btn primary" disabled={busy}>
                  {busy ? "Restoring…" : "Reverse historical deduction"}
                </button>
              </>
            )}
          </form>
        )}
        {state.decisions.map((row) => (
          <details className="game-rule-disclosure" key={row._id}>
            <summary>
              {row.action === "WARNING"
                ? "Historical warning — no trophy loss"
                : `${row.amount > 0 ? "+" : ""}${row.amount} trophies`}{" "}
              ·{" "}
              {row.action === "RESTORE"
                ? "Historical deduction reversal"
                : row.incidentRef}{" "}
              · {weekTime(row.createdAt)}
            </summary>
            <p>{row.reason}</p>
            <p>{row.evidence}</p>
            <p>
              {row.before} → {row.after} trophies · {row.actorRole}
              {restored.has(row._id) ? " · Reversed" : ""}
            </p>
          </details>
        ))}
      </WeekPanel>
    </details>
  );
}
