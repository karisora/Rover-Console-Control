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
      "あなたは惑星・月面探査ローバーの設計レビューに特化したAIです。",
      "与えられた構造パラメーター、ミッション条件、搭載モジュール、ローカル物理スコアを使い、設計候補を現実的に評価してください。",
      "質量30kg級の小型ローバーを想定し、安全率、重心、消費電力、地形適応、科学価値を重視します。",
      "出力はJSONのみ。markdownや説明文をJSONの外に出さないでください。",
    ].join("\n");
    const schema = {
      recommendations: [
        {
          id: "4wheel | 6wheel | crawler | legged",
          score: 0,
          reasons: ["日本語で短く、最大4件"],
          warnings: ["日本語で短く、必要な場合のみ"],
        },
      ],
      narrative: "日本語で2文以内の総評",
    };

    const content = await callRoverModel(req, [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          "以下の設計状態を評価して、JSONスキーマに沿って推薦候補を返してください。",
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
          "あなたは惑星・月面探査ローバー設計LABの相談AIです。",
          "現在の設計条件を前提に、実装可能で検証しやすい助言を日本語で返してください。",
          "回答は簡潔に。必要なら推奨変更、理由、注意点を分けてください。",
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
