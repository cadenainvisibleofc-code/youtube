import { describe, expect, it } from "vitest";
import { EDITORIAL_NICHES } from "../shared/editorial-library";
import { buildEditorialSkillContext } from "./editorial-skill";

describe("editorial library", () => {
  it("keeps the curated niche catalog complete", () => {
    expect(EDITORIAL_NICHES).toHaveLength(10);
    expect(EDITORIAL_NICHES.every(niche => niche.messages.length === 5)).toBe(true);
    const allMessages = EDITORIAL_NICHES.flatMap(niche => niche.messages.map(message => message.text));
    expect(allMessages.every(text => /vuelve|volver|regresa/.test(text))).toBe(true);
    expect(allMessages.join(" ")).not.toMatch(/sin presión|sem pressão/i);
  });

  it("injects relevant models into the editorial skill context", () => {
    const context = buildEditorialSkillContext(undefined, "ansiedad y ataques de pánico", "https://tinyurl.com/cadenainvisible-lectura");
    expect(context).toContain("Ansiedade e pânico");
    expect(context).toContain("Lo que cuentas de sentir el cuerpo en alerta");
    expect(context).toContain("https://tinyurl.com/cadenainvisible-lectura");
  });

  it("does not inject reading placeholders when no link is available", () => {
    const context = buildEditorialSkillContext(undefined, "ansiedad y ataques de pánico");
    expect(context).toContain("MODELOS DE REFERÊNCIA");
    expect(context).not.toContain("{{LECTURA}}");
    expect(context).not.toContain("[link oficial da leitura]");
  });
});
