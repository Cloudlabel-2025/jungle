# Manual testing guide by role

Local application: `http://localhost:3000`.

The central address is the Super Admin CMS. Player, MC and CC accounts sign in through their college's own address. For **College for test**, use `http://college-for-test.localhost:3000/`. For another college, copy **Open college** from the CMS. A path-based entry is `http://localhost:3000/c/<college-url-name>`; enter there first and follow the app's links so the college context is retained.

In the tables below, college page paths are relative to the college address, not the central CMS address. MC means Mission Commander / Guide. CC means Centre Command. Super Admin is a separate CMS role; there is no additional AA role to test.

## Test setup and order

1. CMS: open a college, its cohort, CC/MC accounts, teams and players. Check the college sign-in URL.
2. CC: configure and release the flight programme. MC: verify assigned teams and assessment/recovery controls.
3. Player: complete the five flight levels in order, including saving, retrying, recovering energy and refreshing the page.
4. MC/CC: inspect actual player evidence, validate/correct results, complete readiness checks, MC sign-off and CC publication.
5. Player: enter the jungle, create a personal avatar, start released coding work and submit evidence/checkpoints.
6. MC/reviewer: approve or return checkpoint work; CC: verify client acceptance and award the correct sprint key. Repeat through all five sprints and the ending.
7. Two teammates: check shared Code Lab edits, conflicting edits, local sync, preview/tests, fullscreen and MC/CC project feedback.
8. Repeat access checks with a different team, college and role.

Use separate browser profiles or different browsers for simultaneous players on the same college host. Tabs in the same browser profile share the sign-in cookie. A complete Week 1 publication rehearsal requires **25 learners / five teams**, including its assessment, recognition and readiness prerequisites; a small fixture is sufficient for individual page checks but not full publication.

## Super Admin / CMS

All these pages use the central address.

| Page / entry | URL or navigation | Purpose and manual checks |
| --- | --- | --- |
| CMS sign-in | `/platform` | Sign in with a platform account. Check eye button, wrong credentials, refresh, sign-out and session persistence. College credentials should not authorize CMS management. |
| Colleges | `/platform` → **Colleges** | Search/filter colleges, open their details and check access status. |
| Add college | `/platform/colleges/new` | Create a college and its first administrator. Check validation, URL preview, duplicate names/codes and resulting portal link. |
| College overview | `/platform?college=<college-id>` or open a college | Inspect cohorts, CC/MC accounts, teams and learners. Check creation/editing permissions, duplicate usernames, five-member limits and saved changes after refresh. Roles assign work; players create their own appearance. |
| Edit college | `/platform/colleges/<college-id>/edit` | Edit the college profile, display name, URL name and access. Confirm the displayed portal URL follows the saved configuration. |
| Super admins | `/platform` → **Super admins** | Create/edit platform administrators and manage active access. Check account validation and protection of the last active administrator. |
| Recovery | `/platform` → **Recovery** | Inspect password reset requests, delivery status and missing email configuration. A delivery/configuration error should be explained clearly. |
| Activity | `/platform` → **Activity** | Review college/account management actions and their actor/history. |
| Account | `/platform` → **Account** | Change the current platform password. Verify current-password and confirmation validation, and that the new login works. |
| Forgotten password | `/recover?realm=platform` | Request a platform reset. Check clear feedback and single-use/expired-link handling when mail is configured. |

The CMS sidebar sections are views within `/platform`; they are not separate `/platform/activity` or `/platform/recovery` routes.

## Player / Gamer

| Page | College-relative path | Purpose and manual checks |
| --- | --- | --- |
| Expedition map | `/gamer/dashboard` | The story entry point. During flight, show the sky map and five levels; after the handoff, show jungle coding levels and earned keys. Check locks, resume, next action and the final **Review clearance** celebration. |
| Field Guide | `/gamer/before-you-board` | Read expedition foundations and complete available knowledge checks. Should explain the rules without trapping navigation. |
| Objectives | `/gamer/sprint-board` | Existing expedition quests, assigned work, status and evidence. Open a task, save work, submit and inspect review state. |
| Programme Sprint Work | `/gamer/sprint-board?board=programme` | Coding missions, five SDLC checkpoints, evidence, independent reviews and team/client progress. Check that unavailable trails stay locked and valid trail links open the correct sprint. Use generated trail links; sprint IDs are not the numbers 1–5. |
| Level objectives | `/gamer/objectives` | Read the objective/acceptance information for available levels. Check that it matches the level actually played. |
| Campfire | `/gamer/team-room` | Team communication, blockers and help. Verify messages and people belong to the current team. |
| Explorer's journal | `/gamer/daily-journal` | Save daily reflections and sprint records. Check validation, dates, refresh persistence and that saving is not mistaken for final submission. |
| Relics & honours | `/gamer/rewards` | XP, earned trophies, league/division progress, perks and available programme documents. Check balances against completed actions and prevent duplicate rewards on reload/retry. |
| Field workshop / Code Lab | `/gamer/ide` | Edit the shared team project, save files, view history, preview, quick-test, download ZIP, connect local sync and request MC/CC review. |
| Coding studio | `/code-studio` | Dedicated coding workspace. Test editor/output/terminal fullscreen, exit fullscreen, Node startup/recovery, package installation, tests and preview server. This is a Node shell, not Windows CMD. |
| Calendar | `/gamer/calendar` | View scheduled classes, deadlines and events. Check dates/time zone and that items are relevant to the learner. |
| Notifications | `/gamer/notifications` | Read alerts and follow their destinations. Check unread counts, mark-read behaviour and destination access. |
| My Day / recovery | `/gamer/week-one` | Week 1 progress and the current activity/day. After the relevant programme stage, display recovery work rather than an inaccessible activity. |
| Meeting Announcements | `/gamer/week-one-announcements` | Read class/meeting announcements and provide required acknowledgements. |
| My Games | `/gamer/week-one-games` | Enter available flight activities, resume saved attempts and see level state. Test the five levels in order. |
| Ask MC / energy recovery | `/gamer/week-one-ask-mc` | Ask for help, track a question and use the zero-energy recovery flow. At zero energy, this page and saved work must remain usable. |
| Research Showcase | `/gamer/week-one-showcase` | Submit/read research and complete permitted showcase participation. Check author attribution and submission state. |
| Challenges & Rewards | `/gamer/week-one-challenges` | View and take available challenge/reward activities. Check eligibility, evidence and completed status. |
| Game Rules | `/gamer/week-one-game-rules` | Read/acknowledge the current rules version and review available guidance. |
| My Results | `/gamer/week-one-results` | View personal stars/results, published feedback, recognition and recovery/readiness status. Staff corrections should appear after refresh. |

### Player overlays and controls — not separate URLs

| Entry | Purpose and checks |
| --- | --- |
| Header clock icon / Check-in | Clock in/out; late reason; attendance state; session continuation. Check repeated clicks do not duplicate attendance or rewards. |
| Profile icon | Open profile, work-by-date history, XP and trophies. Check full-face framing at desktop/mobile sizes. |
| **Create my avatar** / **Customize avatar** | Open the personal avatar studio. Test camera scan, permissions-denied feedback, manual adjustments, hairstyles, clothing, accessories, poses, backgrounds and save/reload. No Blaze/Pulse/etc. choices or fallback stock faces should appear. |
| Trophy badge | Open leagues/divisions and current progress. Below 300 trophies is unranked. Ordinary failures, asking for help and recovery should not deduct trophies. |
| Mission launch/result windows | Check brief, start, save, submit, replay, stars and personal-character reactions. Starting each of the first five missions costs one energy; simply opening pages or saving should not charge energy. |
| Help / recovery panels | Check that a player can explain a blocker and recover instead of being stranded at zero energy. |

Flight levels are mission states within the game, not five independent page URLs: Level 1 discovery/onboarding; Level 2 **Explore**; Level 3 **Tell your STORY**; Level 4 **Light the FIRE**; Level 5 **Prove your skills**. After flight completion, verify the arrival scene, avatar creation and programme-readiness handoff.

## MC / Mission Commander / Guide

| Page | College-relative path | Purpose and manual checks |
| --- | --- | --- |
| Guide's lookout | `/commander/dashboard` | See assigned crew status, pending reviews, blockers and next operations. Counts and links should match the assigned scope. |
| Trail objectives | `/commander/sprints` | Review existing tasks, evidence, deadlines and submitted work. Check approval/rework updates the player correctly. |
| Programme Sprint Work | `/commander/sprints?board=programme` | Run permitted kickoff, inspect sprint work, review independent SDLC checkpoints/features and follow client-acceptance readiness. A reviewer must see the actual note/evidence before deciding. |
| Rescue camp | `/commander/coaching` | Track struggling/blocked players and coaching/recovery plans. Check the player can see the resulting guidance. |
| Honour nominations | `/commander/awards` | Nominate earned recognition with supporting reasons/evidence; follow decision status. |
| Project reviews | `/commander/ide` | Select an authorized team's saved Code Lab version; inspect source/preview; comment, request changes or approve with feedback. Staff review should not silently overwrite player code. |
| Manage players | `/commander/college-management` | Add/manage players within assigned teams. Check team size, username validation, access controls and that other teams cannot be managed. |
| Calendar | `/commander/calendar` | View/manage the calendar actions permitted to the MC and check the learner's resulting view. |
| Attendance | `/commander/attendance` | Inspect scoped learner attendance and permitted corrections, with reasons/history. |
| Notifications | `/commander/notifications` | Review alerts and follow review/help links. |
| Mission Control | `/commander/week-one` | Monitor Week 1 progress, assigned learners and programme/recovery readiness. |
| Classes & Announcements | `/commander/week-one-announcements` | Schedule/publish permitted classes and announcements, inspect acknowledgements. |
| Games & Assessments | `/commander/week-one-assessments` | Inspect submitted activity evidence and rubric assessments; distinguish submitted, reviewed and completed states. |
| Questions & Tickets | `/commander/week-one-questions` | Answer/escalate questions and handle eligible energy-recovery cases. The player should receive the response. |
| Research Showcase | `/commander/week-one-showcase` | Review learner research and participation. |
| Challenges & Rewards | `/commander/week-one-challenges` | Manage/review permitted challenges and recognition evidence. |
| Rules & Behaviour | `/commander/week-one-behaviour` | Record/review rules and behaviour matters with appropriate reasons and audit history. No punitive trophy-deduction flow should be offered. |
| Results & Teams | `/commander/week-one-results` | Open a player dossier, inspect work, validate/correct results, inspect recovery/readiness and perform MC sign-off when eligible. Check previous result, reviewer and correction reason remain recorded. |

## CC / Centre Command

| Page | College-relative path | Purpose and manual checks |
| --- | --- | --- |
| Expedition setup | `/centre-command/setup` | Configure cohort/team/roster information, programme sprint packages, owners/resources, project definitions and mission map. Check validation and publication readiness. |
| Council overview | `/centre-command/dashboard` | Monitor cohort delivery, review queues, help cases and programme operations. |
| Expedition code | `/centre-command/rules-approvals` | Manage rules and pending approvals, programme review/acceptance decisions and their audit history. |
| Jungle events | `/centre-command/client-control` | Manage client requests, change events and available programme operations. Verify the intended team's work/notification changes. |
| Expedition records | `/centre-command/reports` | Review team delivery, evidence, risks, programme/final reports and documents. Check figures against underlying records. |
| Project reviews | `/centre-command/ide` | Inspect authorized teams' saved source/preview and record comments, change requests or approval against a specific version. |
| Manage college | `/centre-command/college-management` | Manage the college's cohorts, staff, teams and learners within CC authority. Test creation/editing, Guide assignments, five-player limits and preserved work/history. |
| Calendar | `/centre-command/calendar` | Manage permitted programme events and deadlines; confirm their player/MC visibility. |
| Attendance | `/centre-command/attendance` | Inspect attendance and permitted corrections with reasons/history. |
| Notifications | `/centre-command/notifications` | Read operational alerts and verify destinations. |
| Command Centre | `/centre-command/week-one` | Monitor Week 1 delivery and recovery/readiness across the relevant cohort. |
| Game Configuration | `/centre-command/week-one-setup` | Prepare/configure days, activities and release rules. Verify an unprepared or unreleased level does not become playable accidentally. |
| Assessment Control | `/centre-command/week-one-assessments` | Control/review activity assessment and evidence within CC permissions. |
| Questions & Escalations | `/centre-command/week-one-questions` | Resolve/escalate learner questions and eligible energy-recovery cases. |
| Showcases & Rewards | `/centre-command/week-one-rewards` | Review showcase participation, challenges and recognition/publication evidence. |
| Rules & Audit | `/centre-command/week-one-rules-approvals` | Publish/review rules, behaviour records and audit history. |
| Final Results & Allocation | `/centre-command/week-one-results` | View/correct individual results, verify readiness, publish after MC sign-off, inspect allocation and manage permitted post-publication corrections. Missing prerequisites should be identified clearly. |

Sprint client keys and team completion are separate from individual stars/marks. A task review alone must not award a client acceptance key. Sprint 5 also exposes final delivery, demonstration/defence and available document workflows. Optional Phase 2 work appears only after its required release; it is not necessary for the five-key core ending.

## Checks to repeat on every page

- Open from navigation, then refresh and use Back. Check active navigation and a usable return route.
- Check empty, loading, valid, invalid and saved states. Errors should remain visible inside the active dialog and entered values should survive a rejected save.
- Double-click a submit button and refresh after success. No duplicate accounts, evidence, reviews or rewards should appear.
- Test desktop and phone layout. Buttons, text, dialogs and close/back controls must remain reachable.
- Try another role's URL. It should redirect to the signed-in role or deny access, without revealing another role's data.
- Check another team/college using its own test accounts. Project source, evidence, messages and management actions must stay in scope.
- A locked level, not-yet-published result or unreleased coding lab can be correct behaviour. Check that the explanation names the prerequisite and gives a usable next step.

## Bug report format

```text
Role and account identifier:
College / cohort / team:
Page URL and panel/mission name:
Steps (1, 2, 3):
Expected:
Actual / exact error:
Screenshot, browser and device:
Does it still happen after refresh?:
```

Do not include passwords, session cookies or private recovery links in a bug report.

This inventory is based on the current repository navigation, route validation and page components. It is a manual test map, not a claim that every item has been manually verified in one continuous playthrough.
