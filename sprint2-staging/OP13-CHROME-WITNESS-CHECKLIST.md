# OP-13 Chrome smoke witness checklist

**Witness** Karun (CC) · **Scope** Fictional Team A on the isolated staging computer

**Witnessed smoke result: PASS.** The user reported that Karun witnessed all four checks in regular Windows Chrome at `https://127.0.0.1:3193/` and confirmed that each passed. The exact run time, launcher fingerprint and screenshot links were not supplied with that confirmation. The [earlier operator-reported results](OP13-FRIDAY-HANDOVER.md) are separate reference evidence.

## Before the run

- [ ] Record the operator, witness, start time and time zone. Use IST for the session record.
- [ ] Match the running launcher’s SHA-256 to `52360d59589e80d6c7fc7f5db6fef1497666918bc60cc2c4cd97f7d2c33d2dde` and confirm the isolated URL. If the build or port owner cannot be verified, mark the run **BLOCKED**. [Launch instructions](OP13-FRIDAY-HANDOVER.md) · [Release manifest](sprint4-trusted-origin-rc/release.json)
- [ ] Use the temporary fictional administrator from that launch. Keep the credentials file, passwords and raw cookie values out of the screenshots and notes.

## Witness and capture

Include the Chrome address bar and the relevant page or panel in each screenshot. Enter **PASS**, **FAIL** or **BLOCKED** based on what Karun observes.

| Check | Action and expected result | Screenshot | Observed result and status |
| --- | --- | --- | --- |
| Health | Open `https://127.0.0.1:3193/health`. Verify the response shows `{"status":"ready"}`. | `01-health.png` | **PASS** · Karun confirmed health ready. |
| Trusted HTTPS | Open `https://127.0.0.1:3193/`. Open Chrome’s site controls and verify **Connection is secure** with the sign-in page behind it. If Chrome shows a certificate warning, capture it and stop before entering credentials. | `02-trusted-https.png` | **PASS** · Karun confirmed Chrome showed a secure connection. |
| Administrator directory | Sign in as the fictional administrator. Verify the directory loads and shows 20 fictional records. Capture the signed-in view after the form clears. | `03-admin-directory.png` | **PASS** · Karun confirmed the administrator directory showed 20 records. |
| Sign-out | Click **Sign out**, then refresh. Verify the sign-in page returns and the directory stays inaccessible. Record that Karun witnessed both actions. | `04-signed-out.png` | **PASS** · Karun confirmed the sign-in page returned after sign-out and refresh. |

## Close the evidence record

- [ ] Record finish time, tested URL, fingerprint, evidence folder, and overall smoke result. For a failed or blocked check, include the observed error and reproduction steps.
- [ ] Link the four screenshots and completed checklist from the [OP-13 handover record](OP13-FRIDAY-HANDOVER.md). Check the release prerequisites and rollback reference separately before any acceptance decision.

OP-13 remains unapproved. The handover email remains unsent. Key 3 and Key 4 remain pending. The live game was untouched.
