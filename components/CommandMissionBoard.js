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
      count: `${ids.size} players in your scope`,
      Icon: Crosshair,
    },
    {
      page: "questions",
      count: `${tickets} open questions`,
      Icon: Radio,
    },
    {
      page: cc ? "setup" : "assessments",
      count: cc
        ? `${p.days.filter((d) => d.activities?.length || (d.day === 1 && data.dayOne?.config)).length}/5 levels prepared`
        : `${reviews} submitted missions`,
      Icon: cc ? Settings2 : ShieldCheck,
    },
  ];
  return (
    <section className="cc-quick-actions" aria-label="Quick actions">
      <h2>Quick actions</h2>
      <nav className="cc-quick-links" aria-label={cc ? "Command shortcuts" : "Guide shortcuts"}>
        {missions.map(({ page, count, Icon }) => (
          <Link key={page} href={programmePath(role, page)} className="cc-quick-link">
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{{ results: "Review results", questions: "Open questions", setup: "Level setup", assessments: "Review evidence" }[page]}</strong>
              <small>{count}</small>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
