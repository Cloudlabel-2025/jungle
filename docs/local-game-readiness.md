# Local game readiness

Scope: localhost only, November 25, 2026. No deployment or production database changes.

## Completed changes

- Project missions and all five coding sprints now use mission scenes, the player's saved character, objective progress, the next action and checkpoint trails. Checkpoint notes and reviews still use the original server rules.
- Player evidence forms use shorter quest steps; forecasts, blockers and detailed reports stay available in expandable sections. MC/CC review queues show the actual checkpoint being reviewed and its saved note.
- Sprint navigation uses real sprint IDs. Future trails remain locked until released. Failed submissions show their error inside the active dialog and retain entries.
- Five accepted core keys unlock a celebration in Review clearance; optional extensions do not block core completion.
- Shared form captions and desktop orientation detection were repaired. Sign-in forms use POST and cannot submit before hydration.
- Browser Node startup has a bounded deadline, cancellation and reload recovery. Independent shell recovery retains the team's source.
- Read paths fetch fewer fields, parallelize independent reads and avoid loading unchanged source on every poll. The legacy per-instance Mongo connection pool is bounded at 20.

## Verification

- Full database regression: 388 passed, zero failures or skips (`artifacts/local-readiness-tests.log`). This run preceded the final UI/runtime refinements.
- Subsequent focused mission, authentication, runtime startup and local-sync checks: 18 passed (`artifacts/local-readiness-focused-tests.log`). Final UI checks were repeated in `artifacts/local-readiness-final-ui-tests.log`.
- Production build: `artifacts/local-readiness-build.log`.
- Additional database checks covered the 25-player programme, team source scoping and the optimized read paths.
- Browser actions covered first-five recorded outcomes, a feature's five SDLC notes, attributable evidence, independent checkpoint reviews, final feature acceptance, quick-preview tests, editor/output fullscreen, MC sign-off and CC publication on a separate 25-player fixture, and locked/valid trail navigation.
- The browser Node runtime started and returned Node v24.22.2. Its test command correctly reported missing Vite before installation. Package installation stalled in the embedded browser; Stop / fresh shell recovered it and `node --version` then succeeded. The restored project's complete Node test run was not verified in this session.
- Final rebuilt UI: Review clearance visibly showed the five-key celebration and the saved character's celebration pose. Evidence: `artifacts/local-readiness/ending-final.jpg` and `ending-final-browser.txt`. The original map placement had covered the card; moving it into the existing accessible dialog fixed the observed defect.

## Local load measurements

25 fictional players, five teams, three waves, 305 successful reads and five cross-team access denials. Player-state p95 improved from 10,025 ms to 3,241 ms in clean local runs. Sprint reads p95: 1,025 ms; team-source p95: 574 ms; unchanged-source p95: 435 ms. These measurements do not predict production latency or simultaneous browser runtime compilation.

## Coverage limits

Browser coverage uses separate disposable checkpoints, not one uninterrupted campaign played by one account. The ending fixture explicitly seeds Sprint 1/2 prerequisite membership and acceptance; its disclosure is saved separately. No synthetic actions are represented as observed player actions. The original recorded flight history is preserved.

Physical camera capture and native folder permissions need a real-device check. Local runner and merge/recovery logic have automated coverage, but this session does not claim a fresh native folder connection was verified. Production services and deployment remain outside this localhost task.
