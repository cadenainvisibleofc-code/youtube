import { describe, expect, it } from "vitest";
import { evaluateEligibility, extractYouTubeVideoId } from "./ingestion";

const now = new Date("2026-09-25T00:00:00Z");

describe("extractYouTubeVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc_123", "abc_123"],
    ["https://youtu.be/abc_123", "abc_123"],
    ["https://www.youtube.com/shorts/abc_123", "abc_123"],
    ["https://evil-youtube.com/watch?v=abc_123", null],
    ["https://example.com/video", null],
  ])("parses %s", (url, expected) => {
    expect(extractYouTubeVideoId(url)).toBe(expected);
  });
});

describe("evaluateEligibility", () => {
  it("accepts a recent video with active contextual conversation", () => {
    const result = evaluateEligibility({
      publishedAt: new Date("2026-09-15T00:00:00Z"),
      viewCount: 2_000,
      commentCount: 120,
      now,
    });
    expect(result).toMatchObject({ eligible: true, status: "eligible", ageDays: 10, reasons: [] });
  });

  it("rejects stale or conversationless candidates with explicit reasons", () => {
    const result = evaluateEligibility({
      publishedAt: new Date("2026-08-01T00:00:00Z"),
      viewCount: 10_000,
      commentCount: 2,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "vídeo fora da janela de descoberta de 30 dias",
      "conversa ainda insuficiente para leitura contextual",
    ]));
  });

  it("blocks disabled comments instead of treating them as a normal rejection", () => {
    const result = evaluateEligibility({
      publishedAt: new Date("2026-09-20T00:00:00Z"),
      viewCount: 40_000,
      commentCount: 0,
      commentsEnabled: false,
      now,
    });
    expect(result).toMatchObject({ eligible: false, status: "blocked" });
  });

  it("accepts a low-view video as an emerging opportunity when engagement is strong", () => {
    const result = evaluateEligibility({
      publishedAt: new Date("2026-09-24T00:00:00Z"),
      viewCount: 5_000,
      commentCount: 35,
      now,
    });
    expect(result).toMatchObject({ eligible: true, emergingOpportunity: true });
    expect(result.opportunityScore).toBeGreaterThan(0);
    expect(result.reasons).toContain("oportunidade emergente por engajamento proporcional");
  });

  it("does not rescue a low-view video with weak engagement", () => {
    const result = evaluateEligibility({
      publishedAt: new Date("2026-09-24T00:00:00Z"),
      viewCount: 5_000,
      commentCount: 3,
      now,
    });
    expect(result).toMatchObject({ eligible: false, emergingOpportunity: false, status: "rejected" });
  });
});
