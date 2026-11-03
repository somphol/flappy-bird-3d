# Reproduction book

This is the rebuild and verification handoff for **Flappy Bird 3D**. It explains what the
release is, which requirement each part satisfies, the order to rebuild it, where the numbers
came from, and how to prove the result. Read it with
[ARCHITECTURE](ARCHITECTURE.md), [TESTING](TESTING.md) and [DEPLOYMENT](DEPLOYMENT.md).

> **If `index.html` exists, it is the source of truth.** Do not rewrite the game from this book
> for style reasons. Reconstruct only when the file is lost, and compare the result against the
> constants and behaviours listed here.

## 1. What is being reproduced

A polished, single-file 3D arcade flyer:

- **One mode:** endless pipe corridor. The bird is fixed in x, moves only in y; pipes stream
  toward the camera on +z.
- **One page:** `index.html` holds markup, CSS, and a Three.js ES module. Three.js `0.169.0` is
  the only external request, loaded through an import map from jsDelivr.
- **Controls:** Space / click / tap to flap; drag or arrow keys to orbit; wheel / `+` / `−` /
  on-screen buttons to zoom; `F` or the flip button for side views; `R` or the crosshair to reset.
- **Loop:** menu → playing → crash → game-over card → restart after 0.68 s; best score in
  `localStorage`.
- **Presentation:** sunset gradient sky, low-poly glowing bird, textured green pipes with glowing
  caps, clouds, pylons, grid runway, particles, shadows, fog, crash shake and flash.
- **Audio:** synthesized Web Audio cues for flap, score, crash and start; persistent mute.
- **Language:** English UI only.
- **Release:** single-file source, no build, MIT, deployed at
  <https://somphol.github.io/flappy-bird-3d/> from `main` / root.

## 2. Requirements matrix

| Requirement (original brief or later request) | Implementation | Where |
| --- | --- | --- |
| Single self-contained HTML file | inline `<style>` and `<script type="module">` | `index.html` |
| Three.js via CDN | import map `three → three@0.169.0` | `index.html` head |
| Third-person camera behind a bird facing down a corridor | orbit rig at yaw 0, bird faces −z | `updateWorld`, `bird` |
| Bird model (not a sphere) with wings | body, belly, crest, eyes, beak, two wing pivots, tail | Bird section |
| Upward flap + constant gravity | `GRAVITY = -25`, `FLAP_VELOCITY = 8.4` | `updateBird`, `flap` |
| Endless pairs of textured green cylinder pipes | `makePipeTexture`, `spawnPipe`, `maybeSpawnPipe` | Pipes section |
| Pass-through gap | `gapHeight`, `gapCenter`, forced first gap | `spawnPipe` |
| Bounding-box collisions with pipes or ground | `Box3` bird vs expanded pipe bodies; floor bound | `updatePipes`, `updateBird` |
| Score as the bird passes each opening | `z > 1.4` + `passed` flag | `updatePipes` |
| Large retro score HUD | `#score` with pop animation; `#best` | markup + CSS |
| Synthesized Web Audio: flap, score, crash | `playFlap`, `playScore`, `playCrash`; start arpeggio | Audio section |
| Game-over card with current score, best, restart | `#gameover`, `showGameOver`, `startGame` | markup + HUD section |
| High score saved to `localStorage` | `flappy3d.best` via `saveBest` | HUD section |
| Vibrant sky gradient, clouds, sunlight, shadows | sky shader, 11 clouds, directional + hemisphere lights | World section |
| Responsive desktop/mobile | CSS breakpoints at 640 px wide / 620 px high, safe areas, DPR cap | `<style>` |
| **Later:** tilt the scene left/right/up/down | drag + arrow-key yaw/pitch with damping | `look`, `updateLookFromKeys`, pointer handlers |
| **Later:** flip between left and right views | `flipView`, `F`, `#flipView` button | Look section |
| **Later:** zoom in and out | `zoomBy`, wheel, `+`/`−`, `#zoomIn`/`#zoomOut` | Look section |
| **Later:** credit OpenCode and the model; build state | menu credits, `state.json`, `STATE.md` | markup + root |
| Public GitHub project + Pages | repo root, `.nojekyll`, `README`, community files | repository |

## 3. Non-negotiable constraints

| Constraint | Why | Enforcement |
| --- | --- | --- |
| One HTML file for app code | The product is a one-file demo; viewers can save it | all CSS/JS inline; the required-file list treats `index.html` as the only app source |
| No package manager, bundler or build | Clone and serve; no toolchain drift | no `package.json`, no lockfile |
| Three.js pinned at `0.169.0` | Shader, color-space and shadow behaviour were verified against it | import map string; docs |
| No runtime network beyond Three.js | Privacy and predictable startup | grep-level review; the only URL in the module is the import map |
| z convention: pipes move +z, cull at 14, world at −z | Scoring, collision and camera all assume it | `spawnPipe`, `updatePipes`, camera formulas |
| Delta clamped to 0.05 s | Prevent tunnelling and huge post-stall steps | `animate` |
| Difficulty caps: gap 3.08, speed 24 | Keep late runs humanly playable | `spawnPipe`, `updatePipes` |
| Persistence guarded with `try/catch` | `file://` and private browsing can throw | `readBest`, `readSound`, `saveBest`, `toggleSound` |
| `state.json` is historical only | Honest build provenance | never imported or fetched |
| Skill template byte-identical | The reusable skill must ship the real release | `scripts/check.mjs` |

## 4. Reference environment

The game needs only a modern browser with WebGL and network access for Three.js. The build and
verification environment was:

| Tool | Version / note |
| --- | --- |
| macOS | Darwin, Apple Silicon |
| Node.js | `v26.13.0` (checks use only built-ins; Node 22+ is enough) |
| Python | 3.x, only for `python3 -m http.server` |
| Chrome | headless, SwiftShader, used for smoke tests |
| Dependencies | **none** — no `npm install` |
| Hosting | GitHub Pages, `main`, repository root |

```bash
cd ~/Projects/flappy-bird-3d
python3 -m http.server 8000        # http://localhost:8000
node scripts/check.mjs
```

## 5. Repository map

| Path | Role |
| --- | --- |
| `index.html` | The entire game (markup, CSS, module) — ~2.3k lines |
| `README.md` | Human index: play, controls, features, tech, docs |
| `AGENTS.md` | Six-section handoff for the next maintainer/agent |
| `docs/ARCHITECTURE.md` | Module map, boot order, formulas, schema |
| `docs/REPRODUCTION.md` | This book |
| `docs/TESTING.md` | Verified vs. reasoned vs. unverified matrix |
| `docs/DEPLOYMENT.md` | Pages settings, checks, rollback |
| `docs/social-card.png` | 1200×630 OG image, also served |
| `screenshot.png`, `screenshot-menu.png` | Release screenshots (menu/gameplay) |
| `scripts/check.mjs` | Dependency-free release check |
| `skills/flappy-bird-3d/` | Reusable skill + byte-identical template |
| `state.json`, `STATE.md` | Historical build time/token/session record |
| `.nojekyll` | Serve `docs/` and other underscore-free paths verbatim |
| `.github/` | Issue forms, PR template, CODEOWNERS |
| `LICENSE` | MIT |

## 6. Build order from an empty directory

Each stage ends with an acceptance check. Do not start the next stage until it passes.

### Stage 0 — scaffold

```bash
mkdir -p ~/Projects/flappy-bird-3d/docs
cd ~/Projects/flappy-bird-3d
git init -b main
printf '' > .nojekyll
```

Create `index.html`, `README.md`, `LICENSE`, `.gitignore`, and the GitHub community files.
No `package.json`.

**Accept:** `python3 -m http.server 8000` serves a page without 404s other than the favicon
(which is an inline data URI in the release).

### Stage 1 — page shell and HUD

Build the DOM in this order: `#app` → `#scene` canvas → `#vignette` → `#hud` (best, score,
sound/flip/recenter buttons) → `#lookHint` → `.zoom-controls` (`#zoomIn`, `#zoomLevel`,
`#zoomOut`) → `#menu` → `#gameover` → `#flash` → `#loading`.

Write the CSS tokens (`--ink`, `--gold`, `--cyan`, `--green`, …), the card/overlay system, the
score pop, hit flash, loader, and the two responsive breakpoints. Include
`prefers-reduced-motion`.

**Accept:** at 1440×900 and 390×844 the menu card is centred, the HUD does not overlap it, and
buttons are at least 36 px on mobile.

### Stage 2 — import Three.js and build the static world

Add the import map and the top-level import with an error card. Create the renderer with DPR cap
2, ACES exposure 1.16, sRGB and soft shadows. Add camera, fog, sky shader sphere, hemisphere +
ambient + directional light, ground, grid, runway, 18 pylons, 11 clouds, 230 particles, sun glow
and core. Build the bird from primitives with two wing pivot groups.

**Accept:** the scene renders behind the menu with no console errors; resizing updates aspect and
DPR; a missing CDN shows the error card instead of a blank page.

### Stage 3 — physics and state machine

Implement `state`, `best`/`soundOn` loaders, `startGame`, `flap`, `handleAction`, `crash`,
`showGameOver`, `updateBird`, `animate`. Use `delta = min(getDelta(), 0.05)`, semi-implicit Euler,
ceiling clamp 5.2 and floor crash at −4.05.

**Accept:** Space starts the game, each Space gives one flap (key repeat ignored), the bird falls
under gravity, the menu bird bobs, and a floor hit opens the game-over card after ~0.58 s.

### Stage 4 — pipes, score and collision

Create the canvas pipe texture and shared materials, then `spawnPipe(z, forcedGapCenter)`,
`disposePipe`, `clearPipes`, `maybeSpawnPipe`. Seed `-46` (gap 0.5), `-73`, `-100` and call
`maybeSpawnPipe()`. In `updatePipes`, implement speed, +z motion, the `z > 1.4` score crossing,
the `z > 14` cull, spawn maintenance, and AABB tests for `|z| < 4.4` with `0.1` expansion.
Add the ground backstop.

**Accept:** the first gap is centred at 0.5; pipes approach and cull; score increments once per
pipe; hitting a body or the floor ends the run.

### Stage 5 — camera look, flip and zoom

Add the `look` object and constants, pointer drag with a 6 px threshold and second-finger flap,
arrow keys, wheel, buttons, `flipView`, `resetLook`, `zoomBy`, and the per-frame damped rig.
Add the 12 s hint dismissal.

**Accept:** yaw reaches ±π, pitch stops at ±0.55, zoom stops at 0.55/1.8, flip toggles ±π/2,
reset returns to 100 %, and a click without drag still flaps.

### Stage 6 — audio, persistence and polish

Add lazy `AudioContext` creation, master gain, noise buffer, the four cue recipes, mute toggle and
icon, `saveBest` inside `crash`, best/new-best HUD updates, crash shake/flash/vibration, and the
`window.__flappy3d` debug handle.

**Accept:** the first gesture enables audio; mute survives reload; a new best appears on the
game-over card and after reload; crash shake decays.

### Stage 7 — verification, docs, deploy

Run the checks in §9, write the docs, copy `index.html` byte-for-byte to
`skills/flappy-bird-3d/assets/template/index.html`, then commit and push. Enable Pages on
`main` / root. See [DEPLOYMENT](DEPLOYMENT.md).

## 7. Where the non-obvious numbers came from

These are **hand-tuned feel constants from the build session**, not values derived from a physics
engine or a reference implementation. The geometry relationships below are the reason they work;
preserve the relationships if you re-tune.

| Number | Value | Rationale / consequence |
| --- | --- | --- |
| Gravity | `-25` u/s² | Fast, arcade-weight fall. Combined with the flap it sets the whole game's tempo. |
| Flap velocity | `8.4` u/s | Continuous apex `8.4²/50 = 1.4112` u, apex time `0.336` s, round trip `0.672` s. |
| Delta cap | `0.05` s | At 24 u/s a pipe moves 1.2 u per max step, well inside the 2.1 u pipe diameter. |
| Ceiling | `5.2` u | Clamp only; no death. Keeps the bird inside the camera framing. |
| Floor bound | `-4.05` u | Slightly above the visible ground `-4.6`, so the bird never enters the plane. |
| Ground check | `y < -4.1` | Stricter than the bound; a backstop if constants change. |
| Gap height | `3.66 − 0.012·score`, floor `3.08` | ~5× the 0.72 u bird box at the start; floor reached at score 48.33. |
| Gap centre | `-0.7 … 1.7` | Biased slightly above the bird's rest height; 2.4 u of vertical variety. |
| Pipe radius / cap | `1.05` / `1.14` | Cap reads as a lip; collision ignores it, making hits forgiving. |
| Pipe extents | top to `14`, bottom to `-7` | Guarantees the corridor is closed at every reachable y. |
| Base speed | `14` u/s | Pipe spacing 21 gives a 1.5 s cadence. |
| Speed curve | `+0.3`/point, cap `24` | Cap at score 33.33; ~71 % faster than the start. |
| Spacing | `max(21, speed·1.45)` | Grows from score ~1.61; cadence stays 1.5 → 1.45 s. Cap spacing 34.8. |
| Score plane | `z > 1.4` | Just past the bird plane, so the point lands as the gap clears the bird. |
| Cull plane | `z > 14` | Usually behind the default camera (z ≈ 9.5); at maximum zoom-out the camera reaches z ≈ 17.3 and the cull is slightly in front of it. |
| Collision window | `|z| < 4.4` | ~±2 pipe radii and the bird depth; skips distant pipes cheaply. |
| Bird box | `0.95 × 0.72 × 1.05` | Smaller than the visual body, deliberately forgiving. |
| Camera anchor | `0.7, 9.5`, height `2.45` | Slight over-the-shoulder offset; height above the bird. |
| Look target | `28` u ahead | Far enough to feel like a corridor, near enough to frame pipes. |
| Yaw/pitch/zoom damping | `14 / 14 / 11` | Snappy look, softer zoom. |
| Zoom range | `0.55 … 1.8`, step `0.12` | 1.8 is ~1.8× closer; 0.55 is ~1.8× farther. |
| Drag sensitivities | `0.0035` yaw, `0.003` pitch | A ~900 px drag crosses the full yaw range. |
| Restart gate | `overTimer > 0.68` | Card shows at `0.58`; 0.1 s of grace against accidental taps. |
| Fog | `55 … 195` | Pipes fade in before they are close; sky remains visible. |
| Palette | sky `#1b4bd6`/`#ffb26b`/`#063d66`, bird `#ffd93d`, pipe `#b2ffc9` | Sunset/cartoon contrast: warm sky, green pipes, yellow bird. |

Other authored numbers: renderer exposure 1.16; shadow map 2048²; 11 clouds; 18 pylons; 230
particles; grid 350 units / 124 divisions (cell 2.82); pipe travel 182 units = 13 s at start speed;
score-sequence tones 880/1320/1760 Hz; master gain 0.62.

## 8. Verification procedure and expected results

```bash
cd ~/Projects/flappy-bird-3d
node scripts/check.mjs
```

Expected: a list of checks ending in `OK <n> checks` and exit code 0. The script checks the
required release files, every local `src`/`href` in `index.html`, relative Markdown links in
`README.md`, `AGENTS.md` and `docs/`, `node --check` on every `.js`/`.mjs` file plus the extracted
inline module, JSON parsing, and byte equality of the skill template.

Manual/browser verification (see [TESTING](TESTING.md) for what was actually run):

1. Serve with `python3 -m http.server 8000`; open the page with DevTools open.
2. Expect the loader to fade, the menu card to appear, best score from storage, and no errors.
3. Press Space; expect the menu to hide, a start arpeggio, and a flap.
4. Let the bird fall; expect the red flash, crash sound, tumble, game-over card after ~0.58 s.
5. Confirm Space during the first 0.68 s does nothing, then restarts with score 0 and pipes reset.
6. Score one pipe; expect the score pop and tone; reload and confirm the best persists.
7. Drag in all directions; arrows; `F`; `R`; wheel; `+`/`−`; confirm clamps and the 100 % reset.
8. Toggle sound; reload; confirm the icon and mute persist.
9. Resize to 390×844; confirm HUD, card and zoom controls fit and taps flap.

## 9. What was tried and rejected

- **Fixed chase camera.** The first build had a single over-the-shoulder view. The user asked to
  “tilt the scene however they want left right up down”, so the fixed camera was replaced by the
  damped yaw/pitch rig. Do not reintroduce a hard-coded camera position; `updateWorld()` owns it.
- **Look without a flip.** After free look, the user asked to flip left/right explicitly. A true
  side view at ±π/2 plus a one-key toggle was added rather than a 180° spin, because 180° is the
  front view and disorients play.
- **Look without zoom.** Zoom was a later request. It was implemented by scaling the whole rig
  (`1 / zoom`) rather than changing FOV, so the perspective and pipe readability stay constant.
- **Plain `favicon.ico`.** Headless logs showed 404s for the favicon; the release uses an inline
  SVG data URI, so there is no favicon request.
- **Separate CSS/JS files.** Considered for maintainability and rejected: the product promise is
  one file. `scripts/check.mjs` and the docs carry the maintainability instead.

## 10. Honest deviations and unfinished parts

- **No automated gameplay assertions.** The earlier build session used headless Chrome/CDP for
  interaction smoke tests, but that harness is not in the repository. `scripts/check.mjs` is
  static: syntax, links, files, JSON and template equality. It does not play the game.
- **No audio verification.** The Web Audio graph is reasoned from the source; no test asserts
  audible output.
- **Browser coverage is Chrome-only.** Safari, Firefox and real mobile devices are unverified.
- **The ground guard in `updatePipes()` is effectively unreachable** while `BIRD_MIN_Y = -4.05`
  crashes first. It is kept as a safety net.
- **Best score is written only on crash**, so abandoning a run does not save it.
- **No pause.** Hiding the tab freezes rendering and discards the elapsed delta, but there is no
  pause control or overlay.
- **Maximum zoom-out can pop a pipe.** Pipes cull at `z = 14`; at `zoom = 0.55` the camera is at
  `z ≈ 17.3`, so a passing pipe can vanish just in front of the camera. The default view is not
  affected.
- **No i18n, levels, leaderboard, accounts or analytics.** These were never in scope.
- **`file://` behaviour varies.** The page is designed for an HTTP origin; module and storage
  behaviour on `file://` depends on the browser.
- **`state.json` / `STATE.md` are snapshots** taken when the project was packaged; they are not
  updated by later documentation commits.
