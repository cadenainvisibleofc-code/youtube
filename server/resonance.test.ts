import { describe, expect, it } from "vitest";
import { rankSourceComments, scoreSourceComment } from "./resonance";

const date = new Date("2026-10-01T00:00:00Z");

describe("source conversation resonance", () => {
  it("prioritizes a specific human conversation over a generic popular phrase", () => {
    const ranked = rankSourceComments([
      { commentId: "generic", text: "Muy cierto, gracias por compartir", likeCount: 500, replyCount: 1, publishedAt: date },
      { commentId: "specific", text: "Me siento solo desde que cambié de ciudad y no sé cómo volver a empezar, ¿qué hago?", likeCount: 35, replyCount: 8, publishedAt: date },
    ]);
    expect(ranked[0].comment.commentId).toBe("specific");
  });

  it("uses source likes and replies as community signals", () => {
    const result = scoreSourceComment({ text: "Me siento acompañado por esta historia", likeCount: 25, replyCount: 6, publishedAt: date });
    expect(result.signals).toEqual(expect.arrayContaining(["25 curtidas no comentário-fonte", "6 respostas na conversa-fonte"]));
    expect(result.score).toBeGreaterThan(0);
  });

  it("does not select high-risk comments as actionable source conversations", () => {
    const result = scoreSourceComment({ text: "Estoy en crisis y quiero morir, necesito ayuda urgente", likeCount: 900, replyCount: 40, publishedAt: date });
    expect(result.riskLevel).toBe("critical");
    expect(result.score).toBe(0);
    expect(rankSourceComments([{ commentId: "risk", text: "Estoy en crisis y quiero morir, necesito ayuda urgente", likeCount: 900, replyCount: 40, publishedAt: date }])).toHaveLength(0);
  });
});
