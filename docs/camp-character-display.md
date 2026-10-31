# Campfire character display

The active display uses the original full-body character artwork beside each
team member's tent. It selects the neutral first frame from the corresponding
male or female sheet in `public/images/characters/camp/`, without playing sprite
animations. The procedural 3D implementation is not imported or rendered.

Clicking or keyboard-activating a character shows the player's current name,
life and energy. The current programme energy override is preserved. Tent
assignments remain stable across roster refreshes and avatar variant changes.

The 3D source remains available for future work, as requested, but the camp does
not load Three.js, render a 3D canvas, offer rotation controls or run its animation loop.
