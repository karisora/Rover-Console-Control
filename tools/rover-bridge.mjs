#!/usr/bin/env node
// Local UDP bridge for the Rover Console.
//
// Run this on the same machine that is connected to the Pico 2W's Wi-Fi AP
// (SSID "LumOS1-Pico2W"). It listens for HTTP requests from the Rover Console
// frontend and forwards them as UDP packets to the rover at 192.168.4.1:5000.
//
//   node tools/rover-bridge.mjs
//
// Then in the Rover Console UI, click the gear in the top-right and set
// Bridge URL to:  http://127.0.0.1:5050
//
// Env overrides: ROVER_HOST, ROVER_PORT, BRIDGE_PORT, BRIDGE_HOST

import http from "node:http";
import dgram from "node:dgram";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROVER_HOST = process.env.ROVER_HOST || "192.168.4.1";
const ROVER_PORT = Number(process.env.ROVER_PORT || 5000);
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 5050);
const BRIDGE_HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const HEARTBEAT_ID = process.env.HEARTBEAT_ID || "0x410";
const HEARTBEAT_VALUE = Number(process.env.HEARTBEAT_VALUE || 0);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 1000);
// Bumped whenever the bridge wire protocol changes. The launcher uses this
// to detect a stale older bridge process and kill it before reusing.
const BRIDGE_VERSION = "2026.05.22-sim-to-real";

// Runtime diagnostics surfaced via /api/healthz so we can debug from the UI.
const stats = {
  heartbeatsSent: 0,
  heartbeatErrors: 0,
  packetsReceived: 0,
  acksReceived: 0,
  lastHeartbeatAt: null,
  lastReceivedAt: null,
  lastAckAt: null,
  lastReceivedFrom: null,
  lastReceivedPayload: null,
};

// Static SPA hosting: if a ./public directory exists next to this script,
// serve it as the web console UI on the same origin so that the browser does
// not have to deal with cross-origin / Local-Network-Access restrictions.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const HAS_PUBLIC = fs.existsSync(PUBLIC_DIR) && fs.statSync(PUBLIC_DIR).isDirectory();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
};

const sock = dgram.createSocket("udp4");
sock.on("error", (e) => console.error("[udp]", e.message));
// Bind to an ephemeral port so we can also receive replies from the rover
// (e.g. 0x411 ack in response to our 0x410 heartbeat).
sock.bind(0, () => {
  const a = sock.address();
  console.log(`[udp] listening on ${a.address}:${a.port}`);
});

// SSE clients receive realtime events (UDP messages from the rover, heartbeat
// acks, etc.). Each entry is an http.ServerResponse with text/event-stream.
const sseClients = new Set();
function broadcastEvent(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

sock.on("message", (msg, rinfo) => {
  const text = msg.toString("utf8").trim();
  const now = new Date().toISOString();
  stats.packetsReceived += 1;
  stats.lastReceivedAt = now;
  stats.lastReceivedFrom = `${rinfo.address}:${rinfo.port}`;
  stats.lastReceivedPayload = text;
  console.log(`[<-] ${text}  from ${rinfo.address}:${rinfo.port}`);
  // Detect the heartbeat ack from the rover (firmware replies 0x411 when it
  // receives 0x410). Surface it as an event so the UI can log "CONNECTED".
  if (/^0x411\b/i.test(text)) {
    stats.acksReceived += 1;
    stats.lastAckAt = now;
    broadcastEvent({ type: "ack", payload: text, bytes: msg.length, at: now });
  } else {
    broadcastEvent({ type: "rx", payload: text, bytes: msg.length, at: now });
  }
});

function sendUDP(payload) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(payload, "utf8");
    sock.send(buf, 0, buf.length, ROVER_PORT, ROVER_HOST, (e) => {
      if (e) {
        console.error(`[->] FAILED ${payload}: ${e.message}`);
        reject(e);
      } else {
        console.log(`[->] ${payload}`);
        // Broadcast every outgoing UDP packet so the UI can account for it
        // in the LINK RATE counters (heartbeat, raw packets, drive moves).
        broadcastEvent({
          type: "tx",
          payload,
          bytes: buf.length,
          at: new Date().toISOString(),
        });
        resolve();
      }
    });
  });
}

// Build a Raw-Packet-style payload string from an id and signed value, and
// send it via the exact same code path as the /api/rover/command handler.
// This guarantees the bytes on the wire are identical to what a manual
// "Raw Packet · UDP" transmit produces.
function sendRawPacket(id, value) {
  const v = Math.trunc(Number(value));
  return sendUDP(`${id},${v}`);
}

// Reachability check.
//
// The rover only speaks UDP, so a TCP connect always fails even when the
// Pico is right there. Instead we check whether this machine has a network
// interface on the same /24 as ROVER_HOST (e.g. 192.168.4.x when the rover
// is at 192.168.4.1). That is a strong signal that we're joined to the
// Pico's Wi-Fi AP. We also fire a tiny no-op UDP packet to surface any
// immediate send error (interface down, route missing, etc.) and use the
// round-trip time as a rough latency number.
function sameSubnet(ip, target) {
  // Compare the first three octets — sufficient for the /24 we care about.
  const a = ip.split(".");
  const b = target.split(".");
  if (a.length !== 4 || b.length !== 4) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function findLocalIfaceOnSubnet(target) {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const it of list) {
      if (it.family !== "IPv4" || it.internal) continue;
      if (sameSubnet(it.address, target)) return it.address;
    }
  }
  return null;
}

function probe() {
  return new Promise((resolve) => {
    const start = Date.now();
    const localIp = findLocalIfaceOnSubnet(ROVER_HOST);
    if (!localIp) {
      resolve({ ok: false, latencyMs: null, message: `no interface on ${ROVER_HOST.split(".").slice(0,3).join(".")}.x` });
      return;
    }
    // Try a tiny no-op UDP send. If the OS accepts the send, the route to
    // the Pico exists. We don't expect a reply (firmware doesn't send one).
    const probeSock = dgram.createSocket("udp4");
    let done = false;
    const fin = (ok, msg) => {
      if (done) return;
      done = true;
      try { probeSock.close(); } catch {}
      resolve({ ok, latencyMs: ok ? Date.now() - start : null, message: msg });
    };
    probeSock.on("error", (e) => fin(false, e.message));
    try {
      const buf = Buffer.from("ping");
      probeSock.send(buf, 0, buf.length, ROVER_PORT, ROVER_HOST, (e) => {
        if (e) fin(false, e.message);
        else fin(true, `via ${localIp}`);
      });
    } catch (e) {
      fin(false, e.message);
    }
  });
}

// CAN ID assignment (firmware v2):
//   0x400 = FR (Front Right)
//   0x401 = RR (Rear  Right)
//   0x402 = FL (Front Left)
//   0x403 = RL (Rear  Left)
//   0x404 = Solar panel DEPLOY (open)
//   0x405 = Solar panel FOLD   (close)
const WHEELS = { FR: "0x400", RR: "0x401", FL: "0x402", RL: "0x403" };
function packetsFor(action, speed) {
  // Accept signed speed in [-100, 100]. Backward is encoded as a negative
  // speed by the client; rotate/strafe are direction-independent so they
  // use the magnitude.
  const s = Math.max(-100, Math.min(100, Math.round(speed)));
  const m = Math.abs(s);
  switch (action) {
    case "forward":      return [[WHEELS.FR, s],  [WHEELS.RR, s],  [WHEELS.FL, s],  [WHEELS.RL, s]];
    case "backward":     return [[WHEELS.FR, s],  [WHEELS.RR, s],  [WHEELS.FL, s],  [WHEELS.RL, s]];
    case "rotate_left":  return [[WHEELS.FR, m],  [WHEELS.RR, m],  [WHEELS.FL, -m], [WHEELS.RL, -m]];
    case "rotate_right": return [[WHEELS.FR, -m], [WHEELS.RR, -m], [WHEELS.FL, m],  [WHEELS.RL, m]];
    // STR-L / STR-R: differential-style "veer" while moving forward — the
    // inside wheels turn slower than the outside wheels so the rover curves
    // toward the requested side instead of strafing sideways.
    case "strafe_left": {
      const inner = Math.round(s * 0.3);
      return [[WHEELS.FR, s],     [WHEELS.RR, s],     [WHEELS.FL, inner], [WHEELS.RL, inner]];
    }
    case "strafe_right": {
      const inner = Math.round(s * 0.3);
      return [[WHEELS.FR, inner], [WHEELS.RR, inner], [WHEELS.FL, s],     [WHEELS.RL, s]];
    }
    case "stop":              return [[WHEELS.FR, 0], [WHEELS.RR, 0], [WHEELS.FL, 0], [WHEELS.RL, 0]];
    case "solar_deploy":      return [["0x404", 0]];
    case "solar_fold":        return [["0x405", 0]];
    case "spell":             return [["0x450", 0]];
    default:                  return [];
  }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  // Local Network Access (Chrome): allow private/loopback access from secure origins.
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Allow-Local-Network", "true");
}

function serveStatic(req, res, urlPath) {
  if (!HAS_PUBLIC) return false;
  // Map URL path to file inside PUBLIC_DIR, defaulting to index.html for SPA routes.
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("forbidden"); return true;
  }
  let stat;
  try { stat = fs.statSync(filePath); } catch { stat = null; }
  if (stat && stat.isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  // SPA fallback to index.html for non-asset paths (no file extension).
  if (!path.extname(rel)) {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" });
      fs.createReadStream(indexPath).pipe(res);
      return true;
    }
  }
  return false;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (req.method === "GET" && (path === "/api/rover/status" || path === "/rover/status")) {
      const p = await probe();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        connected: p.ok, host: ROVER_HOST, port: ROVER_PORT,
        latencyMs: p.latencyMs, lastCheckedAt: new Date().toISOString(),
        message: p.message,
      }));
      return;
    }
    if (req.method === "GET" && (path === "/api/rover/events" || path === "/rover/events")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(": connected\n\n");
      // Heartbeat keep-alive so proxies don't kill the stream.
      const ka = setInterval(() => {
        try { res.write(": ka\n\n"); } catch {}
      }, 15000);
      sseClients.add(res);
      const cleanup = () => {
        clearInterval(ka);
        sseClients.delete(res);
      };
      req.on("close", cleanup);
      req.on("error", cleanup);
      return;
    }
    if (req.method === "GET" && (path === "/api/healthz" || path === "/healthz")) {
      const a = sock.address?.() || {};
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        version: BRIDGE_VERSION,
        pid: process.pid,
        roverHost: ROVER_HOST,
        roverPort: ROVER_PORT,
        udpLocalPort: a.port ?? null,
        heartbeat: { id: HEARTBEAT_ID, value: HEARTBEAT_VALUE, intervalMs: HEARTBEAT_INTERVAL_MS },
        stats,
      }));
      return;
    }
    if (req.method === "POST" && (path === "/api/rover/command" || path === "/rover/command")) {
      const body = await readJson(req);
      await sendRawPacket(body.id, body.value);
      const payload = `${body.id},${Math.trunc(Number(body.value))}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, sent: [payload], error: null }));
      return;
    }
    if (req.method === "POST" && (path === "/api/rover/move" || path === "/rover/move")) {
      const body = await readJson(req);
      const speed = body.speed ?? 30;
      const pkts = packetsFor(body.action, speed);
      if (pkts.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, sent: [], error: `unknown action: ${body.action}` }));
        return;
      }
      const sent = [];
      for (const [id, v] of pkts) {
        const payload = `${id},${v}`;
        await sendUDP(payload);
        sent.push(payload);
        console.log("[->]", payload);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, sent, error: null }));
      return;
    }
    if (req.method === "POST" && (path === "/api/shutdown" || path === "/shutdown")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "shutting down" }));
      console.log("[bridge] shutdown requested via HTTP — exiting");
      // Give the response a moment to flush, then exit.
      setTimeout(() => process.exit(0), 150);
      return;
    }
    if (req.method === "GET" && serveStatic(req, res, req.url)) return;
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found", path }));
  } catch (e) {
    console.error("[err]", e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, sent: [], error: e.message }));
  }
});

// Periodic heartbeat: send a packet to the rover every second through the
// exact same code path as a manual "Raw Packet · UDP" transmission, so the
// bytes on the wire are byte-for-byte identical (e.g. "0x410,0").
let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    sendRawPacket(HEARTBEAT_ID, HEARTBEAT_VALUE)
      .then(() => {
        stats.heartbeatsSent += 1;
        stats.lastHeartbeatAt = new Date().toISOString();
      })
      .catch((e) => {
        stats.heartbeatErrors += 1;
        console.error("[heartbeat] send failed:", e.message);
      });
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
}

server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
  startHeartbeat();
  console.log("==========================================================");
  console.log(`  ROVER BRIDGE  v${BRIDGE_VERSION}`);
  console.log(`  Listening on   http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  console.log(`  Forwarding UDP to ${ROVER_HOST}:${ROVER_PORT}`);
  console.log(`  Heartbeat:     ${HEARTBEAT_ID},${HEARTBEAT_VALUE} every ${HEARTBEAT_INTERVAL_MS}ms`);
  if (HAS_PUBLIC) {
    console.log(`  Web console:   open http://${BRIDGE_HOST}:${BRIDGE_PORT}/ in your browser`);
  } else {
    console.log(`  No ./public directory found — UI not served locally.`);
    console.log(`  In the Rover Console UI, set Bridge URL to: http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  }
  console.log("==========================================================");
});
