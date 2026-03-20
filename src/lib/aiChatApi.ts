const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const SERVER_ENDPOINT = "/api/ai-chat";

type AIChatRequest = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

class AIChatError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIChatError";
    this.status = status;
  }
}

export async function generateAIResponse({
  prompt,
  systemInstruction,
  model,
  temperature = DEFAULT_TEMPERATURE,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
}: AIChatRequest): Promise<string> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new AIChatError("Prompt is required.");
  }

  const selectedModel =
    model?.trim() ||
    import.meta.env.VITE_GEMINI_MODEL?.trim() ||
    DEFAULT_MODEL;

  try {
    return await callServer({
      prompt: normalizedPrompt,
      systemInstruction,
      model: selectedModel,
      temperature,
      maxOutputTokens,
    });
  } catch (error) {
    const browserKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
    if (!browserKey) {
      throw error;
    }

    return callGeminiDirect({
      apiKey: browserKey,
      prompt: normalizedPrompt,
      systemInstruction,
      model: selectedModel,
      temperature,
      maxOutputTokens,
    });
  }
}

async function callServer(request: AIChatRequest) {
  const response = await fetch(SERVER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = await parseJson<{ text?: string; error?: string }>(response);

  if (!response.ok) {
    throw new AIChatError(
      payload?.error || "AI assistant request failed.",
      response.status
    );
  }

  const text = payload?.text?.trim();
  if (!text) {
    throw new AIChatError("AI assistant returned an empty response.", 502);
  }

  return text;
}

async function callGeminiDirect({
  apiKey,
  prompt,
  systemInstruction,
  model,
  temperature,
  maxOutputTokens,
}: AIChatRequest & { apiKey: string }) {
  const selectedModel = model?.trim() || DEFAULT_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      selectedModel
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: systemInstruction
          ? {
              parts: [{ text: systemInstruction }],
            }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    }
  );

  const payload = await parseJson<GeminiResponse>(response);

  if (!response.ok) {
    throw new AIChatError(
      payload?.error?.message || "Gemini request failed.",
      response.status
    );
  }

  const text = extractGeminiText(payload);
  if (!text) {
    throw new AIChatError("Gemini returned no text response.", 502);
  }

  return text;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractGeminiText(payload: GeminiResponse | null) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text?.trim() || "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}
