# OP-13 handover · Fictional Team A · Friday UAT-05

**Prepared for Karun and Kabir Khan (Gamer E).** OP-13 acceptance and handover receipt are pending. UAT-05 is scheduled for Friday, 4 December 2026, 10:00 a.m.–12:30 p.m. IST, on the isolated staging computer.

| Release item | Value |
| --- | --- |
| Browser URL for CC to verify | `https://127.0.0.1:3193/` |
| Candidate SHA-256 | `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde` |
| Scope | Fictional Team A, disposable database, 20 initial records |
| Account | Gamer E temporary administrator. Karun shares the fresh password privately. |
| Reference evidence | [Release manifest](sprint4-trusted-origin-rc/release.json) · [OP-13 and UAT-05 rehearsal](sprint4-trusted-origin-rc/workflow.json) · [Backup and recovery](sprint4-trusted-origin-rc/EXACT-HTTPS-RECOVERY-FOCUS.md) |

**Final dry run passed.** The pinned candidate served health, HTML, the React bundle, sign-in and the 20-record directory before and after a clean relaunch. All 20 HTTPS requests matched expected statuses. The simulated workflow rejected early receipt and accepted receipt after the working-hour interval. The run used certificate-validated in-process TLS on a disposable instance. Two network-path attempts failed during TLS setup. Repeat regular Chrome smoke on the scheduled staging URL before release. [Final dry-run evidence](sprint4-trusted-origin-rc/op13-final-dry-run/workflow.json)

**Operator-reported Chrome smoke at `https://127.0.0.1:3193/`.** The observations below were supplied by the operator. Screenshot verification remains pending because the images and archive were unavailable for review. The earlier dry run is separate evidence. OP-13 remains unapproved.

| Check | Operator-reported observation | Screenshot review |
| --- | --- | --- |
| Health | Chrome showed `/health` ready. | Pending |
| Trusted HTTPS | Chrome showed a secure connection. | Pending |
| Administrator directory | The admin directory showed 20 records. | Pending |
| Sign-out | The sign-in page appeared after sign-out and refresh. | Pending |

## Release prerequisite and rollback review

[OP-15 evidence for Karun’s sign-off](OP15-CC-SIGNOFF.md) · [Draft rollback record](OP13-ROLLBACK-DRAFT.md)

The frozen OP-13 card requires **QA-15 and OP-15**. It calls for a tested staging release, recorded version, smoke results and rollback proof. The isolated workflow exercised both dependencies with simulated reviews. The release and parent source hashes match their manifests, and the workflow records zero formal gate approvals.

| Item | Evidence checked | Still needed from Karun |
| --- | --- | --- |
| QA-15 | The Sprint 1–2 automated subset passed. The full 21-check run is prepared. [QA-15 run sheet](QA15-READINESS.md) | After Sprint 3 acceptance, collect the full run on the pinned Sprint 4 build, with 21 outcomes, duration against the three-hour target, evidence links and the recorded task acceptance. |
| OP-15 | The exact-build batch covers safe load, reliability, access, restart and retained restore. The Chrome records cover focus and reflow. [Batch results](sprint4-trusted-origin-rc/batch-20261110/REPORT.md) · [320 px retest](sprint4-trusted-origin-rc/EXACT-320-CHROME-RETEST.md) | Confirm the approved workload, performance and recovery thresholds, browser and response-header scope, and disposition of any findings. Attach the accepted OP-15 task record. |
| Release and smoke | The pinned source matches the manifest. Karun confirmed four witnessed Chrome checks passed. [Release manifest](sprint4-trusted-origin-rc/release.json) · [Witness checklist](OP13-CHROME-WITNESS-CHECKLIST.md) | Attach the actual staging launch fingerprint, URL, run time in IST, screenshot links or signed witness notes, and defect disposition. |
| Rollback | The exact saved snapshot restored all 21 fictional records and three index definitions on a fresh copy of the pinned build. All four regular Chrome smoke checks passed on that restored copy. [Rollback sign-off record](OP13-ROLLBACK-DRAFT.md#karuns-rollback-sign-off) | Karun records the fallback decision, recovery targets, trigger, operator and restore procedure. If a different build is selected, attach isolated restore and smoke evidence for that build. |

## Karun’s release checks and handover

1. Review OP-13 prerequisites and the release manifest. Launch the pinned candidate on the staging computer. In regular Chrome, check trusted HTTPS, the sign-in page, administrator sign-in, the 20-record directory, and sign-out. Verify the health endpoint and capture the fingerprint, URL, timestamp and results. Record any blocking defect.
2. Confirm the rollback reference. If smoke fails, pause the handover, save the evidence, and restore the last CC-approved isolated state. If the release needs retained fictional data, use the verified backup and verify recovery before resuming. Capture the restored build and smoke result.
3. Record the actual OP-13 acceptance and send this handover to Kabir after acceptance. Aim for **Thursday, 3 December by 3:30 p.m. IST** so the one-working-hour interval can elapse by **4:30 p.m. IST**. On the rehearsal calendar, a Thursday send at **4:30 p.m. IST** would allow acknowledgement only at **10:30 a.m. IST Friday**, after the scheduled start. Record the actual sent time, eligible time and Kabir’s acknowledgement. Keep credential delivery separate. [Timing dry run](sprint4-trusted-origin-rc/op13-final-dry-run/timing.json)
4. The launcher has a four-hour window. Start a fresh instance on Friday, verify the same fingerprint and trusted URL, repeat smoke, and give Kabir that launch’s credentials. If the fingerprint changes, or smoke, OP-13 acceptance, the handover or the working-hour interval is missing, record UAT-05 **BLOCKED** and reschedule.

From the Jungle workspace, the Windows launch command uses the installed Git OpenSSL and the loopback-only QA certificate. Keep the launcher open through the session and stop it with Ctrl+C after evidence is saved.

```powershell
$env:MONGOMS_RUNTIME_DOWNLOAD = 'false'
node sprint2-staging/sprint4-trusted-origin-rc/launch-cc-sessions.mjs 'C:/Program Files/Git/mingw64/bin/openssl.exe' --windows-trust
```

## Kabir’s Friday retest

Check the release fingerprint and handover receipt before starting. On the isolated candidate, create and edit a uniquely tagged fictional profile, reject an invalid postcode and verify the bad value did not save, then sign out and back in to verify the same record ID and saved value. Using the supplied fictional alumnus role, verify that a restricted action is denied. Capture expected and actual results, screenshots or traces, any defect, and your independent acceptance recommendation. Keep passwords and session values out of the evidence.

| Field | Actual record |
| --- | --- |
| OP-13 decision, assessor and time (IST) | |
| Candidate SHA-256, URL and smoke evidence | |
| Rollback or recovery reference and disposition | |
| Handover sent, eligible and acknowledged times (IST) | |
| Friday smoke and actual UAT-05 start and finish (IST) | |
| Evidence, defects and Kabir’s recommendation | |
| CC review | |

Key 3 and Key 4 remain pending. The live game was untouched.
