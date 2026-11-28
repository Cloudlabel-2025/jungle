# Open the first-part game

Centre Command selects **Open first-part game** from the dashboard, Game Configuration or Command Centre for the current cohort. Add at least one active player first. The action requires `game:write` access.

The launch prepares the built-in research pack and Level 2–5 mission packs wherever published content is missing. It automatically groups the active research roster in groups of up to five. Players added afterwards can enter without reconfiguring the release. Published content, unfinished setup drafts and existing player work are retained.

Players begin at Level 1 and unlock the next level by completing their current one. Game entry works independently of college attendance hours and does not create an attendance record. The research timer starts when the player begins the research mission. Existing scoring and evidence requirements remain in effect.

Completion-based first-part players receive unrestricted play access across dates, shifts and weekends. Attendance prompts and clock-in/out controls are hidden during this stage. Existing official attendance and extra-play records are preserved. Attendance controls resume after players enter the expedition. Advanced legacy scheduled programmes retain their calendar-based operation.

In Results, CC and MC can compare the automatic score with the current result for each player and level, inspect scoring checks and evidence, then validate, correct stars or return the level for revision. MC editing remains limited to assigned players. Corrections retain the automatic score and previous decisions, reconcile trophy/XP differences, and respect finalised-result locks.

Choose **View full submission history** in the selected level review to load every saved submission, grouped by attempt, mission and revision. Revisions and saved transcripts appear as readable sections without nested dropdowns. This includes earlier chat links, saved transcripts, answers and archived replay attempts. Level 1 claim-check revisions are recovered from the audit history as well as saved attempt records. Drafts are not labelled as submitted work. MC history access is limited to assigned players; CC can view the cohort. Viewing history does not change scores, rewards or the evidence version used for staff validation.

Each successful staff validation, revalidation, result change, return for revision or replay grant creates a private in-app notification for each affected player. The notice includes the reviewer's name and role, level, reason and result; changed scores show the previous and new stars. Notices are saved in the same transaction as the decision, so failed, stale or rolled-back reviews do not send them. Read receipts persist across sign-ins. The notification opens the player's Results page. No mail setup is required.

The staff review uses a searchable player selector, level controls, a side-by-side score comparison, submitted evidence and a separate decision form. Other conduct, team and final publication controls remain available in their own navigation tabs.

The comparison shows visual gold stars for **Earned stars** (automatic scoring) and **Actual result** (the currently saved result). Choose **Validate result** to confirm the saved stars, or **Correct result** to select the actual star rating and enter a required correction reason. The star choices and decision preview update before saving; the original earned score remains visible after correction.

The results page opens on **Level reviews**. Scoring checks and current submitted evidence are visible directly, with plain labels and quiz option text. Readiness and allocation, team results and replay, trophy adjustments, capabilities, awards and the CC-only Day 1 champion tools have separate navigation tabs. Saved experiment objects are not displayed as raw JSON in the review.

Custom Game Rules are optional for this workflow. The launch does not publish rules, record an acknowledgement or claim staff reviewed the question bank. Advanced scheduled day releases retain their existing rule publication requirements.

First attempts, saving, submitting, mistakes and help requests are free. Players can choose **Retry Level · 1 energy** after a timer expires or a level is completed. Confirmation archives both missions and all evidence, resets that level, and charges one energy exactly once. Mission timers restart when the new missions are launched. Retry spending never removes lives, resets clean-day streaks or counts as a conduct infraction. At zero energy, open Help Desk for the recovery drill or staff review. Finalised results and scheduled play windows remain protected.

Completed player retries earn 25% of normal XP, rounded down. Beating the highest previously earned stars grants a maximum of three extra trophies per attempt; equal or lower stars add no trophies and preserve earlier rewards. A first completion with no earlier earned stars receives the normal trophy award and reduced retry XP. Repeated submissions and refreshes cannot duplicate rewards. Previous completion is retained while retrying, so unlocked later levels stay available. Historical balances and staff-granted replay rules remain preserved.

Repeating the launch preserves progress. Cohorts with finalised or published results cannot be reopened through this button. If existing attempts have lost their original content, restore that content before launching.

Deploy the application changes to use the new flow on Vercel. No database migration, seed or production CLI command is needed. The game opens only after CC clicks the button in that deployed environment.
