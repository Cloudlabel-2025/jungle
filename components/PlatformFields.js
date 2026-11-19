"use client";
import { cloneElement, useId } from "react";
export function Field({ label, children, hint }) {
  const id = useId();
  return <div className="pa-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, ...(hint ? { "aria-describedby": `${id}-hint` } : {}) })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
