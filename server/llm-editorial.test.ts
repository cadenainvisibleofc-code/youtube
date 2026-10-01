import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";
import { compactEditorialInput, generateEditorialDraft } from "./llm-editorial";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

const mockedInvokeLLM = vi.mocked(invokeLLM);

beforeEach(() => {
  mockedInvokeLLM.mockReset();
  delete process.env.AI_EDITORIAL_ENABLED;
  // Unit tests exercise the Manus adapter mock; the live RelayModels probe is covered separately.
  process.env.AI_EDITORIAL_PROVIDER = "manus";
});

describe("generateEditorialDraft", () => {
  it("compacts whitespace and bounds editorial input before generation", () => {
    const result = compactEditorialInput({ videoTitle: "  Título\n\n longo  ", videoTheme: " ansiedade\t e esperança ", commentText: " uma   mensagem\ncom espaço ", link: "https://example.com" });
    expect(result.videoTitle).toBe("Título longo");
    expect(result.videoTheme).toBe("ansiedade e esperança");
    expect(result.commentText).toBe("uma mensagem com espaço");
    expect(result.link).toBeUndefined();
  });

  it("uses deterministic fallback while the model flag is disabled", async () => {
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad" });
    expect(result.type).toBe("A_video");
    expect(result.containsLink).toBe(false);
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("blocks link generation for critical context before checking the model flag", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    const result = await generateEditorialDraft({ videoTitle: "Ayuda", videoTheme: "una emergencia y no quiero vivir", link: "https://example.com" });
    expect(result.riskLevel).toBe("critical");
    expect(result.containsLink).toBe(false);
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("falls back when the model returns malformed JSON", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    mockedInvokeLLM.mockResolvedValue({ choices: [{ message: { content: "not-json" } }] } as never);
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad" });
    expect(result.type).toBe("A_video");
    expect(result.containsLink).toBe(false);
  });

  it("falls back when the model request fails", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    mockedInvokeLLM.mockRejectedValue(new Error("upstream unavailable"));
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad" });
    expect(result.type).toBe("A_video");
    expect(result.containsLink).toBe(false);
  });

  it("falls back when the model invents promotional language or a link", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    mockedInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "A_video", text: "Compre agora e clique aqui https://spam.example", containsLink: false, riskLevel: "low", justification: "bad" }) } }],
    } as never);
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad" });
    expect(result.type).toBe("A_video");
    expect(result.containsLink).toBe(false);
    expect(result.text).not.toContain("Compre");
  });

  it("only accepts a link when it is the requested Cadena Invisible link", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    const link = "https://tinyurl.com/cadenainvisible-lectura";
    mockedInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "C_link", text: `La soledad que nombra el video puede abrir una lectura breve: ${link}`, containsLink: true, riskLevel: "low", justification: "contextual" }) } }],
    } as never);
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad", link });
    expect(result.type).toBe("C_link");
    expect(result.containsLink).toBe(true);
    expect(result.text).toContain(link);
  });

  it("injects the contextual skill and approved memory into the model prompt", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    mockedInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "A_video", text: "El comentario nombra el cansancio de sostenerlo todo. Esa imagen merece una respuesta que no la convierta en una frase genérica.", containsLink: false, riskLevel: "low", justification: "contextual" }) } }],
    } as never);
    await generateEditorialDraft({
      videoTitle: "Cuando sostenerlo todo pesa",
      videoTheme: "La descripción habla del cansancio de sostener responsabilidades familiares.",
      commentText: "Siento que llevo todo solo.",
      editorialContext: "MEMÓRIA EDITORIAL ATIVA: reconhecer o detalhe específico antes de qualquer leitura.",
    });
    const params = mockedInvokeLLM.mock.calls[0]?.[0] as { messages?: Array<{ role: string; content: unknown }> };
    const systemMessage = params.messages?.find(message => message.role === "system");
    expect(systemMessage?.content).toContain("FLUXO OBRIGATÓRIO ANTES DE ESCREVER");
    expect(systemMessage?.content).toContain("reconhecer o detalhe específico");
  });

  it("compacts an overly long model response before returning it", async () => {
    process.env.AI_EDITORIAL_ENABLED = "1";
    const longText = Array.from({ length: 14 }, (_, index) => `Esta es la frase sobre la soledad ${index + 1}, escrita para comprobar el ritmo del texto.`).join(" ");
    mockedInvokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: "A_video", text: longText, containsLink: false, riskLevel: "low", justification: "contextual" }) } }],
    } as never);
    const result = await generateEditorialDraft({ videoTitle: "Calma", videoTheme: "la soledad" });
    expect(result.text.length).toBeLessThanOrEqual(800);
    expect(result.text).toMatch(/\n\n/);
    expect(mockedInvokeLLM).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 360 }));
  });
});
