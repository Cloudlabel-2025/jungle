# Sprint 4 browser trust retest

Candidate SHA-256 b602dff875bad2e5c0c867ec86313d72627ab972e818fdd78725b5b785570953. Test endpoint https://127.0.0.1:3191, disposable database, fictional accounts.

- Before the trust change, the TCP peer presented an Avast Web/Mail Shield Untrusted Root issuer. With the one-day loopback-constrained QA CA temporarily trusted in Windows CurrentUser, the peer presented the existing Avast SSL/TLS scanning root chain and Windows curl validated the endpoint and returned the ready health response.
- The in-app Chromium session continued to report ERR_CERT_AUTHORITY_INVALID after reload. A Windows Chrome fallback stopped because the computer-use tool could not verify the current browser URL. Interactive sign-in and browser cookie inspection remain blocked.
- The candidate’s certificate-validated TLS 1.3 test returned 200 for same-origin sign-in, issued Secure, HttpOnly and SameSite=Strict, rejected a foreign Origin with 403, and returned 401 after sign-out. See https-evidence.json for the protocol results.
- The temporary QA CA was removed and its absence verified. The disposable endpoint was stopped. Key 3 and Key 4 remain pending. The live game was untouched.

CC can complete the interactive check on an isolated staging endpoint whose certificate chain validates in the test browser.
