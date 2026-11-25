"use client";
import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { diffChars } from "diff";

const language = (path) =>
  path.endsWith(".css")
    ? css()
    : path.endsWith(".json")
      ? json()
      : path.endsWith(".html")
        ? html()
        : javascript({ jsx: true });
const syntax = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [tags.keyword, tags.modifier], color: "#d7bafa" },
    { tag: tags.comment, color: "#91ac84" },
    { tag: tags.string, color: "#c8dd9b" },
    { tag: [tags.number, tags.bool, tags.null], color: "#efc18b" },
    { tag: [tags.variableName, tags.propertyName], color: "#dfebd8" },
    {
      tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
      color: "#93d8cf",
    },
    { tag: [tags.tagName, tags.typeName], color: "#c0d894" },
    { tag: tags.attributeName, color: "#e7ca91" },
    { tag: tags.operator, color: "#e2d2a5" },
  ]),
);
const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#101d17",
      color: "#dce7d5",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: '"JetBrains Mono",monospace',
      overflow: "auto",
    },
    ".cm-content": { padding: "18px 0", caretColor: "#e8cb88" },
    ".cm-gutters": {
      backgroundColor: "#101d17",
      color: "#708575",
      borderRight: "1px solid #304436",
    },
    ".cm-activeLine,.cm-activeLineGutter": { backgroundColor: "#1b3023" },
    ".cm-cursor": { borderLeftColor: "#e8cb88" },
    ".cm-selectionBackground": { backgroundColor: "#38513b !important" },
    ".cm-tooltip": {
      backgroundColor: "#203526",
      color: "#edf0da",
      border: "1px solid #506247",
    },
  },
  { dark: true },
);
export default function TeamCodeEditor({
  path,
  value,
  onChange,
  onSave,
  disabled,
}) {
  const host = useRef(),
    view = useRef(),
    current = useRef({ path, value, onChange, onSave, disabled }),
    configs = useRef({ lang: new Compartment(), edit: new Compartment() }),
    docs = useRef(new Map());
  current.current = { path, value, onChange, onSave, disabled };
  useEffect(() => {
    const makeState = (p, text, off) =>
      EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          theme,
          syntax,
          keymap.of([
            indentWithTab,
            {
              key: "Mod-s",
              run: () => {
                current.current.onSave();
                return true;
              },
            },
          ]),
          configs.current.lang.of(language(p)),
          configs.current.edit.of(EditorView.editable.of(!off)),
          EditorView.contentAttributes.of({ "aria-label": `Edit ${p}` }),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.every((t) =>
                t.annotation(Transaction.remote),
              )
            )
              current.current.onChange(update.state.doc.toString());
          }),
        ],
      });
    const instance = new EditorView({
      state: makeState(path, value, disabled),
      parent: host.current,
    });
    view.current = { instance, path, makeState };
    return () => {
      instance.destroy();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const { instance, makeState } = editor;
    if (editor.path !== path) {
      docs.current.set(editor.path, instance.state);
      instance.setState(
        docs.current.get(path) || makeState(path, value, disabled),
      );
      editor.path = path;
    }
    const previous = instance.state.doc.toString();
    if (previous !== value) {
      const parts = diffChars(previous, value, { timeout: 25 }),
        changes = [];
      let offset = 0,
        pending;
      if (parts)
        for (const part of parts) {
          if (!part.added && !part.removed) {
            if (pending) changes.push(pending);
            pending = null;
            offset += part.value.length;
          } else {
            pending ||= { from: offset, to: offset, insert: "" };
            if (part.removed) {
              offset += part.value.length;
              pending.to = offset;
            } else pending.insert += part.value;
          }
        }
      if (pending) changes.push(pending);
      instance.dispatch({
        changes: parts
          ? changes
          : { from: 0, to: previous.length, insert: value },
        annotations: Transaction.remote.of(true),
      });
    }
    instance.dispatch({
      effects: [
        configs.current.lang.reconfigure(language(path)),
        configs.current.edit.reconfigure(EditorView.editable.of(!disabled)),
      ],
    });
    instance.contentDOM.setAttribute("aria-label", `Edit ${path}`);
  }, [path, value, disabled]);
  return <div className="team-code-editor" ref={host} />;
}
