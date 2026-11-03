# Attribution

## Origin

**Flappy Bird 3D** was built on **2026-10-31** as a single agent session: the game, scene,
HUD, audio, screenshots and first release were generated in one pass with **OpenCode 2.2.5**
driving **DeepSeek V4.1 Flash**. The public repository is
<https://github.com/somphol/flappy-bird-3d> and the live copy is
<https://somphol.github.io/flappy-bird-3d/>. The build record (duration, tokens, session id) is
kept in the repository as `state.json` / `STATE.md` and is historical only.

The project began from the user's brief: a complete, polished 3D Flappy Bird in a single
self-contained HTML file using HTML5, CSS3, vanilla JavaScript and Three.js via CDN, with a
chase camera, clouds and sunlight, flap/gravity physics, endless green cylinder pipes, bounding-box
collisions, a score HUD, synthesized audio, and a game-over loop with a `localStorage` high score.
Free-look, left/right flip and zoom were added as later user requests.

## What is original

- All game code, CSS, HTML, shaders, procedural canvas textures, particle/cloud/pylon layouts,
  bird geometry, camera rig and difficulty curves.
- All synthesized audio recipes (oscillator types, frequencies, envelopes, filter noise). No
  recorded sound files are used.
- The screenshots and social card were captured/generated for this project.
- The documentation and this skill were written from the source and the session record.

No art, audio, level data or code was copied from the original *Flappy Bird* or from another
Flappy clone. The name and the pipe-gap mechanic are genre references, not assets. The bird,
palette and scene are original low-poly work.

## Third-party components

| Component | Version | Licence | How it is used |
| --- | --- | --- | --- |
| [Three.js](https://threejs.org/) | `0.169.0` | MIT | Loaded at runtime from jsDelivr through the import map. No source is vendored. |
| System fonts | — | — | `"Avenir Next"`, `"Trebuchet MS"`, `"Segoe UI"`, `"Arial Black"`, `Impact` fall back to the OS; no webfont is loaded. |

There are no other runtime dependencies, no build tools, no analytics and no image or audio
assets beyond the two screenshots and the social card.

## Licence status

The repository is released under the **MIT licence** (see `LICENSE`). The skill contents —
`SKILL.md`, this attribution, the reference notes and the template copy of `index.html` — are
covered by the same MIT licence. Three.js remains under its own MIT licence and is not
relicensed here.

The template file `assets/template/index.html` is byte-identical to the release `index.html`; it
is included so the skill can reproduce the real game, not a simplified imitation. The release
has no separate `style.css` or `script.js` — CSS and JavaScript are inline — so `index.html` is
the only file in the template.

## Maintenance

If you reuse the template, keep this attribution with the skill and keep the Three.js version and
licence notice accurate. If you replace the CDN with a vendored Three.js build, add its licence
file to your repository.
