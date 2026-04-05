#!/bin/bash
# ──────────────────────────────────────────────
# deploy.sh — Formula Racing Simulator GitHub Pages Deploy
# ──────────────────────────────────────────────
# Usage:
#   1. Set REPO_URL below to your GitHub repo URL
#   2. chmod +x deploy.sh
#   3. ./deploy.sh
# ──────────────────────────────────────────────

REPO_URL="https://github.com/maruhodu/Formula-Racing-Simulator"
BRANCH="gh-pages"

echo "🏁 Formula Racing Simulator — Deploying to GitHub Pages..."

# Init git if needed
if [ ! -d ".git" ]; then
  git init
  git remote add origin "$REPO_URL"
fi

# Ensure remote is set
git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"

# Stage all files
git add -A
git commit -m "Deploy: Formula Racing Simulator $(date '+%Y-%m-%d %H:%M')"

# Push to main (creates it if needed)
git branch -M main
git push -u origin main

# Deploy to gh-pages branch
git push origin "$(git subtree split --prefix . HEAD):$BRANCH" --force

echo ""
echo "✅ Deployed! Your site will be live at:"
echo "   https://github.com/maruhodu/Formula-Racing-Simulator/"
echo ""
echo "Note: GitHub Pages can take 1-3 minutes to publish after the first push."
