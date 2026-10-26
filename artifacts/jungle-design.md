# CODEWILD — Escape the Wild

Design: cinematic, adventurous, realistic jungle. Deep forest and charcoal surfaces, parchment text, amber controls, original rainforest and ancient-temple environment. Gameplay remains learning, teamwork, and server-reviewed engineering tasks. No data migration or reset.

Implemented: explorer selection, interactive ten-stop expedition map, next-encounter shortcut, narrative encounters, persisted completion, personal extraction requirements, responsive encounter list, expedition navigation, Guide/Council labels, shared jungle theme, readable Field Workshop.

## Asset provenance

Generated with the built-in image-generation tool. Optimized locally to WebP with Sharp; original remains in the image-generation output directory. Project asset: `D:/Projects/Jungle/public/images/verdant-wilds.webp`.

Final generation prompt:

> Create a production website background asset, ultra-wide cinematic realistic jungle adventure concept art, landscape 1536x1024 or wider. An ancient moss-covered stone temple on the right third above a winding river, towering tropical canopy, huge roots and hanging vines framing the far edges, layered mountains receding in mist, golden sunrise shafts through dense emerald foliage. Small abandoned expedition camp barely visible lower left, no people. Rich dark forest greens, charcoal shadows, warm muted amber sunlight, dramatic atmospheric depth, realistic matte painting with photographic texture, sophisticated AAA adventure game environment. Keep left half dark with quieter mist and foliage for readable overlay text; main temple focal point right. NO text, NO typography, NO UI, NO logos, NO watermark. Original fictional world.

## Verification

Production build compiled successfully with Webpack. All nine regression tests passed, including MongoDB integration. Browser checks cover all 16 workspace pages, Explorer/Guide/Council switching, incorrect-answer rejection, encounter completion and XP, persistence after reload, separate explorer progress, extraction requirements, and four passing Code Lab starter tests. Mobile map and encounter catalogue at 390x844 had no document horizontal overflow. No browser console errors were captured during these checks. QA uses an isolated database; existing game records are preserved.

Screenshots: `jungle-expedition.jpg`, `jungle-encounter.jpg`, `jungle-mobile.jpg`.
