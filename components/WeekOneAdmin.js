"use client";
import { useState, useEffect } from "react";
import { Badge, Form, Receipt } from "./ui";
import { DayOneGameSetup, DayOneCohort } from "./DayOneFeatures";
import WeekOneRelease from "./WeekOneRelease";
import { activities } from "@/lib/week-one-catalog.js";
import { emptyDayContent } from "@/lib/week-one-program-rules.js";
import {
  WeekPanel,
  WeekForm,
  runProgram,
  textField,
  weekTime,
  JsonImport,
  downloadJson,
  Evidence,
  ResultCard,
} from "./WeekOneShared";
export const personOptions = (data) =>
  data.weekOneProgram.results.map((r) => ({ value: r.userId, label: r.name }));
const nameOf = (data, id) =>
  data.weekOneProgram.results.find((r) => r.userId === id)?.name || id;

function DayEditor({ day, data, act }) {
  const original = data.dayOne?.config;
  const initial = day.draft || emptyDayContent(day.day);
  if (
    day.day === 5 &&
    original &&
    !day.draft?.activities
      ?.find((a) => a.id === "D5-F01")
      ?.variants?.some((v) => v.id === original.genres[0].id)
  )
    initial.activities.find((a) => a.id === "D5-F01").variants =
      original.genres.map((g) => ({
        id: g.id,
        name: g.name,
        brief: g.question,
        reference: "",
      }));
  const [content, setContent] = useState(initial);
  useEffect(() => {
    if (day.day !== 5 || !original) return;
    setContent((c) => ({
      ...c,
      activities: c.activities.map((a) =>
        a.id !== "D5-F01"
          ? a
          : {
              ...a,
              variants: original.genres.map((g) => ({
                id: g.id,
                name: g.name,
                brief: g.question,
                reference:
                  a.variants.find((v) => v.id === g.id)?.reference || "",
              })),
            },
      ),
    }));
  }, [day.day, original?.version]);
  const set = (key, value) => setContent((c) => ({ ...c, [key]: value }));
  function changeActivity(index, mutate) {
    setContent((c) => ({
      ...c,
      activities: c.activities.map((a, i) => (i === index ? mutate(a) : a)),
    }));
  }
  const locked = ["OPEN", "CLOSED"].includes(day.state);
  return (
    <WeekPanel
      title={`Day ${day.day} · ${day.title}`}
      action={<Badge>{day.state}</Badge>}
    >
      <p>
        Curriculum owners supply approved scenarios, references, alternatives,
        and questions. Existing attempts retain their released version.
      </p>
      <JsonImport
        title="Import an approved curriculum pack"
        onImport={(value) => {
          if (!locked) setContent(value);
        }}
      />
      <button
        className="btn small"
        onClick={() =>
          downloadJson(content, `codewild-day-${day.day}-content.json`)
        }
      >
        Download this content pack
      </button>
      <fieldset
        disabled={locked}
        style={{ border: 0, padding: 0, minWidth: 0, display: "grid", gap: 18 }}
      >
        {[
          ["officialStart", "Official start (ISO with time-zone offset)"],
          ["closingCutoff", "Scheduled end (ISO with time-zone offset)"],
          ["timeZone", "IANA time zone"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={content[key] || ""}
              onChange={(e) => set(key, e.target.value)}
            />
          </label>
        ))}
        {content.activities.map((a, i) => (
          <details key={a.id}>
            <summary>
              {activities.find((v) => v.id === a.id)?.name || a.id}
            </summary>
            <label>
              Rubric version
              <input
                value={a.rubricVersion}
                onChange={(e) =>
                  changeActivity(i, (a) => ({
                    ...a,
                    rubricVersion: e.target.value,
                  }))
                }
              />
            </label>
            {a.id === "D5-Q01"
              ? a.questions.map((q, qi) => (
                  <fieldset key={q.id}>
                    <legend>Question {qi + 1}</legend>
                    <label>
                      Question
                      <textarea
                        value={q.question}
                        onChange={(e) =>
                          changeActivity(i, (a) => ({
                            ...a,
                            questions: a.questions.map((v, j) =>
                              j === qi ? { ...v, question: e.target.value } : v,
                            ),
                          }))
                        }
                      />
                    </label>
                    {q.options.map((option, oi) => (
                      <label key={oi}>
                        Option {oi + 1}
                        <input
                          value={option}
                          onChange={(e) =>
                            changeActivity(i, (a) => ({
                              ...a,
                              questions: a.questions.map((v, j) =>
                                j === qi
                                  ? {
                                      ...v,
                                      options: v.options.map((o, k) =>
                                        k === oi ? e.target.value : o,
                                      ),
                                    }
                                  : v,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Correct option
                      <select
                        value={q.correct}
                        onChange={(e) =>
                          changeActivity(i, (a) => ({
                            ...a,
                            questions: a.questions.map((v, j) =>
                              j === qi
                                ? { ...v, correct: Number(e.target.value) }
                                : v,
                            ),
                          }))
                        }
                      >
                        {q.options.map((_, j) => (
                          <option key={j} value={j}>
                            Option {j + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>
                ))
              : a.variants.map((v, vi) => (
                  <fieldset key={v.id}>
                    <legend>{v.name}</legend>
                    {[
                      ["brief", "Scenario and source clues"],
                      [
                        "reference",
                        "Private reference answer and valid alternatives",
                      ],
                    ].map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <textarea
                          rows={5}
                          value={v[key]}
                          readOnly={day.day === 5 && key === "brief"}
                          onChange={(e) =>
                            changeActivity(i, (a) => ({
                              ...a,
                              variants: a.variants.map((v, j) =>
                                j === vi ? { ...v, [key]: e.target.value } : v,
                              ),
                            }))
                          }
                        />
                      </label>
                    ))}
                    {a.id === "D3-G02" && (
                      <label>
                        Component cards (one per line)
                        <textarea
                          value={(v.cards || []).join("\n")}
                          onChange={(e) =>
                            changeActivity(i, (a) => ({
                              ...a,
                              variants: a.variants.map((v, j) =>
                                j === vi
                                  ? {
                                      ...v,
                                      cards: e.target.value
                                        .split("\n")
                                        .filter(Boolean),
                                    }
                                  : v,
                              ),
                            }))
                          }
                        />
                      </label>
                    )}
                  </fieldset>
                ))}
          </details>
        ))}
        {day.day < 5 && (
          <>
            <label>
              Daily Discovery title
              <input
                value={content.discovery?.title || ""}
                onChange={(e) =>
                  set("discovery", {
                    ...content.discovery,
                    title: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Daily Discovery brief
              <textarea
                value={content.discovery?.brief || ""}
                onChange={(e) =>
                  set("discovery", {
                    ...content.discovery,
                    brief: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Midday nudge (ISO with time-zone offset)
              <input
                value={content.nudgeAt || ""}
                onChange={(e) => set("nudgeAt", e.target.value)}
              />
            </label>
          </>
        )}
        <div className="button-row">
          <button
            className="btn"
            onClick={() =>
              runProgram(act, "save-day", { day: day.day, content })
            }
          >
            Save draft
          </button>
          <button
            className="btn primary"
            onClick={() =>
              runProgram(act, "prepare-day", { day: day.day, content })
            }
          >
            Validate and prepare hidden content
          </button>
        </div>
      </fieldset>
    </WeekPanel>
  );
}
function Settings({ data, act }) {
  const p = data.weekOneProgram,
    s = p.settings,
    [slots, setSlots] = useState(s.rescueSlots);
  const awards = s.awardDefinitions.length
    ? s.awardDefinitions
    : Array.from({ length: 13 }, (_, i) => ({
        id: `award-${i + 1}`,
        name: "",
        rule: "",
        category: i < 5 ? "SKILL" : "GROWTH",
      }));
  return (
    <>
      <WeekPanel title="Organisation scoring settings">
        <p>
          Weights sum to 100. They are versioned and locked when the cohort
          starts.
        </p>
        <fieldset
          disabled={data.weekOne.days.some((d) =>
            ["OPEN", "CLOSED"].includes(d.state),
          )}
          style={{ border: 0, padding: 0 }}
        >
          <Form
            fields={[
              { name: "calendarTimeZone", label: "Working calendar time zone" },
              {
                name: "calendarStart",
                label: "Working start (minutes after local midnight)",
                type: "number",
                min: 0,
                max: 960,
                step: 1,
              },
              {
                name: "weekdays",
                label: "Working weekdays (0=Sunday, comma separated)",
              },
              {
                name: "holidays",
                label: "Holiday dates (YYYY-MM-DD, comma separated)",
                optional: true,
              },
              ...Object.keys(s.weights).map((key) => ({
                name: key,
                label: `${key} maximum marks`,
                type: "number",
                min: 0,
                max: 100,
              })),
              ...["clearance", "distinction", "specialist"].map((key) => ({
                name: key,
                label: `${key} threshold`,
                type: "number",
                min: 0,
                max: 100,
              })),
            ]}
            initial={{
              ...s.weights,
              calendarTimeZone: s.calendar.timeZone,
              calendarStart: s.calendar.startMinute,
              weekdays: s.calendar.weekdays.join(","),
              holidays: s.calendar.holidays.join(","),
              clearance: s.clearance,
              distinction: s.distinction,
              specialist: s.specialist,
            }}
            submit="Save scoring settings"
            onSubmit={(v) =>
              runProgram(act, "settings", {
                version: p.version,
                settings: {
                  ...s,
                  calendar: {
                    timeZone: v.calendarTimeZone,
                    startMinute: v.calendarStart,
                    weekdays: v.weekdays.split(",").map(Number),
                    holidays: v.holidays
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  },
                  weights: Object.fromEntries(
                    Object.keys(s.weights).map((key) => [key, v[key]]),
                  ),
                  clearance: v.clearance,
                  distinction: v.distinction,
                  specialist: v.specialist,
                },
              })
            }
          />
        </fieldset>
      </WeekPanel>
      <WeekPanel title="Compass Check, awards and Saturday scheduling">
        <p>
          Supply the institution's three Compass prompts, five Skill and eight
          Growth award definitions.{" "}
          {p.recovery?.policy
            ? "The approved shared Saturday recovery programme is configured above."
            : "Historical cohorts may configure approved one-hour Saturday slots below."}
        </p>
        <Form
          key={s.version}
          fields={[
            ...[0, 1, 2].map((i) =>
              textField(`compass${i}`, `Compass Check prompt ${i + 1}`, true),
            ),
            ...awards.flatMap((a, i) => [
              {
                name: `awardName${i}`,
                label: `${a.category === "SKILL" ? "Skill Excellence" : "Growth / Discovery"} award ${i < 5 ? i + 1 : i - 4} name`,
                optional: true,
              },
              {
                ...textField(
                  `awardRule${i}`,
                  "Selection rule and required evidence",
                  true,
                ),
              },
            ]),
            textField("reason", "Approval reference and reason"),
          ]}
          initial={{
            ...Object.fromEntries(
              [0, 1, 2].map((i) => [
                `compass${i}`,
                s.compassQuestions[i] || "",
              ]),
            ),
            ...Object.fromEntries(
              awards.flatMap((a, i) => [
                [`awardName${i}`, a.name],
                [`awardRule${i}`, a.rule],
              ]),
            ),
          }}
          submit="Save approved operational content"
          onSubmit={(v) =>
            runProgram(act, "operations", {
              version: p.version,
              compassQuestions: [v.compass0, v.compass1, v.compass2].some(
                Boolean,
              )
                ? [v.compass0, v.compass1, v.compass2]
                : [],
              awardDefinitions: awards.some((_, i) => v[`awardName${i}`])
                ? awards.map((a, i) => ({
                    ...a,
                    name: v[`awardName${i}`],
                    rule: v[`awardRule${i}`],
                  }))
                : [],
              rescueSlots: slots,
              reason: v.reason,
            })
          }
        >
          {!p.recovery?.policy && (
            <>
              <h3>Approved Saturday slots</h3>
              {slots.map((slot, i) => (
                <fieldset key={slot.id}>
                  <legend>Slot {i + 1}</legend>
                  {[
                    ["start", "Start (ISO with time-zone offset)"],
                    ["end", "End (exactly one hour later)"],
                    ["meetingUrl", "Approved online meeting URL"],
                    ["approval", "College approval reference"],
                    ["capacity", "Learner capacity"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type={key === "capacity" ? "number" : "text"}
                        value={slot[key]}
                        onChange={(e) =>
                          setSlots((rows) =>
                            rows.map((s, j) =>
                              j === i
                                ? {
                                    ...s,
                                    [key]:
                                      key === "capacity"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }
                                : s,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setSlots((s) => s.filter((_, j) => j !== i))}
                  >
                    Remove slot
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setSlots((s) => [
                    ...s,
                    {
                      id: `slot-${Date.now()}`,
                      start: "",
                      end: "",
                      meetingUrl: "",
                      approval: "",
                      capacity: 1,
                    },
                  ])
                }
              >
                Add approved slot
              </button>
            </>
          )}
        </Form>
      </WeekPanel>
    </>
  );
}
export function Configuration({ data, act }) {
  const p = data.weekOneProgram;
  return (
    <>
      <details>
        <summary>Provision 25 Gamers and a Mission Commander</summary>
        <ProvisionAccounts act={act} />
      </details>
      <details>
        <summary>Organisation settings and operational content</summary>
        <Settings data={data} act={act} />
      </details>
      <DayOneGameSetup data={data} act={act} />
      {[2, 3, 4, 5].map((number) => {
        const day = p.days.find((d) => d.day === number) || {
          day: number,
          title: ["", "", "Explore", "STORY IT!", "FIRE IT!", "Prove"][number],
          state: "DRAFT",
        };
        return (
          <details key={number}>
            <summary>
              Configure Day {number} · {day.title}
            </summary>
            <DayEditor day={day} data={data} act={act} />
          </details>
        );
      })}
    </>
  );
}
function ProvisionAccounts({ act }) {
  const [pack, setPack] = useState(null),
    [reset, setReset] = useState(false);
  return (
    <WeekPanel title="Cohort account provisioning">
      <p>
        Import a private JSON file with an accounts list of 25 Gamers and one
        commander object. Each account needs name, email, username and password.
        New Gamer accounts have no permanent team leader or team assignment.
        Passwords are hashed on the server and omitted from audit records.
      </p>
      <JsonImport
        title="Import private account file"
        onImport={(value) => {
          if (
            !Array.isArray(value.accounts) ||
            value.accounts.length !== 25 ||
            !value.commander
          )
            throw new Error("Supply 25 accounts and one commander object.");
          setPack(value);
          setReset(false);
        }}
      />
      {pack && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...pack.accounts.map((a) => ({ ...a, role: "Gamer" })),
                  { ...pack.commander, role: "Mission Commander" },
                ].map((a, i) => (
                  <tr key={i}>
                    <td>{a.name}</td>
                    <td>{a.username}</td>
                    <td>{a.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            <input
              type="checkbox"
              checked={reset}
              onChange={(e) => setReset(e.target.checked)}
            />{" "}
            I authorise resetting existing credentials for these exact accounts.
          </label>
          <button
            className="btn primary"
            onClick={async () => {
              const result = await runProgram(act, "provision", {
                ...pack,
                confirmCredentialReset: reset,
              });
              if (result !== false) setPack(null);
            }}
          >
            Provision the reviewed cohort accounts
          </button>
        </>
      )}
    </WeekPanel>
  );
}
export function StaffAnnouncements({ data, act, now }) {
  return (
    <>
      <WeekOneRelease data={data} act={act} now={now} />
      {data.weekOneProgram.days
        .filter((d) => d.day > 1)
        .map((day) => (
          <WeekPanel key={day.day} title={`Day ${day.day} · Class recaps`}>
            {day.state === "OPEN" &&
              [1, 2].map((session) => (
                <div key={session}>
                  <p>
                    Class {session}:{" "}
                    {day.classes?.some((c) => c.session === session)
                      ? "Completed"
                      : "Awaiting completion"}
                  </p>
                  {!day.classes?.some((c) => c.session === session) && (
                    <button
                      className="btn"
                      onClick={() =>
                        runProgram(act, "complete-class", {
                          day: day.day,
                          session,
                        })
                      }
                    >
                      Mark class {session} completed
                    </button>
                  )}
                </div>
              ))}
            {day.recaps.map((r) => (
              <p key={r.session}>
                Class {r.session}: {r.text} · {weekTime(r.publishedAt)}
              </p>
            ))}
            {day.state === "OPEN" && (
              <WeekForm
                action="publish-recap"
                act={act}
                values={{ day: day.day }}
                fields={[
                  {
                    name: "session",
                    label: "Class session",
                    type: "number",
                    min: 1,
                    max: 2,
                  },
                  textField("text", "Post-class recap"),
                ]}
                submit="Publish recap and learner notice"
              />
            )}
          </WeekPanel>
        ))}
    </>
  );
}
export function Assessments({ data, act }) {
  const p = data.weekOneProgram,
    [selected, setSelected] = useState("D2-G01");
  const records = p.attempts.filter((a) => a.activityId === selected);
  return (
    <>
      <WeekPanel title="External AI assessment batches">
        <p>
          Review and de-identify every submitted response before exporting one
          complete report per game. Imports must cover all anonymous IDs. Scores
          at or below 50%, at or above 85%, and unreliable evidence require
          human verification.
        </p>
        <label>
          Game
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {[
              ...activities.filter((a) => a.kind !== "QUIZ"),
              { id: "D1-C01", name: "Aligned Day 1 comparison" },
            ].map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {selected === "D1-C01" && (
          <button
            className="btn"
            onClick={() => runProgram(act, "prepare-comparison")}
          >
            Prepare separate four-criterion Day 1 reassessment
          </button>
        )}
        <button
          className="btn primary"
          onClick={async () => {
            const result = await runProgram(act, "export-assessment", {
              activityId: selected,
            });
            if (result?.report)
              downloadJson(
                result.report,
                `codewild-${selected}-${result.report.batchId}.json`,
              );
          }}
        >
          Export complete anonymous marking report
        </button>
        <JsonImport
          title="Import structured external-AI results"
          onImport={(result) =>
            runProgram(act, "import-assessment", { result })
          }
        />
        <Form
          fields={[textField("json", "Or paste external-AI result JSON")]}
          submit="Validate and import"
          onSubmit={(v) => {
            try {
              return runProgram(act, "import-assessment", {
                result: JSON.parse(v.json),
              });
            } catch {
              return false;
            }
          }}
        />
        <p className="muted">
          The exported report contains the expected response contract. Optional
          learningExamples contain up to three submitted anonymous IDs selected
          by external AI; CC approves their safe summaries before publication.
        </p>
      </WeekPanel>
      {records.map((a) => (
        <WeekPanel
          key={a._id}
          title={`${nameOf(data, a.userId)} · ${a.data.activity.name}`}
          action={<Badge>{a.data.result?.status || "PENDING"}</Badge>}
        >
          <p>
            Started {weekTime(a.data.startedAt)}. Deadline{" "}
            {weekTime(a.data.deadline)}.
          </p>
          <Evidence
            value={a.data.submissions.at(-1)?.answers || a.data.draft}
          />
          {a.data.submissions.at(-1)?.answers.url && (
            <a
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
              href={a.data.submissions.at(-1).answers.url}
            >
              Open the submitted AI thread for access verification
            </a>
          )}
          {a.data.submittedAt && (
            <Form
              key={`safe-${a._id}-${a.data.submissions.at(-1)?.id}`}
              fields={[
                {
                  ...textField(
                    "evidence",
                    "Complete de-identified evidence approved for external AI",
                  ),
                  maxLength: 64000,
                },
                textField("reason", "Privacy and evidence verification note"),
              ]}
              initial={{
                evidence:
                  a.data.safeExport?.evidence ||
                  JSON.stringify(a.data.submissions.at(-1)?.answers, null, 2),
              }}
              submit="Approve safe export evidence"
              onSubmit={(values) =>
                runProgram(act, "approve-export", {
                  ...values,
                  attemptId: a._id,
                })
              }
            />
          )}
          {a.data.result && (
            <>
              <p>
                AI-first result: {a.data.result.percent.toFixed(2)}%.{" "}
                {a.data.result.status === "HUMAN_REVIEW"
                  ? "Human verification required."
                  : "Accepted."}
              </p>
              <Form
                fields={[
                  ...a.data.activity.criteria.map((key) => ({
                    name: key,
                    label: `${key} rating`,
                    type: "number",
                    min: 0,
                    max: 4,
                  })),
                  textField("reason", "Human evidence review and rationale"),
                ]}
                initial={a.data.result.ratings}
                submit="Verify or adjust AI-first assessment"
                onSubmit={(v) =>
                  runProgram(act, "review-assessment", {
                    attemptId: a._id,
                    ratings: Object.fromEntries(
                      a.data.activity.criteria.map((key) => [key, v[key]]),
                    ),
                    reason: v.reason,
                  })
                }
              />
            </>
          )}
          <WeekForm
            action="extend-attempt"
            act={act}
            values={{ attemptId: a._id }}
            fields={[
              {
                name: "deadline",
                label: "New deadline (ISO with time-zone offset)",
              },
              textField("reason", "Extension reason"),
            ]}
            submit="Authorise extension"
          />
          <details>
            <summary>Assessment revisions</summary>
            <Evidence
              value={{ history: JSON.stringify(a.data.history, null, 2) }}
            />
          </details>
        </WeekPanel>
      ))}
      <DayOneCohort data={data} act={act} now={new Date()} />
    </>
  );
}
export function StaffChallenges({ data, act }) {
  const p = data.weekOneProgram,
    cc = data.user.role === "CENTRE_COMMAND";
  return (
    <>
      {cc && (
        <WeekPanel title="Optional weekly and Grand Challenges">
          <WeekForm
            action="publish-challenge"
            act={act}
            fields={[
              {
                name: "kind",
                label: "Challenge",
                options: [
                  { value: "WEEKLY", label: "Optional weekly challenge" },
                  { value: "GRAND", label: "One-time Grand Challenge" },
                ],
              },
              { name: "title", label: "Title" },
              textField("brief", "Approved challenge brief"),
              textField("reward", "Approved reward and eligibility"),
            ]}
            submit="Publish approved optional challenge"
          />
        </WeekPanel>
      )}
      {p.attempts
        .filter((a) => a.data.activity.kind === "CHALLENGE")
        .map((a) => (
          <WeekPanel
            key={a._id}
            title={`${nameOf(data, a.userId)} · ${a.data.activity.name}`}
          >
            <Evidence
              value={a.data.submissions.at(-1)?.answers || a.data.draft}
            />
            <p>
              {a.data.review
                ? `Reviewed: ${a.data.review.genuine ? "genuine attempt" : "not yet genuine"}`
                : "Verification pending"}
            </p>
            {a.data.submittedAt && (
              <WeekForm
                action="review-challenge"
                act={act}
                values={{ attemptId: a._id }}
                fields={[
                  {
                    name: "genuine",
                    label: "Evidence decision",
                    options: [
                      {
                        value: "true",
                        label:
                          "Genuine research attempt, including honest failure",
                      },
                      { value: "false", label: "No genuine research evidence" },
                    ],
                  },
                  textField("reason", "Verification evidence and reason"),
                ]}
                submit="Verify challenge attempt"
              />
            )}
          </WeekPanel>
        ))}
    </>
  );
}
export function StaffRules({ data, act }) {
  const p = data.weekOneProgram,
    cc = data.user.role === "CENTRE_COMMAND";
  return (
    <>
      <WeekPanel title="Game Rules and shared FAQ">
        {p.rules.map((r) => (
          <details key={r.version}>
            <summary>
              Rules version {r.version} · {weekTime(r.publishedAt)}
            </summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.text}</p>
          </details>
        ))}
        {cc && (
          <WeekForm
            action="publish-rules"
            act={act}
            fields={[
              textField("text", "Approved Game Rules"),
              textField("reason", "CC approval and material change reason"),
            ]}
            submit="Publish new Rules version and require acknowledgement"
          />
        )}
        <WeekForm
          action="publish-faq"
          act={act}
          fields={[
            textField("question", "Non-substantive Rules question"),
            textField("answer", "Shared clarification answer"),
          ]}
          submit="Publish clarification to FAQ"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Gamer</th>
                <th>Latest Rules acknowledgement</th>
              </tr>
            </thead>
            <tbody>
              {p.results.map((r) => (
                <tr key={r.userId}>
                  <td>{r.name}</td>
                  <td>
                    {weekTime(
                      p.learners.find((l) => l.userId === r.userId)?.data
                        .ruleAcks[p.rules.at(-1)?.version]?.at,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WeekPanel>
      <WeekPanel title="Professional evidence and factual exceptions">
        <p>
          Each day contributes up to 2 marks from applicable objective events.
          Discovery non-attempts use the separate deduction, without double
          counting. CC approves factual exclusions.
        </p>
        <Form
          fields={[
            { name: "userId", label: "Gamer", options: personOptions(data) },
            { name: "day", label: "Day", type: "number", min: 1, max: 5 },
            {
              name: "excluded",
              label: "Event IDs to exclude (comma separated)",
              optional: true,
            },
            {
              name: "excused",
              label: "Whole day absence",
              options: [
                { value: "false", label: "Day remains eligible" },
                { value: "true", label: "Excused absence" },
              ],
            },
            {
              name: "discoveryExcused",
              label: "Required Discovery",
              options: [
                { value: "false", label: "No Discovery exemption" },
                {
                  value: "true",
                  label: "Excuse the missing Discovery attempt",
                },
              ],
            },
            textField("reason", "Factual evidence and proposed correction"),
          ]}
          submit="Propose factual exception"
          onSubmit={(v) =>
            runProgram(act, "propose-exception", {
              ...v,
              excluded: v.excluded
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              excused: v.excused === "true",
              discoveryExcused: v.discoveryExcused === "true",
            })
          }
        />
        {p.exceptionRequests.map((r) => (
          <article key={r.id}>
            <h3>
              {nameOf(data, r.userId)} · Day {r.day} · {r.status}
            </h3>
            <p>{r.reason}</p>
            {cc && r.status === "PENDING" && (
              <WeekForm
                action="approve-exception"
                act={act}
                values={{ requestId: r.id }}
                fields={[
                  {
                    name: "approve",
                    label: "Decision",
                    options: [
                      { value: "true", label: "Approve factual exclusion" },
                      { value: "false", label: "Reject" },
                    ],
                  },
                  textField("reason", "Decision evidence"),
                ]}
                submit="Record CC decision"
              />
            )}
          </article>
        ))}
      </WeekPanel>
    </>
  );
}
export function StaffDashboard({ data, act, now }) {
  const p = data.weekOneProgram;
  return (
    <>
      <WeekOneRelease data={data} act={act} now={now} />
      <WeekPanel title="Week 1 evidence overview">
        <div className="button-row">
          <Badge>{p.results.length} GAMERS</Badge>
          <Badge>
            {
              p.attempts.filter((a) => a.data.result?.status === "HUMAN_REVIEW")
                .length
            }{" "}
            HUMAN REVIEWS
          </Badge>
          <Badge>
            {
              p.tickets.filter(
                (t) => !["RESOLVED", "CLOSED"].includes(t.data.status),
              ).length
            }{" "}
            OPEN QUESTIONS
          </Badge>
        </div>
        <p>
          Reward verifications older than 24 hours are escalated to Centre
          Command.
        </p>
        {p.overdueReviews.map((r) => (
          <p key={r.attemptId}>
            {nameOf(data, r.userId)} · {r.activityId} · Verification overdue
          </p>
        ))}
      </WeekPanel>
      <DayOneCohort data={data} act={act} now={now} />
    </>
  );
}
function RecognitionProposal({ data, act }) {
  const p = data.weekOneProgram,
    definitions = p.settings.awardDefinitions;
  if (definitions.length !== 13)
    return (
      <WeekPanel title="Recognition configuration required">
        <p>
          CC must supply the five Skill and eight Growth award definitions in
          Game Configuration before nominations can be completed.
        </p>
      </WeekPanel>
    );
  const examples = p.batches.flatMap((b) =>
    b.learningExamples.map((e) => ({
      value: `${b.id}|${e.anonymousId}`,
      label: `${b.activityId} · ${e.anonymousId.slice(0, 8)}`,
    })),
  );
  return (
    <WeekPanel title="Awards and approved learning examples">
      <Form
        fields={[
          ...definitions.flatMap((d, i) => [
            {
              name: `recipient${i}`,
              label: d.name,
              options: personOptions(data),
            },
            textField(`evidence${i}`, `Evidence for ${d.name}`),
          ]),
          ...[0, 1, 2].flatMap((i) => [
            {
              name: `example${i}`,
              label: `AI-selected example ${i + 1}`,
              options: examples.length
                ? examples
                : [
                    {
                      value: "",
                      label: "Import AI-selected learning examples first",
                    },
                  ],
            },
            textField(`summary${i}`, "Approved anonymous dashboard summary"),
          ]),
          {
            name: "weekChampionId",
            label: "Week 1 Champion (highest verified readiness)",
            options: personOptions(data),
          },
          textField("reason", "Champion decision and tie review"),
        ]}
        submit="Save recognition proposal for CC approval"
        onSubmit={(v) =>
          runProgram(act, "propose-recognition", {
            awards: definitions.map((d, i) => ({
              awardId: d.id,
              userId: v[`recipient${i}`],
              reason: v[`evidence${i}`],
            })),
            examples: [0, 1, 2].map((i) => {
              const [batchId, anonymousId] = v[`example${i}`].split("|");
              return { batchId, anonymousId, reason: v[`summary${i}`] };
            }),
            weekChampionId: v.weekChampionId,
            reason: v.reason,
          })
        }
      />
    </WeekPanel>
  );
}
export function StaffResults({ data, act }) {
  const p = data.weekOneProgram,
    cc = data.user.role === "CENTRE_COMMAND";
  return (
    <>
      <WeekPanel
        title="Week 1 readiness and publication"
        action={
          <Badge>
            {p.locked
              ? `LOCKED · REVISION ${p.publication.version}`
              : "UNPUBLISHED"}
          </Badge>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Gamer</th>
                <th>Readiness</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {p.results.map((r) => (
                <tr key={r.userId}>
                  <td>{r.name}</td>
                  <td>
                    {r.total === null
                      ? "Pending"
                      : `${r.total.toFixed(2)} / 100`}
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.signoff && <Receipt>MC signoff {weekTime(p.signoff.at)}</Receipt>}
        {!cc && (
          <WeekForm
            action="signoff"
            act={act}
            fields={[
              textField(
                "reason",
                "Mark completeness, exception and evidence review",
              ),
            ]}
            submit="Sign off verified Week 1 readiness"
          />
        )}
        {cc && (
          <>
            {p.locked && !p.correction ? (
              <WeekForm
                action="begin-correction"
                act={act}
                fields={[
                  textField(
                    "reason",
                    "Reason for an immutable score correction revision",
                  ),
                ]}
                submit="Authorise correction revision"
              />
            ) : (
              <WeekForm
                action="publish-results"
                act={act}
                fields={[
                  textField(
                    "reason",
                    "CC approval of results, awards and allocation",
                  ),
                ]}
                submit="Approve, lock and publish Week 1 results"
              />
            )}
          </>
        )}
      </WeekPanel>
      <details>
        <summary>
          Review component evidence and capability recommendations
        </summary>
        {p.results.map((r) => (
          <div key={r.userId}>
            <ResultCard row={r} weights={p.settings.weights} />
            {!cc &&
              r.specialistRecommendations.map((recommendation) => (
                <WeekForm
                  key={recommendation.area}
                  action="specialist-review"
                  act={act}
                  values={{ userId: r.userId, area: recommendation.area }}
                  fields={[
                    {
                      name: "approve",
                      label: `${r.name} · ${recommendation.area}`,
                      options: [
                        {
                          value: "true",
                          label:
                            "Evidence supports matching Week 3 Level 2 consideration",
                        },
                        { value: "false", label: "More evidence required" },
                      ],
                    },
                    textField(
                      "reason",
                      "Evidence sufficiency and human decision",
                    ),
                  ]}
                  submit="Review specialist recommendation"
                />
              ))}
          </div>
        ))}
      </details>
      <details>
        <summary>
          Nominate 13 distinct award recipients and three examples
        </summary>
        <RecognitionProposal data={data} act={act} />
      </details>
      {cc && (
        <details>
          <summary>Private Day 1 Champion decision</summary>
          <DayOneCohort data={data} act={act} now={new Date()} />
        </details>
      )}
      {p.publication && (
        <WeekPanel
          title={
            p.recovery?.policy
              ? "College scheduling notices"
              : "Saturday rescue and provisional teams"
          }
        >
          {p.publication.rescue.map((r) => (
            <p key={r.userId}>
              {nameOf(data, r.userId)} · {r.status} · {weekTime(r.start)}
            </p>
          ))}
          {p.publication.teams.map((t) => (
            <p key={t.id}>
              {t.id}: {t.members.map((id) => nameOf(data, id)).join(", ")} ·
              Provisional until Saturday outcomes
            </p>
          ))}
          {!cc && (
            <Form
              fields={[
                ...p.results
                  .filter((r) => r.status === "CLEARED")
                  .map((r) => ({
                    name: r.userId,
                    label: `${r.name} proposed team`,
                    options: p.publication.teams.map((t, i) => ({
                      value: String(i),
                      label: `Team ${i + 1}`,
                    })),
                  })),
                textField("reason", "Reasoned allocation adjustment"),
              ]}
              initial={Object.fromEntries(
                p.publication.teams.flatMap((t, i) =>
                  t.members.map((id) => [id, String(i)]),
                ),
              )}
              submit="Request CC allocation approval"
              onSubmit={(v) =>
                runProgram(act, "team-request", {
                  teams: p.publication.teams
                    .map((_, i) => ({
                      members: p.results
                        .filter(
                          (r) =>
                            r.status === "CLEARED" && v[r.userId] === String(i),
                        )
                        .map((r) => r.userId),
                    }))
                    .filter((t) => t.members.length),
                  reason: v.reason,
                })
              }
            />
          )}
          {p.teamRequests.map((r) => (
            <article key={r.id}>
              <p>
                {r.reason} · {r.status}
              </p>
              {cc && r.status === "PENDING" && (
                <WeekForm
                  action="approve-team"
                  act={act}
                  values={{ requestId: r.id }}
                  fields={[
                    {
                      name: "approve",
                      label: "Decision",
                      options: [
                        {
                          value: "true",
                          label: "Approve provisional adjustment",
                        },
                        { value: "false", label: "Reject" },
                      ],
                    },
                    textField("reason", "CC decision"),
                  ]}
                  submit="Record allocation decision"
                />
              )}
            </article>
          ))}
          {cc && (
            <>
              <p>
                Approved providers receive college scheduling notices after
                publication. Configure the authorised contacts and webhook
                before delivery; pending or failed notices can be retried.
              </p>
              <button
                className="btn"
                onClick={() =>
                  downloadJson(
                    p.collegeNotices,
                    "codewild-saturday-college-notifications.json",
                  )
                }
              >
                Download college scheduling notices
              </button>
              {p.collegeNotices.map((n) => (
                <p key={n.userId}>
                  {nameOf(data, n.userId)} · {n.status}
                  {n.detail ? ` · ${n.detail}` : ""}
                </p>
              ))}
              <button
                className="btn"
                onClick={() => runProgram(act, "deliver-college-notices")}
              >
                Retry configured college notice delivery
              </button>
            </>
          )}
        </WeekPanel>
      )}
    </>
  );
}
