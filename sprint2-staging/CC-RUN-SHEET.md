# CC run sheet · Fictional Team A

[Confirmed session schedule in IST](CC-DRAFT-SCHEDULE-IST.md)

[Localhost launch and test account readiness](sprint4-trusted-origin-rc/CC-LOCALHOST-READINESS.md)

[Session records for CC](CC-SESSION-RECORDS.md)

[Closeout checklist for Priya, Ananya and Karun](CC-CLOSEOUT-CHECKLIST.md)

**Key 3 pending · Key 4 pending.** Use only the isolated Alumni Connect candidate and fictional data. The dates and times below are confirmed in IST (UTC+05:30). Gamer A–E use the staging names below. Karun is the CC assessor. Record actual attendance and outcomes after each session.

**CC assessor** Karun. **Session location** isolated localhost staging computer.

**Handoff sent.** The sender reported emailing the handoff to Karun at `karun@gmail.com`. Karun confirmed attendance for all ten sessions. The sender reported sending each Gamer their individual calendar file, covering all ten invites.

## Gamer roster for the drafts

Names are from Viper Syndicate in the verified isolated staging backup from 5 November. These are the confirmed participant assignments for the calendar files. Karun is the CC assessor. The isolated Alumni Connect logins are test roles.

| Slot | Gamer | Isolated test login |
| --- | --- | --- |
| Gamer A | Aarav Patel | `uat-a@example.invalid` |
| Gamer B | Priya Sharma | `uat-b@example.invalid` |
| Gamer C | Rohan Gupta | `uat-c@example.invalid` |
| Gamer D | Ananya Reddy | `uat-d@example.invalid` |
| Gamer E | Kabir Khan | `uat-e@example.invalid` |

## Before the sessions

- **Karun (CC):** Confirm Gamer A–E attendance. Use the confirmed defence slots and protected 2.5-hour UAT slots below. Record actual start and finish in IST.
- **CC and MC:** Verify the Sprint 3 Key 2 baseline fingerprint `4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc` and the INC-04 approval, operator and rollback record. Give each Gamer access to the shared record and ask for their own attributable evidence in advance. Use the existing incident evidence for the before state. Use a fresh disposable copy if a defence needs to write records. [Incident and rollback record](inc04-rehearsal-evidence.json) · [Restored browser and API checks](restored-gateway-evidence/index.html)
- **CC and MC:** Confirm the Sprint 4 staging URL and verify the release fingerprint `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. The previous localhost instance is stopped. Relaunch this candidate in the approved isolated environment before the slots. Confirm HTTPS sign-in and the initial fictional dataset. Give each Gamer a staging account and a unique test-data prefix. Give Gamer D an alumnus account and an approved test client or route to verify the same server restrictions. Share credentials privately. [Final candidate and launch settings](sprint4-trusted-origin-rc/REPORT.md) · [Localhost HTTPS evidence](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md)
- **Each Gamer:** Run your own UAT, record your own observations and submit your own verdict. Earlier automated runs and browser rehearsals are reference evidence. Use separate synthetic records for write scenarios and capture evidence before any reset. Redact passwords, cookie values and tokens.

## Sprint 3 · Five individual defences

**Friday, 27 November 2026.** All times are IST.

### Staging preflight and day-of setup

The isolated preflight matched the approved Key 2 SHA-256 `4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc`. The Sprint 1–2 API verifier, compiled UI and health smoke, and clean reset passed. A separate launch on `http://127.0.0.1:3112/` verified all three built-in fictional accounts. The administrator opened the 20-record directory. Each alumnus opened their own profile (`AL-QA-001` or `AL-QA-002`) and received HTTP 403 on the directory. The disposable preflight instances were stopped. [Key 2 record](key-2-isolated-record.json)

1. Before 10:00 a.m., open PowerShell on the staging computer in the Jungle workspace. Set `$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'` and run `node sprint2-staging/verify.mjs`. Match the fingerprint above and check the smoke and reset results. Then run `node sprint2-staging/staging.mjs` and leave that terminal open.
2. Open `http://127.0.0.1:3112/` in the local browser. Use the freshly generated credentials in the private terminal. Confirm administrator directory access and alumnus own-profile access. The five Gamer slots use these three fictional app roles as needed. Sign out between demonstrations and keep credentials and cookie values out of evidence.
3. Open the INC-04 before/after evidence and restored-gateway checks alongside the baseline. During each slot, use the checklist below and record the Gamer’s own action, observed result, handover, and answer. For a write demonstration, use fictional data and capture the evidence before resetting the instance. [INC-04 record](inc04-rehearsal-evidence.json) · [Restored gateway evidence](restored-gateway-evidence/index.html) · [Session records](CC-SESSION-RECORDS.md)
4. Save all five witnessed records for AC-7, review the seven Sprint 3 gates, and stop the launcher with Ctrl+C once the evidence is saved. Both key decisions remain pending.

| Slot | Time (IST) | Gamer | Focus | Attendance | Invite status |
| --- | --- | --- | --- | --- | --- |
| S3-DEF-A | 10:00–10:25 a.m. | Gamer A (Aarav Patel) | Database and testing | Confirmed | Sent |
| S3-DEF-B | 10:30–10:55 a.m. | Gamer B (Priya Sharma) | Testing and deployment | Confirmed | Sent |
| S3-DEF-C | 11:00–11:25 a.m. | Gamer C (Rohan Gupta) | Deployment and frontend | Confirmed | Sent |
| S3-DEF-D | 11:30–11:55 a.m. | Gamer D (Ananya Reddy) | Frontend and backend | Confirmed | Sent |
| S3-DEF-E | Noon–12:25 p.m. | Gamer E (Kabir Khan) | Backend and database | Confirmed | Sent |

Each Gamer presents one action or decision they personally took, its observed result, and how another role used the evidence. A supported finding that rules out a healthy layer is acceptable. CC asks the question below, checks attribution and records an individual outcome. [Full defence checklists](sprint3-cc-defence-checklists.html)

| Gamer and cards | Gamer actions and evidence to bring | CC question and verification |
| --- | --- | --- |
| **A · DB-09, DB-10, DB-11, QA-12** | Show which seed rows and fields you compared before and after INC-04. Use the failed staged request and unchanged data to explain your database finding. Reopen a persisted Create/Edit result and show the QA-12 evidence you handed to deployment. | Ask what observation would require a data restore. Check that A can identify the compared records and explain why the evidence supported a configuration rollback. |
| **B · QA-09, QA-10, QA-11, OP-12** | Show your before-repair reproduction with expected and actual results for the page shell, staged API and direct API. Identify which of the 14 regression checks you ran and the QA-09 and OP-09 prerequisites for QA-11. Show restored smoke evidence. | Ask what result would stop the release even if the page loads. Check that B can distinguish their own execution evidence from the shared results. |
| **C · OP-09, OP-10, OP-11, FE-12** | Show the readiness check, pinned fingerprint and isolated scope. Explain the API target comparison, what was restored, and which QA-12 evidence you used. Demonstrate the repaired gateway login and a profile read or saved result. | Ask how C verified that the rollback restored the expected target and working user journey. Check that the smoke and browser evidence refer to the restored gateway. |
| **D · FE-09, FE-10, FE-11, BE-12** | Trace a browser action through its API request to the visible result before and after repair. Show evidence for your frontend finding and the backend evidence you received. Demonstrate an invalid input and a restricted action. | Ask why hiding Edit is insufficient. Verify that D can point to a server rejection as well as the relevant UI behaviour. |
| **E · BE-09, BE-10, BE-11, DB-12** | Trace the gateway, API and database. Show the failing staged endpoint and working direct endpoint and explain what that comparison ruled out. Reopen a saved update after re-login and compare it with the seed or pre-change record. Identify your handovers. | Ask how E would distinguish the wrong API target from an API that reaches the database but fails to save. Check that E can tie the trace and persisted result to their own work. |

**CC records for each defence:** Gamer name, assessor, actual date and time, task IDs, personal evidence links, action or decision demonstrated, handover, question and answer, and PASS/FAIL/BLOCKED with reason. Attach the five individual records to **AC-7**. Review **all seven Sprint 3 gates** using the incident and restored regression evidence. An absent defence or missing attribution stays open for review. [Key 3 gate matrix](CC-REVIEW-PACK.md#key-3--seven-gates-and-five-defences)

## Sprint 4 · Five independent Client’s Chair sessions

| Card | Date | Time (IST) | Gamer | Scope | Attendance | Invite status |
| --- | --- | --- | --- | --- | --- | --- |
| UAT-01 | Monday, 30 November 2026 | 10:00 a.m.–12:30 p.m. | Gamer A (Aarav Patel) | Normal Create/Edit | Confirmed | Sent |
| UAT-02 | Tuesday, 1 December 2026 | 10:00 a.m.–12:30 p.m. | Gamer B (Priya Sharma) | Validation, boundaries and corrections | Confirmed | Sent |
| UAT-03 | Wednesday, 2 December 2026 | 10:00 a.m.–12:30 p.m. | Gamer C (Rohan Gupta) | Persistence after sign-out, refresh and re-login | Confirmed | Sent |
| UAT-04 | Thursday, 3 December 2026 | 10:00 a.m.–12:30 p.m. | Gamer D (Ananya Reddy) | Alumnus permissions and data accuracy | Confirmed | Sent |
| UAT-05 | Friday, 4 December 2026 | 10:00 a.m.–12:30 p.m. | Gamer E (Kabir Khan) | Retest the released candidate and recommend acceptance | Confirmed | Sent |

**Friday dependency.** Plan to accept OP-13 and send the handover by Thursday at 3:30 p.m. IST, allowing the one working hour to elapse by 4:30 p.m. on the rehearsal calendar. Gamer E must receive it before starting Friday. If OP-13 or the handover is missing, CC records UAT-05 as BLOCKED and reschedules the protected slot.

[OP-13 Friday handover and receipt record](OP13-FRIDAY-HANDOVER.md) · [QA-15 full run sheet](QA15-READINESS.md#full-21-check-run-after-sprint-3-acceptance)

[Karun’s OP-13 Chrome smoke witness checklist](OP13-CHROME-WITNESS-CHECKLIST.md)

[Unsent OP-13 email draft for Karun](OP13-HANDOVER-DRAFT.eml). After accepting OP-13, fill in the acceptance and eligible receipt times before sending to Kabir.

CC confirms the correct build, identity and test-data scope at each start. Each Gamer records actual start and finish, expected and actual results, verdict, and any defect or handover. CC reviews those observations against the assigned card and records an independent review decision.

| Slot | Gamer actions and evidence to capture | CC verification |
| --- | --- | --- |
| **A · Monday · UAT-01 · 2.5 h** | Sign in as admin. Create a valid fictional profile. Capture the generated ID and first save. Edit a normal field, reopen the record and compare the saved value and ID. Hand over the record reference and findings. | Check the before/after evidence, server-generated ID, and saved edit. Verify the handover identifies the record and any open finding. |
| **B · Tuesday · UAT-02 · 2.5 h** | Try invalid postcode for the selected country, missing conditional employment details, normalized duplicate email and registration, and one permitted boundary or correction. Record the exact message, whether a bad record was saved, and whether the corrected attempt succeeds. Flag confusing wording separately. | Check that the negative cases were rejected without saving invalid data and the valid control worked. Verify each reported issue has reproducible steps and an evidence link. |
| **C · Wednesday · UAT-03 · 2.5 h** | Create or use a uniquely assigned fictional record. Edit it, record its ID, creation and modification timestamps and saved value. Sign out, refresh, sign back in, and reopen the same ID. Compare the value and timestamps. | Verify separate browser sessions, stable ID and creation time, and that a real edit advanced the modification time and persisted. |
| **D · Thursday · UAT-04 · 2.5 h** | Sign in as the assigned alumnus and confirm own-profile accuracy. Check that Create/Edit controls are unavailable. Use the approved test client or route to check that the server denies directory access, another fictional profile and unauthorized Create/Edit. Capture statuses and confirm no data changed. | Match the displayed profile to the assigned account. Verify server denials as well as the UI restrictions, and check before/after record evidence. |
| **E · Friday · UAT-05 · 2.5 h** | Before starting, verify OP-13 is accepted in the isolated workflow and receive the current handover after the required one working hour. On the released candidate, retest the corrected journeys and any open Friday defect. Cover valid Create/Edit, invalid-input rejection, persistence after re-login and a restricted action. Capture each outcome and submit an acceptance recommendation. If OP-13 or the handover is missing, record BLOCKED. | Verify the OP-13 evidence, release fingerprint, smoke and rollback references, and handover receipt and timing. Review the independent findings and the acceptance recommendation against the actual Friday build. |

### Copy for each session record

| Field | Entry |
| --- | --- |
| Session ID, Gamer, assessor | |
| Date, time zone, actual start and finish | |
| Staging URL, candidate SHA-256, role, fictional record IDs | |
| Task or defect ID, steps, expected result, actual result | |
| Evidence links and handover recipient | |
| Gamer verdict and reason | |
| CC verdict, reason, reviewer and date | |

## CC closeout

1. Complete and retain all five Sprint 3 defence records and seven Sprint 3 gate decisions. CC records a Key 3 decision separately after that review.
2. Attach the five independent UAT records to **S4-AC-04** and resolve or explicitly defer defects under **S4-AC-05**. Reconcile OP-15, the final HTTPS and recovery evidence, and the actual OP-13 release with the selected staging URL and fingerprint.
3. After Sprint 3 acceptance, verify **QA-15** covers all 21 accepted Sprint 1–3 checks on the final Sprint 4 build and review the three-hour regression target. Review all seven Sprint 4 gates before recording a separate Key 4 decision. [Key 4 gate matrix](CC-REVIEW-PACK.md#key-4--seven-gates-on-the-final-candidate)

**Run sheet prepared. Both key decisions are pending.**
