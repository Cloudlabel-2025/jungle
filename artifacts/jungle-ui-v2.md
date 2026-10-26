# Jungle UI revision: audit and plan

## Audit

The first version reused the arrival panorama for the shell, dashboard, map, card catalogue, and card illustrations. The map had a landscape camera instead of overhead geography. Encounter cards contained no distinctive scene. Gold controls and brown-green surfaces dominated. Dense, small typography and inherited card flex rules reduced clarity.

## Implementation plan

1. Reserve the original panorama for explorer selection only.
2. Use a dedicated overhead terrain map with natural waterways, bridge, ruins, and clearings. Align encounter pins with visible terrain; connect the actual centres. Provide a desktop map/list control, legend, and touch-friendly mobile list.
3. Add a separate base-camp scene for the daily briefing.
4. Give all ten encounters a different illustrated scene. Reuse that encounter's own illustration in its briefing, preserving its identity. Use a single optimized atlas request, with square CSS windows and centre cropping to avoid distortion or scene bleed.
5. Replace the gold-dominated theme with deep forest green, fern-green actions, pale foliage text, river teal, and amber only for rewards/warnings. Remove repeated photography from the shell and data surfaces. Set the readable body font explicitly.
6. Preserve routes, persona names, permissions, learning content, saved progress, Code Lab, and all server authority. Verify browser layouts, navigation, quiz persistence, and production compilation.

## Verification results

- Final `npm run build`: passed with the project's configured Webpack bundler.
- All 16 route smoke checks, role restrictions, CSV export and signed-session logout: passed against isolated QA state.
- Nine regression tests: passed, including MongoDB concurrency, recovery and launcher checks.
- Browser map/list controls, ten unique illustration selections, incorrect-answer rejection, successful completion, and reload persistence: verified.
- Tablet and mobile encounter layouts: no document horizontal overflow. Mobile illustrated dialog stayed inside the viewport.
- Primary button contrast: 10.02:1; active navigation: 6.89:1; body text: 15.9:1 against their solid backgrounds. These measurements do not claim a full accessibility audit of every legacy surface.
- Code Lab: four starter tests passed; editor input background remains transparent for the syntax overlay; no browser console errors in the final live tab.
- Temporary QA database and server removed. Persistent game database preserved. Live development preview restored on port 3000.
- Final previews: `jungle-v2-map.jpg`, `jungle-v2-encounters.jpg`, `jungle-v2-mobile.jpg`.

## Assets and provenance

All three new assets were generated using the built-in image-generation tool and optimized to WebP locally with Sharp. Originals remain in the generation output directory. No external image service is needed at runtime.

| Asset | Use |
| --- | --- |
| `public/images/verdant-wilds.webp` | Existing arrival scene, used only on explorer selection |
| `public/images/expedition-camp.webp` | Dedicated base camp briefing |
| `public/images/verdant-terrain.webp` | Overhead map terrain |
| `public/images/jungle-encounters.webp` | Ten distinct encounter scenes, arranged five across and two down |

The active stylesheet is `app/jungle.css`; the superseded `app/expedition.css` was removed.

## Generation prompts

### terrain

Original production game terrain asset. Wide landscape 3:2. True directly overhead orthographic illustrated realistic tropical jungle expedition MAP, no horizon and no sky, a readable detailed hand-painted satellite terrain map. Lush richly varied emerald and fern rainforest canopy, muddy clearings and moss-covered rocky terrain, turquoise river meandering vertically through center, small rope bridge crossing river near middle left, abandoned stone ruins upper right, subtle hiking footpaths connecting clearings. Terrain with 10 open clearings suitable for HTML location pins at percent coordinates (13,72),(29,61),(24,38),(42,28),(46,53),(55,77),(66,58),(71,32),(85,43),(88,72). No pins or markers drawn. Consistent overhead camera everywhere, beautiful natural geography, crisp fine canopy detail, rich actual jungle greens, pale riverbanks. No text no letters no UI no compass no frame no labels no people. Original fictional world; geographic map, not a landscape photograph.

### camp

Production website background asset. Cinematic realistic jungle expedition BASE CAMP, landscape ultra-wide composition. Close atmospheric scene in lush dense green tropical rainforest: weathered canvas expedition tent to right, campfire with soft ember glow, field table holding rolled maps, compass and backpack, damp mossy stones, ferns in foreground and shafts of cool daylight filtering through deep green leaves. Rich saturated forest and fern greens, balanced natural lighting, warm small campfire accent only. No temples, no castles, no mountains, no golden sunrise, no people. Right half shows the tent and recognizable camp equipment; left half quiet dark foliage suitable for HTML headline overlay. Realistic AAA adventure game concept art with detailed natural texture. No text, no UI, no logos, no watermark.

### encounters

Production game environment artwork ATLAS. Exact regular grid of 5 columns by 2 rows, ten equally-sized separate rectangular landscape illustrations, no gaps, no borders, no lettering. Each cell completely independent with no scene crossing into other cells. Realistic cinematic tropical rainforest adventure concept art, vibrant fern emerald jade greens, daylight and mysterious atmospheric mist, detailed photographic textures. Top row left to right: 1 overgrown footpath between massive tropical tree roots; 2 precarious hanging rope bridge crossing deep jungle ravine; 3 close-up swarm of iridescent beetles and dragonflies in dense green jungle; 4 black panther watching from lush foliage; 5 raging turquoise jungle river and rapids. Bottom row left to right: 6 dangerous concealed pit with broken earth and vines in rainforest floor; 7 ancient stone vault doorway covered in moss carved with geometric patterns; 8 elevated walkway high in huge tropical canopy; 9 luminous poisonous red and violet tropical pitcher plants surrounded by lush green leaves; 10 abandoned expedition radio and antenna at remote green jungle lookout. No text, no numbers, no titles, no logos, no UI. Ten distinct vignettes arranged exactly five across two down. Broad composition in every cell so each remains recognizable at thumbnail size. Landscape 5:2 overall sheet.
