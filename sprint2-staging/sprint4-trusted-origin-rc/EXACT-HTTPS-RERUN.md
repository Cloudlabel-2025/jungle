# OP-15 and UAT-05 · Final localhost HTTPS candidate

Fictional Team A. SHA-256 `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde`. Both runners validated the source fingerprint and used separate disposable HTTPS listeners and fresh fictional databases. Windows validated the localhost connection using temporary QA trust.

| OP-15 in-flight read limit | Requests | Errors | p95 | Max |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 90 | 0 | 12.56 ms | 14.13 ms |
| 4 | 90 | 0 | 45.80 ms | 60.20 ms |
| 8 | 90 | 0 | 105.17 ms | 122.32 ms |

All nine sampled access checks matched expectations. The HTTPS cookie had Secure, HttpOnly and SameSite=Strict. A duplicate-create race returned 201 and 409, leaving one record that a second session could reopen. Clean-seed relaunch reached health in 1.58 seconds and rejected the pre-restart session. The HTML CSP header was absent. These are short localhost runs against 20 seed records. CC still needs to approve performance and recovery criteria and review required response headers. The retained-data restore remains evidence from the earlier focus-fix build. [OP-15 measurements](measurements.json)

**UAT-05 passed in the accelerated workflow.** The runner checked the frozen release and used the normal task actions with fictional reviewers. OP-13 smoke and clean-seed relaunch passed. Gamer E could start the Friday card only after OP-13 and receipt of the one-working-hour handover. The API retest covered Create/Edit, invalid postcode rejection, persistence across re-login, and alumnus restrictions. The 150 working minutes were simulated. [UAT workflow and HTTP trace](workflow.json)

On a separate Chrome instance of the same release, the Create form opened and cancelled. The browser rejected an invalid postcode on Edit, saved the corrected city on fictional record AL-QA-001, and reopened the same ID and city after reload. The browser accessibility view did not reliably expose keyboard focus. The full focus retest remains earlier evidence from the byte-identical UI. CC still needs the five independent 2.5-hour Gamer sessions and gate decisions. [Chrome observations](exact-https-browser-observations.txt) · [Reopened profile](exact-https-reopened-profile.png) · [Browser session trace](exact-https-browser-requests.json)

The temporary QA certificate was removed and the disposable endpoint stopped. Key 3 and Key 4 remain pending. The live game was untouched.
