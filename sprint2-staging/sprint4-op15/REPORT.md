# OP-15 non-functional measurements

**Scope.** Fictional Team A’s pinned Alumni Connect candidate on 10 November 2026. Its source and lockfile SHA-256 matched the isolated Key 2 record and the Sprint 4 UAT-05 run: `4d872356e6cb8f439da2ce84b4599a70bdda9b61f63a847d7761b4019c69f6cc`. The test used loopback HTTP and a fresh MongoDB 7.0.24 database. No live accounts, services or data were used. No gate or key was issued.

## Measurements

After 12 warm-up requests, each run sent 30 health checks, 30 authenticated directory reads and 30 authenticated profile reads. Latency includes reading the complete HTTP response on the same machine. Percentiles use nearest rank. Throughput is for the mixed batch.

| In-flight limit | Requests | Errors or wrong responses | p50 | p95 | Max | Requests/s |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 90 | 0 | 6.69 ms | 8.97 ms | 12.82 ms | 149.34 |
| 4 | 90 | 0 | 9.71 ms | 16.80 ms | 32.48 ms | 376.93 |
| 8 | 90 | 0 | 17.94 ms | 28.58 ms | 40.90 ms | 410.91 |

- **Reliability and data integrity.** Two concurrent identical creates returned 201 and 409, leaving one record. A second authenticated session reopened the same saved record. Clean relaunch reached health in 1,171.81 ms, restored the 20 pinned seed IDs, discarded the disposable test write and rejected the old session. This is a clean-seed reset check.
- **Sampled access and session controls.** All nine response checks matched expectations. Invalid login, unsigned directory access and a logged-out session returned 401. An alumnus could read their own profile, while directory, another profile, Create and Edit returned 403. The session cookie had HttpOnly, SameSite=Strict and a one-hour Max-Age. The session response had no-store caching. The HTTP fixture did not set Secure on the cookie or a Content Security Policy on the HTML.
- **Sampled accessibility and usability.** Keyboard focus moved from email to password to Sign in. Enter submitted the form and invalid sign-in exposed an alert. All 19 Create fields had associated labels. At a 320 px viewport setting, both directory and form had a measured client width and scroll width of 305 px, with no horizontal page overflow.

## Finding OP15-A11Y-01

**Keyboard focus drops to the document body when opening or cancelling Create alumni.** On the disposable candidate, sign in as admin, use the keyboard to activate Create alumni, then activate Cancel from the form. Both transitions left focus on BODY. Have CC verify focus moves into the Create view and returns to the Create alumni trigger after cancellation. The form remained operable in the sample.

## What CC still needs to verify

1. Approve the release URL, workload mix and data volume, concurrency, duration, and thresholds for latency, errors and recovery. Repeat on the approved deployment. This run used 20 seed records, short read bursts and one two-write race.
2. Confirm the required backup/restore and uptime objectives. Verify recovery of a retained dataset and any required failure scenarios. Clean-seed reset supplies separate evidence.
3. Verify HTTPS and deployed session and response-header policy, including Secure cookies and any required CSP. Review the sampled access results alongside the approved security checklist.
4. Retest OP15-A11Y-01 and verify the agreed keyboard, screen-reader, contrast, zoom/reflow and usability criteria across the supported devices and browsers.
5. Record the OP-15 review and S4-AC-02 decision after criteria and evidence are accepted. Key 3 and Key 4 remain pending.

[Raw requests and results](measurements.json) · [Browser observations](browser.json) · [Narrow Create form](01-create-form-narrow.jpg) · [Narrow directory](02-directory-narrow.jpg) · [Reproducible runner](run.mjs)
