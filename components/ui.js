"use client";
import {
  X,
  Check,
  LoaderCircle,
  Inbox,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  return (
    <div
      className={`modal-backdrop ${variant === "level-drawer" ? "level-drawer-backdrop" : ""} ${variant === "level-completion" ? "level-completion-backdrop" : ""}`}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""} ${variant === "level-drawer" ? "level-drawer" : ""} ${variant === "level-completion" ? "level-completion-modal" : ""}`}
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              {kicker || "CODEWILD / FIELD CONSOLE"}
            </span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
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
      {portrait ? (
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
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="field-form"
      data-has-fields={fields.length > 0 ? "true" : "false"}
      aria-busy={submitting}
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        for (const field of fields)
          if (field.type === "number")
            data[field.name] =
              data[field.name] === "" && field.optional
                ? ""
                : Number(data[field.name]);
        try {
          if ((await onSubmit(data)) !== false) form.reset();
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {fields.length > 0 && (
        <div className="form-field-mark" aria-hidden="true">
          <Compass size={17} />
          <span>Expedition field record</span>
          <span className="form-field-rule" />
          <span>✦</span>
        </div>
      )}
      {fields.map((f, index) => (
        <label key={f.name} className="expedition-field">
          <span className="form-field-caption">
            <span className="form-field-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{f.label}</span>
            {f.optional && <small aria-hidden="true">Optional</small>}
          </span>
          {f.options ? (
            <select
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
      ))}
      {children}
      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? (
          <LoaderCircle className="spin" size={16} aria-hidden="true" />
        ) : (
          <Compass size={16} aria-hidden="true" />
        )}
        <span>{submitting ? "Recording…" : submit}</span>
        {!submitting && (
          <ArrowUpRight
            className="form-submit-arrow"
            size={17}
            aria-hidden="true"
          />
        )}
      </button>
    </form>
  );
}
export function Busy() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" />
      <span>Establishing uplink…</span>
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
