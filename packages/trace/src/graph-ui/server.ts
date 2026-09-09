// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Anubhav Mishra and Amvelt
import http from 'node:http';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import type { FeatureGraph } from '../core/graph.js';
import { generateGraphHtml } from './html-template.js';

export interface GraphServerOptions {
  port?: number;
  openBrowser?: boolean;
  focusFeature?: string;
  focusSymbol?: string;
  focusImpact?: string;
}

export interface GraphServerInstance {
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
}

/**
 * Starts a local-first HTTP server hosting the interactive codebase visualizer.
 * Zero telemetry, zero external network dependencies.
 */
export async function startGraphServer(
  repoRoot: string,
  graph: FeatureGraph,
  options: GraphServerOptions = {}
): Promise<GraphServerInstance> {
  let targetPort = options.port || 4321;

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${targetPort}`);

    // CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        generateGraphHtml({
          repoRoot,
          focusFeature: options.focusFeature,
          focusSymbol: options.focusSymbol,
          focusImpact: options.focusImpact
        })
      );
      return;
    }

    if (reqUrl.pathname === '/api/graph') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const payload = {
        nodes: graph.getActiveNodes(),
        edges: graph.getAllEdges(),
        features: graph.getFeatures()
      };
      res.end(JSON.stringify(payload));
      return;
    }

    if (reqUrl.pathname === '/api/node') {
      const urn = reqUrl.searchParams.get('urn');
      if (!urn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing urn parameter' }));
        return;
      }

      const node = graph.getNode(urn);
      if (!node) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Node not found' }));
        return;
      }

      const exp = graph.explain(urn);
      const impact = graph.getImpact(urn);

      const details = {
        node,
        features: exp.relatedFeatures.map((r) => ({
          urn: r.feature.urn,
          name: r.feature.displayName,
          confidence: r.confidence,
          reason: r.evidence[0]?.reason || 'Feature connection'
        })),
        impact: {
          consumers: impact.directConsumers.map((c) => ({ name: c.name, path: c.path, urn: c.urn })),
          tests: impact.affectedTests.map((t) => ({ name: t.name, path: t.path, urn: t.urn }))
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(details));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const sockets = new Set<import('node:net').Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        targetPort++;
        server.listen(targetPort, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.listen(targetPort, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${targetPort}`;
      console.log(pc.green(pc.bold(`\nAmvelt TRACE Interactive Graph running at: ${url}`)));
      console.log(pc.dim('Press Ctrl+C to stop the graph server.\n'));

      if (options.openBrowser !== false) {
        openBrowser(url);
      }

      resolve({
        server,
        url,
        port: targetPort,
        stop: () =>
          new Promise((res) => {
            for (const socket of sockets) {
              socket.destroy();
            }
            server.close(() => res());
          })
      });
    });
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd = '';
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, () => {
    // Non-fatal if browser opening fails (e.g. headless/CI environment)
  });
}
