"use client";
import {
  X,
  Check,
  LoaderCircle,
  Inbox,
  Compass,
  PencilLine,
  ListChecks,
  Hash,
  CalendarDays,
  Link2,
  Mail,
  LockKeyhole,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { characterFor } from "@/lib/characters";
export function Badge({ children, tone = "" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({ title, kicker, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({ title = "All clear on this channel", children }) {
  return (
    <div className="empty">
      <Inbox size={25} />
      <h3>{title}</h3>
      <div className="empty-copy">{children}</div>
    </div>
  );
}
export function Modal({
  title,
  kicker,
  children,
  close,
  wide = false,
  variant,
  portal = false,
  companion,
}) {
  const root = useRef(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        root.current.querySelectorAll(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
    controls()[0]?.focus();
    function onKey(e) {
      // Only the top dialog handles keyboard input when a celebration overlays a level.
      if (
        Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) !==
        root.current
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const list = controls();
        const first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  const panel = (
    <section
      ref={companion ? undefined : root}
      role={companion ? undefined : "dialog"}
      aria-modal={companion ? undefined : "true"}
      aria-label={companion ? undefined : title}
      className={`modal ${!variant ? "modal-dialog" : ""} ${wide ? "wide" : ""} ${variant === "flight-mission" ? "flight-mission-window" : ""} ${variant === "level-drawer" ? "level-drawer" : ""} ${variant === "level-completion" ? "level-completion-modal" : ""} ${variant === "star-guide" ? "star-guide-window" : ""}`}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {kicker || "CODEWILD / FIELD CONSOLE"}
          </span>
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {!variant ? <div className="modal-content">{children}</div> : children}
    </section>
  );
  const dialog = (
    <div
      className={`modal-backdrop ${portal ? "priority-modal-backdrop" : ""} ${variant === "flight-mission" ? "flight-mission-backdrop" : ""} ${variant === "level-drawer" ? "level-drawer-backdrop" : ""} ${variant === "level-completion" ? "level-completion-backdrop" : ""}`}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {companion ? (
        <div
          ref={root}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="modal-companion-layout"
        >
          <aside
            className="modal-companion"
            aria-label="Pip, your flight companion"
          >
            {companion}
          </aside>
          {panel}
        </div>
      ) : (
        panel
      )}
    </div>
  );
  // The map is a stacking context below the player HUD. Mission scenes must
  // escape that context so the HUD cannot cover the title or close button.
  return (portal || variant === "flight-mission") &&
    typeof document !== "undefined"
    ? createPortal(dialog, document.body)
    : dialog;
}
export function HP({ value = 5 }) {
  return (
    <span className="hp-pips" aria-label={`${value} of 5 HP`}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className={i < value ? "filled" : ""} />
      ))}
    </span>
  );
}
export function Avatar({ name = "", player, small = false }) {
  const character = player && characterFor(player);
  const [failedSource, setFailedSource] = useState(null);
  const portrait = character?.image && failedSource !== character.image;
  const displayName = name || player?.name || "";
  return (
    <span
      className={`avatar ${small ? "small" : ""}${portrait ? " character-avatar" : ""}`}
    >
      {player?.characterHidden ? (
        <UserRound aria-label="Unknown character" size={small ? 20 : 32} />
      ) : portrait ? (
        <img
          src={character.image}
          alt={`${displayName ? `${displayName} as ` : ""}${character.name}`}
          width={80}
          height={80}
          decoding="async"
          onError={() => setFailedSource(character.image)}
        />
      ) : (
        displayName
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
export function Form({
  fields,
  onSubmit,
  submit = "Confirm",
  initial = {},
  children,
  onDraftChange,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const pending = useRef(false);
  return (
    <form
      onInput={
        onDraftChange
          ? (e) =>
              onDraftChange(Object.fromEntries(new FormData(e.currentTarget)))
          : undefined
      }
      className="field-form"
      data-has-fields={fields.length > 0 ? "true" : "false"}
      data-feedback={
        feedback ? (feedback.error ? "error" : "success") : undefined
      }
      aria-busy={submitting}
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setSubmitting(true);
        setFeedback(null);
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        for (const field of fields)
          if (field.type === "number")
            data[field.name] =
              data[field.name] === "" && field.optional
                ? ""
                : Number(data[field.name]);
        try {
          const result = await onSubmit(data);
          if (result === false) {
            setFeedback({
              error: true,
              message:
                "This record wasn't saved. Your entries are still here. Check the error and try again.",
            });
          } else {
            form.reset();
            setFeedback({ error: false, message: "Saved successfully." });
          }
        } catch (error) {
          setFeedback({
            error: true,
            message:
              error.message ||
              "This record couldn't be saved. Your entries are still here.",
          });
        } finally {
          pending.current = false;
          setSubmitting(false);
        }
      }}
    >
      {fields.length > 0 && (
        <div className="form-field-mark" aria-hidden="true">
          <span className="form-crest">
            <Compass size={25} strokeWidth={2.5} />
          </span>
          <span className="form-record-title">Mission details</span>
          <span className="form-field-rule" />
          <span className="form-field-count">{fields.length} fields</span>
        </div>
      )}
      {fields.map((f) => {
        const FieldIcon = f.options
          ? ListChecks
          : f.type === "number"
            ? Hash
            : ["date", "datetime-local", "time"].includes(f.type)
              ? CalendarDays
              : f.type === "url"
                ? Link2
                : f.type === "email"
                  ? Mail
                  : f.type === "password"
                    ? LockKeyhole
                    : PencilLine;
        return (
          <label key={f.name} className="expedition-field">
            <span className="form-field-caption">
              <span className="form-field-number" aria-hidden="true">
                <FieldIcon size={17} strokeWidth={2.6} />
              </span>
              <span>{f.label}</span>
              {f.optional && <small aria-hidden="true">Optional</small>}
            </span>
            {f.options ? (
              <select
                disabled={submitting}
                name={f.name}
                defaultValue={initial[f.name] ?? f.options[0]?.value}
                required={!f.optional && !f.options.some((o) => o.value === "")}
              >
                {f.options.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                disabled={submitting}
                name={f.name}
                rows={f.rows || 3}
                minLength={f.min || 1}
                maxLength={f.maxLength || 4000}
                defaultValue={initial[f.name] || ""}
                required={!f.optional}
                placeholder={f.placeholder}
              />
            ) : (
              <input
                disabled={submitting}
                name={f.name}
                type={f.type || "text"}
                defaultValue={initial[f.name] ?? ""}
                min={f.min}
                max={f.max}
                step={f.type === "number" ? f.step || "any" : undefined}
                minLength={f.type === "number" ? undefined : f.min}
                required={!f.optional}
                placeholder={f.placeholder}
              />
            )}
          </label>
        );
      })}
      {children}
      {feedback && (
        <p
          className={`workflow-form-feedback ${feedback.error ? "is-error" : ""}`}
          role={feedback.error ? "alert" : "status"}
        >
          <span className="form-feedback-icon" aria-hidden="true">
            {feedback.error ? (
              <AlertTriangle size={19} strokeWidth={2.5} />
            ) : (
              <Check size={20} strokeWidth={3} />
            )}
          </span>
          <span>{feedback.message}</span>
        </p>
      )}
      <button className="btn primary" type="submit" disabled={submitting}>
        <span className="form-action-icon" aria-hidden="true">
          {submitting ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : (
            <Compass size={21} strokeWidth={2.6} aria-hidden="true" />
          )}
        </span>
        <span>{submitting ? "Recording…" : submit}</span>
      </button>
    </form>
  );
}
export function Busy({ label = "Loading your workspace…" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(timer);
  }, []);
  if (!visible)
    return <div className="page-pending-placeholder" aria-hidden="true" />;
  return (
    <div
      className="page-pending"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <LoaderCircle size={17} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
export function Receipt({ children }) {
  return (
    <p className="receipt">
      <Check size={14} />
      {children}
    </p>
  );
}
