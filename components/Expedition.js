"use client";
import { useState } from "react";
import {
  Compass,
  GitBranch,
  Bug,
  PawPrint,
  Waves,
  Footprints,
  Landmark,
  Trees,
  Sprout,
  Radio,
  Check,
  Flag,
  Map,
  Tent,
  ShieldCheck,
  List,
} from "lucide-react";
import { encounters } from "@/lib/expedition";
import { Modal, Form, Receipt, Badge } from "./ui";
const glyphs = {
  Compass,
  GitBranch,
  Bug,
  PawPrint,
  Waves,
  Footprints,
  Landmark,
  Trees,
  Sprout,
  Radio,
};
function EncounterScene({ number, className = "" }) {
  const index = number - 1;
  return (
    <div
      className={`encounter-scene ${className}`}
      style={{
        "--scene-x": `${(index % 5) * 25}%`,
        "--scene-y": index < 5 ? "0%" : "100%",
      }}
      aria-hidden="true"
    />
  );
}
export function EncounterDialog({ module, data, act, close }) {
  const encounter = encounters[module.number - 1];
  const completed = data.progress.some(
    (p) => p.userId === data.user._id && p.moduleId === module._id,
  );
  const Icon = glyphs[encounter.icon];
  return (
    <Modal
      title={encounter.name}
      kicker={`ENCOUNTER ${String(module.number).padStart(2, "0")} / ${encounter.threat}`}
      close={close}
    >
      <EncounterScene
        number={module.number}
        className="encounter-dialog-scene"
      />
      <div className="encounter-brief">
        <Icon size={32} />
        <p>{encounter.story}</p>
      </div>
      <div className="lesson-title">
        <BookLabel /> <span>FIELD KNOWLEDGE · {module.title}</span>
      </div>
      <p className="lesson-copy">{module.content}</p>
      {completed ? (
        <Receipt>
          Encounter cleared. Your learning reward has been recorded.
        </Receipt>
      ) : (
        <Form
          fields={[
            {
              name: "answer",
              label: module.question,
              options: module.options.map((label, i) => ({
                value: String(i),
                label,
              })),
            },
          ]}
          submit="Overcome encounter"
          onSubmit={async (v) => {
            const ok = await act(
              "gamer/modules",
              { moduleId: module._id, answer: Number(v.answer) },
              "Encounter cleared. +15 XP and +10 trophies, subject to their daily caps.",
            );
            if (ok) close();
            return ok;
          }}
        />
      )}
      <p className="encounter-footnote">
        Knowledge encounters award personal XP and leaderboard trophies.
        Expedition tasks are reviewed separately by your Guide.
      </p>
    </Modal>
  );
}
function BookLabel() {
  return <ShieldCheck size={15} />;
}
export function EncounterGrid({ data, act }) {
  const [selected, setSelected] = useState(null);
  const completed = data.progress
    .filter((p) => p.userId === data.user._id)
    .map((p) => p.moduleId);
  return (
    <>
      <div className="encounters-banner">
        <div>
          <span className="terrain-kicker">THE EXPEDITION FIELD GUIDE</span>
          <h2>Know what lies ahead.</h2>
          <p>Read the terrain. Learn the skill. Bring your party through.</p>
        </div>
        <div className="encounter-count">
          <strong>
            {completed.length}
            <small> / 10</small>
          </strong>
          <span>LESSONS COMPLETED</span>
        </div>
      </div>
      <div className="module-grid jungle-encounters">
        {data.modules.map((m) => {
          const e = encounters[m.number - 1],
            Icon = glyphs[e.icon],
            clear = completed.includes(m._id);
          return (
            <button
              key={m._id}
              className={`module-card encounter-card ${clear ? "complete" : ""}`}
              onClick={() => setSelected(m)}
            >
              <div className="encounter-art">
                <EncounterScene number={m.number} />
                <span className="encounter-index">
                  {String(m.number).padStart(2, "0")}
                </span>
                <span className="encounter-glyph">
                  <Icon size={20} />
                </span>
              </div>
              <div className="encounter-card-copy">
                <Badge tone={clear ? "lime" : "amber"}>
                  {clear ? "CLEARED" : "+15 XP · +10 TROPHIES"}
                </Badge>
                <h2>{e.name}</h2>
                <strong>{m.title}</strong>
                <p>{e.story}</p>
                <span className="text-link">
                  {clear ? "Revisit encounter" : "Explore encounter"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <EncounterDialog
          module={selected}
          data={data}
          act={act}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}
