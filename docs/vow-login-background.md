# Login background

The login screen uses `public/brand/vow-login-wilderness-v1.webp`.

Generated using the built-in image-generation tool, then encoded as WebP (quality 90) with Sharp. Existing loading-screen imagery is unchanged.

Prompt: A cinematic distant panoramic view across an immense untouched tropical jungle valley from a high rocky overlook. Rolling emerald rainforest canopy stretches toward layered rugged mountains, with low white fog winding between treetops and soft morning sunlight through distant clouds. Dark tropical leaves and vines frame only the outer corners, leaving a calm spacious center for a login panel. Wide landscape composition, horizon in the upper third, atmospheric depth, natural detailed textures, deep forest greens, muted olive and pale warm sunlight. No people, buildings, helicopters, UI, writing, logos or watermarks. Not a close-up forest interior or an overhead map.

The centered credentials form keeps the existing `/api/auth/login` endpoint and account routing. Demo persona access remains available only when the server enables demo mode, inside an expandable section. Password visibility is local UI state; credentials are never saved in browser storage by this form.
