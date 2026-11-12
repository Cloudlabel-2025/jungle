# OP-15 evidence for CC sign-off

**Reviewer** Karun · **Status** Awaiting review · **Scope** Fictional Team A on isolated localhost HTTPS

Candidate SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. The frozen OP-15 card depends on OP-14 and BE-14 and calls for measured safe-load, reliability and approved performance checks. The prerequisite reviews in the disposable workflow were simulated. [Release manifest](sprint4-trusted-origin-rc/release.json) · [Workflow evidence](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json)

## Prerequisite record review

The user confirmed that Priya submitted OP-14 and Ananya submitted BE-14, and reported Karun’s confirmation that both were accepted. The underlying submission and acceptance references, reviewer details and timestamps are pending attachment. The isolated workflow contains separate simulated final reviews. [Isolated workflow trace](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json)

| Card | Outcome and evidence | Record details to attach |
| --- | --- | --- |
| OP-14 · Gamer B · Environment assessment | **Accepted**, as confirmed by Karun and reported by the user. Supporting evidence covers the pinned build, localhost health, Chrome HTTPS and the recovery baseline. [Release settings](sprint4-trusted-origin-rc/REPORT.md) · [Preflight](sprint4-trusted-origin-rc/cc-localhost-preflight.json) · [Recovery record](OP13-ROLLBACK-DRAFT.md) | Attach Priya’s submitted assessment and the underlying acceptance record with reviewer, reason and time. |
| BE-14 · Gamer D · API behaviour testing | **Accepted**, as confirmed by Karun and reported by the user. Supporting evidence includes 15 passing checks and nine matching JSON error bodies. [Sanitised error-contract trace](sprint4-trusted-origin-rc/be14-error-contract-evidence.json) · [Browser request trace](sprint4-trusted-origin-rc/localhost-browser-requests.json) | Attach Ananya’s submitted test record and the underlying acceptance record with reviewer, reason and time. |

For each attached record, confirm the Fictional Team A scope and the release fingerprint or an explicit mapping to it. OP-15 is awaiting its own review and decision.

- [OP-14 environment assessment draft for Gamer B](OP14-GAMER-B-SUBMISSION-DRAFT.md)
- [BE-14 API behaviour testing draft for Gamer D](BE14-GAMER-D-SUBMISSION-DRAFT.md)

| Area | Exact-build evidence |
| --- | --- |
| Safe load | 270 reads across health, directory and one profile, with 20 seed records. Each concurrency level ran 90 requests and recorded zero errors. Overall p95 was 8.98 ms at 1, 42.29 ms at 4, and 56.43 ms at 8 concurrent requests. [Raw measurements](sprint4-trusted-origin-rc/batch-20261110/measurements.json) |
| Reliability | Concurrent duplicate create returned 201 and 409. A second session opened the saved record. Clean relaunch reached health in 712.63 ms, returned the 20 seed records and rejected the old session with 401. [Reliability results](sprint4-trusted-origin-rc/batch-20261110/measurements.json) |
| HTTPS and access | Secure, HttpOnly and SameSite=Strict session cookie, API `no-store`, and expected role restrictions. HTML Content-Security-Policy was absent in the measured run. [Access measurements](sprint4-trusted-origin-rc/batch-20261110/measurements.json) · [Chrome session evidence](sprint4-trusted-origin-rc/LOCALHOST-CHROME-RETEST.md) |
| Accessibility | Desktop keyboard focus and 320 CSS px keyboard focus and visual reflow passed for the directory and Create alumni form in regular Windows Chrome. [Desktop evidence](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) · [320 px evidence](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md) |
| Recovery | 21 fictional records and three index definitions matched. A later edit was excluded. Backup export took 21 ms, apply took 4 ms, and fresh launch through verification took 926 ms. [Recovery trace](sprint4-trusted-origin-rc/batch-20261110/exact-https-recovery.json) · [Draft rollback record](OP13-ROLLBACK-DRAFT.md) |

## Karun’s decision record

- [ ] Attach the accepted OP-14 and BE-14 records.
- [ ] Record the approved workload, p95 and error limits. Decide whether the short localhost sample and 20-record dataset cover the acceptance scope.
- [ ] Record the required browser, accessibility and response-header scope. Record whether the absent HTML CSP blocks sign-off or is an explicit deferral, with owner and reason.
- [ ] Record the recovery time and recovery point targets, and whether the 21-record logical restore covers the accepted dataset and scope.
- [ ] Record the OP-15 decision, reviewer, timestamp in IST, release fingerprint, evidence links and any outstanding finding.

**OP-15 decision** __________ · **Reviewer and time** __________ · **Findings and disposition** __________

OP-13 remains unapproved. The handover email is unsent. Key 3 and Key 4 remain pending. The live game was untouched.
