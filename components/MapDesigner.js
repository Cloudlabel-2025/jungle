"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Save, Pencil, MapPinned } from "lucide-react";
import { Panel, Modal } from "./ui";
import LevelEmblem from "./LevelEmblem";
import LevelManager from "./LevelManager";
import { alumniLevels } from "@/lib/alumni-map.js";
import {
  defaultMapPoint,
  missionMapPoint,
  missionMapWidth,
  MAP_MAX_X,
} from "@/lib/mission-map.js";

export default function MapDesigner({ data, act }) {
  const [positions, setPositions] = useState(data.mapLayout?.positions || {});
  const [revision, setRevision] = useState(data.mapLayout?.revision || 0);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(alumniLevels[0]._id);
  const [workshop, setWorkshop] = useState(null);
  const [horizontalInput, setHorizontalInput] = useState(null);
  const canvas = useRef(null),
    dragging = useRef(null);
  const missions = [
    ...new Map(
      [
        ...data.projectLevels.filter((l) => l.mapMission),
        ...(data.levelDrafts || [])
          .filter((r) => r.draft?.mapMission || r.published?.mapMission)
          .map((r) => ({
            ...(r.published || r.draft),
            _id: r._id,
            privateDraft: !r.published,
          })),
      ].map((l) => [l._id, l]),
    ).values(),
  ].sort((a, b) => (a.number || 101) - (b.number || 101));
  const levels = [...alumniLevels, ...missions];
  const active = levels.find((l) => l._id === selected) || levels[0];
  const index = levels.findIndex((l) => l._id === active._id);
  const point = positions[active._id] || defaultMapPoint(index);
  const width = missionMapWidth(levels, positions);
  useEffect(() => {
    if (!dirty) {
      setPositions(data.mapLayout?.positions || {});
      setRevision(data.mapLayout?.revision || 0);
    }
  }, [data.mapLayout?.revision, dirty]);
  function place(id, x, y) {
    setPositions((old) => ({
      ...old,
      [id]: {
        x: Math.round(Math.max(100, Math.min(MAP_MAX_X, x))),
        y: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10,
      },
    }));
    setDirty(true);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await act(
        "map/layout",
        {
          revision,
          positions: Object.fromEntries(
            levels.map((l, i) => [
              l._id,
              positions[l._id] || defaultMapPoint(i),
            ]),
          ),
        },
        "Map layout published. Players will see the updated marker positions.",
      );
      if (result) {
        setRevision(result.revision);
        setDirty(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Player map designer"
      kicker="CENTRE COMMAND / MISSION PLACEMENT"
    >
      <div className="map-designer">
        <div className="map-designer-toolbar">
          <p>
            Drag the emblems onto the jungle. Use arrow keys for precise
            placement. Only the background image repeats; each mission appears
            once.
          </p>
          <div className="button-row">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setWorkshop({ create: true })}
            >
              <Plus size={17} /> Create mission
            </button>
            <button
              className="btn"
              disabled={busy || !dirty}
              onClick={() => {
                setPositions(data.mapLayout?.positions || {});
                setRevision(data.mapLayout?.revision || 0);
                setHorizontalInput(null);
                setDirty(false);
              }}
            >
              Reload saved layout
            </button>
            <button
              className="btn primary"
              onClick={save}
              disabled={busy || !dirty}
            >
              <Save size={17} />
              {busy ? "Publishing…" : "Publish map layout"}
            </button>
          </div>
        </div>
        <div
          className="map-designer-scroll"
          aria-label="Scrollable map placement canvas"
        >
          <div
            ref={canvas}
            className="mission-map-world map-designer-canvas"
            style={{ width: `${width}px` }}
          >
            <span className="map-designer-safe-area">
              Player header and map title
            </span>
            {levels.map((l, i) => {
              const p = missionMapPoint(l, positions, i, 500);
              return (
                <button
                  key={l._id}
                  type="button"
                  disabled={busy}
                  className={`map-designer-marker ${l._id === active._id ? "selected" : ""}`}
                  style={{ left: `${p.x}px`, top: `${p.y}px` }}
                  aria-label={`Place ${l.name}`}
                  aria-pressed={l._id === active._id}
                  onClick={() => setSelected(l._id)}
                  onKeyDown={(e) => {
                    if (
                      ![
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    )
                      return;
                    e.preventDefault();
                    setSelected(l._id);
                    const old = positions[l._id] || defaultMapPoint(i);
                    place(
                      l._id,
                      old.x +
                        (e.key === "ArrowRight"
                          ? 10
                          : e.key === "ArrowLeft"
                            ? -10
                            : 0),
                      old.y +
                        (e.key === "ArrowDown"
                          ? 2
                          : e.key === "ArrowUp"
                            ? -2
                            : 0),
                    );
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || busy) return;
                    e.preventDefault();
                    e.currentTarget.focus();
                    setSelected(l._id);
                    const rect = canvas.current.getBoundingClientRect();
                    dragging.current = {
                      id: l._id,
                      x: e.clientX - rect.left - p.x,
                      y: e.clientY - rect.top - p.y,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (dragging.current?.id !== l._id || !canvas.current)
                      return;
                    const rect = canvas.current.getBoundingClientRect();
                    place(
                      l._id,
                      e.clientX - rect.left - dragging.current.x,
                      ((e.clientY - rect.top - dragging.current.y - 220) /
                        140) *
                        100,
                    );
                  }}
                  onPointerUp={() => {
                    dragging.current = null;
                  }}
                  onPointerCancel={() => {
                    dragging.current = null;
                  }}
                >
                  <LevelEmblem level={l} />
                  <strong>
                    {l.number ? `${l.number}. ` : ""}
                    {l.name}
                  </strong>
                  {l.privateDraft && <small>Private draft</small>}
                </button>
              );
            })}
            <span className="map-designer-controls-area">Player controls</span>
          </div>
        </div>
        <div className="map-designer-properties">
          <label>
            Selected level
            <select
              disabled={busy}
              value={active._id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {levels.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                  {l.privateDraft ? " · Draft" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Horizontal position
            <input
              type="number"
              min="100"
              max={MAP_MAX_X}
              step="10"
              disabled={busy}
              value={horizontalInput ?? point.x}
              onChange={(e) => {
                setHorizontalInput(e.target.value);
                setDirty(true);
              }}
              onBlur={(e) => {
                const value = e.currentTarget.valueAsNumber;
                if (
                  Number.isFinite(value) &&
                  value >= 100 &&
                  value <= MAP_MAX_X &&
                  value !== point.x
                )
                  place(active._id, value, point.y);
                setHorizontalInput(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          </label>
          <label>
            Vertical position
            <input
              type="range"
              disabled={busy}
              min="0"
              max="100"
              value={point.y}
              onChange={(e) =>
                place(active._id, point.x, Number(e.target.value))
              }
            />
            <small>{point.y}% of the playable area</small>
          </label>
          {active.mapMission && (
            <button
              className="btn"
              onClick={() => setWorkshop({ level: active })}
            >
              <Pencil size={16} /> Edit mission
            </button>
          )}
        </div>
        <p className="muted">
          <MapPinned size={15} />{" "}
          {dirty
            ? "Unpublished placement changes."
            : `Published layout · revision ${revision}.`}{" "}
          Moving a marker does not change task order or completion requirements.
          New missions stay private until their task assignments are previewed
          and published.
        </p>
        <details className="map-designer-library">
          <summary>Mission library and private drafts</summary>
          {missions.length ? (
            missions.map((l) => (
              <button
                key={l._id}
                className="btn"
                onClick={() => setWorkshop({ level: l })}
              >
                {l.name}
                {l.privateDraft ? " · Draft" : " · Published"}
              </button>
            ))
          ) : (
            <p>
              No custom missions yet. Create one with a brief, acceptance
              criteria and player tasks.
            </p>
          )}
        </details>
      </div>
      {workshop && (
        <Modal
          title={workshop.create ? "Create map mission" : "Edit map mission"}
          close={() => setWorkshop(null)}
          wide
        >
          <LevelManager
            data={data}
            act={act}
            mapMode
            autoCreate={workshop.create}
            initialLevel={workshop.level}
            onPublished={() => setWorkshop(null)}
          />
        </Modal>
      )}
    </Panel>
  );
}
