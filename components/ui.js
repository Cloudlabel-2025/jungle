"use client";
import { X, Check, LoaderCircle, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
export function Modal({ title, kicker, children, close, wide = false }) {
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
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
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
export function Avatar({ name = "", small = false }) {
  return (
    <span className={`avatar ${small ? "small" : ""}`}>
      {name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")}
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
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.options ? (
            <select
              name={f.name}
              defaultValue={initial[f.name] ?? f.options[0]?.value}
              required
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
              maxLength={4000}
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
              minLength={f.type === "number" ? undefined : f.min}
              required={!f.optional}
              placeholder={f.placeholder}
            />
          )}
        </label>
      ))}
      {children}
      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? "Recording…" : submit}
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
