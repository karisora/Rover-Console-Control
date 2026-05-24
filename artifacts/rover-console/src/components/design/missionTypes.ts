// ── Mounting slot IDs ─────────────────────────────────────────────────────────
export type SlotId = "front" | "top-front" | "top-rear" | "rear" | "bottom";

export const SLOT_META: Record<SlotId, { label: string; labelJa: string; position: [number, number, number] }> = {
  "front":     { label: "Front Mount", labelJa: "Front",     position: [ 1.9,  0.0, 0] },
  "top-front": { label: "Top Front",   labelJa: "Top Front", position: [ 0.6,  0.6, 0] },
  "top-rear":  { label: "Top Rear",    labelJa: "Top Rear",  position: [-0.6,  0.6, 0] },
  "rear":      { label: "Rear Mount",  labelJa: "Rear",      position: [-1.9,  0.0, 0] },
  "bottom":    { label: "Belly Mount", labelJa: "Belly",     position: [ 0.0, -0.4, 0] },
};

export const ALL_SLOTS: SlotId[] = ["front", "top-front", "top-rear", "rear", "bottom"];

// ── Mass budget constants ─────────────────────────────────────────────────────
export const CHASSIS_KG     = 10.0; // base chassis (frame + wheels + motors + avionics + battery)
export const MAX_ROVER_KG   = 30.0; // hard mass limit
export const MODULE_BUDGET_KG = MAX_ROVER_KG - CHASSIS_KG;

// ── Module definitions ────────────────────────────────────────────────────────
export interface ModuleDef {
  id: string;
  label: string;
  labelJa: string;
  category: "science" | "sensor" | "comm" | "power" | "computing";
  compatibleSlots: SlotId[];
  weightKg: number;
  powerW: number;
  costM: number;   // USD million, rough private/commercial estimate
  color: string;
  icon: string;
  description: string;
}

export const MODULE_CATALOG: ModuleDef[] = [
  // Science
  { id: "drill",     label: "Core Drill",       labelJa: "Core Drill",       category: "science",   compatibleSlots: ["front"],                    weightKg: 2.8,  powerW: 40,   costM: 3.0, color: "#f97316", icon: "⚙️",  description: "Piezo mini drill, 10 cm subsurface sampling" },
  { id: "scoop",     label: "Regolith Scoop",   labelJa: "Regolith Scoop",   category: "science",   compatibleSlots: ["front", "rear"],            weightKg: 0.8,  powerW: 15,   costM: 1.5, color: "#fb923c", icon: "🪣",  description: "Lightweight wire-driven scoop for surface regolith" },
  { id: "arm",       label: "Robotic Arm",      labelJa: "Robotic Arm",      category: "science",   compatibleSlots: ["front", "top-front"],       weightKg: 3.5,  powerW: 25,   costM: 5.0, color: "#ef4444", icon: "🦾",  description: "Two-axis carbon arm for rock handling and contact sensing" },
  { id: "spectro",   label: "Spectrometer",     labelJa: "Spectrometer",     category: "science",   compatibleSlots: ["front", "top-front"],       weightKg: 0.5,  powerW: 5,    costM: 2.0, color: "#a78bfa", icon: "🔬",  description: "Compact VNIR spectrometer for mineral and chemistry surveys" },
  { id: "micro",     label: "Microscope",       labelJa: "Microscope",       category: "science",   compatibleSlots: ["front"],                    weightKg: 0.25, powerW: 3,    costM: 0.8, color: "#c084fc", icon: "🔭",  description: "Variable-focus micro camera with 10 um class resolution" },
  // Sensors
  { id: "camera",    label: "Stereo Camera",    labelJa: "Stereo Camera",    category: "sensor",    compatibleSlots: ["top-front", "front"],       weightKg: 0.2,  powerW: 4,    costM: 0.8, color: "#22d3ee", icon: "📷",  description: "Ultralight stereo camera for depth map generation" },
  { id: "lidar",     label: "LiDAR",            labelJa: "LiDAR",            category: "sensor",    compatibleSlots: ["top-front"],                weightKg: 0.4,  powerW: 8,    costM: 1.5, color: "#06b6d4", icon: "📡",  description: "Solid-state LiDAR with 360 degree point cloud coverage" },
  { id: "imu",       label: "IMU",              labelJa: "IMU",              category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 0.05, powerW: 1,    costM: 0.3, color: "#67e8f9", icon: "🎯",  description: "MEMS 6-axis IMU for attitude, acceleration, and rates" },
  { id: "raddet",    label: "Radiation Det.",   labelJa: "Radiation Det.",   category: "sensor",    compatibleSlots: ["top-front","top-rear","rear","bottom"], weightKg: 0.15, powerW: 2, costM: 0.6, color: "#fde68a", icon: "☢️", description: "PIN photodiode radiation monitor for real-time dose tracking" },
  { id: "gpr",       label: "Ground Radar",     labelJa: "Ground Radar",     category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 1.0,  powerW: 12,   costM: 2.0, color: "#38bdf8", icon: "🔊",  description: "Compact GPR for nondestructive void and ice surveys to 1 m" },
  { id: "terrain",   label: "Terrain Sensor",   labelJa: "Terrain Sensor",   category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 0.12, powerW: 2,    costM: 0.5, color: "#7dd3fc", icon: "📐",  description: "Laser displacement sensor for slope and surface stiffness" },
  // Comm
  { id: "uhf",       label: "UHF Radio",        labelJa: "UHF Radio",        category: "comm",      compatibleSlots: ["top-rear","rear"],           weightKg: 0.35, powerW: 10,   costM: 0.8, color: "#34d399", icon: "📻",  description: "Patch antenna relay link to lander or orbiter" },
  { id: "xband",     label: "X-Band Antenna",   labelJa: "X-Band Antenna",   category: "comm",      compatibleSlots: ["top-rear"],                 weightKg: 0.9,  powerW: 20,   costM: 2.5, color: "#10b981", icon: "🛰️",  description: "High-gain patch antenna for direct Earth data return" },
  { id: "lasercomm", label: "Laser Comm",       labelJa: "Laser Comm",       category: "comm",      compatibleSlots: ["top-rear"],                 weightKg: 0.6,  powerW: 15,   costM: 3.5, color: "#6ee7b7", icon: "🔆",  description: "Optical communications module for high-rate downlink" },
  // Power
  { id: "solar",     label: "Solar Array",      labelJa: "Solar Array",      category: "power",     compatibleSlots: ["top-rear"],                 weightKg: 1.2,  powerW: -50,  costM: 1.5, color: "#fbbf24", icon: "☀️",  description: "Deployable rigid panel, 50 W generation during lunar day" },
  { id: "rtg",       label: "RTG (mini)",       labelJa: "Mini RTG",         category: "power",     compatibleSlots: ["rear"],                     weightKg: 7.0,  powerW: -30,  costM: 8.0, color: "#f59e0b", icon: "⚡",  description: "Radioisotope thermoelectric power for night and shadowed regions" },
  { id: "battery",   label: "Extra Battery",    labelJa: "Extra Battery",    category: "power",     compatibleSlots: ["rear","top-rear","bottom"],  weightKg: 1.0,  powerW: 0,    costM: 0.8, color: "#d97706", icon: "🔋",  description: "Additional lithium-ion pack with 50 Wh class capacity" },
  { id: "fuelcell",  label: "Fuel Cell",        labelJa: "Fuel Cell",        category: "power",     compatibleSlots: ["bottom"],                   weightKg: 3.0,  powerW: -25,  costM: 2.5, color: "#fcd34d", icon: "🧪",  description: "Compact hydrogen fuel cell for long night operations" },
  // Computing
  { id: "edgeai",    label: "Edge AI Chip",     labelJa: "Edge AI Chip",     category: "computing", compatibleSlots: ["top-front"],                weightKg: 0.12, powerW: 8,    costM: 1.0, color: "#818cf8", icon: "🧠",  description: "Low-power NPU for onboard autonomy and obstacle detection" },
  { id: "mcu",       label: "Redundant MCU",    labelJa: "Redundant MCU",    category: "computing", compatibleSlots: ["top-rear"],                 weightKg: 0.18, powerW: 4,    costM: 0.8, color: "#6366f1", icon: "💻",  description: "Triple-voted redundant MCU for radiation tolerant control" },
];

export const CATEGORY_LABEL: Record<ModuleDef["category"], string> = {
  science:   "Science",
  sensor:    "Sensors",
  comm:      "Comm",
  power:     "Power",
  computing: "Computing",
};

// ── Mission configuration ─────────────────────────────────────────────────────
export type Terrain  = "flat" | "rocky" | "sandy" | "steep";
export type Priority = "speed" | "safety" | "science" | "endurance";

export interface MissionConfig {
  slots: Partial<Record<SlotId, string>>;
  terrain: Terrain;
  durationDays: number;
  priority: Priority;
  payloadKg: number;
  notes: string;
}

export const DEFAULT_MISSION: MissionConfig = {
  slots: {},
  terrain: "rocky",
  durationDays: 14,
  priority: "safety",
  payloadKg: 0,
  notes: "",
};

// ── Launch opportunities (multi-agency, as of 2026) ───────────────────────────
export interface ClpsLander {
  id: string;
  name: string;
  provider: string;
  agency: "NASA" | "ESA" | "JAXA" | "Private" | "ISRO";
  targetDate: Date;
  payloadKg: number;
  status: "confirmed" | "planned" | "option";
  notes: string;
}

export const CLPS_LANDERS: ClpsLander[] = [
  // ── NASA / CLPS ──────────────────────────────────────────────────────────────
  {
    id: "im3", name: "IM-3", provider: "Intuitive Machines", agency: "NASA",
    targetDate: new Date("2026-09-01"), payloadKg: 130, status: "confirmed",
    notes: "Reiner Gamma · NASA CLPS TO 19D",
  },
  {
    id: "bg2", name: "Blue Ghost M2", provider: "Firefly Aerospace", agency: "NASA",
    targetDate: new Date("2027-01-01"), payloadKg: 150, status: "planned",
    notes: "Mare Crisium region, CLPS",
  },
  // ── ispace ───────────────────────────────────────────────────────────────────
  {
    id: "ispace3", name: "Mission 3", provider: "ispace (Japan)", agency: "Private",
    targetDate: new Date("2027-06-01"), payloadKg: 30, status: "planned",
    notes: "Falcon 9, lunar south pole, small rover payload slot",
  },
  // ── JAXA ─────────────────────────────────────────────────────────────────────
  {
    id: "lupex", name: "LUPEX", provider: "JAXA / ISRO", agency: "JAXA",
    targetDate: new Date("2027-12-01"), payloadKg: 350, status: "planned",
    notes: "South polar permanently shadowed crater, GSLV Mk III, water survey",
  },
  // ── NASA / CLPS cont. ────────────────────────────────────────────────────────
  {
    id: "im4", name: "IM-4", provider: "Intuitive Machines", agency: "NASA",
    targetDate: new Date("2028-03-01"), payloadKg: 130, status: "planned",
    notes: "Near lunar south pole, CLPS",
  },
  {
    id: "griffin2", name: "Griffin M2", provider: "Astrobotic", agency: "NASA",
    targetDate: new Date("2028-06-01"), payloadKg: 500, status: "planned",
    notes: "Lunar south pole, CLPS large payload capacity",
  },
  // ── ispace (Europe / ESA co-funded) ──────────────────────────────────────────
  {
    id: "ispace4", name: "Mission 4 (Europe)", provider: "ispace Europe", agency: "ESA",
    targetDate: new Date("2028-09-01"), payloadKg: 30, status: "option",
    notes: "Ariane 6, ESA co-funded, small rover payload slot",
  },
  // ── JAXA ─────────────────────────────────────────────────────────────────────
  {
    id: "jaxa-sl2", name: "Smart Lander 2", provider: "JAXA", agency: "JAXA",
    targetDate: new Date("2029-01-01"), payloadKg: 200, status: "option",
    notes: "H3 rocket, SLIM successor concept",
  },
  // ── ESA ──────────────────────────────────────────────────────────────────────
  {
    id: "argonaut", name: "Argonaut / EL3", provider: "ESA / ArianeGroup", agency: "ESA",
    targetDate: new Date("2030-06-01"), payloadKg: 2000, status: "option",
    notes: "Ariane 6, south pole, ESA large robotic lander",
  },
  // ── SpaceX / NASA ─────────────────────────────────────────────────────────────
  {
    id: "starship", name: "Starship Lunar Cargo", provider: "SpaceX / NASA", agency: "NASA",
    targetDate: new Date("2029-06-01"), payloadKg: 10000, status: "option",
    notes: "Artemis program, large cargo delivery",
  },
];

// Agency badge colors
export const AGENCY_COLOR: Record<ClpsLander["agency"], string> = {
  NASA:    "#0b3d91",
  ESA:     "#003399",
  JAXA:    "#1e88e5",
  ISRO:    "#ff9800",
  Private: "#34d399",
};
