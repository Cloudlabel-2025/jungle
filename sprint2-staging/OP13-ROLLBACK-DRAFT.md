# OP-13 rollback record · Draft

**Proposed fallback** Relaunch the pinned build and restore the verified fictional dataset in a fresh isolated instance. **Status** Ready for Karun’s review. CC approval and operator assignment are pending.

| Item | Reference |
| --- | --- |
| Build | SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. [Release manifest](sprint4-trusted-origin-rc/release.json) |
| Verified backup | Batch snapshot captured 10 November 2026 at 14:16:52 IST. 11,259 bytes, 21 fictional documents and three index definitions. [Snapshot](sprint4-trusted-origin-rc/batch-20261110/exact-https-retained-backup.ejson) |
| Backup SHA-256 | `6a61b9653be0cdbb29102e2a243daa0185b47863880ba81c4b83e8e3a5012e03` |
| Recovery evidence | All documents and indexes matched, both retained edits reopened and the post-snapshot edit was excluded. Fresh launch through verification took 926 ms in the rehearsal. [Recovery trace](sprint4-trusted-origin-rc/batch-20261110/exact-https-recovery.json) |
| Saved-backup restore test | The exact saved snapshot above was applied to a separate fresh copy of the pinned build. All 21 documents and three index definitions matched, both retained edits reopened, and all 10 HTTPS smoke checks passed. Apply took 5 ms. Fresh launch through smoke took 976 ms. The disposable copy was stopped. [Saved-backup restore and smoke trace](sprint4-trusted-origin-rc/op13-saved-backup-restore.json) |
| Regular Chrome retest | A new isolated copy restored from the same verified snapshot passed all four smoke checks in regular Windows Chrome. The directory showed 21 restored records. Chrome reported TLS 1.3 with certificate validation enabled. The disposable copy was stopped. [Browser trace](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/results.json) · [Health](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/01-health.png) · [Sign-in](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/02-trusted-https.png) · [Directory](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/03-admin-directory.png) · [Sign-out after refresh](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/04-signed-out.png) |
| Clean seed option | A separate rehearsal restored the 20 seed IDs after relaunch. Use a clean seed only if CC confirms that the exercise does not require retained changes. [Clean relaunch evidence](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json) |

## Karun’s rollback sign-off

The restored-copy Chrome run took place on **10 November 2026, 15:13:14–15:13:19 IST**, at `https://127.0.0.1:55999` in Chrome 156.0.8078.81. The trace records TLS 1.3 and **Avast Web/Mail Shield Root** as Chrome’s observed certificate issuer. The screenshots capture the page content. Use the trace for the URL and TLS details. This disposable run supports the rollback review. The release smoke at port 3193 has its own evidence record. [Restored Chrome trace](sprint4-trusted-origin-rc/op13-restored-chrome-smoke/results.json) · [Release smoke witness checklist](OP13-CHROME-WITNESS-CHECKLIST.md)

| Sign-off field | Karun’s entry |
| --- | --- |
| Decision on same-build fallback and reason | |
| Approved recovery point and acceptable data loss | |
| Approved recovery time and restore trigger | |
| Assigned operator and reviewed restore procedure | |
| Reviewer and decision time (IST) | |

## Proposed execution

1. If release smoke fails or retained data is inconsistent, pause UAT-05 and the handover. Preserve the failure evidence and record the trigger, time, affected scope and nominated operator. Obtain Karun’s confirmation of the fallback and acceptable recovery point.
2. Verify the pinned build and backup checksum. Create a fresh disposable localhost instance, confirm its isolated database identity, and apply the selected snapshot using a reviewed local restore procedure. Keep the failed instance available for evidence collection if needed.
3. Compare all 21 documents and three index definitions. Verify retained IDs and saved values, confirm the later edit is absent and check that a pre-restart session is rejected. Repeat the [Chrome smoke checklist](OP13-CHROME-WITNESS-CHECKLIST.md) against the restored HTTPS instance.
4. Capture the restored fingerprint, URL, snapshot checksum, elapsed time and evidence. Keep UAT-05 blocked until Karun reviews the recovery result and release prerequisites.

The original [rehearsal runner](sprint4-trusted-origin-rc/run-retained-restore.mjs) generated its own snapshot. The separate saved-backup test verified the selected archive and applied it to a fresh seed by replacing or inserting records by ID, then compared the full collection and index definitions to the snapshot. That smoke used certificate-validated in-process HTTPS. Karun and the operator should review the procedure and witness regular Chrome smoke on the actual recovery instance before resuming UAT. A defect in the pinned build would require a separately approved and tested fallback build.

| Actual field | Entry |
| --- | --- |
| Trigger, scope and time (IST) | |
| Karun’s approved fallback and recovery point | |
| Operator and restore procedure reference | |
| Restored build, URL and snapshot checksum | |
| Start, finish, elapsed time and verification evidence | |
| CC disposition and reviewer | |

OP-13 remains unapproved. The handover email is unsent. Key 3 and Key 4 remain pending. The live game was untouched.
