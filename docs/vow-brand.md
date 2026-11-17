# Voyage of Wilderness (VOW)

The application identity is defined in `lib/brand.js`. The supplied emblem appears on sign-in, the navigation drawer, the player's navigation button, the real entry/route loading screens, browser tabs and home-screen icons. Public labels and download filenames use VOW. Historical session keys, database/model identifiers, event names and stored account progress remain unchanged.

## Restored logo assets

- `public/brand/vow-logo-master-v2.png`: restored 1254 × 1254 PNG master.
- `public/brand/vow-logo-v2.webp`: high-quality 1024 × 1024 web asset, encoded at quality 96.
- `public/brand/vow-icon-v2-{64,180,192,512}.png`: browser, Apple and installed-app icons.

The original supplied image and first asset version are preserved. New filenames invalidate cached versions. The master was restored with the built-in image-generation tool, then copied into the project. Format conversion and resizing retain the restored artwork. Display filters were reduced to keep the new detail natural.

## Restoration prompt (built-in imagegen)

Use case: precise-object-edit. Asset: production game identity logo restoration. The supplied image is the EDIT TARGET, not a loose style reference. Faithfully restore and clean this exact Voyage of Wilderness emblem. Keep the same circular twisted wooden/vine frame, carved arched title reading exactly 'VOYAGE OF WILDERNESS', large carved 'VOW' letters in the centre, dense green foliage and the same single orange-brown snake wrapped at the lower right. Preserve the logo's shapes, layout, character, wood colours, lettering positions and snake pose. The requested change is quality: remove every square/checkerboard/mosaic/block/compression artifact, especially in dark areas and wood grain. Reconstruct clean continuous fine wood grain, crisp carved-letter edges, readable accurate lettering, natural detailed foliage, clean smooth snake scales, smooth unbroken shading and clear professional contrast. No artificial oversharpening halos, pixel texture, dithering, banding, scan lines, motion blur or noisy gritty surface. Centre the entire complete emblem in a square composition, with all vines and the full snake inside a generous 6 percent safety margin. Use an opaque, smooth, uniform very dark charcoal-green background matching the original dark mood. High-resolution, polished game-logo master suitable for 1:1 display at 1024 pixels. Do not redesign it, change the words, add objects, add slogans or add watermarks.

## Loading behavior

The existing entry gate closes immediately when actual workspace data is ready. It does not restart for background refreshes, impose a minimum display duration or invent progress percentages. The route fallback uses the same visual identity. The logo's orbit, ambient lights and indeterminate loading trail respect OS reduced-motion preferences. Long waits show a short status and the signed-in entry loader retains its return-to-sign-in action.

All loading screens use the original generated deep-wilderness scene with dense fog (`public/brand/vow-deep-wild-fog-v1.webp`), including during the flight phase. This is a ground-level forest environment, separate from the expedition map. Soft vignette and drifting mist keep the logo and status readable while leaving the scenery visible. The flight/jungle story progression is unchanged. The PNG master and generation prompt are preserved alongside the web asset and in `docs/vow-loading-fog-prompt.md`.
