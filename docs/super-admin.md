# Super admin dashboard

Open the main application address; it opens the CMS at **`/platform`**. Colleges use separate portal URLs. The first local account is **admin@jungle.com**. Its temporary credentials are in the private, ignored `.data/platform-admin-initial.json` file. The account must set a new password of at least 8 characters before managing colleges. No temporary password is committed to the repository or returned by the management APIs.

## College and cohort management

The college directory supports search, status filtering and pagination. **Add college** opens a dedicated page at `/platform/colleges/new`. Its four sections collect college identity (name, college URL name, type, optional affiliation and website), official contact details and address, the first cohort name and start date, and the first Centre Command account with password confirmation. Type, contact email, city, state/region and country are required on the page; phone, street address, postal code, affiliation and website are optional. The URL name is suggested from the college name and can be edited before creation. The page previews the resulting college URL. After creation, the college overview shows Open college and Copy URL controls.

Creating the college provisions its application database, the named first cohort and the first Centre Command account. The saved contact/location information appears in the college overview. It does not copy existing learners or outcomes, and existing colleges do not need a metadata migration. Share new account credentials privately. Failed provisioning can be retried through the same dedicated page with the original college code; the retry reuses the existing college ID and database.

Open a college to see its cohorts, teams and roster. **College settings** opens the full edit page at `/platform/colleges/{collegeId}/edit`. It loads the saved name, sign-in code, college type, affiliation, website, contact email/phone, address and access status. Blank optional fields clear the saved value; fields omitted from an API update remain unchanged. Older colleges can save changes without filling every new profile field. Cancel returns to that college without saving. Concurrent edits are version-checked, and stale saves must be reviewed against the latest record.

Names and sign-in codes do not rename the database or change record IDs. Status changes invalidate existing college sessions; profile-only changes keep those sessions valid. Super admins can inspect suspended or archived colleges; archived colleges must be reactivated before their cohorts or teams can be changed. Editing the college profile does not alter its cohorts, users, credentials or learning history. FAILED college setup can be retried with the initial administrator details; an in-progress provisioning job cannot be activated manually through the dashboard.

**Add cohort** creates an intake with a permanent unique code and start date. Cohort settings change its name, date and current week. Published activity schedules remain version-pinned; editing this metadata does not rewrite past work or published releases. Use **Add staff** within a cohort to provision its Guides. Use the college-level **Add CC** action to create additional Centre Command accounts. CCs manage all cohorts in their own college; their home cohort remains the entry point for game activities. See [college account management](college-account-management.md) for the CC and MC workspaces and permission rules.

## Teams and learners

Create a team within the selected cohort, using a name, an optional code and an optional assigned Guide. Only an active Guide from that cohort can be assigned. Team settings change its name, code and Guide without moving it to another cohort. Expand a team to see its learners.

**Add learner** creates a username/password account, selects a character and character version, and joins the selected team. The existing rules still apply: a maximum of five learners, distinct character slots, unique usernames within a college and salted password hashes. Existing learner progress and team history are retained. The dashboard does not provide destructive college, cohort, team or learner deletion or reassignment of historical records.

## Platform account and audit

The subsequent CMS release adds account editing/deactivation, additional super admin management and automatic email recovery. See [CMS access and recovery](cms-access-and-recovery.md) for those controls and the required Microsoft 365 activation.

Platform accounts live in the registry, separately from college users and credentials. A college login cookie cannot authenticate platform APIs, and platform cookies cannot authenticate the game APIs. Session cookies are HttpOnly, SameSite=Strict and Secure in production. Only token hashes are stored in the session collection; expiry and account/password-version checks are enforced on every request. Five failed account logins temporarily lock that account for 15 minutes. Password changes revoke other platform sessions.

**Activity** lists recent platform management operations and their outcomes. Mutations validate the college/cohort/team relationship on the server, use transactional college-local receipts for retry protection, and reject stale edits. Cohort/team mutations record requested, completed or failed outcomes centrally; receipts are written in the same college transaction as the change. Raw passwords are not recorded in activity or receipts. Pending REQUESTED operations after a process interruption should be reconciled against the college-local receipt before retrying or recording an operational outcome.

## Operator setup and deployment

For another installation, run the local-only bootstrap command:

```powershell
npm run platform:bootstrap -- admin@jungle.com
```

The command creates the first platform owner and a private temporary-credential file only when that owner does not exist. Rerunning it does not reset credentials or add privileges to a college account. There is no public platform signup or bootstrap endpoint. Keep the generated file private; its original password becomes invalid after the first password change.

The dashboard uses the existing registry environment variables and per-college connections described in [college operations](college-tenancy-operations.md). Provisioning can take longer than ordinary page requests because it initializes a new database and indexes. The platform API declares a 300-second maximum duration; configure the hosting plan to support the intended provisioning workload before hosted rollout. Local implementation and verification do not deploy the application to a hosted site.

## Verification

```powershell
npm run test:platform
npm run test:platform:http
npm run build
```

The full disposable regression suite passed **340 tests**, with no failures or skips. The platform HTTP and Chrome acceptance run passed **121 checks**, including full-page college creation and editing with stored contact/location details, password confirmation, CC/MC delegation, cohort/staff/team/player creation, edits, suspension, role isolation, password rotation and mobile portrait layouts. Browser acceptance optionally takes a Playwright package root and Chrome executable as arguments to `scripts/check-platform-http.mjs`. Desktop/mobile evidence is saved under ignored `.data/platform-qa/`.

The actual local bootstrap was checked without displaying the password: the private file matches the stored hash, first-login rotation is required, and College for test still contains its 29 existing users. All colleges and learners created during acceptance testing were disposable fixtures.

The full-page editor additionally passed the focused profile and lifecycle fixtures: partial updates preserve omitted fields, explicit blanks clear saved values, stale saves are rejected, and every tenant collection remains byte-for-byte unchanged during college profile/access edits. Browser checks cover prefilled values, saving and reopening edits, cancel without saving, unauthenticated access and mobile portrait layout.

College accounts now use their own portal URLs, matching the Lims-V1 access flow. The main URL opens the CMS. Local URLs use <college-url-name>.localhost; hosted setups can configure COLLEGE_ROOT_DOMAIN for subdomains or use the /c/<college-url-name> fallback. Users do not choose a college or enter its code at sign-in.
