"use client";
import { Badge } from "./ui";
import CharacterAbility from "./CharacterAbility";
import {
  characters,
  characterKey,
  characterFor,
  disciplines,
} from "@/lib/characters";

export default function FullStackTasks({
  level,
  data,
  attempt,
  teamId = attempt?.teamId || data.user.teamId,
  onTask,
  renderTask,
}) {
  const tasks = data.tasks.filter((t) => t.projectAttemptId === attempt?._id);
  const groups = (level.features || [])
    .map((feature) => {
      const assigned = tasks.filter((t) => t.featureId === feature.key);
      const member =
        data.roster.find((p) => p._id === assigned[0]?.assigneeId) ||
        data.roster.find(
          (p) =>
            p.active !== false &&
            p.teamId === teamId &&
            characterKey(p) === feature.characterKey,
        );
      return {
        feature,
        assigned,
        member,
        own: attempt
          ? assigned.some((t) => t.assigneeId === data.user._id)
          : member?._id === data.user._id,
      };
    })
    .sort((a, b) => Number(b.own) - Number(a.own));
  return (
    <section
      className="full-stack-assignments"
      aria-label="Full-stack feature assignments"
    >
      <h3>Five explorers. Five complete features.</h3>
      <p>
        Every player completes frontend, backend, database, testing and
        deployment for their own feature. All 25 tasks must be reviewed before
        the shared project can clear.
      </p>
      {groups.map(({ feature, assigned, member, own }) => {
        const character = characterFor(
          member || { characterKey: feature.characterKey },
        );
        const complete = assigned.filter((t) => t.status === "Done").length;
        return (
          <details
            key={feature.key}
            open={own}
            className={`feature-assignment${own ? " is-own-feature" : ""}`}
          >
            <summary>
              <img src={character?.image} alt="" width={48} height={48} />
              <span>
                <strong>
                  {feature.name}
                  {own && <Badge>YOUR FEATURE</Badge>}
                </strong>
                <small>
                  {member?.name || "Assigned when the team starts"} ·{" "}
                  {character?.name ||
                    characters.find((c) => c.key === feature.characterKey)
                      ?.label}{" "}
                  · {complete}/5 approved
                </small>
              </span>
            </summary>
            <div className="feature-assignment-body">
              {own && (
                <CharacterAbility
                  player={member}
                  feature={feature}
                  tasks={assigned}
                />
              )}
              <p className="feature-objective">{feature.objective}</p>
              {level.tasks
                .filter((d) => d.featureId === feature.key)
                .map((definition) => {
                  const task = assigned.find(
                    (t) => t.targetRole === definition.targetRole,
                  );
                  return (
                    <article
                      key={definition.targetRole}
                      className="feature-layer-task"
                    >
                      <div>
                        <strong>
                          {
                            disciplines.find(
                              (d) => d.code === definition.discipline,
                            )?.label
                          }
                        </strong>
                        {task && <Badge>{task.status}</Badge>}
                      </div>
                      <p>{definition.instructions}</p>
                      <details>
                        <summary>Acceptance criteria & evidence</summary>
                        <p>{definition.acceptanceCriteria}</p>
                      </details>
                      {task && onTask && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => onTask(task)}
                        >
                          {task.assigneeId === data.user._id
                            ? "Open my task"
                            : "View task"}
                        </button>
                      )}
                      {task && renderTask?.(task)}
                    </article>
                  );
                })}
            </div>
          </details>
        );
      })}
    </section>
  );
}
