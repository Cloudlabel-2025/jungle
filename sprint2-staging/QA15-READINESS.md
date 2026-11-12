# QA-15 readiness · Final localhost HTTPS candidate

The available Sprint 1–2 API and smoke regression passed against SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. The run took 4.03 seconds and used separate disposable localhost HTTPS instances. Same-origin writes used the HTTPS origin, session issuance included Secure, and the clean relaunch restored the 20 original fictional records. The Gamer session instance was separate. [Run log](sprint4-trusted-origin-rc/qa15-https-regression.log) · [Runner](sprint4-trusted-origin-rc/run-qa15-https.mjs)

| Checks | Evidence available | Remaining action |
| --- | --- | --- |
| Sprint 1 AC-01 through AC-06 | All six API checks passed on the final HTTPS candidate. | CC reviews the mapped browser and API evidence on the selected scope. |
| Sprint 1 AC-07 | HTML, React bundle and health passed. The latest browser sign-in and directory evidence is available separately. | CC reviews integration on the approved staging URL. |
| Sprint 2 AC-01 through AC-05 | API Create/Edit, persistence, duplicate rules, 16 invalid cases, three country formats and restricted writes passed. | CC reviews corresponding browser evidence and repeats any acceptance checks required on the approved URL. |
| Sprint 2 AC-06 and AC-07 | Earlier restored-gateway browser regression and exact-build Friday browser/API evidence are available. | CC records the combined regression and release outcomes against the approved scope. |
| Sprint 3 AC-1 through AC-7 | INC-04, rollback and restored regression evidence is assembled in the CC review pack. | Five witnessed Gamer defences and CC decisions on all seven gates are pending. After Sprint 3 acceptance, verify the accepted seven-check baseline in QA-15 on the final Sprint 4 candidate. |

The 4.03-second figure measures this automated subset. The full 21-check QA-15 run still depends on Sprint 3 acceptance and the remaining verification. CC also needs five independent Sprint 4 UAT records, including the Friday handover, and all seven Sprint 4 gate decisions.

## Frozen prerequisite evidence for review

The six cards below are the direct prerequisites of QA-15 in the frozen Part B Sprint 4 task list. The user confirmed the Gamers submitted QA-14, FE-13, FE-15, BE-15 and DB-13. Their submission references, times and authorised review outcomes still need to be attached. OP-15 remains awaiting its separate sign-off. The disposable workflow exercised the dependencies with simulated reviews. [Disposable workflow trace](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json)

[Five submission drafts for Karun’s review](QA15-PREREQUISITE-SUBMISSION-DRAFTS.md)

| Card and owner | Status | Supporting evidence ready to attach | Review focus |
| --- | --- | --- | --- |
| QA-14 · Aarav (A) | **Submitted** | Invalid-input and access-control results, including rejected writes that left data unchanged. [Error-contract trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) | Verify the owner’s negative-test and defect retest record and the QA-13, BE-14 and DB-14 references. |
| OP-15 · Priya (B) | **Awaiting sign-off** | Safe-load, reliability, recovery, HTTPS and accessibility evidence. Karun confirmed OP-14 and BE-14 acceptance. [OP-15 pack](OP15-CC-SIGNOFF.md) | Attach the underlying prerequisite records and record OP-15 scope, thresholds, findings and decision. |
| FE-13 · Priya (B) | **Submitted** | Responsive and keyboard evidence for the directory and Create form. [320 px Chrome evidence](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md) | Verify Priya’s assigned UI issues and attributable corrections or retests separately from FE-15. Check FE-14 and QA-13 references. |
| FE-15 · Rohan (C) | **Submitted** | Create form keyboard focus correction and exact-build retest. [Desktop focus evidence](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) | Verify assigned defects, before/after proof, attributable repair and retest evidence, and FE-14 and QA-13 references. |
| BE-15 · Ananya (D) | **Submitted** | Exact-build sign-in and session retest, API error-contract trace and application regression. [Chrome sign-in evidence](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) · [API trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) · [Regression batch](sprint4-trusted-origin-rc/batch-20261110/REPORT.md) | Verify before/after proof, relevant unit tests, and BE-14, QA-14 and BE-13 references. |
| DB-13 · Ananya (D) | **Submitted** | Persisted edits, stable identity, duplicate rejection and exact snapshot restore. [API regression log](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log) · [Saved-backup restore](sprint4-trusted-origin-rc/op13-saved-backup-restore.json) | Verify the assigned data issue and correction or supported no-fault finding, with the DB-15 reference. |

## Full 21-check run after Sprint 3 acceptance

1. Obtain Karun’s recorded Sprint 3 acceptance, the seven gate outcomes and the five witnessed defence records. Check the accepted Sprint 3 scope against the rows below and link the acceptance record before starting the timed run.
2. Launch the pinned Sprint 4 candidate using the [isolated HTTPS launch instructions](OP13-FRIDAY-HANDOVER.md#karuns-release-checks-and-handover). Confirm the manifest fingerprint, URL and trusted Chrome connection. Use disposable fictional data and keep credentials and raw session values out of evidence.
3. With that launcher still running, open a second PowerShell window in the Jungle workspace. Use the session directory printed by the launcher as the parent of `publicCaPath`. The API runner verifies the fingerprint and opens separate disposable HTTPS instances, leaving the browser dataset available for the manual checks.

```powershell
$qaSession = 'D:/Projects/Jungle/.data/sprint4-trusted-origin-rc/cc-session-REPLACE'
$env:NODE_EXTRA_CA_CERTS = Join-Path $qaSession 'ca.pem'
$env:CODEWILD_STAGING_TLS_KEY_FILE = Join-Path $qaSession 'key.pem'
$env:CODEWILD_STAGING_TLS_CERT_FILE = Join-Path $qaSession 'cert.pem'
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
node sprint2-staging/sprint4-trusted-origin-rc/run-qa15-https.mjs
```

4. Save the API output, execute the browser checks on the approved URL, and reconcile the accepted Sprint 3 records with the final build. For incident and attribution checks, use the accepted historical records and verify current release behaviour where applicable. Keep any CC-authorised incident replay on a separate disposable gateway. If evidence cannot be tied to the accepted scope or final candidate where required, mark the row **BLOCKED**.
5. Record reviewer, start and finish times with time zone, elapsed time against the three-hour target, fingerprint, URL and evidence for every row. Record **PASS**, **FAIL** or **BLOCKED** after execution and review. Report the result under **S4-AC-06** and stop the launcher after saving evidence.

| Check | Run or verify | Result and evidence |
| --- | --- | --- |
| S1-AC01 | Sign in as administrator and open the directory. | |
| S1-AC02 | Confirm a fresh seed shows 20 fictional records in the UI and API. | |
| S1-AC03 | Open a directory record and match its ID and details to the API. | |
| S1-AC04 | Sign in as an alumnus and verify own-profile details. | |
| S1-AC05 | Check that the alumnus is denied the directory and another profile. | |
| S1-AC06 | Reject invalid credentials and unsigned profile reads. | |
| S1-AC07 | Verify browser, API and MongoDB integration on trusted localhost HTTPS. | |
| S2-AC01 | Create a fictional profile, verify its generated ID and reject an ID edit. | |
| S2-AC02 | Edit the profile and reopen it after re-login. Compare ID, value and timestamps. | |
| S2-AC03 | Reject normalized duplicate email and registration. Allow repeated blank registration. | |
| S2-AC04 | Exercise required fields, invalid inputs, country formats and valid controls. | |
| S2-AC05 | Check that alumnus Create/Edit controls are absent and server writes are denied. | |
| S2-AC06 | Attach all seven Sprint 1 results for this same candidate. | |
| S2-AC07 | Repeat browser Create/Edit and release smoke on the approved URL. Verify clean reset on the disposable runner. | |
| S3-AC1 | Review the accepted INC-04 approval and before-state evidence. Verify the current baseline smoke before any authorised disposable replay. | |
| S3-AC2 | Reconcile the accepted staged/direct comparison and root cause with the approved routing and database scope. | |
| S3-AC3 | Review accepted target restoration and verify healthy login and directory on the final candidate. | |
| S3-AC4 | Review accepted before/after data equality and repeat persisted Create/Edit and validation on the final candidate. | |
| S3-AC5 | Repeat unsigned and invalid login, own-profile and restricted-access checks on the final candidate. | |
| S3-AC6 | Link the accepted restored-gateway evidence and all 14 current Sprint 1–2 results. | |
| S3-AC7 | Link the five accepted defence records and repeat browser smoke and end-to-end verification on the final candidate. | |

The [confirmed IST schedule](CC-DRAFT-SCHEDULE-IST.md) assigns the five Gamer slots and names Karun as assessor. Karun confirmed attendance for all ten sessions, and the sender reported emailing the five individual calendar files. Use the [CC session records](CC-SESSION-RECORDS.md) to capture actual times, evidence and verdicts. The [consolidated batch](sprint4-trusted-origin-rc/batch-20261110/REPORT.md) records the completed automated checks and rehearsal on the final candidate.

Key 3 and Key 4 remain pending. The live game was untouched.
