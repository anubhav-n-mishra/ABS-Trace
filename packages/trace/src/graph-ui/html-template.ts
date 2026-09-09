// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt

export function generateGraphHtml(initialData: {
  repoRoot: string;
  focusFeature?: string;
  focusSymbol?: string;
  focusImpact?: string;
  showModels?: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amvelt TRACE — Interactive Codebase Graph</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #06090f;
      --bg-panel: rgba(11, 15, 25, 0.88);
      --bg-card: #111827;
      --bg-card-hover: #1e293b;
      --border: #1e293b;
      --border-active: #38bdf8;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-blue: #38bdf8;
      --accent-purple: #c084fc;
      --accent-green: #4ade80;
      --accent-amber: #fbbf24;
      --accent-rose: #fb7185;
      --accent-cyan: #22d3ee;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    /* Top Navigation Bar */
    header {
      height: 56px;
      min-height: 56px;
      background: rgba(8, 11, 18, 0.94);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 20;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.8px;
    }

    .brand-badge {
      background: linear-gradient(135deg, #0284c7, #8b5cf6);
      color: #fff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .search-box {
      position: relative;
      width: 360px;
    }

    .search-box input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 8px 14px 8px 36px;
      border-radius: 8px;
      font-size: 13px;
      font-family: var(--font-sans);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-box input:focus {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .search-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
      max-height: 280px;
      overflow-y: auto;
      display: none;
      z-index: 50;
    }
    .search-item {
      padding: 9px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      font-size: 13px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: background 0.15s;
    }
    .search-item:hover {
      background: #1e293b;
    }
    .search-item-name {
      font-weight: 500;
      color: #f8fafc;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-item-kind {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .drawer-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .drawer-action-btn {
      flex: 1;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .drawer-action-btn:hover {
      background: #334155;
      border-color: #38bdf8;
      color: #38bdf8;
    }

    .stats-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .stat-pill b { color: var(--text-main); font-weight: 600; }

    /* Main Container */
    #main-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 50% 50%, #0d1424 0%, #05070c 100%);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
    }
    canvas.dragging { cursor: grabbing; }

    /* Left Control Dock */
    .controls-dock {
      position: absolute;
      top: 16px;
      left: 16px;
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      width: 260px;
      z-index: 10;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }

    .dock-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .chip {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .chip:hover {
      background: var(--bg-card-hover);
      color: var(--text-main);
    }
    .chip.active {
      background: rgba(56, 189, 248, 0.16);
      border-color: var(--accent-blue);
      color: var(--accent-blue);
      font-weight: 600;
    }

    .select-dropdown {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-family: var(--font-sans);
      margin-bottom: 14px;
      outline: none;
      cursor: pointer;
    }
    .select-dropdown:focus {
      border-color: var(--accent-blue);
    }

    .action-btn {
      width: 100%;
      background: #1e293b;
      color: var(--text-main);
      border: 1px solid var(--border);
      padding: 9px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .action-btn:hover {
      background: #27354f;
      border-color: var(--accent-blue);
    }

    /* Zoom Controls */
    .zoom-controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: var(--bg-panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .zoom-btn {
      background: transparent;
      border: none;
      color: var(--text-main);
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .zoom-btn:hover { background: var(--bg-card-hover); }
    .zoom-btn + .zoom-btn { border-top: 1px solid var(--border); }

    /* Details Drawer */
    #details-drawer {
      position: absolute;
      top: 0;
      right: 0;
      width: 400px;
      height: 100%;
      background: var(--bg-panel);
      backdrop-filter: blur(24px);
      border-left: 1px solid var(--border);
      box-shadow: -12px 0 40px rgba(0, 0, 0, 0.6);
      transform: translateX(100%);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 15;
      display: flex;
      flex-direction: column;
      user-select: text;
    }
    #details-drawer.open { transform: translateX(0); }

    .drawer-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: rgba(15, 22, 34, 0.6);
    }
    .drawer-close {
      background: transparent;
      border: none;
      color: var(--text-dim);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .drawer-close:hover { color: var(--text-main); background: rgba(255,255,255,0.06); }

    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .detail-kind-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .kind-feature { background: rgba(192, 132, 252, 0.18); color: var(--accent-purple); border: 1px solid rgba(192, 132, 252, 0.4); }
    .kind-symbol { background: rgba(56, 189, 248, 0.18); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.4); }
    .kind-route { background: rgba(74, 222, 128, 0.18); color: var(--accent-green); border: 1px solid rgba(74, 222, 128, 0.4); }
    .kind-model { background: rgba(34, 211, 238, 0.18); color: var(--accent-cyan); border: 1px solid rgba(34, 211, 238, 0.4); }
    .kind-test { background: rgba(251, 191, 36, 0.18); color: var(--accent-amber); border: 1px solid rgba(251, 191, 36, 0.4); }
    .kind-file { background: rgba(148, 163, 184, 0.18); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.4); }

    .detail-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      word-break: break-word;
      line-height: 1.3;
    }

    .detail-urn {
      font-size: 11px;
      color: var(--text-dim);
      font-family: var(--font-mono);
      word-break: break-all;
      background: var(--bg-card);
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
    }

    .detail-section {
      margin-top: 18px;
    }
    .detail-section-heading {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .detail-item-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .detail-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .detail-item:hover {
      border-color: var(--accent-blue);
      background: var(--bg-card-hover);
    }
    .detail-item-title { font-weight: 600; color: var(--text-main); }
    .detail-item-subtitle { color: var(--text-muted); font-size: 11px; margin-top: 2px; }

    .editor-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #1e293b;
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      margin-top: 8px;
      transition: all 0.2s;
    }
    .editor-btn:hover { background: #334155; border-color: var(--accent-blue); color: var(--accent-blue); }

    /* Tooltip */
    #tooltip {
      position: absolute;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid var(--border-active);
      backdrop-filter: blur(12px);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      display: none;
      z-index: 30;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      max-width: 320px;
      word-break: break-word;
    }

    .helper-hint {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(15, 22, 34, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      color: var(--text-dim);
      pointer-events: none;
      z-index: 5;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>AMVELT TRACE</span>
      <span class="brand-badge">Visual Map</span>
    </div>

    <div class="search-box">
      <span class="search-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </span>
      <input type="text" id="searchInput" placeholder="Search features, symbols, APIs (Press Enter to focus)..." autocomplete="off">
      <div class="search-dropdown" id="searchDropdown"></div>
    </div>

    <div class="stats-bar">
      <div class="stat-pill">Nodes: <b id="statNodes">0</b></div>
      <div class="stat-pill">Edges: <b id="statEdges">0</b></div>
      <div class="stat-pill">Features: <b id="statFeatures">0</b></div>
    </div>
  </header>

  <div id="main-container">
    <div class="controls-dock">
      <div class="dock-section-title">View Mode</div>
      <div class="filter-chips" id="modeChips">
        <div class="chip active" data-mode="all" title="Show all indexed elements organized by feature clusters">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          All
        </div>
        <div class="chip" data-mode="architecture" title="High-level architecture: features and key interfaces">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
          Architecture
        </div>
        <div class="chip" data-mode="focus" title="Focus on selected node and direct connections">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          Focus
        </div>
        <div class="chip" data-mode="impact" title="Show blast radius of selected node">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          Impact
        </div>
      </div>

      <div class="dock-section-title">Focus Feature</div>
      <select class="select-dropdown" id="featureSelect">
        <option value="">-- All Features --</option>
      </select>

      <div class="dock-section-title">Filter Types</div>
      <div class="filter-chips" id="kindChips">
        <div class="chip active" data-kind="feature">Feature</div>
        <div class="chip active" data-kind="route">API</div>
        <div class="chip active" data-kind="symbol">Symbol</div>
        <div class="chip${initialData.showModels ? ' active' : ''}" data-kind="model">Model</div>
        <div class="chip" data-kind="test">Test</div>
        <div class="chip" data-kind="file">File</div>
      </div>

      <button class="action-btn" id="btnFitView">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        Fit Whole Graph
      </button>
    </div>

    <div class="zoom-controls">
      <button class="zoom-btn" id="btnZoomIn" title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button class="zoom-btn" id="btnZoomOut" title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button class="zoom-btn" id="btnZoomFit" title="Fit to view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      </button>
    </div>

    <div class="helper-hint">
      Scroll to Zoom • Drag to Pan • Click Node to Inspect
    </div>

    <canvas id="graphCanvas"></canvas>

    <div id="tooltip"></div>

    <div id="details-drawer">
      <div class="drawer-header">
        <div>
          <span class="detail-kind-badge" id="drawerBadge">Symbol</span>
          <h2 class="detail-title" id="drawerTitle">Name</h2>
          <div class="drawer-actions">
            <button class="drawer-action-btn" id="btnDrawerFocus">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
              Focus Subsystem
            </button>
            <button class="drawer-action-btn" id="btnDrawerImpact">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Blast Radius
            </button>
          </div>
        </div>
        <button class="drawer-close" id="drawerClose" title="Close drawer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div></div>

      <div class="drawer-content">
        <div class="detail-urn" id="drawerUrn">urn:trace:...</div>

        <div id="drawerLocationContainer">
          <div class="detail-section-heading">Location</div>
          <div id="drawerLocation" style="font-size: 13px; color: var(--text-muted); font-family: var(--font-mono);">src/file.ts</div>
          <a class="editor-btn" id="drawerEditorLink" target="_blank">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Open in Editor
          </a>
        </div>

        <div class="detail-section" id="drawerFeaturesSection">
          <div class="detail-section-heading">Connected Features & Evidence</div>
          <div class="detail-item-list" id="drawerFeaturesList"></div>
        </div>

        <div class="detail-section" id="drawerImpactSection">
          <div class="detail-section-heading">Blast Radius / Impact</div>
          <div class="detail-item-list" id="drawerImpactList"></div>
        </div>

        <div class="detail-section" id="drawerEdgesSection">
          <div class="detail-section-heading">Relationships</div>
          <div class="detail-item-list" id="drawerEdgesList"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const config = {
        repoRoot: ${JSON.stringify(initialData.repoRoot)},
        focusFeature: ${JSON.stringify(initialData.focusFeature || '')},
        focusSymbol: ${JSON.stringify(initialData.focusSymbol || '')},
        focusImpact: ${JSON.stringify(initialData.focusImpact || '')},
        showModels: ${Boolean(initialData.showModels)}
      };

      let allNodes = [];
      let allEdges = [];
      let features = [];
      let clusters = []; // Cluster metadata
      let nodeMap = new Map();
      let neighborMap = new Map(); // urn -> Set of connected urns
      let edgeMap = new Map();     // urn -> Array of edges

      // Check query param for models & tests override if present
      const urlParams = new URLSearchParams(window.location.search);
      const modelsQuery = urlParams.get('models');
      const initialShowModels = modelsQuery !== null
        ? (modelsQuery === 'true' || modelsQuery === '1')
        : config.showModels;

      // Default active kinds: file, model, and test are turned off by default to prevent visual clutter
      let activeKinds = new Set(['feature', 'route', 'symbol']);
      if (initialShowModels) {
        activeKinds.add('model');
      }
      if (urlParams.get('tests') === 'true' || urlParams.get('tests') === '1') {
        activeKinds.add('test');
        const testChip = document.querySelector('#kindChips .chip[data-kind="test"]');
        if (testChip) testChip.classList.add('active');
      }

      // Sync chip class if overridden via URL parameter
      const initialModelChip = document.querySelector('#kindChips .chip[data-kind="model"]');
      if (initialModelChip) {
        if (activeKinds.has('model')) {
          initialModelChip.classList.add('active');
        } else {
          initialModelChip.classList.remove('active');
        }
      }
      let activeMode = 'all';
      let selectedFeature = config.focusFeature;
      let selectedNode = null;
      let hoveredNode = null;
      let searchQuery = '';

      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      const tooltip = document.getElementById('tooltip');

      let width = 0;
      let height = 0;
      let scale = 1.0;
      let panX = 0;
      let panY = 0;
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let draggedNode = null;

      // Simulation temperature / cooling parameter
      let alpha = 1.0;
      let isSimRunning = false;
      let needsRender = true;

      const colors = {
        feature: '#c084fc',
        route: '#4ade80',
        symbol: '#38bdf8',
        model: '#22d3ee',
        test: '#fbbf24',
        file: '#94a3b8'
      };

      function resize() {
        const dpr = window.devicePixelRatio || 1;
        width = canvas.parentElement.clientWidth;
        height = canvas.parentElement.clientHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.resetTransform ? ctx.resetTransform() : ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        requestRender();
      }
      window.addEventListener('resize', resize);
      resize();

      function requestRender() {
        needsRender = true;
      }

      // Fetch Graph Data
      async function loadGraphData() {
        try {
          const res = await fetch('/api/graph');
          const data = await res.json();
          allNodes = data.nodes || [];
          allEdges = data.edges || [];
          features = data.features || [];

          document.getElementById('statNodes').textContent = allNodes.length;
          document.getElementById('statEdges').textContent = allEdges.length;
          document.getElementById('statFeatures').textContent = features.length;

          // Build node maps & neighbor maps
          nodeMap.clear();
          neighborMap.clear();
          edgeMap.clear();

          allNodes.forEach(n => {
            nodeMap.set(n.urn, n);
            neighborMap.set(n.urn, new Set());
            edgeMap.set(n.urn, []);
          });

          allEdges.forEach(e => {
            if (neighborMap.has(e.sourceUrn)) neighborMap.get(e.sourceUrn).add(e.targetUrn);
            if (neighborMap.has(e.targetUrn)) neighborMap.get(e.targetUrn).add(e.sourceUrn);
            if (edgeMap.has(e.sourceUrn)) edgeMap.get(e.sourceUrn).push(e);
            if (edgeMap.has(e.targetUrn)) edgeMap.get(e.targetUrn).push(e);
          });

          // Populate feature select dropdown
          const sel = document.getElementById('featureSelect');
          sel.innerHTML = '<option value="">-- All Features --</option>';
          features.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.displayName;
            opt.textContent = f.displayName;
            if (f.displayName === selectedFeature) opt.selected = true;
            sel.appendChild(opt);
          });

          setupClusteredGalaxyLayout();
        } catch (e) {
          console.error('Failed to load graph data:', e);
        }
      }

      // Determines a human-readable cluster / module category for any node
      function getNodeClusterKey(node) {
        if (node.kind === 'feature') {
          return 'feat:' + node.urn;
        }

        // 1. Direct or 1-hop connected feature
        const neighbors = neighborMap.get(node.urn) || new Set();
        for (const nUrn of neighbors) {
          const nNode = nodeMap.get(nUrn);
          if (nNode && nNode.kind === 'feature') {
            return 'feat:' + nNode.urn;
          }
        }

        // 2. 2-hop connection to a feature (traceable subsystem linkage)
        for (const nUrn of neighbors) {
          const secondHop = neighborMap.get(nUrn) || new Set();
          for (const sUrn of secondHop) {
            const sNode = nodeMap.get(sUrn);
            if (sNode && sNode.kind === 'feature') {
              return 'feat:' + sNode.urn;
            }
          }
        }

        // 3. Fallback: Group by core repository subsystem
        const p = node.path || '';
        if (p.includes('packages/trace/src/core')) return 'mod:Core Engine';
        if (p.includes('packages/trace/src/indexer')) return 'mod:Indexer';
        if (p.includes('packages/trace/src/analyzer')) return 'mod:Analyzer';
        if (p.includes('packages/trace/src/intelligence')) return 'mod:Intelligence';
        if (p.includes('packages/trace/src/graph-ui')) return 'mod:Graph UI';
        if (p.includes('packages/trace/src/cli') || p.includes('packages/trace/bin')) return 'mod:CLI';
        if (p.includes('packages/amvelt-trace')) return 'mod:Amvelt Distribution';
        if (p.startsWith('fixtures/')) return 'mod:Fixtures';
        if (p.startsWith('tests/')) return 'mod:Tests';

        return 'mod:Shared Utilities';
      }

      // Feature & Module Galaxy Layout (Balanced Constellation)
      function setupClusteredGalaxyLayout() {
        const clusterBuckets = new Map();

        allNodes.forEach(n => {
          const key = getNodeClusterKey(n);
          n.clusterKey = key;
          if (!clusterBuckets.has(key)) clusterBuckets.set(key, []);
          clusterBuckets.get(key).push(n);
        });

        clusters = [];
        const featKeys = Array.from(clusterBuckets.keys()).filter(k => k.startsWith('feat:'));
        const modKeys = Array.from(clusterBuckets.keys()).filter(k => !k.startsWith('feat:'));

        // Feature hubs form the primary architectural orbit (comfortably visible)
        const featRingRadius = Math.max(480, featKeys.length * 60);

        featKeys.forEach((key, idx) => {
          const angle = (idx / Math.max(1, featKeys.length)) * 2 * Math.PI - Math.PI / 2;
          const cx = Math.cos(angle) * featRingRadius;
          const cy = Math.sin(angle) * featRingRadius;
          const featUrn = key.replace('feat:', '');
          const featNode = nodeMap.get(featUrn);
          const label = featNode ? (featNode.displayName || featNode.name) : 'Feature';

          clusters.push({
            key,
            label,
            isFeature: true,
            x: cx,
            y: cy,
            count: clusterBuckets.get(key).length
          });
        });

        // Shared/Internal module clusters sit in a compact central constellation
        const modRingRadius = Math.max(220, modKeys.length * 30);
        modKeys.forEach((key, idx) => {
          const angle = (idx / Math.max(1, modKeys.length)) * 2 * Math.PI;
          const cx = Math.cos(angle) * modRingRadius;
          const cy = Math.sin(angle) * modRingRadius;
          const label = key.replace('mod:', '');

          clusters.push({
            key,
            label,
            isFeature: false,
            x: cx,
            y: cy,
            count: clusterBuckets.get(key).length
          });
        });

        // Distribute nodes around their cluster anchor with generous spacing
        clusters.forEach(c => {
          const nodes = clusterBuckets.get(c.key) || [];
          nodes.forEach((n, idx) => {
            n.vx = 0;
            n.vy = 0;

            if (n.kind === 'feature') {
              n.x = c.x;
              n.y = c.y;
              n.radius = 28;
            } else {
              n.radius = n.kind === 'route' ? 18 : (n.kind === 'model' ? 14 : (n.kind === 'test' ? 12 : (n.kind === 'file' ? 11 : 12)));
              // Wide Fermat / golden spiral distribution around cluster center
              const phi = idx * 2.39996;
              const r = 55 + Math.sqrt(idx + 1) * 26;
              n.x = c.x + Math.cos(phi) * r;
              n.y = c.y + Math.sin(phi) * r;
            }

            n.clusterX = c.x;
            n.clusterY = c.y;
          });
        });

        // If focus requested from CLI config
        if (config.focusSymbol) {
          const target = allNodes.find(n => n.name === config.focusSymbol || n.urn.includes(config.focusSymbol));
          if (target) selectNode(target);
        }

        // Start smooth simulation
        alpha = 1.0;
        startSimulation();
        fitView();
      }

      // Filter Nodes according to active view mode & toggles
      function getVisibleNodes() {
        return allNodes.filter(n => {
          if (!activeKinds.has(n.kind)) return false;

          if (activeMode === 'architecture' || activeMode === 'features') {
            if (n.kind !== 'feature' && n.kind !== 'route') return false;
          }

          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesName = (n.displayName || n.name).toLowerCase().includes(q);
            const matchesPath = (n.path || '').toLowerCase().includes(q);
            if (!matchesName && !matchesPath) return false;
          }

          if (selectedFeature) {
            const feat = features.find(f => f.displayName === selectedFeature);
            if (feat) {
              if (n.urn === feat.urn) return true;
              const isConnected = neighborMap.get(feat.urn)?.has(n.urn) || false;
              if (!isConnected) return false;
            }
          }

          if (activeMode === 'focus' && selectedNode) {
            if (n.urn === selectedNode.urn) return true;
            const isNeighbor = neighborMap.get(selectedNode.urn)?.has(n.urn) || false;
            if (!isNeighbor) return false;
          }

          if (activeMode === 'impact' && selectedNode) {
            if (n.urn === selectedNode.urn) return true;
            const isDirect = neighborMap.get(selectedNode.urn)?.has(n.urn) || false;
            if (!isDirect) return false;
          }

          return true;
        });
      }

      // Fast Force-directed simulation tick
      function stepSimulation() {
        if (alpha < 0.005) {
          isSimRunning = false;
          return;
        }

        const visibleNodes = getVisibleNodes();
        const visibleSet = new Set(visibleNodes.map(n => n.urn));

        // 1. Cluster Attraction (gentle anchor pull)
        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          if (n === draggedNode) continue;

          const targetX = n.clusterX || 0;
          const targetY = n.clusterY || 0;
          n.vx += (targetX - n.x) * 0.012 * alpha;
          n.vy += (targetY - n.y) * 0.012 * alpha;
        }

        // 2. Spring forces along edges (O(E))
        for (let i = 0; i < allEdges.length; i++) {
          const e = allEdges[i];
          if (!visibleSet.has(e.sourceUrn) || !visibleSet.has(e.targetUrn)) continue;

          const a = nodeMap.get(e.sourceUrn);
          const b = nodeMap.get(e.targetUrn);
          if (!a || !b) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = (a.kind === 'feature' || b.kind === 'feature') ? 110 : 65;
          const force = (dist - targetDist) * 0.015 * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (a !== draggedNode) {
            a.vx += fx;
            a.vy += fy;
          }
          if (b !== draggedNode) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }

        // 3. Local repulsion using spatial grid with generous margin (prevents overlaps)
        const gridSize = 120;
        const grid = new Map();
        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          const gx = Math.floor(n.x / gridSize);
          const gy = Math.floor(n.y / gridSize);
          const key = gx + ',' + gy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(n);
        }

        for (const [key, cellNodes] of grid.entries()) {
          const [gxStr, gyStr] = key.split(',');
          const gx = parseInt(gxStr, 10);
          const gy = parseInt(gyStr, 10);

          const neighborsToCheck = cellNodes.concat(
            grid.get((gx + 1) + ',' + gy) || [],
            grid.get(gx + ',' + (gy + 1)) || [],
            grid.get((gx + 1) + ',' + (gy + 1)) || []
          );

          for (let i = 0; i < cellNodes.length; i++) {
            const a = cellNodes[i];
            for (let j = 0; j < neighborsToCheck.length; j++) {
              const b = neighborsToCheck[j];
              if (a === b) continue;

              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const distSq = dx * dx + dy * dy;
              const minDist = a.radius + b.radius + 30;

              if (distSq < minDist * minDist && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = ((minDist - dist) / dist) * 0.45 * alpha;
                const fx = dx * force;
                const fy = dy * force;

                if (a !== draggedNode) {
                  a.vx -= fx;
                  a.vy -= fy;
                }
                if (b !== draggedNode) {
                  b.vx += fx;
                  b.vy += fy;
                }
              }
            }
          }
        }

        // 4. Position update & damping
        const damping = 0.72;
        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          if (n !== draggedNode) {
            n.vx *= damping;
            n.vy *= damping;
            n.x += n.vx;
            n.y += n.vy;
          }
        }

        // Smooth energy cooling
        alpha *= 0.94;
        requestRender();
      }

      function startSimulation(initialAlpha = 1.0) {
        alpha = initialAlpha;
        if (isSimRunning) return;
        isSimRunning = true;

        function loop() {
          if (alpha >= 0.005) {
            stepSimulation();
            requestAnimationFrame(loop);
          } else {
            isSimRunning = false;
            requestRender();
          }
        }
        requestAnimationFrame(loop);
      }

      // Render Loop — Runs only when dirty or simulation active
      function render() {
        if (!needsRender && !isSimRunning) {
          requestAnimationFrame(render);
          return;
        }
        needsRender = false;

        const visibleNodes = getVisibleNodes();
        const visibleSet = new Set(visibleNodes.map(n => n.urn));

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);

        const selectedNeighbors = selectedNode ? (neighborMap.get(selectedNode.urn) || new Set()) : null;

        // --- 1. Draw Feature Cluster Aura Hulls ---
        if (activeMode !== 'focus' && activeMode !== 'impact') {
          for (let i = 0; i < clusters.length; i++) {
            const c = clusters[i];
            if (!c.isFeature) continue;

            const members = visibleNodes.filter(n => n.clusterKey === c.key);
            if (members.length === 0) continue;

            let maxDist = 70;
            for (let m = 0; m < members.length; m++) {
              const dx = members[m].x - c.x;
              const dy = members[m].y - c.y;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d > maxDist) maxDist = d;
            }

            const auraRadius = maxDist + 22;

            // Translucent glowing island background
            const grad = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, auraRadius);
            grad.addColorStop(0, 'rgba(192, 132, 252, 0.05)');
            grad.addColorStop(0.7, 'rgba(192, 132, 252, 0.02)');
            grad.addColorStop(1, 'rgba(192, 132, 252, 0.0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, auraRadius, 0, Math.PI * 2);
            ctx.fill();

            // Island perimeter boundary
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.14)';
            ctx.lineWidth = 1 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.beginPath();
            ctx.arc(c.x, c.y, auraRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Island title pill
            ctx.font = '600 ' + Math.max(10, 11 / scale) + 'px var(--font-sans)';
            ctx.fillStyle = 'rgba(192, 132, 252, 0.65)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(c.label.toUpperCase(), c.x, c.y - auraRadius - 4 / scale);
          }
        }

        // --- 2. Draw Edges ---
        // Normal background edges pass
        ctx.lineWidth = 1.0 / scale;
        for (let i = 0; i < allEdges.length; i++) {
          const e = allEdges[i];
          if (!visibleSet.has(e.sourceUrn) || !visibleSet.has(e.targetUrn)) continue;

          const a = nodeMap.get(e.sourceUrn);
          const b = nodeMap.get(e.targetUrn);
          if (!a || !b) continue;

          const isHighlight = selectedNode && (
            (e.sourceUrn === selectedNode.urn && selectedNeighbors.has(e.targetUrn)) ||
            (e.targetUrn === selectedNode.urn && selectedNeighbors.has(e.sourceUrn))
          );
          if (isHighlight) continue;

          const isDimmed = selectedNode !== null;
          ctx.strokeStyle = isDimmed ? 'rgba(30, 41, 59, 0.25)' : 'rgba(56, 189, 248, 0.12)';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        // Highlighted edges pass
        if (selectedNode) {
          ctx.lineWidth = 2.4 / scale;
          for (let i = 0; i < allEdges.length; i++) {
            const e = allEdges[i];
            if (!visibleSet.has(e.sourceUrn) || !visibleSet.has(e.targetUrn)) continue;

            const isHighlight = (
              (e.sourceUrn === selectedNode.urn && selectedNeighbors.has(e.targetUrn)) ||
              (e.targetUrn === selectedNode.urn && selectedNeighbors.has(e.sourceUrn))
            );
            if (!isHighlight) continue;

            const a = nodeMap.get(e.sourceUrn);
            const b = nodeMap.get(e.targetUrn);
            if (!a || !b) continue;

            ctx.strokeStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // --- 3. Draw Nodes ---
        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          const isSelected = selectedNode && selectedNode.urn === n.urn;
          const isConnected = selectedNeighbors && selectedNeighbors.has(n.urn);
          const isHovered = hoveredNode && hoveredNode.urn === n.urn;
          const isDimmed = selectedNode && !isSelected && !isConnected;

          const baseColor = colors[n.kind] || '#94a3b8';

          // Node body
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);

          if (isDimmed) {
            ctx.fillStyle = 'rgba(20, 27, 40, 0.5)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(35, 47, 70, 0.4)';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();
          } else {
            ctx.fillStyle = isSelected ? '#ffffff' : (isHovered ? '#ffffff' : baseColor);
            ctx.fill();

            if (isSelected) {
              ctx.lineWidth = 3.5 / scale;
              ctx.strokeStyle = '#38bdf8';
              ctx.stroke();

              // Outer glow halo
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.radius + 6 / scale, 0, 2 * Math.PI);
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
              ctx.lineWidth = 2 / scale;
              ctx.stroke();
            } else if (n.kind === 'feature') {
              // Feature nodes have a distinct outer purple ring
              ctx.lineWidth = 3.0 / scale;
              ctx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
              ctx.stroke();
            } else if (isConnected) {
              ctx.lineWidth = 2.2 / scale;
              ctx.strokeStyle = '#38bdf8';
              ctx.stroke();
            } else {
              ctx.lineWidth = 1.5 / scale;
              ctx.strokeStyle = 'rgba(8, 12, 20, 0.7)';
              ctx.stroke();
            }
          }
        }

        // --- 4. Zero-Overlap Greedy Label Placement Pass ---
        // Mathematically prevents any two labels from colliding or overlapping
        const placedLabels = [];

        function labelCollides(x1, y1, x2, y2) {
          for (let k = 0; k < placedLabels.length; k++) {
            const p = placedLabels[k];
            if (x1 < p.x2 && x2 > p.x1 && y1 < p.y2 && y2 > p.y1) {
              return true;
            }
          }
          return false;
        }

        const labelQueue = [];

        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          const isSelected = selectedNode && selectedNode.urn === n.urn;
          const isHovered = hoveredNode && hoveredNode.urn === n.urn;
          const isConnected = selectedNeighbors && selectedNeighbors.has(n.urn);
          const isDimmed = selectedNode && !isSelected && !isConnected;

          if (isDimmed) continue;

          let priority = 4;
          if (isSelected || isHovered) priority = 1;
          else if (n.kind === 'feature') priority = 2;
          else if (n.kind === 'route' || isConnected) priority = 3;
          else if (scale > 0.8) priority = 4;
          else continue;

          labelQueue.push({ node: n, priority });
        }

        // Sort by priority ascending (highest priority 1 placed first)
        labelQueue.sort((a, b) => a.priority - b.priority);

        for (let i = 0; i < labelQueue.length; i++) {
          const item = labelQueue[i];
          const n = item.node;
          const isFeature = n.kind === 'feature';
          const isSelected = selectedNode && selectedNode.urn === n.urn;
          const isHovered = hoveredNode && hoveredNode.urn === n.urn;

          const displayName = isFeature ? (n.displayName || n.name) : n.name;
          const maxLen = (isFeature || isSelected || isHovered) ? 32 : 20;
          const label = displayName.length > maxLen ? displayName.slice(0, maxLen - 1) + '…' : displayName;

          const fontSize = isFeature ? Math.max(12, 13 / scale) : Math.max(10, 11 / scale);
          ctx.font = (isFeature || isSelected ? '600 ' : '500 ') + fontSize + 'px var(--font-sans)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textWidth = ctx.measureText(label).width;
          const badgeWidth = textWidth + 12 / scale;
          const badgeHeight = (fontSize + 6) / scale;
          const badgeX = n.x - badgeWidth / 2;
          const badgeY = n.y + n.radius + 6 / scale;

          // Margin padding for collision box
          const box = {
            x1: badgeX - 3 / scale,
            y1: badgeY - 2 / scale,
            x2: badgeX + badgeWidth + 3 / scale,
            y2: badgeY + badgeHeight + 2 / scale
          };

          if (item.priority > 1 && labelCollides(box.x1, box.y1, box.x2, box.y2)) {
            continue; // Skip rendering this label to avoid collision!
          }

          placedLabels.push(box);

          // Capsule background
          ctx.fillStyle = isFeature ? 'rgba(30, 20, 48, 0.92)' : (isSelected ? 'rgba(8, 30, 52, 0.92)' : 'rgba(8, 12, 20, 0.88)');
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4 / scale);
          } else {
            ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
          }
          ctx.fill();

          ctx.strokeStyle = isFeature ? 'rgba(192, 132, 252, 0.6)' : (isSelected ? 'rgba(56, 189, 248, 0.7)' : 'rgba(30, 41, 59, 0.65)');
          ctx.lineWidth = 1 / scale;
          ctx.stroke();

          // Text label
          ctx.fillStyle = isFeature ? '#f3e8ff' : (isSelected ? '#38bdf8' : (isHovered ? '#ffffff' : '#f1f5f9'));
          ctx.fillText(label, n.x, badgeY + 3 / scale);
        }

        ctx.restore();
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);

      // Fit entire graph view cleanly on screen
      function fitView() {
        const visibleNodes = getVisibleNodes();
        if (visibleNodes.length === 0) {
          scale = 1.0;
          panX = width / 2;
          panY = height / 2;
          requestRender();
          return;
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        visibleNodes.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.x > maxX) maxX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.y > maxY) maxY = n.y;
        });

        const padding = 100;
        const boxWidth = Math.max(300, (maxX - minX) + padding * 2);
        const boxHeight = Math.max(300, (maxY - minY) + padding * 2);

        const targetScale = Math.min(1.2, Math.max(0.06, Math.min(width / boxWidth, height / boxHeight)));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        scale = targetScale;
        panX = (width / 2) - (centerX * scale);
        panY = (height / 2) - (centerY * scale);
        requestRender();
      }

      // Fly Camera to Specific Node
      function focusOnNode(node) {
        if (!node) return;
        scale = Math.max(1.1, Math.min(2.5, scale));
        panX = (width / 2) - (node.x * scale);
        panY = (height / 2) - (node.y * scale);
        requestRender();
      }

      // --- Interaction: Pan & Zoom & Click ---

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomDelta = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.max(0.04, Math.min(5.0, scale * zoomDelta));

        panX = mouseX - (mouseX - panX) * (newScale / scale);
        panY = mouseY - (mouseY - panY) * (newScale / scale);
        scale = newScale;
        requestRender();
      }, { passive: false });

      canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panX) / scale;
        const my = (e.clientY - rect.top - panY) / scale;

        const visibleNodes = getVisibleNodes();
        const clicked = visibleNodes.find(n => {
          const dx = n.x - mx;
          const dy = n.y - my;
          const hitRadius = Math.max(n.radius, 16 / scale);
          return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
        });

        if (clicked) {
          draggedNode = clicked;
          selectNode(clicked);
        } else {
          isDragging = true;
          dragStartX = e.clientX - panX;
          dragStartY = e.clientY - panY;
          canvas.classList.add('dragging');
        }
      });

      window.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panX) / scale;
        const my = (e.clientY - rect.top - panY) / scale;

        if (draggedNode) {
          draggedNode.x = mx;
          draggedNode.y = my;
          draggedNode.vx = 0;
          draggedNode.vy = 0;
          startSimulation(0.2);
          requestRender();
        } else if (isDragging) {
          panX = e.clientX - dragStartX;
          panY = e.clientY - dragStartY;
          requestRender();
        } else {
          // Hover detection
          const visibleNodes = getVisibleNodes();
          const hovered = visibleNodes.find(n => {
            const dx = n.x - mx;
            const dy = n.y - my;
            const hitRadius = Math.max(n.radius, 15 / scale);
            return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
          });

          if (hovered !== hoveredNode) {
            hoveredNode = hovered;
            requestRender();
          }

          if (hovered) {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top = (e.clientY + 14) + 'px';
            tooltip.innerHTML = '<b style="color:' + (colors[hovered.kind] || '#fff') + '">' + (hovered.displayName || hovered.name) + '</b> <span style="color:#64748b">[' + hovered.kind + ']</span>' +
              (hovered.path ? '<br><span style="color:#94a3b8;font-size:11px">' + hovered.path + '</span>' : '');
          } else {
            tooltip.style.display = 'none';
          }
        }
      });

      window.addEventListener('mouseup', () => {
        draggedNode = null;
        if (isDragging) {
          isDragging = false;
          canvas.classList.remove('dragging');
        }
      });

      canvas.addEventListener('dblclick', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panX) / scale;
        const my = (e.clientY - rect.top - panY) / scale;

        const visibleNodes = getVisibleNodes();
        const clicked = visibleNodes.find(n => {
          const dx = n.x - mx;
          const dy = n.y - my;
          const hitRadius = Math.max(n.radius, 16 / scale);
          return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
        });

        if (clicked) {
          focusOnNode(clicked);
        }
      });

      // Node Selection & Details Drawer
      async function selectNode(node) {
        selectedNode = node;
        requestRender();

        const drawer = document.getElementById('details-drawer');
        drawer.classList.add('open');

        const badge = document.getElementById('drawerBadge');
        badge.textContent = node.kind;
        badge.className = 'detail-kind-badge kind-' + node.kind;

        document.getElementById('drawerTitle').textContent = node.displayName || node.name;
        document.getElementById('drawerUrn').textContent = node.urn;

        const locContainer = document.getElementById('drawerLocationContainer');
        if (node.path) {
          locContainer.style.display = 'block';
          document.getElementById('drawerLocation').textContent = node.path + (node.startLine ? ':' + node.startLine : '');
          const editorLink = document.getElementById('drawerEditorLink');
          editorLink.href = 'vscode://file/' + config.repoRoot + '/' + node.path + (node.startLine ? ':' + node.startLine : '');
        } else {
          locContainer.style.display = 'none';
        }

        // Fetch detailed relationships from API
        try {
          const res = await fetch('/api/node?urn=' + encodeURIComponent(node.urn));
          const details = await res.json();

          // Connected Features
          const featList = document.getElementById('drawerFeaturesList');
          featList.innerHTML = '';
          if (details.features && details.features.length > 0) {
            details.features.forEach(f => {
              const item = document.createElement('div');
              item.className = 'detail-item';
              item.innerHTML = '<div class="detail-item-title" style="color:var(--accent-purple)">' + f.name + ' [' + f.confidence + ']</div><div class="detail-item-subtitle">' + f.reason + '</div>';
              item.onclick = () => {
                const fn = allNodes.find(n => n.name.toLowerCase() === f.name.toLowerCase() && n.kind === 'feature');
                if (fn) {
                  selectNode(fn);
                  focusOnNode(fn);
                }
              };
              featList.appendChild(item);
            });
          } else {
            featList.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No direct feature links.</div>';
          }

          // Impact
          const impactList = document.getElementById('drawerImpactList');
          impactList.innerHTML = '';
          if (details.impact && (details.impact.consumers.length > 0 || details.impact.tests.length > 0)) {
            details.impact.consumers.forEach(c => {
              const item = document.createElement('div');
              item.className = 'detail-item';
              item.innerHTML = '<div class="detail-item-title">Consumer: ' + c.name + '</div><div class="detail-item-subtitle">' + c.path + '</div>';
              item.onclick = () => {
                const target = nodeMap.get(c.urn);
                if (target) {
                  selectNode(target);
                  focusOnNode(target);
                }
              };
              impactList.appendChild(item);
            });
            details.impact.tests.forEach(t => {
              const item = document.createElement('div');
              item.className = 'detail-item';
              item.innerHTML = '<div class="detail-item-title" style="color:var(--accent-amber)">Test: ' + t.name + '</div><div class="detail-item-subtitle">' + t.path + '</div>';
              item.onclick = () => {
                const target = nodeMap.get(t.urn);
                if (target) {
                  selectNode(target);
                  focusOnNode(target);
                }
              };
              impactList.appendChild(item);
            });
          } else {
            impactList.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No direct dependents or tests mapped.</div>';
          }

          // Edges
          const edgesList = document.getElementById('drawerEdgesList');
          edgesList.innerHTML = '';
          const nodeEdges = edgeMap.get(node.urn) || [];
          if (nodeEdges.length > 0) {
            nodeEdges.slice(0, 12).forEach(e => {
              const isOut = e.sourceUrn === node.urn;
              const otherUrn = isOut ? e.targetUrn : e.sourceUrn;
              const other = nodeMap.get(otherUrn);
              const item = document.createElement('div');
              item.className = 'detail-item';
              item.innerHTML = '<div class="detail-item-title">' + (isOut ? '→ ' : '← ') + e.relationship + ' : ' + (other ? (other.displayName || other.name) : otherUrn) + '</div><div class="detail-item-subtitle">' + (e.evidence?.reason || '') + '</div>';
              item.onclick = () => {
                if (other) {
                  selectNode(other);
                  focusOnNode(other);
                }
              };
              edgesList.appendChild(item);
            });
          } else {
            edgesList.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No relationships recorded.</div>';
          }
        } catch (e) {
          console.error('Failed to load node details:', e);
        }
      }

      document.getElementById('drawerClose').addEventListener('click', () => {
        document.getElementById('details-drawer').classList.remove('open');
        selectedNode = null;
        requestRender();
      });

      // Drawer quick action buttons
      const btnFocus = document.getElementById('btnDrawerFocus');
      if (btnFocus) {
        btnFocus.addEventListener('click', () => {
          if (!selectedNode) return;
          document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.remove('active'));
          document.querySelector('#modeChips .chip[data-mode="focus"]')?.classList.add('active');
          activeMode = 'focus';
          startSimulation(0.6);
          focusOnNode(selectedNode);
        });
      }

      const btnImpact = document.getElementById('btnDrawerImpact');
      if (btnImpact) {
        btnImpact.addEventListener('click', () => {
          if (!selectedNode) return;
          document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.remove('active'));
          document.querySelector('#modeChips .chip[data-mode="impact"]')?.classList.add('active');
          activeMode = 'impact';
          startSimulation(0.6);
          focusOnNode(selectedNode);
        });
      }

      // Search Autocomplete & Filtering
      const searchInput = document.getElementById('searchInput');
      const searchDropdown = document.getElementById('searchDropdown');

      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        requestRender();

        if (searchQuery.length >= 2) {
          const q = searchQuery.toLowerCase();
          const matches = allNodes
            .filter(n => (n.displayName || n.name).toLowerCase().includes(q) || (n.path || '').toLowerCase().includes(q))
            .slice(0, 8);

          if (matches.length > 0) {
            searchDropdown.innerHTML = '';
            matches.forEach(m => {
              const item = document.createElement('div');
              item.className = 'search-item';
              item.innerHTML = '<span class="search-item-name">' + (m.displayName || m.name) + '</span>' +
                '<span class="search-item-kind kind-' + m.kind + '">' + m.kind + '</span>';
              item.onclick = () => {
                selectNode(m);
                focusOnNode(m);
                searchDropdown.style.display = 'none';
                searchInput.value = m.displayName || m.name;
              };
              searchDropdown.appendChild(item);
            });
            searchDropdown.style.display = 'block';
          } else {
            searchDropdown.style.display = 'none';
          }
        } else {
          searchDropdown.style.display = 'none';
        }
      });

      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const visible = getVisibleNodes();
          if (visible.length > 0) {
            selectNode(visible[0]);
            focusOnNode(visible[0]);
          }
          if (searchDropdown) searchDropdown.style.display = 'none';
        } else if (e.key === 'Escape') {
          if (searchDropdown) searchDropdown.style.display = 'none';
        }
      });

      document.addEventListener('click', e => {
        if (!searchInput.contains(e.target) && searchDropdown && !searchDropdown.contains(e.target)) {
          searchDropdown.style.display = 'none';
        }
      });

      document.getElementById('featureSelect').addEventListener('change', e => {
        selectedFeature = e.target.value;
        startSimulation(0.6);
        fitView();
      });

      document.querySelectorAll('#modeChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          activeMode = chip.dataset.mode;
          startSimulation(0.6);
          fitView();
        });
      });

      document.querySelectorAll('#kindChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          const kind = chip.dataset.kind;
          if (activeKinds.has(kind)) activeKinds.delete(kind);
          else activeKinds.add(kind);
          startSimulation(0.5);
          requestRender();
        });
      });

      document.getElementById('btnFitView').addEventListener('click', () => {
        fitView();
      });

      document.getElementById('btnZoomIn').addEventListener('click', () => {
        const mouseX = width / 2;
        const mouseY = height / 2;
        const newScale = Math.min(5.0, scale * 1.25);
        panX = mouseX - (mouseX - panX) * (newScale / scale);
        panY = mouseY - (mouseY - panY) * (newScale / scale);
        scale = newScale;
        requestRender();
      });

      document.getElementById('btnZoomOut').addEventListener('click', () => {
        const mouseX = width / 2;
        const mouseY = height / 2;
        const newScale = Math.max(0.04, scale * 0.8);
        panX = mouseX - (mouseX - panX) * (newScale / scale);
        panY = mouseY - (mouseY - panY) * (newScale / scale);
        scale = newScale;
        requestRender();
      });

      document.getElementById('btnZoomFit').addEventListener('click', () => {
        fitView();
      });

      loadGraphData();
    })();
  </script>
</body>
</html>`;
}
