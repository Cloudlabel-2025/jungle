# Sprint 4 retained recovery and HTTPS session checks

Fictional Team A. Candidate SHA-256 `dfef38d57399aeb1785eb5f7e01fa4f3b561ec576943c958f70ea53e8f17a419`. The runner verified the pinned source and used disposable databases and fictional profiles.

**Retained-data restore passed.** The snapshot held 21 documents, including a newly created and edited profile and an edit to an original seed profile. The source was stopped, a fresh database was launched, and the snapshot was applied. All 21 documents matched, the three index definitions matched the target’s startup indexes, and duplicate creation was rejected. Both changed profiles reopened with their saved IDs and timestamps. An edit made after the snapshot was absent from the restored profile.

| Measurement | Observed |
| --- | ---: |
| Snapshot export | 54 ms |
| Restore writes | 15 ms |
| Fresh launch through verified recovery | 1,473 ms |
| Snapshot size | 11,259 bytes |

Snapshot SHA-256 is `78959b4660551c39e3462086a77cd4db36005de75110198491488dc67d82033b`. The rehearsal used a logical collection snapshot with the app’s normal startup indexes. [Synthetic snapshot](retained-backup.ejson)

**HTTPS controls had two findings.** TLS 1.3 certificate validation passed through an in-process socket pair to the local gateway. The Windows client’s separate localhost TCP probe failed certificate-chain validation. The gateway passed Set-Cookie through unchanged.

| Control | Observed |
| --- | --- |
| Session attributes | HttpOnly, SameSite=Strict, Path=/ and Max-Age=3600. Secure was absent on the HTTPS response. |
| Cache and logout | Session response used no-store. Sign-out sent Max-Age=0, and subsequent use of the signed-out session returned 401. |
| Restart | The pre-restart session returned 401 after recovery. A fresh session could reopen both retained profiles. |
| Origin handling | A same-origin HTTPS sign-in returned 403 when the gateway preserved the Origin header. The remaining checks mapped the exact gateway Origin to the backend Origin. Foreign-origin sign-in still returned 403. |
| HTML response policy | Content Security Policy header was absent. |

CC still needs to verify the approved staging URL and certificate chain in a real browser, resolve the Secure cookie and HTTPS Origin handling findings, and check deployed session and response-header policy. Confirm backup retention, recovery time and recovery point targets using representative data and the approved recovery procedure. Key 3 and Key 4 remain pending. The live game was untouched.

[Session and recovery observations](evidence.json) · [Reproduction runner](run.mjs)
