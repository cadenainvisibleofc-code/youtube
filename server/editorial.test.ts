import { describe, expect, it } from "vitest";
import { canApproveDraft, chooseDraftType, classifyConversationComment, classifyRisk, formatEditorialText, generateDraft, isLikelyChannelOwnerComment, isMeaningfulPersonalComment, sanitizeCommentText, validateFinalDraft } from "./editorial";

describe("editorial safety gate", () => {
  it("does not treat creator CTAs or hashtag-heavy text as personal conversation", () => {
    expect(isLikelyChannelOwnerComment("Você conhece sua história? #saudemental #psicanalise #psicologia")).toBe(true);
    expect(isLikelyChannelOwnerComment("Si quieres acompañar más historias, sígueme en mi canal")).toBe(true);
    expect(isLikelyChannelOwnerComment("Mi madre y yo tuvimos una relación difícil y nunca pudo decirme que me quería")).toBe(false);
  });

  it("keeps short devotional reactions as video context, not personal evidence", () => {
    expect(isMeaningfulPersonalComment("Amén")).toBe(false);
    expect(isMeaningfulPersonalComment("Muy buen video")).toBe(false);
    expect(isMeaningfulPersonalComment("Me siento solo desde que terminó la relación y no sé cómo seguir")).toBe(true);
  });

  it("marks urgent crisis language as critical", () => {
    expect(classifyRisk("No quiero vivir, necesito ayuda urgente")).toMatchObject({ riskLevel: "critical" });
  });

  it("marks Portuguese crisis language as critical", () => {
    expect(classifyRisk("Não quero viver e preciso de ajuda urgente")).toMatchObject({ riskLevel: "critical" });
  });

  it("marks personal exposure as medium", () => {
    expect(classifyRisk("Me siento solo y no sé qué hacer")).toMatchObject({ riskLevel: "medium" });
  });

  it("distinguishes help requests and conversation from noise", () => {
    expect(classifyConversationComment("Necesito ayuda, no sé qué hacer").classification).toBe("help_request");
    expect(classifyConversationComment("¿Cómo encontraste calma después de ese momento?").classification).toBe("conversation");
    expect(classifyConversationComment("Muy buen video").classification).toBe("noise");
  });

  it("never chooses a link draft for high-risk context", () => {
    expect(chooseDraftType({ hasPersonalExposure: false, riskLevel: "high", linkRequested: true })).toBe("A_video");
  });

  it("allows approval only from review states and keeps links low-risk", () => {
    expect(canApproveDraft({ currentStatus: "review", riskLevel: "low", containsLink: false })).toBe(true);
    expect(canApproveDraft({ currentStatus: "review", riskLevel: "high", containsLink: true })).toBe(false);
    expect(canApproveDraft({ currentStatus: "published", riskLevel: "low", containsLink: false })).toBe(false);
  });

  it("rejects an external link in the final edited text", () => {
    expect(validateFinalDraft({ text: "Leia aqui https://example.com", riskLevel: "low", containsLink: false }).valid).toBe(false);
  });

  it("accepts only the configured reading link in a low-risk draft", () => {
    expect(validateFinalDraft({ text: "Uma leitura:\n\nLECTURA CORTA\nhttps://tinyurl.com/cadenainvisible-lectura", riskLevel: "low", containsLink: true }).valid).toBe(true);
  });

  it("rejects a link outside the dedicated reading block", () => {
    expect(validateFinalDraft({ text: "Leia https://tinyurl.com/cadenainvisible-lectura", riskLevel: "low", containsLink: true }).valid).toBe(false);
  });

  it("recalculates risk instead of trusting a low stored risk level", () => {
    expect(validateFinalDraft({ text: "Uma situação de violência doméstica exige cuidado", riskLevel: "low", containsLink: false }).valid).toBe(false);
  });

  it("rejects promotional or crisis language after editing", () => {
    expect(validateFinalDraft({ text: "Compre agora, é garantido", riskLevel: "low", containsLink: false }).valid).toBe(false);
    expect(validateFinalDraft({ text: "No quiero vivir, necesito ayuda", riskLevel: "critical", containsLink: false }).valid).toBe(false);
  });

  it("rejects pressure language and any commercial framing", () => {
    for (const text of ["sem pressão", "sin presión", "é gratuito", "aproveite a promoção", "você pode pagar depois"]) {
      expect(validateFinalDraft({ text, riskLevel: "low", containsLink: false }).valid).toBe(false);
    }
  });
});

describe("generateDraft", () => {
  it("creates an empathic video comment without a link by default", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la soledad y el propósito" });
    expect(draft.type).toBe("A_video");
    expect(draft.containsLink).toBe(false);
    expect(draft.text).not.toContain("http");
    expect(draft.text).not.toMatch(/después de leer|cuando termines|si llegas hasta el final|la lectura/i);
  });

  it("creates a specific reply for low-risk personal exposure", () => {
    const draft = generateDraft({ videoTitle: "Relaciones", videoTheme: "la distancia emocional", commentText: "Me siento solo desde que cambié de ciudad" });
    expect(draft.type).toBe("B_reply");
    expect(draft.containsLink).toBe(false);
    expect(draft.text).toMatch(/solo|cambié|ciudad/i);
    expect(draft.text).not.toContain("Leí lo que escribiste:");
    expect(draft.text).not.toMatch(/toca algo muy humano|conversación necesaria/i);
    expect(draft.text).not.toMatch(/después de leer|cuando termines|si llegas hasta el final|la lectura/i);
  });

  it("uses a humanized angle instead of mirroring the source comment", () => {
    const input = { videoTitle: "Cómo volver a confiar", videoTheme: "relaciones y distancia emocional", commentText: "Mi madre y yo tuvimos una relación difícil y nunca pudo decirme que me quería", variationKey: "humanization-a" };
    const draft = generateDraft(input);
    expect(draft.text).not.toContain(`“${input.commentText}”`);
    expect(draft.text).toMatch(/madre|relación|difícil|quería/i);
    expect(draft.text).toMatch(/no suena|abre una pregunta|me quedé|se cruzan|tensión/i);
  });

  it("removes a promotional link from crisis context", () => {
    const draft = generateDraft({ videoTitle: "Ayuda", videoTheme: "una emergencia familiar", link: "https://example.com/read" });
    expect(draft.riskLevel).toBe("critical");
    expect(draft.containsLink).toBe(false);
    expect(draft.text).not.toContain("example.com");
  });

  it("drops a non-approved link even in a low-risk context", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la soledad", link: "https://example.com/read" });
    expect(draft.containsLink).toBe(false);
    expect(draft.text).not.toContain("example.com");
  });

  it("keeps Shorts in reply-only mode", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la calma cotidiana", commentText: "Este video me hizo pensar en la calma", link: "https://tinyurl.com/cadenainvisible-lectura", responseOnly: true });
    expect(draft.type).toBe("B_reply");
    expect(draft.containsLink).toBe(true);
    expect(draft.text).toContain("https://tinyurl.com/cadenainvisible-lectura");
  });

  it("formats the reading as a separate short-reading block", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la calma cotidiana", link: "https://tinyurl.com/cadenainvisible-lectura" });
    expect(draft.text).toContain("\n\nLECTURA CORTA\n");
    expect(draft.text).not.toMatch(/sem pressão|sin presión/i);
  });

  it("formats long generated copy into short breathing paragraphs", () => {
    const text = [
      "Esta conversación abre una pregunta importante sobre la calma y la forma en que atravesamos los días.",
      "A veces reconocer lo que sentimos ya cambia la manera de mirar lo que ocurre.",
      "No hace falta resolverlo todo de una vez ni convertirlo en una respuesta perfecta.",
      "Puede bastar con quedarse un momento y escuchar con honestidad.",
      "LECTURA CORTA\nhttps://tinyurl.com/cadenainvisible-lectura",
    ].join("\n\n");
    const formatted = formatEditorialText(text);
    const body = formatted.split("\n\nLECTURA CORTA")[0] ?? formatted;
    expect(body.length).toBeLessThanOrEqual(800);
    expect(body.split("\n\n").length).toBeLessThanOrEqual(4);
    expect(body).toMatch(/\n\n/);
    expect(formatted).toContain("LECTURA CORTA");
  });

  it("preserves normal punctuation while removing decorative dash variants", () => {
    const text = sanitizeCommentText("Una frase — con una pausa; y un cierre - sencillo.");
    expect(text).toBe("Una frase - con una pausa; y un cierre - sencillo.");
    expect(text).not.toMatch(/[—–]/);
  });

  it("does not add a continuity invitation to a general video comment", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la calma cotidiana" });
    expect(draft.text).not.toMatch(/vuelve|cuéntame|contar/i);
  });

  it("allows an optional invitation after explicit interest", () => {
    const draft = generateDraft({ videoTitle: "Calma", videoTheme: "la calma cotidiana", commentText: "¿Cómo encontraste calma?", responseOnly: true, interestShown: true });
    expect(draft.text).toMatch(/vuelve|cuéntame|contar/i);
  });

  it("allows only an explicitly configured official protection resource in crisis", () => {
    const previous = process.env.OFFICIAL_PROTECTION_URLS;
    process.env.OFFICIAL_PROTECTION_URLS = "https://example.org/help";
    try {
      expect(validateFinalDraft({ text: "Si hay riesgo inmediato, busca apoyo seguro en un recurso oficial: https://example.org/help", riskLevel: "critical", containsLink: true }).valid).toBe(true);
      expect(validateFinalDraft({ text: "Una reflexión cotidiana: https://example.org/help", riskLevel: "low", containsLink: true }).valid).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.OFFICIAL_PROTECTION_URLS;
      else process.env.OFFICIAL_PROTECTION_URLS = previous;
    }
  });
});
