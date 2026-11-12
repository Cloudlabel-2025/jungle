# Sprint 4 prerequisite submission drafts

**Team** Fictional Team A · **Scope** Isolated localhost staging · **Status** Drafts for owner verification and authorised review

The supporting QA evidence maps to candidate SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. Earlier-build comparisons are identified below. Each owner should add the evidence they personally produced and the submission reference. Each reviewer should record the outcome, reason and time in IST. [Release manifest](sprint4-trusted-origin-rc/release.json)

## QA-14 · Aarav Patel (Gamer A)

**Scope** Negative and security testing. **Prerequisites** QA-13, BE-14 and DB-14.

| Scenario | Observed result |
| --- | --- |
| Invalid sign-in, unsigned directory and signed-out session | HTTP 401 with matching JSON error bodies. |
| Alumnus attempts to view the directory or another profile, create, or edit | HTTP 403 with the expected JSON errors. Own-profile read returned 200. |
| Invalid postcode and duplicate email | HTTP 400 and 409 respectively. The rejected edit left the profile unchanged and the rejected create left the directory at 20 records. |

The supplemental run passed all 15 checks and matched nine error bodies. The earlier regression covered 16 invalid cases. [Error-contract trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) · [Regression output](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log)

**Aarav to add** Personally executed cases, expected and actual results, defect IDs and retests, and prerequisite references.

**Submission reference and time** __________ · **Reviewer, outcome, reason and time** __________

## FE-13 · Priya Sharma (Gamer B)

**Scope** Frontend verification and assigned corrections. **Prerequisites** FE-14 and QA-13.

At 320 CSS px in regular Windows Chrome, the directory labels wrapped, the Create control remained visible and vertical scrolling reached the final rows. The Create form and both bottom actions fit the tested viewport. Horizontal scroll attempts did not move either view. Use this as responsive verification evidence. The Create keyboard-focus repair is tracked separately under FE-15. [320 px screenshots and trace](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md)

**Priya to add** Assigned UI issue IDs, personal corrections or verification steps, before/after evidence where a correction was made, and FE-14 and QA-13 references.

**Submission reference and time** __________ · **Reviewer, outcome, reason and time** __________

## FE-15 · Rohan Gupta (Gamer C)

**Scope** Frontend defect repair. **Prerequisites** FE-14 and QA-13.

The earlier focus retest records the Create alumni issue and the corrective patch. On the pinned build, keyboard activation moved visible focus to the form heading, the next Tab reached First name, and Cancel restored focus to Create. Desktop and 320 px Chrome retests passed. Cancel left the directory at 20 records. [Earlier issue, patch and retest](sprint4-op15/focus-retest/REPORT.md) · [Pinned desktop retest](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) · [Pinned 320 px retest](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md)

**Rohan to add** Assigned defect ID, personal repair or retest contribution, before/after artifact references, and FE-14 and QA-13 references.

**Submission reference and time** __________ · **Reviewer, outcome, reason and time** __________

## BE-15 · Ananya Reddy (Gamer D)

**Scope** Backend defect correction. **Prerequisites** BE-14, QA-14 and BE-13.

The earlier HTTPS candidate records the Secure cookie and origin work. On the pinned candidate, same-origin Chrome sign-in returned 200 and issued a Secure, HttpOnly, SameSite=Strict session cookie. The session survived reload. Sign-out cleared it and the next session request returned 401. The 15-check API run confirmed authentication, role restrictions and validation responses. The broader application regression passed 116 tests. [Earlier HTTPS candidate](sprint4-https-rc/REPORT.md) · [Pinned origin settings](sprint4-trusted-origin-rc/REPORT.md) · [Chrome session trace](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) · [API trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) · [Regression batch](sprint4-trusted-origin-rc/batch-20261110/REPORT.md)

**Ananya to add** Assigned backend defect IDs, personal correction and retest details, the exact before/after artifacts and relevant unit-test results, and prerequisite references.

**Submission reference and time** __________ · **Reviewer, outcome, reason and time** __________

## DB-13 · Ananya Reddy (Gamer D)

**Scope** Database defect correction or supported no-fault finding. **Prerequisite** DB-15.

The API regression confirmed generated IDs, stable identity and creation time after edits, persistence across sessions and duplicate rejection. The verified saved backup restored 21 fictional records and three index definitions on a fresh pinned copy. Both retained edits reopened and the post-snapshot edit was absent. Chrome showed the 21-record restored directory and returned to sign-in after sign-out and refresh. This evidence supports a finding on the tested persistence and identity scenarios. [API regression](sprint4-trusted-origin-rc/batch-20261110/qa15-sprint1-2.log) · [Saved-backup trace](sprint4-trusted-origin-rc/op13-saved-backup-restore.json) · [Restored Chrome evidence](OP13-ROLLBACK-DRAFT.md)

**Ananya to add** Assigned data issue and personal investigation, correction or scoped no-fault conclusion, before/after evidence, and DB-15 reference.

**Submission reference and time** __________ · **Reviewer, outcome, reason and time** __________

These drafts await submission and review. OP-13 remains unapproved, the handover email is unsent, and both keys remain pending. The live game was untouched.
