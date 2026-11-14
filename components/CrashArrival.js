"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

// Mounted only after the server has cleared the learning and approved team gates.
export default function CrashArrival({ act }) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReady(true);
      return;
    }
    const timer = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <section
      className={`crash-arrival ${ready ? "has-landed" : ""}`}
      aria-label="Story transition"
    >
      <img
        className="crash-aircraft"
        src="/images/flight-helicopter-right.png"
        alt=""
        aria-hidden="true"
      />
      <div className="crash-story-copy">
        <p className="eyebrow">
          {ready ? "A NEW CHAPTER" : "RADIO SIGNAL INTERRUPTED"}
        </p>
        <h1>{ready ? "You made it." : "Mayday. Hold on."}</h1>
        <p>
          {ready
            ? "The helicopter is down. An unfamiliar world surrounds you. It’s time to choose who you’ll become and find your way forward."
            : "The helicopter loses altitude. Clouds rush past as the pilot searches for a place to land."}
        </p>
        {!ready ? (
          <button className="btn" onClick={() => setReady(true)}>
            Skip scene
          </button>
        ) : (
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await act(
                  "story/crash-arrival",
                  {},
                  "Your next chapter is ready.",
                );
                if (result) router.push("/gamer/dashboard");
                else setError("Could not save your arrival. Please try again.");
              } catch {
                setError("Could not save your arrival. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Continuing…" : "Continue to character selection"}
            <ArrowRight size={18} />
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
