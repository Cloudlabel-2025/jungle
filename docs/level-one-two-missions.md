# Level 1: explore and verify

New research-mode Level 1 attempts have two concepts:

1. **Explore with AI.** Keep the existing genre/question reservation, acknowledgement, server timer and public-chat reading. Ask useful follow-up questions and compare evidence.
2. **Check one claim.** Select one claim from the research, read an independent HTTPS source, choose supported/challenged/uncertain, and explain the check in at least 20 words. All three verdicts are valid when explained; this is not a guessing quiz.

Mission 2 opens only after the system accepts readable, relevant research. The second check is bound to that research submission revision. Changing the research requires a new check. Independent source content is not automatically fetched or certified; the system validates a bounded source reference and written reasoning, and MC/CC retain result overrides.

`claimCheckRequired` versions the requirement. New research-mode records and new starts/replays enable it. Existing started attempts and completed results retain their original rules until replay; no live records are migrated or reset. Replay archives the check and its draft, clears them, and preserves the existing best-result/reward policy.

Both missions use the existing research timer. The final check affects the on-time star condition and elapsed time. New attempts earn their result and unlock Level 2 only after both missions; trophies remain 15/25/30 and XP remains 5× trophies. Drafts use a separate revision counter, own-account binding and authenticated APIs. Late claim checks remain editable while Day 1 is open, matching the existing Level 1 late-research policy; the on-time star requires both missions before the deadline. Retried completion cannot mint duplicate rewards or change the original completion time.

Kiko has an account-persisted claim-check tutorial step. The objective page and three-star guide describe both missions. The three-step genre/question/chat setup remains inside the first mission.

Verification uses isolated MongoDB fixtures for prerequisite locks, source validation, stale writes, account isolation, atomic awards, replay, research revision invalidation and Level 2 progression. UI checks cover restored notes, verdicts and existing Level 1 flows. Browser UAT uses a disposable local fixture, without resetting live players.
