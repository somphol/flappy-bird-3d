# Verification

Run these in order. A green static run is necessary, not sufficient: the game needs a browser for
physics, camera, storage and audio.

## 1. Static release check

```sh
cd ~/Projects/flappy-bird-3d
node scripts/check.mjs
```

Expected on success:

```text
OK <n> checks
```

Exit code 0. `<n>` is the number of assertions and changes when docs/files are added; do not pin
the number in CI, pin the exit code and the `OK` prefix. On failure it prints
`FAIL <reason>` per problem and exits 1.

What it covers: required release files, local `src`/`href` targets in `index.html`, relative
Markdown links in `README.md` / `AGENTS.md` / `docs/*.md` / `skills/**/*.md`, `node --check` on
every `.js` / `.mjs` file and on the extracted inline module, JSON parsing, and byte equality of
the skill template.

## 2. Byte equality and syntax

```sh
cmp index.html skills/flappy-bird-3d/assets/template/index.html   # no output, exit 0
node --check scripts/check.mjs                                     # no output, exit 0
```

The inline module cannot be checked directly with `node --check` because it is inside HTML;
`scripts/check.mjs` extracts it to a temporary `.mjs` and checks that.

## 3. Serve and smoke-test

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Open DevTools before loading. Expected:

| Step | Expected |
| --- | --- |
| Load | loader fades; menu card; best from previous storage; no console errors |
| `Space` | menu hides, start arpeggio, one flap |
| Hold `Space` | no repeat flaps |
| Wait | bird falls, red flash, crash cue, tumble, card after ~0.58 s |
| `Space` immediately after crash | ignored until 0.68 s, then new run at score 0 |
| Fly through one gap | score 1, pop animation, score cue |
| Reload | best score still shown |
| Drag | camera orbits; hint dismisses after >6 px |
| Arrow keys | continuous orbit; stops on release |
| `F` | yaw target switches between +π/2 and −π/2 |
| `R` | yaw 0, pitch 0, zoom label 100 % |
| Wheel up / `+` | zoom target rises, label increases, caps at 180 % |
| Wheel down / `−` | zoom target falls, caps at 55 % |
| Sound button | icon toggles; reload preserves it |
| 390×844 viewport | HUD/card/zoom controls fit; tap starts and flaps; second finger flaps mid-drag |

## 4. Headless browser check (optional, no repo dependency)

The release was smoke-tested with Chrome DevTools Protocol and SwiftShader. Recreate it with:

```sh
python3 -m http.server 8123 --bind 127.0.0.1 --directory ~/Projects/flappy-bird-3d
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/flappy-chrome \
  --disable-gpu --enable-unsafe-swiftshader --use-angle=swiftshader \
  --hide-scrollbars --window-size=1440,900 --force-device-scale-factor=1 \
  --no-first-run --no-default-browser-check about:blank
```

Connect over the CDP WebSocket to a new target for `http://127.0.0.1:8123/`, enable `Runtime`,
`Log` and `Page`, then evaluate:

```js
window.__flappy3d.state.phase          // "menu"
window.__flappy3d.start();             // -> "playing"
window.__flappy3d.score                // 0
window.__flappy3d.flap();
window.__flappy3d.look.targetYaw = Math.PI / 2;
window.__flappy3d.look.targetZoom = 1.8;
window.__flappy3d.crash();
```

Expected from the original run:

```text
menu:     {"phase":"menu","best":"1"}
playing:  {"phase":"playing","score":1,"y":1.56}
gameover: {"phase":"over","score":1,"visible":true}
restart:  {"phase":"playing","score":0}
zoom in:  {"zoom":1.18,"targetZoom":1.18,"label":"118%"}
zoom out: {"zoom":1,"targetZoom":1,"label":"100%"}
after R:  {"yaw":0,"zoom":1,"label":"100%"}
after F:  {"yaw":1.571,"targetYaw":1.571}   // then -1.571
errors:   0
```

Notes:

- Use a visible window; `requestAnimationFrame` pauses in background tabs.
- `--enable-unsafe-swiftshader --use-angle=swiftshader` avoids a blank canvas without a GPU.
- Count page errors from `Runtime.exceptionThrown` and `Log.entryAdded`; ignore host messages
  such as `CVDisplayLinkCreateWithCGDisplay failed`.
- A programmatic `window.__flappy3d.crash()` can log a Chrome error that `navigator.vibrate` was
  blocked for lack of a user gesture. That is a harness artefact; a real crash follows a tap or
  keypress. Do not remove the vibration to silence it.
- The favicon is a data URI, so there should be no `/favicon.ico` 404.

## 5. Behavioural assertions from the source

These can be checked by hand or with a small script; they are the invariants most likely to drift:

| Assertion | Expected |
| --- | --- |
| `GRAVITY` / `FLAP_VELOCITY` | `-25` / `8.4` |
| Jump apex (continuous) | `8.4² / 50 = 1.4112` units |
| Apex time / round trip | `0.336 s` / `0.672 s` |
| Delta cap | `0.05 s` |
| Gap at score 0 / 48 | `3.66` / `3.08` |
| Speed at score 0 / 34 | `14` / `24` |
| Spacing at score 0 / cap | `21` / `34.8` |
| Cadence | ~`1.45–1.5 s` |
| Score plane / cull plane | `z > 1.4` / `z > 14` |
| Collision window | `|z| < 4.4` |
| Bird box | `0.95 × 0.72 × 1.05` |
| Yaw / pitch clamp | `±π` / `±0.55` |
| Zoom clamp / step | `0.55–1.8` / `0.12` |
| Restart gate | `overTimer > 0.68` |
| Best key / sound key | `flappy3d.best` / `flappy3d.sound` |
| Sound default | on unless stored value is `"off"` |
| Best default | 0 unless a finite number > 0 |

## 6. Persistence checks

In DevTools console:

```js
localStorage.setItem("flappy3d.best", "7");
localStorage.setItem("flappy3d.sound", "off");
location.reload();
// menu best shows 7, sound icon is muted

localStorage.setItem("flappy3d.best", "not-a-number");
location.reload();
// menu best shows 0; the game still starts

localStorage.setItem("flappy3d.best", "-4");
location.reload();
// menu best shows 0
```

A record run writes `flappy3d.best` only after `crash()`. Reload to confirm.

## 7. Deployment check

```sh
for u in "" index.html docs/social-card.png sitemap.xml .nojekyll; do
  printf '%s ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://somphol.github.io/flappy-bird-3d/$u"
done
```

Expected: `200` for each. Then load the live URL and repeat the smoke test. Pages may serve a
cached HTML file for a few minutes after a push; hard-reload before debugging.

## 8. Failure boundaries

Stop and fix rather than declare success if any of these occur:

- `scripts/check.mjs` exits non-zero.
- The template differs from `index.html`.
- The menu appears but the canvas is black (WebGL/CDN failure).
- A pipe can be passed without score, or scores more than once.
- Restart works immediately after a crash (gate broken).
- Reload loses the best score when storage is available.
- A camera change has no effect (something else is overwriting the rig).
- The page has a console error other than a host/network message.
- The mobile layout scrolls or the HUD overlaps the card.
