"use client";
import { Badge, Form, Receipt } from "./ui";
import {
  WeekPanel,
  WeekForm,
  runProgram,
  textField,
  weekTime,
} from "./WeekOneShared";
import { personOptions } from "./WeekOneAdmin";

export default function Showcase({ data, act, now, staff = false }) {
  const p = data.weekOneProgram;
  const name = (id) => p.results.find((r) => r.userId === id)?.name || id;
  return (
    <>
      <WeekPanel title="Research Showcase">
        <p>
          Five temporary presentation groups. Read approved anonymous work
          before voting. Every learner presents once during Week 1. Votes do not
          earn readiness marks.
        </p>
        {staff && !p.rounds.length && (
          <Form
            fields={personOptions(data).map((person) => ({
              name: person.value,
              label: `${person.label} presentation group`,
              options: [1, 2, 3, 4, 5].map((i) => ({
                value: String(i),
                label: `Group ${i}`,
              })),
            }))}
            initial={Object.fromEntries(
              personOptions(data).map((person, i) => [
                person.value,
                String(Math.floor(i / 5) + 1),
              ]),
            )}
            submit="Set five temporary groups of five"
            onSubmit={(v) =>
              runProgram(act, "showcase-groups", {
                groups: [1, 2, 3, 4, 5].map((i) => ({
                  members: personOptions(data)
                    .filter((person) => v[person.value] === String(i))
                    .map((person) => person.value),
                })),
              })
            }
          />
        )}
        {!staff && (
          <p>
            {p.groups[0]?.name ||
              "MC will assign your temporary presentation group."}
          </p>
        )}
        {staff && p.groups.length > 0 && (
          <WeekForm
            action="share-work"
            act={act}
            fields={[
              {
                name: "day",
                label: "Showcase day",
                type: "number",
                min: 1,
                max: 5,
              },
              {
                name: "groupId",
                label: "Presentation group",
                options: p.groups.map((g) => ({ value: g.id, label: g.name })),
              },
              {
                name: "userId",
                label: "Consenting eligible researcher",
                options: personOptions(data),
              },
              {
                name: "activityId",
                label: "Submitted research source",
                options: [
                  "D1-R01",
                  "D2-G01",
                  "D2-G02",
                  "D3-G01",
                  "D3-G02",
                  "D4-G01",
                  "D4-G02",
                  "D5-F01",
                ].map((id) => ({ value: id, label: id })),
              },
              textField("summary", "Approved anonymous research summary"),
            ]}
            submit="Share safe research before voting"
          />
        )}
      </WeekPanel>
      {p.rounds.map((r) => (
        <WeekPanel
          key={r.id}
          title={`Day ${r.day} · ${p.groups.find((g) => g.id === r.groupId)?.name || "Your group"}`}
          action={
            <Badge>
              {r.kind} · {r.state} · ROUND {r.round}
            </Badge>
          }
        >
          {r.candidates.map((c, i) => (
            <article key={c.id} className="history-entry">
              <h3>
                Research {i + 1}
                {staff ? ` · ${name(c.userId)}` : c.own ? " · Your work" : ""}
              </h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{c.summary}</p>
              {!staff && (
                <div className="button-row">
                  <button
                    className="btn small"
                    disabled={c.read}
                    onClick={() =>
                      runProgram(act, "showcase-read", {
                        day: r.day,
                        groupId: r.groupId,
                        candidateId: c.id,
                      })
                    }
                  >
                    {c.read ? "Read" : "Mark as read"}
                  </button>
                  {r.state === "OPEN" && (
                    <button
                      className="btn small primary"
                      disabled={
                        r.voted ||
                        c.own ||
                        r.candidates.some((v) => !v.read) ||
                        new Date(now) > new Date(r.voteEndsAt)
                      }
                      onClick={() =>
                        runProgram(act, "vote", {
                          day: r.day,
                          groupId: r.groupId,
                          candidateId: c.id,
                        })
                      }
                    >
                      Cast my secret ballot
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
          {!staff && r.voted && (
            <Receipt>Your secret ballot is recorded for this round.</Receipt>
          )}
          {!staff && r.selected && (
            <Receipt>
              You are selected to present your research and answer approved
              questions.
            </Receipt>
          )}
          {r.voteEndsAt && (
            <p className="muted">Ballot deadline: {weekTime(r.voteEndsAt)}</p>
          )}
          {staff && (
            <>
              {["SHARED", "REVOTE_REQUIRED"].includes(r.state) && (
                <WeekForm
                  action="open-vote"
                  act={act}
                  values={{ day: r.day, groupId: r.groupId }}
                  fields={[
                    {
                      name: "voteEndsAt",
                      label: "Ballot deadline (ISO with time-zone offset)",
                    },
                  ]}
                  submit={
                    r.state === "REVOTE_REQUIRED"
                      ? "Open rapid repeat ballot"
                      : "Open anonymous voting"
                  }
                />
              )}
              {r.state === "OPEN" && (
                <WeekForm
                  action="close-vote"
                  act={act}
                  values={{ day: r.day, groupId: r.groupId }}
                  fields={[
                    {
                      name: "candidateId",
                      label:
                        "Presenter selection (required for a tie or empty repeat ballot)",
                      options: [
                        {
                          value: "",
                          label: "Use the unique winning researcher",
                        },
                        ...r.candidates.map((c) => ({
                          value: c.id,
                          label: name(c.userId),
                        })),
                      ],
                    },
                    {
                      name: "unavailable",
                      label: "Unavailable-presenter exception",
                      options: [
                        { value: "false", label: "No exception" },
                        {
                          value: "true",
                          label: "Winning presenter is unavailable",
                        },
                      ],
                    },
                    textField(
                      "reason",
                      "Reason for a tied, empty or unavailable-presenter decision",
                      true,
                    ),
                  ]}
                  submit="Close ballot and select presenter"
                />
              )}
              {r.selectedUserId && (
                <>
                  <p>Selected presenter: {name(r.selectedUserId)}</p>
                  <WeekForm
                    action="score-showcase"
                    act={act}
                    values={{ day: r.day, groupId: r.groupId }}
                    fields={[
                      {
                        name: "understanding",
                        label: "Understanding own research",
                        type: "number",
                        min: 0,
                        max: 4,
                      },
                      {
                        name: "reasoning",
                        label: "Answering and reasoning",
                        type: "number",
                        min: 0,
                        max: 4,
                      },
                      {
                        name: "clarity",
                        label: "Clarity",
                        type: "number",
                        min: 0,
                        max: 2,
                      },
                      textField("reason", "Presentation and Q&A evidence"),
                    ]}
                    submit="Save 4 / 4 / 2 Showcase assessment"
                  />
                </>
              )}
            </>
          )}
          {!staff && (
            <WeekForm
              action="showcase-question"
              act={act}
              values={{ day: r.day, groupId: r.groupId }}
              fields={[textField("text", "Propose a meaningful peer question")]}
              submit="Submit question for MC approval"
            />
          )}
          {r.questions.map((q) => (
            <article key={q.id} className="history-entry">
              <p>
                {q.safeText || q.text} · {q.status}
              </p>
              {staff && q.status === "PENDING" && (
                <WeekForm
                  action="approve-question"
                  act={act}
                  values={{ day: r.day, groupId: r.groupId, questionId: q.id }}
                  initial={{ safeText: q.text, askedBy: "MC" }}
                  fields={[
                    textField("safeText", "Approved question wording"),
                    {
                      name: "askedBy",
                      label: "Who asks the approved question?",
                      options: [
                        { value: "MC", label: "Mission Commander" },
                        ...personOptions(data),
                      ],
                    },
                  ]}
                  submit="Approve peer question"
                />
              )}
            </article>
          ))}
        </WeekPanel>
      ))}
    </>
  );
}
