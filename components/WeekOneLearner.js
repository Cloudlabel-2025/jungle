"use client";
import FlightLevelRetry from "./FlightLevelRetry";
import { companionText } from "@/lib/companion-name.js";
import PlayerVitals from "./PlayerVitals";
import MissionRecovery from "./MissionRecovery";
import TrophyLeague from "./TrophyLeague";
import TrophyConduct from "./TrophyConduct";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge, Receipt, Form } from "./ui";
import SavedReflectionForm from "./SavedReflectionForm";
import useSavedWork from "./useSavedWork";
import { FlightLevelRewards } from "./WeekOneStarGuide";
import {
  DayOneCheckIn,
  DiscoveryMission,
  DayOneRewards,
} from "./DayOneFeatures";
import { eodQuestions, fieldLabels } from "@/lib/week-one-catalog.js";
import {
  WeekPanel,
  WeekForm,
  EmptyWeek,
  runProgram,
  weekTime,
  textField,
  Evidence,
  ResultCard,
} from "./WeekOneShared";

export function Notifications({ data, act }) {
  const notes = data.weekOneProgram.notifications;
  if (!notes.length) return null;
  return (
    <WeekPanel
      title="Mission notices"
      action={<Badge>{notes.length}</Badge>}
      bodyStyle={{ gap: 8 }}
    >
      {notes.map((n) => (
        <div
          key={n.id}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: "8px 0",
          }}
        >
          <p style={{ flex: "1 1 320px", margin: 0 }}>{n.message}</p>
          <div className="button-row">
            <Link className="btn small" href={`/gamer/week-one-${n.screen}`}>
              Open{" "}
              {n.screen === "announcements"
                ? "Announcements"
                : n.screen === "game-rules"
                  ? "Game Rules"
                  : "Challenges"}
            </Link>
            <button
              className="btn small"
              onClick={() =>
                runProgram(act, "dismiss-notification", { id: n.id })
              }
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </WeekPanel>
  );
}
function Reflection({
  questions,
  saved,
  onSubmit,
  title,
  draft,
  ownerId,
  day,
}) {
  const initial =
    draft?.value?.answers ||
    draft?.answers ||
    (draft?.text
      ? questions.map((_, i) => (i === 0 ? draft.text : ""))
      : questions.map(() => ""));
  const [answers, setAnswers] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [voice, setVoice] = useState(draft?.mode === "VOICE");
  const recognition = useRef(null);
  const [step, setStep] = useState(() => Math.max(0, initial.findIndex(answer => !String(answer).trim())));
  const work = useSavedWork({
    value: { answers, mode: voice ? "VOICE" : "TEXT" },
    initialValue: { answers: initial, mode: draft?.mode || "TEXT" },
    initialVersion: draft?.revision || 0,
    enabled: !saved && !busy && Boolean(ownerId),
    ownerId,
    endpoint: "/api/week1/program/reflection-draft",
    payload: { kind: "eod", day },
  });
  useEffect(() => () => recognition.current?.abort(), []);
  function dictate(index) {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError("Voice dictation is unavailable. You can type your answer.");
      return;
    }
    recognition.current?.abort();
    const r = new Speech();
    recognition.current = r;
    r.lang = "en-IN";
    r.onresult = (event) => {
      const words = event.results[0][0].transcript;
      setAnswers((v) =>
        v.map((a, i) => (i === index ? `${a} ${words}`.trim() : a)),
      );
      setVoice(true);
    };
    r.onerror = () =>
      setError("Dictation could not finish. You can type your answer.");
    r.start();
  }
  return (
    <WeekPanel title={title}>
      {saved ? (
        <>
          <Receipt>Saved {weekTime(saved.at)}</Receipt>
          {saved.answers ? (
            <Evidence
              value={Object.fromEntries(
                saved.answers.map((a, i) => [questions[i], a]),
              )}
            />
          ) : (
            <p>{saved.text}</p>
          )}
        </>
      ) : (
        <form
          className="field-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await work.flush();
              setBusy(true);
              await onSubmit(answers, voice ? "VOICE" : "TEXT");
            } catch (error) {
              setError(error.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p role="status">Reflection {step + 1} of {questions.length} · {answers.filter(answer => String(answer).trim()).length} recorded</p>
          {questions.map((q, i) => i === step && (
            <label key={q}>
              {q}
              <textarea
                value={answers[i]}
                onChange={(event) =>
                  setAnswers((v) =>
                    v.map((a, j) => (j === i ? event.target.value : a)),
                  )
                }
                required
                maxLength={2000}
              />
              <button
                type="button"
                className="btn small"
                onClick={() => dictate(i)}
              >
                Dictate this answer
              </button>
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          {ownerId && (
            <p role="status" className="muted">
              {work.status ||
                (draft
                  ? "Saved draft restored"
                  : "Your draft saves automatically.")}{" "}
              · Drafts are not submitted work.
            </p>
          )}
          <div className="button-row">
          <button type="button" className="btn" disabled={busy || step === 0} onClick={() => setStep(s => s - 1)}>Previous reflection</button>
          {step < questions.length - 1 ? <button type="button" className="btn primary" disabled={busy || !answers[step]?.trim()} onClick={() => setStep(s => s + 1)}>Next reflection</button> : <button className="btn primary" disabled={busy || answers.some(answer => !String(answer).trim())}>
            Save reflection
          </button>}
          </div>
        </form>
      )}
    </WeekPanel>
  );
}
export function MyDay({ data, act }) {
  const p = data.weekOneProgram,
    l = p.learners[0];
  const [selectedDay, setSelectedDay] = useState(() => p.days.find(d => d.state === 'OPEN')?.day || p.days.at(-1)?.day);
  const day = p.days.find(d => d.day === selectedDay) || p.days.at(-1);
  if (!day) return <EmptyWeek />;
  const canReflect = day.state === 'OPEN' || (p.progression?.mode === 'COMPLETION' && !p.publication);
  const d = day.day === 1 ? data.dayOne.records[0] : l?.data.days[day.day];
  return (
    <>
      <nav className="button-row" aria-label="Choose a level journal">{p.days.map(level => <button className={`btn ${day.day === level.day ? 'primary' : ''}`} key={level.day} aria-pressed={day.day === level.day} onClick={() => setSelectedDay(level.day)}>Level {level.day} journal</button>)}</nav>
      <WeekPanel
        title={`Level ${day.day} · ${day.title || 'Your flight journal'}`}
        kicker="MY DAY"
        action={<Badge>{day.state}</Badge>}
      >
        <p>
          Today’s window: {weekTime(day.officialStart)} –{" "}
          {weekTime(day.scheduledEnd)}.
        </p>
        <div className="button-row">
          <PlayerVitals player={data.user} />
          <Badge tone="amber">
            {data.user.weekOneTrophies || 0} {p.progression?.mode === 'COMPLETION' ? 'FLIGHT TROPHIES' : '/ 140 WEEK 1 TROPHIES'}
          </Badge>
        </div>
        <div className="button-row">
          <Link className="btn" href="/gamer/week-one-announcements">
            Meeting Announcements
          </Link>
          <Link className="btn primary" href="/gamer/week-one-games">
            My Games
          </Link>
        </div>
      </WeekPanel>
      {day.day === 1 ? (
        <DayOneCheckIn data={data} act={act} now={new Date()} />
      ) : (
        <WeekPanel title="Daily camp check-in">
          {d?.clockAt ? (
            <Receipt>Clocked in {weekTime(d.clockAt)}</Receipt>
          ) : (
            <button
              className="btn primary"
              disabled={!canReflect}
              onClick={() => runProgram(act, "clock", { day: day.day })}
            >
              Check in
            </button>
          )}
        </WeekPanel>
      )}
      <fieldset
        disabled={!canReflect}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        <WeekPanel title="Start-of-day reflection">
          {d?.sod ? (
            <p>{d.sod.text}</p>
          ) : (
            <SavedReflectionForm
              key={`${data.user._id}:${day.day}:sod`}
              ownerId={data.user._id}
              day={day.day}
              kind="sod"
              draft={d?.reflectionDrafts?.sod}
              onSubmit={(values) =>
                runProgram(act, "sod", { day: day.day, ...values })
              }
              fields={[textField("text", "What will you focus on today?")]}
              submit="Save SOD"
            />
          )}
        </WeekPanel>
        <Reflection
          key={`${data.user._id}:eod-${day.day}`}
          ownerId={data.user._id}
          day={day.day}
          draft={d?.reflectionDrafts?.eod}
          title="End-of-day reflection"
          questions={eodQuestions[day.day]}
          saved={d?.eod}
          onSubmit={(answers, mode) =>
            runProgram(act, "eod", { day: day.day, answers, mode })
          }
        />
        {day.day === 5 && p.settings.compassQuestions.length === 3 && (
          <Reflection
            title="Weekly Compass Check"
            questions={p.settings.compassQuestions}
            saved={d?.compass}
            onSubmit={(answers) =>
              runProgram(act, "compass", { day: 5, answers })
            }
          />
        )}
      </fieldset>
    </>
  );
}
export function Announcements({ data, act }) {
  const p = data.weekOneProgram,
    l = p.learners[0];
  const [selected, setSelected] = useState(() => p.days.find(day => day.state === "OPEN")?.day || p.days.at(-1)?.day);
  const [opened, setOpened] = useState([]);
  if (!p.days.length) return <EmptyWeek />;
  return (
    <>
      <nav className="button-row" aria-label="Choose a briefing">
        {p.days.map(day => <button className={`btn ${selected === day.day ? 'primary' : ''}`} key={day.day} aria-pressed={selected === day.day} onClick={() => setSelected(day.day)}>Level {day.day} briefing</button>)}
      </nav>
      {p.days.filter(day => day.day === selected).map((day) => {
        const d =
          day.day === 1 ? data.dayOne.records[0] : l?.data.days[day.day];
        const run = (action, values = {}) =>
          runProgram(act, action, { day: day.day, ...values });
        return (
          <WeekPanel
            key={day.day}
            title={`Day ${day.day} · Meeting Announcements`}
          >
            {!day.agenda ? (
              <p className="muted">Today's agenda has not been published.</p>
            ) : !d?.agendaViewedAt && !opened.includes(day.day) ? (
              <button
                className="btn"
                onClick={() => { setOpened(previous => [...previous, day.day]); if (day.state === 'OPEN') void run("agenda-view"); }}
              >
                Open the agenda
              </button>
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap" }}>{day.agenda.text}</p>
                {d.agendaAcknowledgedAt ? (
                  <Receipt>
                    Acknowledged {weekTime(d.agendaAcknowledgedAt)}
                  </Receipt>
                ) : (
                  <button
                    className="btn primary"
                    disabled={day.state !== "OPEN"}
                    onClick={() => run("agenda-ack")}
                  >
                    I have read today's agenda
                  </button>
                )}
              </>
            )}
            {day.recaps.map((recap) => (
              <article key={recap.session} className="history-entry">
                <h3>Class {recap.session} recap</h3>
                {day.state !== "OPEN" || d?.recapViews?.[recap.session] ||
                d?.recaps?.[recap.session] ? (
                  <p>{recap.text}</p>
                ) : (
                  <button
                    className="btn"
                    disabled={day.state !== "OPEN"}
                    onClick={() =>
                      run("recap-view", { session: recap.session })
                    }
                  >
                    Open class {recap.session} recap
                  </button>
                )}
                <p className="muted">
                  Acknowledgement window ends {weekTime(recap.deadline)}.
                </p>
                {d?.recaps?.[recap.session] ? (
                  <Receipt>
                    Acknowledged {weekTime(d.recaps[recap.session])}
                  </Receipt>
                ) : (
                  <button
                    className="btn"
                    disabled={
                      day.state !== "OPEN" || !d?.recapViews?.[recap.session]
                    }
                    onClick={() => run("recap-ack", { session: recap.session })}
                  >
                    I have reviewed this recap
                  </button>
                )}
              </article>
            ))}
          </WeekPanel>
        );
      })}
    </>
  );
}
export function AttemptForm({ record, act, now, open, ownerId }) {
  const d = record.data,
    activity = d.activity,
    submitted = d.submissions.at(-1);
  const [answers, setAnswers] = useState(d.draft || {}),
    [status, setStatus] = useState(d.savedAt ? "Draft restored" : ""),
    [busy, setBusy] = useState(false);
  const changed = JSON.stringify(answers),
    expired = new Date(now) > new Date(d.deadline),
    quiz = activity.kind === "QUIZ";
  const canWrite =
    open ||
    d.extensions?.some((e) => new Date(now) <= new Date(e.deadline)) ||
    activity.kind === "CHALLENGE";
  const work = useSavedWork({
    value: { answers },
    initialValue: { answers: d.draft || {} },
    initialVersion: record.version,
    ownerId,
    enabled: canWrite && !expired && !busy && !(quiz && d.submittedAt),
    endpoint: "/api/week1/program/attempt-save",
    buildBody: (value, version) => ({
      attemptId: record._id,
      attemptVersion: version,
      answers: value.answers,
    }),
  });
  useEffect(() => work.syncVersion(record.version), [record.version, changed]);
  const update = (key, value) => {
    setStatus("");
    setAnswers((old) => ({ ...old, [key]: value }));
  };
  const remaining = Math.max(0, new Date(d.deadline) - new Date(now));
  const [step, setStep] = useState(0);
  const steps = quiz ? activity.questions.length : activity.fields.length;
  return (
    <WeekPanel
      title={activity.name}
      action={
        <Badge>
          {Math.floor(remaining / 60000)}m {Math.floor(remaining / 1000) % 60}s
        </Badge>
      }
    >
      <p style={{ whiteSpace: "pre-wrap" }}>{companionText(d.variant?.brief)}</p>
      {d.variant?.sourceUrl && (
        <a
          className="text-link"
          target="_blank"
          rel="noopener noreferrer"
          href={d.variant.sourceUrl}
        >
          Read-only original Day 1 research
        </a>
      )}
      <p className="muted">
        Started {weekTime(d.startedAt)}. Deadline {weekTime(d.deadline)}.{" "}
        {expired
          ? "Time has ended. Saved evidence is retained for review."
          : "Your draft saves automatically."}
      </p>
      <form
        className="field-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          try {
            const pending = work.flush();
            setBusy(true);
            await pending;
            await runProgram(act, "attempt-submit", {
              attemptId: record._id,
              attemptVersion: work.getVersion(),
              answers,
            });
          } catch (error) {
            setStatus(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p role="status">Checkpoint {step + 1} of {steps}. Your answers stay saved as you move.</p>
        <fieldset
          disabled={
            !canWrite || busy || expired || (quiz && Boolean(d.submittedAt))
          }
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 18,
            minWidth: 0,
          }}
        >
          {quiz
            ? activity.questions.filter((_, i) => i === step).map((q) => (
                <fieldset key={q.id}>
                  <legend>{q.question}</legend>
                  {q.options.map((option, index) => (
                    <label
                      key={index}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <input
                        style={{ width: "auto" }}
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === index}
                        onChange={() => update(q.id, index)}
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))
            : activity.fields.filter((_, i) => i === step).map((key) =>
                key === "sequence" ? (
                  <fieldset key={key}>
                    <legend>Order the components</legend>
                    <div className="button-row">
                      {d.variant.cards
                        .filter((card) => !answers.sequence?.includes(card))
                        .map((card) => (
                          <button
                            type="button"
                            className="btn small"
                            key={card}
                            onClick={() =>
                              update("sequence", [
                                ...(answers.sequence || []),
                                card,
                              ])
                            }
                          >
                            Add {card}
                          </button>
                        ))}
                    </div>
                    <ol>
                      {(answers.sequence || []).map((card, index) => (
                        <li key={card}>
                          {card}{" "}
                          <button
                            type="button"
                            className="btn small"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...answers.sequence];
                              [next[index - 1], next[index]] = [
                                next[index],
                                next[index - 1],
                              ];
                              update("sequence", next);
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() =>
                              update(
                                "sequence",
                                answers.sequence.filter((c) => c !== card),
                              )
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ol>
                  </fieldset>
                ) : (
                  <label key={key}>
                    {fieldLabels[key] ||
                      "What did you attempt and what happened?"}
                    {key === "url" ? (
                      <input
                        type="url"
                        maxLength={2000}
                        value={answers[key] || ""}
                        onChange={(event) => update(key, event.target.value)}
                      />
                    ) : (
                      <textarea
                        rows={3}
                        maxLength={8000}
                        value={answers[key] || ""}
                        onChange={(event) => update(key, event.target.value)}
                      />
                    )}
                  </label>
                ),
              )}
        </fieldset>
        <small role="status">
          {status.startsWith("Draft")
            ? work.status || status
            : status || work.status}
        </small>
        <div className="button-row">
        <button type="button" className="btn" disabled={busy || step === 0} onClick={() => setStep(s => s - 1)}>Previous checkpoint</button>
        {step < steps - 1 ? <button type="button" className="btn primary" disabled={busy} onClick={() => setStep(s => s + 1)}>Next checkpoint</button> : <button
          className="btn primary"
          disabled={busy || !canWrite || (quiz && Boolean(d.submittedAt))}
        >
          {quiz && d.submittedAt
            ? "Quiz sealed"
            : expired && activity.kind !== "CHALLENGE"
              ? "Submit saved evidence for review"
              : submitted
                ? "Submit evidence revision"
                : "Submit attempt"}
        </button>}
        </div>
      </form>
      {submitted && (
        <Receipt>
          Submission retained {weekTime(submitted.at)} ·{" "}
          {d.result?.status?.replaceAll("_", " ") || "Assessment pending"}
        </Receipt>
      )}
      {d.result?.percent != null && (
        <p>Approved score: {d.result.percent.toFixed(2)}%</p>
      )}
      {!quiz && submitted && (
        <WeekForm
          action="share-consent"
          act={act}
          values={{ activityId: record.activityId, allowed: true }}
          fields={[]}
          submit="Allow MC to share an approved anonymous research summary"
        />
      )}
      {d.submissions.length > 0 && (
        <details>
          <summary>Saved submission history</summary>
          {d.submissions.map((s) => (
            <div key={s.id}>
              <p>
                {weekTime(s.at)} {s.late ? "· Late / incomplete evidence" : ""}
              </p>
              <Evidence value={s.answers} />
            </div>
          ))}
        </details>
      )}
    </WeekPanel>
  );
}
export function Games({ data, act, now }) {
  const p = data.weekOneProgram;
  if (!p.days.length) return <EmptyWeek />;
  return (
    <>
      {[...p.days].reverse().map((day) =>
        day.day === 1 ? (
          <div key={1}>
            <FlightLevelRetry data={data} act={act} day={1} now={now}/>
            <DiscoveryMission data={data} act={act} now={now} />
            <WeekForm
              action="share-consent"
              act={act}
              values={{ activityId: "D1-R01", allowed: true }}
              fields={[]}
              submit="Allow an approved anonymous summary of my Day 1 research"
            />
          </div>
        ) : (
          <div key={day.day}>
            <FlightLevelRetry data={data} act={act} day={day.day} now={now}/>
            <FlightLevelRewards data={data} day={day.day} />
            {day.activities.map((activity) => {
              const record = p.attempts.find(
                (a) => a.activityId === activity.id,
              );
              return record ? (
                <AttemptForm
                  key={record._id}
                  ownerId={data.user._id}
                  record={record}
                  act={act}
                  now={now}
                  open={day.state === "OPEN" || p.progression?.mode === "COMPLETION"}
                />
              ) : (
                <WeekPanel
                  key={activity.id}
                  title={`Day ${day.day} · ${activity.name}`}
                  kicker={`${activity.durationMinutes} MINUTES`}
                >
                  <p>
                    Your timer begins when you start. This is one persistent
                    attempt. Starting and continuing are free; retrying a level costs 1 energy.
                  </p>
                  <WeekForm
                    action="attempt-start"
                    act={act}
                    values={{ activityId: activity.id, day: day.day }}
                    fields={
                      activity.kind === "QUIZ" || activity.kind === "FITNESS"
                        ? []
                        : [
                            {
                              name: "variantId",
                              label: "Choose a scenario",
                              options: activity.variants.map((v) => ({
                                value: v.id,
                                label: v.name,
                              })),
                            },
                          ]
                    }
                    submit={
                      day.state === "OPEN" || p.progression?.mode === "COMPLETION"
                        ? "Start activity"
                        : "Activity closed"
                    }
                  />
                </WeekPanel>
              );
            })}
          </div>
        ),
      )}
    </>
  );
}
export function Rules({ data, act }) {
  const p = data.weekOneProgram,
    rule = p.rules.at(-1),
    ack = p.learners[0]?.data.ruleAcks[rule?.version];
  const cards = rule?.text.split(/\n\s*\n/).filter(Boolean) || [];
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rule?.version]);
  const current = Math.min(page, Math.max(0, cards.length - 1));
  return (
    <>
      <WeekPanel
        title="Game Rules"
        action={<Badge>VERSION {rule?.version || "PENDING"}</Badge>}
      >
        {rule ? (
          <>
            <p role="status">Field guide card {current + 1} of {cards.length}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{cards[current]}</p>
            <div className="button-row">
              <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous rule</button>
              <button className="btn" disabled={current === cards.length - 1} onClick={() => setPage(current + 1)}>Next rule</button>
            </div>
            {ack ? (
              <Receipt>
                Acknowledged {weekTime(ack.at)}. Clarification window ends{" "}
                {weekTime(ack.clarificationWindowEnd)}.
              </Receipt>
            ) : (
              <button
                className="btn primary"
                disabled={current < cards.length - 1}
                onClick={() =>
                  runProgram(act, "rules-ack", {
                    ruleVersion: rule.version,
                    understood: true,
                  })
                }
              >
                Yes, I understand
              </button>
            )}
            <details><summary>Ask about a rule</summary><WeekForm
              action="ask"
              act={act}
              values={{ category: "RULES" }}
              fields={[textField("text", "Need clarification?")]}
              submit="Ask MC about the Rules"
            /></details>
            <p className="muted">
              No clarification request is not proof of comprehension. Rules
              tickets are separate from the two daily class questions.
            </p>
          </>
        ) : (
          <p>Your approved Game Rules will appear here.</p>
        )}
      </WeekPanel>
      <WeekPanel title="Shared Rules FAQ">
        {p.faq
          .filter((f) => f.category !== "CLASS")
          .map((f) => (
            <details key={f.id}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
      </WeekPanel>
    </>
  );
}
export function Questions({ data, act, staff = false }) {
  const p = data.weekOneProgram;
  return (
    <>
      <MissionRecovery data={data} act={act} />
      {!staff && <TrophyConduct data={data} act={act}/>}
      <WeekPanel title={staff ? "Questions & escalations" : "Ask MC"}>
        {staff && (
          <WeekForm
            action="group-questions"
            act={act}
            fields={[
              textField("ticketIds", "Classroom ticket IDs (comma-separated)"),
              textField("question", "Approved anonymised group question"),
              textField("answer", "Shared classroom answer"),
              textField(
                "followupAt",
                "Planned discussion time (ISO, optional)",
                true,
              ),
            ]}
            submit="Group questions and publish anonymised answer"
          />
        )}
        {!staff && (
          <>
            <p>
              Two ordinary class questions per day. Rules, access and essential
              support remain available separately.
            </p>
            <QuestionComposer act={act} />
          </>
        )}
        {p.tickets.map((t) => (
          <details className="history-entry" key={t._id}>
            <summary>{t.data.question} · {t.data.status}</summary>
            {staff && <p>Ticket ID: {t._id}</p>}
            <Badge>
              {t.category} · {t.data.status}
            </Badge>
            {staff && (
              <p>
                {p.results.find((r) => r.userId === t.userId)?.name} · Day{" "}
                {t.day} · Assigned to {t.data.assignedTo}
              </p>
            )}
            <h3>{t.data.question}</h3>
            {t.data.replies.map((r) => (
              <p key={r.id}>{r.text}</p>
            ))}
            {staff && (
              <>
                <WeekForm
                  action="reply"
                  act={act}
                  values={{ ticketId: t._id }}
                  fields={[
                    textField("text", "Answer"),
                    {
                      name: "resolve",
                      label: "Status",
                      options: [
                        { value: "false", label: "Answered" },
                        { value: "true", label: "Resolved" },
                      ],
                    },
                  ]}
                  children={
                    t.category === "CLASS" ? (
                      <>
                        <label>
                          Share an anonymised classroom answer
                          <select name="publishAnonymously">
                            <option value="false">
                              Keep this answer private
                            </option>
                            <option value="true">
                              Publish approved anonymous question and answer
                            </option>
                          </select>
                        </label>
                        <label>
                          Approved anonymous question
                          <textarea name="safeQuestion" maxLength={1000} />
                        </label>
                      </>
                    ) : null
                  }
                  submit="Save answer"
                  onSubmit={undefined}
                />
                <WeekForm
                  action="escalate"
                  act={act}
                  values={{ ticketId: t._id }}
                  fields={[textField("reason", "Escalation reason")]}
                  submit="Escalate to Centre Command"
                />
              </>
            )}
          </details>
        ))}
      </WeekPanel>
      <WeekPanel title="Anonymous classroom answers">
        {p.faq
          .filter((f) => f.category === "CLASS")
          .map((f) => (
            <article key={f.id}>
              <h3>{f.question}</h3>
              <p>{f.answer}</p>
            </article>
          ))}
      </WeekPanel>
    </>
  );
}
function QuestionComposer({ act }) {
  const [category, setCategory] = useState(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const choices = [['CLASS', 'Understand a concept'], ['RULES', 'Clarify a rule'], ['ACCESS', 'Fix access or a blocked screen'], ['ESSENTIAL', 'Get essential support']];
  return <div className="question-composer">
    <h3>What do you need help with?</h3>
    <div className="button-row">{choices.map(([id, label]) => <button key={id} className={`btn ${category === id ? 'primary' : ''}`} aria-pressed={category === id} disabled={busy} onClick={() => setCategory(id)}>{label}</button>)}</div>
    {category && <form className="field-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try { if (!await runProgram(act, 'ask', { category, text })) throw Error('Your question was not confirmed. It is kept here so you can retry.'); setText(''); setCategory(null); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }}>
      <label>Tell your MC what happened<textarea autoFocus required minLength={5} maxLength={4000} value={text} onChange={event => setText(event.target.value)} placeholder="I was trying to… I expected… Instead…" /></label>
      {error && <p role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send question to MC'}</button>
    </form>}
  </div>;
}
export function Challenges({ data, act, now }) {
  const p = data.weekOneProgram,
    choices = p.days
      .filter((d) => d.discovery)
      .map((d) => ({
        id: `D${d.day}-DISCOVERY`,
        title: d.discovery.title,
        brief: d.discovery.brief,
        kind: "DAILY",
      }))
      .concat(p.challenges);
  const [selected, setSelected] = useState(null);
  return (
    <>
      <WeekPanel title="Challenges & Rewards">
        <p>
          Genuine research attempts count even when an experiment fails. Opening
          a challenge alone is not an attempt. Optional challenges remain
          available through Week 6.
        </p>
        {choices.map((c) => {
          const record = p.attempts.find((a) => a.activityId === c.id);
          return (
            <div key={c.id}>
              <button className={`btn ${selected === c.id ? 'primary' : ''}`} aria-expanded={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}>{c.title} · {record?.data.submittedAt ? 'Evidence saved' : record ? 'Continue attempt' : 'Inspect challenge'}</button>
              <Badge>{c.kind}</Badge>
              {selected === c.id && (record ? (
                <AttemptForm
                  ownerId={data.user._id}
                  record={record}
                  act={act}
                  now={now}
                  open
                />
              ) : (
                <>
                  <p>{companionText(c.brief)}</p>
                  <button
                    className="btn primary"
                    onClick={() =>
                      runProgram(act, "start-challenge", { challengeId: c.id })
                    }
                  >
                    Start 60-minute attempt
                  </button>
                </>
              ))}
              {record?.data.review && (
                <p>
                  {record.data.review.genuine
                    ? "Genuine attempt verified"
                    : "Evidence needs review"}
                  : {record.data.review.reason}
                </p>
              )}
            </div>
          );
        })}
      </WeekPanel>
      <DayOneRewards data={data} />
      <TrophyLeague trophies={data.user.trophies}/>
      <WeekPanel title="Week 1 trophy evidence">
        <Badge>{p.progression?.mode === "COMPLETION" ? "FLIGHT REWARDS" : "MAXIMUM 140 PROGRAMME TROPHIES"}</Badge>
        {p.progression?.mode === "COMPLETION" && p.days.filter((day)=>day.day > 1).map((day)=><FlightLevelRewards key={day.day} data={data} day={day.day} compact/>)}
        <PlayerVitals player={data.user} />
        {(p.learners[0]?.data.ledger || []).map((e) => (
          <p key={e.id}>
            Day {e.day} · {e.rule}: {e.amount > 0 ? "+" : ""}
            {e.amount} · {weekTime(e.at)}
          </p>
        ))}
      </WeekPanel>
      <PublishedRecognition data={data} />
    </>
  );
}
export function PublishedRecognition({ data }) {
  const published = data.weekOneProgram.publication;
  if (!published) return null;
  return (
    <WeekPanel title="Week 1 recognition">
      <h3>Research Champion · {published.recognition.researchChampion}</h3>
      <h3>Week 1 Champion · {published.recognition.weekChampion}</h3>
      {published.recognition.awards.map((a) => (
        <p key={a.id}>
          {a.name} · {a.recipientName}
        </p>
      ))}
      {published.recognition.examples.map((e) => (
        <article key={e.anonymousId} className="history-entry">
          <h3>Selected learning example</h3>
          <p>{e.summary}</p>
        </article>
      ))}
    </WeekPanel>
  );
}
export function MyResults({ data }) {
  const p = data.weekOneProgram;
  return (
    <>
      {p.results.length ? (
        p.results.map((row) => (
          <ResultCard key={row.userId} row={row} weights={p.settings.weights} />
        ))
      ) : (
        <WeekPanel title="My Results">
          <p>
            Your private results appear after MC signoff and CC approval.
            Assessments may still be pending.
          </p>
        </WeekPanel>
      )}
      {p.publication?.rescue.map((r) => (
        <WeekPanel key={r.userId} title="Saturday rescue">
          {r.status === "BOOKED" ? (
            <>
              <p>
                Your one-hour online slot: {weekTime(r.start)} –{" "}
                {weekTime(r.end)}.
              </p>
              <a
                href={r.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn primary"
              >
                Join approved rescue meeting
              </a>
            </>
          ) : (
            <p>
              Scheduling exception: CC will arrange an approved slot. Team
              allocation remains pending.
            </p>
          )}
        </WeekPanel>
      ))}
      {p.publication?.teams.map((t) => (
        <WeekPanel key={t.id} title="Provisional team">
          <p>
            {t.id} · {t.members.length} members. Allocation remains provisional
            until Saturday outcomes.
          </p>
        </WeekPanel>
      ))}
    </>
  );
}
