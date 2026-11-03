# Lessons — bugs, dead ends and regression traps

Everything here comes from the build session or from reading the released source. Where a bug was
environmental rather than product, it is labelled.

## 1. Bugs that actually occurred

### Favicon 404 on every load

The first headless pass logged `Failed to load resource: 404 (File not found)` for
`http://127.0.0.1:8123/favicon.ico`, twice. It did not break the game, but it polluted the console
and made “zero errors” impossible to claim. **Fix:** an inline SVG data URI as the icon. There is
no `favicon.ico` file and no favicon request. If you strip the `<link rel="icon">`, the error
returns in Chrome.

### Headless Chrome display-link noise

`CVDisplayLinkCreateWithCGDisplay failed` appeared many times in headless Chrome output on macOS.
It is a host/driver message, not an app error, and does not appear in the page console. Do not
“fix” the game for it. Use CDP `Runtime.exceptionThrown` and `Log.entryAdded` to judge page health,
not the browser process stderr.

### Network 404s in the console were the favicon only

When auditing errors, filter by URL before assuming a game asset is missing. The release loads
only Three.js from the network; any other 404 is a real packaging problem.

### Programmatic crash logs a vibrate warning

Calling `window.__flappy3d.crash()` from CDP without a preceding gesture makes Chrome log
“Blocked call to navigator.vibrate because user hasn't tapped…”. The call is feature-detected and
works in real play after a keypress or tap. Do not remove vibration to make automation quieter;
filter the message instead.

## 2. Requirements that changed the design

### Fixed chase camera → free look

The original brief asked for a camera behind the bird looking down the corridor. The user then
asked to “tilt the scene however they want left right up down”. A fixed position plus a small
look offset was not enough. **Resolution:** the `look` target object and the per-frame damped rig
replaced the fixed camera. Lesson: if a camera is described as “behind the bird”, still keep the
rig parametric; a later request for look-around will arrive.

### Free look → explicit flip

Free look alone lets a player rotate 180° to the front, but it is slow and disorienting during
play. The user asked to flip left/right. **Resolution:** `flipView()` toggles the yaw target
between +π/2 and −π/2 (side profiles), not ±π. A 180° spin would be the front view and would put
the corridor behind the camera. Keep the `|targetYaw − π/2| < 0.35` test so pressing flip while
already near the right side goes left rather than getting stuck.

### No zoom → rig scaling

The user asked for zoom after flip. Changing camera FOV would alter perspective and pipe
readability; dollying the camera changes composition. **Resolution:** `zoomScale = 1 / look.zoom`
multiplies every rig offset and the look distance. At 1.8 the camera is close; at 0.55 it is far.
The FOV stays 62°. Do not switch to FOV zoom without re-testing the corridor framing.

## 3. Dead ends avoided (design decisions, not all tried)

- **Separate CSS/JS files.** More maintainable in the abstract, but it breaks the one-file product
  promise. Rejected. Tooling and docs carry the maintainability instead.
- **Making the game fully offline.** Tempting because it is one file, but vendoring Three.js
  (~1 MB) into the HTML was rejected: the brief explicitly says CDN, and the loading/error cards
  handle failure. Do not claim offline support.
- **Pixel-exact pipe collision.** Cap rings, cylinder curvature and a fast bird make exact meshes
  expensive and harsh. The expanded AABB is deliberately forgiving; players read it as fair.
- **A 180° “flip”.** Rejected as disorienting; ±π/2 side views are the product.
- **Continuous flap from a held key.** `event.repeat` is ignored, so one press is one flap.
  Allowing repeat would trivialize the game. Keep the guard.
- **Saving the best score continuously.** The release writes only on crash when the score beats
  the record. That avoids storage churn and keeps the “New Best!” moment meaningful.

## 4. Regression traps

| Change | What breaks |
| --- | --- |
| Flip a z sign in `updatePipes` / `spawnPipe` | pipes recede, score never fires, collision window is empty |
| Set `camera.position` outside `updateWorld` | overwritten next frame; the change appears to do nothing |
| Raise the delta cap or remove it | bird tunnels through pipes after a stall; physics becomes frame-dependent |
| Lower `BIRD_MIN_Y` below the ground plane | bird visibly enters the ground; the backstop fires late |
| Seed one pipe instead of three | first seconds are empty; the spawner only maintains a far lead pipe |
| Remove `userData.passed` | score climbs every frame while a pipe is past the plane |
| Change `gapHeight` without the bird box | gaps can become smaller than the bird, making runs impossible |
| Remove the 4.4 z window | collision runs on every pipe every frame; cost rises and far pipes can false-positive |
| Create `AudioContext` at boot | browser autoplay policy suspends it; first cue is silent |
| Skip `try/catch` on storage | private browsing / `file://` can throw and stop the module |
| Forget to update the skill template | `scripts/check.mjs` fails on byte inequality |
| Add a second external request | violates the “only Three.js” network rule and risks a stalled loader |
| Change Three.js version without retesting | tone mapping, color space or shadow bias can shift the look |
| Change the OG/canonical URL when renaming | social cards and canonical links point at the old site |

## 5. Verification lessons

- **A static check is not a playtest.** `node scripts/check.mjs` proves links, syntax and file
  presence. It cannot see a black WebGL canvas.
- **Headless screenshots need SwiftShader** on a machine without a GPU:
  `--enable-unsafe-swiftshader --use-angle=swiftshader`. Without it the canvas may be blank.
- **`requestAnimationFrame` stops in background tabs.** A CDP run against a hidden window appears
  frozen. Keep the page visible and use the debug handle (`window.__flappy3d`) to start or flap.
- **Check the page console, not the browser stderr.** Host noise (display link, web-app install)
  is not an app failure.
- **Emulated mobile is not a phone.** Touch, safe areas, vibration and performance remain
  unverified until tested on hardware.
- **Test restart timing explicitly.** Restart is ignored for the first 0.68 s after a crash; an
  automated tap that is too early looks like a broken button.
- **Test zoom clamps at both ends.** A single wheel step only proves the target moves, not that
  0.55/1.8 hold.
