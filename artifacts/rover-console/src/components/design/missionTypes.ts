// ── Mounting slot IDs ─────────────────────────────────────────────────────────
export type SlotId = "front" | "top-front" | "top-rear" | "rear" | "bottom";

export const SLOT_META: Record<SlotId, { label: string; labelJa: string; position: [number, number, number] }> = {
  "front":     { label: "Front Mount", labelJa: "前部",     position: [ 1.9,  0.0, 0] },
  "top-front": { label: "Top Front",   labelJa: "上部・前", position: [ 0.6,  0.6, 0] },
  "top-rear":  { label: "Top Rear",    labelJa: "上部・後", position: [-0.6,  0.6, 0] },
  "rear":      { label: "Rear Mount",  labelJa: "後部",     position: [-1.9,  0.0, 0] },
  "bottom":    { label: "Belly Mount", labelJa: "下部",     position: [ 0.0, -0.4, 0] },
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
  costM: number;   // USD million (rough private/commercial estimate, capped for ≤100億¥ total)
  color: string;
  icon: string;
  description: string;
}

export const MODULE_CATALOG: ModuleDef[] = [
  // Science
  { id: "drill",     label: "Core Drill",       labelJa: "コアドリル",          category: "science",   compatibleSlots: ["front"],                    weightKg: 2.8,  powerW: 40,   costM: 3.0, color: "#f97316", icon: "⚙️",  description: "圧電式ミニドリル — 10 cm 深度サンプル採掘" },
  { id: "scoop",     label: "Regolith Scoop",   labelJa: "レゴリス採取スコップ", category: "science",   compatibleSlots: ["front", "rear"],            weightKg: 0.8,  powerW: 15,   costM: 1.5, color: "#fb923c", icon: "🪣",  description: "軽量ワイヤー駆動スコップ — 表面レゴリス採取" },
  { id: "arm",       label: "Robotic Arm",      labelJa: "ロボットアーム",       category: "science",   compatibleSlots: ["front", "top-front"],       weightKg: 3.5,  powerW: 25,   costM: 5.0, color: "#ef4444", icon: "🦾",  description: "2 自由度カーボンアーム — 岩石採集・押し当て計測" },
  { id: "spectro",   label: "Spectrometer",     labelJa: "分光計",               category: "science",   compatibleSlots: ["front", "top-front"],       weightKg: 0.5,  powerW: 5,    costM: 2.0, color: "#a78bfa", icon: "🔬",  description: "小型 VNIR 分光計 — 鉱物・化学組成を非接触分析" },
  { id: "micro",     label: "Microscope",       labelJa: "マイクロスコープ",     category: "science",   compatibleSlots: ["front"],                    weightKg: 0.25, powerW: 3,    costM: 0.8, color: "#c084fc", icon: "🔭",  description: "焦点距離可変マイクロカメラ — 10 µm 分解能" },
  // Sensors
  { id: "camera",    label: "Stereo Camera",    labelJa: "ステレオカメラ",       category: "sensor",    compatibleSlots: ["top-front", "front"],       weightKg: 0.2,  powerW: 4,    costM: 0.8, color: "#22d3ee", icon: "📷",  description: "超軽量ステレオカメラ — 深度マップ生成" },
  { id: "lidar",     label: "LiDAR",            labelJa: "ライダー",             category: "sensor",    compatibleSlots: ["top-front"],                weightKg: 0.4,  powerW: 8,    costM: 1.5, color: "#06b6d4", icon: "📡",  description: "固体素子 LiDAR — 360° 点群スキャン（10 m 射程）" },
  { id: "imu",       label: "IMU",              labelJa: "慣性センサー",         category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 0.05, powerW: 1,    costM: 0.3, color: "#67e8f9", icon: "🎯",  description: "MEMS 6 軸 IMU — 姿勢・加速度・角速度" },
  { id: "raddet",    label: "Radiation Det.",   labelJa: "放射線センサー",       category: "sensor",    compatibleSlots: ["top-front","top-rear","rear","bottom"], weightKg: 0.15, powerW: 2, costM: 0.6, color: "#fde68a", icon: "☢️", description: "PIN フォトダイオード式 — 放射線量リアルタイム計測" },
  { id: "gpr",       label: "Ground Radar",     labelJa: "地中探査レーダー",     category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 1.0,  powerW: 12,   costM: 2.0, color: "#38bdf8", icon: "🔊",  description: "小型 GPR — 地下 1 m までの空洞・氷を非破壊探査" },
  { id: "terrain",   label: "Terrain Sensor",   labelJa: "地形センサー",         category: "sensor",    compatibleSlots: ["bottom"],                   weightKg: 0.12, powerW: 2,    costM: 0.5, color: "#7dd3fc", icon: "📐",  description: "レーザー変位計 — 路面硬度・傾斜リアルタイム計測" },
  // Comm
  { id: "uhf",       label: "UHF Radio",        labelJa: "UHF 無線",            category: "comm",      compatibleSlots: ["top-rear","rear"],           weightKg: 0.35, powerW: 10,   costM: 0.8, color: "#34d399", icon: "📻",  description: "パッチアンテナ — 着陸機・オービターとの中継通信" },
  { id: "xband",     label: "X-Band Antenna",   labelJa: "X 帯アンテナ",        category: "comm",      compatibleSlots: ["top-rear"],                 weightKg: 0.9,  powerW: 20,   costM: 2.5, color: "#10b981", icon: "🛰️",  description: "高利得パッチアンテナ — 地球局への直接データ送信" },
  { id: "lasercomm", label: "Laser Comm",       labelJa: "光通信モジュール",     category: "comm",      compatibleSlots: ["top-rear"],                 weightKg: 0.6,  powerW: 15,   costM: 3.5, color: "#6ee7b7", icon: "🔆",  description: "レーザー光通信 — 100 Mbps 以上の大容量データ転送" },
  // Power
  { id: "solar",     label: "Solar Array",      labelJa: "太陽電池パドル",       category: "power",     compatibleSlots: ["top-rear"],                 weightKg: 1.2,  powerW: -50,  costM: 1.5, color: "#fbbf24", icon: "☀️",  description: "折り畳み剛体パネル — 月面昼間 50 W 発電" },
  { id: "rtg",       label: "RTG (mini)",       labelJa: "小型 RTG",             category: "power",     compatibleSlots: ["rear"],                     weightKg: 7.0,  powerW: -30,  costM: 8.0, color: "#f59e0b", icon: "⚡",  description: "プルトニウム熱電発電 — 夜間・永影クレーター対応 30 W" },
  { id: "battery",   label: "Extra Battery",    labelJa: "予備バッテリー",       category: "power",     compatibleSlots: ["rear","top-rear","bottom"],  weightKg: 1.0,  powerW: 0,    costM: 0.8, color: "#d97706", icon: "🔋",  description: "リチウムイオンセルパック — 容量 50 Wh 追加" },
  { id: "fuelcell",  label: "Fuel Cell",        labelJa: "燃料電池",             category: "power",     compatibleSlots: ["bottom"],                   weightKg: 3.0,  powerW: -25,  costM: 2.5, color: "#fcd34d", icon: "🧪",  description: "小型水素燃料電池 — 夜間・長時間運用（−180°C 対応）" },
  // Computing
  { id: "edgeai",    label: "Edge AI Chip",     labelJa: "エッジ AI チップ",    category: "computing", compatibleSlots: ["top-front"],                weightKg: 0.12, powerW: 8,    costM: 1.0, color: "#818cf8", icon: "🧠",  description: "低消費 NPU — オンボード自律走行・障害物検知" },
  { id: "mcu",       label: "Redundant MCU",    labelJa: "冗長制御ユニット",     category: "computing", compatibleSlots: ["top-rear"],                 weightKg: 0.18, powerW: 4,    costM: 0.8, color: "#6366f1", icon: "💻",  description: "三重多数決冗長 MCU — 放射線耐性フォールトトレラント制御" },
];

export const CATEGORY_LABEL: Record<ModuleDef["category"], string> = {
  science:   "Science · 科学",
  sensor:    "Sensors · センサー",
  comm:      "Comm · 通信",
  power:     "Power · 電源",
  computing: "Computing · 計算",
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
    notes: "Mare Crisium 周辺 · CLPS",
  },
  // ── ispace ───────────────────────────────────────────────────────────────────
  {
    id: "ispace3", name: "Mission 3", provider: "ispace (Japan)", agency: "Private",
    targetDate: new Date("2027-06-01"), payloadKg: 30, status: "planned",
    notes: "Falcon 9 · 月面南極 · 小型ローバー搭載枠",
  },
  // ── JAXA ─────────────────────────────────────────────────────────────────────
  {
    id: "lupex", name: "LUPEX", provider: "JAXA / ISRO", agency: "JAXA",
    targetDate: new Date("2027-12-01"), payloadKg: 350, status: "planned",
    notes: "南極永影クレーター · GSLV Mk III · 水探査",
  },
  // ── NASA / CLPS cont. ────────────────────────────────────────────────────────
  {
    id: "im4", name: "IM-4", provider: "Intuitive Machines", agency: "NASA",
    targetDate: new Date("2028-03-01"), payloadKg: 130, status: "planned",
    notes: "南極付近 · CLPS",
  },
  {
    id: "griffin2", name: "Griffin M2", provider: "Astrobotic", agency: "NASA",
    targetDate: new Date("2028-06-01"), payloadKg: 500, status: "planned",
    notes: "南極 · CLPS 大型ペイロード枠",
  },
  // ── ispace (Europe / ESA co-funded) ──────────────────────────────────────────
  {
    id: "ispace4", name: "Mission 4 (Europe)", provider: "ispace Europe", agency: "ESA",
    targetDate: new Date("2028-09-01"), payloadKg: 30, status: "option",
    notes: "Ariane 6 · ESA 共同出資 · 小型ローバー枠",
  },
  // ── JAXA ─────────────────────────────────────────────────────────────────────
  {
    id: "jaxa-sl2", name: "Smart Lander 2", provider: "JAXA", agency: "JAXA",
    targetDate: new Date("2029-01-01"), payloadKg: 200, status: "option",
    notes: "H3 ロケット · SLIM 後継機",
  },
  // ── ESA ──────────────────────────────────────────────────────────────────────
  {
    id: "argonaut", name: "Argonaut / EL3", provider: "ESA / ArianeGroup", agency: "ESA",
    targetDate: new Date("2030-06-01"), payloadKg: 2000, status: "option",
    notes: "Ariane 6 · 南極 · ESA 大型無人着陸機",
  },
  // ── SpaceX / NASA ─────────────────────────────────────────────────────────────
  {
    id: "starship", name: "Starship Lunar Cargo", provider: "SpaceX / NASA", agency: "NASA",
    targetDate: new Date("2029-06-01"), payloadKg: 10000, status: "option",
    notes: "Artemis プログラム · 大型貨物輸送",
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
