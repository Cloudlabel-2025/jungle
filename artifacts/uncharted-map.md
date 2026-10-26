# Uncharted forest game map

The dashboard is now a 6,000px-wide, horizontally pannable world. At the tested 1280x720 desktop viewport, the map covers 81% of the screen. Desktop navigation collapses into an icon rail on this page only. Camp, party, status, objectives, clearance, and encounter selection open as accessible modal panels. All ten existing learning encounters remain available, with server-verified rewards and persisted completion.

The world contains three distinct non-repeating regions: `public/images/uncharted-west.webp`, `public/images/uncharted-valley.webp`, and `public/images/uncharted-east.webp`. The central image preserves the user-approved deep forest, large valley, rope bridge and small muddy crossing. Water is limited; no route lines, roads, start markers or end markers are rendered. The map has finite physical bounds, without artificial endless repetition. No curriculum, permission, or game-data changes were made.

Controls: mouse drag, wheel or trackpad, keyboard Left/Right, Home/End, west/east buttons, map-position slider, and locate-next button. Touch uses horizontal panning. Reduced-motion preferences disable smooth navigation. Scroll tracking updates refs rather than re-rendering the game on every pixel.

## Validation

Production build passed. Browser QA verified all six information panels, objective-detail transitions, 6,000px world width, clamped east/west boundaries, slider movement, no page horizontal overflow, incorrect-answer rejection, successful completion and persistence after reload. QA uses an isolated temporary database; the persistent user game remains intact.

## Artwork provenance

Built-in image-generation tool, then lossless geometry-preserving WebP encoding with Sharp. Original generated files remain in the generator output directory. The accepted central reference is `exec-f40e4f2c-1b6a-47f6-bc45-c85c3e7160b7.png`.

West prompt: Create a new adjacent west region matching the accepted overhead camera, realistic canopy detail, scale, moody light and dangerous jungle style. Wide 3:1. Huge intertwined roots, giant mossy boulders, fallen trees over a narrow dry cleft, poisonous plant groves and thick emerald canopy. No large valley or rope bridge; those belong to the central region. No water, river, lake, flood, beach, paths, trails, roads, camps, endpoints, markings or text. Continuous dense foliage at both edges; distinct geography, not mirrored or repeated terrain.

East prompt: Create a new adjacent east region matching the same overhead camera, realistic detail, scale and lighting. Wide 3:1. Collapsed ancient buildings swallowed by roots, ominous mossy stepped ruins, jagged wooded cliffs, dense emerald canopy and pale mist. One tiny muddy stepping-stone crossing at most 1% water. No large river, lake, ocean, waterfall, flooded forest or beach. No large valley or rope bridge; those belong to the central region. No paths, trails, roads, endpoints, camps, lettering or pins. Continuous foliage at both edges, distinct original geography.
