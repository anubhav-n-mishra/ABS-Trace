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
  <style>
    :root {
      --bg-base: #0a0d14;
      --bg-panel: rgba(18, 24, 38, 0.85);
      --bg-card: #151d2e;
      --bg-card-hover: #1c273c;
      --border: #232f48;
      --border-active: #3b82f6;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-blue: #38bdf8;
      --accent-purple: #c084fc;
      --accent-green: #4ade80;
      --accent-amber: #fbbf24;
      --accent-rose: #fb7185;
      --accent-cyan: #22d3ee;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Bar */
    header {
      height: 56px;
      background: rgba(10, 13, 20, 0.95);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 20;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 0.5px;
    }

    .brand-badge {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .search-box {
      position: relative;
      width: 320px;
    }

    .search-box input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 7px 12px 7px 34px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }
    .search-box input:focus {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: var(--text-dim);
    }

    .stats-bar {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stat-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      gap: 6px;
    }
    .stat-pill b { color: var(--text-main); }

    /* Main Container */
    #main-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
    }
    canvas:active { cursor: grabbing; }

    /* Left Control Floating Dock */
    .controls-dock {
      position: absolute;
      top: 16px;
      left: 16px;
      background: var(--bg-panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      width: 250px;
      z-index: 10;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
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
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;
    }
    .chip.active {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--accent-blue);
      color: var(--accent-blue);
      font-weight: 600;
    }

    .select-dropdown {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 14px;
      outline: none;
    }

    .action-btn {
      width: 100%;
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .action-btn:hover { background: #1d4ed8; }

    /* Zoom / Canvas Controls */
    .zoom-controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: var(--bg-panel);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
    }
    .zoom-btn {
      background: transparent;
      border: none;
      color: var(--text-main);
      width: 34px;
      height: 34px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zoom-btn:hover { background: var(--bg-card-hover); }
    .zoom-btn + .zoom-btn { border-top: 1px solid var(--border); }

    /* Details Slide-out Drawer */
    #details-drawer {
      position: absolute;
      top: 0;
      right: 0;
      width: 380px;
      height: 100%;
      background: var(--bg-panel);
      backdrop-filter: blur(20px);
      border-left: 1px solid var(--border);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
      transform: translateX(100%);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 15;
      display: flex;
      flex-direction: column;
    }
    #details-drawer.open { transform: translateX(0); }

    .drawer-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .drawer-close {
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
    }
    .drawer-close:hover { color: var(--text-main); }

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
    }
    .kind-feature { background: rgba(192, 132, 252, 0.2); color: var(--accent-purple); border: 1px solid var(--accent-purple); }
    .kind-symbol { background: rgba(56, 189, 248, 0.2); color: var(--accent-blue); border: 1px solid var(--accent-blue); }
    .kind-route { background: rgba(74, 222, 128, 0.2); color: var(--accent-green); border: 1px solid var(--accent-green); }
    .kind-model { background: rgba(34, 211, 238, 0.2); color: var(--accent-cyan); border: 1px solid var(--accent-cyan); }
    .kind-test { background: rgba(251, 191, 36, 0.2); color: var(--accent-amber); border: 1px solid var(--accent-amber); }
    .kind-file { background: rgba(148, 163, 184, 0.2); color: var(--text-muted); border: 1px solid var(--text-muted); }

    .detail-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      word-break: break-word;
      margin-bottom: 6px;
    }

    .detail-urn {
      font-size: 11px;
      color: var(--text-dim);
      font-family: monospace;
      word-break: break-all;
      background: var(--bg-card);
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .detail-section {
      margin-top: 18px;
    }
    .detail-section-heading {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
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
      text-decoration: none;
      cursor: pointer;
      margin-top: 8px;
    }
    .editor-btn:hover { background: #334155; border-color: var(--accent-blue); }

    /* Tooltip */
    #tooltip {
      position: absolute;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--border);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      display: none;
      z-index: 30;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
      <input type="text" id="searchInput" placeholder="Search features, symbols, routes, models...">
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
        <div class="chip active" data-mode="all">All</div>
        <div class="chip" data-mode="focus">Focus</div>
        <div class="chip" data-mode="impact">Impact</div>
      </div>

      <div class="dock-section-title">Focus Feature</div>
      <select class="select-dropdown" id="featureSelect">
        <option value="">-- All Features --</option>
      </select>

      <div class="dock-section-title">Node Types</div>
      <div class="filter-chips" id="kindChips">
        <div class="chip active" data-kind="feature">Feature</div>
        <div class="chip active" data-kind="route">API</div>
        <div class="chip active" data-kind="symbol">Symbol</div>
        <div class="chip active" data-kind="model">Model</div>
        <div class="chip active" data-kind="test">Test</div>
        <div class="chip active" data-kind="file">File</div>
      </div>

      <button class="action-btn" id="btnResetView">Reset Layout</button>
    </div>

    <div class="zoom-controls">
      <button class="zoom-btn" id="btnZoomIn" title="Zoom in">+</button>
      <button class="zoom-btn" id="btnZoomOut" title="Zoom out">−</button>
      <button class="zoom-btn" id="btnZoomFit" title="Fit to view">⛶</button>
    </div>

    <canvas id="graphCanvas"></canvas>

    <div id="tooltip"></div>

    <div id="details-drawer">
      <div class="drawer-header">
        <div>
          <span class="detail-kind-badge" id="drawerBadge">Symbol</span>
          <h2 class="detail-title" id="drawerTitle">Name</h2>
        </div>
        <button class="drawer-close" id="drawerClose">&times;</button>
      </div>

      <div class="drawer-content">
        <div class="detail-urn" id="drawerUrn">urn:trace:...</div>

        <div id="drawerLocationContainer">
          <div class="detail-section-heading">Location</div>
          <div id="drawerLocation" style="font-size: 13px; color: var(--text-muted);">src/file.ts</div>
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

      let activeKinds = new Set(['feature', 'route', 'symbol', 'model', 'test', 'file']);
      let activeMode = 'all';
      let selectedFeature = config.focusFeature;
      let selectedNode = null;
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

      // Color mapping for node kinds
      const colors = {
        feature: '#c084fc',
        route: '#4ade80',
        symbol: '#38bdf8',
        model: '#22d3ee',
        test: '#fbbf24',
        file: '#94a3b8'
      };

      function resize() {
        width = canvas.parentElement.clientWidth;
        height = canvas.parentElement.clientHeight;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      window.addEventListener('resize', resize);
      resize();

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

          // Populate feature dropdown
          const sel = document.getElementById('featureSelect');
          sel.innerHTML = '<option value="">-- All Features --</option>';
          features.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.displayName;
            opt.textContent = f.displayName;
            if (f.displayName === selectedFeature) opt.selected = true;
            sel.appendChild(opt);
          });

          initSimulation();
        } catch (e) {
          console.error('Failed to load graph data:', e);
        }
      }

      function initSimulation() {
        nodeMap.clear();
        const centerX = width / 2;
        const centerY = height / 2;

        allNodes.forEach((n, idx) => {
          const angle = (idx / allNodes.length) * 2 * Math.PI;
          const radius = 100 + Math.random() * 300;
          n.x = centerX + Math.cos(angle) * radius;
          n.y = centerY + Math.sin(angle) * radius;
          n.vx = 0;
          n.vy = 0;
          n.radius = n.kind === 'feature' ? 24 : (n.kind === 'route' || n.kind === 'model' ? 18 : 14);
          nodeMap.set(n.urn, n);
        });

        // If focus requested from CLI options
        if (config.focusSymbol) {
          const target = allNodes.find(n => n.name === config.focusSymbol || n.urn.includes(config.focusSymbol));
          if (target) selectNode(target);
        }

        requestAnimationFrame(renderLoop);
      }

      // Filter Nodes according to mode and active kinds
      function getVisibleNodes() {
        return allNodes.filter(n => {
          if (!activeKinds.has(n.kind)) return false;

          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesName = n.name.toLowerCase().includes(q);
            const matchesPath = (n.path || '').toLowerCase().includes(q);
            if (!matchesName && !matchesPath) return false;
          }

          if (selectedFeature) {
            // Check if node is in selected feature
            const feat = features.find(f => f.displayName === selectedFeature);
            if (feat) {
              if (n.urn === feat.urn) return true;
              const hasEdge = allEdges.some(e =>
                (e.sourceUrn === feat.urn && e.targetUrn === n.urn) ||
                (e.targetUrn === feat.urn && e.sourceUrn === n.urn)
              );
              if (!hasEdge) return false;
            }
          }

          if (activeMode === 'focus' && selectedNode) {
            if (n.urn === selectedNode.urn) return true;
            const isNeighbor = allEdges.some(e =>
              (e.sourceUrn === selectedNode.urn && e.targetUrn === n.urn) ||
              (e.targetUrn === selectedNode.urn && e.sourceUrn === n.urn)
            );
            if (!isNeighbor) return false;
          }

          return true;
        });
      }

      // Physics force simulation step
      function stepSimulation(visibleNodes) {
        const visibleSet = new Set(visibleNodes.map(n => n.urn));
        const kRepulse = 800;
        const kAttract = 0.04;
        const damping = 0.85;

        // Repulsion between nodes
        for (let i = 0; i < visibleNodes.length; i++) {
          const a = visibleNodes[i];
          for (let j = i + 1; j < visibleNodes.length; j++) {
            const b = visibleNodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 400) {
              const force = kRepulse / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              a.vx -= fx;
              a.vy -= fy;
              b.vx += fx;
              b.vy += fy;
            }
          }
        }

        // Attraction along edges
        allEdges.forEach(e => {
          if (visibleSet.has(e.sourceUrn) && visibleSet.has(e.targetUrn)) {
            const a = nodeMap.get(e.sourceUrn);
            const b = nodeMap.get(e.targetUrn);
            if (a && b) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const targetDist = 120;
              const force = (dist - targetDist) * kAttract;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              a.vx += fx;
              a.vy += fy;
              b.vx -= fx;
              b.vy -= fy;
            }
          }
        });

        // Center gravity and update positions
        const cx = width / 2;
        const cy = height / 2;
        visibleNodes.forEach(n => {
          if (n !== draggedNode) {
            n.vx += (cx - n.x) * 0.002;
            n.vy += (cy - n.y) * 0.002;
            n.vx *= damping;
            n.vy *= damping;
            n.x += n.vx;
            n.y += n.vy;
          }
        });
      }

      function renderLoop() {
        const visibleNodes = getVisibleNodes();
        stepSimulation(visibleNodes);

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(scale, scale);

        const visibleSet = new Set(visibleNodes.map(n => n.urn));

        // Draw Edges
        allEdges.forEach(e => {
          if (visibleSet.has(e.sourceUrn) && visibleSet.has(e.targetUrn)) {
            const a = nodeMap.get(e.sourceUrn);
            const b = nodeMap.get(e.targetUrn);
            if (a && b) {
              const isSelected = selectedNode && (selectedNode.urn === a.urn || selectedNode.urn === b.urn);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(59, 130, 246, 0.25)';
              ctx.lineWidth = isSelected ? 2.5 : 1.2;

              // Line style according to confidence
              if (e.confidence === 'DETECTED') {
                ctx.setLineDash([6, 4]);
              } else if (e.confidence === 'INFERRED') {
                ctx.setLineDash([2, 4]);
              } else {
                ctx.setLineDash([]);
              }

              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        });

        // Draw Nodes
        visibleNodes.forEach(n => {
          const isSelected = selectedNode && selectedNode.urn === n.urn;
          const nodeColor = colors[n.kind] || '#94a3b8';

          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? '#ffffff' : nodeColor;
          ctx.fill();

          if (isSelected) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
          } else {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.stroke();
          }

          // Node Label
          ctx.fillStyle = '#f1f5f9';
          ctx.font = isSelected ? 'bold 13px var(--font)' : '11px var(--font)';
          ctx.textAlign = 'center';
          const label = n.name.length > 20 ? n.name.slice(0, 18) + '…' : n.name;
          ctx.fillText(label, n.x, n.y + n.radius + 14);
        });

        ctx.restore();

        requestAnimationFrame(renderLoop);
      }

      // Interaction: Click & Drag
      canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panX) / scale;
        const my = (e.clientY - rect.top - panY) / scale;

        const visibleNodes = getVisibleNodes();
        const clicked = visibleNodes.find(n => {
          const dx = n.x - mx;
          const dy = n.y - my;
          return Math.sqrt(dx * dx + dy * dy) <= n.radius;
        });

        if (clicked) {
          draggedNode = clicked;
          selectNode(clicked);
        } else {
          isDragging = true;
          dragStartX = e.clientX - panX;
          dragStartY = e.clientY - panY;
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
        } else if (isDragging) {
          panX = e.clientX - dragStartX;
          panY = e.clientY - dragStartY;
        } else {
          // Hover tooltip
          const visibleNodes = getVisibleNodes();
          const hovered = visibleNodes.find(n => {
            const dx = n.x - mx;
            const dy = n.y - my;
            return Math.sqrt(dx * dx + dy * dy) <= n.radius;
          });

          if (hovered) {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top = (e.clientY + 14) + 'px';
            tooltip.innerHTML = '<b>' + hovered.name + '</b> (' + hovered.kind + ')<br><span style="color:#94a3b8">' + (hovered.path || 'root') + '</span>';
          } else {
            tooltip.style.display = 'none';
          }
        }
      });

      window.addEventListener('mouseup', () => {
        draggedNode = null;
        isDragging = false;
      });

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        scale = Math.max(0.2, Math.min(3.0, scale * zoomFactor));
      });

      // Node Selection & Details Drawer
      async function selectNode(node) {
        selectedNode = node;
        const drawer = document.getElementById('details-drawer');
        drawer.classList.add('open');

        const badge = document.getElementById('drawerBadge');
        badge.textContent = node.kind;
        badge.className = 'detail-kind-badge kind-' + node.kind;

        document.getElementById('drawerTitle').textContent = node.name;
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
              impactList.appendChild(item);
            });
            details.impact.tests.forEach(t => {
              const item = document.createElement('div');
              item.className = 'detail-item';
              item.innerHTML = '<div class="detail-item-title" style="color:var(--accent-amber)">Test: ' + t.name + '</div><div class="detail-item-subtitle">' + t.path + '</div>';
              impactList.appendChild(item);
            });
          } else {
            impactList.innerHTML = '<div style="font-size:12px;color:var(--text-dim)">No direct dependents or tests mapped.</div>';
          }

          // Edges
          const edgesList = document.getElementById('drawerEdgesList');
          edgesList.innerHTML = '';
          const nodeEdges = allEdges.filter(e => e.sourceUrn === node.urn || e.targetUrn === node.urn);
          nodeEdges.slice(0, 8).forEach(e => {
            const isOut = e.sourceUrn === node.urn;
            const otherUrn = isOut ? e.targetUrn : e.sourceUrn;
            const other = nodeMap.get(otherUrn);
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.innerHTML = '<div class="detail-item-title">' + (isOut ? '→ ' : '← ') + e.relationship + ' : ' + (other ? other.name : otherUrn) + '</div><div class="detail-item-subtitle">' + e.evidence.reason + '</div>';
            edgesList.appendChild(item);
          });
        } catch (e) {
          console.error('Failed to load node details:', e);
        }
      }

      document.getElementById('drawerClose').addEventListener('click', () => {
        document.getElementById('details-drawer').classList.remove('open');
        selectedNode = null;
      });

      // Controls
      document.getElementById('searchInput').addEventListener('input', e => {
        searchQuery = e.target.value;
      });

      document.getElementById('featureSelect').addEventListener('change', e => {
        selectedFeature = e.target.value;
      });

      document.querySelectorAll('#modeChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#modeChips .chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          activeMode = chip.dataset.mode;
        });
      });

      document.querySelectorAll('#kindChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          const kind = chip.dataset.kind;
          if (activeKinds.has(kind)) activeKinds.delete(kind);
          else activeKinds.add(kind);
        });
      });

      document.getElementById('btnResetView').addEventListener('click', () => {
        scale = 1.0;
        panX = 0;
        panY = 0;
        selectedNode = null;
        selectedFeature = '';
        document.getElementById('featureSelect').value = '';
        document.getElementById('details-drawer').classList.remove('open');
      });

      document.getElementById('btnZoomIn').addEventListener('click', () => { scale = Math.min(3.0, scale * 1.2); });
      document.getElementById('btnZoomOut').addEventListener('click', () => { scale = Math.max(0.2, scale * 0.8); });
      document.getElementById('btnZoomFit').addEventListener('click', () => { scale = 1.0; panX = 0; panY = 0; });

      loadGraphData();
    })();
  </script>
</body>
</html>`;
}
