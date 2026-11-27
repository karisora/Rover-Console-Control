# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `node tools/rover-bridge.mjs` — run the LOCAL UDP bridge on the Mac that's joined to the Pico's `LumOS1-Pico2W` Wi-Fi AP. Required to actually drive the rover; the cloud server cannot reach `192.168.4.1`. After starting, open the console and set Bridge URL to `http://127.0.0.1:5050`.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Design Lab — slot layout

SlotId = `"front" | "top-front" | "top-rear" | "rear" | "bottom"` (top-mid removed May 2026)
ALL_SLOTS = `["front", "top-front", "top-rear", "rear", "bottom"]`
Bottom slot = belly-mount, partially inset into body SVG.

## Design Lab — MissionTimeline

After simulation completes, `MissionTimeline` shows:
- Gantt (Concept → PDR → CDR+Build → I&T → Campaign), complexity-based durations
- Budget breakdown in $M (hardware / testing / ops / PM / contingency), ¥ equivalent, capped at ~100億円 ($67M)
- Launch window table: NASA CLPS, JAXA LUPEX, ESA Argonaut, ispace Mission 3/4 — earliest compatible window highlighted
- Mass warning if rover exceeds 30 kg limit

## Design Lab — MoonRover (Rover Visualizer)

Two-tab component, completely SVG + Canvas (no WebGL):
- **3D ビュー**: isometric SVG showing chassis + mounted modules at real slot positions. Module icons + colored boxes. Arrow shows front direction.
- **月面配置**: Canvas 2D lunar scene — stars, Earth, procedural terrain (4 types), craters/rocks/dunes, rover silhouette with module attachments. Terrain driven by `config.terrain`. Seeded PRNG for deterministic render. PNG export button.
- Pass `config={mission}` from DesignLab.tsx.

## Budget formula (MissionTimeline.tsx)

`$3M base + Σ module.costM → hardware; testing 22%; ops $0.4M/lunar-day + $2M base; program 12%; contingency 18%`
Max full-slot load ≈ $41M ≈ 62億円 (well under 100億円)

## CLPS_LANDERS (missionTypes.ts)

Agencies: NASA, JAXA, ESA, Private (ispace), ISRO
Key additions (May 2026): ispace M3 (2027-06), LUPEX/JAXA+ISRO (2027-12), ispace M4 Europe/ESA (2028-09), ESA Argonaut (2030-06)
