import { Router, type IRouter } from "express";
import dgram from "node:dgram";
import {
  GetRoverStatusResponse,
  SendRoverCommandBody,
  SendRoverCommandResponse,
  SendRoverMoveBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ROVER_HOST = process.env["ROVER_HOST"] ?? "192.168.4.1";
const ROVER_PORT = Number(process.env["ROVER_PORT"] ?? "5000");
const PING_ID = process.env["ROVER_PING_ID"] ?? "0x000";

type Sock = dgram.Socket;
let socket: Sock | null = null;
function getSocket(): Sock {
  if (!socket) {
    socket = dgram.createSocket("udp4");
    socket.on("error", () => {});
    socket.bind(0);
  }
  return socket;
}

function sendPacket(id: string, value: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = `${id},${value}`;
    const buf = Buffer.from(payload, "utf8");
    getSocket().send(buf, 0, buf.length, ROVER_PORT, ROVER_HOST, (err) => {
      if (err) reject(err);
      else resolve(payload);
    });
  });
}

async function sendMany(packets: Array<[string, number]>): Promise<string[]> {
  const out: string[] = [];
  for (const [id, v] of packets) {
    out.push(await sendPacket(id, v));
  }
  return out;
}

// CAN ID assignment (firmware v2):
//   0x400 = FR (Front Right)
//   0x401 = RR (Rear  Right)
//   0x402 = FL (Front Left)
//   0x403 = RL (Rear  Left)
//   0x404 = Solar panel DEPLOY (open)
//   0x405 = Solar panel FOLD   (close)
const WHEELS = {
  FR: "0x400",
  RR: "0x401",
  FL: "0x402",
  RL: "0x403",
} as const;

function wheelsForAction(
  action: string,
  speed: number,
): Array<[string, number]> {
  const s = Math.max(-100, Math.min(100, Math.round(speed)));
  const m = Math.abs(s);
  switch (action) {
    case "forward":
      return [[WHEELS.FR, s],  [WHEELS.RR, s],  [WHEELS.FL, s],  [WHEELS.RL, s]];
    case "backward":
      return [[WHEELS.FR, s],  [WHEELS.RR, s],  [WHEELS.FL, s],  [WHEELS.RL, s]];
    case "rotate_left":
      return [[WHEELS.FR, m],  [WHEELS.RR, m],  [WHEELS.FL, -m], [WHEELS.RL, -m]];
    case "rotate_right":
      return [[WHEELS.FR, -m], [WHEELS.RR, -m], [WHEELS.FL, m],  [WHEELS.RL, m]];
    // STR-L / STR-R: differential "veer" — inside wheels run slower than
    // outside wheels so the rover curves toward the requested side instead
    // of strafing sideways.
    case "strafe_left": {
      const inner = Math.round(s * 0.3);
      return [[WHEELS.FR, s],     [WHEELS.RR, s],     [WHEELS.FL, inner], [WHEELS.RL, inner]];
    }
    case "strafe_right": {
      const inner = Math.round(s * 0.3);
      return [[WHEELS.FR, inner], [WHEELS.RR, inner], [WHEELS.FL, s],     [WHEELS.RL, s]];
    }
    case "stop":
      return [[WHEELS.FR, 0], [WHEELS.RR, 0], [WHEELS.FL, 0], [WHEELS.RL, 0]];
    case "solar_deploy":
      return [["0x404", 0]];
    case "solar_fold":
      return [["0x405", 0]];
    case "spell":
      return [["0x450", 0]];
    default:
      return [];
  }
}

// Reachability check via TCP connect to the rover host.
// UDP is connectionless so we use TCP probe as a proxy for "host reachable".
import net from "node:net";

function checkReachable(host: string, port: number, timeoutMs = 800): Promise<{ ok: boolean; latencyMs: number | null; message: string | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean, message: string | null) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve({ ok, latencyMs: ok ? Date.now() - start : null, message });
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true, null));
    sock.once("timeout", () => finish(false, "timeout"));
    sock.once("error", (e) => finish(false, e.message));
    try {
      sock.connect(port, host);
    } catch (e) {
      finish(false, (e as Error).message);
    }
  });
}

router.get("/rover/status", async (req, res) => {
  const probe = await checkReachable(ROVER_HOST, ROVER_PORT);
  const payload = GetRoverStatusResponse.parse({
    connected: probe.ok,
    host: ROVER_HOST,
    port: ROVER_PORT,
    latencyMs: probe.latencyMs,
    lastCheckedAt: new Date().toISOString(),
    message: probe.message,
  });
  // Also try a no-op UDP ping so the rover sees a heartbeat (best-effort).
  sendPacket(PING_ID, 0).catch(() => {});
  req.log?.debug({ probe }, "rover status checked");
  res.json(payload);
});

router.post("/rover/command", async (req, res) => {
  const body = SendRoverCommandBody.parse(req.body);
  try {
    const sent = await sendMany([[body.id, body.value]]);
    res.json(SendRoverCommandResponse.parse({ ok: true, sent, error: null }));
  } catch (err) {
    res.status(500).json(
      SendRoverCommandResponse.parse({
        ok: false,
        sent: [],
        error: (err as Error).message,
      }),
    );
  }
});

router.post("/rover/move", async (req, res) => {
  const body = SendRoverMoveBody.parse(req.body);
  const speed = body.speed ?? 30;
  const packets = wheelsForAction(body.action, speed);
  if (packets.length === 0) {
    res.status(400).json(
      SendRoverCommandResponse.parse({
        ok: false,
        sent: [],
        error: `unknown action: ${body.action}`,
      }),
    );
    return;
  }
  try {
    const sent = await sendMany(packets);
    res.json(SendRoverCommandResponse.parse({ ok: true, sent, error: null }));
  } catch (err) {
    res.status(500).json(
      SendRoverCommandResponse.parse({
        ok: false,
        sent: [],
        error: (err as Error).message,
      }),
    );
  }
});

export default router;
