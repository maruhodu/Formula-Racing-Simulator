/* =====================================================
   race.js — F1 Racing Ranking Simulator Core Engine
   v3: trackFiles preload cache, MAPS view, HISTORY
   ===================================================== */

'use strict';

// ── Constants ──────────────────────────────────────────────────
const MIN_SPEED = 0.2;
const MAX_SPEED = 1.5;
const BOOST_MULTIPLIER = 1.25;
const BOOST_DURATION = 100;
const BOOST_PROBABILITY = 0.003;
const CORNER_THRESHOLD = 0.08;
const ANGLE_SAMPLE_STEP = 4;
const STAGGER_OFFSET = 3;

// ── Track File List ────────────────────────────────────────────
// Add any new SVG filename here to make it available in the app.
const trackFiles = [
  'bahrain-1.svg',
  'marina-bay-1.svg',
  'melbourne-1.svg',
  'miami-1.svg',
  'monaco-6.svg',
  'shanghai-1.svg',
  'silverstone-8.svg',
  'suzuka-1.svg'
];

// ── Global SVG Cache ───────────────────────────────────────────
// Populated by preloadAllTracks(). Keys = filename (e.g. 'monaco.svg'),
// values = raw SVG text string fetched from track/<filename>.
const trackSvgCache = {};

// ── Track Metadata ─────────────────────────────────────────────
// Metadata for MAPS grid display. `file` must match an entry in trackFiles.
const TRACKS = [
  {
    id: 'bahrain',
    name: 'Bahrain International Circuit',
    location: 'Sakhir, Bahrain',
    emoji: '🇧🇭',
    length: '5.412 km',
    description: '사막 한가운데 위치한 서킷. 잦은 급제동 구간과 화려한 조명 아래서 펼쳐지는 야간 레이스가 특징입니다.',
    file: 'bahrain-1.svg',
  },
  {
    id: 'marinabay',
    name: 'Marina Bay Street Circuit',
    location: 'Singapore',
    emoji: '🇸🇬',
    length: '4.940 km',
    description: '덥고 습한 날씨 속에서 진행되는 극악의 난이도를 자랑하는 야간 시가지 서킷입니다.',
    file: 'marina-bay-1.svg',
  },
  {
    id: 'melbourne',
    name: 'Albert Park Circuit',
    location: 'Melbourne, Australia',
    emoji: '🇦🇺',
    length: '5.278 km',
    description: '아름다운 호수를 둘러싼 빠르고 유연한 공원 서킷으로, 전통적인 F1 시즌의 시작을 알리는 곳입니다.',
    file: 'melbourne-1.svg',
  },
  {
    id: 'miami',
    name: 'Miami International Autodrome',
    location: 'Miami, USA',
    emoji: '🇺🇸',
    length: '5.412 km',
    description: '하드록 스타디움을 중심으로 설계된 현대적인 시가지 서킷. 고속으로 굽이치는 코너들이 일품입니다.',
    file: 'miami-1.svg',
  },
  {
    id: 'monaco',
    name: 'Circuit de Monaco',
    location: 'Monte Carlo, Monaco',
    emoji: '🇲🇨',
    length: '3.337 km',
    description: 'F1 캘린더의 보석. 좁고 느리지만, 단 한 번의 실수도 용납하지 않는 헤어핀 코너들이 악명 높습니다.',
    file: 'monaco-6.svg',
  },
  {
    id: 'shanghai',
    name: 'Shanghai International Circuit',
    location: 'Shanghai, China',
    emoji: '🇨🇳',
    length: '5.451 km',
    description: '달팽이 모양의 독특하고 긴 첫 번째 코너와, F1에서 가장 긴 편에 속하는 백 스트레이트를 보유하고 있습니다.',
    file: 'shanghai-1.svg',
  },
  {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    location: 'Silverstone, UK',
    emoji: '🇬🇧',
    length: '5.891 km',
    description: '영국 모터스포츠의 성지. 매곳츠(Maggotts)와 베케츠(Becketts)로 이어지는 전설적인 초고속 코너가 있습니다.',
    file: 'silverstone-8.svg',
  },
  {
    id: 'suzuka',
    name: 'Suzuka International Racing Course',
    location: 'Suzuka, Japan',
    emoji: '🇯🇵',
    length: '5.807 km',
    description: '세계에서 유일무이한 8자 형태의 서킷. S자 연속 코너와 공포의 130R 등 드라이버들이 가장 사랑하는 트랙입니다.',
    file: 'suzuka-1.svg',
  }
];

// ── State ──────────────────────────────────────────────────────
let participants = [];
let raceActive = false;
let raceFinished = false;
let rafId = null;
let raceStartTime = null;
let lastLeaderboardUpdate = 0;
let finishCount = 0;
let totalLen = 0;
let angleMap = [];
let pointMap = [];
let trackPath = null;
let timerInterval = null;
let currentTrack = TRACKS[0];   // default track
let vehicleRadius = 9;          // SVG units, recalculated per track
let labelOffset = 14;           // y-offset above circle for name label
let totalLaps = 1;              // number of laps to complete

// ── Race History ───────────────────────────────────────────────
// Each entry: { id, trackName, date, duration, results: [{rank,name,color,finishTime}] }
const raceHistory = [];

// ── DOM References ─────────────────────────────────────────────
const participantList = document.getElementById('participant-list');
const leaderboardList = document.getElementById('leaderboard-list');
const btnStart = document.getElementById('btn-start-race');
const btnReset = document.getElementById('btn-reset');
const btnClearList = document.getElementById('btn-clear-list');
const nameInput = document.getElementById('name-input');
const btnAddName = document.getElementById('btn-add-name');
const podiumOverlay = document.getElementById('podium-overlay');
const raceTimerEl = document.getElementById('race-timer');
const countdownEl = document.getElementById('countdown-overlay');
const countdownNum = document.getElementById('countdown-num');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const raceStatFinish = document.getElementById('stat-finishing');
const raceStatLeader = document.getElementById('stat-leader');
const trackContainer = document.getElementById('track-container');
const trackNameBadge = document.getElementById('current-track-name');

// View panels
const viewSimulator = document.getElementById('view-simulator');
const viewMaps = document.getElementById('view-maps');
const viewHistory = document.getElementById('view-history');

// ── Utility ────────────────────────────────────────────────────
function randomHex() {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.floor(Math.random() * 25);
  const l = 50 + Math.floor(Math.random() * 15);
  return hslToHex(h, s, l);
}

function hslToHex(h, s, l) {
  l /= 100; s /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#111111' : '#ffffff';
}

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2) || '?';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Track Preloader ────────────────────────────────────────────
// Iterates over trackFiles, fetches each SVG from track/<filename>,
// and stores the raw SVG text string in trackSvgCache.
async function preloadAllTracks() {
  const results = await Promise.allSettled(
    trackFiles.map(async filename => {
      const res = await fetch('track/' + filename);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${filename}`);
      trackSvgCache[filename] = await res.text();
    })
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to preload track/${trackFiles[i]}:`, result.reason);
    }
  });
}

// ── Track Inject ───────────────────────────────────────────────
// Reads the cached SVG string, auto-detects the main racing path
// (longest getTotalLength()), computes a padded viewBox via getBBox(),
// then programmatically builds all visual layers into a clean SVG.
function injectTrackSvg(filename) {
  const svgText = trackSvgCache[filename];
  if (!svgText) {
    console.error(`No cached SVG for: ${filename}`);
    setStatus('TRACK NOT FOUND');
    return false;
  }

  // 1. Parse raw SVG and import all paths
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const rawSvg = doc.querySelector('svg');
  if (!rawSvg) { console.error('SVG parse failed: ' + filename); return false; }

  const tempSvg = document.importNode(rawSvg, true);
  tempSvg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  document.body.appendChild(tempSvg);

  // 2. Find the main racing path = longest getTotalLength()
  const allPaths = Array.from(tempSvg.querySelectorAll('path'));
  let mainPath = null, maxLen = 0;
  allPaths.forEach(p => {
    try { const l = p.getTotalLength(); if (l > maxLen) { maxLen = l; mainPath = p; } } catch (e) { }
  });
  if (!mainPath) {
    document.body.removeChild(tempSvg);
    console.error('No usable path in: ' + filename);
    return false;
  }

  // 3. Compute padded viewBox using getBBox()
  const bb = mainPath.getBBox();
  const padX = bb.width * 0.10;
  const padY = bb.height * 0.10;
  const vX = bb.x - padX, vY = bb.y - padY;
  const vW = bb.width + padX * 2, vH = bb.height + padY * 2;
  const pathD = mainPath.getAttribute('d');

  // 4. Read start point while still in DOM
  const startPt = mainPath.getPointAtLength(0);
  document.body.removeChild(tempSvg);

  // 5. Compute dynamic stroke widths
  // Use minimum dimension so hairpin-heavy tracks don't blob/overlap.
  // Clamped to 2% of the minimum dimension at maximum.
  const baseThickness = Math.min(vW, vH) * 0.015;  // 1.5% of min(w,h)
  const asphaltW = Math.min(baseThickness, Math.min(vW, vH) * 0.020); // max 2%
  const centerW = asphaltW * 0.15;     // 15% of asphalt = center dashes
  const dashLen = asphaltW * 1.5;
  const dashGap = asphaltW * 2.0;
  vehicleRadius = asphaltW * 1.4;      // exactly half stroke-width = fills road perfectly
  labelOffset = vehicleRadius * 1.8; // text above circle

  // ── Build clean final SVG ──────────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'track-svg');
  svg.setAttribute('viewBox', `${vX} ${vY} ${vW} ${vH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', currentTrack.name);
  svg.style.width = '100%';
  svg.style.height = '100%';

  // Defs: glow filter
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <filter id="vehicle-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${(vehicleRadius * 0.3).toFixed(2)}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  // Grid pattern
  const gSize = vW * 0.04;
  const pid = 'grid' + filename.replace(/\W/g, '');
  defs.innerHTML += `
    <pattern id="${pid}" width="${gSize}" height="${gSize}" patternUnits="userSpaceOnUse">
      <path d="M${gSize} 0L0 0 0 ${gSize}" fill="none" stroke="rgba(255,255,255,0.012)" stroke-width="0.5"/>
    </pattern>`;
  svg.appendChild(defs);

  // Background
  const mkRect = (fill) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', vX); r.setAttribute('y', vY);
    r.setAttribute('width', vW); r.setAttribute('height', vH);
    r.setAttribute('fill', fill); return r;
  };
  svg.appendChild(mkRect('#0e0e0e'));
  svg.appendChild(mkRect(`url(#${pid})`));

  // Helper to create a styled path copy
  const mkPath = (stroke, sw, dash) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', pathD);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', sw);
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-linecap', 'round');
    if (dash) el.setAttribute('stroke-dasharray', dash);
    return el;
  };

  // Layer 1: Shadow/outline
  svg.appendChild(mkPath('#2a2a2a', asphaltW * 1.22));
  // Layer 2: Asphalt surface (main road)
  svg.appendChild(mkPath('#333333', asphaltW));
  // Layer 3: Subtle edge accent
  svg.appendChild(mkPath('rgba(255,142,128,0.10)', asphaltW * 1.02));
  // Layer 4: Dotted center line (cloneNode approach via mkPath)
  svg.appendChild(mkPath('rgba(255,255,255,0.07)', centerW, `${dashLen} ${dashGap}`));

  // Layer 5: Start/Finish circle marker
  const sf = document.createElementNS(NS, 'circle');
  sf.setAttribute('cx', startPt.x); sf.setAttribute('cy', startPt.y);
  sf.setAttribute('r', asphaltW * 0.25);
  sf.setAttribute('fill', '#ff3333');
  sf.setAttribute('stroke', '#ffffff');
  sf.setAttribute('stroke-width', vehicleRadius * 0.08);
  sf.setAttribute('opacity', '0.9');
  svg.appendChild(sf);

  // Layer 6: Invisible racing path (physics reference)
  const racePath = document.createElementNS(NS, 'path');
  racePath.setAttribute('id', 'sim-track-path');
  racePath.setAttribute('d', pathD);
  racePath.setAttribute('fill', 'none');
  racePath.setAttribute('stroke', 'none');
  svg.appendChild(racePath);

  // Layer 7: Vehicle layer — cars rendered on top
  const vl = document.createElementNS(NS, 'g');
  vl.setAttribute('id', 'vehicle-layer');
  vl.setAttribute('filter', 'url(#vehicle-glow)');
  svg.appendChild(vl);

  trackContainer.innerHTML = '';
  trackContainer.appendChild(svg);
  return true;
}

// ── Track Loader ───────────────────────────────────────────────
// Switches the active track: reads from trackSvgCache, injects SVG into
// the DOM, recalculates path geometry, and repositions all vehicles.
function loadTrack(track) {
  if (raceActive) return Promise.resolve();

  currentTrack = track;
  if (trackNameBadge) trackNameBadge.textContent = track.name;

  const ok = injectTrackSvg(track.file);
  if (!ok) return Promise.resolve();

  // Recalculate path length & angle map from the newly injected SVG
  initTrackPath();

  // Re-render vehicle SVG elements and reposition on new track
  participants.forEach(p => {
    renderVehicleSVG(p, true);
    positionAtStart(p);
  });

  setStatus('READY');
  updateStartButton();
  return Promise.resolve();
}

function initTrackPath() {
  trackPath = document.getElementById('sim-track-path');
  if (!trackPath) { console.error('sim-track-path not found in SVG'); return; }
  totalLen = trackPath.getTotalLength();
  angleMap = precomputeAngles(trackPath);
  pointMap = precomputePoints(trackPath);
}

function precomputePoints(path) {
  const total = path.getTotalLength();
  const map = new Array(Math.ceil(total) + 1);
  for (let d = 0; d <= total; d++) {
    const pt = path.getPointAtLength(d);
    map[Math.floor(d)] = { x: pt.x, y: pt.y };
  }
  const end = path.getPointAtLength(total);
  map[Math.ceil(total)] = { x: end.x, y: end.y };
  return map;
}

function getPrecomputedPoint(dist) {
  if (!pointMap.length) return { x: 0, y: 0 };
  const idx = Math.min(Math.floor(dist), pointMap.length - 1);
  return pointMap[Math.max(0, idx)] || pointMap[pointMap.length - 1];
}

// ── Angle Precompute ───────────────────────────────────────────
function precomputeAngles(path) {
  const total = path.getTotalLength();
  const map = [];
  let prevAngle = 0;
  for (let d = 0; d <= total; d += ANGLE_SAMPLE_STEP) {
    const p1 = path.getPointAtLength(Math.max(0, d - 1));
    const p2 = path.getPointAtLength(Math.min(total, d + 1));
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    map.push({ dist: d, angle, curvature: Math.abs(angle - prevAngle) });
    prevAngle = angle;
  }
  return map;
}

function getCurvatureAt(dist) {
  const idx = Math.min(Math.floor(dist / ANGLE_SAMPLE_STEP), angleMap.length - 1);
  return angleMap[Math.max(0, idx)]?.curvature ?? 0;
}

// ── Participant Management ─────────────────────────────────────
function addParticipant(name) {
  name = name.trim();
  if (!name || participants.length >= 100) return;

  const color = randomHex();
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const p = {
    id, name, color,
    distance: 0,
    speed: MIN_SPEED + Math.random() * 0.5,
    boostTimer: 0,
    boostActive: false,
    finished: false,
    rank: null,
    finishTime: null,
    startOffset: participants.length * STAGGER_OFFSET,
  };

  participants.push(p);
  renderParticipantEntry(p);
  renderVehicleSVG(p, false);
  updateStartButton();
  positionAtStart(p);
  updateLeaderboard();
}

function renderParticipantEntry(p) {
  const item = document.createElement('div');
  item.className = 'participant-item';
  item.id = `entry-${p.id}`;
  item.innerHTML = `
    <div class="p-badge" id="badge-${p.id}" style="background:${p.color};color:${getContrastColor(p.color)}">
      ${initials(p.name)}
    </div>
    <span class="p-name">${escHtml(p.name)}</span>
    <span class="p-pos" id="pos-${p.id}">—</span>
    <button class="btn-danger" onclick="removeParticipant('${p.id}')" title="Remove" aria-label="Remove ${escHtml(p.name)}">✕</button>
  `;
  participantList.appendChild(item);
}

function renderVehicleSVG(p, replace = false) {
  const vLayer = document.getElementById('vehicle-layer');
  if (!vLayer) return;

  // Remove existing elements when swapping track
  if (replace) {
    document.getElementById(`group-${p.id}`)?.remove();
  }

  const NS = 'http://www.w3.org/2000/svg';

  // Group container for vehicle + text — updated via transform
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('id', `group-${p.id}`);
  group.setAttribute('transform', 'translate(0,0)');

  // Booster glow (behind car)
  const boost = document.createElementNS(NS, 'circle');
  boost.setAttribute('id', `boost-${p.id}`);
  boost.setAttribute('cx', '0');
  boost.setAttribute('cy', '0');
  boost.setAttribute('r', vehicleRadius * 1.3);
  boost.setAttribute('fill', '#ffe600ff');
  boost.setAttribute('opacity', '0');
  boost.setAttribute('style', 'transition: opacity 0.2s;');

  // Car body circle
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('id', `circle-${p.id}`);
  circle.setAttribute('class', 'vehicle-circle');
  circle.setAttribute('cx', '0');
  circle.setAttribute('cy', '0');
  circle.setAttribute('r', vehicleRadius);
  circle.setAttribute('fill', p.color);
  circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
  circle.setAttribute('stroke-width', vehicleRadius * 0.16);

  // Participant Name text
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('fill', '#ffffff');
  text.setAttribute('pointer-events', 'none');
  text.setAttribute('font-family', 'sans-serif');
  text.setAttribute('font-weight', 'bold');

  // Dynamically calculate font-size to fit inside radius
  const charLength = Math.max(1, p.name.length);
  const maxAllowedWidth = vehicleRadius * 1.8;
  let dynamicFontSize = (maxAllowedWidth / charLength) * 1.6;
  dynamicFontSize = Math.min(dynamicFontSize, vehicleRadius * 0.7); // Cap max size
  text.setAttribute('font-size', dynamicFontSize);
  text.textContent = p.name;

  group.appendChild(boost);
  group.appendChild(circle);
  group.appendChild(text);
  vLayer.appendChild(group);
}

function positionAtStart(p) {
  if (!pointMap.length) return;
  const offset = Math.min(p.startOffset, totalLen * 0.02);
  const pt = getPrecomputedPoint(offset);
  moveVehicle(p, pt.x, pt.y);
}

// Render path using translate on the grouped node
function moveVehicle(p, x, y) {
  const group = document.getElementById(`group-${p.id}`);
  if (group) { group.setAttribute('transform', `translate(${x.toFixed(2)}, ${y.toFixed(2)})`); }
}

function removeParticipant(id) {
  if (raceActive) return;
  participants = participants.filter(p => p.id !== id);
  document.getElementById(`entry-${id}`)?.remove();
  document.getElementById(`group-${id}`)?.remove();
  updateStartButton();
  updateLeaderboard();
}

window.removeParticipant = removeParticipant;

// ── UI ─────────────────────────────────────────────────────────
function updateStartButton() {
  btnStart.disabled = participants.length < 2 || raceActive || raceFinished;
}

function setStatus(label, racing = false) {
  statusDot.className = 'status-dot' + (racing ? ' racing' : '');
  statusText.textContent = label;
}

// ── View Switching ─────────────────────────────────────────────
function showView(name) {
  const allViews = [viewSimulator, viewMaps, viewHistory];
  const allTabs = document.querySelectorAll('.nav-tab');
  const tabMap = { simulator: 'tab-sim', maps: 'tab-maps', history: 'tab-history' };

  allViews.forEach(v => v && v.classList.remove('active-view'));
  allTabs.forEach(t => { t.classList.remove('active'); t.removeAttribute('aria-current'); });

  const tabEl = document.getElementById(tabMap[name]);
  if (tabEl) { tabEl.classList.add('active'); tabEl.setAttribute('aria-current', 'page'); }

  const viewMap = { simulator: viewSimulator, maps: viewMaps, history: viewHistory };
  const target = viewMap[name];
  if (target) target.classList.add('active-view');

  if (name === 'maps') renderMapsGrid();
  if (name === 'history') renderHistory();
}

window.showView = showView;

// ── MAPS GRID ──────────────────────────────────────────────────
function renderMapsGrid() {
  const grid = document.getElementById('maps-grid');
  if (!grid) return;
  grid.innerHTML = '';

  TRACKS.forEach(track => {
    const card = document.createElement('div');
    card.className = 'map-card' + (track.id === currentTrack.id ? ' active' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Select ${track.name}`);
    card.innerHTML = `
      <div class="map-card-header">
        <span class="map-emoji">${track.emoji}</span>
        <span class="map-active-badge">${track.id === currentTrack.id ? 'ACTIVE' : ''}</span>
      </div>
      <div class="map-card-name">${escHtml(track.name)}</div>
      <div class="map-card-location">${escHtml(track.location)}</div>
      <div class="map-card-length">${escHtml(track.length)}</div>
      <div class="map-card-desc">${escHtml(track.description)}</div>
      <button class="btn-primary map-select-btn" aria-label="Load ${escHtml(track.name)}">
        ${track.id === currentTrack.id ? '✓ SELECTED' : '▶ SELECT TRACK'}
      </button>
    `;

    const selectBtn = card.querySelector('.map-select-btn');
    const doSelect = () => {
      if (raceActive) return;
      loadTrack(track).then(() => showView('simulator'));
    };
    selectBtn.addEventListener('click', e => { e.stopPropagation(); doSelect(); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSelect(); } });
    grid.appendChild(card);
  });
}

// ── HISTORY ────────────────────────────────────────────────────
function saveRaceToHistory(results) {
  const entry = {
    id: Date.now(),
    trackId: currentTrack.id,
    trackName: currentTrack.name,
    date: Date.now(),
    results: results.map(p => ({
      rank: p.rank,
      name: p.name,
      color: p.color,
      finishTime: p.finishTime,
    })),
  };
  raceHistory.unshift(entry);  // newest first
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (raceHistory.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon" style="font-size:2.5rem;opacity:0.15;">🏁</div>
        <div class="empty-text">No races yet — finish a race to see history</div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  raceHistory.forEach((entry, idx) => {
    const winner = entry.results[0];
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `Race ${idx + 1} - ${entry.trackName} - Winner: ${winner?.name}`);
    item.innerHTML = `
      <div class="history-item-left">
        <div class="history-track">${escHtml(entry.trackName)}</div>
        <div class="history-date">${formatDate(entry.date)}</div>
      </div>
      <div class="history-item-right">
        <div class="history-winner-row">
          <span class="history-medal">🥇</span>
          <span class="history-dot" style="background:${winner?.color ?? '#888'}"></span>
          <span class="history-winner-name">${escHtml(winner?.name ?? '—')}</span>
        </div>
        <div class="history-participants">${entry.results.length} drivers</div>
      </div>
      <div class="history-chevron">›</div>
    `;

    const open = () => showHistoryPodium(entry);
    item.addEventListener('click', open);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    container.appendChild(item);
  });
}

function showHistoryPodium(entry) {
  // Populate podium overlay with historical data (read-only)
  const sorted = [...entry.results].sort((a, b) => a.rank - b.rank);

  // Set subtitle
  const subtitle = podiumOverlay.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = `${entry.trackName.toUpperCase()} • ${formatDate(entry.date)}`;

  // Build podium stage
  const podiumStage = document.getElementById('podium-stage');
  podiumStage.innerHTML = '';
  const positions = [
    { rank: 2, cls: 'second', crown: '' },
    { rank: 1, cls: 'first', crown: '👑' },
    { rank: 3, cls: 'third', crown: '' },
  ];
  positions.forEach(({ rank, cls, crown }) => {
    const p = sorted[rank - 1];
    if (!p) return;
    const block = document.createElement('div');
    block.className = `podium-block ${cls}`;
    block.innerHTML = `
      <div class="podium-driver-info">
        ${crown ? `<span class="podium-crown">${crown}</span>` : ''}
        <div class="podium-avatar" style="background:${p.color};color:${getContrastColor(p.color)}">${initials(p.name)}</div>
        <div class="podium-name">${escHtml(p.name)}</div>
        <div class="podium-finish-time">${formatTime(p.finishTime)}</div>
      </div>
      <div class="podium-step"><span class="podium-rank">${rank}</span></div>
    `;
    podiumStage.appendChild(block);
  });

  // Full results
  const resultsList = document.getElementById('results-list');
  resultsList.innerHTML = '';
  sorted.forEach((p, i) => {
    const pos = i + 1;
    const row = document.createElement('div');
    row.className = 'result-row';
    row.style.animationDelay = `${i * 0.04}s`;
    row.innerHTML = `
      <span class="r-pos ${pos <= 3 ? `medal-${pos}` : ''}">${pos}</span>
      <span class="r-dot" style="background:${p.color}"></span>
      <span class="r-name">${escHtml(p.name)}</span>
      <span class="r-time">${formatTime(p.finishTime)}</span>
    `;
    resultsList.appendChild(row);
  });

  // Mark as history replay — hide Race Again, keep Close
  document.getElementById('btn-race-again')?.setAttribute('data-history', 'true');
  podiumOverlay.classList.add('visible');
}

// ── Leaderboard ───────────────────────────────────────────────
function updateLeaderboard() {
  const sorted = [...participants].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return a.rank - b.rank;
    return b.distance - a.distance;
  });

  const leaderDist = sorted[0]?.distance ?? 0;
  const laps = totalLaps;

  let htmlStr = '';

  sorted.forEach((p, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? 'p1' : pos === 2 ? 'p2' : pos === 3 ? 'p3' : '';
    // Progress within the CURRENT lap (0-100%), wraps via modulo
    const lapsDone = totalLen > 0 ? Math.floor(p.distance / totalLen) : 0;
    const lapsCapped = Math.min(lapsDone, laps);
    let overallPct = totalLen > 0
      ? Math.min(100, (p.distance / (totalLen * laps)) * 100).toFixed(1)
      : 0;
    if (p.finished) overallPct = 100;

    let gapStr;
    if (p.finished) {
      gapStr = 'FINISHED';
    } else if (pos === 1) {
      gapStr = laps > 1 ? `L${lapsCapped + 1}/${laps} · LEADER` : 'LEADER';
    } else {
      gapStr = laps > 1
        ? `L${lapsCapped + 1}/${laps}`
        : `+${Math.round(leaderDist - p.distance)}px`;
    }
    const gapClass = pos === 1 ? 'leader' : p.finished ? 'finished' : '';

    htmlStr += `
      <div style="display:flex;align-items:center;gap:12px;padding:6px 16px;background:none;height:42px;overflow:visible;opacity:1;visibility:visible;">
        <span class="lb-pos ${posClass}" style="min-width:24px;text-align:right;font-size:1rem;font-weight:700;color:${pos <= 3 ? 'inherit' : '#ffffff'};">${pos}</span>
        <span style="background:${p.color};display:inline-block;width:12px;height:12px;border-radius:50%;flex-shrink:0;"></span>
        <span class="lb-name" style="flex:1;font-size:0.85rem;font-weight:600;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(p.name)}</span>
        <span class="lb-gap ${gapClass}">${gapStr}</span>
      </div>
      <div class="lb-progress-wrap" style="padding:0 16px 4px;">
        <div class="lb-progress-track" style="height:2px;background:rgba(255,255,255,0.1);overflow:hidden;">
          <div class="lb-progress-fill" style="height:100%;background:var(--tertiary-dim);width:${overallPct}%;"></div>
        </div>
      </div>
    `;

    const posEl = document.getElementById(`pos-${p.id}`);
    if (posEl) posEl.textContent = pos;
  });

  leaderboardList.innerHTML = htmlStr;

  const finishedCount = participants.filter(p => p.finished).length;
  if (raceStatFinish) raceStatFinish.textContent = `${finishedCount} / ${participants.length}`;
  if (raceStatLeader) raceStatLeader.textContent = sorted[0]?.name?.split(' ')[0] ?? '—';
}

// ── Race Timer ────────────────────────────────────────────────
function startTimer() {
  raceTimerEl.classList.add('visible');
  timerInterval = setInterval(() => {
    raceTimerEl.textContent = formatTime(performance.now() - raceStartTime);
  }, 50);
}

function stopTimer() { clearInterval(timerInterval); }

// ── Countdown + Race Start ────────────────────────────────────
function startCountdown() {
  btnStart.disabled = true;
  btnReset.disabled = true;
  btnAddName.disabled = true;
  nameInput.disabled = true;

  // Read laps setting from UI input
  const lapsInput = document.getElementById('laps-input');
  totalLaps = Math.max(1, parseInt(lapsInput?.value ?? '1', 10) || 1);

  participants.forEach(p => {
    p.distance = p.startOffset;
    p.speed = MIN_SPEED + Math.random() * 0.5;
    p.boostTimer = 0;
    p.boostActive = false;
    p.finished = false;
    p.rank = null;
    p.finishTime = null;
    positionAtStart(p);
    document.getElementById(`circle-${p.id}`)?.classList.remove('boosting');
    document.getElementById(`badge-${p.id}`)?.classList.remove('boost-active');
  });

  finishCount = 0;
  setStatus('COUNTDOWN');

  let count = 3;
  countdownEl.classList.add('visible');
  countdownNum.textContent = count;
  countdownNum.className = 'countdown-number';

  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNum.textContent = count;
      countdownNum.className = 'countdown-number';
    } else if (count === 0) {
      countdownNum.textContent = 'GO!';
      countdownNum.className = 'countdown-number countdown-go';
    } else {
      clearInterval(tick);
      countdownEl.classList.remove('visible');
      beginRace();
    }
  }, 900);
}

function beginRace() {
  raceActive = true;
  raceStartTime = performance.now();
  lastLeaderboardUpdate = performance.now();
  setStatus('RACING', true);
  startTimer();
  btnReset.disabled = false;
  updateLeaderboard();
  rafId = requestAnimationFrame(raceLoop);
}

// ── Core Race Loop ────────────────────────────────────────────
function raceLoop() {
  if (!raceActive) return;

  let allDone = true;

  participants.forEach(p => {
    if (p.finished) return;
    allDone = false;

    // Boost activation
    if (!p.boostActive && Math.random() < BOOST_PROBABILITY) {
      p.boostActive = true;
      p.boostTimer = BOOST_DURATION;
      const boostEl = document.getElementById(`boost-${p.id}`);
      if (boostEl) { boostEl.setAttribute('opacity', '0.40'); }
      document.getElementById(`badge-${p.id}`)?.classList.add('boost-active');
    }

    // Speed calculation
    const curvature = getCurvatureAt(p.distance);

    if (p.boostActive) {
      p.speed += (MAX_SPEED * BOOST_MULTIPLIER - p.speed) * 0.12;
      p.boostTimer--;
      if (p.boostTimer <= 0) {
        p.boostActive = false;
        const boostEl = document.getElementById(`boost-${p.id}`);
        if (boostEl) { boostEl.setAttribute('opacity', '0'); }
        document.getElementById(`badge-${p.id}`)?.classList.remove('boost-active');
      }
    } else if (curvature > CORNER_THRESHOLD) {
      const targetSpeed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * (1 - Math.min(1, curvature / 0.5));
      p.speed += (targetSpeed - p.speed) * 0.06;
    } else {
      p.speed += (MAX_SPEED - p.speed) * 0.04;
    }

    p.speed = Math.max(MIN_SPEED * 0.6, Math.min(MAX_SPEED * BOOST_MULTIPLIER, p.speed));
    p.distance += p.speed;

    // Finish detection — car must complete all laps
    const raceDist = totalLen * totalLaps;
    if (p.distance >= raceDist) {
      p.distance = raceDist;
      p.finished = true;
      p.rank = ++finishCount;
      p.finishTime = performance.now() - raceStartTime;
      p.boostActive = false; // explicitly disable boost
      const boostEl = document.getElementById(`boost-${p.id}`);
      if (boostEl) { boostEl.setAttribute('opacity', '0'); }
      document.getElementById(`badge-${p.id}`)?.classList.remove('boost-active');
      finishEffect(p);
    }

    // Update SVG position — modulo keeps car looping on track
    const loopDist = totalLen > 0 ? p.distance % totalLen : 0;
    const pt = getPrecomputedPoint(loopDist);
    moveVehicle(p, pt.x, pt.y);
  });

  if (performance.now() - lastLeaderboardUpdate > 300) {
    updateLeaderboard();
    lastLeaderboardUpdate = performance.now();
  }

  if (allDone || participants.every(p => p.finished)) {
    endRace();
    return;
  }

  rafId = requestAnimationFrame(raceLoop);
}

// ── Finish Effect ─────────────────────────────────────────────
function finishEffect(p) {
  const vLayer = document.getElementById('vehicle-layer');
  if (!vLayer) return;
  const pt = trackPath.getPointAtLength(p.distance);
  const burst = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  burst.setAttribute('cx', pt.x);
  burst.setAttribute('cy', pt.y);
  burst.setAttribute('r', 0);
  burst.setAttribute('fill', 'none');
  burst.setAttribute('stroke', p.color);
  burst.setAttribute('stroke-width', '2');
  burst.setAttribute('class', 'finish-burst');
  vLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

// ── End Race ─────────────────────────────────────────────────
function endRace() {
  raceActive = false;
  raceFinished = true;
  cancelAnimationFrame(rafId);
  stopTimer();
  setStatus('RACE COMPLETE');

  // Save to history before showing podium
  const sorted = [...participants].sort((a, b) => a.rank - b.rank);
  saveRaceToHistory(sorted);

  setTimeout(() => showPodium(sorted), 800);
}

// ── Podium ───────────────────────────────────────────────────
function showPodium(sorted) {
  // Reset subtitle to current race
  const subtitle = podiumOverlay.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = `${currentTrack.name.toUpperCase()} • SESSION CLASSIFIED`;

  const podiumStage = document.getElementById('podium-stage');
  podiumStage.innerHTML = '';

  const positions = [
    { rank: 2, cls: 'second', crown: '' },
    { rank: 1, cls: 'first', crown: '👑' },
    { rank: 3, cls: 'third', crown: '' },
  ];

  positions.forEach(({ rank, cls, crown }) => {
    const p = sorted[rank - 1];
    if (!p) return;
    const block = document.createElement('div');
    block.className = `podium-block ${cls}`;
    block.innerHTML = `
      <div class="podium-driver-info">
        ${crown ? `<span class="podium-crown">${crown}</span>` : ''}
        <div class="podium-avatar" style="background:${p.color};color:${getContrastColor(p.color)}">${initials(p.name)}</div>
        <div class="podium-name">${escHtml(p.name)}</div>
        <div class="podium-finish-time">${formatTime(p.finishTime)}</div>
      </div>
      <div class="podium-step"><span class="podium-rank">${rank}</span></div>
    `;
    podiumStage.appendChild(block);
  });

  const resultsList = document.getElementById('results-list');
  resultsList.innerHTML = '';
  sorted.forEach((p, i) => {
    const pos = i + 1;
    const row = document.createElement('div');
    row.className = 'result-row';
    row.style.animationDelay = `${i * 0.05}s`;
    row.innerHTML = `
      <span class="r-pos ${pos <= 3 ? `medal-${pos}` : ''}">${pos}</span>
      <span class="r-dot" style="background:${p.color}"></span>
      <span class="r-name">${escHtml(p.name)}</span>
      <span class="r-time">${formatTime(p.finishTime)}</span>
    `;
    resultsList.appendChild(row);
  });

  document.getElementById('btn-race-again')?.removeAttribute('data-history');
  podiumOverlay.classList.add('visible');
}

// ── Copy Results ──────────────────────────────────────────────
function copyResults() {
  const sorted = [...participants].sort((a, b) => a.rank - b.rank);
  const rangeEl = document.getElementById('copy-range');
  const feedback = document.getElementById('copy-feedback');
  const range = rangeEl?.value ?? 'all';

  let filtered = sorted;
  if (range === '10') filtered = sorted.slice(0, 10);
  if (range === '20') filtered = sorted.slice(0, 20);

  const lines = filtered.map((p, i) => {
    return `${i + 1}. ${p.name}`;
  });

  const text = lines.join('\n');

  const show = () => {
    feedback.textContent = '✓ COPIED!';
    feedback.classList.add('show');
    setTimeout(() => feedback.classList.remove('show'), 2000);
  };

  navigator.clipboard.writeText(text).then(show).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    show();
  });
}

window.copyResults = copyResults;

// ── Reset ────────────────────────────────────────────────────
function clearParticipants() {
  if (raceActive) return;
  participants = [];
  participantList.innerHTML = '';
  document.getElementById('vehicle-layer').innerHTML = '';
  resetRace();
}

function resetRace() {
  if (rafId) cancelAnimationFrame(rafId);
  stopTimer();
  raceActive = false;
  raceFinished = false;
  finishCount = 0;

  participants.forEach(p => {
    p.distance = p.startOffset;
    p.speed = MIN_SPEED;
    p.boostTimer = 0;
    p.boostActive = false;
    p.finished = false;
    p.rank = null;
    p.finishTime = null;
    positionAtStart(p);
    document.getElementById(`circle-${p.id}`)?.classList.remove('boosting');
    document.getElementById(`badge-${p.id}`)?.classList.remove('boost-active');
    const posEl = document.getElementById(`pos-${p.id}`);
    if (posEl) posEl.textContent = '—';
    const svgPos = document.getElementById(`svgpos-${p.id}`);
    if (svgPos) svgPos.textContent = '';
  });

  raceTimerEl.classList.remove('visible');
  raceTimerEl.textContent = '0:00.00';
  podiumOverlay.classList.remove('visible');
  leaderboardList.innerHTML = '';
  btnAddName.disabled = false;
  nameInput.disabled = false;
  setStatus('READY');
  updateStartButton();
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  setStatus('LOADING...');

  // Fetch and cache ALL track SVGs up front (parallel)
  await preloadAllTracks();

  // Inject default track from cache (synchronous — no fetch needed)
  loadTrack(currentTrack);

  // Event bindings
  btnStart.addEventListener('click', startCountdown);
  btnReset.addEventListener('click', resetRace);
  btnClearList.addEventListener('click', clearParticipants);

  btnAddName.addEventListener('click', () => {
    const raw = nameInput.value.trim();
    if (!raw) return;
    raw.split(',').map(n => n.trim()).filter(Boolean).forEach(addParticipant);
    nameInput.value = '';
    nameInput.focus();
  });

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnAddName.click();
  });

  // Nav tab bindings
  document.getElementById('tab-sim')?.addEventListener('click', () => showView('simulator'));
  document.getElementById('tab-maps')?.addEventListener('click', () => showView('maps'));
  document.getElementById('tab-history')?.addEventListener('click', () => showView('history'));

  document.getElementById('btn-close-podium')?.addEventListener('click', () => {
    podiumOverlay.classList.remove('visible');
  });

  // Empty state watcher
  const emptyState = document.getElementById('empty-state');
  new MutationObserver(() => {
    const vLayer = document.getElementById('vehicle-layer');
    const hasDrivers = vLayer?.querySelector('.vehicle-circle') !== null;
    if (emptyState) emptyState.style.display = hasDrivers ? 'none' : 'flex';
  }).observe(document.getElementById('track-container'), { childList: true, subtree: true });

  updateStartButton();
}


document.addEventListener('DOMContentLoaded', init);

// ── Global Exports ────────────────────────────────────────────
window.resetRace = resetRace;
window.showPodium = showPodium;
window.copyResults = copyResults;
window.removeParticipant = removeParticipant;
window.showView = showView;
window.loadTrack = loadTrack;
