"use client";
import { useState, useEffect, useRef } from "react";
import {
  WeekPanel,
  WeekForm,
  textField,
  weekTime,
  runProgram,
  Evidence,
  JsonImport,
  downloadJson,
} from "./WeekOneShared";

const choice = (name, label, options) => ({
  name,
  label,
  options: options.map((v) =>
    typeof v === "string" ? { value: v, label: v } : v,
  ),
});
const why = textField("reason", "Reason and supporting evidence");
const staffTypes = ["TECHNOLOGY", "FUN"];
const configTemplate = {
  timeZone: "Asia/Kolkata",
  start: "",
  choiceDeadline: "",
  examClose: "",
  meetingUrl: "",
  policyUrl: "",
  policyReference: "",
  orientation: "",
  teamScoreBasis: "FRIDAY",
  lateAccess: "SEQUENTIAL",
  exams: staffTypes.map((type) => ({
    type,
    rubric: "",
    variants: Array.from({ length: 4 }, (_, i) => ({
      id: `${type.toLowerCase()}-${i + 1}`,
      name: `Variant ${i + 1}`,
      question: "",
      reference: "",
    })),
  })),
};

function RecoveryConfig({ r, act, cc }) {
  const [draft, setDraft] = useState({ ...configTemplate, ...r?.draft });
  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <WeekPanel
      title="Saturday recovery configuration"
      kicker="PACK 3A · MC CONTENT / CC APPROVAL"
    >
      <p>
        90-minute class · 20-minute break · two independent 30-minute
        AI-assisted exams.{" "}
        {r?.config
          ? `Approved version ${r.config.version}`
          : "Content Pending — approve all eight variants before release."}
      </p>
      <JsonImport
        title="Import session and exam JSON"
        onImport={async (value) => {
          setDraft(value);
        }}
      />
      <button
        className="btn"
        onClick={() => downloadJson(draft, "recovery-curriculum.json")}
      >
        Download editable content pack
      </button>
      <form
        className="field-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await runProgram(act, "recovery-save-config", { config: draft });
        }}
      >
        {[
          ["start", "Saturday start (ISO with time-zone offset)"],
          ["choiceDeadline", "Continue / Leave response deadline (ISO)"],
          ["examClose", "Last permitted exam start (ISO)"],
          ["timeZone", "IANA time zone"],
          ["meetingUrl", "Approved HTTPS meeting link"],
          ["policyUrl", "Institution HTTPS policy link"],
          ["policyReference", "Institution approval reference"],
          ["orientation", "Monday orientation notice"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={draft[key] || ""}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <label>
          Exam order policy
          <select
            value={draft.lateAccess || "SEQUENTIAL"}
            onChange={(e) => update("lateAccess", e.target.value)}
          >
            <option value="SEQUENTIAL">Technology followed by Fun</option>
            <option value="WINDOW">
              Either exam first within approved access window
            </option>
          </select>
        </label>
        <label>
          Recovered learner team bands
          <select
            value={draft.teamScoreBasis || "FRIDAY"}
            onChange={(e) => update("teamScoreBasis", e.target.value)}
          >
            <option value="FRIDAY">Original Friday scores</option>
            <option value="RECOVERY">
              Approved recovery scores for recovered learners
            </option>
          </select>
        </label>
        {(draft.exams || []).map((exam, index) => (
          <details key={exam.type}>
            <summary>{exam.type} · Four exam variants</summary>
            <label>
              Approved rubric and assessment instructions
              <textarea
                value={exam.rubric || ""}
                onChange={(e) => {
                  const next = structuredClone(draft);
                  next.exams[index].rubric = e.target.value;
                  setDraft(next);
                }}
              />
            </label>
            {exam.variants.map((v, i) => (
              <fieldset key={i}>
                <legend>Variant {i + 1}</legend>
                {["id", "name", "question", "reference"].map((key) => (
                  <label key={key}>
                    {key === "reference"
                      ? "Private reference answer / valid alternatives"
                      : key}
                    <textarea
                      value={v[key]}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.exams[index].variants[i][key] = e.target.value;
                        setDraft(next);
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </details>
        ))}
        <button className="btn primary">Save MC/CC content draft</button>
      </form>
      {cc && (
        <WeekForm
          action="recovery-approve-config"
          act={act}
          fields={[why]}
          submit="Validate and approve saved session / exam version"
        />
      )}
      {cc && (
        <WeekForm
          action="recovery-session-link"
          act={act}
          fields={[
            textField("meetingUrl", "Replacement approved HTTPS session link"),
            why,
          ]}
          submit="Approve audited meeting-link correction"
        />
      )}
    </WeekPanel>
  );
}
function RecoveryExam({ p, exam, act, now }) {
  const a = p.attempts[exam.type],
    [variant, setVariant] = useState(exam.variants[0]?.id || ""),
    [answers, setAnswers] = useState(
      a?.draft || { response: "", evidence: "" },
    ),
    [message, setMessage] = useState("");
  const pending = useRef(Promise.resolve()),
    lastSaved = useRef(
      JSON.stringify(a?.draft || { response: "", evidence: "" }),
    );
  const encoded = JSON.stringify(answers),
    expired = a && new Date(now) > new Date(a.deadline);
  useEffect(() => {
    if (
      !a ||
      a.status !== "STARTED" ||
      expired ||
      encoded === lastSaved.current
    )
      return;
    const timer = setTimeout(() => {
      pending.current = pending.current.then(async () => {
        const result = await runProgram(act, "recovery-save", {
          type: exam.type,
          answers: JSON.parse(encoded),
        });
        if (result) {
          lastSaved.current = encoded;
          setMessage("Draft saved");
        }
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [encoded, a?.id, a?.status, expired, act, exam.type]);
  return (
    <WeekPanel title={`${exam.type} recovery exam`}>
      {!a ? (
        <>
          <p>
            Choose one approved variant. Your independent 30-minute timer starts
            on Start.
          </p>
          <label>
            Scenario
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
            >
              {exam.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn primary"
            onClick={() =>
              runProgram(act, "recovery-start", {
                type: exam.type,
                variantId: variant,
              })
            }
          >
            Start {exam.type} exam
          </button>
        </>
      ) : (
        <>
          <p>
            {a.variant.name} · {a.status} · Deadline {weekTime(a.deadline)}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.variant.question}</p>
          <p>
            Remaining:{" "}
            {Math.max(
              0,
              Math.ceil((new Date(a.deadline) - new Date(now)) / 60000),
            )}{" "}
            minutes. AI use is permitted.
          </p>
          <form
            className="field-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await pending.current;
              await runProgram(act, "recovery-submit", {
                type: exam.type,
                answers,
              });
            }}
          >
            <label>
              Investigation response
              <textarea
                required
                minLength={20}
                maxLength={16000}
                disabled={a.status !== "STARTED" || expired}
                value={answers.response || ""}
                onChange={(e) =>
                  setAnswers((v) => ({ ...v, response: e.target.value }))
                }
              />
            </label>
            <label>
              AI conversation, sources and verification evidence
              <textarea
                required
                minLength={10}
                maxLength={4000}
                disabled={a.status !== "STARTED" || expired}
                value={answers.evidence || ""}
                onChange={(e) =>
                  setAnswers((v) => ({ ...v, evidence: e.target.value }))
                }
              />
            </label>
            <p role="status">
              {message}
              {expired
                ? " · Timer expired; retained evidence awaits review."
                : ""}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="btn"
                disabled={a.status !== "STARTED" || expired}
                onClick={() =>
                  runProgram(act, "recovery-save", { type: exam.type, answers })
                }
              >
                Save draft
              </button>
              <button
                className="btn primary"
                disabled={a.status !== "STARTED" || expired}
              >
                Submit {exam.type}
              </button>
            </div>
          </form>
        </>
      )}
    </WeekPanel>
  );
}
export function RecoveryLearner({ data, act, now, screen }) {
  const r = data.weekOneProgram.recovery,
    p = r?.participants[0];
  if (!r?.policy) return null;
  return (
    <>
      <WeekPanel title="Saturday recovery & team formation" kicker="PACK 3A">
        <p>
          Week 1 clearance: 60%. Your original Friday marks remain unchanged.
        </p>
        {!p ? (
          <p>
            {data.weekOneProgram.publication
              ? "Week 1 cleared. Await CC-approved team publication."
              : "Friday assessment and approval pending."}
          </p>
        ) : (
          <>
            <p>
              Friday: {p.fridayScore}% · {p.state.replaceAll("_", " ")}
            </p>
            {p.verificationOverdue && (
              <p>
                Verification Pending · escalated to Centre Command after 24
                hours.
              </p>
            )}
            {r.config && (
              <>
                <p>
                  Shared session: {weekTime(r.config.start)} ·{" "}
                  {r.config.timeZone} · 2h50m.
                </p>
                <p>Response deadline: {weekTime(r.config.choiceDeadline)}.</p>
                <div className="button-row">
                  <a
                    className="btn"
                    href={r.config.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open approved session
                  </a>
                  <a
                    className="btn"
                    href={r.config.policyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Institution policy
                  </a>
                </div>
              </>
            )}
            {!p.choice && p.state === "RECOVERY_REQUIRED" && (
              <div className="button-row">
                <button
                  className="btn primary"
                  onClick={() =>
                    runProgram(act, "recovery-choice", { choice: "CONTINUE" })
                  }
                >
                  Continue with recovery
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    runProgram(act, "recovery-choice", { choice: "LEAVE" })
                  }
                >
                  Request Leave
                </button>
              </div>
            )}
            {p.choice && (
              <p>
                Recorded choice: {p.choice.value} · {weekTime(p.choice.at)}.
                Withdrawal requests require an institution decision.
              </p>
            )}
            <p>
              Session:{" "}
              {r.session?.state?.replaceAll("_", " ") || "Awaiting MC release"}{" "}
              · Attendance: {p.attendance?.status || "Pending"}
            </p>
            {p.decision ? (
              <p>
                Approved recovery result: {p.decision.total}% ·{" "}
                {p.decision.status.replaceAll("_", " ")}. Technology:{" "}
                {p.attempts.TECHNOLOGY?.assessment?.score}%; Fun:{" "}
                {p.attempts.FUN?.assessment?.score}%.
              </p>
            ) : (
              <p>
                Recovery result: Pending. Both genuine exams and MC/CC
                verification are required.
              </p>
            )}
          </>
        )}
        {!r.published ? (
          <p>Team Pending — membership appears after CC publication.</p>
        ) : (
          r.team.map((t) => (
            <div key={t.id}>
              <h3>{t.id}</h3>
              <p>{t.members.map((m) => m.name).join(" · ")}</p>
              <p>
                {t.credits} extra team-shared support credits per working day
                from Week 2. Unused credits do not carry forward.
              </p>
              <p>{r.config?.orientation}</p>
            </div>
          ))
        )}
        {r.rewards.map((v) => (
          <p key={v.id}>
            {v.name} · {v.amount} Saturday trophies
          </p>
        ))}
      </WeekPanel>
      {["dashboard", "games"].includes(screen) &&
        p?.choice?.value === "CONTINUE" &&
        r.config?.exams.map((exam) => (
          <RecoveryExam
            key={`${exam.type}:${p.attempts[exam.type]?.id || "new"}`}
            p={p}
            exam={exam}
            act={act}
            now={now}
          />
        ))}
    </>
  );
}
export function RecoveryStaff({ data, act, screen }) {
  const r = data.weekOneProgram.recovery,
    cc = data.user.role === "CENTRE_COMMAND",
    [override, setOverride] = useState(""),
    [rewardRules, setRewardRules] = useState("[]");
  if (!r?.policy)
    return cc && ["setup", "results"].includes(screen) ? (
      <WeekPanel title="Activate Saturday Recovery · Pack 3A">
        <p>
          Apply the approved 60% policy. Existing published results require
          fresh MC signoff and CC publication; historical scores are preserved.
        </p>
        <WeekForm
          action="recovery-policy"
          act={act}
          fields={[why]}
          submit="Activate Pack 3A policy"
        />
      </WeekPanel>
    ) : null;
  const proposal = r.proposals?.at(-1),
    personOptions = r.participants.map((p) => ({
      value: p.userId,
      label: p.name,
    }));
  return (
    <>
      {(screen === "setup" || screen === "announcements") && (
        <RecoveryConfig r={r} act={act} cc={cc} />
      )}
      {["dashboard", "announcements"].includes(screen) && (
        <WeekPanel title="Saturday recovery monitor">
          <p>
            Approved session: {weekTime(r.config?.start)} ·{" "}
            {r.session?.state || "Not started"}
          </p>
          {cc && (
            <WeekForm
              action="recovery-invite"
              act={act}
              fields={[]}
              submit="Reconcile automatic invitations from locked Friday results"
            />
          )}
          {r.config && (
            <WeekForm
              action="recovery-session"
              act={act}
              fields={[
                choice("state", "Session transition", [
                  "CLASS_STARTED",
                  "CLASS_COMPLETED",
                  "EXAMS_OPEN",
                ]),
              ]}
              submit="Record session transition"
            />
          )}
          {r.participants.map((p) => (
            <p key={p.userId}>
              {p.name} · {p.state} · {p.choice?.value || "No response"} ·{" "}
              {p.attendance?.status || "Attendance Pending"} · Technology{" "}
              {p.attempts.TECHNOLOGY?.status || "Not started"} / Fun{" "}
              {p.attempts.FUN?.status || "Not started"}
              {p.verificationOverdue
                ? " · Verification overdue — CC escalation"
                : ""}
            </p>
          ))}
          {personOptions.length > 0 && (
            <>
              <WeekForm
                action="recovery-attendance"
                act={act}
                fields={[
                  choice("userId", "Gamer", personOptions),
                  choice("status", "Attendance", ["ATTENDED", "ABSENT"]),
                  why,
                ]}
                submit="Record attendance"
              />
              <WeekForm
                action="recovery-issue"
                act={act}
                fields={[
                  choice("userId", "Gamer", personOptions),
                  textField("text", "Escalated technical or attendance issue"),
                ]}
                submit="Escalate issue to CC"
              />
            </>
          )}
          {r.incidents?.map((v) => (
            <p key={v.id}>
              {v.userId}: {v.text} · {v.status}
            </p>
          ))}
        </WeekPanel>
      )}
      {screen === "assessments" && (
        <WeekPanel title="Recovery assessment · two exam batches">
          <p>
            MC approves safe de-identified evidence before exporting. ≤50%,
            ≥85%, incomplete or unreliable evidence requires human review.
          </p>
          <WeekForm
            action="unused"
            act={async (_route, body) => {
              const response = await runProgram(act, "recovery-export", body);
              if (response?.report)
                downloadJson(response.report, `recovery-${body.type}.json`);
              return response;
            }}
            fields={[choice("type", "Exam type", staffTypes), why]}
            submit="Approve evidence and export anonymous batch"
          />
          <JsonImport
            title="Import external-AI JSON"
            onImport={(report) =>
              runProgram(act, "recovery-import", { report })
            }
          />
          {r.participants.map((p) => (
            <details key={p.userId}>
              <summary>
                {p.name} · {p.state}
                {p.verificationOverdue ? " · Verification Pending >24h" : ""}
              </summary>
              {Object.entries(p.attempts).map(([type, a]) => (
                <div key={type}>
                  <h3>
                    {type} · {a.status}
                  </h3>
                  <Evidence value={a.submission?.answers || a.draft} />
                  <p>
                    {a.assessment
                      ? `${a.assessment.score}% · ${a.assessment.verified ? "Verified" : "Human review required"} · ${a.assessment.feedback}`
                      : "Assessment pending"}
                  </p>
                  {a.assessment && (
                    <WeekForm
                      action="recovery-review"
                      act={act}
                      values={{ userId: p.userId, type }}
                      fields={[
                        {
                          name: "score",
                          label: "Verified percentage",
                          type: "number",
                          min: 0,
                          max: 100,
                        },
                        choice("genuine", "Genuine assessable attempt", [
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]),
                        why,
                      ]}
                      submit="Record reasoned human review"
                    />
                  )}
                  <WeekForm
                    action="recovery-extend"
                    act={act}
                    values={{ userId: p.userId, type }}
                    fields={[
                      textField("deadline", "New future deadline (ISO)"),
                      why,
                    ]}
                    submit="Approve technical extension"
                  />
                </div>
              ))}
              {!cc && (
                <WeekForm
                  action="recovery-signoff"
                  act={act}
                  values={{ userId: p.userId }}
                  fields={[why]}
                  submit="MC signoff recovery result"
                />
              )}
              {cc && (
                <WeekForm
                  action="recovery-approve-result"
                  act={act}
                  values={{ userId: p.userId }}
                  fields={[why]}
                  submit="CC approve and lock recovery result"
                />
              )}
            </details>
          ))}
        </WeekPanel>
      )}
      {screen === "results" && (
        <>
          <WeekPanel title="Institution decisions & eligible roster">
            {cc && (
              <WeekForm
                action="recovery-reconcile-results"
                act={act}
                fields={[why]}
                submit="Reconcile recovery history with corrected Friday results"
              />
            )}
            {cc && personOptions.length > 0 && (
              <WeekForm
                action="recovery-institution"
                act={act}
                fields={[
                  choice("userId", "Gamer", personOptions),
                  choice("status", "Institution decision", [
                    "PENDING",
                    "RESOLVED",
                    "CONTINUE",
                    "WITHDRAWN",
                  ]),
                  textField(
                    "reference",
                    "Institution approval / policy reference",
                  ),
                  why,
                ]}
                submit="Record institution-authorised decision"
              />
            )}
            {r.participants.map((p) => (
              <p key={p.userId}>
                {p.name} · {p.state} · {p.decision?.total ?? "Pending"}
                {p.signoff ? " · MC signed off" : ""}
              </p>
            ))}
            {cc && (
              <WeekForm
                action="recovery-lock-eligible"
                act={act}
                fields={[why]}
                submit="Lock eligible roster; hold unresolved cases outside teams"
              />
            )}
            <p>Eligible roster: {r.eligible?.rows.length ?? "Not locked"}</p>
          </WeekPanel>
          <WeekPanel title="Balanced teams · MC review / CC publication">
            {cc && (
              <WeekForm
                action="recovery-generate-teams"
                act={act}
                fields={[why]}
                submit="Generate audited 3–5-member team proposal"
              />
            )}
            {proposal?.teams.map((t) => (
              <p key={t.id}>
                {t.id} ·{" "}
                {t.members
                  .map(
                    (id) =>
                      r.eligible?.rows.find((v) => v.userId === id)?.name || id,
                  )
                  .join(" · ")}{" "}
                · {t.credits} daily support credits from Week 2
              </p>
            ))}
            {proposal && !cc && (
              <>
                <label>
                  Optional override teams JSON (leave empty to accept proposal)
                  <textarea
                    value={override}
                    onChange={(e) => setOverride(e.target.value)}
                  />
                </label>
                <WeekForm
                  action="recovery-team-review"
                  act={async (route, body) => {
                    let teams;
                    try {
                      teams = override ? JSON.parse(override) : undefined;
                    } catch {
                      throw new Error("Enter valid team JSON.");
                    }
                    return act(route, { ...body, teams });
                  }}
                  fields={[why]}
                  submit="Submit MC review / reasoned override request"
                />
              </>
            )}
            {proposal && cc && (
              <>
                {proposal.review?.teams && (
                  <>
                    <Evidence
                      value={{
                        requestedTeams: JSON.stringify(proposal.review.teams),
                        reason: proposal.review.reason,
                      }}
                    />
                    <WeekForm
                      action="recovery-team-override"
                      act={act}
                      fields={[
                        choice("approve", "Override decision", [
                          { value: "true", label: "Approve" },
                          { value: "false", label: "Reject" },
                        ]),
                        why,
                      ]}
                      submit="Decide MC override"
                    />
                  </>
                )}
                <WeekForm
                  action="recovery-lock-teams"
                  act={act}
                  fields={[why]}
                  submit="CC lock reviewed teams"
                />
                <WeekForm
                  action="recovery-publish-teams"
                  act={act}
                  fields={[why]}
                  submit="Publish all approved teams"
                />
                {r.published && (
                  <WeekForm
                    action="recovery-amend-roster"
                    act={act}
                    fields={[why]}
                    submit="Open audited roster amendment"
                  />
                )}
              </>
            )}
            <p>
              {r.published
                ? `Published version ${r.published.version}`
                : "Team proposals hidden from Gamers"}
            </p>
          </WeekPanel>
        </>
      )}
      {screen === "rewards" && cc && (
        <WeekPanel title="Saturday recognition">
          <p>
            {r.rewardRules?.length
              ? "Configured rules require verified CC-approved recovery results."
              : "Not Configured — no Saturday prize quantities are invented."}
          </p>
          <p>
            Rule JSON fields: id, name, amount (trophies), minimum (60–100),
            eligibility.
          </p>
          <textarea
            aria-label="Saturday reward rules JSON"
            value={rewardRules}
            onChange={(e) => setRewardRules(e.target.value)}
          />
          <WeekForm
            action="recovery-reward-rules"
            act={async (route, body) =>
              act(route, { ...body, rules: JSON.parse(rewardRules) })
            }
            fields={[why]}
            submit="Approve reward rules"
          />
          {!!r.rewardRules?.length && (
            <WeekForm
              action="recovery-reward"
              act={act}
              fields={[
                choice("userId", "Gamer", personOptions),
                choice(
                  "ruleId",
                  "Approved reward rule",
                  r.rewardRules.map((v) => ({ value: v.id, label: v.name })),
                ),
                why,
              ]}
              submit="Verify and issue Saturday recognition"
            />
          )}
        </WeekPanel>
      )}
    </>
  );
}
