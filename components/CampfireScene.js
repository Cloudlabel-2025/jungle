"use client";
import { useState } from "react";
import { Flame, MessageCircle, Users, Ticket, BookOpen } from "lucide-react";
import { Modal } from "./ui";
import { CampResidents, CampResidentInfo } from "./CampResidents";

const tools = [
  ["chat", "Chat", MessageCircle],
  ["team", "Team", Users],
  ["tickets", "Tickets", Ticket],
  ["library", "Field library", BookOpen],
];

export default function CampfireScene({
  teamName,
  members,
  roster,
  user,
  chat,
  team,
  tickets,
  library,
}) {
  const [active, setActive] = useState(null);
  const [resident, setResident] = useState(null);
  const content = { chat, team, tickets, library };
  const title = tools.find(([id]) => id === active)?.[1];
  return (
    <section className="camp-territory" aria-label="Team campfire territory">
      <div className="camp-scene-window">
        <div className="camp-scene-art">
          <img
            src="/images/team-campfire-daytime.webp"
            alt=""
            fetchPriority="high"
          />
          {Array.from({ length: 18 }, (_, i) => (
            <span
              className="camp-firefly"
              aria-hidden="true"
              key={i}
              style={{
                left: `${10 + ((i * 23) % 82)}%`,
                top: `${24 + ((i * 17) % 58)}%`,
                "--i": i,
                "--drift": `${i % 2 ? -1 : 1}`,
              }}
            />
          ))}
          {roster && user && (
            <CampResidents
              roster={roster}
              user={user}
              selected={resident}
              onSelect={setResident}
            />
          )}
        </div>
      </div>
      <header className="camp-territory-heading">
        <span>
          <Flame size={16} /> TEAM TERRITORY
        </span>
        <h1>{teamName || "Your campfire"}</h1>
        <p>Five tents. One team. A place to regroup.</p>
      </header>
      <div
        className="camp-scene-description"
        role="img"
        aria-label="A wide daytime view of five tents around a campfire beneath dense jungle trees and hanging vines, with two burning torches and drifting insects."
      />
      <div className="camp-occupancy">
        <Users size={14} /> {members} / 5 explorers
      </div>
      <nav className="camp-tool-dock" aria-label="Campfire tools">
        {tools.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => {
              setResident(null);
              setActive(id);
            }}
            aria-haspopup="dialog"
            aria-label={label}
          >
            <Icon size={24} strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {roster && user && (
        <CampResidentInfo
          roster={roster}
          user={user}
          selected={resident}
          close={() => setResident(null)}
        />
      )}
      {active && (
        <Modal
          title={title}
          kicker={`${teamName || "TEAM CAMP"} / CAMPFIRE`}
          close={() => setActive(null)}
          wide
        >
          <div className="camp-tool-switcher" aria-label="Switch campfire tool">
            {tools.map(([id, label, Icon]) => (
              <button
                key={id}
                aria-label={label}
                aria-pressed={active === id}
                onClick={() => setActive(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="camp-tool-content" key={active}>
            {content[active]}
          </div>
        </Modal>
      )}
    </section>
  );
}
