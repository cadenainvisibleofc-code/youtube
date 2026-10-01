import { describe, expect, it } from "vitest";
import { automationDedupeKey, automationScopeKey, candidateMatchesAutomationChannel } from "./automation-channel-policy";

describe("automation channel policy", () => {
  it("rejects a candidate from another selected channel", () => {
    expect(candidateMatchesAutomationChannel("channel-a", "channel-a")).toBe(true);
    expect(candidateMatchesAutomationChannel("channel-b", "channel-a")).toBe(false);
  });

  it("keeps legacy and project channel scopes separate", () => {
    expect(automationScopeKey(7, undefined)).not.toBe(automationScopeKey(7, 42));
    expect(automationDedupeKey({ ownerId: 7, projectChannelId: 42, videoId: "video", day: "2026-09-29" }))
      .not.toBe(automationDedupeKey({ ownerId: 7, projectChannelId: 43, videoId: "video", day: "2026-09-29" }));
  });

  it("allows legacy discovery only when no channel target is selected", () => {
    expect(candidateMatchesAutomationChannel("any-channel", undefined)).toBe(true);
  });
});
