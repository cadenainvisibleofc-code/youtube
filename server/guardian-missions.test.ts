import { describe, expect, it } from "vitest";
import { planGuardianRoles } from "./guardian-missions";

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
});
