# Part B acceptance execution

## Final evidence-storage and cohort follow-up

The final suite passed **150 tests, zero failures/skips** and the current production build passed. Ordinary evidence/marks uploads now work through private MongoDB without a Blob token, including bounded parts and streamed 5 MB delivery. Five-team HTTP checks passed 27 simultaneous scoped actors and private-file round trips in each team. All 25 fictional learners signed in through the browser and had the correct team/four assigned cards; MC/CC five-team views and the browser upload/download/independent-review handoff passed. A logical private-file/metadata restore was verified. These are seeded technical rehearsals, not real six-week delivery or operational production acceptance. See `part-b-needs-user-or-assessor.txt` for only the actual external inputs/human verification still needed. Earlier Blob prerequisites below are historical and superseded for the default MongoDB workflow.

## Final local verification

The subsequent automatic-PDF implementation resolves the old generated-report storage blocker. Staff can generate both PDFs, review, issue and deliver them inside the app using private MongoDB storage. The updated suite passed **149 tests, zero failures/skips**, and the production build and configured-database transactional read check passed. Real PDF bytes, hashes, fixed pages, stale-source/correction/privacy guards were verified. The browser followed MC generation/review, CC issue and learner download, then denied signed-out and unrelated access. Evidence is in `part-b-pdf-browser-2026-11-12/` and `part-b-pdf-verification.json`. Actual learner accuracy, assessment and signatures remain human responsibilities. Earlier Blob-blocked and HTML-only records below are historical.

The final disposable-database suite passed **148 tests, 0 failures, 0 skips**; the production build passed. The added Phase 2 journey submitted and independently reviewed all 60 frozen cards through normal engine actions, with rework/resubmission per level and visibility checks for 25 Gamers. Only prior Key 5 eligibility was seeded. The 143-row register now records this additional coverage. It does not change historical acceptance results or certify real student integrations. See `part-b-final-status.txt` for the configuration, real-app evidence and human verification still required.

## 12 November implementation retest

The current historical CSV contains **36 PASS, 4 original FAIL with passing server retests, and 81 BLOCKED**. Earlier counts below describe earlier executions. The implementation fixes and automated control coverage are documented in `part-b-completion-handover.txt`; the full disposable-database regression passed **147 tests with zero failures or skips**. These synthetic tests do not create independent student UAT or operator sign-off. See `part-b-manual-verification.csv` for all 121 frozen cases plus the 12 original Admin Chair and 10 incident-operator checks, their historical status, new control evidence and remaining human/external verification.

## Earlier execution record

The subsequent browser follow-up is recorded in `part-b-browser-2026-11-12/browser-verification.txt` and `browser-results.json`. Representative Gamer/MC/CC handoffs and negative guards were exercised with fictional data; PB-BR-001 misleading stale success feedback was fixed and retested. The post-fix Part B regression passed 32 tests, and the production build passed. The 143-row verification register includes browser-specific coverage and evidence without changing historical independent acceptance outcomes. Private Blob upload/issue remains blocked by missing test-store configuration.

The frozen matrix matched its handover SHA-256, `c9c3c8d9ac88329cac21de404fd56ad0847f507d4cf681fdbbc9e48d8ddc8018`. The [121-row results](part-b-acceptance-results.csv) retain the original scenarios, expected results and severities. The isolated run produced **20 PASS, 4 FAIL and 97 BLOCKED**. A blocked row identifies the missing evidence or exact case still to execute. Simulated gate, assessor and completion records were confined to disposable test databases. Formal Key 3 and Key 4 are pending.

After the fix, all four PB-DEF-001 cases passed the isolated server retest. It rejected early starts and evidence, allowed the assigned starts on their scheduled days, and rejected a Thursday UAT-05 start even after the OP-13 handoff. The Friday workflow passed over isolated HTTP. The independent browser session remains open. [Retest workflow](part-b-uat-day-final/workflow.json) · [Regression trace](part-b-uat-day-pilot.tap.txt)

The next isolated run closed PB-QA-045. The Friday Gamer could neither approve their own UAT evidence nor perform the CC release or acceptance actions. An independent reviewer accepted the task evidence. The matrix now has 21 initial or subsequent passes, four original failures with passing server retests, and 96 blocked rows. [Review trace](part-b-uat-review-retest/rehearsal.txt)

The subsequent isolated run closed PB-QA-046, 047, 096, 102 and 103. There are now 26 direct passes, four original failures with passing server retests, and 91 blocked cases. The synthetic failed-release gate persisted and blocked acceptance, but PB-QA-064 still requires a witnessed browser defect and repair retest. PB-QA-092 still requires the external AI missing-source test. The application import's missing-snapshot rejection passed. [Sprint 4 trace](part-b-remaining-s4/rehearsal.txt) · [Final Friday and pilot trace](part-b-remaining-pilot.tap.txt)

The [pilot trace](part-b-acceptance-pilot-final.tap.txt) contains 25 passing automated tests with zero skipped. Those tests also supplied partial evidence for some blocked rows. The [Sprint 3 trace](part-b-acceptance-sprint3.txt), [INC-04 trace](part-b-acceptance-inc04.json) and [Sprint 4 workflow](part-b-acceptance-sprint4/workflow.json) record the disposable runs. Evidence for this execution is primarily server, API and database traces. The independent browser and witness requirements remain open where indicated.

## PB-DEF-001 · High · Client Chair cards start before their scheduled day

Affected cases are PB-QA-035, 037, 039 and 041.

1. From the Jungle workspace, set `CODEWILD_EVIDENCE_DIR` to a new evidence directory. Run `node scripts/rehearse-part-b-sprint4.mjs <path-to-frozen-zip>`.
2. The runner opens a temporary MongoDB database, sets the test clock to Monday, 30 November 2026 at 12:30 IST, loads the frozen Sprint 4 cards as CC and starts the team kickoff as MC.
3. While the clock remains Monday, Gamers A through D each call the normal task-start action on their own Client Chair card.
4. Expected Monday behavior is that UAT-01 may start and UAT-02 through UAT-04 stay unavailable until their assigned days. Actual behavior is that all four become `Working` at the same fixture time. The [workflow trace](part-b-acceptance-sprint4/workflow.json) records the day metadata, owners and resulting card states.

Retest each card before and during its assigned session as the owner and as a different Gamer. For Friday, separately verify that a completed OP-13 still leaves UAT-05 unavailable before Friday. Record the protected window and capture the browser outcomes for CC.

The [Friday HTTP rehearsal](part-b-acceptance-uat05-baseline/workflow.json) exercised the timed OP-13 handoff, login, Create/Edit, invalid postcode, persistence and role restrictions with fictional data. The [pinned HTTPS runner](part-b-acceptance-uat05/https-runner-error.txt) was blocked at certificate verification. Neither run substitutes for independent Friday UAT.

## Private Blob round trip

The [preflight](part-b-private-blob-preflight.txt) returned HTTP 503 from the upload-intent handler without a configured token. The isolated launcher clears the regular Blob token by design. Provision a dedicated private Vercel Blob test store and make its read/write token available as `BLOB_READ_WRITE_TOKEN` to the isolated smoke process through a secure local secret mechanism. A production credential or browser-visible token is outside this test scope. For a browser run, the isolated browser must reach the signed upload endpoint and the server must reach the Blob API.

Use fictional accounts and a small synthetic file. Verify upload intent, signed PUT, server-side completion, an authorised download that matches the original bytes and denial to an unrelated or signed-out account. Capture statuses and hashes with signed URLs and credentials omitted.
