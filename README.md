# CODEWILD

## Existing workspace and additional programme

The expedition map is the Gamer home at `/gamer/dashboard`. All original pages, navigation, project levels, task workflows, Field Guide, Campfire, journal, workshop and staff controls retain their existing URLs and behaviour. **Week 1 & Recovery** is one additional entry in each role's original navigation. Its screens live under `/gamer/week-one`, `/commander/week-one` and `/centre-command/week-one`, with programme tabs inside that area (for example `/gamer/week-one-games` and `/centre-command/week-one-setup`). These additions never replace the original dashboard, setup or rewards pages.

Week 1/recovery assessment, trophies, results and temporary presentation groups remain separate from existing project progression, team roles, balances and energy. Original gameplay actions remain available while the programme runs. The programme's 5/5 energy display applies within its own area; existing gameplay retains its own rules and header.

## Saturday recovery and final teams — Pack 3A

Pack 3A V1/V1.1 is implemented within the existing 8 Gamer, 8 MC and 7 CC navigation areas. **CC activates Pack 3A** in Game Configuration or Final Results. New organisation defaults use **60%** clearance. Activation versions an existing cohort's policy at 60%; if Friday results were already published, MC must sign off and CC must publish a revised result before recovery invitations. Historical Friday publications, scores, ranks and awards remain intact. The old one-hour/70% workflow is retained only for historical cohorts that have not activated Pack 3A.

MC authors Saturday content in **Classes & Announcements → Saturday recovery configuration**; CC can also author it in **Game Configuration**. Supply the approved Saturday start/time zone/HTTPS meeting link, institution policy link/reference, response deadline, last permitted exam start, Monday notice, and two exam packs. Each Technology/Fun pack requires four named question variants, private reference answers/alternatives and an approved rubric. Incomplete drafts save successfully but cannot be approved or released. CC approves the saved immutable version. Actual examination questions are curriculum assets supplied later; the repository's fixture questions are test-only.

The configuration explicitly chooses Technology-first or either-exam-first access, and original Friday or approved recovery scores for recovered learners' team bands. The approved shared programme is **90-minute class + 20-minute break + two 30-minute exams = 170 minutes**. MC records actual class start/completion and opens exams after the break. Every verified below-60 learner is automatically included when CC reconciles invitations; no manual learner selection is available. Friday publication also creates invitations automatically when the approved recovery configuration is ready. Approved college notification delivery uses the existing durable webhook outbox; learners receive their invitation/status in their private results.

Gamer **My Results** provides Continue / Request Leave with actor/time evidence. No response after the configured deadline, absence, unresolved withdrawal, or an unsuccessful recovery remains Institution Decision Pending. CC records institution-approved withdrawal without refunds or deletion; the current-intake account becomes inactive and all assessment history remains. Class attendance is audited. Saturday My Day/My Games replace the ordinary daily forms after Friday closes. AI use is allowed; each exam starts its own server-controlled 30-minute timer, retains autosaved drafts across refresh and keeps expired incomplete evidence. Technical extensions retain prior evidence and invalidate stale marking/signoff.

MC/CC exports one pseudonymous batch per exam type with the pinned rubric, all four variant references and approved evidence. Imports require exact batch-ID coverage, scenario/source matching, bounded scores and feedback; raw AI reports are preserved. Scores ≤50%, ≥85%, unreliable evidence and expired/incomplete attempts require reasoned human verification. MC signs off; CC approves/locks the separate unrounded `(Technology + Fun) / 2` result. Both genuine assessable attempts and recorded attendance are required. Exactly 60 clears; missing evidence stays pending. Saturday never changes the Friday 100-mark score or Friday rank/prizes.

CC locks the eligible population: Friday-cleared plus CC-approved recovery-cleared learners, with unresolved and withdrawn learners held outside. Generate seeded, reproducible stratified teams of 3–5; fewer than three requires an institution exception. MC reviews or submits a reasoned JSON override; CC decides overrides, locks teams and publishes the entire roster together. Gamer projections contain no proposed membership or other learners' recovery scores. Publication emits `TEAM_ROSTER_PUBLISHED` with versioned membership and **0/1/2 extra team-shared daily support credits** for 5/4/3-member crews from Week 2. Published changes require an audited amendment, a new eligibility lock and review/publication cycle. This contract does not start sprint/task timers, assign TL roles, or spend support credits.

Saturday recognition is **Not Configured** until CC supplies trophy amounts, score eligibility and rules. Only qualifying verified recovery outcomes can receive an award, once per rule/learner. Rewards live in the separate Saturday ledger and do not change Friday marks or Week 1 trophy caps. Verification pending for more than 24 hours appears in the staff recovery queue. All recovery records live under the cohort's transactional `WeekOneProgram.data.recovery`, with immutable approved configurations, participant/attempt histories, raw assessment imports, institutional decisions, proposal versions and publication history; decisions use the existing role-protected audit.

Days 2–5 now additionally record explicit class completion before recap publication, separate recap opening/acknowledgement timestamps, and grouped anonymised classroom answers with an optional planned discussion time. Existing recaps and historical acknowledgements remain readable.

Validation: `npm run test:week1` includes Pack 3A rule and disposable database tests for the full three-persona recovery journey; `npm run build` checks production compilation. No production data migration, real invitations or external AI requests run automatically during tests.

## Week 1 programme

Week 1 adds the approved **8 Gamer, 8 MC and 7 CC programme views** as tabs within the additional Week 1 & Recovery area. Gamer views are My Day, Meeting Announcements, My Games, Ask MC, Research Showcase, Challenges & Rewards, Game Rules and My Results. Command views reuse the same activity, assessment, question, reward and voting services. Original gameplay remains available independently; it does not unlock Week 1 activities or award extra Week 1 trophies.

Centre Command configures the organisation's scoring weights, thresholds and working calendar before the cohort starts. Game Configuration supports provisioning exactly 25 Gamers and one MC from a private account JSON file: `accounts` is a list of 25 `{name,email,username,password}` records and `commander` is one record of the same shape. Passwords are salted and hashed, never placed in audit events or exported. Existing credentials require an explicit reset confirmation. New accounts have no permanent team leader or team assignment. Imports cannot remove accounts or overwrite another cohort's identities.

CC supplies four Day 1 questions and all Day 2–5 scenario/reference packs, the quiz answer key, three Compass prompts, award definitions and approved Saturday slots. **Validate and prepare** saves hidden content; MC or CC explicitly opens each day after closing its predecessor. No midnight or scheduled auto-opening occurs. Pending marking never blocks day progression or becomes zero. Opened scenarios, rubrics and attempt deadlines remain version-pinned. Closed days are read-only except audited authorised extensions and corrections.

MC/CC publishes the agenda silently into Meeting Announcements at or after the official start; there is no SOD reminder. Page viewing and acknowledgement are separate events, and acknowledgement within 30 official minutes earns +4 trophies. Each of two post-class recaps on Days 2–5 has one notice and a 20-minute acknowledgement window. Ordinary Ask MC questions are limited to two per day; Rules, access and essential support tickets have a separate queue and persist across days. Rules versions require explicit acknowledgement, generate two-working-hour reminders until acknowledged, and retain the 24-hour clarification window and shared FAQ.

Games use structured findings, questions, STORY fields, FIRE fields and component ordering. Server timers begin on actual Start, survive refresh, retain drafts and flag expired evidence. The one-attempt 15-item Friday quiz seals saved answers at expiry and grades against its private key without negative marking. Day 5 Fitness uses a fresh thread and the exact original Day 1 genre/question version. Curriculum is configurable; no in-product LLM, scraping, RAG or Teams integration is introduced.

New Day 1 baselines use **6/7/7/8/5 = 33**, with 50/50 AI and human ratings. Original approved baselines and historical 34-mark records remain preserved. A separate Day 1 reassessment uses Friday's identical four-criterion rubric, **6/7/7/8 = 28**, without overwriting the original. Day 1 Champion details remain private until MC signoff and CC publication of Week 1 results.

External-AI marking is batch export/import. A human approves complete de-identified evidence before export; each report contains every cohort learner's anonymous ID and all variant references. Imports validate exact ID coverage, duplicates, rating ranges, fingerprints, source revisions and rubric versions. Only observed criteria are scored; others remain Not Assessed. AI scores **<=50% or >=85%**, unreliable evidence and incomplete submissions require human verification. Assessments retain AI ratings, human decisions and revision history.

Showcase uses five temporary groups, consent and safe anonymous summaries before secret ballots, no self-votes, rapid repeat ballots and reasoned MC tie/unavailability decisions. Five distinct presenters are assessed per day: five general on Day 1, then three technical and two general daily. Each learner presents once and receives an evidence-backed 4/4/2 assessment. Daily Discovery requires genuine research evidence; an honest failed experiment still qualifies. The optional weekly and one-time Grand Challenge remain available through Week 6; no GOAT implementation is included.

Week 1 readiness is Fitness 50 + general games 15 + technical games 12 + quiz 3 + Showcase 10 + professional consistency 10. Exact fractional arithmetic determines the unrounded **>=60** Pack 3A clearance and **>=92** distinction boundaries (historical settings retain their version until CC activates the policy transition). Capability scores strictly **>92** generate matching Week 3 Level 2 considerations requiring evidenced MC review. Professional scoring uses applicable objective events, audited factual exclusions, the fixed missing-agenda and missing-Discovery deductions, and a zero floor. Fully excused days with no assessable events remain pending for factual/policy review rather than being assigned an invented score.

Programme energy remains **5/5 throughout Week 1**, including between days. Programme trophies have independent event ledgers and daily caps **20/30/30/30/30**, totaling 140; they do not enter readiness. Existing gameplay continues with its original reward, task and energy rules, independently of these programme records.

Friday publication requires accepted component marks, all 25 unique presentations, the daily presentation mix, completed Compass checks, resolved factual exceptions, 13 different award recipients, three imported AI-selected examples, an original Research Champion decision, MC signoff and CC approval. Publishing locks an immutable result revision and privately releases personal marks. With Pack 3A active, the approved shared recovery programme replaces legacy one-hour rescue bookings and final team formation follows verified Saturday outcomes. Provisional Friday memberships are withheld from Gamers. Sprint task management belongs to the next pack.

Corrections require CC authorisation, a new MC signoff and a new publication revision. A paginated role-protected audit records actors, times, source versions and decision evidence. Unpublished results, reference answers, quiz keys, other learners' marks and ballot identities are excluded from Gamer projections.

College scheduling notices are durably queued. Configure `WEEK1_NOTIFICATION_WEBHOOK_URL` (HTTPS), optional `WEEK1_NOTIFICATION_WEBHOOK_TOKEN`, and `WEEK1_COLLEGE_CONTACTS_JSON`, a map from cohort ID to approved `{name,email,approval}` contacts. After publication, the configured provider receives scheduling details and authorised recipients without private assessment marks. The provider must honour the stable `Idempotency-Key` header. Missing configuration or delivery failure remains visible to CC, with an explicit retry control; sent notices are not resent. No actual external service is contacted by the test fixtures.

Run `npm run test:week1` for all tests with disposable MongoDB integration, including the complete 25-learner five-day journey, and `npm run build` for production compilation. `node scripts/preview-week-one.mjs` starts a disposable Day 2 UI fixture on port 3103; `node scripts/check-week-one-http.mjs` checks all 23 role views, data privacy and API permissions against it. The fixture's synthetic content is test-only and never changes the workspace database. Production cohorts require institution-approved curriculum, Compass prompts, award rules, scheduling slots and notification-provider configuration.

The sections below describe the retained later-week and legacy modules, which are separate from the Week 1 programme.

## Player HUD and Centre Command level workshop

The player header shows their name, team role, XP level and progress, five lives, and three energy on the left; trophies, streak, team, and account controls remain on the right. Each penalty consumes one energy. The third penalty consumes one life and refills energy to three; at zero lives energy stays zero and a rescue case opens. Existing life balances are preserved. Life restoration also refills energy. The audit distinguishes energy penalties from life restoration and retains historical HP events.

The map has left/right buttons with click and hold scrolling, disabled at the world edges, plus the existing drag, wheel, and keyboard controls. Player navigation and the map controls sit lower on the left.

In **Centre Command → Expedition setup → Level workshop**, create a project or edit an existing level, choose one of 42 forest emblems, set its working-hour budget and integrated acceptance criteria, select teams, and define exactly one evidence-backed deliverable for each of the five team roles. **Save draft → Preview assignments → Publish level and assign tasks** validates active role holders before publishing. Existing chapter levels apply to all teams; new levels can target selected teams. New levels append to the map, which expands into further terrain chapters.

Publishing assigns tasks immediately to eligible teams. Teams on earlier projects queue until their preceding level is cleared; their clock begins when their project actually starts. Missing or duplicate roles block publication. If a roster becomes incomplete later, the preceding clearance and rewards are preserved, and the next level can be started after the roster is fixed. Started attempts retain a sealed copy of their definition, emblem, tasks, deadline, and reward basis. Draft changes do not alter existing attempts. Published team audiences can expand but cannot remove teams. Clearance checks every published level assigned to that team.

## Campus V3 investigation evidence

Help Desk now supports active/waiting/blocked timers, dated manual effort entries, audited corrections, comparable-repeat candidates, CC/delegated MC verification and signed differences. Centre Command support reports filter technical areas/umbrellas and export verified comparisons; approved knowledge cases may include redacted version-pinned summaries. Source corrections require a fresh review. No speed scoring is added.

Implementation, API contracts, migration, test evidence and remaining pilot gates: [Campus V3 handover](artifacts/campus-v3-handover.md). Apply `node --env-file=.env.local scripts/migrate-v3.mjs` after a verified backup. Build with `npm run build`; run the disposable unit/database/production API suite with `node scripts/verify-v3.mjs`.

## Team mini-project levels

The expedition map now represents ten shared team projects: message board, suggestion box, notes, contacts, reading list, expenses, supplies, task board, workshop registration, and private journal. Earlier knowledge encounters are optional lessons in **Field Guide** and no longer unlock the map or satisfy certificate clearance. This replaces the map and clearance behaviour described in earlier handover notes below.

Open Level 1 on the map and choose **Play**. Any teammate can start the available project. New attempts assign five distinct features to the team's five characters. Every player receives frontend, backend, database, testing and deployment/integration tasks for one complete feature: 25 persisted tasks per team. Missing or duplicate character holders block the whole start. Teams progress independently and cannot skip levels. Teams build locally in a shared Git repository; Jungle collects evidence and reviews rather than executing or hosting submitted applications. Existing attempts keep their original task definitions.

Budgets increase from 4 to 24 working hours. Project working hours are Monday–Friday, 09:00–17:00 IST; nights and weekends do not consume the budget. The two-star late window adds 25% of the budget, with a minimum of two working hours. These defaults are separate from the Help Desk's configurable SLA calendar.

Players submit each task with a summary and 1–10 evidence references through **Objectives** or a map level. Once all 25 tasks have been submitted, any teammate can submit the integrated project without waiting for Guide reviews. Guides supply a rationale and score correctness (40), verification (25), timeliness (20), and collaboration (15). Returning or reopening a contribution requires a new integrated submission. Integration approval requires all 25 task approvals and every published acceptance check verified. Individual level rewards use the rounded average of each player's five task scores, awarded once per player. Command reviews projects through **Trail objectives** or **Expedition setup → Team project progression**.

The five character identities are Blaze (Zayn/Zara), Glitch (Jett/Juno), Shade (Nyx/Nia), Pulse (Kai/Kira), and Rune (Riven/Rhea). Their male/female versions have identical gameplay. Players choose their version through **Choose character** in the navigation drawer; Centre Command can swap character identities in **Squad allocations**. See [character art and full-stack details](docs/character-art-and-full-stack.md).

An accepted integrated submission by the target deadline earns three team stars; within the late window earns two; later accepted remediation earns one. Unaccepted work receives no stars and cannot unlock the next level. Stars use the accepted submission's server timestamp, so Guide waiting time does not reduce the result. The next project's timer begins only when the team starts it.

Each member receives `round(level base × star multiplier × contribution score / 100)` independently for XP and trophies. Multipliers are 1×, 1.25×, and 1.5×. Level 1 bases are 100 XP / 50 trophies; subsequent levels add 25 XP / 10 trophies. Rewards are paid once, transactionally, at team clearance, separate from daily activity caps. Role-task approval alone pays nothing. Existing accounts, balances, lessons, and assignments are preserved. Cleared projects are sealed and cannot be farmed for additional rewards.

Collections and indexes are additive; no reset or reseed is required. Catalogue: `lib/project-catalog.js`. Server rules: `lib/projects.js`. Views: `components/Projects.js`. API: `POST /api/projects/start`, `/submit`, `/review`, `/task`; project task submissions/reviews also use the existing gamer/commander task endpoints. Membership, assignments, evidence, scores, progression, and integration requirements are server-verified. Concurrent operations serialize on the shared attempt and preserve audit events.

Validation: `node --test --test-concurrency=1 tests/*.test.mjs` (set `TEST_MONGODB_URI` for database checks). Production acceptance additionally exercises all ten projects through authenticated HTTP endpoints in a disposable database.

## Centre Command team creation and character abilities

In **Expedition setup → Teams & explorers**, Centre Command can create a named team with one to five members, or add members to an existing forming team. Each member needs a full name, unique username, initial password (8–256 characters), and one of the five character identities with a male/female version. Characters cannot repeat within a team. Account and team creation is atomic; usernames are case-insensitive and passwords are stored as salted scrypt hashes. New players use **Username or email** plus their password to sign in. They are not demo personas.

Teams have a hard maximum of five members, including roster transfers. Teams with fewer than five active, distinct character holders show as forming and can explore the app; full-stack levels start when all five slots are ready. Existing accounts and email sign-in continue to work.

Each character has a fixed optional support ability, shared by both versions: Blaze **Trail Planner**, Glitch **Debug Lens**, Shade **Edge Radar**, Pulse **Team Signal**, Rune **Contract Map**. Guidance is available in the character picker and beside a player's own feature tasks. Abilities do not change deadlines, task requirements, XP, trophies, life or energy.

API: `POST /api/centre-command/teams/create` with `{name, members}`; `POST /api/centre-command/teams/add-members` with `{teamId, members}`. Each member supplies `{name, username, password, characterKey, variant}`. Only active Centre Command accounts may use these endpoints. Responses contain usernames and avatar choices, never passwords or hashes.

## Role-based challenges across all teams

Centre Command → **Expedition setup → Manage challenges** creates a draft with one or more named tasks, target team roles, instructions, acceptance criteria and deadlines. **Preview recipients** lists the matching player in each of the five teams; **Publish to all teams** releases independent task assignments together. Missing or duplicate active role holders block publication. Draft edits and roster changes require a fresh preview; repeated publication never creates duplicate work.

Players receive assignments in **Objectives** and the map's **Objectives** panel through the existing six-second visible-page refresh. New assignments also produce an in-app toast while signed in. Players submit a completion summary and evidence references; the Mission Commander reviews them in **Trail objectives**, approves or returns with feedback. Challenge filters and per-team progress are available to command. Each team's completion is independent. Existing reward processing and caps apply.

The additive migration `node --env-file-if-exists=.env.local scripts/migrate-challenges.mjs` adds stable team-role codes and integrity indexes without resetting accounts, passwords or existing tasks. See [the challenge workflow guide](artifacts/role-challenges.md) for permissions, endpoints and validation evidence.

## 26 October campus handover V2

The existing workspaces now include a private Help Desk, configurable working-hour SLA, all six human support routes, descriptive discovery baselines, a reviewed success/failure case library, and MC-proposed / CC-validated growth reports with the 40/20/25/15 rubric. Individual password sign-in is available for provisioned accounts. New trophy awards cap at **50/day**; gamer data is team scoped and Week-1 rankings are paused.

Read [the implementation and gap register](artifacts/campus-v2-handover.md) for the 15-screen mapping, operational setup, additive migration, credential provisioning, backup/restore verification, acceptance evidence and remaining pilot gates. Centre Command must configure the college's support calendar and discovery prompt; neither is invented from the brief. Production account provisioning and staging remain operator work.

## Escape the Wild: jungle experience

The player workspace is now an original cinematic jungle expedition. Each existing squad is a party of five explorers; the Commander is their Expedition Guide and Centre Command is the Expedition Council. Existing accounts, permissions, records, rewards, and approval rules are preserved.

The expedition map is a 6,000-pixel-wide forest world with three distinct terrain regions: dense roots and cliffs, the approved valley and rope bridge, and overgrown ruins with a small muddy crossing. There are no drawn routes or start/end markers. Drag, scroll, or use keyboard controls to explore. Movement stops at the world's physical bounds. Camp, party, status, objectives, clearance, and the encounter list open from compact buttons. The mobile view retains the pannable world. Ten knowledge encounters use the original lessons and server-verified answers; completion and the next suggested encounter follow the explorer's saved progress. Encounters remain independently available.

The Field Workshop is the existing Code Lab; its banking exercise and virtual terminal retain their original behaviour. Jungle encounters currently use knowledge checks, not real-time combat or a new inventory system. Ambient audio and character abilities are not added in this version. Client-disruption sounds remain optional.

Narrative definitions: `lib/expedition.js`. Game map: `components/JungleGame.js`. Encounter lessons and catalogue: `components/Expedition.js`. Visual styles: `app/jungle.css` and `app/game-map.css`. Artwork lives in `public/images/`. The latest map notes are in `artifacts/uncharted-map.md`; earlier UI audit and artwork prompts are in `artifacts/jungle-ui-v2.md`.

Development and production builds default to Next.js's supported Webpack bundler because Turbopack's CSS worker failed on this Windows environment. The development launcher still accepts an explicit `--turbopack` override.

A private software engineering simulation built with Next.js App Router, React, **JavaScript**, CSS, Tailwind CSS 4, and **MongoDB / Mongoose**. The brief’s TypeScript and SQLite examples have been adapted to the requested stack. All 16 workspace routes are implemented.

## Run locally

Requires Node.js 22.17 or newer and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:3000** and select a persona. There are 25 gamers across five squads, Commander Vikramaditya, and three Centre Command leads. Use the profile control to change personas.

Without `MONGODB_URI`, the development launcher starts a real single-node MongoDB replica set on port 27019. WiredTiger data persists in `.data/mongo`; the database is not an in-memory mock. The first launch may download MongoDB 7.0.24. Stop with Ctrl+C. The embedded database launcher is a development dependency; deployed environments must provide their own MongoDB replica set or Atlas database.

If the app is already running, another `npm run dev` prints its URL and exits without starting a second database. An existing MongoDB on port 27019 is reused only after verifying that its actual data directory is this workspace's `.data/mongo` and that it is a replica set. Concurrent launchers are blocked by `.data/dev-launcher.lock`; stale owner records recover automatically. Ctrl+C stops the launcher's own Next.js process tree and MongoDB process while preserving database files. Never delete `mongod.lock` while MongoDB is running.

When the launcher manages local MongoDB, it checks the service every five seconds and restarts the same persistent replica set if that service stops. This also handles a reused database whose previous launcher exits. Explicitly configured `MONGODB_URI` services remain externally managed.

To use your own database, copy `.env.example` to `.env.local`, provide `MONGODB_URI` and a random `SESSION_SECRET` of at least 32 characters, then run `npm run dev`. A replica set is required because game updates use multi-document transactions. `npm run seed` seeds an existing configured database without resetting records.

The development launcher uses Node's system certificate store and forwards that setting to Next.js. This supports locally trusted certificate chains for Atlas while keeping TLS verification enabled. If a standalone database check reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, run `node --use-system-ca --env-file-if-exists=.env.local scripts/check-db.mjs` with the supported Node 22 runtime.

If your environment uses Windows-managed certificate authorities, start npm with `NODE_OPTIONS=--use-system-ca`. Certificate verification stays enabled.

## Workspaces

| Role              | Routes                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gamer             | `/gamer/dashboard`, `/gamer/before-you-board`, `/gamer/sprint-board`, `/gamer/team-room`, `/gamer/daily-journal`, `/gamer/rewards`, `/gamer/ide`     |
| Mission Commander | `/commander/dashboard`, `/commander/sprints`, `/commander/coaching`, `/commander/awards`                                                             |
| Centre Command    | `/centre-command/setup`, `/centre-command/dashboard`, `/centre-command/rules-approvals`, `/centre-command/client-control`, `/centre-command/reports` |

## Working flows

- Punch-in uses the server clock in Asia/Kolkata. On-time means at or before 09:00:00 IST; after 09:15:00, a reason is mandatory. A late arrival records one HP infraction. Attendance is unique per operative per IST day.
- Read a foundation and answer its check to complete it. The correct answer stays on the server. Ten foundations each award 15 XP and 10 trophies, subject to daily caps. XP tracks personal experience (100 XP per level); trophies determine team-scoped ranks after Week 1. Daily caps are 150 XP and 50 trophies.
- Open an assigned quest to report Complete, On Track, At Risk, or Delayed before its deadline. Move work to Review; a Commander approves it and awards its XP. Dependency locks are enforced on the server. Finishing work does not waive the pre-deadline communication rule.
- Submit a flight log once per day. Its timestamp and content are immutable through application APIs. Squad messages and blocker broadcasts are persisted in MongoDB. A Commander can resolve blockers.
- Commander coaching notes are private to command roles. Infractions always deduct exactly one HP and create an energy audit event. Three consecutive drops alert the operative’s squad and command. Zero HP opens a rescue case.
- Closed IST days qualify for recovery when attendance was on time, the journal was submitted, and no infraction occurred. Three consecutive qualifying days restore one HP, up to five. An open rescue requires a remediation plan before recovery. Missing days reset the streak.
- Commanders nominate perks; **two distinct Centre Command leads** must approve them. Emergency HP/XP restorations also need two independent seals, exclude the proposer, and remain subject to HP and daily XP caps. XP and trophies are never spent on perks. XP restorations award experience only and do not affect trophy rankings. Existing legacy XP balances convert once into 3× XP and 2× trophies, with an audit record and separate ledgers.
- Centre Command configures the arena, reallocates operatives, publishes rule amendments, and broadcasts client changes starting in week 3. Every squad receives the same stored event and server timestamp.
- Reports show competency and certificate clearance. Clearance requires all foundations, all assigned quests approved, positive HP, and no open rescue. CSV export includes the full trophy and energy ledgers and escapes spreadsheet formula prefixes.

Quest deadlines and clean-day recovery are reconciled on authenticated state reads. Clients poll every **6 seconds** while visible. This implementation provides shared persistent state with bounded polling latency; it does not use WebSockets or a background scheduler. Rules amendments are recorded as versioned guidance; changing the core rule engine requires a code change.

Squad presence comes from server-recorded activity heartbeats and expires after 20 seconds without a visible client poll. The top-bar speaker control enables optional audio alerts for newly received client disruptions; visual broadcasts always appear.

## Code Lab

The three virtual files are `src/App.jsx`, `src/styles.css`, and `tests/ledger.test.js`. Editing compiles JSX with browser-side Babel. A locally bundled React runtime renders the banking project inside an **opaque-origin iframe with `sandbox="allow-scripts"` only**. There are no CDN dependencies.

The parent never evaluates the edited source. Preview and test code execute inside sandboxed iframes with CSP blocking fetch, external scripts, and external images. Native form submission is disabled by the required sandbox, so the starter transfer button handles its click directly. Transfers use integer paise and validate sufficient funds. No real bank, financial account, or money is involved.

`npm test` executes the editable test file against the edited application’s `transfer` and `parseAmount` exports. It reports actual assertions and timings; changing the implementation can make tests fail. The mini runner exposes `test`, `assert.equal`, and `assert.throws`, awaits asynchronous tests, and releases the controls after a 10-second timeout. Preview compilation and tests have independent run tracking. The starter parses decimal INR strings directly into integer paise, including amounts such as `0.29`.

Supported terminal commands: `help`, `ls`, `npm test`, `git status`, `git add .`, `git commit -m "message"`, `git log`, `git push origin sprint-2`, `status`, `curl /api/transactions`, and `clear`. Git operations are explicitly simulated in browser memory. The curl command returns a labeled training fixture. No terminal input reaches a host shell, filesystem, Git process, or external repository.

**Save project** persists source files to the signed-in operative’s MongoDB workspace. Git history and preview banking transactions reset on reload. Reset only replaces editor files until the user explicitly saves. A browser iframe is a host-access boundary, not a CPU or memory quota; malicious infinite-loop code may still hang its browser renderer. This is a training editor, not a multi-tenant remote execution service.

## Validation

Production builds use one page-data worker and Tailwind scans only `app/` and `components/`. On memory-constrained machines, close unused preview/editor tabs before building; the browser-side compiler can retain significant memory.

```sh
npm test
npm run build
node scripts/smoke.mjs
```

The smoke script requires a running local development server and checks all 16 views, seeded topology, role restrictions, CSV export, and logout. Set `BASE_URL` and `DEMO_ACCESS_CODE` when needed.

`node scripts/acceptance.mjs` (with `TEST_MONGODB_URI` set, after a build) starts a temporary production server on port 3001 and tests the full mutation workflows in an isolated database: foundations, the daily cap, quest review, certificate clearance, attendance, journal sealing, blockers, saved projects, two-lead approvals, rescue, emergency overrides, disruption gates, and rule versions. It stops its server and drops only its own `codewild_acceptance_<timestamp>` database afterward.

For MongoDB integration tests, provide a running replica set:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27019/codewild?replicaSet=testset'
npm test
```

Database tests use an isolated `codewild_test_<timestamp>` database and remove only that database afterward. They cover concurrent duplicate awards, the daily cap, idempotent deductions, zero-HP rescue, Rule #10, and three-day recovery. With no test URI, integration tests are skipped and pure rule tests still run.

## Deployment boundary

For MongoDB Atlas and Vercel setup, follow [the Vercel deployment guide](docs/vercel-deployment.md). Run `npm run db:check` to verify the configured database and transaction support without changing records.

```sh
npm run build
npm run seed
npm start
```

Set `MONGODB_URI`, `SESSION_SECRET`, and `APP_ORIGIN` to the deployment’s exact HTTPS origin. HTTPS is required for production session cookies. Sessions are HttpOnly, signed, SameSite=Lax, and expire after eight hours. Every API action independently checks the current database role and scope. MongoDB unique keys and transactions prevent duplicate game rewards.

The persona launcher is **simulation access**. In production it is disabled unless `DEMO_MODE=true`. For a private hosted simulation, also set a strong `DEMO_ACCESS_CODE` and restrict deployment access. Individual password authentication is available through the sign-in form after secure account provisioning (see the V2 handover). A public rollout still requires account provisioning, operational rate limiting, monitoring, scheduled backups/reconciliation and institutional access validation. No deployment has been performed.

Schemas live in `lib/db.js`, immutable foundation/perk/rule definitions in `lib/catalog.js`, and the transaction-based authority engine in `lib/engine.js`. The isolated runtime is rebuilt by `npm run prepare` and `npm run build`.
