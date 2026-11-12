# CODEWILD closeout checklist · Fictional Team A

**Owners** Priya Sharma (Gamer B), Ananya Reddy (Gamer D), and Karun (CC)

Use the isolated staging computer and the pinned Sprint 4 build `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. The checklist records the order of future work. OP-13 is unapproved, the handover email is unsent, and Key 3 and Key 4 are pending. [Release manifest](sprint4-trusted-origin-rc/release.json)

## 1. Priya and Ananya submit the OP-15 prerequisites

- [x] **Priya — OP-14.** Environment assessment submitted, as confirmed by the user. [OP-14 draft and reference evidence](OP14-GAMER-B-SUBMISSION-DRAFT.md)
- [x] **Ananya — BE-14.** API behaviour testing record submitted, as confirmed by the user. [BE-14 draft](BE14-GAMER-D-SUBMISSION-DRAFT.md) · [Sanitised trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json)
- [x] **Karun.** Confirmed OP-14 and BE-14 were accepted, as reported by the user. Both outcomes are recorded in the OP-15 pack. [OP-15 pack](OP15-CC-SIGNOFF.md)
- [ ] **Karun.** Attach the underlying submission and acceptance records, with reviewer, reason and times in IST. [OP-15 pack](OP15-CC-SIGNOFF.md)

## 2. Karun closes Sprint 3 and reviews OP-15

These reviews can proceed independently. OP-15 acceptance requires the two accepted records above.

- [ ] **Sprint 3.** Witness the five individual defences, record each Gamer’s evidence and outcome, and review all seven gates. Record the Sprint 3 acceptance and Key 3 decision separately when the evidence supports them. [Run sheet](CC-RUN-SHEET.md) · [Session records](CC-SESSION-RECORDS.md) · [Gate matrix](CC-REVIEW-PACK.md)
- [ ] **OP-15.** Verify the approved workload, performance and recovery targets, browser and accessibility scope, and required response headers. Record the disposition of the absent HTML Content-Security-Policy header. Attach the accepted OP-14 and BE-14 records and the OP-15 decision, reviewer, time in IST and evidence links. [OP-15 sign-off record](OP15-CC-SIGNOFF.md)

## 3. Run QA-15 and complete the OP-13 evidence

- [x] **Gamer submissions.** QA-14, FE-13, FE-15, BE-15 and DB-13 were submitted, as confirmed by the user. [Prerequisite status](QA15-READINESS.md#frozen-prerequisite-evidence-for-review)
- [ ] **Karun.** Attach the five submitted records with their references and times in IST. Record the authorised review outcomes. OP-15 remains a separate sign-off.
- [ ] **QA-15 — after Sprint 3 acceptance.** Confirm the frozen prerequisites QA-14, OP-15, FE-13, FE-15, BE-15 and DB-13 have accepted task records. Run the full 21-check regression on the pinned Sprint 4 build. Karun collects the per-check verdicts and evidence, the elapsed time against the three-hour target, the defect dispositions and the authorised task acceptance. [Prerequisite evidence](QA15-READINESS.md#frozen-prerequisite-evidence-for-review) · [QA-15 run sheet](QA15-READINESS.md#full-21-check-run-after-sprint-3-acceptance)
- [ ] **Release smoke — Karun.** The four witnessed Chrome checks at port 3193 are recorded as passed. Attach the actual launcher fingerprint, URL, time in IST and screenshots or signed witness notes. Record any blocking defect. [Witness checklist](OP13-CHROME-WITNESS-CHECKLIST.md)
- [ ] **Rollback — Karun.** Review the saved-backup restore and the four passing Chrome checks on the restored copy. Record the fallback decision, recovery targets, trigger, operator and reviewed restore procedure. [Rollback sign-off](OP13-ROLLBACK-DRAFT.md#karuns-rollback-sign-off)
- [ ] **OP-13 — Karun.** Once QA-15 and OP-15 are accepted and the release smoke and rollback records are complete, record the OP-13 decision and timestamp. Keep the handover draft unsent until OP-13 is accepted. [OP-13 handover record](OP13-FRIDAY-HANDOVER.md)

## 4. Finish independent UAT and the Key 4 review

- [ ] **Priya and Ananya.** Complete your independent UAT sessions, UAT-02 and UAT-04 respectively. Record actual start and finish times, expected and observed results, screenshots or traces, defects and your own verdict. Karun collects the same evidence for UAT-01 and UAT-03 from the assigned Gamers. [UAT steps and session records](CC-RUN-SHEET.md)
- [ ] **Karun and Kabir — UAT-05.** After OP-13 acceptance, Karun fills in the actual acceptance and eligible receipt times and sends the handover. Kabir acknowledges after one working hour and before starting. Karun verifies Friday smoke and records the receipt and timing. If a prerequisite is missing, record UAT-05 as **BLOCKED** and reschedule. Collect Kabir’s independent retest and recommendation. [Unsent email draft](OP13-HANDOVER-DRAFT.eml) · [Friday handover](OP13-FRIDAY-HANDOVER.md)
- [ ] **Karun — Key 4.** Collect all five independent UAT records, resolve or explicitly defer defects, and review all seven Sprint 4 gates with QA-15 and the release evidence. Record the Key 4 decision separately. [CC review pack](CC-REVIEW-PACK.md)

The live game was untouched.
