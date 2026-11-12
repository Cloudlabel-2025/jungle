# Sprint 4 HTTPS session candidate

Candidate SHA-256 `b602dff875bad2e5c0c867ec86313d72627ab972e818fdd78725b5b785570953`. The new source snapshot derives from the focus-fix candidate. It adds a native HTTPS listener, validates write origins against the listener’s exact scheme, address and port, and emits Secure on both session creation and deletion in HTTPS mode. The staging server does not take its expected origin from forwarded headers.

The certificate-validated TLS 1.3 socket-pair test passed six checks against the native HTTPS listener. Same-origin sign-in and sign-out returned 200. A foreign-origin sign-in returned 403. A signed-out session returned 401. The sign-in cookie included Secure, HttpOnly, SameSite=Strict, Path=/ and Max-Age=3600. Logout included Secure and Max-Age=0. The session response used no-store. The existing Sprint 1–2 API regression and clean reset also passed on this fingerprint.

**Browser retest blocked.** Chromium stopped at ERR_CERT_AUTHORITY_INVALID before the login screen. The direct TCP probe also failed certificate chain validation. CC needs an isolated endpoint with a chain trusted by the test browser before completing the interactive retest. The captured screenshot shows the blocker.

Key 3 and Key 4 remain pending. The live game was untouched.

[Release manifest](release.json) · [HTTPS protocol evidence](https-evidence.json) · [Browser blocker](browser-certificate-block.jpg) · [Regression log](sprint1-2-regression.log)
