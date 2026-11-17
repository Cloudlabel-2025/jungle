"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Badge, Panel } from "./ui";
import { defaultSetup } from "@/lib/day-one-rules.js";
import {
  buildDayOneSetup,
  suggestedResearchGroups,
  preparedSetupMatches,
} from "@/lib/day-one-setup.js";

const RESEARCH = "research-2026-11-12";

export default function DayOneSetup({ data, act }) {
  const [feedback, setFeedback] = useState(null);
  const [opening, setOpening] = useState(false);
  const [dirty, setDirty] = useState(false);
  const d = data.dayOne;
  if (!d?.draft) return null;
  return (
    <Panel
      title="Day 1 setup"
      kicker="SCHEDULE / RESEARCH / READY TO PLAY"
      action={<Badge>{d.state}</Badge>}
      className="day-one-setup"
    >
      <div className="day-setup-body">
        <p className="day-setup-intro">
          Set the schedule and check your research groups. The game handles the
          scoring rules and research timer.
        </p>
        {feedback && (
          <p
            className={`day-setup-feedback ${feedback.error ? "is-error" : ""}`}
            role={feedback.error ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
        {data.weekOne.progressionMode === "COMPLETION" && (
          <p className="day-setup-feedback">
            Automatic progression is enabled. Preparing content makes it
            available to eligible players; no Open Day button is needed.
          </p>
        )}
        {data.weekOne.progressionMode !== "COMPLETION" &&
          d.state === "PREPARED" &&
          (!dirty && preparedSetupMatches(d.draft, d.preparedConfig) ? (
            <div className="day-setup-launch">
              <div>
                <strong>Day 1 is prepared.</strong>
                <p>Open it when you want players to enter Level 1.</p>
                {!data.weekOne.rulesVersion && (
                  <p>
                    <Link href="/centre-command/week-one-rules-approvals">
                      Publish Game Rules
                    </Link>{" "}
                    before opening Day 1.
                  </p>
                )}
              </div>
              <button
                className="btn primary"
                disabled={opening || !data.weekOne.rulesVersion}
                onClick={async () => {
                  setOpening(true);
                  try {
                    const result = await act(
                      "week1/open",
                      { day: 1, revision: data.weekOne.revision },
                      "Day 1 is live. Players can enter Level 1.",
                    );
                    if (result) setFeedback(null);
                    else
                      setFeedback({
                        error: true,
                        message:
                          "Day 1 could not open. Check the error and try again.",
                      });
                  } catch (error) {
                    setFeedback({
                      error: true,
                      message:
                        error.message ||
                        "Day 1 could not open. Please try again.",
                    });
                  } finally {
                    setOpening(false);
                  }
                }}
              >
                {opening ? "Opening…" : "Open Day 1"}
              </button>
            </div>
          ) : (
            <p className="day-setup-feedback">
              Your changes need to be prepared before Day 1 can open. Use
              Prepare updated setup below.
            </p>
          ))}
        {d.state === "OPEN" && (
          <p className="day-setup-feedback" role="status">
            Day 1 is live. Players can enter Level 1. The released schedule and
            questions are locked.
          </p>
        )}
        {d.state === "CLOSED" && (
          <p className="muted">
            Day 1 is closed. Its released content is kept for review.
          </p>
        )}
        <SetupForm
          key={d.revision}
          data={data}
          act={act}
          report={(feedback) => {
            setFeedback(feedback);
            if (!feedback) setDirty(true);
            else if (!feedback.error) setDirty(false);
          }}
        />
      </div>
    </Panel>
  );
}

function SetupForm({ data, act, report }) {
  const d = data.dayOne;
  const locked = ["OPEN", "CLOSED"].includes(d.state);
  const base = locked ? d.preparedConfig || d.config || d.draft : d.draft;
  const roster = d.roster || [];
  const [values, setValues] = useState({
    day: base.day || "",
    startTime: base.startTime || "09:00",
    endTime: base.endTime || "17:00",
    selectionMode: base.selectionMode || (base.version ? "legacy" : RESEARCH),
  });
  const [groups, setGroups] = useState(() =>
    suggestedResearchGroups(roster, base.researchGroups),
  );
  const [reviewed, setReviewed] = useState(Boolean(base.bankApproval));
  const [legacyQuestions, setLegacyQuestions] = useState(() =>
    base.genres?.length === 4 ? base.genres : defaultSetup().genres,
  );
  const [editingGroups, setEditingGroups] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const research = values.selectionMode === RESEARCH;
  const change = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    report(null);
  };
  const nameOf = (id) => roster.find((p) => p._id === id)?.name || id;
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending.current || locked) return;
        const preparing = event.nativeEvent.submitter?.value === "prepare";
        // Read committed native date/time values before disabling the form.
        const fields = new FormData(event.currentTarget);
        const submitted = Object.fromEntries(
          ["day", "startTime", "endTime", "selectionMode"].map((key) => [
            key,
            String(fields.get(key) || ""),
          ]),
        );
        const submittedGroups = editingGroups
          ? groups.map((_, i) => ({
              members: roster
                .filter((p) => Number(fields.get(`group:${p._id}`)) === i)
                .map((p) => p._id),
            }))
          : groups;
        const submittedLegacy = legacyQuestions.map((g, i) => ({
          ...g,
          name: String(fields.get(`genre:${i}`) ?? g.name),
          question: String(fields.get(`question:${i}`) ?? g.question),
        }));
        setValues(submitted);
        pending.current = true;
        setBusy(true);
        report(null);
        try {
          const config = buildDayOneSetup(
            submitted.selectionMode === RESEARCH
              ? base
              : { ...base, genres: submittedLegacy },
            {
              ...submitted,
              groups: submittedGroups,
              roster,
              reviewed: fields.get("reviewed") === "on",
              preparing,
            },
          );
          const result = await act(
            `day1/${preparing ? "release" : "save-setup"}`,
            { config, revision: d.revision },
            preparing
              ? "Day 1 prepared. Open it when you are ready."
              : "Draft saved. Day 1 has not opened yet.",
          );
          report(
            result
              ? {
                  message: preparing
                    ? "Prepared successfully. Use Open Day 1 above to let players in."
                    : "Draft saved. Players cannot enter until you prepare and open Day 1.",
                }
              : {
                  error: true,
                  message:
                    "Not saved. Check the error and try again. Your entries are still here.",
                },
          );
        } catch (error) {
          report({ error: true, message: error.message });
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || locked}>
        <legend className="sr-only">Day 1 schedule and research</legend>
        <div className="day-setup-schedule">
          <label>
            Day 1 date
            <input
              type="date"
              name="day"
              required
              defaultValue={values.day}
              onInput={(e) => change("day", e.target.value)}
            />
          </label>
          <label>
            Start time
            <input
              type="time"
              name="startTime"
              required
              defaultValue={values.startTime}
              onInput={(e) => change("startTime", e.target.value)}
            />
          </label>
          <label>
            Finish time
            <input
              type="time"
              name="endTime"
              required
              defaultValue={values.endTime}
              onInput={(e) => change("endTime", e.target.value)}
            />
          </label>
        </div>
        <p className="day-setup-note">
          Times use {base.timeZone || "Asia/Kolkata"}. Clock-in closes 30
          minutes after the start. Research lasts 90 minutes; submissions and
          reflections close at the finish time.
        </p>
        <label className="day-setup-mode">
          Research game
          <select
            name="selectionMode"
            value={values.selectionMode}
            onChange={(e) => change("selectionMode", e.target.value)}
          >
            <option value={RESEARCH}>
              Seven genre cards · choose one of three questions
            </option>
            <option value="legacy">
              Four configured questions · existing game
            </option>
          </select>
        </label>
        {research ? (
          <>
            <div className="day-setup-group-heading">
              <div>
                <h3>Five-person research groups</h3>
                <p>
                  {roster.length} players · separate from final expedition teams
                </p>
              </div>
              <button
                type="button"
                className="btn small"
                aria-expanded={editingGroups}
                onClick={() => setEditingGroups((v) => !v)}
              >
                {editingGroups ? "Done editing" : "Edit groups"}
              </button>
            </div>
            <div className="day-setup-groups">
              {groups.map((g, i) => (
                <section key={i} aria-label={`Research group ${i + 1}`}>
                  <h4>
                    Group {i + 1}
                    <span className={g.members.length === 5 ? "" : "is-error"}>
                      {g.members.length}/5
                    </span>
                  </h4>
                  <p>{g.members.map(nameOf).join(", ") || "No players yet"}</p>
                </section>
              ))}
            </div>
            {editingGroups && (
              <div className="day-setup-group-editor">
                {roster.map((p) => (
                  <label key={p._id}>
                    {p.name}
                    <select
                      name={`group:${p._id}`}
                      aria-label={`Research group for ${p.name}`}
                      value={groups.findIndex((g) => g.members.includes(p._id))}
                      onChange={(e) => {
                        const target = Number(e.target.value);
                        setGroups((previous) =>
                          previous.map((g, i) => ({
                            members:
                              i === target
                                ? [
                                    ...g.members.filter((id) => id !== p._id),
                                    p._id,
                                  ]
                                : g.members.filter((id) => id !== p._id),
                          })),
                        );
                        report(null);
                      }}
                    >
                      {groups.map((_, i) => (
                        <option key={i} value={i}>
                          Group {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="day-setup-bank">
              <button
                className="btn small"
                type="button"
                onClick={async () => {
                  const bank = await act(
                    "day1/research-bank",
                    {},
                    "Question bank ready for review.",
                  );
                  if (!bank) return;
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(bank, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "vow-research-questions.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download questions to review
              </button>
              <label>
                <input
                  type="checkbox"
                  name="reviewed"
                  checked={reviewed}
                  onChange={(e) => {
                    setReviewed(e.target.checked);
                    report(null);
                  }}
                />
                I have reviewed all 51 questions for this cohort.
              </label>
            </div>
          </>
        ) : (
          <details className="day-setup-legacy">
            <summary>Edit the four existing questions</summary>
            <p>
              The saved questions are retained. Use the seven-genre game for the
              new research flow.
            </p>
            {legacyQuestions.map((g, i) => (
              <div key={g.id}>
                <label>
                  Genre {i + 1}
                  <input
                    name={`genre:${i}`}
                    value={g.name}
                    onChange={(e) => {
                      setLegacyQuestions((q) =>
                        q.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      );
                      report(null);
                    }}
                  />
                </label>
                <label>
                  Question {i + 1}
                  <textarea
                    rows={3}
                    name={`question:${i}`}
                    value={g.question}
                    onChange={(e) => {
                      setLegacyQuestions((q) =>
                        q.map((x, j) =>
                          j === i ? { ...x, question: e.target.value } : x,
                        ),
                      );
                      report(null);
                    }}
                  />
                </label>
              </div>
            ))}
          </details>
        )}
        {!locked && (
          <div className="day-setup-actions">
            <button
              className="btn"
              type="submit"
              value="draft"
              formNoValidate
              disabled={busy}
            >
              Save draft
            </button>
            <button
              className="btn primary"
              type="submit"
              value="prepare"
              disabled={busy}
            >
              {busy
                ? "Saving…"
                : d.state === "PREPARED"
                  ? "Prepare updated setup"
                  : "Prepare Day 1"}
            </button>
            <p>
              Preparing checks the setup. Players enter only after you open Day
              1.
            </p>
          </div>
        )}
      </fieldset>
      <p className="day-setup-footer">
        <Link href="/centre-command/week-one">
          Command Centre & day releases
        </Link>{" "}
        · Assessment rules and reward limits stay unchanged.
      </p>
    </form>
  );
}
