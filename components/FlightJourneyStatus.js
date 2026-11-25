import Link from "next/link";

export default function FlightJourneyStatus({ levels, program }) {
  if (!levels.length || !levels.every(level => level.completed)) return null;
  const publication = program?.publication;
  return (
    <section className="sky-equipment-panel" aria-label="After your flight">
      <h2>Five levels complete. Your next chapter awaits.</h2>
      <p>Your mission work is saved. Your MC reviews the evidence, then Centre Command publishes your personal results. Recovery, when required, and approved team publication come before arrival at the expedition camp.</p>
      <div className="button-row">
        <Link className="btn primary" href="/gamer/week-one-results">{publication ? "View results and next steps" : "Check result status"}</Link>
        <Link className="btn" href="/gamer/week-one-ask-mc">Ask your MC about the next chapter</Link>
      </div>
    </section>
  );
}
