# CC review pack · Fictional Team A

[Ten-session rehearsal evidence](sprint4-trusted-origin-rc/CC-TEN-SESSION-REHEARSAL.md)

[Session records for CC](CC-SESSION-RECORDS.md)

**Key 3 pending · Key 4 pending.** This pack indexes isolated evidence and gives CC a place to record decisions. The live game was untouched.

[CC run sheet for the five defences and five UAT sessions](CC-RUN-SHEET.md)

[QA-15 readiness and final HTTPS regression](QA15-READINESS.md)

[QA-14, FE-13, FE-15, BE-15 and DB-13 submission drafts](QA15-PREREQUISITE-SUBMISSION-DRAFTS.md)

[OP-13 Friday handover and receipt record](OP13-FRIDAY-HANDOVER.md)

[OP-15 evidence for Karun’s sign-off](OP15-CC-SIGNOFF.md) · [Draft rollback record](OP13-ROLLBACK-DRAFT.md)

[Exact saved-backup restore and HTTPS smoke evidence](sprint4-trusted-origin-rc/op13-saved-backup-restore.json)

[Regular Chrome smoke on the restored backup](OP13-ROLLBACK-DRAFT.md)

[Consolidated isolated regression batch](sprint4-trusted-origin-rc/batch-20261110/REPORT.md)

## Review order

1. Review the INC-04 evidence and witness five individual Sprint 3 defences. Record all seven Key 3 gate decisions against the accepted Key 2 baseline.
2. Confirm the exact Sprint 4 candidate and staging URL. Reconcile earlier measurements and UAT evidence with that release, obtain the five independent Gamer UAT findings, and complete the 21-check regression after Sprint 3 acceptance.
3. Record the seven Sprint 4 gate decisions and the final release decision. For every gate record **PASS, FAIL, or BLOCKED**, reviewer, date, release fingerprint, evidence reference and reason. Blank decisions below are for CC.

## Localhost HTTPS evidence for CC

**Browser retest passed** in regular Windows Chrome at `https://127.0.0.1:3193` on candidate SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. Chrome showed a secure connection and the administrator opened the 20-record fictional directory. The same-origin login returned 200 and issued the application cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and `Max-Age=3600`. Chrome sent the cookie after reload. Sign-out sent `Max-Age=0`. A subsequent reload sent no session cookie and the session endpoint returned 401. The trace records attributes and cookie presence. The disposable endpoint is stopped and the temporary loopback CA was removed.

[Release manifest](sprint4-trusted-origin-rc/release.json) · [Retest report](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) · [Browser request trace](sprint4-trusted-origin-rc/localhost-browser-requests.json) · [Secure connection](sprint4-trusted-origin-rc/localhost-chrome-secure.png) · [Signed-in directory](sprint4-trusted-origin-rc/localhost-chrome-signed-in.png) · [Signed out after reload](sprint4-trusted-origin-rc/localhost-chrome-signed-out.png)

## OP-13 · Operator-reported Chrome smoke

The operator reported these results in regular Chrome at `https://127.0.0.1:3193/`. Screenshot review remains pending. This entry is separate from the earlier browser evidence and automated dry run. OP-13 remains unapproved.

| Check | Operator-reported result |
| --- | --- |
| Health | `/health` showed ready. |
| Trusted HTTPS | Chrome showed a secure connection. |
| Administrator directory | The directory showed 20 records. |
| Sign-out | The sign-in page returned after sign-out and refresh. |

**CC-witnessed smoke: 4 of 4 passed.** The user reported Karun’s confirmation that he witnessed and passed health, trusted HTTPS, administrator directory and sign-out after refresh. The witnessed result is recorded separately from the earlier operator report. The run time in IST, the fingerprint from the running launcher and screenshot links still need to be attached. [Witness checklist](OP13-CHROME-WITNESS-CHECKLIST.md)

Before recording OP-13 acceptance, Karun still needs to verify the release prerequisites and rollback reference and record any blocking defect. After acceptance, send the handover and record Kabir’s acknowledgement at least one working hour after sending and before UAT-05 starts. [OP-13 handover and evidence](OP13-FRIDAY-HANDOVER.md)

## Key 3 · Seven gates and five defences

Use the isolated Key 2 baseline SHA-256 `4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc`. CC owns all seven decisions. The historical Sprint 3 staging record still shows the pre-rehearsal blocked entries. [Key 2 approval](key-2-isolated-record.json) · [Sprint 3 record](sprint3-resumed-isolated-record.json)

| Gate | What CC needs to verify | Evidence for review | CC decision |
| --- | --- | --- | --- |
| AC-1 Reproduce | Confirm MC selected INC-04, CC approved it for the disposable copy, and the authorised operator captured the fault before repair. Verify the staging page loaded while staged login and directory failed and the direct API worked. | [Incident evidence](inc04-rehearsal-evidence.json) | |
| AC-2 Root cause | Confirm the incorrect staging API target explains the failure. Check the staged/direct comparison and the evidence that source and database stayed in place. | [Incident evidence](inc04-rehearsal-evidence.json) | |
| AC-3 Correction | Confirm the original API target was restored and a fresh administrator session could use the same staged login and directory. | [Incident evidence](inc04-rehearsal-evidence.json) | |
| AC-4 Data integrity | Compare the before/after directory and sampled original profile. Review persisted Create/Edit, stable identity, and field and duplicate validation after recovery. | [Restored regression](restored-gateway-evidence/index.html) | |
| AC-5 Access and API | Verify unsigned and invalid login cases, alumnus own-profile access, and server rejection of other-profile and unauthorised writes. | [Restored regression](restored-gateway-evidence/index.html) | |
| AC-6 Earlier 14 checks | Review and record the seven Sprint 1 and seven Sprint 2 results on the restored gateway. | [14-check evidence](restored-gateway-evidence/index.html) | |
| AC-7 Smoke, E2E and individual defences | Verify restored application smoke and E2E. Witness five individual Gamers explain and demonstrate attributable contributions. Attach all five outcomes to the gate. | [Restored smoke and E2E](restored-gateway-evidence/index.html) · [Individual checklists](sprint3-cc-defence-checklists.html) | |

| Gamer | Defence focus | Record |
| --- | --- | --- |
| A | DB-09/10/11 and QA-12. Before/after data and why the evidence supported configuration rollback or would have required data restore. | Pending |
| B | QA-09/10/11 and OP-12. Reproduction, personally executed regression checks, and the release smoke stop condition. | Pending |
| C | OP-09/10/11 and FE-12. Fingerprint, API target restoration, rollback verification and a repaired browser journey. | Pending |
| D | FE-09/10/11 and BE-12. UI-to-API trace, invalid input and role restrictions, and the evidence for the frontend finding. | Pending |
| E | BE-09/10/11 and DB-12. Staged versus direct API, persistence after re-login, and the evidence for the backend or database finding. | Pending |

For each defence record the Gamer, task IDs, personal evidence, handover, witnessed question and answer, assessor, date and outcome. Use the full checklists for the role-specific prompts.

## Key 4 · Seven gates on the final candidate

OP-15, UAT-05, retained-data restore, and desktop and 320 px Chrome keyboard checks were rerun on final localhost HTTPS fingerprint `52360d…dde`. The 320 px directory and Create form also passed the visual reflow and scrolling check. CC still needs to confirm the acceptance URL and collect five independent Gamer outcomes. [OP-15 and UAT-05](sprint4-trusted-origin-rc/EXACT-HTTPS-RERUN.md) · [Exact-build restore and focus](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md)

| Gate | What CC needs to verify | Evidence for review | CC decision |
| --- | --- | --- | --- |
| S4-AC-01 Functional | On the final fingerprint, verify positive, negative, validation and restricted-access behaviour. Link each confirmed repair to a retest, including Help Pass changes if part of the accepted scope. | [Latest API regression](sprint4-trusted-origin-rc/sprint1-2-regression.log) · [Help Pass retest](sprint4-help-browser/retest/REPORT.md) | |
| S4-AC-02 Non-functional | Approve the workload, thresholds and supported browser/accessibility scope. Verify OP-15 performance, reliability, access controls, focus and usability. Confirm recovery time and recovery point targets using representative retained data. Use the Chrome proof for localhost HTTPS. If accepting a different deployment, verify its certificate, origin, cookie and required response headers there. | [Exact-build OP-15](sprint4-trusted-origin-rc/measurements.json) · [Exact-build 320 px focus and reflow](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md) · [Exact-build retained restore and focus](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) · [Localhost HTTPS](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) | |
| S4-AC-03 System and E2E | On the approved URL and fingerprint, trace Create/Edit through browser, API and database. Verify validation, permissions and saved state after re-login. | [Exact-build Friday evidence](sprint4-trusted-origin-rc/EXACT-HTTPS-RERUN.md) · [Latest HTTPS session trace](sprint4-trusted-origin-rc/localhost-browser-requests.json) | |
| S4-AC-04 Five independent UAT sessions | Collect five attributable 2.5-hour Client’s Chair sessions, each with Pass/Fail/Blocked findings and evidence. Gamer E must test the Friday journey after accepted OP-13 and the required handover. | [UAT-01 to UAT-04 rehearsal](sprint4-uat-evidence/index.html) · [Exact-build UAT-05 workflow](sprint4-trusted-origin-rc/workflow.json) | |
| S4-AC-05 Defect disposition | Map each confirmed defect to an owner, disposition and passing retest on the intended release. Check that no blocking defect remains and explicitly approve any minor deferral. | [Desktop keyboard focus](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) · [320 px keyboard focus](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md) · [Friday retest](sprint4-trusted-origin-rc/EXACT-HTTPS-RERUN.md) · [HTTPS origin and cookie retest](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) · [Help Pass retest](sprint4-help-browser/retest/REPORT.md) | |
| S4-AC-06 Earlier 21 checks | After the Key 3 decision, verify QA-15 evidence for all 21 accepted Sprint 1–3 checks on the final Sprint 4 release. Record the regression duration and review it against the three-hour target. | [Earlier 14 browser/API checks](restored-gateway-evidence/index.html) · [Latest Sprint 1–2 API regression](sprint4-trusted-origin-rc/sprint1-2-regression.log) | |
| S4-AC-07 Release and Key 4 | Confirm final fingerprint and staging URL, review actual OP-13 smoke and rollback evidence, resolve UAT findings, and record formal release acceptance and the Key 4 decision after all seven gates are satisfied. | [Latest manifest](sprint4-trusted-origin-rc/release.json) · [Exact-build OP-13 rehearsal](sprint4-trusted-origin-rc/workflow.json) | |
