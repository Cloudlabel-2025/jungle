# CODEWILD Week 1 functional QA retest

## Executive summary

Chrome reached the deployed sign-in form. The authentication endpoint returned HTTP 200 for Gamer, Mission Commander and Centre Command. Gamer and CC reached their dashboard routes. CC also loaded Week 1 and verified that Day 1 was OPEN and Days 2–5 were DRAFT. The MC shell appeared, but its content was still loading when the attempt ended. Three browser checks were blocked by navigation or readiness timeouts. The isolated application regression completed with **116 passed, zero failed, zero skipped**. No activity was released or edited, and no game records were changed. [Chrome trace](current-browser/results.json) · [Isolated regression log](current-isolated-regression.log)

## Current browser results

| ID | Persona and steps for Karun to repeat | Expected | Observed | Status and severity |
| --- | --- | --- | --- | --- |
| Gamer-EMPTY | On the entry page, click Sign in with both inputs empty. | Required-field feedback and no sign-in. | Chrome reported “Please fill in this field.” [Screenshot](current-browser/Gamer-EMPTY.png) | PASS · N/A |
| Gamer-LOGIN | Sign in as Gamer using the authorised account and observe the dashboard route. | Gamer dashboard opens. | HTTP 200 and navigation to `/gamer/dashboard`. [Screenshot](current-browser/Gamer-LOGIN.png) | PASS · N/A |
| Gamer-RETEST | After Gamer login, open `/gamer/week-one-games` and wait for the activity data. | Assigned Week 1 activity loads. | Navigation aborted. The screenshot shows the Gamer shell still loading. [Screenshot](current-browser/Gamer-RETEST.png) | BLOCKED · Severity unassigned |
| MC-RETEST | Sign in as MC and wait for the Guide’s lookout to load. Then open Week 1 and inspect the assigned Gamer. | Mission Commander workspace and assigned Gamer are available. | HTTP 200 and the MC shell appeared. The route wait timed out and the screenshot shows “Establishing uplink…”. Assigned Gamer verification was not reached. [Screenshot](current-browser/MC-RETEST.png) | BLOCKED · Severity unassigned |
| CC-LOGIN | Sign in as CC and observe the dashboard route. | CC dashboard opens. | HTTP 200 and navigation to `/centre-command/dashboard`. [Screenshot](current-browser/CC-LOGIN.png) | PASS · N/A |
| CC-WEEK1 | Open `/centre-command/week-one` and inspect the release table. | CC sees the release controls and recorded day states. | Day 1 OPEN, version 1. Days 2–5 DRAFT and unprepared. [Screenshot](current-browser/CC-WEEK1.png) | PASS · N/A |
| CC-ROUTE-1 | While signed in as CC, navigate to `/gamer/week-one-games`. | CC returns to its own dashboard. | Redirected to `/centre-command/dashboard`. [Screenshot](current-browser/CC-ROUTE-1.png) | PASS · N/A |
| CC-RETEST | While signed in as CC, navigate to `/commander/week-one`. | CC returns to its own dashboard. | Navigation timed out and Chrome displayed ERR_CONNECTION_RESET. [Screenshot](current-browser/CC-RETEST.png) | BLOCKED · Severity unassigned |

The other Gamer and MC cross-role routes were not reached in this rerun.

## Journey, persistence and negative coverage

- **Journey.** Earlier executed browser evidence covers the fixture revision, MC review, CC verification and approval, and Gamer result (J02–J07). The fresh CC release was exercised separately on a disposable copy (J01). This rerun observed an existing live release. It did not execute a new end-to-end journey. [Prior browser report](report.html) · [Isolated release retest](retest.html)
- **Persistence.** Prior browser checks P01–P04 verified submission history, score, status and audit persistence. The current isolated regression passed. A new deployed save and re-login persistence journey was not executed. [Prior browser report](report.html) · [Regression log](current-isolated-regression.log)
- **Negative cases.** Blank sign-in passed in this rerun. Earlier browser and isolated evidence covers invalid URL, required revision reason, invalid rating, and activity locking before release. [Prior browser report](report.html) · [Isolated release retest](retest.html)

## Defect register and retest order

1. **CW-001 · Medium · Previously fixed.** An open Day 1 had no published rules. Prior retest verified rules publication and persisted Gamer acknowledgement. Karun can repeat by signing in as Gamer, opening Week 1 → Game Rules, and checking the visible version and acknowledgement receipt. [Defect and fix evidence](retest.html)
2. **Navigation and readiness · Blocked, severity unassigned.** Repeat the three browser steps above in a regular Chrome session with the Network tab open. Capture the failing URL, response status or request failure, and whether the workspace eventually loads. The current evidence does not establish whether the resets and loading delays originate in CODEWILD or the test connection.
3. **Fresh end-to-end retest · Coverage pending.** Use a fresh isolated Week 1 fixture and run the single CC → MC → Gamer → MC → CC → Gamer journey. Refresh after each save and re-login as Gamer to compare the result, score, status and timestamps. Leave Days 2–5 untouched. Continue to label synthetic research evidence as workflow-only. Genuine conversation access and content verification remain pending a shareable research link.

The supplied Part B archive is integration reference material. Its change register describes loading later content into the existing Part A engine. This Week 1 retest made no implementation or deployment changes.
