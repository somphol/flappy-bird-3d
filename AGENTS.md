# AGENTS.md — Flappy Bird 3D

> **Handoff book:** [docs/REPRODUCTION.md](docs/REPRODUCTION.md) explains how to rebuild this
> from an empty directory and how to verify it. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> maps the code, [docs/TESTING.md](docs/TESTING.md) records what was actually checked, and
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) covers GitHub Pages operations.

## 1. What this is

A single-file 3D arcade game: one `index.html` contains the markup, CSS and a Three.js ES module.
The bird is fixed in x and z and moves only in y while green pipe pairs stream toward the camera along
+z; Space, click or tap applies a flap impulse, and the player threads the gaps until a pipe,
the ground or the lower bound ends the run. It produces one endless mode, a menu / playing /
game-over loop, a `localStorage` best score, synthesized Web Audio effects, and an orbitable,
zoomable chase camera. It is **not** a 2D Flappy clone, a level-based game, a PWA, or a
framework starter — there is no build, no package manager and no application test harness.

Live copy: <https://somphol.github.io/flappy-bird-3d/>
Local master: `~/Projects/flappy-bird-3d` (this repository)

## 2. Commands

There is **no install and no build step**. Serve the folder (an HTTP origin is recommended so
ES modules and `localStorage` behave normally):

```bash
cd ~/Projects/flappy-bird-3d
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly with `file://` also works in Chrome (verified) and in other browsers
that allow module imports over `file://`; the Three.js import still needs a network connection.

```bash
# verification (dependency-free; Node 22+)
node scripts/check.mjs

# deploy = commit to main and push; Pages serves the repository root
git push origin main
```

`scripts/check.mjs` verifies the release file set, local HTML references, relative Markdown
links, JavaScript syntax (including the inline module), JSON parsing, and that the skill's
template copy is byte-identical to `index.html`. It makes no network calls.

## 3. Architecture

Only one file controls game behaviour; two supporting paths complete the release:

| File | Role |
| --- | --- |
| `index.html` | Markup, all CSS in a `<style>` block, the CDN import map, and the game module in `<script type="module">` |
| `scripts/check.mjs` | Dependency-free release check (does not run at game time) |
| `docs/` + `skills/flappy-bird-3d/` | Documentation and the reusable skill; never loaded by the game |

Boot order inside `index.html`: import map pins `three` to jsDelivr → top-level `await import("three")`
(with a visible error card on failure) → DOM lookups → constants and `readBest()` / `readSound()` →
`WebGLRenderer` setup (with a WebGL failure card) → scene, camera, sky/lights, clouds/ground/pylons/
particles → bird meshes → pipe material and texture factories → lazy audio setup → input listeners →
`updateBestDisplay()`, `updateSoundButton()`, `updateZoomLabel()` → `renderer.compile()` → `animate()`.

The frame loop is `animate()` → `updateBird(delta)` → `updatePipes(delta)` → `updateWorld(delta)` →
`renderer.render()`. `delta = Math.min(clock.getDelta(), 0.05)`, so a stalled frame cannot tunnel the
bird through a pipe. The state machine is `state.phase`: `"menu"` → `"playing"` → `"over"` → `"playing"`.

Key algorithm — semi-implicit Euler in `updateBird()`:

```text
birdVelocity += GRAVITY * delta          // GRAVITY = -25 units/s²
bird.position.y += birdVelocity * delta  // FLAP_VELOCITY = 8.4 units/s
```

A flap sets velocity; it does not add an impulse. Ceiling `BIRD_MAX_Y = 5.2` clamps and cancels
upward velocity; `BIRD_MIN_Y = -4.05` clamps and calls `crash()`. Menu bird bobs on a sine; the
game-over bird tumbles under `GRAVITY * 0.82` and settles at `GROUND_Y - 0.6`.

Difficulty and spawning, all in `spawnPipe()` / `maybeSpawnPipe()` / `updatePipes()`:

```text
speed      = min(24, 14 + score * 0.3)
gapHeight  = max(3.08, 3.66 - score * 0.012)
gapCenter  = randFloat(-0.7, 1.7)        // first pipe forced to 0.5
spacing    = max(21, speed * 1.45)
spawn when last pipe z > -168 + spacing, at last.z - spacing (first at -58)
score when a pipe crosses z > 1.4, once (pipe.userData.passed)
```

Collision is axis-aligned boxing: the bird box is `0.95 × 0.72 × 1.05` centred on the bird; each
top/bottom cylinder gets a `Box3` expanded by `0.1`; only pipes with `|z| < 4.4` are tested.
The ground guard in `updatePipes()` is `bird.y - 0.36 < GROUND_Y + 0.14`.

Camera — `updateWorld()` rebuilds the rig every frame from damped look targets:

```text
zoomScale = 1 / look.zoom
orbitX = (0.7·cos(yaw) + 9.5·sin(yaw)) · zoomScale
orbitZ = (-0.7·sin(yaw) + 9.5·cos(yaw)) · zoomScale
camera.y = 0.9 + bird.y·0.32 + 2.45·zoomScale + shake
lookAt(-sin(yaw)·28·zoomScale·cos(pitch),
       0.92 + bird.y·0.22 + sin(pitch)·28·zoomScale,
       -cos(yaw)·28·zoomScale·cos(pitch))
```

`yaw ∈ [-π, π]`, `pitch ∈ [-0.55, 0.55]`, `zoom ∈ [0.55, 1.8]`; yaw/pitch damp at λ = 14 and
zoom at λ = 11. At yaw 0 the camera is the over-the-shoulder chase view; ±π/2 are side profiles;
π is front-on.

Persistence is two independent `localStorage` keys, both read once at boot and wrapped in
`try/catch`:

| Key | Value | Written by |
| --- | --- | --- |
| `flappy3d.best` | decimal integer string; read with `Number()`, floored, only accepted when finite and > 0 | `saveBest()` on crash, only when `state.score > best` |
| `flappy3d.sound` | `"on"` / `"off"`; anything other than `"off"` means sound is on | `toggleSound()` |

The best score is **not** saved mid-run; closing the tab during a record run loses that run.
`state.json` / `STATE.md` are historical build records, never read at runtime.

## 4. Decisions and constraints

- **One file is the product.** `index.html` must stay self-contained apart from the pinned
  Three.js CDN module. Do not split CSS/JS into new files, add a bundler, or add dependencies.
- **Three.js is pinned through the import map** to `three@0.169.0` on jsDelivr. An unpinned or
  swapped CDN is a release change: re-test shaders, color space and shadow behaviour.
- **The z convention is fixed.** The bird sits near z = 0; pipes move +z toward the camera and are
  culled at z > 14; the world recedes toward negative z. Reversing any sign in `spawnPipe`,
  `updatePipes` or the camera rig breaks scoring, collision and the view together.
- **Physics is frame-rate-aware but not fixed-step.** Keep the `0.05` delta clamp and the
  semi-implicit order (`v` then `y`). Changing `GRAVITY` or `FLAP_VELOCITY` changes the jump arc
  (8.4 / 25 gives a 1.41-unit apex and ~0.67 s round trip) and therefore every gap.
- **Difficulty curves are deliberate and capped.** Gap floor 3.08 and speed cap 24 keep late runs
  playable; spawn spacing grows with speed so the pipe *cadence* stays near 1.45–1.5 s. Do not
  remove a cap without re-tuning the others.
- **Collision is approximate by design.** It uses expanded AABBs for the cylinder bodies, ignores
  the cap rings, and only tests pipes near z = 0. It is forgiving rather than pixel-exact.
- **Camera feel depends on the rig constants.** The `0.7 / 9.5 / 2.45 / 28` numbers, the damping
  lambdas and the 6 px drag threshold are tuned together. `flipView()` identifies the right side
  by `|targetYaw − π/2| < 0.35`.
- **Input has one action path.** `handleAction()` starts, flaps, or restarts (only after
  `overTimer > 0.68`); buttons call their handlers directly and stop propagation. Any new input
  source should route through `handleAction()` so the restart gate is preserved.
- **Audio is lazy and gesture-gated.** `ensureAudio()` creates/resumes the context on the first
  action because browsers block autoplay; the master gain is 0.62. Do not create the context at
  boot.
- **Release documentation and the skill template are checked.** `skills/flappy-bird-3d/assets/template/index.html`
  must stay byte-identical to `index.html`; `scripts/check.mjs` fails otherwise. Update the template
  whenever the game changes.
- **The repository is MIT and public; Pages serves `main` / root.** `.nojekyll` must stay so the
  `docs/` folder is served verbatim.

## 5. Known issues

- **Browser coverage is narrow.** Interaction was smoke-tested in headless Chrome at 1440×900 and
  390×844 with zero console errors; Safari and Firefox were not automated. Real iOS/Android
  devices were not tested.
- **No explicit pause.** `requestAnimationFrame` pauses in a hidden tab and the clock delta is
  discarded on return, so there is no catch-up, but there is no pause key or overlay.
- **Ground collision guard is redundant.** In normal play `BIRD_MIN_Y = -4.05` crashes before the
  stricter `y < -4.1` ground test in `updatePipes()` can run. It remains as a safety net.
- **Pipe culling at maximum zoom-out.** Pipes are removed at `z > 14`; at `zoom = 0.55` the camera
  sits at `z ≈ 17.3`, so a pipe can disappear slightly in front of it. At the default zoom the
  camera is at `z = 9.5` and the cull is behind the viewer.
- **Score persistence only happens on crash.** A best score is written by `saveBest()` inside
  `crash()`; there is no save on unload.
- **Audio is synthesized and untested by ear in automation.** Frequencies and envelopes are in the
  source; no automated audio assertion exists.
- **No difficulty selection, no pause, no leaderboard, no i18n.** These are out of scope, not stubs.
- **CDN dependency.** Without network access the loading screen shows “Three.js could not be
  loaded.” The game is not offline despite being a single file.
- **`localStorage` on `file://`** can be per-file or blocked depending on the browser; all reads
  and writes are already wrapped and degrade to in-memory defaults.
- **Camera pitch is clamped to ±0.55 rad (~31.5°)** and yaw to ±π; free look is not unlimited.

## 6. Continuity

- **Deployed copy:** GitHub Pages from `main`, repository root — <https://somphol.github.io/flappy-bird-3d/>.
- **Local master:** `~/Projects/flappy-bird-3d`; `origin` is `https://github.com/somphol/flappy-bird-3d.git`.
- **Doc map:** [README.md](README.md) is the human index; [docs/REPRODUCTION.md](docs/REPRODUCTION.md)
  is the rebuild/verification book; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the code map;
  [docs/TESTING.md](docs/TESTING.md) is the honest test matrix; [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
  is Pages operations; [skills/flappy-bird-3d/SKILL.md](skills/flappy-bird-3d/SKILL.md) is the
  reusable build skill; [STATE.md](STATE.md) and [state.json](state.json) are historical build records.
- **Publishing rules:** no force-push; one documentation commit at a time; keep `main` deployable.
  If the repository or owner is renamed, update the absolute URLs in `index.html` (canonical, OG and
  Twitter tags), `README.md`, `AGENTS.md`, `robots.txt`, `sitemap.xml` and `state.json`.
- **If the game changes:** update the template copy under `skills/flappy-bird-3d/assets/template/`,
  re-run `node scripts/check.mjs`, refresh screenshots only if the visuals changed, and update the
  affected constants in this file and `docs/ARCHITECTURE.md`.
