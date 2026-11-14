var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// components/DayOneReviewEvidence.js
var DayOneReviewEvidence_exports = {};
__export(DayOneReviewEvidence_exports, {
  default: () => DayOneReviewEvidence
});
module.exports = __toCommonJS(DayOneReviewEvidence_exports);
var import_jsx_runtime = require("react/jsx-runtime");
function DayOneReviewEvidence({ record: r, canVerify, formatDate }) {
  const assignment = r.researchAssignment;
  const mission = assignment?.question || r.config.genres.find((g) => g.id === r.genreId);
  const submission = r.submissions.at(-1);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { "aria-label": "Saved Level 1 work", className: "receipt", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Saved Level 1 work" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "World:" }),
      " ",
      assignment?.genreName || r.researchSelection?.genreName || mission?.name || "Not selected"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Mission:" }),
      " ",
      mission?.title || mission?.name || "Question not selected"
    ] }),
    (mission?.prompt || mission?.question) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: mission.prompt || mission.question }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
      "Mission accepted: ",
      r.acknowledgedAt ? formatDate(r.acknowledgedAt) : "Not yet",
      " \xB7 ",
      "Research started: ",
      r.startedAt ? formatDate(r.startedAt) : "Not yet"
    ] }),
    submission ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "AI chat submitted:" }),
        " ",
        formatDate(submission.at),
        " \xB7 ",
        r.submissions.length,
        " saved ",
        r.submissions.length === 1 ? "submission" : "submissions"
      ] }),
      canVerify && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "btn", href: submission.url, target: "_blank", rel: "noopener noreferrer", children: "View submitted AI thread" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: r.verification?.status === "VERIFIED" ? "AI chat verified." : r.verification?.status === "INACCESSIBLE" ? "The submitted chat needs an access correction." : "Work received. Awaiting Centre Command link verification." }),
      !canVerify && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Centre Command reviews the submitted AI chat; Mission Commander manages operational markers." })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: r.draft?.url ? "An AI chat link is saved as a draft, but has not been submitted." : "No AI chat has been submitted yet." })
  ] });
}
