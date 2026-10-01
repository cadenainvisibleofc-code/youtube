import { describe, expect, it } from "vitest";
import { buildEditorialSkillContext, CADENA_EDITORIAL_SKILL, EDITORIAL_SKILL_VERSION, hasContextualAnchor } from "./editorial-skill";

describe("Cadena editorial skill", () => {
  it("defines a versioned contextual writing contract", () => {
    expect(EDITORIAL_SKILL_VERSION).toBe("cadena-editorial-skill-v1");
    expect(CADENA_EDITORIAL_SKILL).toContain("FLUXO OBRIGATÓRIO ANTES DE ESCREVER");
    expect(CADENA_EDITORIAL_SKILL).toContain("Qual detalhe específico");
    expect(CADENA_EDITORIAL_SKILL).toContain("não invente detalhes");
  });

  it("appends only the supplied editorial memory to the skill context", () => {
    const context = buildEditorialSkillContext("MEMÓRIA EDITORIAL ATIVA:\n- [approved] Preferir detalhes concretos");
    expect(context).toContain(CADENA_EDITORIAL_SKILL);
    expect(context).toContain("Preferir detalhes concretos");
  });

  it("accepts a response with a source anchor and rejects generic copy", () => {
    const input = { videoTitle: "Cuando sostenerlo todo pesa", videoTheme: "La descripción habla del cansancio familiar", commentText: "Siento que llevo todo solo" };
    expect(hasContextualAnchor("El cansancio de sostenerlo todo también aparece en lo que compartiste.", input)).toBe(true);
    expect(hasContextualAnchor("Gracias por compartir esta reflexión tan humana y necesaria.", input)).toBe(false);
  });
});
