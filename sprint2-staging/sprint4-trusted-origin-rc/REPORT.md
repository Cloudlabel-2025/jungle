# Sprint 4 trusted staging origin candidate

The isolated HTTPS launcher accepts one explicit browser-facing origin. It requires native HTTPS when an origin is configured and compares incoming Origin headers against the exact configured value. HTTPS sign-in and sign-out issue Secure cookies. The origin is configured at launch, so choosing the staging hostname does not change the candidate fingerprint.

Run from the Jungle workspace in PowerShell. Replace the example hostname and private file paths with your staging values.

```powershell
$env:CODEWILD_STAGING_ORIGIN = 'https://sprint4-qa.your-domain.com'
$env:CODEWILD_STAGING_PORT = '3192'
$env:CODEWILD_STAGING_TLS_KEY_FILE = 'C:/private/staging-key.pem'
$env:CODEWILD_STAGING_TLS_CERT_FILE = 'C:/private/staging-cert.pem'
node sprint2-staging/sprint4-trusted-origin-rc/source/sprint2-staging/staging.mjs
```

The launcher prints temporary fictional credentials. Keep its terminal private. The Cloudflare route must target the HTTPS listener and preserve Origin and Set-Cookie. For a private origin certificate, configure the connector with the corresponding CA and certificate hostname. Keep the origin private and apply the Access policy to the entire hostname.

The local TLS 1.3 test used a placeholder staging origin. It passed configured-origin sign-in and sign-out, Secure cookie issuance and clearing, rejection of unrelated or mismatched origins, and post-logout session invalidation. Five invalid configurations were rejected. The existing Sprint 1–2 API regression and clean reset passed. The browser test awaits the Cloudflare route and an authorized Access session.

[Release manifest](release.json) · [TLS evidence](https-evidence.json) · [Regression log](sprint1-2-regression.log)

Key 3 and Key 4 remain pending. The live game was untouched.
