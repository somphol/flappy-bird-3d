# Architecture

Flappy Bird 3D is one HTML document with one ES module. Everything below refers to
`index.html` unless stated otherwise. There is no build output and no runtime file other than
Three.js `0.169.0`, resolved by the import map at the top of the page.

## 1. File and section map

`index.html` is organised in this order:

| Lines (approx.) | Section | Real identifiers |
| --- | --- | --- |
| 1–9 | Document head, favicon, title | — |
| 10–690 | All CSS: tokens, HUD, overlays, loading, responsive, reduced motion | `#app`, `#hud`, `.card`, `#flash`, `#loading` |
| 691–707 | Canonical, Open Graph and Twitter metadata | — |
| 709–777 | DOM: canvas, vignette, HUD, look hint, zoom controls, menu, game over, flash, loading | `#scene`, `#score`, `#best`, `#menu`, `#gameover` |
| 779–785 | Import map | `three → cdn.jsdelivr.net/npm/three@0.169.0` |
| 787–2321 | Game module | see below |

The module itself is sectioned by comment banners:

| Section | Responsibilities |
| --- | --- |
| Boot | `loadingEl`, `await import("three")`, DOM cache, storage constants, `readBest`, `readSound` |
| World | sky shader, `HemisphereLight`, `AmbientLight`, `DirectionalLight`, clouds, ground, grid, runway, pylons, particles |
| Bird | `body`, `belly`, crest, `makeEye`, `beak`, wing pivots, `tail`, `birdGlow`, `birdLight` |
| Pipes | `makePipeTexture`, `spawnPipe`, `disposePipe`, `clearPipes`, `maybeSpawnPipe` |
| Audio | `makeNoiseBuffer`, `ensureAudio`, `playTone`, `playNoise`, `playFlap`, `playScore`, `playCrash`, `playStart` |
| HUD/state | `readBest`, `readSound`, `saveBest`, `setScore`, `showGameOver`, `crash`, `startGame`, `flap`, `handleAction` |
| Look | `dismissLookHint`, `updateZoomLabel`, `zoomBy`, `resetLook`, `flipView`, `updateLookFromKeys` |
| Update loop | `updateBird`, `updatePipes`, `updateWorld` |
| Input/lifecycle | key, pointer, wheel, button, visibility, resize listeners |
| Render loop | `animate`, `renderer.compile`, loading removal, `window.__flappy3d` |

`scripts/check.mjs` is release tooling only. The skill directory and `docs/` are never fetched by
the game. `state.json` / `STATE.md` are historical records.

## 2. Boot sequence

1. **Parse head.** CSS and metadata are static; no external stylesheet or font.
2. **Import Three.js.** The import map maps `"three"` to the pinned jsDelivr build. A top-level
   `await import("three")` runs before any scene code. On failure the loading overlay is replaced
   with “Three.js could not be loaded.” and the error is re-thrown.
3. **Cache DOM** into `canvas`, `scoreEl`, `bestEl`, `finalScoreEl`, `finalBestEl`, `newBestEl`,
   `menuEl`, `gameoverEl`, `flashEl`, `soundBtn`, `recenterBtn`, `flipViewBtn`, `lookHint`,
   `zoomInBtn`, `zoomOutBtn`, `zoomLevel`, `startBtn`, `restartBtn`.
4. **Load persistence.** `best = readBest()` and `soundOn = readSound()`.
5. **Create renderer** inside `try/catch`. Failure shows a WebGL error card. Settings: antialias,
   high-performance, DPR capped at 2, `PCFSoftShadowMap`, sRGB output, ACES tone mapping with
   exposure 1.16.
6. **Create scene/camera.** Fog `0x9ac9e8` from 55 to 195; `PerspectiveCamera(62, aspect, 0.1, 340)`
   initially at `(0.7, 3.4, 9.5)` and overwritten by the rig every frame.
7. **Build the world.** Sky sphere radius 290 with a three-colour gradient shader; hemisphere,
   ambient and shadow-casting directional light; 11 procedural clouds; ground plane at
   `GROUND_Y = -4.6`; grid; runway; 18 pylons; 230 speed particles.
8. **Build the bird** at `(0, 0.15, 0)`, including two wing pivots and a point light.
9. **Create pipe assets** once: canvas texture, body material, cap material, gap glow material.
10. **Wire UI and input**; set initial HUD text, sound icon and zoom label.
11. **`renderer.compile(scene, camera)`**, then `animate()`, then remove the loading overlay after
    the first frame plus a 700 ms fade.
12. **Expose `window.__flappy3d`** for manual smoke tests.

## 3. Data flow

```text
Space / click / tap / second finger
        │
        ▼
   handleAction() ── menu ──▶ startGame()
        │                 ├─ phase="playing", score=0, speed=14
        │                 ├─ clearPipes(); spawnPipe(-46, 0.5); spawnPipe(-73); spawnPipe(-100)
        │                 └─ maybeSpawnPipe()
        ├── playing ─────▶ flap()  → birdVelocity = 8.4; playFlap()
        └── over ────────▶ startGame() only when overTimer > 0.68
```

```text
requestAnimationFrame
        │  delta = min(clock.getDelta(), 0.05); elapsed += delta
        ├─ updateBird(delta)   phase-dependent physics, tilt, wings, glow
        ├─ updatePipes(delta)  speed curve, move cull, score, spawn, collision, ground guard
        ├─ updateWorld(delta)  clouds, pylons, particles, grid, look damping, camera rig, shake, over-timer
        └─ renderer.render(scene, camera)
```

`crash()` is the single entry to the over state. It sets `phase = "over"`, resets `overTimer`,
sets `crashShake = 1`, ensures the bird keeps a small upward velocity (`max(v, 2.2)`), calls
`saveBest()`, plays the crash sound, replays the CSS hit flash, and vibrates the device when
`navigator.vibrate` exists. `showGameOver()` runs from `updateWorld()` once `overTimer > 0.58`;
`handleAction()` refuses to restart until `overTimer > 0.68`, so the card appears before the
restart window opens.

## 4. Physics pipeline

Every frame in the playing phase (`updateBird`):

```text
birdVelocity += -25 * delta
bird.position.y += birdVelocity * delta

if y > 5.2   → y = 5.2;   v = min(0, v)       // ceiling, no crash
if y < -4.05 → y = -4.05; crash()              // floor bound
tilt = clamp(v * 0.045, -0.48, 0.58)
bird.rotation.x = damp(bird.rotation.x, tilt, 9, delta)
bird.rotation.z = sin(elapsed * 2.2) * 0.035
```

- Flight is **semi-implicit Euler** (`v` first, then `y`) with gravity `-25` and flap velocity
  `8.4`. A flap replaces velocity atomically; holding does nothing because only `keydown` with
  `event.repeat === false` calls `handleAction()`.
- The continuous-time jump peak is `8.4² / (2 · 25) = 1.4112` units above the flap point, reached
  in `0.336 s`; the round trip is `0.672 s`. The 50 ms delta clamp makes the discrete arc slightly
  shorter on slow frames but keeps it deterministic enough to play.
- In the menu the bird bobs: `y = 0.28 + sin(elapsed * 1.8) * 0.3`, with a damped x tilt.
- After a crash the bird keeps falling at `0.82 ×` gravity and tumbles (`rotation.x += 2.6·dt`,
  `rotation.z += 5.2·dt`) until it rests at `GROUND_Y - 0.6 = -5.2`.
- Wings share `wingPhase`; speed is 18 rad/s playing, 5.5 menu, 7 over. `leftWingPivot.rotation.z`
  is `-0.15 - sin(phase)·0.82`; the right is mirrored. Bird glow opacity follows `|v|` while playing.

## 5. Pipe spawning, scoring and collision

`startGame()` seeds `(-46, gap 0.5)`, `-73`, `-100`, then calls `maybeSpawnPipe()` once, which adds
the first procedural pipe at `-121` at score 0.

`spawnPipe(z, forcedGapCenter = null)`:

```text
gapHeight = max(3.08, 3.66 - state.score * 0.012)
gapCenter = forcedGapCenter ?? randFloat(-0.7, 1.7)
gapTop    = gapCenter + gapHeight / 2
gapBottom = gapCenter - gapHeight / 2
topHeight    = 14 - gapTop          // top cylinder reaches y = 14
bottomHeight = gapBottom - (-7)     // bottom cylinder reaches y = -7
```

Each group holds two cylinders radius `1.05`, two cap rings radius `1.14` and height `0.2` at the
gap edges, and one additive glow sprite scaled 4.2. `userData` stores `gapCenter`, `gapHeight`,
the two body meshes, two `Box3` instances and `passed`.

`maybeSpawnPipe()` keeps exactly one lead pipe far ahead:

```text
spacing = max(21, state.speed * 1.45)
if no pipes or last.z > -168 + spacing:
    spawnPipe((last ? last.z : -58) - spacing)
```

At the initial speed of 14 the threshold is `-147` and the spacing is 21; because the seed pipes
end at -100, the first call already appends a pipe. As speed rises, spacing grows up to
`24 × 1.45 = 34.8`, so the time between gaps stays near 1.45–1.5 s while the world moves faster.

`updatePipes()` while playing:

1. `state.speed = min(24, 14 + score * 0.3)`.
2. Move every pipe by `speed * delta` on +z.
3. First time a pipe crosses `z > 1.4`, set `userData.passed`, increment score, pop the HUD, play
   the score tone.
4. Dispose pipes (geometry only; materials are shared) once `z > 14`, then splice them out. The
   default camera sits at z ≈ 9.5, but at maximum zoom-out it retreats to z ≈ 17.3, so the cull
   is slightly in front of the viewer at that extreme.
5. Call `maybeSpawnPipe()`.
6. Build the bird AABB (`0.95 × 0.72 × 1.05`) and test only pipes with `|z| < 4.4`. Each body's
   `Box3` is recomputed from world matrices and expanded by `0.1`. Any intersection calls `crash()`.
7. Ground guard: if `bird.y - 0.36 < GROUND_Y + 0.14` (`y < -4.1`), call `crash()`.

**Invariant:** the score is awarded when the pipe passes the bird plane, not when the gap is
entered, and a pipe can only score once. Because the floor bound `-4.05` trips first, the ground
guard is a backstop rather than the usual death path.

## 6. Camera and look system

Look state lives in the `look` object: `yaw`, `pitch`, `zoom`, their targets, drag bookkeeping and
`hintDismissed`. Constants:

| Constant | Value | Meaning |
| --- | --- | --- |
| `LOOK_YAW_LIMIT` | `π` | full orbit |
| `LOOK_PITCH_LIMIT` | `0.55` | ±31.5° |
| `LOOK_SIDE_YAW` | `π/2` | side profile for flip |
| `LOOK_DRAG_YAW` | `0.0035` rad/px | horizontal drag |
| `LOOK_DRAG_PITCH` | `0.003` rad/px | vertical drag |
| `LOOK_KEY_YAW` | `1.7` rad/s | arrow-key yaw |
| `LOOK_KEY_PITCH` | `1.15` rad/s | arrow-key pitch |
| `ZOOM_MIN` / `ZOOM_MAX` / `ZOOM_STEP` | `0.55` / `1.8` / `0.12` | zoom target range and button step |

Input rules:

- Drag begins on `pointerdown` unless the target is a button or (for a mouse) not the primary
  button. The first pointer owns the drag; a second pointer while dragging calls `handleAction()`,
  which is how touch players look and flap at once.
- Movement past 6 px marks the gesture as a drag and dismisses the hint. Drag applies incremental
  deltas to `targetYaw` / `targetPitch`; releasing without movement calls `handleAction()`.
- Arrow keys accumulate in `lookKeys` and are applied per frame by `updateLookFromKeys(delta)`.
- `F` / flip button: if `|targetYaw - π/2| < 0.35`, target `-π/2`, else `+π/2`.
- `R` / crosshair: targets reset to yaw 0, pitch 0, zoom 1.
- Wheel: `amount = clamp(|deltaY| * 0.0015, 0.04, 0.18)`, sign follows scroll direction.

Every frame (`updateWorld`):

```text
yaw   = damp(yaw, targetYaw, 14, delta)
pitch = damp(pitch, targetPitch, 14, delta)
zoom  = damp(zoom, targetZoom, 11, delta)

scale  = 1 / zoom
orbitX = (0.7·cos(yaw) + 9.5·sin(yaw)) · scale
orbitZ = (-0.7·sin(yaw) + 9.5·cos(yaw)) · scale
focusY = 0.9 + bird.y · 0.32

camera.position = (orbitX + shakeX,
                   focusY + 2.45·scale + shakeY,
                   orbitZ + shakeZ)

d = 28 · scale
camera.lookAt(-sin(yaw)·d·cos(pitch),
              0.92 + bird.y·0.22 + sin(pitch)·d,
              -cos(yaw)·d·cos(pitch))
```

At `yaw = 0` the camera is at `(0.7, focusY + 2.45, 9.5)` looking toward `-z`: the chase view. At
`yaw = -π/2` it sits on the left, at `+π/2` on the right, and at `±π` in front of the bird.
`zoom` multiplies apparent size by inverting all rig distances, so 1.8 is close and 0.55 is far.
Crash shake is a random offset of up to `0.34` units decaying at `1.7/s`.

## 7. World pipeline

- Clouds drift +z at `userData.speed + worldSpeed * 0.14`, sway in x, bob in y; at `z > 22` they
  respawn between `z = -195` and the sky band. `worldSpeed` is `state.speed` while playing, `0.7`
  over, `1.7` in the menu.
- 18 pylons alternate sides at x = ±8.8; when `z > 18` they jump back by 216 so the row tiles
  forever.
- 230 particles move +z at `5 + worldSpeed * 0.7`; past `z = 14` they respawn between `-165` and
  `-185`. Positions are written into the buffer and flagged `needsUpdate`.
- The grid scrolls with `z = -112 + ((elapsed * (4 + worldSpeed * 0.35)) % 2.82)` — 2.82 is the
  grid cell size (`350 / 124`), so the pattern appears continuous.
- Fog, sky sphere and sun sprite are static; only the camera moves.

## 8. Rendering settings

| Setting | Value |
| --- | --- |
| Pixel ratio | `min(devicePixelRatio, 2)` |
| Shadows | `PCFSoftShadowMap`, 2048² map, bias `-0.00045`, normalBias `0.035` |
| Tone mapping | `ACESFilmicToneMapping`, exposure 1.16 |
| Output | `SRGBColorSpace` |
| Camera | 62° vertical FOV, near 0.1, far 340 |
| Fog | `Fog(0x9ac9e8, 55, 195)` |
| Resize | updates aspect, projection matrix, DPR and size |

All pipe materials and the glow texture are shared; `disposePipe()` disposes only per-pipe
geometries. Clouds share one puff geometry and one material for the same reason.

## 9. Audio pipeline

`ensureAudio()` is called from `handleAction()`, `toggleSound()` and every sound helper. It creates
one `AudioContext` (with `webkitAudioContext` fallback), one master gain (0.62 when on, 0 when off),
and one 0.6 s white-noise buffer. A suspended context is resumed. `playTone()` schedules an
oscillator with an exponential frequency ramp and a 12 ms attack / duration release; `playNoise()`
schedules a buffer source through a low-pass filter ramping to 120 Hz.

| Cue | Recipe |
| --- | --- |
| Flap | triangle 390→760 Hz, 0.1 s, gain 0.075; sine 180→120 Hz, 0.08 s, delay 0.01 |
| Score | square 880 Hz 0.07 s; square 1320 Hz 0.09 s at 0.075; sine 1760 Hz 0.11 s at 0.15 |
| Crash | noise 0.52 s, gain 0.2, filter 760 Hz; sawtooth 190→38 Hz; square 92→28 Hz |
| Start | triangle arpeggio C5–E5–G5–C6 at 0.085 s spacing |

Muting ramps the master gain to 0 over 80 ms, writes `flappy3d.sound`, and swaps the 🔊/🔇 icon.

## 10. State and persistence schema

```js
state = {
  phase: "menu" | "playing" | "over",
  score: number,
  speed: number,
  overTimer: number,
  gameOverShown: boolean,
  crashShake: number,
  newBest: boolean
}

look = {
  yaw, pitch, targetYaw, targetPitch,
  zoom, targetZoom,
  dragging, pointerId, startX, startY, lastX, lastY, moved, hintDismissed
}

// module-scope mutable game values
best, soundOn, birdVelocity, wingPhase, elapsed
```

`localStorage` schema:

```text
flappy3d.best   "42"      // integer string; Number(), floor, > 0
flappy3d.sound  "on"|"off"
```

Both reads and writes are `try/catch`-guarded because private browsing and `file://` can throw or
hide storage. There is no versioning and no migration; malformed values fall back to `0` / sound on.

## 11. Extension points

- **New obstacle type:** add a factory beside `spawnPipe()`, push a group into `pipes` with the same
  `userData` contract (`passed`, boxes), and extend the collision loop. Keep the +z motion and the
  `z > 14` cull.
- **New scoring rule:** change the `z > 1.4` crossing in `updatePipes()`; keep the `passed` flag so
  one obstacle scores once.
- **New input:** call `handleAction()` for anything that should start/flap/restart, and update
  `look.targetYaw` / `targetPitch` / `targetZoom` for camera changes so damping still applies.
- **New difficulty knob:** `state.speed` and `gapHeight` are the only two curves; both are clamped,
  and `spacing` follows speed. Change them together and re-measure the cadence.
- **New visual layer:** follow the shared-geometry/material pattern and add motion in `updateWorld()`.
- **New persistence:** add a `flappy3d.*` key, read it through a guarded helper, and document the
  shape in this file and in `AGENTS.md`.
