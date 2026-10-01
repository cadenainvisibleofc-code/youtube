import { ENV } from "./_core/env";
import type { InvokeParams, InvokeResult, MessageContent } from "./_core/llm";

const MAX_EXTERNAL_COMPLETION_TOKENS = 1200;

function requireExternalConfig() {
  if (!ENV.externalLlmEnabled || !ENV.externalLlmBaseUrl || !ENV.externalLlmApiKey) {
    throw new Error("Provedor LLM externo não está configurado");
  }
  return {
    baseUrl: ENV.externalLlmBaseUrl.replace(/\/$/, ""),
    apiKey: ENV.externalLlmApiKey,
  };
}

export function preserveContent(content: MessageContent | MessageContent[]) {
  if (Array.isArray(content)) return content.map(part => typeof part === "string" ? { type: "text", text: part } : part);
  return content;
}

export function externalLlmConfigured() {
  return Boolean(ENV.externalLlmEnabled && ENV.externalLlmBaseUrl && ENV.externalLlmApiKey);
}

export async function invokeExternalLLM(params: InvokeParams): Promise<InvokeResult> {
  const { baseUrl, apiKey } = requireExternalConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const payload: Record<string, unknown> = {
      model: params.model || ENV.externalLlmModel,
      messages: params.messages.map(message => ({
        role: message.role,
        ...(message.name ? { name: message.name } : {}),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
        content: preserveContent(message.content),
      })),
    };

    const maxTokens = params.max_tokens ?? params.maxTokens;
    if (typeof maxTokens === "number") payload.max_tokens = Math.max(1, Math.min(MAX_EXTERNAL_COMPLETION_TOKENS, Math.floor(maxTokens)));
    const responseFormat = params.response_format ?? params.responseFormat;
    if (responseFormat) payload.response_format = responseFormat;
    if (params.reasoning) payload.reasoning = params.reasoning;
    if (params.thinking) payload.thinking = params.thinking;
    if (params.tools) payload.tools = params.tools;
    const toolChoice = params.tool_choice ?? params.toolChoice;
    if (toolChoice) payload.tool_choice = toolChoice;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`RelayModels request failed: ${response.status} ${detail.slice(0, 300)}`);
    }
    return (await response.json()) as InvokeResult;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateExternalLLM(): Promise<{ modelCount: number; hasConfiguredModel: boolean }> {
  const { baseUrl, apiKey } = requireExternalConfig();
  const response = await fetch(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RelayModels models request failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  const models = body.data ?? [];
  return {
    modelCount: models.length,
    hasConfiguredModel: models.some(model => model.id === ENV.externalLlmModel),
  };
}
