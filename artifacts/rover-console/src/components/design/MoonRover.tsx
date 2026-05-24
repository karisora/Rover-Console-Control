import { useRef, useEffect, useState, useCallback } from "react";
import { Download, Box, Mountain } from "lucide-react";
import {
  ALL_SLOTS, MODULE_CATALOG, CHASSIS_KG,
  type MissionConfig, type SlotId,
} from "./missionTypes";

// ─── Isometric SVG helpers ────────────────────────────────────────────────────
const SC  = 38;   // pixels per rover-unit
const CX  = 255;  // SVG viewport center x
const CY  = 168;  // SVG viewport center y

function iso(x: number, y: number, z: number): [number, number] {
  return [
    CX + (x - z) * SC * 0.866,
    CY - y * SC + (x + z) * SC * 0.5,
  ];
}

function pts(points: [number, number][]): string {
  return points.map((p, i) =>
    `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`
  ).join(" ") + "Z";
}

/** Three visible faces of an iso box: top (+y), front (+x), near side (z=bz) */
function boxFaces(bx: number, by: number, bz: number, dx: number, dy: number, dz: number) {
  return {
    top: pts([
      iso(bx,    by+dy, bz),    iso(bx+dx, by+dy, bz),
      iso(bx+dx, by+dy, bz+dz), iso(bx,    by+dy, bz+dz),
    ]),
    front: pts([
      iso(bx+dx, by,    bz),    iso(bx+dx, by,    bz+dz),
      iso(bx+dx, by+dy, bz+dz), iso(bx+dx, by+dy, bz),
    ]),
    side: pts([
      iso(bx,    by,    bz),    iso(bx+dx, by,    bz),
      iso(bx+dx, by+dy, bz),    iso(bx,    by+dy, bz),
    ]),
  };
}

interface SlotBox {
  bx: number; by: number; bz: number;
  dx: number; dy: number; dz: number;
  iconPos: [number, number, number]; // world pos for module icon
}

const SLOT_BOXES: Record<SlotId, SlotBox> = {
  "front":     { bx:  1.5,  by: 0.05, bz: -0.28, dx: 0.5,  dy: 0.5,  dz: 0.56, iconPos: [1.73, 0.55, 0] },
  "top-front": { bx:  0.15, by: 0.60, bz: -0.58, dx: 1.28, dy: 0.32, dz: 1.16, iconPos: [0.78, 0.88, 0] },
  "top-rear":  { bx: -1.43, by: 0.60, bz: -0.58, dx: 1.28, dy: 0.32, dz: 1.16, iconPos: [-0.78, 0.88, 0] },
  "rear":      { bx: -2.0,  by: 0.05, bz: -0.28, dx: 0.5,  dy: 0.5,  dz: 0.56, iconPos: [-1.73, 0.55, 0] },
  "bottom":    { bx: -0.9,  by: -0.28,bz: -0.58, dx: 1.8,  dy: 0.28, dz: 1.16, iconPos: [0, -0.14, 0] },
};

// ─── 3D Isometric Rover SVG ────────────────────────────────────────────────────
function RoverIsometric({ config }: { config: MissionConfig }) {
  const chassis = boxFaces(-1.5, 0, -0.65, 3.0, 0.6, 1.3);
  const skirt   = boxFaces(-1.3, -0.08, -0.6, 2.6, 0.08, 1.2);

  // Compute wheel positions (4 wheels along z edges)
  const wheelCenters: [number, number, number][] = [
    [ 1.0, 0, -0.65], [ 1.0, 0, 0.65],
    [-1.0, 0, -0.65], [-1.0, 0, 0.65],
  ];

  const mountedModules = ALL_SLOTS.map((s) => {
    const mid = config.slots[s];
    const mod = mid ? MODULE_CATALOG.find((m) => m.id === mid) : null;
    return { slotId: s, mod };
  });

  return (
    <svg viewBox="0 0 510 320" className="w-full" style={{ maxHeight: 320 }}>
      <defs>
        <radialGradient id="shadowG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid floor */}
      {[-3,-2,-1,0,1,2,3].map(i => {
        const [x0,y0] = iso(i, 0, -2);
        const [x1,y1] = iso(i, 0,  2);
        return <line key={`gx${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#1e293b" strokeWidth="0.5" />;
      })}
      {[-2,-1,0,1,2].map(i => {
        const [x0,y0] = iso(-3, 0, i);
        const [x1,y1] = iso( 3, 0, i);
        return <line key={`gz${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#1e293b" strokeWidth="0.5" />;
      })}

      {/* Ground shadow */}
      {(() => {
        const [cx,cy] = iso(0, 0, 0);
        return <ellipse cx={cx} cy={cy+6} rx={140} ry={22} fill="url(#shadowG)" />;
      })()}

      {/* Chassis body — bottom skirt (darker) */}
      <path d={skirt.top}  fill="#0a2233" stroke="#0e3650" strokeWidth="0.5" />
      <path d={skirt.front} fill="#081b28" stroke="#0e3650" strokeWidth="0.5" />
      <path d={skirt.side}  fill="#091f2e" stroke="#0e3650" strokeWidth="0.5" />

      {/* Chassis body — main box */}
      <path d={chassis.top}   fill="#0d3347" stroke="#1a5a7a" strokeWidth="1" />
      <path d={chassis.front} fill="#0a2a3d" stroke="#1a5a7a" strokeWidth="1" />
      <path d={chassis.side}  fill="#0b2f43" stroke="#1a5a7a" strokeWidth="1" />

      {/* Top deck panel lines */}
      {[0].map(() => {
        const [ax,ay] = iso(0, 0.6, -0.65);
        const [bx,by] = iso(0, 0.6,  0.65);
        return <line key="deckline" x1={ax} y1={ay} x2={bx} y2={by} stroke="#1e4a64" strokeWidth="1" />;
      })}

      {/* Wheels */}
      {wheelCenters.map(([wx, wy, wz], i) => {
        const [sx, sy] = iso(wx, wy, wz);
        // wheel as ellipse in iso projection
        const rx = SC * 0.32, ry = SC * 0.32 * 0.4;
        const angle = Math.atan2(0.5, 0.866) * (180 / Math.PI);
        return (
          <g key={i}>
            <ellipse cx={sx} cy={sy} rx={rx} ry={ry}
              transform={`rotate(${wz < 0 ? -angle : angle}, ${sx}, ${sy})`}
              fill="#142d3f" stroke="#22d3ee55" strokeWidth="1.5" />
            <ellipse cx={sx} cy={sy} rx={rx * 0.55} ry={ry * 0.55}
              transform={`rotate(${wz < 0 ? -angle : angle}, ${sx}, ${sy})`}
              fill="#0a1e2d" stroke="#22d3ee33" strokeWidth="1" />
          </g>
        );
      })}

      {/* Direction arrow (front = +x direction) */}
      {(() => {
        const [ax,ay] = iso(2.3, 0.3, 0);
        return (
          <g filter="url(#glow)">
            <polygon
              points={`${ax},${ay - 8} ${ax + 10},${ay + 2} ${ax},${ay + 12}`}
              fill="#22d3ee" opacity="0.7"
            />
          </g>
        );
      })()}

      {/* Slot indicators (empty) */}
      {ALL_SLOTS.map((sid) => {
        const mod = config.slots[sid] ? MODULE_CATALOG.find((m) => m.id === config.slots[sid]) : null;
        if (mod) return null; // will draw with color below
        const sb = SLOT_BOXES[sid];
        const f = boxFaces(sb.bx, sb.by, sb.bz, sb.dx, sb.dy, sb.dz);
        return (
          <g key={sid} opacity="0.35">
            <path d={f.top}   fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 2" />
            <path d={f.front} fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 2" />
            <path d={f.side}  fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 2" />
          </g>
        );
      })}

      {/* Mounted module boxes */}
      {mountedModules.filter(({mod}) => !!mod).map(({ slotId, mod }) => {
        if (!mod) return null;
        const sb = SLOT_BOXES[slotId];
        const f = boxFaces(sb.bx, sb.by, sb.bz, sb.dx, sb.dy, sb.dz);
        const [ix, iy] = iso(...sb.iconPos);
        const col = mod.color;
        return (
          <g key={slotId} filter="url(#glow)">
            <path d={f.top}   fill={col + "40"} stroke={col} strokeWidth="1.2" />
            <path d={f.front} fill={col + "25"} stroke={col} strokeWidth="1.2" />
            <path d={f.side}  fill={col + "30"} stroke={col} strokeWidth="1.2" />
            {/* Module glow halo */}
            <ellipse cx={ix} cy={iy} rx={16} ry={8} fill={col + "25"} />
            {/* Module icon */}
            <text x={ix} y={iy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="14">{mod.icon}</text>
            <text x={ix} y={iy + 14} textAnchor="middle" fontSize="6.5" fill={col} fontFamily="monospace">{mod.labelJa}</text>
          </g>
        );
      })}

      {/* Chassis highlight edge */}
      <path d={pts([iso(-1.5,0.6,-0.65), iso(1.5,0.6,-0.65)])} fill="none" stroke="#22d3ee30" strokeWidth="1.5" />

      {/* Labels */}
      {(() => {
        const [lx,ly] = iso(2.1, 0.3, 0);
        const [rx,ry] = iso(-2.1, 0.3, 0);
        return <>
          <text x={lx+6} y={ly} fontSize="7" fill="#22d3ee80" fontFamily="monospace">FRONT</text>
          <text x={rx-6} y={ry} fontSize="7" fill="#47556980" fontFamily="monospace" textAnchor="end">REAR</text>
        </>;
      })()}

      {/* Legend */}
      <text x="12" y="310" fontSize="8" fill="#47556960" fontFamily="monospace">
        ISOMETRIC 3D VIEW - GENERATED FROM MODULE PLACEMENT
      </text>
    </svg>
  );
}

// ─── Seeded PRNG ───────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Lunar Scene Canvas ────────────────────────────────────────────────────────
function drawLunarScene(
  canvas: HTMLCanvasElement,
  config: MissionConfig,
) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  const rng = mulberry32(
    config.terrain === "flat" ? 101 :
    config.terrain === "rocky" ? 202 :
    config.terrain === "sandy" ? 303 : 404
  );

  const HORIZON = H * 0.52;

  // ── Sky ──────────────────────────────────────────────────────────────────────
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
  skyGrad.addColorStop(0,   "#000005");
  skyGrad.addColorStop(0.6, "#05060f");
  skyGrad.addColorStop(1,   "#0a0c1a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, HORIZON);

  // ── Stars ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 280; i++) {
    const x  = rng() * W;
    const y  = rng() * HORIZON * 0.95;
    const r  = rng() * 1.4;
    const br = 0.35 + rng() * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${br})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Earth ─────────────────────────────────────────────────────────────────────
  const eX = W * 0.12, eY = H * 0.14, eR = 48;
  const earthG = ctx.createRadialGradient(eX - 12, eY - 12, 4, eX, eY, eR);
  earthG.addColorStop(0,   "#7ec8ff");
  earthG.addColorStop(0.3, "#3a8fd8");
  earthG.addColorStop(0.65,"#1a5fa0");
  earthG.addColorStop(1,   "#0a2a50");
  ctx.fillStyle = earthG;
  ctx.beginPath(); ctx.arc(eX, eY, eR, 0, Math.PI * 2); ctx.fill();
  // continent blobs
  ctx.fillStyle = "rgba(60,160,60,0.45)";
  for (let i = 0; i < 5; i++) {
    const bx = eX - eR * 0.5 + rng() * eR, by = eY - eR * 0.4 + rng() * eR * 0.8;
    const br2 = 6 + rng() * 14;
    ctx.beginPath(); ctx.ellipse(bx, by, br2, br2 * 0.6, rng() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // atmosphere rim
  const atmG = ctx.createRadialGradient(eX, eY, eR - 4, eX, eY, eR + 8);
  atmG.addColorStop(0,   "rgba(80,160,255,0)");
  atmG.addColorStop(0.5, "rgba(80,160,255,0.22)");
  atmG.addColorStop(1,   "rgba(80,160,255,0)");
  ctx.fillStyle = atmG;
  ctx.beginPath(); ctx.arc(eX, eY, eR + 8, 0, Math.PI * 2); ctx.fill();

  // ── Sun glow (top-right) ─────────────────────────────────────────────────────
  const sunG = ctx.createRadialGradient(W * 0.88, H * 0.05, 0, W * 0.88, H * 0.05, 90);
  sunG.addColorStop(0,   "rgba(255,250,200,0.18)");
  sunG.addColorStop(0.5, "rgba(255,240,160,0.06)");
  sunG.addColorStop(1,   "rgba(255,240,160,0)");
  ctx.fillStyle = sunG;
  ctx.fillRect(0, 0, W, HORIZON);

  // ── Terrain fill ─────────────────────────────────────────────────────────────
  const buildHorizonLine = () => {
    const pts: [number, number][] = [];
    const segW = 24;
    const segs = Math.ceil(W / segW) + 1;
    for (let i = 0; i < segs; i++) {
      const x = i * segW;
      let y = HORIZON;
      if (config.terrain === "flat") {
        y += Math.sin(x * 0.009) * 6 + Math.sin(x * 0.023) * 3;
      } else if (config.terrain === "rocky") {
        y += Math.sin(x * 0.015) * 14 + Math.sin(x * 0.04) * 7;
      } else if (config.terrain === "sandy") {
        y += Math.sin(x * 0.007) * 18 + Math.sin(x * 0.02) * 8;
      } else { // steep
        y += Math.sin(x * 0.006) * 28 + Math.sin(x * 0.018) * 12;
      }
      pts.push([x, y]);
    }
    return pts;
  };

  const horizonPts = buildHorizonLine();
  const terGrad = ctx.createLinearGradient(0, HORIZON, 0, H);
  terGrad.addColorStop(0,   "#8a8a78");
  terGrad.addColorStop(0.3, "#7a7a68");
  terGrad.addColorStop(1,   "#505046");
  ctx.fillStyle = terGrad;
  ctx.beginPath();
  ctx.moveTo(0, H);
  horizonPts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

  // Horizon sky/terrain blend strip
  const blendG = ctx.createLinearGradient(0, HORIZON - 15, 0, HORIZON + 15);
  blendG.addColorStop(0,   "rgba(10,12,26,0)");
  blendG.addColorStop(0.45,"rgba(10,12,26,0.5)");
  blendG.addColorStop(0.55,"rgba(138,138,120,0.5)");
  blendG.addColorStop(1,   "rgba(138,138,120,0)");
  ctx.fillStyle = blendG;
  ctx.fillRect(0, HORIZON - 15, W, 30);

  // ── Craters ───────────────────────────────────────────────────────────────────
  const craterCount = config.terrain === "rocky" ? 12 : config.terrain === "steep" ? 7 : 5;
  for (let i = 0; i < craterCount; i++) {
    const cx = rng() * W;
    const depthFrac = 0.15 + rng() * 0.55;
    const cy = HORIZON + depthFrac * (H - HORIZON) * 0.9;
    const r = (config.terrain === "flat" ? 12 : 18) + rng() * 55;
    const ry = r * (0.22 + rng() * 0.15); // perspective flatten
    // outer shadow ring
    const shadowG = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.3);
    shadowG.addColorStop(0,   "rgba(0,0,0,0)");
    shadowG.addColorStop(0.7, "rgba(0,0,0,0.28)");
    shadowG.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = shadowG;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.3, ry * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    // crater floor
    ctx.fillStyle = `rgba(100,100,88,${0.7 + rng() * 0.3})`;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2); ctx.fill();
    // inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.15, r * 0.85, ry * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    // rim highlight (sun from top-right)
    ctx.strokeStyle = "rgba(190,185,165,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx + 4, cy - 2, r + 2, ry * 0.82, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  }

  // ── Rocks (rocky/steep terrain) ───────────────────────────────────────────────
  if (config.terrain === "rocky" || config.terrain === "steep") {
    for (let i = 0; i < 22; i++) {
      const rx2 = rng() * W, ry2 = HORIZON + rng() * (H - HORIZON) * 0.85;
      const rs = 3 + rng() * 12;
      ctx.fillStyle = `rgba(${100 + rng()*30},${100 + rng()*25},${85 + rng()*25},0.85)`;
      ctx.beginPath();
      ctx.moveTo(rx2, ry2);
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2, rd = rs * (0.7 + rng() * 0.6);
        ctx.lineTo(rx2 + Math.cos(a) * rd, ry2 + Math.sin(a) * rd * 0.5);
      }
      ctx.closePath(); ctx.fill();
      // rock highlight
      ctx.fillStyle = "rgba(200,195,180,0.25)";
      ctx.beginPath(); ctx.ellipse(rx2 + 2, ry2 - 2, rs * 0.4, rs * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Sandy dunes ───────────────────────────────────────────────────────────────
  if (config.terrain === "sandy") {
    for (let i = 0; i < 4; i++) {
      const dx = rng() * W, dy = HORIZON + rng() * (H - HORIZON) * 0.6;
      const dw = 100 + rng() * 180, dh = 18 + rng() * 25;
      const dG = ctx.createLinearGradient(dx, dy - dh, dx, dy + dh);
      dG.addColorStop(0,   "rgba(165,160,140,0.85)");
      dG.addColorStop(0.5, "rgba(145,140,120,0.6)");
      dG.addColorStop(1,   "rgba(130,125,110,0)");
      ctx.fillStyle = dG;
      ctx.beginPath(); ctx.ellipse(dx, dy, dw, dh, 0, Math.PI, Math.PI * 2); ctx.fill();
    }
  }

  // ── Steep ridges ─────────────────────────────────────────────────────────────
  if (config.terrain === "steep") {
    for (let i = 0; i < 3; i++) {
      const sx = 80 + rng() * (W - 160), sh = 40 + rng() * 80;
      ctx.fillStyle = "rgba(90,88,76,0.55)";
      ctx.beginPath();
      ctx.moveTo(sx - 60, HORIZON + 40);
      ctx.lineTo(sx, HORIZON - sh);
      ctx.lineTo(sx + 60, HORIZON + 40);
      ctx.closePath(); ctx.fill();
      // lit face
      ctx.fillStyle = "rgba(185,180,160,0.2)";
      ctx.beginPath();
      ctx.moveTo(sx, HORIZON - sh);
      ctx.lineTo(sx + 60, HORIZON + 40);
      ctx.lineTo(sx + 30, HORIZON + 20);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── Rover silhouette ─────────────────────────────────────────────────────────
  const ROVER_CX = W / 2;
  const ROVER_BASE_Y = HORIZON + 2;
  const U = 28; // unit in pixels

  // Mounted modules info
  const mounted = {
    front:    config.slots["front"]     ? MODULE_CATALOG.find(m => m.id === config.slots["front"])     : null,
    topFront: config.slots["top-front"] ? MODULE_CATALOG.find(m => m.id === config.slots["top-front"]) : null,
    topRear:  config.slots["top-rear"]  ? MODULE_CATALOG.find(m => m.id === config.slots["top-rear"])  : null,
    rear:     config.slots["rear"]      ? MODULE_CATALOG.find(m => m.id === config.slots["rear"])      : null,
    bottom:   config.slots["bottom"]    ? MODULE_CATALOG.find(m => m.id === config.slots["bottom"])    : null,
  };

  // Ground shadow
  const shadowEll = ctx.createRadialGradient(ROVER_CX, ROVER_BASE_Y + 6, 0, ROVER_CX, ROVER_BASE_Y + 6, U * 3.5);
  shadowEll.addColorStop(0,   "rgba(0,0,0,0.5)");
  shadowEll.addColorStop(0.6, "rgba(0,0,0,0.25)");
  shadowEll.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = shadowEll;
  ctx.beginPath(); ctx.ellipse(ROVER_CX, ROVER_BASE_Y + 8, U * 3.5, U * 0.5, 0, 0, Math.PI * 2); ctx.fill();

  // Chassis rectangle
  ctx.fillStyle = "#0d3347";
  ctx.strokeStyle = "#1a5a7a";
  ctx.lineWidth = 1.5;
  const chW = U * 3, chH = U * 0.7;
  const chY = ROVER_BASE_Y - chH - U * 0.45; // above wheels
  ctx.beginPath();
  ctx.roundRect(ROVER_CX - chW / 2, chY, chW, chH, 4);
  ctx.fill(); ctx.stroke();

  // Wheels (4)
  const wheelPositions: [number, number][] = [
    [ROVER_CX - U * 1.1, ROVER_BASE_Y],
    [ROVER_CX - U * 0.3, ROVER_BASE_Y],
    [ROVER_CX + U * 0.3, ROVER_BASE_Y],
    [ROVER_CX + U * 1.1, ROVER_BASE_Y],
  ];
  wheelPositions.forEach(([wx, wy]) => {
    ctx.fillStyle = "#142d3f";
    ctx.strokeStyle = "#22d3ee55";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wx, wy, U * 0.44, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0a1e2d";
    ctx.beginPath(); ctx.arc(wx, wy, U * 0.22, 0, Math.PI * 2); ctx.fill();
  });

  // Front module
  if (mounted.front) {
    ctx.fillStyle = mounted.front.color + "88";
    ctx.strokeStyle = mounted.front.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ROVER_CX + chW / 2, chY + chH * 0.15, U * 0.65, U * 0.6, 3);
    ctx.fill(); ctx.stroke();
    ctx.font = `${U * 0.52}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(mounted.front.icon, ROVER_CX + chW / 2 + U * 0.32, chY + chH * 0.65);
  }

  // Rear module
  if (mounted.rear) {
    ctx.fillStyle = mounted.rear.color + "88";
    ctx.strokeStyle = mounted.rear.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ROVER_CX - chW / 2 - U * 0.65, chY + chH * 0.15, U * 0.65, U * 0.6, 3);
    ctx.fill(); ctx.stroke();
    ctx.font = `${U * 0.52}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(mounted.rear.icon, ROVER_CX - chW / 2 - U * 0.32, chY + chH * 0.65);
  }

  // Top-front module
  if (mounted.topFront) {
    ctx.fillStyle = mounted.topFront.color + "88";
    ctx.strokeStyle = mounted.topFront.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ROVER_CX + U * 0.05, chY - U * 0.55, U * 1.25, U * 0.5, 3);
    ctx.fill(); ctx.stroke();
    ctx.font = `${U * 0.5}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(mounted.topFront.icon, ROVER_CX + U * 0.67, chY - U * 0.2);
  }

  // Top-rear module
  if (mounted.topRear) {
    ctx.fillStyle = mounted.topRear.color + "88";
    ctx.strokeStyle = mounted.topRear.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(ROVER_CX - U * 1.3, chY - U * 0.55, U * 1.25, U * 0.5, 3);
    ctx.fill(); ctx.stroke();
    ctx.font = `${U * 0.5}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(mounted.topRear.icon, ROVER_CX - U * 0.67, chY - U * 0.2);
  }

  // Bottom module (underside, partially visible)
  if (mounted.bottom) {
    ctx.fillStyle = mounted.bottom.color + "55";
    ctx.strokeStyle = mounted.bottom.color + "80";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ROVER_CX - U * 1.2, chY + chH - 2, U * 2.4, U * 0.28, 2);
    ctx.fill(); ctx.stroke();
  }

  // ── Dust particles near rover ─────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const px = ROVER_CX - U * 3 + rng() * U * 6;
    const py = ROVER_BASE_Y - rng() * 10;
    const pr = 0.5 + rng() * 2;
    ctx.fillStyle = `rgba(180,175,155,${0.1 + rng() * 0.25})`;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  }

  // ── Overlay: terrain label ────────────────────────────────────────────────────
  const terrainLabels: Record<string, string> = {
    flat: "MARE PLAIN", rocky: "HIGHLAND ROCK",
    sandy: "REGOLITH DUNE", steep: "CRATER RIDGE",
  };
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.roundRect(12, H - 30, 230, 20, 4); ctx.fill();
  ctx.fillStyle = "rgba(34,211,238,0.85)";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.fillText(terrainLabels[config.terrain] ?? config.terrain.toUpperCase(), 20, H - 16);

  // Rover name
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`LUMOS-1 · ${CHASSIS_KG}kg CHASSIS`, W - 12, H - 16);
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MoonRover({ config }: { config: MissionConfig }) {
  const [view, setView] = useState<"iso" | "scene">("iso");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw canvas whenever config or view changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || view !== "scene") return;
    drawLunarScene(canvas, config);
  }, [config, view]);

  useEffect(() => { redraw(); }, [redraw]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `lumos1-lunar-scene-${config.terrain}.png`;
    a.click();
  }, [config.terrain]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Rover Visualizer</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {view === "iso" ? "Isometric 3D view of the module layout" : "Lunar scene preview for the selected terrain"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "scene" && (
            <button
              onClick={exportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary font-mono text-[10px] tracking-wider hover:bg-primary/20 transition-colors"
            >
              <Download className="w-3 h-3" /> EXPORT PNG
            </button>
          )}
          <div className="flex rounded border border-border overflow-hidden">
            <button
              onClick={() => setView("iso")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] transition-colors ${view === "iso" ? "bg-primary/20 text-primary border-r border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-r border-border"}`}
            >
              <Box className="w-3 h-3" /> 3D View
            </button>
            <button
              onClick={() => setView("scene")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] transition-colors ${view === "scene" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
            >
              <Mountain className="w-3 h-3" /> Lunar Scene
            </button>
          </div>
        </div>
      </div>

      {/* Main view */}
      <div className="bg-[#020c18] flex-1">
        {view === "iso" ? (
          <RoverIsometric config={config} />
        ) : (
          <canvas
            ref={canvasRef}
            width={900}
            height={460}
            className="w-full block"
            style={{ imageRendering: "auto" }}
          />
        )}
      </div>

      {/* Info strip */}
      <div className="border-t border-border px-4 py-2 flex flex-wrap gap-x-6 gap-y-1">
        {ALL_SLOTS.map((sid) => {
          const mod = config.slots[sid] ? MODULE_CATALOG.find(m => m.id === config.slots[sid]) : null;
          return (
            <div key={sid} className="flex items-center gap-1.5 text-[10px]">
              <span className="font-mono text-muted-foreground/60 w-14">{sid}</span>
              {mod ? (
                <>
                  <span>{mod.icon}</span>
                  <span style={{ color: mod.color }} className="font-mono">{mod.labelJa}</span>
                </>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
