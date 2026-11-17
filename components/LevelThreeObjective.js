"use client";
import { useEffect, useRef, useState } from "react";
import {
  Target,
  Lightbulb,
  Cpu,
  ArrowRight,
  CheckCheck,
  Clock3,
} from "lucide-react";

const bays = [
  {
    title: "Build an explanation",
    Icon: Lightbulb,
    learn: "Learn what evidence can actually prove.",
    flow: ["Claim", "Evidence", "Explanation"],
    steps: [
      [
        "Build",
        "Tap Claim, Evidence and Explanation in that order. Tap a connected module to read its clue.",
      ],
      [
        "Test",
        "Choose a conclusion, then Run experiment. Use Kiko’s feedback to adjust and try again.",
      ],
      [
        "Submit",
        "Open Teach Kiko. Answer STORY, evidence and uncertainty in your own words, then Transmit discovery.",
      ],
    ],
  },
  {
    title: "Follow a click",
    Icon: Cpu,
    learn: "Learn each component’s job and why a failure changes the result.",
    flow: ["Browser", "API", "Server", "Database", "Response", "Screen"],
    steps: [
      [
        "Build",
        "Connect the six modules in the flow above. Reorder with arrows or remove a module with ×.",
      ],
      [
        "Test",
        "Choose a simulated fault and predict its effect. Run experiment and watch where the signal goes.",
      ],
      [
        "Submit",
        "Open Teach Kiko. Explain STORY, component roles, a failure and the model’s limits, then Transmit discovery.",
      ],
    ],
  },
];
export default function LevelThreeObjective({
  onContinue,
  hasSavedProgress = false,
  initialBay = 0,
}) {
  const heading = useRef(null);
  const [activeBay, setActiveBay] = useState(initialBay);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="signal-lab-objective" aria-label="Level 3 objective">
      <header className="lab-objective-intro">
        <div>
          <span className="lab-eyebrow">LEVEL 3 / YOUR OBJECTIVE</span>
          <h3 ref={heading} tabIndex={-1}>
            <Target size={25} /> Understand it. Predict it. Explain it.
          </h3>
          <p>
            Learn to explain a conclusion using evidence, and explain how a
            click travels through an app.
          </p>
          <small className="lab-objective-start">
            Start: choose a bay and a case, then select Power up lab.
          </small>
        </div>
        <img
          src="/images/pip/pip-guiding.webp"
          alt="Kiko presents your Level 3 objective"
        />
      </header>
      <nav className="lab-objective-switch" aria-label="Objective bays">
        {bays.map((bay, i) => (
          <button
            type="button"
            key={bay.title}
            aria-pressed={activeBay === i}
            onClick={() => setActiveBay(i)}
          >
            Bay {i + 1} · {bay.title}
          </button>
        ))}
      </nav>
      <div className="lab-objective-bays">
        {bays.map(({ title, Icon, learn, flow, steps }, i) => (
          <article
            key={title}
            className="lab-objective-bay"
            data-active={activeBay === i}
          >
            <header>
              <Icon size={24} />
              <div>
                <small>BAY 0{i + 1}</small>
                <h4>{title}</h4>
              </div>
            </header>
            <p className="lab-objective-learn">{learn}</p>
            <div className="lab-objective-flow" aria-label={`${title} flow`}>
              {flow.map((label, index) => (
                <span key={label}>
                  {index > 0 && <ArrowRight size={11} />}
                  <strong>{label}</strong>
                </span>
              ))}
            </div>
            <ol>
              {steps.map(([name, text], index) => (
                <li key={name}>
                  <b>{index + 1}</b>
                  <p>
                    <strong>{name}: </strong>
                    {text}
                  </p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <footer className="lab-objective-footer">
        <div>
          <strong>
            <CheckCheck size={17} /> Finish both transmissions to complete Level
            3 and unlock Level 4.
          </strong>
          <p>
            STORY: Scene · The need · Outline how it works · Relate to the
            concept · Your takeaway.
          </p>
          <small>
            <Clock3 size={12} /> This briefing does not start a timer. If a
            mission is already running, its timer continues.
          </small>
        </div>
        <button type="button" className="lab-primary" onClick={onContinue}>
          {hasSavedProgress ? "Return to lab" : "Enter lab"}
          <ArrowRight size={16} />
        </button>
      </footer>
    </section>
  );
}
