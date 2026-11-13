/** Server-only Gemini adapter. Shares the validated Shelf Sense response contract. */
export type GeminiEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
};
export async function gemini(
  env: GeminiEnv,
  path: string,
  payload: any,
  timeout: number,
) {
  const image = path === "images/generations";
  const model = image
    ? env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image"
    : env.GEMINI_TEXT_MODEL || "gemini-flash-lite-latest";
  const config = image
    ? {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      }
    : {
        responseMimeType: "application/json",
        responseJsonSchema: payload.text.format.schema,
        maxOutputTokens: 8192,
      };
  const request = {
    contents: [
      {
        role: "user",
        parts: [{ text: image ? payload.prompt : payload.input }],
      },
    ],
    ...(!image
      ? { systemInstruction: { parts: [{ text: payload.instructions }] } }
      : {}),
    generationConfig: config,
  };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY!,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeout),
    },
  );
  const result = (await response.json()) as any;
  if (!response.ok) {
    const reason = result.error?.details?.find((d: any) => d.reason)?.reason;
    throw Error(
      response.status === 429
        ? "provider_limit"
        : response.status === 503 || response.status === 500
          ? "provider_unavailable"
          : response.status === 401 ||
              response.status === 403 ||
              reason === "API_KEY_INVALID"
            ? "provider_access"
            : "provider_error",
    );
  }
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw Error("incomplete_response");
  const parts = candidate.content?.parts ?? [];
  if (image) {
    const file = parts.find((p: any) => p.inlineData)?.inlineData;
    if (
      !file ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.mimeType)
    )
      throw Error("invalid_response");
    return { data: [{ b64_json: file.data }], mimeType: file.mimeType };
  }
  const text = parts
    .filter((p: any) => !p.thought && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("");
  if (!text) throw Error("invalid_response");
  return {
    status: "completed",
    output: [{ content: [{ type: "output_text", text }] }],
  };
}
