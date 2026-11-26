import Link from "next/link";
import {
  Crosshair,
  Radio,
  Settings2,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { programmePath } from "@/lib/workspace-navigation.js";
export default function CommandMissionBoard({ data }) {
  const p = data.weekOneProgram,
    role = data.user.role,
    cc = role === "CENTRE_COMMAND";
  const ids = new Set(p.levelTargets?.members.map((m) => m._id) || []);
  const reviews = p.attempts.filter(
    (a) =>
      ids.has(a.userId) && a.data.submittedAt && !a.data.result?.reviewedAt,
  ).length;
  const tickets = p.tickets.filter(
    (t) => ids.has(t.userId) && !["RESOLVED", "CLOSED"].includes(t.data.status),
  ).length;
  const missions = [
    {
      page: "results",
      title: "Validate the crew",
      description:
        "Open a player dossier. Inspect evidence and decide the result.",
      count: `${ids.size} players in your scope`,
      Icon: Crosshair,
    },
    {
      page: "questions",
      title: "Answer the radio",
      description:
        "Resolve blocked missions, review energy recovery and respond to the crew.",
      count: `${tickets} open questions`,
      Icon: Radio,
    },
    {
      page: cc ? "setup" : "assessments",
      title: cc ? "Prepare the flight" : "Inspect mission evidence",
      description: cc
        ? "Prepare the next level and check its readiness before release."
        : "Read submitted work and verify rubric assessments.",
      count: cc
        ? `${p.days.filter((d) => d.activities?.length || (d.day === 1 && data.dayOne?.config)).length}/5 levels prepared`
        : `${reviews} submitted missions`,
      Icon: cc ? Settings2 : ShieldCheck,
    },
  ];
  if (cc) return (
    <section className="cc-quick-actions" aria-label="Quick actions">
      <h2>Quick actions</h2>
      <nav className="cc-quick-links" aria-label="Command shortcuts">
        {missions.map(({ page, count, Icon }) => (
          <Link key={page} href={programmePath(role, page)} className="cc-quick-link">
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{{ results: "Review results", questions: "Open questions", setup: "Level setup" }[page]}</strong>
              <small>{count}</small>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
  return (
    <section
      className="command-mission-board"
      aria-label="Command mission board"
    >
      <div className="command-board-intro">
        <span className="game-kicker">
          {cc ? "COUNCIL WAR ROOM" : "GUIDE'S LOOKOUT"} / FLIGHT OPERATIONS
        </span>
        <h2>{cc ? "Chart the next move." : "Keep your crew moving."}</h2>
        <p>
          {cc
            ? "Prepare the terrain, validate the evidence and clear the way forward."
            : "Your assigned crew. Their missions. Your next decision."}
        </p>
      </div>
      <div className="command-mission-grid">
        {missions.map(({ page, title, description, count, Icon }, index) => (
          <Link
            key={page}
            href={programmePath(role, page)}
            className="command-mission"
          >
            <span className="command-mission-number">0{index + 1}</span>
            <Icon size={30} />
            <small>{count}</small>
            <h3>{title}</h3>
            <p>{description}</p>
            <span className="command-mission-enter">
              Enter station <ArrowUpRight size={17} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
