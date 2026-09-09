// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt

export function generateGraphHtml(initialData: {
  repoRoot: string;
  focusFeature?: string;
  focusSymbol?: string;
  focusImpact?: string;
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
      --bg-base: #07090e;
      --bg-panel: rgba(13, 17, 26, 0.88);
      --bg-card: #131a29;
      --bg-card-hover: #1c263b;
      --border: #202b40;
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
      background: rgba(9, 12, 19, 0.95);
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
      width: 340px;
    }

    .search-box input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 8px 14px 8px 34px;
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
      left: 11px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 13px;
      color: var(--text-dim);
      pointer-events: none;
    }

    .stats-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      padding: 4px 10px;
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
      background: radial-gradient(circle at 50% 50%, #0d131f 0%, #07090e 100%);
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
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
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
      padding: 7px 10px;
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
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .action-btn:hover {
      background: #27354f;
      border-color: var(--accent-blue);
    }

    /* Zoom / Canvas Controls */
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
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .zoom-btn:hover { background: var(--bg-card-hover); }
    .zoom-btn + .zoom-btn { border-top: 1px solid var(--border); }

    /* Details Slide-out Drawer */
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
      font-size: 22px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .drawer-close:hover { color: var(--text-main); background: rgba(255,255,255,0.06); }

    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .detail-kind-badge {
      display: inline-block;
      padding: 2px 8px;
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
      gap: 6px;
      background: #1e293b;
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 12px;
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

    /* Helper hints */
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
      <span class="search-icon">🔍</span>
      <input type="text" id="searchInput" placeholder="Search features, symbols, APIs (Press Enter to focus)...">
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
        <div class="chip active" data-mode="all" title="Show all indexed elements">All</div>
        <div class="chip" data-mode="features" title="Show only features and key interfaces">Architecture</div>
        <div class="chip" data-mode="focus" title="Focus on selected node and direct connections">Focus</div>
        <div class="chip" data-mode="impact" title="Show blast radius of selected node">Impact</div>
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
        <div class="chip active" data-kind="model">Model</div>
        <div class="chip active" data-kind="test">Test</div>
        <div class="chip" data-kind="file">File</div>
      </div>

      <button class="action-btn" id="btnFitView">⛶ Fit Whole Graph</button>
    </div>

    <div class="zoom-controls">
      <button class="zoom-btn" id="btnZoomIn" title="Zoom in">+</button>
      <button class="zoom-btn" id="btnZoomOut" title="Zoom out">−</button>
      <button class="zoom-btn" id="btnZoomFit" title="Fit to view">⛶</button>
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
        </div>
        <button class="drawer-close" id="drawerClose" title="Close drawer">&times;</button>
      </div>

      <div class="drawer-content">
        <div class="detail-urn" id="drawerUrn">urn:trace:...</div>

        <div id="drawerLocationContainer">
          <div class="detail-section-heading">Location</div>
          <div id="drawerLocation" style="font-size: 13px; color: var(--text-muted); font-family: var(--font-mono);">src/file.ts</div>
          <a class="editor-btn" id="drawerEditorLink" target="_blank">
            <span>💻</span> Open in Editor
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
        focusImpact: ${JSON.stringify(initialData.focusImpact || '')}
      };

      let allNodes = [];
      let allEdges = [];
      let features = [];
      let nodeMap = new Map();
      let neighborMap = new Map(); // urn -> Set of connected urns
      let edgeMap = new Map();     // urn -> Array of edges

      // Default active kinds: file is toggled off by default for clean initial readability
      let activeKinds = new Set(['feature', 'route', 'symbol', 'model', 'test']);
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
      let mouseScreenX = 0;
      let mouseScreenY = 0;

      // Simulation temperature / cooling parameter
      let alpha = 1.0;
      let simTimer = null;
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

          setupInitialLayout();
        } catch (e) {
          console.error('Failed to load graph data:', e);
        }
      }

      // Feature-Centric Cluster Layout
      function setupInitialLayout() {
        const featureNodes = allNodes.filter(n => n.kind === 'feature');
        const featureCount = Math.max(1, featureNodes.length);
        const featureMapLocal = new Map();

        // 1. Arrange Features in a spacious circle
        const ringRadius = Math.max(350, featureCount * 90);
        featureNodes.forEach((f, idx) => {
          const angle = (idx / featureCount) * 2 * Math.PI - Math.PI / 2;
          f.x = Math.cos(angle) * ringRadius;
          f.y = Math.sin(angle) * ringRadius;
          f.vx = 0;
          f.vy = 0;
          f.radius = 28;
          f.clusterX = f.x;
          f.clusterY = f.y;
          featureMapLocal.set(f.urn, f);
        });

        // 2. Associate non-feature nodes with their nearest feature cluster
        const orphanNodes = [];
        allNodes.forEach((n, idx) => {
          if (n.kind === 'feature') return;

          n.vx = 0;
          n.vy = 0;
          n.radius = n.kind === 'route' ? 18 : (n.kind === 'model' ? 18 : (n.kind === 'test' ? 14 : (n.kind === 'file' ? 12 : 14)));

          // Find connected feature
          let parentFeat = null;
          const neighbors = neighborMap.get(n.urn) || new Set();
          for (const neighborUrn of neighbors) {
            if (featureMapLocal.has(neighborUrn)) {
              parentFeat = featureMapLocal.get(neighborUrn);
              break;
            }
          }

          if (parentFeat) {
            // Place orbiting parent feature with deterministic pseudo-random offset
            const angle = (idx * 1.37) % (2 * Math.PI);
            const dist = 70 + (idx % 12) * 16;
            n.x = parentFeat.x + Math.cos(angle) * dist;
            n.y = parentFeat.y + Math.sin(angle) * dist;
            n.clusterX = parentFeat.x;
            n.clusterY = parentFeat.y;
          } else {
            orphanNodes.push(n);
          }
        });

        // 3. Arrange unmapped nodes in a center outer constellation
        const orphanCount = Math.max(1, orphanNodes.length);
        orphanNodes.forEach((n, idx) => {
          const angle = (idx / orphanCount) * 2 * Math.PI;
          const dist = ringRadius * 0.4 + (idx % 5) * 35;
          n.x = Math.cos(angle) * dist;
          n.y = Math.sin(angle) * dist;
          n.clusterX = 0;
          n.clusterY = 0;
        });

        // If focus requested from CLI config
        if (config.focusSymbol) {
          const target = allNodes.find(n => n.name === config.focusSymbol || n.urn.includes(config.focusSymbol));
          if (target) selectNode(target);
        }

        // Start fast simulation with high cooling
        alpha = 1.0;
        startSimulation();
        fitView();
      }

      // Filter Nodes according to active view mode & toggles
      function getVisibleNodes() {
        return allNodes.filter(n => {
          if (!activeKinds.has(n.kind)) return false;

          if (activeMode === 'features') {
            if (n.kind !== 'feature' && n.kind !== 'route') return false;
          }

          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesName = n.name.toLowerCase().includes(q);
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

        // 1. Cluster Attraction & Center Gravity
        for (let i = 0; i < visibleNodes.length; i++) {
          const n = visibleNodes[i];
          if (n === draggedNode) continue;

          // Pull towards cluster center
          const targetX = n.clusterX || 0;
          const targetY = n.clusterY || 0;
          n.vx += (targetX - n.x) * 0.02 * alpha;
          n.vy += (targetY - n.y) * 0.02 * alpha;
        }

        // 2. Spring forces along edges (only O(E), very fast!)
        for (let i = 0; i < allEdges.length; i++) {
          const e = allEdges[i];
          if (!visibleSet.has(e.sourceUrn) || !visibleSet.has(e.targetUrn)) continue;

          const a = nodeMap.get(e.sourceUrn);
          const b = nodeMap.get(e.targetUrn);
          if (!a || !b) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = (a.kind === 'feature' || b.kind === 'feature') ? 140 : 80;
          const force = (dist - targetDist) * 0.03 * alpha;
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

        // 3. Local repulsion using grid/spatial buckets (capped at O(N))
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

          // Compare with nodes in current cell and adjacent 4 cells
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
              const minDist = a.radius + b.radius + 20;

              if (distSq < minDist * minDist && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = ((minDist - dist) / dist) * 0.6 * alpha;
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

        // Cool down
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

        // Highlight sets if a node is selected
        const selectedNeighbors = selectedNode ? (neighborMap.get(selectedNode.urn) || new Set()) : null;

        // --- 1. Draw Edges ---
        // Normal edges pass
        ctx.lineWidth = 1.2 / scale;
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

          if (isHighlight) continue; // Drawn in foreground pass

          const isDimmed = selectedNode !== null;
          ctx.strokeStyle = isDimmed ? 'rgba(32, 43, 64, 0.4)' : 'rgba(56, 189, 248, 0.18)';
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

        // --- 2. Draw Nodes ---
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
            ctx.fillStyle = 'rgba(25, 33, 49, 0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(40, 53, 76, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.fillStyle = isSelected ? '#ffffff' : (isHovered ? '#ffffff' : baseColor);
            ctx.fill();

            // Distinct node borders
            if (isSelected) {
              ctx.lineWidth = 4 / scale;
              ctx.strokeStyle = '#38bdf8';
              ctx.stroke();

              // Outer glow ring
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.radius + 6 / scale, 0, 2 * Math.PI);
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
              ctx.lineWidth = 2 / scale;
              ctx.stroke();
            } else if (isConnected) {
              ctx.lineWidth = 2.5 / scale;
              ctx.strokeStyle = '#38bdf8';
              ctx.stroke();
            } else {
              ctx.lineWidth = 2 / scale;
              ctx.strokeStyle = 'rgba(10, 14, 23, 0.8)';
              ctx.stroke();
            }
          }

          // Node Label (Level of Detail: show if zoomed in or if important)
          const shouldShowLabel = scale > 0.4 || n.kind === 'feature' || isSelected || isConnected || isHovered;
          if (shouldShowLabel && !isDimmed) {
            ctx.fillStyle = isSelected ? '#38bdf8' : (isHovered ? '#ffffff' : '#f1f5f9');
            ctx.font = isSelected ? ('bold ' + Math.max(12, 13 / scale) + 'px var(--font-sans)') : (Math.max(10, 11 / scale) + 'px var(--font-sans)');
            ctx.textAlign = 'center';
            const displayName = n.kind === 'feature' ? (n.displayName || n.name) : n.name;
            const maxLen = 22;
            const label = displayName.length > maxLen ? displayName.slice(0, maxLen - 1) + '…' : displayName;
            ctx.fillText(label, n.x, n.y + n.radius + 14 / scale);
          }
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

        const padding = 80;
        const boxWidth = Math.max(200, (maxX - minX) + padding * 2);
        const boxHeight = Math.max(200, (maxY - minY) + padding * 2);

        const targetScale = Math.min(1.4, Math.max(0.08, Math.min(width / boxWidth, height / boxHeight)));
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
        scale = Math.max(1.0, Math.min(2.5, scale));
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
        // Adaptive hit testing with minimum radius so nodes are easily clickable at any zoom level
        const clicked = visibleNodes.find(n => {
          const dx = n.x - mx;
          const dy = n.y - my;
          const hitRadius = Math.max(n.radius, 15 / scale);
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
        mouseScreenX = e.clientX;
        mouseScreenY = e.clientY;

        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panX) / scale;
        const my = (e.clientY - rect.top - panY) / scale;

        if (draggedNode) {
          draggedNode.x = mx;
          draggedNode.y = my;
          draggedNode.vx = 0;
          draggedNode.vy = 0;
          startSimulation(0.2); // Reheat slightly to adjust neighboring springs
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
            const hitRadius = Math.max(n.radius, 14 / scale);
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

      // Controls
      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        requestRender();
      });

      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const visible = getVisibleNodes();
          if (visible.length > 0) {
            selectNode(visible[0]);
            focusOnNode(visible[0]);
          }
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
