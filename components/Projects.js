"use client";
import { useState } from "react";
import { Modal, Form, Badge, Panel, Receipt } from "./ui";
import { teamRoles } from "@/lib/team-roles.js";
import LevelEmblem from "./LevelEmblem";
import ProjectPreview from "./ProjectPreview";
import LevelStars from "./LevelStars";
import { CompletionCelebration } from "./LevelCompletion";
import FullStackTasks from "./FullStackTasks";
import {
  projectTaskLabel,
  characterKey,
  fullStackTeamReady,
} from "@/lib/characters";
import { levelsForTeam, previousLevel } from "@/lib/level-definitions.js";

const roleName = (role) =>
  teamRoles.find((r) => r.code === role)?.label || role;
const time = (date) =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
export const starsLabel = (stars = 0) =>
  "★".repeat(stars) + "☆".repeat(3 - stars);
export function projectState(data, level, teamId = data.user.teamId) {
  const attempt = data.projectAttempts?.find(
    (a) => a.teamId === teamId && a.levelId === level._id,
  );
  const previous = previousLevel(
    levelsForTeam(data.projectLevels, teamId),
    level._id,
  );
  const unlocked =
    !previous ||
    data.projectAttempts?.some(
      (a) =>
        a.teamId === teamId &&
        a.levelId === previous._id &&
        a.status === "CLEARED" &&
        a.stars >= 1,
    );
  return {
    attempt,
    state: attempt?.status || (unlocked ? "AVAILABLE" : "LOCKED"),
  };
}

const submissionFields = [
  {
    name: "submissionSummary",
    label: "What works, what you changed, and how you verified it",
    type: "textarea",
    min: 10,
  },
  {
    name: "evidence",
    label: "Evidence references · one per line (1–10)",
    type: "textarea",
    min: 3,
    placeholder: "Repository / pull request / test results / demo reference",
  },
];
const references = (value) =>
  value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export function ProjectTaskDetails({
  task,
  data,
  act,
  staff = data.user.role !== "GAMER",
}) {
  const owner = task.assigneeId === data.user._id;
  const grant = data.projectAttempts
    ?.find((a) => a._id === task.projectAttemptId)
    ?.rewards?.find((r) => r.userId === task.assigneeId);
  return (
    <section className="project-task-detail">
      <Badge>{task.status}</Badge>
      <p className="detail-copy">{task.description}</p>
      <p className="support-copy">
        <strong>Acceptance criteria:</strong> {task.acceptanceCriteria}
      </p>
      <p className="muted">
        {projectTaskLabel(task) || roleName(task.targetRole)} ·{" "}
        {data.roster.find((p) => p._id === task.assigneeId)?.name} · Due{" "}
        {time(task.dueAt)}
      </p>
      <p className="muted">
        Rewards are granted when the team clears the integrated project, using
        team stars and your reviewed contribution.
      </p>
      {task.performanceScore != null && (
        <Receipt>
          Contribution: {task.performanceScore}/100 · Quality{" "}
          {task.performanceScores?.quality}/40 · Verification{" "}
          {task.performanceScores?.verification}/25 · Timeliness{" "}
          {task.performanceScores?.timeliness}/20 · Collaboration{" "}
          {task.performanceScores?.collaboration}/15
        </Receipt>
      )}
      {grant && (
        <Receipt>
          Level reward: {grant.xp} XP and {grant.trophies} trophies.
          {task.targetCharacter &&
            " Awarded once using the average score across your five tasks."}
        </Receipt>
      )}
      {(owner || staff) && task.submittedAt && (
        <article className="challenge-record">
          <h3>Submission {task.submissionVersion}</h3>
          <p>{task.submissionSummary}</p>
          <ul>
            {task.evidenceReferences?.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <small>{time(task.submittedAt)}</small>
        </article>
      )}
      {task.reviewFeedback && (
        <p className="callout">Guide feedback: {task.reviewFeedback}</p>
      )}
      {owner && !staff && !["Review", "Done"].includes(task.status) && (
        <>
          <Form
            fields={[
              {
                name: "preDeadlineStatus",
                label: "Report before the deadline",
                options: ["On Track", "At Risk", "Delayed", "Complete"].map(
                  (value) => ({ value, label: value }),
                ),
              },
            ]}
            submit="Send status report"
            onSubmit={(v) =>
              act("gamer/task-status", { taskId: task._id, ...v })
            }
          />
          {task.status === "Backlog" && (
            <button
              className="btn"
              onClick={() =>
                act("gamer/task-status", {
                  taskId: task._id,
                  status: "In Progress",
                })
              }
            >
              Start my task
            </button>
          )}
          <Form
            fields={submissionFields}
            submit="Submit contribution for review"
            onSubmit={({ evidence, ...v }) =>
              act("gamer/task-status", {
                taskId: task._id,
                status: "Review",
                ...v,
                evidenceReferences: references(evidence),
              })
            }
          />
        </>
      )}
      {staff && task.status === "Review" && (
        <>
          <Form
            fields={[
              {
                name: "quality",
                label: "Correctness and quality · 0–40",
                type: "number",
                min: 0,
                max: 40,
              },
              {
                name: "verification",
                label: "Role-appropriate verification · 0–25",
                type: "number",
                min: 0,
                max: 25,
              },
              {
                name: "timeliness",
                label: "Timeliness · 0–20",
                type: "number",
                min: 0,
                max: 20,
              },
              {
                name: "collaboration",
                label: "Collaboration and handover · 0–15",
                type: "number",
                min: 0,
                max: 15,
              },
              {
                name: "feedback",
                label: "Evidence supporting this assessment",
                type: "textarea",
                min: 10,
              },
            ]}
            submit="Approve and score contribution"
            onSubmit={({ feedback, ...scores }) =>
              act("commander/task", {
                taskId: task._id,
                action: "approve",
                feedback,
                scores,
              })
            }
          />
          <Form
            fields={[
              {
                name: "feedback",
                label: "Required changes",
                type: "textarea",
                min: 10,
              },
            ]}
            submit="Return contribution"
            onSubmit={(v) =>
              act("commander/task", {
                taskId: task._id,
                action: "return",
                ...v,
              })
            }
          />
        </>
      )}
      {staff && task.status === "Done" && !grant && (
        <Form
          fields={[
            {
              name: "feedback",
              label: "Explain the required correction before team clearance",
              type: "textarea",
              min: 10,
            },
          ]}
          submit="Reopen contribution for correction"
          onSubmit={(v) =>
            act("commander/task", { taskId: task._id, action: "reopen", ...v })
          }
        />
      )}
      {staff && task.status !== "Done" && (
        <Form
          fields={[
            {
              name: "userId",
              label: task.targetCharacter
                ? "Reassign this entire feature to its active character holder"
                : "Reassign to an active matching role holder",
              options: data.roster
                .filter(
                  (p) =>
                    p.teamId === task.teamId &&
                    p.active !== false &&
                    (task.targetCharacter
                      ? characterKey(p) === task.targetCharacter
                      : p.teamRoleCode === task.targetRole ||
                        p.assignment === roleName(task.targetRole)),
                )
                .map((p) => ({ value: p._id, label: p.name })),
            },
            {
              name: "reason",
              label: "Reason · previous submission stays in the audit history",
              type: "textarea",
              min: 10,
            },
          ]}
          submit="Reassign task"
          onSubmit={(v) =>
            act("commander/task", {
              taskId: task._id,
              action: "reassign",
              ...v,
            })
          }
        />
      )}
    </section>
  );
}

export function ProjectDialog({
  level: requestedLevel,
  data,
  act,
  close,
  teamId = data.user.teamId,
  onQuest,
  drawer = false,
}) {
  const { attempt, state } = projectState(data, requestedLevel, teamId);
  const level = attempt?.definitionSnapshot || requestedLevel;
  const forming =
    !attempt &&
    level.learningMode === "FULL_STACK" &&
    !fullStackTeamReady(data.roster, teamId);
  const staff = data.user.role !== "GAMER";
  const tasks = data.tasks.filter((t) => t.projectAttemptId === attempt?._id);
  const approved = tasks.filter((t) => t.status === "Done").length;
  const submitted = tasks.filter((t) =>
    ["Review", "Done"].includes(t.status),
  ).length;
  const [openTask, setOpenTask] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [checks, setChecks] = useState({});
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const review = async (action) => {
    if (busy) return;
    setBusy(true);
    try {
      await act(
        "projects/review",
        {
          attemptId: attempt._id,
          action,
          feedback,
          checks: level.criteria.map((_, i) => checks[i] === true),
        },
        action === "approve"
          ? "Team project cleared. Stars and individual rewards recorded."
          : "Project returned with feedback.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Modal
        title={level.name}
        kicker={`TEAM PROJECT ${String(level.number).padStart(2, "0")} · ${data.teams.find((t) => t._id === teamId)?.name || "YOUR TEAM"}`}
        close={close}
        variant={drawer ? "level-drawer" : undefined}
      >
        {drawer && <ProjectPreview level={level} />}
        <div className={drawer ? "level-work-content" : "project-dialog-body"}>
          <div className="project-summary">
            <Badge>{state}</Badge>
          </div>
          <LevelStars attempt={attempt} level={level} />
          {!drawer && (
            <div className="project-hazard-brief">
              <LevelEmblem level={level} />
              <div>
                <span className="eyebrow">
                  TEAM PROJECT · LEVEL {String(level.number).padStart(2, "0")}
                </span>
                <h3>{level.name}</h3>
                <p>Five explorers. One shared project.</p>
              </div>
            </div>
          )}
          <p className="detail-copy">{level.description}</p>
          <p className="muted">
            Budget: {level.hours} working hours · 09:00–17:00 IST,
            Monday–Friday. Build locally in your shared repository; submit
            evidence here.
          </p>
          <h3>Complete project acceptance</h3>
          <ul className="project-criteria">
            {level.criteria.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="muted">
            Base reward per member: {level.baseXp} XP / {level.baseTrophies}{" "}
            trophies × star multiplier (1× / 1.25× / 1.5×) × contribution score
            / 100. Project rewards are separate from daily activity caps.
          </p>
          {state === "LOCKED" && (
            <p className="callout">
              Your team must clear Level {level.number - 1} with at least one
              star first.
            </p>
          )}
          {state === "AVAILABLE" &&
            (forming ? (
              <p className="callout">
                This team is forming. Fill all five character slots before
                starting this level.
              </p>
            ) : (
              <Form
                fields={[]}
                submit="Start level and assign team tasks"
                onSubmit={() =>
                  act(
                    "projects/start",
                    { teamId, levelId: level._id },
                    "Team project started. Feature tasks assigned automatically.",
                  )
                }
              />
            ))}
          {!attempt && level.learningMode === "FULL_STACK" && (
            <FullStackTasks level={level} data={data} teamId={teamId} />
          )}
          {!attempt && level.learningMode !== "FULL_STACK" && (
            <div className="project-role-list">
              {level.tasks.map((t) => (
                <article key={t.targetRole}>
                  <h4>{roleName(t.targetRole)}</h4>
                  <p>{t.instructions}</p>
                </article>
              ))}
            </div>
          )}
          {attempt && (
            <>
              <p className="receipt">
                {approved}/{level.tasks.length} contributions approved
              </p>
              <div className="detail-grid">
                <span>
                  TARGET DEADLINE<strong>{time(attempt.dueAt)}</strong>
                </span>
                <span>
                  TWO-STAR WINDOW ENDS<strong>{time(attempt.lateUntil)}</strong>
                </span>
              </div>
              {level.learningMode === "FULL_STACK" ? (
                <FullStackTasks
                  level={level}
                  data={data}
                  attempt={attempt}
                  onTask={(task) =>
                    onQuest
                      ? (close(), onQuest(task))
                      : setOpenTask(openTask === task._id ? null : task._id)
                  }
                  renderTask={(task) =>
                    openTask === task._id && (
                      <ProjectTaskDetails
                        task={task}
                        data={data}
                        act={act}
                        staff={staff}
                      />
                    )
                  }
                />
              ) : (
                <div className="project-role-list">
                  {tasks.map((t) => (
                    <article key={t._id}>
                      <button
                        className="project-task-trigger"
                        onClick={() =>
                          onQuest
                            ? (close(), onQuest(t))
                            : setOpenTask(openTask === t._id ? null : t._id)
                        }
                      >
                        <span>
                          <strong>{roleName(t.targetRole)}</strong>
                          <small>
                            {
                              data.roster.find((p) => p._id === t.assigneeId)
                                ?.name
                            }
                            {t.assigneeId === data.user._id
                              ? " · Your task"
                              : ""}
                          </small>
                        </span>
                        <Badge>{t.status}</Badge>
                      </button>
                      <p>{t.description}</p>
                      {openTask === t._id && (
                        <ProjectTaskDetails
                          task={t}
                          data={data}
                          act={act}
                          staff={staff}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
              {attempt.feedback && (
                <p className="callout">
                  Integrated project feedback: {attempt.feedback}
                </p>
              )}
              {!staff &&
                attempt.status === "ACTIVE" &&
                submitted === level.tasks.length && (
                  <Form
                    fields={submissionFields}
                    submit="Submit integrated team project"
                    onSubmit={({ evidence, ...v }) =>
                      act(
                        "projects/submit",
                        {
                          attemptId: attempt._id,
                          ...v,
                          evidenceReferences: references(evidence),
                        },
                        "Team project submitted for integration review.",
                      )
                    }
                  />
                )}
              {attempt.submittedAt && (
                <article className="challenge-record">
                  <h3>Integrated submission {attempt.submissionVersion}</h3>
                  <p>{attempt.submissionSummary}</p>
                  <ul>
                    {attempt.evidenceReferences?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <small>Submitted {time(attempt.submittedAt)}</small>
                </article>
              )}
              {attempt.status === "REVIEW" && !staff && (
                <Receipt>
                  Your Guide is checking the integrated application. The
                  submission time is recorded.
                </Receipt>
              )}
              {staff && attempt.status === "REVIEW" && (
                <form
                  className="field-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    review("approve");
                  }}
                >
                  <h3>Verify the integrated application</h3>
                  {level.criteria.map((c, i) => (
                    <label className="project-check" key={c}>
                      <input
                        type="checkbox"
                        checked={!!checks[i]}
                        onChange={(e) =>
                          setChecks({ ...checks, [i]: e.target.checked })
                        }
                      />
                      {c}
                    </label>
                  ))}
                  <label>
                    Review evidence and feedback
                    <textarea
                      required
                      minLength={10}
                      maxLength={4000}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      className="btn primary"
                      disabled={
                        busy || level.criteria.some((_, i) => !checks[i])
                      }
                    >
                      Approve project and award stars
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || feedback.trim().length < 10}
                      onClick={() => review("return")}
                    >
                      Return for integration fixes
                    </button>
                  </div>
                </form>
              )}
              {attempt.status === "CLEARED" && (
                <>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setCelebrating(true)}
                  >
                    Replay level celebration
                  </button>
                  <Receipt>
                    Team level cleared with {attempt.stars} stars.{" "}
                    {levelsForTeam(data.projectLevels, teamId).some(
                      (l) => l.number > level.number,
                    )
                      ? "The next project is unlocked."
                      : "All beginner projects are complete."}
                  </Receipt>
                  <div className="challenge-table-wrap">
                    <table className="challenge-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Contribution</th>
                          <th>XP</th>
                          <th>Trophies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempt.rewards.map((r) => (
                          <tr key={r.userId}>
                            <td>
                              {data.roster.find((p) => p._id === r.userId)
                                ?.name || r.userId}
                            </td>
                            <td>{r.score}/100</td>
                            <td>+{r.xp}</td>
                            <td>+{r.trophies}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Modal>
      {celebrating && attempt?.status === "CLEARED" && (
        <CompletionCelebration
          attempt={attempt}
          data={data}
          close={() => setCelebrating(false)}
        />
      )}
    </>
  );
}

export default function ProjectBoard({ data, act }) {
  const [team, setTeam] = useState(data.user.teamId || data.teams[0]?._id);
  const [selected, setSelected] = useState(null);
  const attempts = data.projectAttempts.filter((a) => a.teamId === team);
  const levels = levelsForTeam(data.projectLevels, team).map(
    (level) =>
      attempts.find((a) => a.levelId === level._id)?.definitionSnapshot ||
      level,
  );
  return (
    <Panel
      title="Team project progression"
      kicker="BEGINNER CHAPTER · BUILD TOGETHER"
    >
      {data.user.role !== "GAMER" && (
        <label className="challenge-filter">
          Team
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setSelected(null);
            }}
          >
            {data.teams.map((t) => (
              <option value={t._id} key={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="muted">
        {attempts.filter((a) => a.status === "CLEARED").length}/{levels.length}{" "}
        projects cleared · {attempts.reduce((n, a) => n + a.stars, 0)}/
        {levels.length * 3} stars
      </p>
      <div className="project-level-grid">
        {levels.map((level) => {
          const { attempt, state } = projectState(data, level, team);
          return (
            <button
              className={`project-level-card ${state.toLowerCase()}`}
              key={level._id}
              onClick={() => setSelected(level)}
            >
              <small>
                LEVEL {String(level.number).padStart(2, "0")} · {level.hours}H
              </small>
              <div className="project-card-hazard">
                <LevelEmblem level={level} />
              </div>
              <h3>{level.name}</h3>
              <LevelStars attempt={attempt} level={level} compact />
              <p>{state === "REVIEW" ? "Awaiting integrated review" : state}</p>
            </button>
          );
        })}
      </div>
      {selected && (
        <ProjectDialog
          key={`${team}:${selected._id}`}
          level={selected}
          data={data}
          act={act}
          teamId={team}
          close={() => setSelected(null)}
        />
      )}
    </Panel>
  );
}
