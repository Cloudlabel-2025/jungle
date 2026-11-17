"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { pipTutorial } from "@/lib/pip-tutorial";
import usePipProgress from "./usePipProgress";
import { pipImage } from "@/lib/pip-expressions";
import PipSpeech from "./PipSpeech";
import PipPointer from "./PipPointer";
import PipStage from "./PipStage";
import { findPipTarget } from "@/lib/pip-pointer";

export function PipDrone({ expression = "welcoming" }) {
  return (
    <span className="pip-drone" data-expression={expression} aria-hidden="true">
      <img
        key={expression}
        className="pip-character-image"
        src={pipImage(expression)}
        alt=""
        width={600}
        height={400}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

export function PipArrival({ returning = false, available = true }) {
  const dialogue = !available
    ? "Hey, explorer! I'm Kiko. Our flight is waiting for clearance. As soon as Command opens today's session, I'll help you get started."
    : returning
      ? "You're back! Your discoveries are safe. Hit Clock in when you're ready, and let's keep exploring together!"
      : "Hey, explorer! I'm Kiko, your flight buddy. Ready for your first discovery? Hit Clock in, and we'll take off together!";
  return (
    <div className="pip-arrival">
      <PipDrone expression={available ? "welcoming" : "thinking"} />
      <div className="pip-arrival-dialogue">
        <strong>
          Kiko <span>Your flight buddy</span>
        </strong>
        <PipSpeech text={dialogue} />
      </div>
    </div>
  );
}

export default function PipGuide({
  data,
  missionOpen,
  travelling,
  now,
  onMission,
  onMap,
  onNext,
}) {
  const step = pipTutorial(data, { missionOpen, travelling, now });
  const progress = usePipProgress(data), scope = progress.account;
  const [appearance, setAppearance] = useState({ account: "", id: "" });
  const [details, setDetails] = useState(false);
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pointer, setPointer] = useState(null);
  const following = progress.following;
  const completed = progress.completed.includes(step?.id);
  const dismissedStep = progress.dismissed.includes(step?.id);
  const seen = progress.seen.includes(step?.id);
  const appearing = appearance.account === scope && appearance.id === step?.id;
  const suppressed = completed || dismissedStep || (seen && !appearing);
  const pointedStep = useRef("");
  const highlighted = useRef(null);
  const highlightTimer = useRef(null);
  const clearHighlight = useCallback(() => {
    clearTimeout(highlightTimer.current);
    highlighted.current?.classList.remove("pip-spotlight");
    highlighted.current = null;
    setPointer(null);
  }, []);
  useEffect(() => {
    if (!step || dialogOpen || document.querySelector('[aria-modal="true"]')) return;
    if (appearance.id !== step.id || appearance.account !== scope)
      setAppearance({ account: scope, id: "" });
    if (!completed && !dismissedStep && !seen) {
      setAppearance({ account: scope, id: step.id });
      progress.patch({ seen: [step.id] });
    }
  }, [scope, step?.id, dialogOpen, completed, dismissedStep, seen]);
  useEffect(() => {
    setDetails(false);
    setNotice("");
    pointedStep.current = "";
    clearHighlight();
    return () => {
      clearTimeout(highlightTimer.current);
      highlighted.current?.classList.remove("pip-spotlight");
    };
  }, [step?.id, scope]);
  useEffect(() => {
    if (!following || completed || (seen && !appearing)) clearHighlight();
  }, [following, completed, seen, appearing]);
  useEffect(() => {
    const check = () =>
      setDialogOpen(Boolean(document.querySelector('[aria-modal="true"]')));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (
      !following ||
      suppressed ||
      !step?.action ||
      dialogOpen ||
      pointedStep.current === step.id
    )
      return;
    function continueGuide() {
      if (pointedStep.current === step.id) return;
      const target = ["show", "mission"].includes(step.action)
        ? findPipTarget(document, step)
        : Array.from(document.querySelectorAll("[data-pip-action]")).find(
            (el) => el.getClientRects().length && !el.matches(":disabled"),
          );
      if (!target) return;
      setNotice("");
      pointedStep.current = step.id;
      pointAt(target, false, true);
    }
    // Choices can arrive after the saved snapshot. Wait for the real controls.
    if (step.action === "mission") onMission();
    continueGuide();
    const observer = new MutationObserver(continueGuide);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden", "value", "data-pip-target"],
    });
    document.addEventListener("input", continueGuide, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", continueGuide, true);
    };
  }, [following, step?.id, dialogOpen, suppressed]);
  useEffect(() => {
    if (!pointer) return;
    function clicked(event) {
      const choices =
        ["genres", "questions"].includes(step?.target) &&
        event.target.closest?.(`[data-pip-target="${step.target}"]`);
      if (choices) {
        remember(step.id);
        clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => {
          const next = findPipTarget(document, step);
          if (next) pointAt(next, false);
          else clearHighlight();
        }, 0);
      } else if (pointer.contains(event.target)) {
        clearHighlight();
        remember(step.id);
      }
    }
    document.addEventListener("click", clicked, true);
    return () => document.removeEventListener("click", clicked, true);
  }, [pointer, step?.id]);
  if (!step || dialogOpen) return null;
  if (suppressed && !pointer) return progress.error ? <p className="pip-save-status" role="status">{progress.error}</p> : null;
  const expression = notice
    ? "concerned"
    : details
      ? "guiding"
      : step.expression;
  const dismissed = suppressed;
  function remember(value) {
    if (value) progress.patch({ seen: [value], dismissed: [value] });
  }
  function showTarget() {
    setNotice("");
    progress.patch({ following: true });
    if (step.action === "mission") {
      onMission();
    }
    if (step.action === "map") {
      onMap();
      return;
    }
    if (step.action === "next") {
      onNext();
      return;
    }
    const target = findPipTarget(document, step);
    if (!target) {
      setNotice(
        "That control is still loading. I'll point it out as soon as it's ready.",
      );
      return;
    }
    if (step.action === "attendance") {
      target.click();
      return;
    }
    pointAt(target);
    pointedStep.current = step.id;
    // Step aside so the player can use the highlighted game control.
    remember(step.id);
  }
  function pointAt(target, focus = true, scroll = focus) {
    clearHighlight();
    highlighted.current = target;
    target.classList.add("pip-spotlight");
    const focusable = target.matches("button,input,a,textarea,[tabindex]")
      ? target
      : target.querySelector(
          'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
        );
    if (focus) focusable?.focus({ preventScroll: true });
    if (scroll)
      target.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    setPointer(target);
  }
  return (
    <>
      {pointer && (
        <PipPointer
          target={pointer}
          dismiss={clearHighlight}
          label={
            [
              "chat",
              "transmit",
              "receipt",
              "replace-chat",
              "review-link",
            ].includes(step.target)
              ? ""
              : "Click here"
          }
        />
      )}
      {!dismissed && (
        <PipStage>
          <aside
            className={`pip-guide ${!missionOpen ? "is-on-map" : ""}`}
            aria-label="Kiko tutorial companion"
          >
            <PipDrone expression={expression} />
            <div className="pip-message" key={step.id}>
              <header>
                <span>KIKO / FLIGHT COMPANION</span>
                <button
                  type="button"
                  onClick={() => {
                    clearHighlight();
                    progress.patch({ following: false });
                    remember(step.id);
                  }}
                  aria-label="Minimize Kiko guidance"
                >
                  <X size={15} />
                </button>
              </header>
              <div>
                <h3>{step.title}</h3>
                <PipSpeech text={step.message} />
              </div>
              {details && (
                <p className="pip-sharing-tip">
                  In your AI tool, use Share to create a conversation link. Open
                  it in a private browser window to check that others can read
                  it. Paste that link here, then transmit it. Never include
                  passwords or private information.
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              {progress.error && <p role="status">{progress.error}</p>}
              <footer>
                {step.action && (
                  <button
                    type="button"
                    className="pip-action"
                    data-pip-action="true"
                    onClick={showTarget}
                  >
                    {step.label}
                    <ArrowRight size={15} />
                  </button>
                )}
                {["research", "transmit", "correction"].includes(step.id) && (
                  <button
                    type="button"
                    className="pip-tip"
                    aria-expanded={details}
                    onClick={() => setDetails(!details)}
                  >
                    {details ? "Hide tip" : "How to share a chat?"}
                  </button>
                )}
              </footer>
            </div>
          </aside>
        </PipStage>
      )}
    </>
  );
}
