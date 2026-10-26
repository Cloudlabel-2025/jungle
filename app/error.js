"use client";
export default function Error({ reset }) {
  return (
    <main className="error-page">
      <span className="eyebrow">CONNECTION INTERRUPTED</span>
      <h1>The grid needs a moment.</h1>
      <p>
        An unexpected error interrupted this view. Reconnect to return to the
        arena.
      </p>
      <button className="btn primary" onClick={reset}>
        Reconnect
      </button>
    </main>
  );
}
