import { describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { externalLlmConfigured, invokeExternalLLM, preserveContent, validateExternalLLM } from "./external-llm";

describe("RelayModels external LLM", () => {
  it("preserves image and PDF content parts instead of stringifying them", () => {
    const content = [{ type: "text" as const, text: "Analise" }, { type: "image_url" as const, image_url: { url: "https://example.com/image.png" } }, { type: "file_url" as const, file_url: { url: "https://example.com/file.pdf", mime_type: "application/pdf" as const } }];
    expect(preserveContent(content)).toEqual(content);
  });

  it("validates the configured key against the lightweight models endpoint", async () => {
    if (!externalLlmConfigured()) {
      expect(ENV.externalLlmEnabled).toBe(false);
      return;
    }

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: ENV.externalLlmModel }, { id: "other-model" }] }), { status: 200 })));
    const result = await validateExternalLLM();
    expect(result.modelCount).toBeGreaterThan(0);
    expect(result.hasConfiguredModel).toBe(true);
  }, 20_000);

  it("forwards tools and tool choice to the OpenAI-compatible gateway", async () => {
    if (!externalLlmConfigured()) return;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.tools[0].function.name).toBe("search_youtube");
      expect(body.tool_choice).toBe("auto");
      return new Response(JSON.stringify({ id: "chat-test", created: 1, model: ENV.externalLlmModel, choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await invokeExternalLLM({ messages: [{ role: "user", content: "teste" }], tools: [{ type: "function", function: { name: "search_youtube", parameters: { type: "object" } } }], toolChoice: "auto" });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("caps excessive completion tokens before sending to RelayModels", async () => {
    if (!externalLlmConfigured()) return;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.max_tokens).toBe(1200);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await invokeExternalLLM({ messages: [{ role: "user", content: "teste" }], maxTokens: 5000 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
