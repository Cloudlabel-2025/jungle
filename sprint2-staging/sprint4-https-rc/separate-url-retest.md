# Separate isolated HTTPS URL retest

Candidate SHA-256 b602dff875bad2e5c0c867ec86313d72627ab972e818fdd78725b5b785570953. The separate disposable endpoint used https://127.0.0.1:3192 and a fresh fictional database.

The browser reported net::ERR_CERT_AUTHORITY_INVALID before reaching sign-in. Windows reported that the attempted QA certificate trust operation was cancelled. Its HTTPS client reported SEC_E_UNTRUSTED_ROOT. Browser sign-in and browser cookie inspection are blocked.

The certificate-validated TLS 1.3 protocol check returned 200 for same-origin sign-in and sign-out, 403 for foreign-origin sign-in, and 401 for the signed-out session. The sign-in response set Secure, HttpOnly and SameSite=Strict. [Protocol evidence](https-evidence.json)

The temporary CA was confirmed absent from Windows trust and the test endpoint was stopped. Key 3 and Key 4 remain pending. The live game was untouched. To complete the browser check, CC needs a private staging URL with a certificate chain the test browser already trusts.
