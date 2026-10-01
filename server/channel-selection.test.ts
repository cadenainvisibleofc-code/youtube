import { describe, expect, it } from "vitest";
import { canReuseOAuthSlot, ChannelSelectionError, isProjectChannelSelectable, resolveChannelConnection, type ChannelConnectionCandidate } from "./channel-selection";

const channelA: ChannelConnectionCandidate = { id: 1, channelId: "channel-a", channelName: "Canal A", status: "connected" };
const channelB: ChannelConnectionCandidate = { id: 2, channelId: "channel-b", channelName: "Canal B", status: "connected" };

describe("resolveChannelConnection", () => {
  it("resolves the only connected channel when no target is supplied", () => {
    expect(resolveChannelConnection([channelA])).toEqual(channelA);
  });

  it("rejects an ambiguous selection when multiple channels are connected", () => {
    expect(() => resolveChannelConnection([channelA, channelB])).toThrowError(new ChannelSelectionError("É necessário informar o canal quando há múltiplas conexões"));
  });

  it("resolves the explicitly requested channel", () => {
    expect(resolveChannelConnection([channelA, channelB], "channel-b")).toEqual(channelB);
  });

  it("rejects a requested channel that is not connected", () => {
    expect(() => resolveChannelConnection([channelA], "channel-b")).toThrow("Canal solicitado não está conectado");
  });

  it("ignores reauthorization-required connections", () => {
    expect(() => resolveChannelConnection([{ ...channelA, status: "reauthorization_required" }])).toThrow(/Nenhum canal conectado/);
  });
});

describe("project channel lifecycle", () => {
  it("does not select or reauthorize paused and revoked channels", () => {
    expect(isProjectChannelSelectable("connected")).toBe(true);
    expect(isProjectChannelSelectable("reauthorization_required")).toBe(true);
    expect(isProjectChannelSelectable("paused")).toBe(false);
    expect(isProjectChannelSelectable("revoked")).toBe(false);
    expect(canReuseOAuthSlot("paused")).toBe(false);
    expect(canReuseOAuthSlot("revoked")).toBe(false);
  });
});
