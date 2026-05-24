import type { RoverParams } from "./RoverParamsContext";
import type { MissionConfig } from "./missionTypes";

export interface ModelRecommendation {
  id: string;
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface DesignAnalysisResponse {
  ok: boolean;
  source?: string;
  recommendations?: ModelRecommendation[];
  narrative?: string;
  error?: string;
}

export interface DesignChatMessage {
  role: "user" | "assistant";
  content: string;
}

const API_KEY_STORAGE_KEY = "rover-design-ai-api-key";

interface AnalysisPayload {
  config: MissionConfig;
  params: RoverParams;
  heuristicCandidates: ModelRecommendation[];
}

export function getStoredDesignAiApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredDesignAiApiKey(apiKey: string) {
  try {
    if (apiKey.trim()) localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {}
}

function requestHeaders(): HeadersInit {
  const apiKey = getStoredDesignAiApiKey();
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-Azure-OpenAI-Key": apiKey } : {}),
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

export function requestDesignAnalysis(payload: AnalysisPayload) {
  return postJson<DesignAnalysisResponse>("/api/design/analysis", payload);
}

export function requestDesignChat(payload: {
  config: MissionConfig;
  params: RoverParams;
  messages: DesignChatMessage[];
}) {
  return postJson<{ ok: boolean; message: string; error?: string }>("/api/design/chat", payload);
}
