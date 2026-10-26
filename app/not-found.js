import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <span className="eyebrow">404 / OUTSIDE THE GRID</span>
      <h1>Signal lost.</h1>
      <p>This coordinate does not exist in the arena.</p>
      <Link className="btn primary" href="/">
        Return to base
      </Link>
    </main>
  );
}
