# Player refresh performance

Verified locally on November 28, 2026, using disposable MongoDB data and 15 concurrent flight players.

The latest batch of 15 workspace snapshots issues 300 database reads, down from 375 before this update (20% fewer). Earlier improvements reduced the original 690-read batch. The regression test is `tests/snapshot-performance.test.mjs`; it also checks player isolation and that the next request sees changed cohort data. Local elapsed times vary and are not a measurement of Vercel latency.

Each snapshot shares its cohort, programme, release, original flight records and authorised access scope among its projections. Attendance reuses the same context, and staff outcome summaries reuse the already loaded learners and attempts. Flight progress is calculated once. Quiz expiry is settled before reading the shared programme state. Flight players skip team-directory reads; players entering the jungle still resolve their full authorised team scope. Authentication, account status and tenant status checks remain fresh. Nothing is cached across players or requests.

Routine workspace refreshes retain audit metadata without retransmitting full before/after copies of every submission. In a synthetic fixture with 150 audit events containing repeated transcripts, the Day 1 response fell from 3,976,683 bytes to 43,834 bytes (99% smaller). This is a fixture measurement, not a forecast for every college. Current submitted evidence stays available, full submission history and the decision audit load on demand, and stored audit records remain unchanged.

Game scenes, the map designer, project setup and team management load when their screens are opened. Saving aborts an older background refresh so it can request current state immediately; obsolete responses cannot overwrite the newer state. A workspace request has a 20-second deadline and offers a retry instead of leaving the initial loader waiting indefinitely.

Background workspace refreshes are spread over 10–12 seconds instead of every 6 seconds. Game actions still refresh immediately, and returning to a visible tab refreshes current state. Hidden tabs do not poll. This reduces background workspace requests by 40–50% while avoiding repeated class-wide request bursts.

Deploy the updated code to apply these changes in production. No data migration or database permission change is required.
