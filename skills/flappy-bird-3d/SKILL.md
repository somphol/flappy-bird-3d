---
name: Flappy Bird 3D
description: Build a polished single-file Three.js Flappy Bird with pipe physics, orbit and zoom cameras, synthesized audio, localStorage scoring and a GitHub Pages release.
version: 1.0.0
---

# Flappy Bird 3D

Build an endless 3D Flappy Bird as **one self-contained `index.html`**: markup, CSS and a
Three.js ES module in the same file. The bird holds x and moves only in y while pipe pairs
stream toward the camera on +z. Ship a menu / playing / game-over loop, a damped orbit camera
with flip and zoom, synthesized Web Audio, and a persisted best score.

This skill packages the finished **Flappy Bird 3D** release as a working reference. The template
is the real release source, not a reskin: copy it and change it deliberately.

## When to use

- A user asks for a 3D Flappy Bird, a one-file arcade demo, or a Three.js game that runs from a
  single HTML document.
- You need a proven endless-corridor pattern: z-streamed obstacles, flap/gravity physics, AABB
  collision, score-on-pass, and a restart loop.
- You want a camera rig that can orbit, flip to side views, and zoom without a controls library.
- The release must be static, MIT-clean, and deployable to GitHub Pages without a build step.

**Not for:** 2D canvas games, level-based runners, multiplayer/networked games, physics engines
with rigid-body dynamics, VR, or anything that must work fully offline — this design fetches
Three.js from a CDN. For a 2D arcade game, use a canvas pattern instead. For a city scene, use a
city-miniature skill.

## What it produces

```text
flappy-bird-3d/
├── index.html                 # the entire game (~2.3k lines)
├── README.md                  # play, controls, features, docs index
├── AGENTS.md                  # six-section maintainer handoff
├── docs/{ARCHITECTURE,REPRODUCTION,TESTING,DEPLOYMENT}.md
├── scripts/check.mjs          # dependency-free release checks
├── skills/flappy-bird-3d/     # this skill (template is byte-identical)
├── state.json / STATE.md      # optional historical build record
├── .nojekyll                  # GitHub Pages
└── LICENSE                    # MIT
```

The game includes: a low-poly glowing bird, sunset sky shader, clouds, pylons, runway grid,
speed particles, textured pipes with glow caps, shadows, fog, crash shake/flash, HUD score and
best, a "New Best!" badge, four synthesized cues, and a responsive touch layout.

## Quick start

```sh
mkdir -p ~/Projects/my-flappy && cd ~/Projects/my-flappy
cp /path/to/flappy-bird-3d/skills/flappy-bird-3d/assets/template/index.html .
printf '' > .nojekyll
python3 -m http.server 8000     # open http://localhost:8000
```

Copy `scripts/check.mjs` and the Markdown docs from the same skill/release if you want the full
release check. The template runs as-is; it is the release source, not a blank starter.

## Workflow

1. **Copy the template.** `index.html` is the whole app. Keep CSS and the module inline.
2. **Rebrand only what is text.** Title, meta description, canonical/OG URLs, menu eyebrow,
   tagline, credits, and (optionally) CSS custom properties. Do not touch physics yet.
3. **Pin Three.js.** Keep the import map at `three@0.169.0` until you have re-tested shaders,
   color space and shadows on another version.
4. **Tune the game.** Change `GRAVITY`, `FLAP_VELOCITY`, gap and speed curves together; see
   `references/method.md`.
5. **Keep the camera rig formula.** Orbit, flip and zoom all depend on it. If you change the
   anchor or look distance, change them in one place (`updateWorld`).
6. **Verify.** Run the static checks, then a browser smoke test: start, flap, score, crash,
   restart, persist, orbit, flip, zoom, mobile viewport.
7. **Release.** Add `AGENTS.md`, docs, screenshots, `.nojekyll`, MIT licence; push `main`; enable
   Pages on root. See `references/verification.md`.

## Module map of the template

| Area | Identifiers | Notes |
| --- | --- | --- |
| Boot | `await import("three")`, `readBest`, `readSound` | CDN failure and WebGL failure show their own cards |
| State | `state.phase`, `best`, `soundOn`, `birdVelocity`, `elapsed` | `menu` → `playing` → `over` |
| Physics | `updateBird`, `flap`, `crash` | semi-implicit Euler, delta capped at 0.05 |
| Pipes | `spawnPipe`, `maybeSpawnPipe`, `updatePipes`, `disposePipe` | +z stream, AABB collision, score at z > 1.4 |
| Camera | `look`, `updateWorld`, `updateLookFromKeys`, `flipView`, `resetLook`, `zoomBy` | damped yaw/pitch/zoom rig |
| Audio | `ensureAudio`, `playTone`, `playNoise`, `playFlap/Score/Crash/Start` | lazy context, master gain 0.62 |
| HUD | `setScore`, `updateBestDisplay`, `saveBest`, `showGameOver` | keys `flappy3d.best`, `flappy3d.sound` |
| Input | `handleAction`, pointer/key/wheel listeners | one action path for start/flap/restart |
| Debug | `window.__flappy3d` | `start`, `flap`, `crash`, `state`, `look`, `score`, `birdY` |

## Core recipes

### 1. Flap and gravity that feel right

Use velocity replacement, not an impulse, and integrate in this order:

```js
birdVelocity += GRAVITY * delta;      // -25
bird.position.y += birdVelocity * delta;
```

A flap sets `birdVelocity = FLAP_VELOCITY` (`8.4`). That gives a continuous apex of
`8.4² / (2·25) = 1.4112` units and a ~0.672 s round trip. Cap `delta` at `0.05` so a slow frame
cannot tunnel through a pipe. Clamp the ceiling (`5.2`) without killing the run; crash at the
lower bound (`-4.05`) and let the over state tumble the bird to the ground.

Tuning rules:

- Larger flap or lower gravity → floatier, easier. Keep the ratio `FLAP_VELOCITY² / (2·|GRAVITY|)`
  between roughly `1.0` and `1.8` units.
- The gap must stay comfortably larger than the bird box (0.72 high). Start at 3.66 and floor at
  3.08; that is already only ~4.3× the bird at the floor.
- The first gap is forced to a known centre (`0.5`) so the opening run is fair.

### 2. Endless pipe corridor

```js
const gapHeight = Math.max(3.08, 3.66 - state.score * 0.012);
const gapCenter = randFloat(-0.7, 1.7);
const gapTop = gapCenter + gapHeight / 2;
const gapBottom = gapCenter - gapHeight / 2;
// top cylinder: y = gapTop + (14 - gapTop) / 2, height 14 - gapTop
// bottom cylinder: y = gapBottom - (gapBottom + 7) / 2, height gapBottom + 7
```

Move groups on +z, cull past the camera, and spawn ahead of the last pipe:

```js
const spacing = Math.max(21, state.speed * 1.45);
if (!last || last.position.z > -168 + spacing) spawnPipe(last.z - spacing);
```

Score once when `pipe.position.z > 1.4`, guarded by `userData.passed`. Collide only near the bird
(`|z| < 4.4`) using a `Box3` of the bird (`0.95 × 0.72 × 1.05`) against each body expanded by
`0.1`. Ignore the cap rings — forgiving beats pixel-perfect in an arcade game.

### 3. Orbit / flip / zoom camera without a controls library

Keep target values and damp the live values:

```js
look.yaw   = damp(look.yaw,   look.targetYaw,   14, delta);
look.pitch = damp(look.pitch, look.targetPitch, 14, delta);
look.zoom  = damp(look.zoom,  look.targetZoom,  11, delta);
```

Then rebuild the rig every frame:

```js
const s = 1 / look.zoom;
const orbitX = (0.7 * Math.cos(yaw) + 9.5 * Math.sin(yaw)) * s;
const orbitZ = (-0.7 * Math.sin(yaw) + 9.5 * Math.cos(yaw)) * s;
camera.position.set(orbitX, 0.9 + birdY * 0.32 + 2.45 * s, orbitZ);
camera.lookAt(-Math.sin(yaw) * 28 * s * Math.cos(pitch),
              0.92 + birdY * 0.22 + Math.sin(pitch) * 28 * s,
              -Math.cos(yaw) * 28 * s * Math.cos(pitch));
```

Clamp yaw to ±π, pitch to ±0.55, zoom to `[0.55, 1.8]`. Flip toggles between ±π/2; if the
target is already within 0.35 of +π/2, go to −π/2. Zoom scales the entire rig rather than the
FOV, so perspective and readability stay constant.

### 4. Persistence that survives private browsing

```js
function readBest() {
  try {
    const value = Number(localStorage.getItem("flappy3d.best"));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch { return 0; }
}
```

Write only when a run beats the record, and only at crash. Guard every write. Keep the mute key
separate (`"on"` / `"off"`; anything but `"off"` means on). Do not add a schema version unless
you also write a migration.

## Failure boundaries

- **Do not split the file.** The one-file property is the product. Tooling lives beside it, not
  inside a build.
- **Do not remove the CDN import map.** Without it the module cannot resolve `"three"`; without
  network the game intentionally shows an error card.
- **Do not reverse the z convention.** Pipes move +z, cull at 14, world at −z, camera at positive
  z. Reversing one sign breaks scoring, collision and view at once.
- **Do not use a fixed camera position.** `updateWorld` overwrites it every frame; a fixed view
  silently disappears.
- **Do not test on a hidden tab.** `requestAnimationFrame` pauses; use a visible window or CDP.
- **Do not claim audio or mobile-device verification from a static check.** The check script only
  proves files, links, syntax, JSON and template equality.

## Verification

```sh
node scripts/check.mjs        # expected: OK <n> checks, exit 0
cmp index.html skills/flappy-bird-3d/assets/template/index.html
python3 -m http.server 8000
```

Browser smoke test: menu renders; Space starts and flaps; one pipe scores; crash shows the card;
restart is ignored for the first 0.68 s; reload keeps the best; drag/arrows orbit; `F` flips;
`R` resets to 100 %; wheel/`+`/`−` zoom and clamp; 390×844 layout fits; console has no errors.
Exact commands and expected values are in `references/verification.md`.

## Reference files

- `references/method.md` — build order, invariants, constants and the hard recipes.
- `references/lessons.md` — bugs, dead ends and what regresses.
- `references/verification.md` — static and browser checks with expected output.
- `assets/template/index.html` — the byte-identical release source.
- `ATTRIBUTION.md` — origin, licence and what is original.

## Licence

MIT. Three.js is loaded at runtime under its own MIT licence; no Three.js source is vendored.
