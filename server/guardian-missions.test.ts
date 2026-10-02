import { describe, expect, it } from "vitest";
import { AUTOMATIC_GUARDIAN_QUERIES, planGuardianRoles, rankMissionCandidates } from "./guardian-missions";

describe("guardian mission role planning", () => {
  it.each([
    [1, ["presence"]],
    [2, ["presence", "reading"]],
    [3, ["presence", "reading", "perspective"]],
    [4, ["presence", "reading", "perspective", "perspective"]],
    [5, ["presence", "reading", "perspective", "perspective", "perspective"]],
  ])("plans %i synchronized guardians", (count, expected) => {
    expect(planGuardianRoles(count)).toEqual(expected);
    expect(planGuardianRoles(count).filter(role => role === "reading")).toHaveLength(count > 1 ? 1 : 0);
  });

  it.each([0, 6, -1, 2.5])("rejects invalid guardian count %i", count => {
    expect(() => planGuardianRoles(count)).toThrow("entre 1 e 5");
  });

  it("uses contextual queries and keeps only eligible long-form Spanish candidates", () => {
    expect(AUTOMATIC_GUARDIAN_QUERIES.length).toBeGreaterThanOrEqual(3);
    const candidate = (videoId: string, language: "es" | "pt", eligible: boolean, isShort = false, opportunityScore = 50) => ({
      videoId,
      language,
      isShort,
      commentCount: 20,
      viewCount: 1_000,
      eligibility: { eligible, opportunityScore },
    }) as any;
    const ranked = rankMissionCandidates([
      candidate("best", "es", true, false, 90),
      candidate("short", "es", true, true, 100),
      candidate("pt", "pt", true, false, 100),
      candidate("rejected", "es", false, false, 100),
    ]);
    expect(ranked.map(item => item.videoId)).toEqual(["best"]);
  });
});
