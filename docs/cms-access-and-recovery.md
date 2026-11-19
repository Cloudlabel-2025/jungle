# CMS account management and automatic recovery

The super admin portal at `/platform` supports staff and learner edits, deactivation/reactivation, staff-role changes, replacement Guides, additional super admins and email password recovery. Existing IDs, balances, submissions, assessments, files and history remain in place. Account deletion and historical team/cohort reassignment are not introduced.

## Staff and learners

Open a college and cohort, then use the edit icon beside a person. Update the name, registered email, optional username and access. Staff can change between Guide and Centre Command; learners remain learners. Deactivation signs out the account. Reactivation does not revive an old session. Access and identity changes invalidate earlier sessions through an authentication version.

Each cohort must retain an active Centre Command account. Disabling an assigned Guide or changing that Guide's role requires an active replacement from the same cohort. Current team assignments update transactionally; past evidence and assessor references keep their original IDs.

The key icon requests a reset email to the registered address. New learners can have a real recovery email supplied at creation. Older synthetic `players.codewild.invalid` addresses must be replaced with an owned email before recovery can send. Passwords are not shown to administrators or recorded in activity.

## Additional super admins

The **Super admins** page creates platform accounts and edits names, emails and access. New administrators must change their initial password. A super admin cannot deactivate their own account. Concurrent administrator changes are serialized to protect the last active administrator. Disabling or editing an administrator invalidates their old sessions. Editing one's own profile rotates the current session.

All platform administrators have full super admin access. College staff cannot create or authenticate as platform administrators. College credentials and roles remain separate.

## Password recovery

Both sign-in pages link to recovery. Super admins supply their email at the central CMS. College users open recovery from their college URL and supply their username/email; the college is fixed by that URL. Recovery emails link back to the same college's portal or hosted `/c/<slug>/recover` fallback. Replies do not disclose whether an account exists. Requests are rate-limited, with one active reset per account.

A matching active account receives a 30-minute, single-use link through the configured mailbox. Tokens are hashed for verification and encrypted for queued delivery. APIs never return the raw token. Links carry the token in their fragment, removed from the browser address when the form loads. GET does not consume a link. An explicit POST validates the token, current identity and account version, then changes the salted password hash and invalidates old sessions. Disabled accounts and changed recovery identities cannot use older links.

**Recovery** lists requests, expiry and delivery outcomes. **Accepted by mail server** means SMTP accepted the message; it does not claim inbox delivery or that the recipient read it. Missing settings display BLOCKED; authorization/delivery failures remain visible without exposing credentials. Administrators can send a fresh link, cancelling the old one. Initial delivery runs after the public response. The existing authenticated pilot cron retries a bounded number of pending messages, up to five automatic attempts per request. Configure that scheduler before relying on unattended retries.

College password changes and their recovery receipts commit in the college database; registry completion follows. A retry after registry interruption recognizes the receipt and cannot apply another password change. Platform resets and their completion state use one registry transaction. Academic and work records are not part of these changes.

## Microsoft 365 activation

A ready-to-forward [email administrator request](microsoft365-recovery-request.txt) is available for the person who manages the mailbox.

Approved sender: **cloudlabel@cloudheard.org**. Approved public origin: **https://voyageofwilderness-vow.vercel.app**. These non-secret defaults are saved locally. Live email is blocked until Microsoft mailbox authorization and application credentials are configured.

Your Microsoft 365 administrator must register a single-tenant Entra application with Exchange Online's **SMTP.SendAsApp** application permission, grant admin consent, register its service principal in Exchange and authorize only the sender mailbox. SMTP access must be allowed under the organization's policy. Microsoft's [SMTP OAuth instructions](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth) explain the mailbox and SendAs permissions and the correct enterprise-application Object ID.

The administrator supplies these privately, never in chat or Git:

```text
SMTP_TENANT_ID=<directory tenant ID>
SMTP_CLIENT_ID=<application client ID>
SMTP_CLIENT_SECRET=<application secret value>
```

Add them to `.env.local` for local testing and to the Vercel project's server-side environment for rollout. Other settings are:

```text
CMS_EMAIL_FROM=cloudlabel@cloudheard.org
CMS_PUBLIC_ORIGIN=https://voyageofwilderness-vow.vercel.app
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=cloudlabel@cloudheard.org
SMTP_AUTH_MODE=oauth2
```

This mode uses TLS and Microsoft-issued application tokens; the ordinary Outlook password is not needed. See [Nodemailer's SMTP documentation](https://nodemailer.com/smtp). Password-based SMTP is supported only for deployments whose mail administrator explicitly approves that method; it is not the configured Microsoft 365 default.

Deploy the updated code before sending recovery emails to the public Vercel URL. Local configuration does not update that deployment. After authorization and deployment, verify a real recovery delivery with an authorized recipient. Captured-email tests cannot certify provider authorization, public deployment or inbox delivery.

## Verification

`npm run test:cms` uses disposable databases and captured mail. It covers safe edits, preserved evidence/work, replacement Guides, tenant/cohort boundaries, stale edits, concurrent administrator deactivation, session revocation, encrypted tokens, single use, expiry and delivery failures. `scripts/check-platform-http.mjs` covers the HTTP APIs and optional Chrome desktop/mobile flows. Fixtures clear mailbox credentials and do not send real messages.

The current full regression passed 337 tests, with zero failures or skips. The HTTP/Chrome run passed 70 checks. Microsoft OAuth request construction and TLS mail options were additionally checked with mocked network/SMTP adapters. Live Microsoft authorization, deployed recovery routes and inbox delivery remain external activation checks.

A read-only verification of the existing installation confirmed that all 29 college user documents and all 29 credential documents have unchanged BSON hashes. Evidence is stored privately in `.data/cms-preservation-check.json`. No existing college account was reset or deactivated during implementation.
