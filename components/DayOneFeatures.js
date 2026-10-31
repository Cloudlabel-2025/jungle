"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, Trophy, LockKeyhole, Mic, Search } from "lucide-react";
import { Panel as ExistingPanel, Badge, Form, Receipt, Empty } from "./ui";
import { defaultSetup } from "@/lib/day-one-rules.js";

function Panel({ children, ...props }) {
  return (
    <ExistingPanel {...props}>
      <div
        style={{ padding: "18px 22px", display: "grid", gap: 16, minWidth: 0 }}
      >
        {children}
      </div>
    </ExistingPanel>
  );
}
const fmt = (date, zone = "Asia/Kolkata") => {
  if (!date) return "Pending";
  try {
    return new Date(date).toLocaleString("en-IN", {
      timeZone: zone,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(date).toISOString();
  }
};
const own = (data) =>
  data.dayOne?.records.find((r) => r.userId === data.user._id);
const send = (act, action, record, values = {}) =>
  act(`day1/${action}`, {
    ...values,
    ...(record ? { version: record.version } : {}),
  });
export function isDayOne(data, now = new Date()) {
  return (
    ["OPEN", "CLOSED"].includes(data.dayOne?.state) &&
    !data.weekOne?.days.some((d) => d.day > 1 && d.state === "OPEN")
  );
}
const textField = (name, label, min = 10) => ({
  name,
  label,
  type: "textarea",
  min,
});

export function DayOneCheckIn({ data, act, now }) {
  const r = own(data),
    c = r?.config || data.dayOne?.config;
  if (!c) return null;
  return (
    <Panel
      title="Daily camp check-in"
      kicker="DAY 1 / DISCOVERY MISSION"
      className="punch-panel"
      action={<Clock3 size={19} />}
    >
      <div className="punch-clock">
        {new Date(now).toLocaleTimeString("en-GB", {
          timeZone: c.timeZone,
          hour: "2-digit",
          minute: "2-digit",
        })}
        <span>{c.timeZone}</span>
      </div>
      <p className="muted">
        Clock-in cut-off: {fmt(c.clockCutoff, c.timeZone)}. Day 1 energy stays
        at 5/5.
      </p>
      {r?.clockAt ? (
        <Receipt>
          Clocked in {fmt(r.clockAt, c.timeZone)}. {r.trophies}/20 Day 1
          trophies.
        </Receipt>
      ) : (
        <button
          className="btn primary full"
          disabled={data.dayOne?.state !== "OPEN"}
          onClick={() => send(act, "clock", r)}
        >
          Check in at camp
        </button>
      )}
    </Panel>
  );
}
export function DayOneRewards({ data }) {
  const r = own(data);
  if (!r) return null;
  const names = {
    clock: "On-time clock-in",
    sod: "Start-of-day plan",
    agenda: "Agenda acknowledged within 30 official minutes",
    acknowledge: "Challenge acknowledgement",
    submission: "Verified on-time AI thread",
    eod: "On-time EOD",
  };
  return (
    <Panel
      title="Day 1 discovery rewards"
      kicker="PERSONAL / SEPARATE FROM YOUR RESEARCH BASELINE"
      action={<Badge tone="amber">{r.trophies}/20 TROPHIES</Badge>}
    >
      <div className="button-row">
        <Badge tone="lime">ENERGY 5/5 · NO DEDUCTIONS</Badge>
        <Badge tone={r.badge ? "lime" : ""}>
          FIRST DISCOVERY · {r.badge ? "EARNED" : "PENDING LINK VERIFICATION"}
        </Badge>
        <Badge>
          <LockKeyhole size={12} /> RESEARCH CHAMPION ·{" "}
          {r.champion ? "AWARDED" : "WEEK 1 REVEAL"}
        </Badge>
      </div>
      {r.champion && (
        <div className="journal-entry">
          <h3>Your Research Champion verification prompt</h3>
          <p>{r.champion.prompt}</p>
        </div>
      )}
      <details>
        <summary>Trophy evidence and amendment history</summary>
        {r.ledger.map((l) => (
          <div className="ledger-row" key={l.id}>
            <Trophy size={17} />
            <span>
              <strong>{names[l.rule]}</strong>
              <small>
                {fmt(l.eventTime, r.config.timeZone)} · {l.reason}
              </small>
            </span>
            <b className="lime-text">
              {l.amount > 0 ? "+" : ""}
              {l.amount}
            </b>
          </div>
        ))}
        {!r.ledger.length && (
          <p className="muted">
            Qualifying events appear here as your day progresses.
          </p>
        )}
      </details>
    </Panel>
  );
}
export function DiscoveryMission({ data, act, now }) {
  const r = own(data),
    c = r?.config || data.dayOne?.config;
  if (!c)
    return (
      <Empty title="Discovery mission is being prepared">
        Centre Command can configure and release Day 1 from the existing
        Expedition Setup page.
      </Empty>
    );
  if (!r) return <DayOneCheckIn data={data} act={act} now={now} />;
  const g = c.genres.find((g) => g.id === r.genreId),
    s = r.submissions.at(-1);
  const remaining = r.startedAt
    ? Math.max(0, new Date(r.deadline) - new Date(now))
    : 90 * 60000;
  const timer = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}`;
  return (
    <fieldset
      disabled={data.dayOne?.state !== "OPEN"}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      <Panel
        title="Individual discovery mission"
        kicker="DAY 1 / EXTERNAL AI / 90 MINUTES"
        action={
          <Badge tone="cyan">
            <Clock3 size={14} />
            {timer}
          </Badge>
        }
      >
        <p className="muted">
          Choose a genre, acknowledge the question, then begin your research.
          Your timer persists after refresh and re-login.
        </p>
        {!r.acknowledgedAt && (
          <Form
            key={`genre-${r.version}`}
            fields={[
              {
                name: "genreId",
                label: "Choose your research genre",
                options: c.genres.map((g) => ({ value: g.id, label: g.name })),
              },
            ]}
            initial={{ genreId: r.genreId }}
            submit="Choose genre"
            onSubmit={(v) => send(act, "genre", r, v)}
          />
        )}
        {g && (
          <>
            <div className="journal-entry">
              <Badge>QUESTION V{g.version}</Badge>
              <h3>{g.name}</h3>
              <p>{g.question}</p>
            </div>
            {!r.acknowledgedAt ? (
              <>
                <p className="muted">
                  Available {fmt(r.availableAt, c.timeZone)}. Acknowledge within
                  30 working minutes for +5 trophies, or within 60 for +2.
                </p>
                <button
                  className="btn primary"
                  onClick={() => send(act, "acknowledge", r)}
                >
                  Acknowledge challenge
                </button>
              </>
            ) : (
              <Receipt>
                Acknowledged {fmt(r.acknowledgedAt, c.timeZone)}
              </Receipt>
            )}
          </>
        )}
        {r.acknowledgedAt && !r.startedAt && (
          <>
            <p className="muted">
              Find today's agenda in{" "}
              <Link href="/gamer/daily-journal">
                Meeting Announcements in your journal
              </Link>
              . Acknowledge within 30 minutes of the official start for 4
              trophies.
            </p>
            <button
              className="btn primary"
              onClick={() => send(act, "start", r)}
            >
              Begin 90-minute research
            </button>
          </>
        )}
        {r.startedAt && (
          <>
            <Receipt>
              Research began {fmt(r.startedAt, c.timeZone)}.{" "}
              {remaining > 0
                ? `${timer} remaining.`
                : "The 90-minute window has ended; late work can still earn First Discovery after verification."}
            </Receipt>
            <p className="muted">
              Use an external AI tool and submit one shareable
              conversation-thread URL. Centre Command checks access and enters
              ratings manually.
            </p>
            <ResearchThreadForm
              key={s?.id || r._id}
              record={r}
              act={act}
              open={data.dayOne?.state === "OPEN"}
            />
          </>
        )}
        {s && (
          <>
            <p>
              <Badge
                tone={r.verification?.status === "VERIFIED" ? "lime" : "amber"}
              >
                {r.verification?.status}
              </Badge>{" "}
              <a
                className="text-link"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View submitted AI thread
              </a>
            </p>
            {r.verification?.reason && (
              <p className="muted">{r.verification.reason}</p>
            )}
            <details>
              <summary>Submission revision history</summary>
              {[...r.submissions].reverse().map((s) => (
                <div className="history-entry" key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.url}
                  </a>
                  <p>{s.reason}</p>
                  <small>{fmt(s.at, c.timeZone)}</small>
                </div>
              ))}
            </details>
          </>
        )}
      </Panel>
      <DayOneRewards data={data} />
      <p className="muted">
        <LockKeyhole size={13} /> Your research baseline and ranking remain
        private. Trophies never change your research score.
      </p>
    </fieldset>
  );
}
function ResearchThreadForm({ record, act, open }) {
  const submission = record.submissions.at(-1);
  const initial = record.draft?.url ?? submission?.url ?? "";
  const [url, setUrl] = useState(initial),
    [reason, setReason] = useState("");
  const [status, setStatus] = useState(record.draft ? "Draft restored" : "");
  const [submitting, setSubmitting] = useState(false);
  const queue = useRef(Promise.resolve()),
    saved = useRef(initial);
  useEffect(() => {
    if (!open || submitting || url === saved.current) return;
    const timer = setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          setStatus("Saving draft…");
          const response = await fetch("/api/day1/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Draft could not be saved.");
          saved.current = url;
          setStatus("Draft saved");
        })
        .catch((error) => {
          setStatus(error.message);
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [url, open, submitting]);
  return (
    <form
      className="field-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        await queue.current;
        await send(act, "submit", record, {
          url,
          ...(submission ? { reason } : {}),
        });
        setSubmitting(false);
      }}
    >
      <label>
        External AI conversation-thread URL
        <input
          type="url"
          required
          minLength={10}
          maxLength={2000}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      {submission && (
        <label>
          Reason for revising the link
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      <small role="status">{status}</small>
      <button className="btn primary" disabled={submitting} type="submit">
        {submission ? "Save revised AI thread" : "Submit AI thread"}
      </button>
    </form>
  );
}
function DayOneReflection({ data, act }) {
  const r = own(data),
    [transcript, setTranscript] = useState(""),
    [voice, setVoice] = useState(false),
    [listening, setListening] = useState(false),
    [error, setError] = useState("");
  const recognition = useRef(null),
    root = useRef(null);
  useEffect(() => () => recognition.current?.abort(), []);
  function dictate() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError(
        "Voice dictation is unavailable in this browser. Please type your reflection.",
      );
      return;
    }
    const speech = new Speech();
    recognition.current = speech;
    speech.lang = "en-IN";
    speech.continuous = true;
    setTranscript(
      root.current?.querySelector('textarea[name="text"]')?.value || "",
    );
    speech.onresult = (e) => {
      let words = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) words += e.results[i][0].transcript + " ";
      setTranscript((t) => `${t} ${words}`.trim());
      setVoice(true);
    };
    speech.onend = () => setListening(false);
    speech.onerror = (e) => {
      setError(`Voice dictation: ${e.error}. You can type instead.`);
      setListening(false);
    };
    setListening(true);
    setError("");
    try {
      speech.start();
    } catch {
      setListening(false);
      setError("Dictation could not start. Please use text.");
    }
  }
  return (
    <Panel
      title="Day 1 EOD reflection"
      kicker="TEXT OR REVIEWED VOICE TRANSCRIPT"
    >
      {r.eod ? (
        <>
          <Receipt>
            Saved {fmt(r.eod.at, r.config.timeZone)} · {r.eod.mode}
          </Receipt>
          <p>{r.eod.text}</p>
        </>
      ) : (
        <div ref={root}>
          <p className="muted">
            What did you explore today? What surprised you? What did you verify?
            What would you investigate differently next time?
          </p>
          <button className="btn small" onClick={dictate}>
            <Mic size={14} />
            {listening ? "Stop dictation" : "Dictate reflection"}
          </button>
          {error && (
            <p role="alert" className="danger-text">
              {error}
            </p>
          )}
          {listening && (
            <p role="status">
              Listening. Stop dictation, review the transcript, then save.
            </p>
          )}
          <Form
            key={transcript}
            fields={[textField("text", "Day 1 reflection")]}
            initial={{ text: transcript }}
            submit="Save Day 1 EOD"
            onSubmit={(v) =>
              listening
                ? false
                : send(act, "eod", r, { ...v, mode: voice ? "VOICE" : "TEXT" })
            }
          />
        </div>
      )}
    </Panel>
  );
}
export function DayOneDaily({ data, act, now }) {
  const r = own(data);
  if (!r) return <DayOneCheckIn data={data} act={act} now={now} />;
  return (
    <fieldset
      disabled={data.dayOne?.state !== "OPEN"}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      <Panel title="Meeting Announcements" kicker="DAY 1 AGENDA">
        {data.dayOne.agenda ? (
          <>
            {!r.agendaViewedAt ? (
              <button
                className="btn"
                onClick={() => send(act, "agenda-view", r)}
              >
                Open today's agenda
              </button>
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {data.dayOne.agenda.text}
                </p>
                {r.agendaAcknowledgedAt ? (
                  <Receipt>
                    Agenda acknowledged{" "}
                    {fmt(r.agendaAcknowledgedAt, r.config.timeZone)}
                  </Receipt>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => send(act, "agenda-ack", r)}
                  >
                    I have read today's agenda
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <p className="muted">Today's agenda has not been published yet.</p>
        )}
      </Panel>
      <div className="two-columns">
        <Panel title="Day 1 start-of-day plan" kicker="YOUR RESEARCH PLAN">
          {r.sod ? (
            <>
              <Receipt>Saved {fmt(r.sod.at, r.config.timeZone)}</Receipt>
              <p>{r.sod.text}</p>
            </>
          ) : (
            <Form
              fields={[textField("text", "What will you focus on today?")]}
              submit="Save Day 1 SOD"
              onSubmit={(v) => send(act, "sod", r, v)}
            />
          )}
        </Panel>
        <DayOneReflection data={data} act={act} />
      </div>
      <Panel title="Class by MC" kicker="CLASSROOM PLACEHOLDER">
        <p className="muted">
          Your Mission Commander delivers the class outside CODEWILD. This
          placeholder does not host lesson content.
        </p>
        {r.classAt ? (
          <Receipt>
            Attendance recorded {fmt(r.classAt, r.config.timeZone)}
          </Receipt>
        ) : (
          <button className="btn" onClick={() => send(act, "class", r)}>
            Record class attendance
          </button>
        )}
      </Panel>
      <Panel
        title="Workplace communication"
        kicker="PROVISIONAL MARKER / MC REVIEW"
      >
        <Form
          fields={[textField("text", "Useful response and its context", 20)]}
          submit="Record workplace response"
          onSubmit={(v) => send(act, "response", r, v)}
        />
        {r.responses.map((x, i) => (
          <div className="history-entry" key={i}>
            <p>{x.text}</p>
            <small>{fmt(x.at, r.config.timeZone)}</small>
          </div>
        ))}
      </Panel>
      <DayOneRewards data={data} />
    </fieldset>
  );
}

export function DayOneGameSetup({ data, act }) {
  const d = data.dayOne;
  if (!d?.draft) return null;
  const c = d.needsBaselineUpgrade
      ? {
          ...d.draft,
          rubric: defaultSetup().rubric,
          rubricVersion: defaultSetup().rubricVersion,
          rewardVersion: defaultSetup().rewardVersion,
          officialStart: d.draft.officialStart || "",
        }
      : d.draft,
    fields = [
      { name: "name", label: "Cohort name", min: 2 },
      { name: "day", label: "Day 1 date", type: "date", optional: true },
      { name: "timeZone", label: "IANA time zone" },
      { name: "startTime", label: "Working day starts (HH:MM)" },
      { name: "endTime", label: "Working day ends (HH:MM)" },
      { name: "weekdays", label: "Working weekdays: 0=Sun, 1=Mon … 6=Sat" },
      {
        name: "holidays",
        label: "Holiday dates (comma-separated YYYY-MM-DD)",
        optional: true,
      },
      ...[
        ["availableAt", "Challenge available"],
        ["officialStart", "Official agenda start"],
        ["clockCutoff", "Clock-in cut-off"],
        ["closingCutoff", "EOD closing cut-off"],
        ["revealAfter", "Earliest Week 1 Champion reveal"],
      ].map(([name, label]) => ({
        name,
        label: `${label} (ISO date/time with Z or +05:30)`,
        optional: true,
      })),
      ...c.genres.flatMap((g, i) => [
        { name: `genre${i}`, label: `Genre ${i + 1} name` },
        {
          ...textField(
            `question${i}`,
            `Genre ${i + 1} final research question`,
            20,
          ),
          optional: true,
        },
      ]),
      {
        ...textField(
          "markingInstructions",
          "External-AI marking instructions",
          20,
        ),
        optional: true,
      },
      {
        ...textField(
          "championPrompt",
          "Private Champion advanced verification prompt",
          20,
        ),
        optional: true,
      },
      textField("inaccessiblePolicy", "Inaccessible-link correction policy"),
      {
        name: "action",
        label: "Configuration action",
        options: [
          { value: "save-setup", label: "Save draft" },
          {
            value: "release",
            label: "Validate and prepare a version (hidden from Gamers)",
          },
        ],
      },
    ];
  const initial = {
    ...c,
    weekdays: c.weekdays.join(","),
    holidays: c.holidays.join(","),
    ...Object.fromEntries(
      c.genres.flatMap((g, i) => [
        [`genre${i}`, g.name],
        [`question${i}`, g.question],
      ]),
    ),
  };
  return (
    <Panel
      title="Day 1 discovery configuration"
      kicker="VERSIONED QUESTIONS / RUBRIC / FROZEN REWARDS"
      action={<Badge>{d.state}</Badge>}
    >
      <details>
        <summary>Configure the individual Day 1 mission</summary>
        <p className="muted">
          Prepare four final questions, operating times and assessment prompts.
          Preparation keeps the mission hidden. MC or CC then opens Day 1 from
          the dashboard. Opened content stays pinned to its original version.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Day 1 criterion</th>
                <th>Maximum marks</th>
              </tr>
            </thead>
            <tbody>
              {c.rubric.map((r) => (
                <tr key={r.key}>
                  <td>{r.name}</td>
                  <td>{r.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Each AI and human rating is 0–4. Their average is weighted by the
          criterion maximum. Total 33; 8 other criteria Not Assessed. Energy
          stays 5/5 and trophies cap at 20.
        </p>
        <Form
          key={d.revision}
          fields={fields}
          initial={initial}
          submit="Save Day 1 configuration"
          onSubmit={(v) => {
            const config = {
              ...c,
              ...Object.fromEntries(
                [
                  "name",
                  "day",
                  "timeZone",
                  "startTime",
                  "endTime",
                  "availableAt",
                  "officialStart",
                  "clockCutoff",
                  "closingCutoff",
                  "revealAfter",
                  "markingInstructions",
                  "championPrompt",
                  "inaccessiblePolicy",
                ].map((k) => [k, v[k]]),
              ),
              weekdays: v.weekdays
                .split(",")
                .filter((x) => x.trim())
                .map(Number),
              holidays: v.holidays
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              genres: c.genres.map((g, i) => ({
                ...g,
                name: v[`genre${i}`],
                question: v[`question${i}`],
              })),
            };
            return act(`day1/${v.action}`, { config, revision: d.revision });
          }}
        />
        {d.versions.map((v) => (
          <Receipt key={v.version}>
            Game v{v.version} prepared {fmt(v.releasedAt, c.timeZone)}
          </Receipt>
        ))}
      </details>
    </Panel>
  );
}

function DayOneReview({ person, record: r, data, act }) {
  const cc = data.user.role === "CENTRE_COMMAND",
    s = r.submissions.at(-1);
  const review = (action, v) =>
    send(act, action, r, { ...v, userId: r.userId });
  const ratings = r.config.rubric.flatMap((c, i) => [
    {
      name: `ai${i}`,
      label: `External AI: ${c.name} (0–4, max ${c.max} marks)`,
      type: "number",
      min: 0,
      max: 4,
    },
    {
      name: `human${i}`,
      label: `Human: ${c.name} (0–4, max ${c.max} marks)`,
      type: "number",
      min: 0,
      max: 4,
    },
  ]);
  return (
    <Panel
      title={`${person.name} · Day 1 review`}
      kicker={
        cc
          ? "PRIVATE EVIDENCE / 50-50 BASELINE"
          : "OPERATIONAL MARKERS / AUTHORISED REVIEW"
      }
    >
      <div className="button-row">
        <Badge>{r.trophies}/20 TROPHIES</Badge>
        <Badge tone={r.badge ? "lime" : "amber"}>
          {r.verification?.status || "NO SUBMISSION"}
        </Badge>
        <Badge>ENERGY 5/5</Badge>
      </div>
      <p className="muted">
        Genre:{" "}
        {r.config.genres.find((g) => g.id === r.genreId)?.name || "Pending"}.
        SOD: {fmt(r.sod?.at, r.config.timeZone)}. EOD:{" "}
        {fmt(r.eod?.at, r.config.timeZone)}.
      </p>
      <details>
        <summary>SOD, EOD and workplace evidence</summary>
        <p>{r.sod?.text || "No SOD"}</p>
        <p>{r.eod?.text || "No EOD"}</p>
        {r.responses.map((x, i) => (
          <p key={i}>
            {x.text} · {fmt(x.at, r.config.timeZone)}
          </p>
        ))}
      </details>
      <Form
        key={`markers-${r.version}`}
        fields={[
          {
            name: "marker",
            label: "Behaviour marker",
            options: [
              { value: "sod", label: "Timely SOD" },
              { value: "eod", label: "Timely EOD" },
              { value: "acknowledged", label: "Challenge acknowledgement" },
              { value: "usefulResponse", label: "Useful workplace response" },
            ],
          },
          {
            name: "value",
            label: "Authorised decision",
            options: [
              { value: "true", label: "Observed / met" },
              { value: "false", label: "Not observed / not met" },
            ],
          },
          textField("reason", "Reason and supporting evidence"),
        ]}
        submit="Save marker review"
        onSubmit={(v) => review("markers", { ...v, value: v.value === "true" })}
      />
      {r.startedAt && (
        <Form
          fields={[
            {
              name: "deadline",
              label:
                "Authorised extension deadline (ISO with time-zone offset)",
            },
            textField("reason", "Extension evidence and reason"),
          ]}
          submit="Extend the Day 1 research window"
          onSubmit={(values) => review("extend", values)}
        />
      )}
      {cc && s && (
        <>
          <a
            className="btn"
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View submitted AI thread
          </a>
          <p className="muted">
            Submitted {fmt(s.at, r.config.timeZone)}. Verify access manually
            before marking.
          </p>
          <Form
            key={`verify-${r.version}`}
            fields={[
              {
                name: "status",
                label: "Link access",
                options: [
                  { value: "VERIFIED", label: "Accessible / verified" },
                  {
                    value: "INACCESSIBLE",
                    label: "Inaccessible / correction needed",
                  },
                ],
              },
              textField("reason", "Verification note"),
            ]}
            initial={{ status: r.verification?.status }}
            submit="Save link verification"
            onSubmit={(v) => review("verify", { ...v, revisionId: s.id })}
          />
          {r.verification?.status === "VERIFIED" && (
            <>
              <details>
                <summary>External-AI marking instructions</summary>
                <p>{r.config.markingInstructions}</p>
              </details>
              <Form
                key={`assessment-${r.version}`}
                fields={[
                  ...ratings,
                  textField("notes", "Assessment evidence and rationale"),
                ]}
                initial={{
                  ...Object.fromEntries(
                    r.config.rubric.flatMap((c, i) => [
                      [`ai${i}`, r.assessment?.ai[i] ?? ""],
                      [`human${i}`, r.assessment?.human[i] ?? ""],
                    ]),
                  ),
                  notes: r.assessment?.notes,
                }}
                submit="Save private baseline ratings"
                onSubmit={(v) =>
                  review("assessment", {
                    ai: r.config.rubric.map((_, i) => v[`ai${i}`]),
                    human: r.config.rubric.map((_, i) => v[`human${i}`]),
                    notes: v.notes,
                  })
                }
              />
            </>
          )}
          {r.assessment && (
            <>
              <Receipt>
                Private baseline {r.assessment.total.toFixed(2)}/
                {r.assessment.max}. Other eight criteria Not Assessed.
              </Receipt>
              {r.assessment.approvedAt ? (
                <Badge tone="lime">BASELINE APPROVED</Badge>
              ) : (
                <button
                  className="btn primary"
                  onClick={() => review("approve", {})}
                >
                  Approve private baseline
                </button>
              )}
            </>
          )}
        </>
      )}
      <details>
        <summary>Submission revisions and reward audit</summary>
        {r.submissions.map((s) => (
          <div className="history-entry" key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.url}
            </a>
            <p>
              {fmt(s.at, r.config.timeZone)} · {s.reason}
            </p>
          </div>
        ))}
        {r.ledger.map((l) => (
          <div className="ledger-row" key={l.id}>
            <span>
              {l.rule} · {l.reason}
            </span>
            <b>
              {l.amount > 0 ? "+" : ""}
              {l.amount}
            </b>
          </div>
        ))}
      </details>
    </Panel>
  );
}
export function DayOneCohort({ data, act, now }) {
  const d = data.dayOne,
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  if (!d?.config) return null;
  const cc = data.user.role === "CENTRE_COMMAND",
    people = d.roster
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .map((p) => ({ ...p, r: d.records.find((r) => r.userId === p._id) }))
      .filter(
        (p) =>
          filter === "all" ||
          (filter === "missing" && !p.r?.submissions.length) ||
          (filter === "eod" && !p.r?.eod) ||
          (filter === "review" &&
            p.r?.submissions.length &&
            (!cc || !p.r.assessment?.approvedAt)),
      );
  const person = d.roster.find((p) => p._id === selected),
    record = d.records.find((r) => r.userId === selected),
    champion = d.champion;
  const ranks = [...d.records]
    .filter((r) => r.assessment?.approvedAt)
    .sort((a, b) => b.assessment.total - a.assessment.total);
  return (
    <Panel
      title="Day 1 discovery overview"
      kicker={
        cc
          ? "CENTRE COMMAND / PRIVATE BASELINE & RESULTS"
          : "MISSION COMMANDER / COHORT OPERATIONS"
      }
      action={<Badge>{d.roster.length} GAMERS</Badge>}
    >
      <details>
        <summary>Open Day 1 submissions, markers and reviews</summary>
        <div className="filter-row">
          <label>
            <Search size={14} /> Gamer name
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cohort"
            />
          </label>
          <label>
            Status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Gamers</option>
              <option value="missing">Missing submission</option>
              <option value="eod">Missing EOD</option>
              <option value="review">Review submissions</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Gamer</th>
                <th>Clock-in</th>
                <th>SOD</th>
                <th>Genre</th>
                <th>Submission</th>
                <th>EOD</th>
                <th>Trophies</th>
                {cc && <th>Private baseline</th>}
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{p.r?.clockAt ? "Yes" : "Pending"}</td>
                  <td>{p.r?.markers.sod ? "Met" : "Review"}</td>
                  <td>
                    {p.r?.config.genres.find((g) => g.id === p.r.genreId)
                      ?.name || "Pending"}
                  </td>
                  <td>{p.r?.verification?.status || "Not submitted"}</td>
                  <td>{p.r?.eod ? "Saved" : "Pending"}</td>
                  <td>{p.r?.trophies || 0}/20</td>
                  {cc && (
                    <td>
                      {p.r?.assessment
                        ? `${p.r.assessment.total.toFixed(2)}/${p.r.assessment.max}`
                        : "Not assessed"}
                    </td>
                  )}
                  <td>
                    <button
                      className="btn small"
                      onClick={() => setSelected(p._id)}
                      disabled={!p.r}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {person && record && (
          <DayOneReview
            key={record._id}
            person={person}
            record={record}
            data={data}
            act={act}
          />
        )}
        {cc && (
          <>
            <Panel title="Approved baseline ranking" kicker="PRIVATE / CC ONLY">
              {ranks.map((r) => (
                <div className="ledger-row" key={r.userId}>
                  <b>
                    #
                    {ranks.findIndex(
                      (x) =>
                        Math.abs(x.assessment.total - r.assessment.total) <
                        1e-9,
                    ) + 1}
                  </b>
                  <span>{d.roster.find((p) => p._id === r.userId)?.name}</span>
                  <strong>
                    {r.assessment.total.toFixed(2)}/{r.assessment.max}
                  </strong>
                </div>
              ))}
              {!ranks.length && (
                <p className="muted">No approved baselines yet.</p>
              )}
            </Panel>
            <Panel
              title="Research Champion"
              kicker="PRIVATE DECISION / WEEK 1 RELEASE"
            >
              <p className="muted">
                {d.candidates.length > 1
                  ? "Top baselines are tied. Document the Centre Command selection; no automatic tie-break applies."
                  : "Select only after Day 1 closes and all submitted links have been reviewed."}
              </p>
              {champion?.releasedAt ? (
                <Receipt>
                  Badge and advanced verification prompt released together{" "}
                  {fmt(champion.releasedAt, d.config.timeZone)}.
                </Receipt>
              ) : (
                <>
                  <Form
                    fields={[
                      {
                        name: "userId",
                        label: "Highest approved baseline candidate",
                        options: [
                          { value: "", label: "Choose a candidate" },
                          ...d.roster
                            .filter((p) => d.candidates.includes(p._id))
                            .map((p) => ({ value: p._id, label: p.name })),
                        ],
                      },
                      textField(
                        "reason",
                        "Documented Champion selection reason",
                      ),
                    ]}
                    initial={{
                      userId: champion?.userId,
                      reason: champion?.reason,
                    }}
                    submit="Save private Champion decision"
                    onSubmit={(v) => act("day1/select-champion", v)}
                  />
                  {champion && (
                    <>
                      <p className="muted">
                        Earliest reveal:{" "}
                        {fmt(champion.revealAfter, d.config.timeZone)}.
                      </p>
                      {new Date(now) >= new Date(champion.revealAfter) ? (
                        <Form
                          fields={[
                            textField(
                              "reason",
                              "Confirm Week 1 winner announcement",
                            ),
                          ]}
                          submit="Release Champion badge and prompt together"
                          onSubmit={(v) => act("day1/reveal-champion", v)}
                        />
                      ) : (
                        <Badge>
                          <LockKeyhole size={12} /> LOCKED UNTIL WEEK 1 CLOSE
                        </Badge>
                      )}
                    </>
                  )}
                </>
              )}
            </Panel>
          </>
        )}
        <Panel
          title="Day 1 decision audit"
          kicker="ORIGINAL EVENTS / OLD & NEW VALUES / ACTOR & REASON"
        >
          {d.events.slice(0, 40).map((e) => (
            <details key={e._id}>
              <summary>
                {e.kind} ·{" "}
                {d.roster.find((p) => p._id === e.userId)?.name || "Cohort"} ·{" "}
                {fmt(e.createdAt, d.config.timeZone)}
              </summary>
              <p className="muted">
                Actor {e.actorId} · Event {e._id}
              </p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 280,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(e.details, null, 2)}
              </pre>
            </details>
          ))}
        </Panel>
      </details>
    </Panel>
  );
}
