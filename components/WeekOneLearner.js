"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge, Receipt, Form } from "./ui";
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
function Reflection({ questions, saved, onSubmit, title }) {
  const [answers, setAnswers] = useState(questions.map(() => "")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [voice, setVoice] = useState(false);
  const recognition = useRef(null);
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
            setBusy(true);
            await onSubmit(answers, voice ? "VOICE" : "TEXT");
            setBusy(false);
          }}
        >
          {questions.map((q, i) => (
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
          <button className="btn primary" disabled={busy}>
            Save reflection
          </button>
        </form>
      )}
    </WeekPanel>
  );
}
export function MyDay({ data, act }) {
  const p = data.weekOneProgram,
    day = p.days.find((d) => d.state === "OPEN") || p.days.at(-1),
    l = p.learners[0];
  if (!day) return <EmptyWeek />;
  const d = day.day === 1 ? data.dayOne.records[0] : l?.data.days[day.day];
  return (
    <>
      <WeekPanel
        title={`Day ${day.day} · ${day.title}`}
        kicker="MY DAY"
        action={<Badge>{day.state}</Badge>}
      >
        <p>
          Today’s window: {weekTime(day.officialStart)} –{" "}
          {weekTime(day.scheduledEnd)}.
        </p>
        <div className="button-row">
          <Badge tone="lime">ENERGY 5/5</Badge>
          <Badge tone="amber">
            {data.user.weekOneTrophies || 0} / 140 WEEK 1 TROPHIES
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
              disabled={day.state !== "OPEN"}
              onClick={() => runProgram(act, "clock", { day: day.day })}
            >
              Check in
            </button>
          )}
        </WeekPanel>
      )}
      <fieldset
        disabled={day.state !== "OPEN"}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        <WeekPanel title="Start-of-day reflection">
          {d?.sod ? (
            <p>{d.sod.text}</p>
          ) : (
            <WeekForm
              action="sod"
              act={act}
              values={{ day: day.day }}
              fields={[textField("text", "What will you focus on today?")]}
              submit="Save SOD"
            />
          )}
        </WeekPanel>
        <Reflection
          key={`eod-${day.day}`}
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
  if (!p.days.length) return <EmptyWeek />;
  return (
    <>
      {[...p.days].reverse().map((day) => {
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
            ) : !d?.agendaViewedAt ? (
              <button
                className="btn"
                disabled={day.state !== "OPEN"}
                onClick={() => run("agenda-view")}
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
                {d?.recapViews?.[recap.session] ||
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
export function AttemptForm({ record, act, now, open }) {
  const d = record.data,
    activity = d.activity,
    submitted = d.submissions.at(-1);
  const [answers, setAnswers] = useState(d.draft || {}),
    [status, setStatus] = useState(d.savedAt ? "Draft restored" : ""),
    [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve()),
    saved = useRef(JSON.stringify(d.draft || {})),
    revision = useRef(record.version);
  const changed = JSON.stringify(answers),
    expired = new Date(now) > new Date(d.deadline),
    quiz = activity.kind === "QUIZ";
  const canWrite =
    open ||
    d.extensions?.some((e) => new Date(now) <= new Date(e.deadline)) ||
    activity.kind === "CHALLENGE";
  useEffect(() => {
    if (changed === saved.current) revision.current = record.version;
  }, [record.version, changed]);
  useEffect(() => {
    if (
      !canWrite ||
      expired ||
      busy ||
      changed === saved.current ||
      (quiz && d.submittedAt)
    )
      return;
    const timer = setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          setStatus("Saving draft…");
          const response = await fetch("/api/week1/program/attempt-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: record._id,
              attemptVersion: revision.current,
              answers,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          revision.current = result.attemptVersion;
          saved.current = changed;
          setStatus("Draft saved");
        })
        .catch((error) => setStatus(error.message));
    }, 800);
    return () => clearTimeout(timer);
  }, [changed, canWrite, expired, busy, quiz, d.submittedAt]);
  const update = (key, value) =>
    setAnswers((old) => ({ ...old, [key]: value }));
  const remaining = Math.max(0, new Date(d.deadline) - new Date(now));
  return (
    <WeekPanel
      title={activity.name}
      action={
        <Badge>
          {Math.floor(remaining / 60000)}m {Math.floor(remaining / 1000) % 60}s
        </Badge>
      }
    >
      <p style={{ whiteSpace: "pre-wrap" }}>{d.variant?.brief}</p>
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
          setBusy(true);
          await queue.current;
          await runProgram(act, "attempt-submit", {
            attemptId: record._id,
            attemptVersion: revision.current,
            answers,
          });
          setBusy(false);
        }}
      >
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
            ? activity.questions.map((q) => (
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
            : activity.fields.map((key) =>
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
        <small role="status">{status}</small>
        <button
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
        </button>
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
            {day.activities.map((activity) => {
              const record = p.attempts.find(
                (a) => a.activityId === activity.id,
              );
              return record ? (
                <AttemptForm
                  key={record._id}
                  record={record}
                  act={act}
                  now={now}
                  open={day.state === "OPEN"}
                />
              ) : (
                <WeekPanel
                  key={activity.id}
                  title={`Day ${day.day} · ${activity.name}`}
                  kicker={`${activity.durationMinutes} MINUTES`}
                >
                  <p>
                    Your timer begins when you start. This is one persistent
                    attempt.
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
                      day.state === "OPEN"
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
  return (
    <>
      <WeekPanel
        title="Game Rules"
        action={<Badge>VERSION {rule?.version || "PENDING"}</Badge>}
      >
        {rule ? (
          <>
            <p style={{ whiteSpace: "pre-wrap" }}>{rule.text}</p>
            {ack ? (
              <Receipt>
                Acknowledged {weekTime(ack.at)}. Clarification window ends{" "}
                {weekTime(ack.clarificationWindowEnd)}.
              </Receipt>
            ) : (
              <button
                className="btn primary"
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
            <WeekForm
              action="ask"
              act={act}
              values={{ category: "RULES" }}
              fields={[textField("text", "Need clarification?")]}
              submit="Ask MC about the Rules"
            />
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
            <article key={f.id}>
              <h3>{f.question}</h3>
              <p>{f.answer}</p>
            </article>
          ))}
      </WeekPanel>
    </>
  );
}
export function Questions({ data, act, staff = false }) {
  const p = data.weekOneProgram;
  return (
    <>
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
            <WeekForm
              action="ask"
              act={act}
              fields={[
                {
                  name: "category",
                  label: "Question type",
                  options: [
                    { value: "CLASS", label: "Class learning question" },
                    { value: "RULES", label: "Rules clarification" },
                    { value: "ACCESS", label: "Urgent access issue" },
                    { value: "ESSENTIAL", label: "Essential support" },
                  ],
                },
                textField("text", "Your question"),
              ]}
              submit="Send question to MC"
            />
          </>
        )}
        {p.tickets.map((t) => (
          <article className="history-entry" key={t._id}>
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
          </article>
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
              <h3>{c.title}</h3>
              <Badge>{c.kind}</Badge>
              {record ? (
                <AttemptForm record={record} act={act} now={now} open />
              ) : (
                <>
                  <p>{c.brief}</p>
                  <button
                    className="btn primary"
                    onClick={() =>
                      runProgram(act, "start-challenge", { challengeId: c.id })
                    }
                  >
                    Start 60-minute attempt
                  </button>
                </>
              )}
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
      <WeekPanel title="Week 1 trophy evidence">
        <Badge>MAXIMUM 140 · ENERGY 5/5</Badge>
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
