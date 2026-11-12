# Localhost session readiness · Fictional Team A

The readiness preflight ran at `https://127.0.0.1:3193` on the same Windows machine as the test browser. Windows validated the HTTPS health response. The launcher verified the final release fingerprint, opened a disposable database with 20 fictional records, and verified sign-in and Secure cookie issuance for each temporary account. A, B, C and E could open the directory. D could open the assigned fictional profile AL-QA-001 and the directory returned 403 for that account.

| Gamer slot | UAT card | Temporary username | App role |
| --- | --- | --- | --- |
| A | UAT-01 | uat-a@example.invalid | Administrator |
| B | UAT-02 | uat-b@example.invalid | Administrator |
| C | UAT-03 | uat-c@example.invalid | Administrator |
| D | UAT-04 | uat-d@example.invalid | Alumnus |
| E | UAT-05 | uat-e@example.invalid | Administrator |

The four-hour readiness window uses a temporary loopback-only certificate and generated passwords. Launch a fresh instance before the scheduled sessions. Each launch generates fresh credentials and resets the fictional database. Save session evidence before shutdown. Localhost is reachable from the staging computer. A remote participant needs access to that computer or an approved private staging URL.

[Preflight evidence](cc-localhost-preflight.json) · [Session launcher](launch-cc-sessions.mjs) · [Run sheet](../CC-RUN-SHEET.md) · [Session records](../CC-SESSION-RECORDS.md)

Karun confirmed attendance for all ten slots on the [IST schedule](../CC-DRAFT-SCHEDULE-IST.md). The sender reported emailing the five individual calendar files. Each UAT slot lasts 2.5 hours. Friday remains subject to OP-13 acceptance and the one-working-hour handover.

Key 3 and Key 4 remain pending. The live game was untouched.
