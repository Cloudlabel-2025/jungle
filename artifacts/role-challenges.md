# Role-based challenge workflow

Implemented in the existing CODEWILD application. The feature is separate from the Week-1 discovery reflection and the Week-3 client-disruption gate. It can publish work from Week 1.

## Use the feature

1. Sign in as Centre Command, for example `karun@gmail.com`, using the password already provisioned for that account.
2. Open **Expedition setup** and click **Manage challenges** in the heading. The link jumps to the new Challenges section below the setup panels.
3. Click **Create challenge**. Enter its name/description, then add a task name, instructions, acceptance criteria, target team role, deadline and priority. Add more tasks when needed. The deadline label explicitly shows the browser's timezone; timestamps are stored in UTC and shared across teams.
4. **Save draft**. Drafts may be edited before publication. **Preview recipients** shows team → task → role → player. Every task needs exactly one active matching player in every team. Fix missing/duplicate roles using the setup allocation controls, then preview again.
5. **Publish to all teams** creates five independent assignments for one task, ten for two tasks, and so on. Every assignment in a release receives the same server publication timestamp. A published challenge is sealed; create a new challenge for subsequent work.
6. Players open **Objectives** or the map's **Objectives** panel. The matching player is the task owner. The board card displays the challenge, role and “Assigned to you”. The existing visible-page polling retrieves assignments within approximately six seconds, and new assignments produce an in-app toast during an active session. Offline players receive their saved assignments when they next sign in. Email delivery is not used.
7. The owner opens the task, follows the acceptance criteria, updates work status and submits a completion summary plus 1–10 evidence references. The existing pre-deadline status report remains a separate requirement. Submitted work is locked for review.
8. Mission Commander → **Trail objectives** shows the challenge filter and team progress. Open a task to inspect submission/evidence/history. **Return with feedback** puts it back In Progress for another submission. **Approve quest** marks only that assignment Done and uses the existing capped, idempotent reward transaction.

For example, a Backend Architect task goes to Rohan Gupta, Arjun Nair, Siddharth Bose, Rhea Saxena and Gaurav Sen in their respective teams. Completing Rohan's task leaves the other four assignments unchanged.

## Permissions and integrity

- Centre Command creates, updates drafts, previews and publishes. Commanders review and track published work; gamers cannot author challenges through direct APIs.
- Team roles use stable `teamRoleCode` values, distinct from application permission roles: `TEAM_LEAD`, `FRONTEND`, `BACKEND`, `DATABASE_QA`, `DEVOPS`. Existing `assignment` labels are migrated without changing accounts or passwords. Legacy known labels also resolve while a deployment awaits migration.
- Gamers retain team-scoped task visibility. Only the owner can update or submit a task. Submission content, evidence, review feedback and task-event history are restricted to the current owner and command roles.
- Preview tokens cover the saved draft version and current roster. Publication rechecks roles, active status, deadlines and recipients inside a MongoDB transaction. Roster changes and publication write the same cohort document, so concurrent updates cause a retry and revalidation.
- A partial unique index on `(challengeId, definitionId, teamId)` prevents duplicate assignments while preserving legacy tasks. Repeating publication returns the existing release. Concurrent Publish requests produce one release and one publication audit event.
- Each task preserves its original assignee, selected role, source definition, criteria and publication timestamp. Later role changes never silently transfer that task. Explicit reassignment requires a reason and an active matching role holder in the original team.
- Moving a player to another team is blocked while they own open challenge tasks. Reassign or finish their challenge work first; this preserves each team's original assignment and submission history.
- Creation, draft edits and publication have append-only challenge events. Task submissions, state changes, returns, approvals and reassignments have append-only task events. Failed publication commits no partial assignments.

## Implementation map

| File                                                            | Change                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lib/team-roles.js`                                             | Stable role catalogue, legacy label resolution, per-team recipient plan and roster errors                               |
| `lib/challenges.js`                                             | Draft validation, previews, transactional publication, idempotency and audit helpers                                    |
| `lib/db.js`                                                     | Challenge/ChallengeEvent/TaskEvent models, task submission/source fields, role codes, roster version and unique indexes |
| `lib/catalog.js`                                                | Freshly seeded gamers receive stable role codes                                                                         |
| `lib/snapshot.js`                                               | Scoped challenge data, owner-only submission projection and task history                                                |
| `app/api/[...path]/route.js`                                    | Challenge endpoints, evidence-backed submission, feedback, approval and roster safeguards                               |
| `components/Challenges.js`                                      | Authoring, editing, recipient preview, progress table, submission and feedback/history UI                               |
| `components/Views.js`                                           | Setup shortcut, role allocation dropdown, challenge filters, cards and task-detail integration                          |
| `components/Arena.js`                                           | New assignment notifications during active polling                                                                      |
| `app/globals.css`                                               | Challenge forms, responsive tables and progress styling                                                                 |
| `scripts/migrate-challenges.mjs`                                | Additive role/index migration, applied to the existing local database                                                   |
| `scripts/provision-account.mjs`, `scripts/provision-cohort.mjs` | Active-status changes participate in the cohort publication lock                                                        |

API: `POST /api/challenges/create`, `/update`, `/preview`, `/publish`; scoped `GET /api/challenges`. Submission and review reuse `POST /api/gamer/task-status` and `POST /api/commander/task`.

## Verification

- Production build passed.
- All **23 tests** passed, including MongoDB integration and four new role-matching tests covering every role, multiple tasks, missing/inactive/duplicate holders and legacy labels.
- Full production acceptance passed. New API cases cover authoring permissions, unpublished draft privacy, missing/duplicate recipients, stale previews, draft edits, roster changes, concurrent publication, unique release timestamps, independent team tasks, ownership checks, private submission data, evidence validation, feedback, resubmission, approval, duplicate reward prevention and stable ownership after role changes.
- Browser QA created a challenge through the actual form, previewed five Backend Architect recipients, published it, switched to Rohan's account, found the new assignment on Objectives and submitted evidence for review. QA used a disposable database, removed afterward; no sample challenge was published into the user's real arena.
- Saved previews: [published assignments](role-challenge-published.png), [player submission](role-challenge-player-submission.png).

The local preview is available through the existing development launcher at `http://127.0.0.1:3000`. No external deployment was performed.
