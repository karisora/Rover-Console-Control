import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const DEFAULT_ENDPOINT = "https://lumos-rover-01.openai.azure.com/openai/v1";
const DEFAULT_DEPLOYMENT = "gpt-4.1-mini";

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AzureChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function headerString(req: Request, name: string) {
  const value = req.header(name);
  return typeof value === "string" ? value.trim() : "";
}

function getModelConfig(req: Request) {
  return {
    endpoint: (
      headerString(req, "X-Azure-OpenAI-Endpoint") ||
      process.env["AZURE_OPENAI_ENDPOINT"] ||
      DEFAULT_ENDPOINT
    ).replace(/\/+$/, ""),
    deployment:
      headerString(req, "X-Azure-OpenAI-Deployment") ||
      process.env["AZURE_OPENAI_DEPLOYMENT"] ||
      DEFAULT_DEPLOYMENT,
    apiKey:
      headerString(req, "X-Azure-OpenAI-Key") ||
      process.env["AZURE_OPENAI_API_KEY"] ||
      process.env["OPENAI_API_KEY"] ||
      "",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model did not return JSON");
  return asRecord(JSON.parse(cleaned.slice(start, end + 1)));
}

async function callRoverModel(req: Request, messages: ChatMessage[], temperature = 0.25): Promise<string> {
  const { endpoint, deployment, apiKey } = getModelConfig(req);
  if (!apiKey) {
    throw new Error("Azure OpenAI API key is not configured");
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      messages,
      temperature,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const data = await response.json().catch(() => ({})) as AzureChatResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `model request failed with ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("model returned an empty response");
  return content;
}

function sendModelError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "model request failed";
  const status = message.includes("not configured") ? 503 : 502;
  res.status(status).json({ ok: false, error: message });
}

router.post("/design/analysis", async (req: Request, res: Response) => {
  try {
    const payload = asRecord(req.body);
    const system = [
      "You are an AI specialized in planetary and lunar exploration rover design review.",
      "Use the provided structure parameters, mission conditions, mounted modules, and physics candidate scores to choose the rover form.",
      "Assume a small rover near the 30 kg class. Prioritize safety margin, center of mass, power, terrain adaptability, and science value.",
      "Adopt only the minimum safety mechanisms needed for a credible rover: basic stability margin, traction appropriate to the terrain, essential fault tolerance, and enough power margin for the mission.",
      "Among rover forms that satisfy those minimum safety requirements, prefer the lowest-cost, simplest, and easiest-to-build option.",
      "Do not choose an expensive or complex rover form unless the cheaper forms fail the minimum safety requirements for the selected terrain, payload, or mission duration.",
      "The final ranking must be your AI design judgment, not a blind copy of the heuristic scores.",
      "Return JSON only. Do not put markdown or prose outside the JSON object.",
    ].join("\n");
    const schema = {
      recommendations: [
        {
          id: "4wheel | 6wheel | crawler | legged",
          score: 0,
          reasons: ["short English reason, max 4 items"],
          warnings: ["short English warning, only when needed"],
        },
      ],
      narrative: "English summary in 2 sentences or fewer",
    };

    const content = await callRoverModel(req, [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          "Evaluate this rover design state and return the recommendation in the requested JSON schema.",
          `JSON schema: ${JSON.stringify(schema)}`,
          `Design state: ${JSON.stringify(payload)}`,
        ].join("\n\n"),
      },
    ]);

    res.json({ ok: true, source: "azure-openai", ...extractJsonObject(content) });
  } catch (error) {
    sendModelError(res, error);
  }
});

router.post("/design/chat", async (req: Request, res: Response) => {
  try {
    const body = asRecord(req.body);
    const rawMessages = Array.isArray(body["messages"]) ? body["messages"] : [];
    const messages: ChatMessage[] = rawMessages
      .map((message): ChatMessage | null => {
        const item = asRecord(message);
        const role = item["role"];
        const content = item["content"];
        if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
        return { role, content: content.slice(0, 4000) };
      })
      .filter((message): message is ChatMessage => message !== null)
      .slice(-10);

    const context = {
      mission: body["config"],
      structure: body["params"],
    };

    const reply = await callRoverModel(req, [
      {
        role: "system",
        content: [
          "You are the consultation AI for a planetary and lunar rover design lab.",
          "Use the current design context and reply in English with practical, testable engineering advice.",
          "Favor low-cost choices that still meet minimum credible safety requirements. Avoid adding expensive redundancy or complex mechanisms unless they directly reduce a clear mission risk.",
          "Keep the answer concise. When helpful, separate recommended changes, rationale, and cautions.",
          `Current design context: ${JSON.stringify(context)}`,
        ].join("\n"),
      },
      ...messages,
    ], 0.35);

    res.json({ ok: true, message: reply });
  } catch (error) {
    sendModelError(res, error);
  }
});

export default router;
