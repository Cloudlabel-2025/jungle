"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Headphones, Compass } from "lucide-react";

export default function FlightOpening({ data, act }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const story = data.story;
  const day = data.weekOneProgram?.days.find((d) => d.state === "OPEN");
  return (
    <div className="flight-chapter">
      <section className="flight-scene" aria-labelledby="flight-title">
        <div className="flight-canopy" aria-hidden="true" />
        <div className="flight-cloud flight-cloud-one" aria-hidden="true" />
        <div className="flight-cloud flight-cloud-two" aria-hidden="true" />
        <div className="flight-aircraft" aria-hidden="true">
          <div className="helicopter-rotor" />
          <div className="helicopter-mast" />
          <div className="helicopter-cabin">
            <span />
          </div>
          <div className="helicopter-tail" />
          <div className="helicopter-fin" />
          <div className="helicopter-skid" />
          <div className="helicopter-strut" />
        </div>
        <div className="flight-story-copy">
          <p className="flight-eyebrow">VOW / THE JOURNEY BEGINS</p>
          <h1 id="flight-title">
            Above the canopy.
            <br />
            <em>Before the unknown.</em>
          </h1>
          <p>
            You’re travelling toward an unfamiliar world. For now, you’re a
            passenger with a curious mind. Your character and the jungle ahead
            are still unknown.
          </p>
          <p>
            During Week 1, learn to question AI, investigate its answers and
            explain what you discover. Follow your next mission and see where
            the journey takes you.
          </p>
          {!story.introComplete ? (
            <>
              <button
                className="flight-continue"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const result = await act(
                      "story/flight-intro",
                      {},
                      "Welcome aboard. Your flight learning is ready.",
                    );
                    if (result) router.push("/gamer/week-one");
                    else
                      setError(
                        "Your welcome could not be saved. Please try again.",
                      );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Preparing your journey…" : "Begin flight learning"}
                <ArrowRight size={19} />
              </button>
              <p className="flight-motion-note">
                Continue whenever you’re ready. There’s no need to wait for the
                animation.
              </p>
            </>
          ) : (
            <Link className="flight-continue" href="/gamer/week-one">
              {day ? `Continue Day ${day.day}` : "View your learning status"}
              <ArrowRight size={19} />
            </Link>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="flight-caption" aria-hidden="true">
          <Compass size={18} /> FLIGHT CHAPTER <span>WEEK 01</span>
        </div>
      </section>
      <section className="flight-briefing" aria-label="Flight briefing">
        <Headphones size={26} />
        <div>
          <h2>Your first mission is learning</h2>
          <p>
            {!story.introComplete
              ? "Begin your flight learning to find your rules, daily briefing and research activity."
              : day
                ? `Day ${day.day} is open. Check in, read your briefing and continue your learning activities.`
                : "Your learning status explains what is available and what needs staff approval."}
          </p>
        </div>
        <Link href="/gamer/week-one-ask-mc">
          Ask for help <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
