const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function pipPointerPosition(rect, viewport, showLabel = true) {
  const width = showLabel ? 126 : 40,
    height = showLabel ? 66 : 40,
    gap = 8;
  if (
    rect.bottom <= 0 ||
    rect.top >= viewport.height ||
    rect.right <= 0 ||
    rect.left >= viewport.width
  )
    return null;
  const above = rect.top >= height + gap + 8;
  const center =
    (Math.max(0, rect.left) + Math.min(viewport.width, rect.right)) / 2;
  return {
    left: clamp(center - width / 2, 8, Math.max(8, viewport.width - width - 8)),
    top: above
      ? rect.top - height - gap
      : clamp(rect.bottom + gap, 8, Math.max(8, viewport.height - height - 8)),
    direction: above ? "down" : "up",
  };
}

export function findPipTarget(document, step) {
  const selectors =
    step.target === "genres"
      ? [
          '[data-pip-target="genre-confirm"]:not(:disabled)',
          '[data-pip-target="genres"] .flight-world-beacon:not(:disabled)',
        ]
      : step.target === "questions"
        ? [
            '[data-pip-target="question-confirm"]:not(:disabled)',
            '[data-pip-target="questions"] label:has(input:not(:disabled))',
          ]
        : [
            step.action === "attendance"
              ? ".attendance-trigger"
              : `[data-pip-target="${step.target}"]`,
          ];
  for (const selector of selectors) {
    const target = Array.from(document.querySelectorAll(selector)).find(
      (el) =>
        el.getClientRects().length &&
        !el.closest("[hidden]") &&
        !el.matches(':disabled,[aria-disabled="true"]') &&
        !(
          step.target === "transmit" &&
          el.form?.querySelector(
            "input:invalid,textarea:invalid,select:invalid",
          )
        ),
    );
    if (target) return target;
  }
  return null;
}
