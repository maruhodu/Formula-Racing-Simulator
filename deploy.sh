#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy.sh — Formula Racing Simulator GitHub Pages Deploy
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./deploy.sh           — stage, commit, and push to gh-pages
#   ./deploy.sh --dry-run — show what would happen without changing anything
#
# Safety features:
#   • set -euo pipefail   — exits immediately on any error / unset variable
#   • Explicit file list  — only known source files are staged (no accidental
#                           .env, secrets, or editor artefacts)
#   • Secret guard        — aborts if common secret files are found in the tree
#   • --force-with-lease  — refuses to overwrite commits we haven't seen
#                           (unlike --force, which destroys unknown remote work)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_URL="https://github.com/maruhodu/Formula-Racing-Simulator"
BRANCH="gh-pages"
DRY_RUN=false

# ── Flags ──────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if $DRY_RUN; then
  echo "🔍 DRY-RUN mode — no git commands will execute."
  run() { echo "  [dry-run] $*"; }
else
  run() { "$@"; }
fi

# ── Secret guard ───────────────────────────────────────────────────────────────
# Abort if any file that could contain credentials exists in the working tree.
SECRET_PATTERNS=(".env" ".env.*" "*.pem" "*.key" "*.p12" "*.pfx" "secrets.*" "credentials.*")
for pattern in "${SECRET_PATTERNS[@]}"; do
  # shellcheck disable=SC2086    # intentional glob
  if compgen -G "$pattern" > /dev/null 2>&1; then
    echo "🚨 ABORT: Potential secret file found matching '$pattern'." >&2
    echo "   Remove it (or add to .gitignore) before deploying." >&2
    exit 1
  fi
done

# ── Explicit file whitelist ────────────────────────────────────────────────────
# Only these files/directories are staged. Add new assets here explicitly.
DEPLOY_FILES=(
  index.html
  race.js
  style.css
  README.md
  LICENSE
  track/
)

echo "🏁 Formula Racing Simulator — Deploying to GitHub Pages..."
$DRY_RUN && echo ""

# ── Git setup ─────────────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  run git init
  run git remote add origin "$REPO_URL"
fi

run git remote set-url origin "$REPO_URL"

# ── Stage only known files ────────────────────────────────────────────────────
run git add -- "${DEPLOY_FILES[@]}"

# Commit (skip if nothing to commit)
if git diff --cached --quiet; then
  echo "ℹ️  Nothing to commit — working tree is clean."
else
  run git commit -m "Deploy: Formula Racing Simulator $(date '+%Y-%m-%d %H:%M')"
fi

# ── Push main branch ──────────────────────────────────────────────────────────
run git branch -M main
run git push --force-with-lease -u origin main

# ── Deploy to gh-pages ────────────────────────────────────────────────────────
SPLIT_SHA=$(git subtree split --prefix . HEAD)
run git push --force-with-lease origin "${SPLIT_SHA}:${BRANCH}"

echo ""
echo "✅ Deployed! Your site will be live at:"
echo "   https://maruhodu.github.io/Formula-Racing-Simulator/"
echo ""
echo "Note: GitHub Pages can take 1–3 minutes to publish after the first push."
