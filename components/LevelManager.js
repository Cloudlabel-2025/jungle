"use client";
import { useState } from "react";
import { Plus, Save, Eye, Send, Pencil, ChevronLeft } from "lucide-react";
import { Panel, Badge } from "./ui";
import LevelEmblem from "./LevelEmblem";
import ProjectPreview from "./ProjectPreview";
import { levelImages, levelImage } from "@/lib/level-images";
import {
  hazardCategories,
  hazardLibrary,
  levelHazard,
} from "@/lib/level-hazards";
import { teamRoles } from "@/lib/team-roles";
import { characters, projectTaskLabel } from "@/lib/characters";
import { fullStackLevel, tasksForFeatures } from "@/lib/full-stack-levels";

const blank = (teams) => ({
  ...fullStackLevel({
    number: 1,
    name: "Team mini project",
    description: "",
    hours: 4,
  }),
  name: "",
  description: "",
  hours: 4,
  hazardKey: "vines",
  imageKey: "auto",
  criteria: [""],
  teamIds: teams.map((t) => t._id),
});
export default function LevelManager({ data, act }) {
  const [editing, setEditing] = useState(false),
    [levelId, setLevelId] = useState(null),
    [version, setVersion] = useState(null);
  const [form, setForm] = useState(() => blank(data.teams)),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const drafts = data.levelDrafts || [];
  const rows = [
    ...new Map(
      [
        ...data.projectLevels,
        ...drafts.map((r) => ({ _id: r._id, ...(r.published || r.draft) })),
      ].map((l) => [l._id, l]),
    ).values(),
  ];
  function open(level) {
    const record = drafts.find((r) => r._id === level?._id);
    const source = record?.draft || level;
    setForm(
      source
        ? {
            ...source,
            hazardKey: levelHazard(source).key,
            imageKey: source.imageKey ?? "auto",
            teamIds: source.teamIds?.length
              ? source.teamIds
              : data.teams.map((t) => t._id),
            tasks: source.tasks.map((t) => ({ ...t })),
            criteria: [...source.criteria],
          }
        : blank(data.teams),
    );
    setLevelId(level?._id || null);
    setVersion(record?.version || null);
    setEditing(true);
    setPreview(null);
    setDirty(!record);
    setError("");
  }
  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setPreview(null);
    setError("");
  }
  function updateTask(index, key, value) {
    update(
      "tasks",
      form.tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
    );
  }
  function updateFeature(index, key, value) {
    setForm((previous) => {
      const features = previous.features.map((f, i) =>
        i === index ? { ...f, [key]: value } : f,
      );
      const feature = features[index];
      return {
        ...previous,
        features,
        tasks: previous.tasks.map((t) =>
          t.targetCharacter === feature.characterKey
            ? { ...t, featureId: feature.key, featureName: feature.name }
            : t,
        ),
      };
    });
    setDirty(true);
    setPreview(null);
  }
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await act(
        "levels/save",
        {
          levelId,
          version,
          definition: { ...form, hours: Number(form.hours) },
        },
        "Level draft saved. Preview player assignments before publishing.",
      );
      if (result) {
        setLevelId(result.levelId);
        setVersion(result.version);
        setDirty(false);
        setPreview(null);
      }
    } finally {
      setBusy(false);
    }
  }
  async function inspect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/levels/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId, version }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setPreview(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (busy || !preview?.canPublish) return;
    setBusy(true);
    try {
      const result = await act(
        "levels/publish",
        { levelId, version, previewToken: preview.token },
        "Level published. Ready teams received their feature tasks; other teams are queued.",
      );
      if (result) {
        setEditing(false);
        setPreview(null);
      } else {
        setPreview(null);
        setError(
          "Publication was not completed. Preview again, or reopen the latest draft if it changed.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  const builtin = levelId?.startsWith("project_");
  return (
    <Panel
      title="Level workshop"
      kicker="CENTRE COMMAND · BUILD THE EXPEDITION"
    >
      <div className="level-workshop-intro">
        <p>
          Create shared team projects, choose forest artwork, and define five
          features with five full-stack tasks per player. Drafts stay private
          until you publish.
        </p>
        <button
          className="btn primary"
          onClick={() => open(null)}
          disabled={busy}
        >
          <Plus size={16} /> Create level
        </button>
      </div>
      {!editing ? (
        <div className="level-library">
          {rows.map((level) => {
            const record = drafts.find((r) => r._id === level._id);
            const hasDraft =
              record &&
              +new Date(record.updatedAt) !== +new Date(record.publishedAt);
            return (
              <button
                className="level-library-card"
                key={level._id}
                onClick={() => open(level)}
              >
                <LevelEmblem level={level} />
                <span>
                  <small>
                    {level.number
                      ? `LEVEL ${String(level.number).padStart(2, "0")}`
                      : "NEW LEVEL"}{" "}
                    · {record?.published || !record ? "PUBLISHED" : "DRAFT"}
                    {hasDraft && record?.published ? " · DRAFT CHANGES" : ""}
                  </small>
                  <strong>{record?.draft?.name || level.name}</strong>
                  <small>
                    {levelHazard(record?.draft || level).name} · {level.hours}{" "}
                    working hours
                  </small>
                </span>
                <Pencil size={15} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="level-editor">
          <button
            className="btn level-back"
            type="button"
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Discard unsaved edits and return to the level library?",
                )
              )
                setEditing(false);
            }}
            disabled={busy}
          >
            <ChevronLeft size={15} /> Level library
          </button>
          <div className="level-editor-heading">
            <LevelEmblem
              level={{
                ...form,
                number: data.projectLevels.find((l) => l._id === levelId)
                  ?.number,
              }}
            />
            <div>
              <Badge>
                {drafts.find((r) => r._id === levelId)?.published
                  ? "PUBLISHED · EDITING DRAFT"
                  : "PRIVATE DRAFT"}
              </Badge>
              <h3>{form.name || "An uncharted project"}</h3>
              <p>
                {levelHazard(form).name} · {form.hours || "—"} working hours
              </p>
            </div>
          </div>
          <p className="callout">
            Published level positions are permanent. New levels extend the map
            in sequence. Teams already working on a level keep their original
            instructions, deadline, emblem, and rewards.
          </p>
          <form
            className="field-form level-author-form"
            onSubmit={save}
            aria-busy={busy}
          >
            {form.learningMode !== "FULL_STACK" && (
              <p className="callout">
                This is a legacy role-based level. Active attempts keep their
                original tasks.
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const template = fullStackLevel({
                      ...form,
                      number: form.number <= 10 ? form.number : 1,
                    });
                    update("learningMode", "FULL_STACK");
                    update("features", template.features);
                    update("tasks", template.tasks);
                  }}
                >
                  Create a full-stack draft
                </button>
              </p>
            )}
            <label>
              Project name
              <input
                required
                minLength={3}
                maxLength={120}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </label>
            <label>
              Project brief
              <textarea
                required
                minLength={10}
                maxLength={4000}
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
            <label>
              Time budget · working hours
              <input
                required
                type="number"
                min="0.25"
                max="160"
                step="0.25"
                value={form.hours}
                onChange={(e) => update("hours", e.target.value)}
              />
              <small>
                The deadline starts when this team's level opens. One project
                day is 8 hours, Monday–Friday, 09:00–17:00 IST.
              </small>
            </label>
            <fieldset className="emblem-picker">
              <legend>Choose the level's forest emblem</legend>
              {hazardCategories.map((category) => (
                <div key={category}>
                  <h4>{category}</h4>
                  <div className="emblem-options">
                    {hazardLibrary
                      .filter((h) => h.category === category)
                      .map((hazard) => (
                        <label
                          className={
                            form.hazardKey === hazard.key ? "selected" : ""
                          }
                          key={hazard.key}
                        >
                          <input
                            type="radio"
                            name="hazard"
                            value={hazard.key}
                            checked={form.hazardKey === hazard.key}
                            onChange={() => update("hazardKey", hazard.key)}
                          />
                          <LevelEmblem level={{ hazardKey: hazard.key }} />
                          <span>{hazard.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset className="level-image-picker">
              <legend>Choose the level image</legend>
              <p className="muted">
                Generated forest scenes for the player's level briefing.
              </p>
              <label className="level-image-auto">
                <input
                  type="radio"
                  name="level-image"
                  value="auto"
                  checked={form.imageKey === "auto"}
                  onChange={() => update("imageKey", "auto")}
                />
                Match the emblem automatically ·{" "}
                {levelImage({ ...form, imageKey: "auto" }).name}
              </label>
              <div className="level-image-options">
                {levelImages.map((image) => (
                  <label
                    key={image.key}
                    className={form.imageKey === image.key ? "selected" : ""}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      width={300}
                      height={200}
                      loading="lazy"
                    />
                    <span>
                      <input
                        type="radio"
                        name="level-image"
                        value={image.key}
                        checked={form.imageKey === image.key}
                        onChange={() => update("imageKey", image.key)}
                      />
                      {image.name}
                    </span>
                  </label>
                ))}
              </div>
              <div className="level-image-preview">
                <ProjectPreview level={form} />
                <small>Player preview · {levelImage(form).name}</small>
              </div>
            </fieldset>
            <fieldset>
              <legend>Publish to teams</legend>
              <div className="level-team-options">
                {data.teams.map((team) => (
                  <label key={team._id}>
                    <input
                      type="checkbox"
                      disabled={builtin}
                      checked={form.teamIds.includes(team._id)}
                      onChange={(e) =>
                        update(
                          "teamIds",
                          e.target.checked
                            ? [...form.teamIds, team._id]
                            : form.teamIds.filter((id) => id !== team._id),
                        )
                      }
                    />
                    {team.name}
                  </label>
                ))}
              </div>
              {builtin && (
                <small>
                  Existing chapter levels are shared by all teams. New levels
                  can target selected teams.
                </small>
              )}
            </fieldset>
            <label>
              Integrated project acceptance criteria · one per line
              <textarea
                required
                rows={4}
                value={form.criteria.join("\n")}
                onChange={(e) => update("criteria", e.target.value.split("\n"))}
              />
            </label>
            <div className="level-role-tasks">
              {form.learningMode === "FULL_STACK" && (
                <section className="feature-authoring">
                  <h3>Five features · 25 tasks</h3>
                  <p>
                    One feature per character. Every feature includes frontend,
                    backend, database, testing and deployment.
                  </p>
                  {form.features.map((feature, index) => (
                    <fieldset key={feature.characterKey}>
                      <legend>
                        {
                          characters.find((c) => c.key === feature.characterKey)
                            ?.label
                        }{" "}
                        · Feature {index + 1}
                      </legend>
                      <label>
                        Feature ID
                        <input
                          required
                          pattern="[a-z][a-z0-9-]+"
                          maxLength={40}
                          value={feature.key}
                          onChange={(e) =>
                            updateFeature(index, "key", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Feature name
                        <input
                          required
                          minLength={3}
                          maxLength={80}
                          value={feature.name}
                          onChange={(e) =>
                            updateFeature(index, "name", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Feature objective
                        <textarea
                          required
                          minLength={10}
                          maxLength={1000}
                          value={feature.objective}
                          onChange={(e) =>
                            updateFeature(index, "objective", e.target.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Replace this feature's five task instructions with a fresh full-stack template?",
                            )
                          )
                            update(
                              "tasks",
                              form.tasks.map((task) =>
                                task.targetCharacter === feature.characterKey
                                  ? tasksForFeatures([feature]).find(
                                      (t) => t.discipline === task.discipline,
                                    )
                                  : task,
                              ),
                            );
                        }}
                      >
                        Generate five layer tasks
                      </button>
                    </fieldset>
                  ))}
                </section>
              )}
              {form.tasks.map((task, index) => (
                <details className="layer-task-editor" key={task.targetRole}>
                  <summary>
                    {String(index + 1).padStart(2, "0")} ·{" "}
                    {projectTaskLabel(task) ||
                      teamRoles.find((r) => r.code === task.targetRole)?.label}
                  </summary>
                  <fieldset>
                    <legend>
                      {String(index + 1).padStart(2, "0")} ·{" "}
                      {projectTaskLabel(task) ||
                        teamRoles.find((r) => r.code === task.targetRole)
                          ?.label}
                    </legend>
                    <label>
                      Task title
                      <input
                        required
                        minLength={3}
                        maxLength={160}
                        value={task.title}
                        onChange={(e) =>
                          updateTask(index, "title", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Instructions
                      <textarea
                        required
                        minLength={10}
                        maxLength={4000}
                        rows={3}
                        value={task.instructions}
                        onChange={(e) =>
                          updateTask(index, "instructions", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Acceptance criteria and required evidence
                      <textarea
                        required
                        minLength={10}
                        maxLength={4000}
                        rows={3}
                        value={task.acceptanceCriteria}
                        onChange={(e) =>
                          updateTask(
                            index,
                            "acceptanceCriteria",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  </fieldset>
                </details>
              ))}
            </div>
            <div className="button-row">
              <button className="btn primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Working…" : "Save draft"}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy || dirty || !levelId}
                onClick={inspect}
              >
                <Eye size={16} /> Preview assignments
              </button>
            </div>
            {dirty && (
              <small>Save your changes before previewing or publishing.</small>
            )}
          </form>
          {error && (
            <p role="alert" className="callout danger-text">
              {error}
            </p>
          )}
          {preview && (
            <section
              className="level-publish-preview"
              aria-label="Level publication preview"
            >
              <h3>
                Level {preview.level.number} · {preview.level.name}
              </h3>
              <ProjectPreview level={preview.level} />
              <p>
                {preview.level.baseXp} base XP · {preview.level.baseTrophies}{" "}
                base trophies. Individual rewards depend on team stars and
                contribution scores.
              </p>
              {preview.rows.map((row) => (
                <article key={row.teamId}>
                  <h4>
                    {row.teamName}{" "}
                    <Badge>{row.state.replaceAll("_", " ")}</Badge>
                  </h4>
                  {row.error ? (
                    <p className="danger-text">{row.error}</p>
                  ) : (
                    <ul>
                      {row.recipients.map((r) => (
                        <li key={r.targetRole}>
                          <strong>{r.name}</strong> ·{" "}
                          {r.featureName
                            ? `${r.featureName} · ${r.discipline}`
                            : teamRoles.find(
                                (role) => role.code === r.targetRole,
                              )?.label}
                          <small>{r.title}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {row.state === "QUEUED" && (
                    <p>
                      Tasks unlock automatically after {row.previousName} is
                      cleared. The deadline begins then.
                    </p>
                  )}
                  {row.state === "PRESERVED" && (
                    <p>
                      This team's existing attempt is preserved. Changes apply
                      to teams that have not started.
                    </p>
                  )}
                </article>
              ))}
              <button
                className="btn primary"
                disabled={busy || !preview.canPublish}
                onClick={publish}
              >
                <Send size={16} />
                Publish level and assign tasks
              </button>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
