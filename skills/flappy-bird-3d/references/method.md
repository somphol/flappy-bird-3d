# Method — building the one-file 3D flyer

This is the build order and the recipes that are hard to infer from the finished file. Constants
are the released values; change them together if you retune.

## 0. Shape of the artefact

One `index.html` with three layers in this order:

1. `<head>`: meta, inline `<style>`, canonical/OG tags.
2. `<body>`: canvas, vignette, HUD, hint, zoom controls, menu, game over, flash, loading.
3. Import map, then one `<script type="module">` containing the game.

No `style.css`, no `script.js`, no `package.json`. Documentation and tooling live beside the file.
The reason is product, not purity: the demo can be saved as one file and served from any static
host.

## 1. Build order (each stage is playable or inspectable)

### Stage 1 — shell and CSS

Write the DOM first, then the CSS. The z-order that matters:

| Layer | z-index | Purpose |
| --- | --- | --- |
| `#scene` | auto | WebGL canvas |
| `#vignette` | 2 | edge darkening, pointer-events none |
| `#lookHint` | 5 | one-line control hint, auto-hides |
| `#hud` | 6 | best, score, sound/flip/recenter |
| `.overlay` (menu/game over) | 10 | cards |
| `.zoom-controls` | 12 | `+`, percentage, `−` |
| `#flash` | 20 | crash flash |
| `#loading` | 50 | boot cover |

Use `inset: 0` and a fixed `#app` so mobile browser chrome cannot scroll the game. Put
`touch-action: none` and `user-select: none` on `body`. Use `env(safe-area-inset-*)` in the HUD
and hint padding. Add `prefers-reduced-motion` to shorten animations.

### Stage 2 — renderer, scene, camera

```js
renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
```

Camera: `PerspectiveCamera(62, aspect, 0.1, 340)`, initially `(0.7, 3.4, 9.5)`; the rig replaces
the position every frame. Fog `0x9ac9e8, 55, 195`.

Sky is a `SphereGeometry(290, 32, 18)` with `BackSide`, `depthWrite: false` and a three-uniform
shader: mix horizon → top with `smoothstep(0, 0.38, h)`, then mix bottom → that with
`smoothstep(-0.34, 0.02, h)`. Colors `#1b4bd6` top, `#ffb26b` horizon, `#063d66` bottom.

Lighting: `HemisphereLight(0xc9f1ff, 0x18213d, 1.45)`, `AmbientLight(0x7f8dff, 0.52)`, and a
`DirectionalLight(0xffe6b0, 3.1)` at `(-24, 34, 16)` targeting `(0, 0, -48)`. Shadow camera
`±44 / 42 / -32`, map 2048², bias `-0.00045`, normalBias `0.035`.

### Stage 3 — world dressing

- Ground: `PlaneGeometry(340, 440)` at `y = -4.6, z = -112`, dark teal, metalness 0.5.
- Grid: `GridHelper(350, 124, 0x56f6ff, 0x1b7a9a)` at `y = -4.57`, opacity 0.17.
- Runway: 2.4 × 0.04 × 440 emissive strip along z.
- Pylons: 18, alternating x = ±8.8, z = `-22 - floor(i/2)*24`, post + glowing sphere.
- Particles: 230 points in a 28 × 15 × 165 box, additive, size 0.09.
- Clouds: 11 groups of 4–8 puffs, scaled 1.2–3.3, z from −20 to −198, y 8–23.
- Sun: additive sprite (58 units) + basic-material core sphere at `(44, 38, -195)`.

Share geometry/material aggressively: one cloud puff geometry, one cloud material, one pylon
material, one glow texture.

### Stage 4 — bird

Group at `(0, 0.15, 0)`, facing −z. Body sphere 0.56 scaled `(1, 0.92, 1.12)`; belly; three crest
cones; two eyes made of a flattened white sphere and a pupil at `z = -0.105`; beak cone rotated
`-π/2`; two wing pivots at x = ±0.46 with flattened spheres; tail with three cones; additive glow
sprite 2.65; point light `0xffd166` intensity 2.4, distance 10.

The collision box is **not** derived from the meshes: it is a hand-set `0.95 × 0.72 × 1.05` around
the bird position, deliberately smaller than the visuals.

### Stage 5 — physics and state machine

```js
const GRAVITY = -25;
const FLAP_VELOCITY = 8.4;
const BIRD_MIN_Y = -4.05;
const BIRD_MAX_Y = 5.2;
```

`flap()` only works while playing and **sets** velocity. `updateBird()` integrates velocity then
position. Ceiling clamps and kills upward velocity; floor clamps and calls `crash()`. Tilt target
is `clamp(v * 0.045, -0.48, 0.58)` damped with λ 9; roll is a sine at 2.2 rad/s.

`crash()` is idempotent via the phase check, sets `overTimer = 0`, `crashShake = 1`, keeps a small
upward velocity (`max(v, 2.2)`), saves the best, plays the crash cue, triggers the flash, and
vibrates if available.

Menu, playing and over each get their own bird motion; wings animate in all three.

### Stage 6 — pipes, score, collision

Create one 128×512 canvas texture: a horizontal green gradient with dark horizontal seams every
32 px and white vertical hairlines every 16 px; repeat 2 × 2.5. One body material, one cap
material, one glow sprite material.

`spawnPipe(z, forcedGapCenter = null)` builds two cylinders radius 1.05 from the gap to y = 14 and
y = -7, caps radius 1.14 × 0.2 at the gap edges, and a glow sprite. Store the meshes and two
`Box3`s in `userData`.

`startGame()` seeds `-46` (gap 0.5), `-73`, `-100`, then `maybeSpawnPipe()`. Seed three rather
than one, so the corridor starts populated while the spawner appends the next lead pipe.

`updatePipes()` while playing:

1. `speed = min(24, 14 + score * 0.3)`.
2. move +z, score at `z > 1.4` once, cull at `z > 14`.
3. spawn ahead with `spacing = max(21, speed * 1.45)`.
4. test AABBs only for `|z| < 4.4`; expand pipe bodies by 0.1.
5. ground backstop at `y < GROUND_Y + 0.14 + 0.36`.

### Stage 7 — look, flip, zoom

Targets plus damping. Drag is incremental after a 6 px threshold; a second pointer flaps while
the first drags. Arrow keys accumulate in a `Set`. Wheel amount is
`clamp(|deltaY| * 0.0015, 0.04, 0.18)`. Flip is a **side** view toggle (±π/2), not a 180° spin.
Reset returns yaw/pitch/zoom to 0/0/1. Zoom scales the rig via `1 / zoom`.

### Stage 8 — audio

Create the context lazily on the first action. One master gain (0.62 on, 0 off), one 0.6 s noise
buffer. Tone helper: exponential frequency ramp, 12 ms attack, exponential release. Noise helper:
low-pass ramping to 120 Hz. Recipes are in `docs/ARCHITECTURE.md` §9.

### Stage 9 — loop, input, lifecycle

```js
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  updateBird(delta);
  updatePipes(delta);
  updateWorld(delta);
  renderer.render(scene, camera);
}
```

Route Space, canvas click/tap and restart through `handleAction()`. Restart gate:
`overTimer > 0.68`; the card appears at `0.58`. Prevent context menu, ignore key repeat, clear
keys on blur/visibility change, and discard the clock delta when the tab becomes visible.

## 2. Invariants

1. **z is the travel axis.** Bird x fixed at 0, y gameplay; pipes +z; world −z; cull 14; camera
   positive z. Never mix signs.
2. **One score per pipe.** `userData.passed` is the guard; collision does not reset it.
3. **One action path.** `handleAction()` decides start / flap / restart from `state.phase`.
4. **Delta is capped.** Physics never sees a step larger than 50 ms.
5. **The bird box is smaller than the art.** Forgiving collision is intentional.
6. **The camera is rebuilt every frame.** Nothing else should set `camera.position`.
7. **Storage access is guarded.** Every read/write is inside `try/catch`.
8. **The gap is always closed.** Top reaches 14, bottom reaches −7; no fly-around.
9. **The template is the source.** Any app edit must be copied to the skill template.
10. **No new dependency.** Three.js is the only external request.

## 3. Difficulty math

| Quantity | Formula | Values |
| --- | --- | --- |
| Jump apex | `v² / (2g)` | 1.4112 u |
| Apex time | `v / g` | 0.336 s |
| Round trip | `2v / g` | 0.672 s |
| Speed | `min(24, 14 + 0.3s)` | 14 → 24 at score 33.33 |
| Gap | `max(3.08, 3.66 − 0.012s)` | 3.66 → 3.08 at score 48.33 |
| Spacing | `max(21, speed·1.45)` | 21 → 34.8 |
| Cadence | `spacing / speed` | 1.50 → 1.45 s |
| Pipe travel | 182 u / speed | 13.0 → 7.58 s |

The cadence is nearly constant on purpose: difficulty comes from a narrower gap and faster visual
flow, not from obstacles arriving more often.

## 4. Palette and type

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#071329` | page/card base |
| `--ink-2` | `#0b1d3d` | card gradient |
| `--cream` | `#fff7df` | body text |
| `--gold` | `#ffd166` | accent, bird, badge |
| `--hot` | `#ff5d5d` | crash, headline shadow |
| `--cyan` | `#64f4ff` | focus, score glow |
| `--green` | `#49ff8a` | pipes/gap glow |
| bird body | `#ffd93d` | warm yellow |
| pipe tint | `#b2ffc9` | texture multiplied green |

Headings use `"Arial Black", Impact, "Trebuchet MS"`; body uses
`"Avenir Next", "Trebuchet MS", "Segoe UI"`. The score is 58–104 px with a cyan glow, dark stroke
and a `skew(-4deg)`; the pop animation scales to 1.22 for 260 ms.

## 5. What to change for a new theme

Safe edits: title/meta/canonical/OG URLs, menu eyebrow/tagline/credits, CSS tokens, sky uniforms,
bird/pipe material colors, particle color, and cloud count. Risky edits: camera constants, bird
box size, gravity/flap, gap/speed curves, z thresholds. Re-run the browser smoke test after any
risky edit, and copy the new `index.html` into the skill template.
