"use client";
import { cloneElement, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
export function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return <span className="pa-password-input">
    <input {...props} type={visible ? "text" : "password"} />
    <button type="button" className="pa-password-toggle"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible} aria-controls={props.id}
      onClick={() => setVisible(value => !value)}>
      {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  </span>;
}
export function Field({ label, children, hint }) {
  const id = useId();
  return <div className="pa-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, ...(hint ? { "aria-describedby": `${id}-hint` } : {}) })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
