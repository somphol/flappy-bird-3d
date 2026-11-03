# Deployment

The game is a static page. Deployment is a push to `main`; GitHub Pages serves the repository
root. There is no build artifact, no Actions workflow required for the site, and no server.

## 1. Live site

| Item | Value |
| --- | --- |
| URL | <https://somphol.github.io/flappy-bird-3d/> |
| Index | <https://somphol.github.io/flappy-bird-3d/index.html> |
| Social card | <https://somphol.github.io/flappy-bird-3d/docs/social-card.png> |
| Sitemap | <https://somphol.github.io/flappy-bird-3d/sitemap.xml> |
| Repository | <https://github.com/somphol/flappy-bird-3d> |
| Owner / repo | `somphol/flappy-bird-3d` |
| Default branch | `main` |
| Source | branch `main`, folder `/` (root) |
| Custom domain | none (`*.github.io`) |
| HTTPS | GitHub-managed certificate, enforced |

Last availability check (before the documentation push): the five URLs `/`, `/index.html`,
`/docs/social-card.png`, `/sitemap.xml` and `/.nojekyll` all returned HTTP 200.

## 2. What is published

Pages publishes the entire repository root, not a build directory. That means:

- `index.html` is the site root.
- `docs/social-card.png` is served because `docs/` is a normal folder; `.nojekyll` is present so
  Jekyll does not process or hide anything.
- `README.md`, `AGENTS.md`, `docs/*.md`, `state.json`, `STATE.md`, screenshots, `LICENSE` and the
  skill directory are publicly readable. Nothing secret is committed.
- `scripts/check.mjs` is served as a text file; it is tooling, not part of the game.
- `sitemap.xml` and `robots.txt` point crawlers at the root URL.

If a path must **not** be published, do not rely on `.gitignore` (that only affects git). Move it
out of the repository or change Pages to serve from `/docs` — the latter would require moving
`index.html`, which is not recommended.

## 3. GitHub Pages settings

In **Settings → Pages**:

| Setting | Value |
| --- | --- |
| Source | Deploy from a branch |
| Branch | `main` |
| Folder | `/ (root)` |
| Custom domain | empty |
| Enforce HTTPS | on |

`.nojekyll` at the root is required for predictable static serving. Do not delete it. There is no
`CNAME` file because there is no custom domain.

## 4. Deploy

```bash
cd ~/Projects/flappy-bird-3d
node scripts/check.mjs
git add -A
git commit -m "docs: add release documentation, reproduction book and skill"
git push origin main
```

A push to `main` triggers the Pages build automatically (typically under a minute). Watch it under
**Actions → pages build and deployment** or the repository’s Environments tab. No manual “deploy”
button is needed with branch-based publishing.

Rules:

- **Never force-push `main`.** Pages serves whatever is on the branch; history is the rollback.
- **Keep the site buildable at every commit.** `index.html` must remain at the root and the
  Three.js import map must stay valid.
- **One documentation commit** for this release; do not mix app changes into it.

## 5. Verify a deployment

```bash
# 200 and the expected title
curl -sI https://somphol.github.io/flappy-bird-3d/ | head -5
curl -s https://somphol.github.io/flappy-bird-3d/ | grep -o '<title>[^<]*</title>'

# assets
for u in index.html docs/social-card.png sitemap.xml .nojekyll; do
  printf '%s ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://somphol.github.io/flappy-bird-3d/$u"
done
```

Expected: `200` for each; title `Flappy Bird 3D`. Then open the URL in a browser and confirm the
menu renders, Space starts a run, and the console has no errors.

Caching: GitHub Pages serves through a CDN with a short default cache (roughly 10 minutes for
HTML). After a push, a browser may show the previous `index.html`; hard-reload or append a query
string. There are no custom `Cache-Control` headers because there is no server configuration.

## 6. Rollback

Because every deploy is a commit on `main`, rollback is a normal revert:

```bash
cd ~/Projects/flappy-bird-3d
git log --oneline -10
git revert <bad-commit>        # creates a forward revert commit
git push origin main
```

For an urgent rollback, `git revert` is preferred over `git reset --hard` + force-push because it
keeps the public history linear and avoids a broken Pages cache for a commit that no longer exists.
Alternatively, restore `index.html` from the last known-good commit and push a normal fix.

If Pages itself is misconfigured, re-apply the settings in §3; no rebuild script is involved.

## 7. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| 404 at the root | Pages source not `main` / root, or deploy still running | check Settings → Pages and the Pages build log; wait for the build |
| Old page after push | CDN/browser cache | hard-reload; check the commit SHA shown in the Pages build |
| `docs/social-card.png` 404 | `.nojekyll` missing or `docs/` renamed | restore `.nojekyll`; keep `docs/social-card.png` |
| Blank page, “Three.js could not be loaded.” | CDN blocked or offline | check `cdn.jsdelivr.net` reachability; the message is intentional |
| Blank page, “WebGL could not start.” | hardware acceleration disabled | enable WebGL / try another browser |
| Game loads but no sound | first gesture not yet made, or muted | click once; check the 🔊 button and `flappy3d.sound` |
| Best score does not persist | private browsing or blocked storage | expected degradation; storage is `try/catch`-guarded |
| Fonts/layout look different | system font stack by design | no webfonts are loaded |
| Pages build fails | invalid symlink or submodule | check the build log; the repo needs no submodules |

## 8. Post-deploy checklist

1. `node scripts/check.mjs` exits 0 locally.
2. `git status` is clean and the commit is on `main`.
3. The Pages build for that SHA is green.
4. `/`, `/index.html`, `/docs/social-card.png`, `/sitemap.xml`, `/.nojekyll` return 200.
5. The live page renders the menu; Space starts; a crash shows the card; reload keeps the best.
6. The Open Graph image resolves at the absolute URL in `index.html` (social debuggers cache it).
7. Record the commit hash in the release report; do not edit `state.json` just for a docs push.
