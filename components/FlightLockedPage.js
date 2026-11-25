import Link from "next/link";

export default function FlightLockedPage() {
  return (
    <section className="sky-equipment-panel" aria-labelledby="chapter-locked-title">
      <h1 id="chapter-locked-title">This page opens in the expedition chapter.</h1>
      <p>Complete the five flight levels first. Your MC reviews the work and Centre Command publishes results and your final team. You can enter camp after those steps are approved.</p>
      <div className="button-row">
        <Link className="btn primary" href="/gamer/dashboard">Continue your flight</Link>
        <Link className="btn" href="/gamer/week-one-results">Check results and recovery</Link>
        <Link className="btn" href="/gamer/week-one-ask-mc">Open Help Desk</Link>
      </div>
    </section>
  );
}
