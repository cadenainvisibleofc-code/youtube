import { describe, expect, it } from "vitest";
import { readSelectedChannelId, resolveChannelProjectId } from "./ChannelPanel";

describe("channel panel selection", () => {
  it("returns undefined outside a browser instead of inventing a channel", () => {
    expect(readSelectedChannelId()).toBeUndefined();
  });

  it("uses the only writable project when no channel exists yet", () => {
    expect(resolveChannelProjectId({ writableProjectIds: [7] })).toBe(7);
  });

  it("keeps the selected project ahead of fallbacks", () => {
    expect(resolveChannelProjectId({ selectedProjectId: 3, manageableProjectId: 7, firstChannelProjectId: 9, writableProjectIds: [11] })).toBe(3);
  });
});
