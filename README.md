# Formula Racing Simulator 🏁

A browser-based formula racing simulator featuring realistic cornering physics, random speed boosts, a multi-lap loop system, and a live updating leaderboard. Built with pure HTML, CSS, and vanilla JavaScript (zero dependencies).

> **Track Data Credits**: The authentic circuit track SVG paths used in this simulator are sourced from the Open Source Formula 1 Database: [F1DB (f1db/f1db)](https://github.com/f1db/f1db).

## 🏎️ Core Features
- **Dynamic Track Loading** — Choose from multiple real-world grand prix circuits dynamically populated from raw local SVGs. Container ViewBoxes scale perfectly with optimal aspect ratio preservation.
- **Multi-Lap Engine** — Configure target lap counts directly in the UI. Vehicles loop seamlessly using total distance modulo path physics.
- **Physics-Accurate Racing** — Vehicles smoothly decelerate during curvature bends and accelerate aggressively on long straights based on pre-sampled path angles.
- **High-Performance SVGs** — Advanced caching of SVG `getPointAtLength()` coordinates guarantees flawless 60FPS lock even with massive (100+) participant grids.
- **Dual Reset Controls** — Dedicated modular buttons to instantly clear your participant roster (`목록 리셋`) vs cleanly resetting race timings onto the grid line (`RESET`).
- **Results Export** — Instant clipboard copying of finalized classifications formatted cleanly to `[Rank]. [Name]`.

## 🛠 Running Locally

Because the simulator dynamically fetches raw `.svg` track data via the native `fetch()` API, it **must be run on a local web server** (opening `file://` directly in a browser will throw CORS errors).

**Using Python (Recommended):**
```bash
python -m http.server 8765
# Navigate to http://localhost:8765
```

**Using Node.js:**
```bash
npx serve .
```

## ⚙️ Physics Configuration (`race.js`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_SPEED` | 0.2 px/f | Minimum speeds deep inside tight hairpins |
| `MAX_SPEED` | 1.5 px/f | Terminal velocity down major straights |
| `BOOST_MULTIPLIER` | 1.25x | Top speed multiplier during an active turbo boost |
| `BOOST_DURATION` | 100 frames | Length of the speed boost burst |
| `BOOST_PROBABILITY` | 0.003 | ~0.3% chance per frame to trigger boost |
| `CORNER_THRESHOLD` | 0.08 rad | Angular curve severity required to invoke heavy braking |

## 📦 Deployment (GitHub Pages)

Because this is an entirely static frontend site, you can directly host the repository via **GitHub Pages**. Go to your GitHub repository -> Settings -> Pages -> Deploy from branch -> `main`.

## 📝 License
MIT
