# CODEWILD

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

```sh
npm run build
npm run seed
npm start
```

Set `MONGODB_URI`, `SESSION_SECRET`, and `APP_ORIGIN` to the deployment’s exact HTTPS origin. HTTPS is required for production session cookies. Sessions are HttpOnly, signed, SameSite=Lax, and expire after eight hours. Every API action independently checks the current database role and scope. MongoDB unique keys and transactions prevent duplicate game rewards.

The persona launcher is **simulation access**. In production it is disabled unless `DEMO_MODE=true`. For a private hosted simulation, also set a strong `DEMO_ACCESS_CODE` and restrict deployment access. Individual password authentication is available through the sign-in form after secure account provisioning (see the V2 handover). A public rollout still requires account provisioning, operational rate limiting, monitoring, scheduled backups/reconciliation and institutional access validation. No deployment has been performed.

Schemas live in `lib/db.js`, immutable foundation/perk/rule definitions in `lib/catalog.js`, and the transaction-based authority engine in `lib/engine.js`. The isolated runtime is rebuilt by `npm run prepare` and `npm run build`.
