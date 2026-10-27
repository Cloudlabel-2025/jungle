# Campus V3 implementation, reconciliation and operator handover

Prepared for Karun on 27 October 2026 from the supplied V3 specification. Repository: https://github.com/Cloudlabel-2025/jungle. Inspected HEAD: `f7b398f8488524efc2b11ec69b1296d06e78fc64`; the checkout already contained uncommitted team-project changes, which were retained. This report describes local engineering evidence, not hosted staging or pilot approval.

## Change impact

The existing canonical application already provides shared MongoDB replica-set persistence, individual credentials, the original 15 navigation screens plus an additional Code Lab, ticket triage and SLA, six human intervention types, attempts, recovery evidence, reviewed cases, narrative discovery and separate growth reports. Their screen-by-screen inventory remains in `artifacts/campus-v2-handover.md`. V3 extends those implementations rather than creating another issue tracker. No automatic fault injection or adaptive engine was added.

| Screen                                 | Status / V3 impact                                                           | Implementation and API                                                          | Evidence                     |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| G01 `/gamer/dashboard`                 | Existing; new effort workspace inside Help Desk                              | `components/SupportConsole.js`, `components/EffortWorkspace.js`; `/api/support` | AT16–20                      |
| G02 `/gamer/before-you-board`          | Existing descriptive discovery retained                                      | `lib/support.js`: baseline / discovery-prompt                                   | existing AT03                |
| G03 `/gamer/sprint-board`              | Existing task evidence retained                                              | `components/Views.js`, Task; ticket task IDs                                    | existing workday acceptance  |
| G04 `/gamer/team-room`                 | Changed: timers, back-entry, comparisons, reviewed case summaries            | HelpTicket, EffortSession, VerifiedComparison, KnowledgeCase; support endpoints | AT16–20, case redaction      |
| G05 `/gamer/daily-journal`             | Existing personal ticket evidence links retained                             | Journal.supportTicketIds; gamer/journal                                         | existing workday acceptance  |
| G06 `/gamer/rewards`                   | Existing; no speed-based score or penalty introduced                         | `lib/engine.js`, `lib/rewards.js`                                               | reward regressions           |
| MC01 `/commander/dashboard`            | Changed: assigned ticket effort inspection and delegated review              | `lib/effort.js`; support endpoints                                              | AT18, AT20                   |
| MC02 `/commander/sprints`              | Existing task and project review retained                                    | `lib/projects.js`, `lib/challenges.js`                                          | project/challenge acceptance |
| MC03 `/commander/coaching`             | Changed: assigned ticket effort inspection and manual corrections            | `components/EffortWorkspace.js`; effort endpoints                               | AT16, AT19                   |
| MC04 `/commander/awards`               | Existing human approvals retained                                            | existing proposal/approval APIs                                                 | approval regressions         |
| CC01 `/centre-command/setup`           | Existing calendar/discovery setup retained                                   | Cohort; support/calendar                                                        | calendar unit tests          |
| CC02 `/centre-command/dashboard`       | Changed: effort reports, filters, explicit MC delegation                     | support/comparison-policy; report export                                        | AT18–20                      |
| CC03 `/centre-command/rules-approvals` | Existing approvals retained                                                  | existing approval APIs                                                          | approval regressions         |
| CC04 `/centre-command/client-control`  | Existing human broadcast retained                                            | ClientEvent; client-control API                                                 | Week-3 regressions           |
| CC05 `/centre-command/reports`         | Changed: signed verified totals, separate pending/rejected counts and export | `components/EffortWorkspace.js`; `/api/support/comparisons/export`              | AT18–20                      |

All new UI follows the existing support panels/forms and keeps the navigation groups. Data is server persisted; browser state only selects views and retains retry keys.

## Data and duration decisions

Development reload fix: `lib/model-registry.js` compares schema definitions and indexes before reusing a Mongoose model. A changed or legacy cached model is recompiled against the same collection. This prevents a running dev server from rejecting newly added fields such as `User.effortLock` after V3 edits. Strict validation remains enabled; no collection or records are deleted. `tests/model-registry.test.mjs` reproduces the cached pre-V3 model and verifies replacement, unchanged-model reuse and changed field/index handling.

Follow-up verification completed: all 35 tests passed with zero skips, including a MongoDB regression that reproduces the exact `effortLock` rejection, reloads the schema and successfully updates the same preserved learner record. The production HTTP suite passed timer start/stop, V3 comparisons and existing support/game regressions. Migration repeatability and restore across 38 collections passed again; latest restore evidence is `.data/v3-acceptance-backup-1793108503882.json.verified.json`, with the full run in `.data/v3-verification.log`.

`lib/db.js` adds EffortSession, VerifiedComparison and EffortWrite collections, learner/ticket write locks, explicit cohort comparisonReviewers and version-pinned optional knowledge summaries. `scripts/migrate-v3.mjs` initializes integrity indexes and adds defaults without deleting existing records or inventing calendars/delegations. It is safe to rerun. No live database migration is implied by disposable acceptance runs.

Each learner session belongs to one accessible ticket and stores the learner, submitting actor, UTC start/end, kind, origin, reason, timestamps and version. Manual entry requires an explicit UTC/offset interval; its minutes are derived from that interval. This deliberate constraint makes overlap checking possible rather than accepting undated quantities that could double-count. Timer timestamps use server time. Manual imports can be transcribed with their provenance in the reason; a bulk import endpoint is not provided.

Active minutes are the sum of `(ended_at - started_at) / 60000` for completed, non-deleted ACTIVE intervals. Unsuccessful investigation counts. WAITING, BLOCKED, removed and still-running intervals do not count. Fractions of a minute are retained; the interface rounds presentation to two decimals and displays cohort timezone. Stops, edits and soft deletes retain before/after audit history. Corrections require the current version. All period kinds are mutually exclusive per learner across every ticket, including running timers; adjacent intervals are permitted.

Learner locks serialize concurrent session writes. Ticket locks serialize source changes and comparison decisions. Actor-scoped idempotency receipts deduplicate identical retried writes and reject a key reused with different input. Session and decision writes, source totals, invalidation and audits commit in one transaction.

Comparisons link an earlier original and a later distinct repeat without changing either ticket. They capture technology/version, rationale, complexity/opportunity, environment, AI use, guidance and evidence. Difference = original active minutes minus repeat active minutes. Positive, zero and negative values are supported. Reports count comparison records, not unique learners, and include negatives in verified totals; pending and rejected records have separate counts.

Only CC or an explicitly delegated MC with current access to BOTH tickets may review. Learners cannot review. MCs cannot approve their own proposals; CC overrides require an audit reason. Verification requires explicit complexity/assistance confirmation, completed active evidence on both sources and no running source timers. Policy revocation is serialized with review. Reassignment never grants a new reviewer access to a former owner's private tickets.

Any source session write recalculates dependent comparisons, increments their version and returns them to PENDING, retaining the prior review in audit. Optional knowledge summaries are approved through the existing draft/redact/publish flow and pinned to the reviewed comparison version. They disappear immediately after correction, rejection or unlinking; later comparison verification alone cannot silently republish a changed summary. CC must revise the case, reattach and publish. Public summaries expose only durations and the descriptive label, never source IDs or raw personal context.

## API contract

All writes use the existing authenticated, origin-checked `POST /api/support/<action>` dispatcher. All new writes require a stable `idempotencyKey`; retries must send the identical payload. IDs come from `GET /api/support`. Validation failures return 400, denied roles 403, inaccessible source records 404, stale versions/overlaps/conflicting retry keys 409.

| Action            | Required inputs beyond idempotencyKey                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| effort-start      | ticketId, sessionKind ACTIVE/WAITING/BLOCKED, reason                                                             |
| effort-create     | ticketId, startedAt, endedAt (ISO with UTC/offset), sessionKind, reason                                          |
| effort-stop       | ticketId, sessionId, version, reason                                                                             |
| effort-update     | ticketId, sessionId, version, startedAt, endedAt, sessionKind, reason                                            |
| effort-delete     | ticketId, sessionId, version, reason (soft delete)                                                               |
| comparison-link   | originalTicketId, repeatTicketId, rationale, technology, difficulty, environment, aiUse, humanGuidance, evidence |
| comparison-review | comparisonId, version, status VERIFIED/REJECTED, reason; comparabilityConfirmed=true to verify                   |
| comparison-unlink | comparisonId, version, reason (audited soft unlink)                                                              |
| comparison-policy | reviewerIds (active MC IDs, empty list revokes), reason; CC only                                                 |
| case-comparison   | caseId (draft), comparisonId (verified source), reason; CC only                                                  |

`GET /api/support` includes `effort.sessions`, scoped comparisons, review policy and totals. Gamers only receive their own source sessions and comparisons where both tickets are their own; assigned MCs only receive currently assigned source records. Cross-student comparisons remain restricted to authorised staff. Gamer event payloads omit comparison before/after snapshots, which could otherwise leak another source's private context.

CC-only `GET /api/support/comparisons/export?technology=<substring>&umbrella=<primary umbrella>` exports VERIFIED records and their signed total/sample count, with pending/rejected counts kept separate. Cohort is the authenticated deployment cohort, not a caller-controlled scope. Existing private support export includes pending/rejected records clearly labelled for review and audit; it is not a verified-total export.

## Verification and operations

Local verification passed on 27 October 2026: 32 unit/database tests with zero skips; the production HTTP suite including AT16–AT20, existing V2 workflows and all ten team projects; the V3 migration executed twice; and content-hash/index restore verification across 38 collections. Detailed output is in ignored `.data/v3-verification.log`; restore evidence is `.data/v3-acceptance-backup-1793107064894.json.verified.json`. Verification ran sequentially with a bounded MongoDB cache after the host experienced memory pressure during concurrent QA. The optional task-selection bug discovered during browser checking was fixed in `components/ui.js`.

Final production-browser check passed: a learner submitted a private ticket with no task selected, recorded a dated manual active session, and saw the persisted `1h 0m active` total and correction controls. Screenshot: `artifacts/campus-v3-effort-workspace.png`. This was synthetic data in a disposable QA database; the browser tab, server and QA database were then removed.

Run `npm run build`, then `node scripts/verify-v3.mjs`. The latter starts a disposable MongoDB replica set, runs all unit/database tests and the production HTTP acceptance suite, and cleans up its database/server. It never loads `.env.local` or uses the developer's live database. Acceptance repeats the V3 migration twice and invokes the existing logical backup/restore verifier against its disposable dataset, including V3 evidence. Private backup output is in ignored `.data/`.

AT16–AT20 use explicitly synthetic fixtures: 180 + 240 active minutes plus excluded waiting, a 60-minute repeat, pending +360, delegated verification, correction to 480 repeat minutes producing −60, renewed review and rejection. Tests include concurrent duplicate writes, conflicting retry input, cross-ticket overlap, invalid intervals, a second credential session, forbidden gamer review/export, cross-team privacy, timer start/stop/removal, redacted case publication and withdrawal of stale summaries. These figures are acceptance examples and are not achieved student savings. Zero differences are covered by duration/report unit tests.

Before release: take a verified private backup; run `node --env-file=.env.local scripts/migrate-v3.mjs`; deploy the checked build; configure a real calendar if absent; CC explicitly delegates review if approved. The default is CC review only. Operators triage through the existing Help Desk, review source assistance/context and evidence, and publish only reviewed redacted cases. No background email/audio delivery or new scoring penalty is introduced.

Rollback uses the prior application build while retaining additive collections. Do not delete effort or audit records. A deployment rollback disables these V3 controls and UI; restore into a live database requires an operator-approved restore procedure. The logical restore verifier uses a separate database.

## Remaining delivery gates and decisions

| Gate | Local status                                                                | Remaining requirement / provisional additional effort                                                                                                                              |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Repo/commit and screen reconciliation available                             | ZIP/Lovable provenance and full Bucket 2 definitions absent; estimate pending those inputs                                                                                         |
| G1   | Build/auth/shared transactional storage tested locally                      | Hosted staging, real college accounts, institutional tenancy, infrastructure ownership and spend; estimate after environment access                                                |
| G2   | Automated core-workday tests available                                      | Dedicated SOD requirements/implementation and Balaji's two-device 25-person working-day rehearsal; estimate after SOD definition and operator calendar                             |
| G3   | Reward/recovery/approval/common-event regressions available                 | Final 19-rule exceptions, complete scoring map, operational recovery/appeal SOP; estimate after business decisions                                                                 |
| G4   | V2 workflows retained; V3 effort/comparison delta implemented and automated | Balaji comparison policy validation, actual college calendars, triage targets, voice evidence availability and moderation training; validation effort depends on reviewer capacity |
| G5   | Repeatable build, test runner, local migration and logical restore evidence | Production staging/restore/security review, accelerated six-week role rotation rehearsal, final reports and signed go/no-go; estimate after G0–G4 inputs                           |

V3 engineering work is isolated in `lib/effort*.js`, `components/EffortWorkspace.js`, the additive schema/support/API integration, migration and new acceptance fixtures; V2 business-rule remediation and existing project work must be estimated separately. A numerical remaining estimate or earliest pilot date is not evidence-backed until the listed dependencies and developer capacity are supplied; the earlier seven-day schedule is not reinstated.

The supplied document names G01–G41, MC01–MC28, CC01–CC40 and X01–X20 but does not provide those detailed register definitions. `artifacts/campus-v3-requirement-register.csv` records every identifier as needing its source definition; do not infer those IDs from similarly numbered navigation screens. The 15 screens above are a separate verified inventory.

This remains a single-college, single-cohort deployment. The underlying application still assumes `alpha` in core game APIs and does not implement general multi-institution tenancy. Attendance and project calendars retain existing IST conventions separately from the configurable support calendar. SLA escalation is read/mutation driven, with no unattended scheduler. Retention/deletion policy, final certificate criteria and privacy exceptions need owner decisions; no destructive retention automation is enabled. Six-week acceptance, production vulnerability clearance and signed pilot approval are not claimed. These constraints were already documented in the V2 handover and are not solved merely by adding effort records.
