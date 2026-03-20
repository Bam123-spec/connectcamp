const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash-lite-001";

type RequestBody = {
  prompt?: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const body = (req.body ?? {}) as RequestBody;
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required." });
  }

  const model = body.model?.trim() || DEFAULT_MODEL;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: body.systemInstruction
            ? {
                parts: [{ text: body.systemInstruction }],
              }
            : undefined,
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
            maxOutputTokens:
              typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 1024,
          },
        }),
      }
    );

    const payload = (await parseJson(response)) as GeminiResponse | null;

    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.error?.message || "Gemini request failed.",
      });
    }

    const text = extractText(payload);
    if (!text) {
      return res.status(502).json({ error: "Gemini returned no text response." });
    }

    return res.status(200).json({
      text,
      model,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return res.status(500).json({ error: message });
  }
}

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractText(payload: GeminiResponse | null) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];

  return (
    parts
      .map((part) => part.text?.trim() || "")
      .filter(Boolean)
      .join("\n")
      .trim() || null
  );
}

