#!/usr/bin/env bash
# Build the app and publish app/dist/ to the gh-pages branch of `origin`.
# Dependency-free: a throwaway git repo inside the (gitignored) build output is
# force-pushed, so gh-pages holds only the artifact, never source history.
#
# The published site is the PUBLIC, read-only family tree. To edit it, open the
# deployed URL with ?edit=<key> appended (see README) — that unlock never ships
# in the link you share.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/app"

REMOTE=$(git -C "$ROOT" remote get-url origin)
echo "→ building…"
npm run build

echo "→ publishing app/dist/ to gh-pages on ${REMOTE}…"
cd dist
touch .nojekyll            # let GitHub Pages serve files/dirs starting with _
git init -q
git checkout -q -b gh-pages
git add -A
git commit -qm "deploy $(date -u +%FT%TZ)"
git push -f "$REMOTE" gh-pages
rm -rf .git               # leave dist/ a plain build folder again
echo "✓ deployed."
