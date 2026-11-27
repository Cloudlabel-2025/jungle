"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Busy } from "./ui";

const PilotWorkspace = dynamic(() => import("./PilotWorkspace"), {
  loading: () => <Busy label="Opening programme work…" />,
});
export default function PilotBoardSlot({ data, children }) {
  const params = useSearchParams();
  const show = params.get("board") === "programme";
  const boardLink = (programme) => {
    const next = new URLSearchParams(params.toString());
    if (programme) next.set("board", "programme");
    else next.delete("board");
    return `?${next.toString()}`;
  };
  return (
    <>
      <div className="board-selector"><nav className="button-row board-switcher" aria-label="Objective boards">
        <Link
          className={`btn ${!show ? "primary" : ""}`}
          href={boardLink(false)}
          scroll={false}
          aria-current={!show ? "page" : undefined}
        >
          Project objectives
        </Link>
        <Link
          className={`btn ${show ? "primary" : ""}`}
          href={boardLink(true)}
          scroll={false}
          aria-current={show ? "page" : undefined}
        >
          Weekly sprint work
        </Link>
      </nav><p>
          {show
            ? "Approved programme sprints: assigned work, evidence and independent reviews."
            : "Follow the five Alumni Connect levels and published map missions. Weekly sprint work contains sprint tasks, reviews and acceptance."}
        </p>
      </div>
      {show ? (
        <PilotWorkspace
          key={params.get("sprint") || "current"}
          user={data.user}
          levels={data.alumniMap || []}
        />
      ) : (
        children
      )}
    </>
  );
}
