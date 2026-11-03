# Testing

This document separates what was **run** from what was **reasoned** and what is **not verified**.
No test result here is aspirational. The game is a visual, audio, real-time app, so most of its
behaviour is manual by nature.

## 1. What `node scripts/check.mjs` verifies

Run from the repository root:

```bash
node scripts/check.mjs
```

It is dependency-free (Node built-ins only) and makes no network requests. It checks:

| Group | Checks |
| --- | --- |
| Required release files | `index.html`, `README.md`, `AGENTS.md`, `LICENSE`, `.nojekyll`, `docs/ARCHITECTURE.md`, `docs/REPRODUCTION.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/social-card.png`, `sitemap.xml`, `robots.txt`, `state.json`, `scripts/check.mjs`, skill files (`SKILL.md`, `ATTRIBUTION.md`, three references, template) |
| Local HTML references | every `src` / `href` / `og:image`-style local path in `index.html` that is not `http(s)`, `data:`, `#` or `mailto:` resolves to a file |
| Markdown links | every relative link in `README.md`, `AGENTS.md` and each `docs/*.md` resolves (anchors stripped) |
| JavaScript syntax | `node --check` on every `.js` / `.mjs` file, plus the inline module extracted from `index.html` into a temp `.mjs` |
| JSON | every repo-root `*.json` (currently `state.json`) parses |
| Skill template | `skills/flappy-bird-3d/assets/template/index.html` is byte-identical to `index.html` |

Expected output ends with `OK <n> checks` and exit code 0. On failure it prints one `FAIL ...`
line per problem and exits 1.

**What it does not do:** start a browser, import Three.js, render a frame, simulate physics, use
`localStorage`, or make sound.

## 2. What was actually run

### 2.1 Release documentation pass (this change)

| Test | Where | Result |
| --- | --- | --- |
| `node scripts/check.mjs` | local repository | **passed** — `OK 64 checks`, exit 0 |
| `node --check` on the extracted inline module | inside `check.mjs` | **passed** |
| Relative-link resolution for all new docs | inside `check.mjs` | **passed** |
| Template byte equality (`cmp`) | inside `check.mjs` | **passed** |
| Skill validator (`check-skill.mjs`) | local skill directory | **passed** — `OK flappy-bird-3d`, 6 files |
| Headless Chrome smoke test at 1440×900 | CDP, SwiftShader, current source | **passed** — menu/playing/over/restart, zoom 118 %, flip yaw 1.571, reset 100 %, best persisted as 7 |
| Headless scoring run | CDP auto-flap for 9 s | **passed** — `score: 1`, still playing; best stays unwritten until a crash, as designed |
| `file://` load in Chrome | CDP against `file:///…/index.html` | **passed** — `phase: "menu"`, canvas sized, 0 page errors |
| Live Pages availability: `/`, `/index.html`, `/docs/social-card.png`, `/sitemap.xml`, `/.nojekyll` | `curl` to `somphol.github.io` | **200** for all five before the docs push |

The headless smoke test logged one non-game message when `crash()` was called programmatically:
Chrome blocked `navigator.vibrate` because there had been no user gesture. In real play the crash
is always gesture-initiated; the call is guarded by `if (navigator.vibrate)`. Treat this as a
harness artefact, not an app error, and do not “fix” it by removing the vibration.

### 2.2 Original build session (2026-10-31, recorded in the transcript)

These were run against the app before this documentation commit and are recorded here as
historical evidence, not re-run as part of the docs change:

| Test | Method | Result |
| --- | --- | --- |
| Desktop render at 1440×900 | headless Chrome + CDP, SwiftShader | menu, playing and game-over screenshots captured |
| Mobile layout at 390×844 | headless Chrome + CDP | menu and playing screenshots captured |
| Start via keyboard | `Runtime.evaluate` + `Input.dispatchKeyEvent` | `phase: "playing"`, score 1 after play |
| Crash and game over | let the bird fall | `phase: "over"`, overlay visible |
| Restart | action after the delay | `phase: "playing"`, score 0 |
| Best-score persistence | pre-seeded `localStorage`, then reload | `best: "1"` shown on the menu |
| Console errors | CDP `Runtime.exceptionThrown` + `Log.entryAdded` | `errors: 0` after the favicon fix |
| Free-look, flip and zoom passes | CDP interaction scripts | zero JS errors in each pass |

The transcript also shows an early favicon 404 (`/favicon.ico`), fixed by the inline SVG data URI.

## 3. Manual test matrix

Use this after any change. “Verified” means it was observed in a browser; “reasoned” means it
follows from the source but was not exercised in this pass; “not verified” means no evidence.

### Desktop (Chrome, 1440×900)

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| D1 | Load page | loader fades within ~1 s; menu card; best from storage | verified (build session) |
| D2 | `Space` on menu | game starts, start arpeggio, no page scroll | verified (build session) |
| D3 | Hold `Space` | one flap only; no repeat flaps | reasoned (`event.repeat` guard) |
| D4 | Click canvas | flap; click after crash restarts only after 0.68 s | reasoned |
| D5 | Drag canvas | yaw/pitch follow; cursor changes to grabbing | verified (build session) |
| D6 | Arrow keys | continuous look; stops on keyup | verified (build session) |
| D7 | `F` / flip button | toggles left and right side views | verified (build session) |
| D8 | `R` / crosshair | yaw 0, pitch 0, zoom 100 % | verified (build session) |
| D9 | Wheel / `+` / `−` | zoom clamps at 55 % and 180 % | verified (build session) |
| D10 | Fly through a gap | score +1, pop animation, score tone | verified (build session) |
| D11 | Hit pipe | flash, crash sound, shake, tumble, game-over card | verified (build session) |
| D12 | Hit ground | same as D11 | verified (build session) |
| D13 | New best | “New Best!” badge; value survives reload | verified (build session) |
| D14 | Mute, reload | icon and mute state persist | reasoned (same storage pattern) |
| D15 | Resize window | canvas and aspect update, HUD stays aligned | reasoned |

### Mobile / touch (390×844 emulation)

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| M1 | Load | HUD and card fit; no horizontal scroll | verified (headless emulation) |
| M2 | Tap | starts / flaps | verified (headless emulation) |
| M3 | Drag | orbits; hint dismisses after movement | verified (headless emulation) |
| M4 | Second finger while dragging | flaps without cancelling look | reasoned (pointer logic) |
| M5 | `+` / `−` buttons | zoom and update percentage | reasoned |
| M6 | Safe areas (notch) | HUD uses `env(safe-area-inset-*)` | not verified on a real device |
| M7 | Vibration on crash | short triple pulse where supported | not verified |

### Persistence and failure modes

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| P1 | `localStorage` blocked | game plays; best 0; sound defaults on | reasoned (`try/catch` only) |
| P2 | Corrupt `flappy3d.best` (`"abc"`, `"-3"`) | falls back to 0 | reasoned (`Number.isFinite && > 0`) |
| P3 | `flappy3d.sound = "off"` | starts muted | reasoned |
| P4 | Three.js CDN unreachable | error card, not a blank page | reasoned (`try/catch` around import) |
| P5 | WebGL unavailable | WebGL error card | reasoned (`try/catch` around renderer) |
| P6 | Tab hidden mid-run | rendering pauses; no catch-up on return | reasoned (`visibilitychange` discards delta) |

## 4. Known gaps

- **No automated gameplay suite.** Physics, scoring, collision and camera behaviour have no
  assertions. A headless CDP harness existed in the build session but was not kept in the repo.
- **No audio test.** The graph and envelopes are unverified by ear in automation.
- **No real-device mobile test.** Headless viewport emulation does not prove touch, safe areas,
  vibration or performance.
- **No Safari/Firefox run.** Import maps and WebGL are the risk areas; both should work in current
  versions but are unverified.
- **No performance budget.** 230 particles, 2048² shadows and DPR 2 are assumed acceptable on
  desktop; low-end mobile frame rate was not measured.
- **No accessibility audit.** `aria-live`, labels, focus-visible styles and reduced-motion CSS
  exist, but the canvas game has no non-visual equivalent and buttons use glyphs.
- **The check script is static.** A green run proves files, links, syntax, JSON and template
  equality — not that the game is fun or even renderable.

## 5. Quick regression commands

```bash
cd ~/Projects/flappy-bird-3d
node scripts/check.mjs
cmp index.html skills/flappy-bird-3d/assets/template/index.html
python3 -m http.server 8000
```

If you change a constant listed in [ARCHITECTURE](ARCHITECTURE.md) §4–6, replay at least D2,
D5, D8, D10, D11 and D13, then update [REPRODUCTION](REPRODUCTION.md) §7.
