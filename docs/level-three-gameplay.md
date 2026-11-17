# Level 3: a guided Signal Lab

The player sees two mission choices, then three steps: **Read the case → Try it → Explain it**. The mission list, case picker, challenge and writing view are separate. The main screen no longer displays module-management tools, advanced faults and every written checkpoint together.

## Player experience

- **Explain a clue:** read a short claim and a surprising clue, choose an explanation and test it. Incorrect choices get a clear retry action. Kiko reacts to the result. The old abstract claim/evidence/explanation sorting puzzle is removed from the visible flow.
- **Follow a click:** choose the next action in a six-step journey. Plain labels accompany the original component terms. There are only two repair controls: Undo last and Start again. Predict and test the completed path. Extra practice conditions are collapsed by default; an existing saved non-default fault remains visible.
- **Explain it:** answer one plain-language question at a time. Desktop users can optionally jump to another answer. Landscape uses Back/Next and an answer count, keeping the editor and its action visible without overlap. Full STORY/evidence requirements remain unchanged.
- **Result:** the next mission or level is the primary action. Review is secondary. Practice, revision, sharing consent and transmission history remain available under More options.

Canonical authored cases use concise reading cards derived from the existing case material. A modified or historical custom briefing keeps its original full text and gets neutral practice feedback; a generic simulation does not certify that case's facts.

## Saved work and authority

This change does not migrate or reset player records. Existing activity IDs, case assignments, deadlines, written fields, component order, labState, submissions, rewards and staff overrides are retained. Reopening the level chooses the most recently worked unfinished mission using account timestamps. Written answers resume at the first missing field. A historical technical attempt with unfinished ordering returns to the path builder while retaining its existing notes.

The existing versioned attempt-save and attempt-submit APIs remain authoritative. Navigation flushes drafts and stays on the current screen if saving fails. Expired work remains read-only and submits only acknowledged saved evidence. Completed-result practice uses separate local copies and grants no rewards. Staff member/team replay still archives the original work before creating new attempts.

The three-star criteria and progressive rewards are unchanged. Practice alone does not complete a mission. Existing best-result and authorised replay behaviour remain in force.

## Verification

Rendered UI tests cover the guided entry, one reading action, saved notes, historical technical ordering, locked levels and recent-mission restoration. Isolated database tests cover scoring, versions, privacy, rewards, staff overrides and replay. Browser UAT uses a disposable local fixture for wrong/correct choices, Undo, sequential notes, reload restoration and submission at desktop and 852 × 393 landscape sizes. Live player records are not changed by the UI tests. Temporary public preview bundles are removed after verification.
