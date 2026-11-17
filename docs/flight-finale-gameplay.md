# Levels 4 and 5

Players enter both experiences from the existing sky map. The helicopter still travels to an unlocked checkpoint before entering it. Server progression, attendance requirements and mission APIs remain authoritative.

## Level 4: Investigation Deck

Open one of two case dossiers and select a released variant. Reading does not start the timer; **Open investigation** starts the saved attempt.

- The Impossible Claim: inspect the pinned clues and compare verification plans. An illustrative eight-run tray demonstrates the evidence lost by selecting only successes. The tray is practice, not additional facts about the pinned scenario.
- The Wrong Door: send simulated requests for the current or another crew member’s record. Compare a sign-in-only rule with an ownership check. The animated gate shows the resulting permission boundary. This deliberately narrow sandbox is a learning aid; custom and role-mismatch cases still require their own evidence and correction.
- Record FIRE and the remaining required evidence in the field notebook beside the clues. Submit both missions to complete the level.

## Level 5: The Captain’s Run

The flight plan has two checkpoints, accessible in either order so existing saved attempts remain usable.

- Discovery passport: start the attempt to open the original pinned question and research link. Conduct a new AI chat, submit a fresh public URL, and record FIRE, STORY, evidence and reflection as passport entries. The original chat cannot be reused.
- Knowledge run: answer one question at a time. An aircraft marks the current runway checkpoint; recorded answers have check marks. Review and change decisions before sealing. A missing-answer quiz cannot be sealed through the normal UI. An expired quiz remains subject to the existing server expiry policy and may require an MC/CC replay if incomplete.

## Persistence and assessment

The existing versioned attempt-save and attempt-submit APIs retain the evidence and timer. Optional bounded `gameState` metadata stores cursor, clue position and sandbox choices in the player's account; older attempts without it resume from their saved evidence. Metadata cannot grant completion or rewards. Expired editors show only acknowledged saved notes. Navigation flushes drafts and stops on a save failure.

Both levels retain their existing star guides, 15–30 trophies, progressive XP, server assessment, staff overrides and member/team replay. Replay archives the old attempt including board state and starts a clean attempt. No live player records were reset for this change.

Verification: isolated database coverage for restoration, ownership, stale writes, invalid metadata, scoring, overrides and replay; rendered UI regressions for Levels 2–5 and objectives; browser checks at desktop and mobile landscape using disposable local fixtures; separate production build.
