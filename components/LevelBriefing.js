"use client";
import { useState } from "react";
import { Play, LockKeyhole, Clock3, ArrowRight, Trophy } from "lucide-react";
import { Modal, Badge } from "./ui";
import { ProjectDialog, projectState } from "./Projects";
import LevelStars from "./LevelStars";
import FullStackTasks from "./FullStackTasks";
import { fullStackTeamReady } from "@/lib/characters";
import ProjectPreview from "./ProjectPreview";
import { teamRoles, playerRole } from "@/lib/team-roles";
import { levelsForTeam, previousLevel } from "@/lib/level-definitions";

export default function LevelBriefing({
  level: requestedLevel,
  data,
  act,
  close,
  onQuest,
}) {
  const [working, setWorking] = useState(false),
    [busy, setBusy] = useState(false);
  const { attempt, state } = projectState(data, requestedLevel);
  const level = attempt?.definitionSnapshot || requestedLevel;
  const forming =
    !attempt &&
    level.learningMode === "FULL_STACK" &&
    !fullStackTeamReady(data.roster, data.user.teamId);
  const ownRole = playerRole(data.user);
  const definitions = [...level.tasks].sort(
    (a, b) =>
      Number(b.targetRole === ownRole) - Number(a.targetRole === ownRole),
  );
  const tasks = data.tasks.filter(
    (task) => task.projectAttemptId === attempt?._id,
  );
  const predecessor = previousLevel(
    levelsForTeam(data.projectLevels, data.user.teamId),
    level._id,
  );
  async function play() {
    if (busy || state === "LOCKED" || forming) return;
    setBusy(true);
    try {
      if (state === "AVAILABLE") {
        const result = await act(
          "projects/start",
          { levelId: level._id, teamId: data.user.teamId },
          "Level started. Your team’s feature tasks have been assigned.",
        );
        if (!result) return;
      }
      setWorking(true);
    } finally {
      setBusy(false);
    }
  }
  if (working)
    return (
      <ProjectDialog
        level={level}
        data={data}
        act={act}
        close={close}
        onQuest={onQuest}
        drawer
      />
    );
  return (
    <Modal
      title={level.name}
      kicker={`LEVEL ${String(level.number).padStart(2, "0")} · TEAM PROJECT`}
      close={close}
      variant="level-drawer"
    >
      <div className="level-brief-scroll">
        <ProjectPreview level={level} />
        <div className="level-brief-content">
          <div className="level-brief-meta">
            <Badge>{state}</Badge>
            <span>
              <Clock3 size={13} />
              {level.hours} working hours
            </span>
          </div>
          <LevelStars attempt={attempt} level={level} />
          <section className="level-objective">
            <span className="eyebrow">THE OBJECTIVE</span>
            <p>{level.description}</p>
          </section>
          {level.learningMode === "FULL_STACK" ? (
            <FullStackTasks
              level={level}
              data={data}
              attempt={attempt}
              onTask={
                onQuest
                  ? (task) => {
                      close();
                      onQuest(task);
                    }
                  : undefined
              }
            />
          ) : (
            <section className="level-brief-tasks">
              <span className="eyebrow">YOUR TEAM’S ROLE TASKS</span>
              {definitions.map((definition) => {
                const task = tasks.find(
                  (t) => t.targetRole === definition.targetRole,
                );
                const own = definition.targetRole === ownRole;
                const roleLabel = teamRoles.find(
                  (role) => role.code === definition.targetRole,
                )?.label;
                const member =
                  data.roster.find((p) => p._id === task?.assigneeId) ||
                  data.roster.find(
                    (p) =>
                      p.teamId === data.user.teamId &&
                      p.active !== false &&
                      playerRole(p) === definition.targetRole,
                  );
                return (
                  <article
                    className={own ? "is-own-role" : ""}
                    key={definition.targetRole}
                  >
                    <div className="level-role-heading">
                      <strong>
                        {
                          teamRoles.find(
                            (r) => r.code === definition.targetRole,
                          )?.label
                        }
                      </strong>
                      {own && <Badge>YOUR ROLE</Badge>}
                    </div>
                    {definition.title !== `${level.name} · ${roleLabel}` && (
                      <h3>{definition.title}</h3>
                    )}
                    <p>{definition.instructions}</p>
                    <small>
                      {member?.name || "Assigned when the level starts"}
                      {task ? ` · ${task.status}` : ""}
                    </small>
                    <details>
                      <summary>Acceptance criteria & evidence</summary>
                      <p>{definition.acceptanceCriteria}</p>
                    </details>
                    {task && own && onQuest && (
                      <button
                        className="btn"
                        onClick={() => {
                          close();
                          onQuest(task);
                        }}
                      >
                        Open my task <ArrowRight size={14} />
                      </button>
                    )}
                  </article>
                );
              })}
            </section>
          )}
          <details className="level-success-checks">
            <summary>What the finished project must do</summary>
            <ul>
              {level.criteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </details>
          <div className="level-brief-rewards">
            <Trophy size={16} />
            <span>
              Base reward:{" "}
              <strong>
                {level.baseXp} XP · {level.baseTrophies} trophies
              </strong>
              <small>
                Final rewards depend on team stars and your contribution.
              </small>
            </span>
          </div>
        </div>
      </div>
      <footer className="level-play-footer">
        {forming ? (
          <p>
            This team is forming. Centre Command must fill all five character
            slots before a full-stack level can start.
          </p>
        ) : state === "LOCKED" ? (
          <p>
            <LockKeyhole size={14} />
            Clear {predecessor?.name || "the previous project"} with at least
            one star to unlock this level.
          </p>
        ) : state === "AVAILABLE" ? (
          <p>
            Play starts the team’s clock and assigns each member their{" "}
            {level.learningMode === "FULL_STACK"
              ? "five full-stack tasks"
              : "legacy role task"}
            .
          </p>
        ) : (
          <p>Your team’s progress and assignments are saved.</p>
        )}
        <button
          className="btn primary level-play-button"
          onClick={play}
          disabled={busy || state === "LOCKED" || forming}
          aria-label={`${state === "AVAILABLE" || state === "LOCKED" ? "Play" : "Continue"} ${level.name}`}
        >
          <Play size={17} fill="currentColor" />
          <span>
            {forming
              ? "Waiting for five explorers"
              : busy
                ? "Starting…"
                : state === "AVAILABLE"
                  ? "Play"
                  : state === "LOCKED"
                    ? "Play · Locked"
                    : state === "CLEARED"
                      ? "Review level"
                      : state === "REVIEW"
                        ? "View submission"
                        : "Continue level"}
          </span>
        </button>
      </footer>
    </Modal>
  );
}
